import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { searchText } from '@observatorio/contracts';
import { entries, rows } from './csv';
import { ROOT, sourceFile } from './sources';
import { bboxPages, bigrams, characterCounts, findableForms, HYPHEN_MARKER, hyphenJoins, JOIN_CLASSES, joinClass, midLineTokens, otherCharacters, pageQuality, proposedNormalize, tokens, type CharacterCounts } from './proposals-text';

/**
 * Auditoria do texto das propostas para a v2 (plano de melhorias, seção 19), sem publicação e sem escrita no banco. Compara, por
 * documento e pelas candidaturas que o apresentaram, o texto da v1 (`pdftotext -layout` + `searchText`) com o proposto
 * (`-bbox-layout` remontado + `proposedNormalize`): colunas, hífens de fim de linha, caracteres a normalizar, sinais de texto
 * ilegível e palavras e pares de palavras que a busca encontraria em cada um. Os PDFs são dados não confiáveis: extraídos num
 * diretório próprio, lidos só por pdfinfo/pdftotext/pdftoppm em processo separado, sem shell e com tempo limite; nada do texto é
 * executado nem tratado como instrução. Com banco disponível, confere só por leitura que o texto `-layout` reproduz a v1 publicada.
 */
const exec = promisify(execFile);
/** Mesmo limiar da v1: abaixo dele a página vai para o OCR e fica fora da comparação de extração. */
const TEXT_PAGE_MIN_CHARS = 50;
/** Limiares provisórios, só para listar páginas para conferência visual; os da v2 saem desta auditoria. */
const REVIEW = { badRatio: 0.01, vowellessRatio: 0.2, pages: 12, examples: 20 };
const FILE_PATTERN = /^BR\/2022BR(\d{12})\.pdf$/;
const visible = (text: string) => text.replace(/\s/g, '').length;

export type AuditDocument = { sha256: string; file: string; path: string; candidacies: Array<{ number: string; ballotName: string; situation: string }> };
type PageText = { page: number; layout: string; bbox: string; native: boolean };

/** Contagem de ocorrências por chave. */
function tally(items: Iterable<string>) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}
/** Chaves de `a` ausentes de `b`: distintas, ocorrências e as mais frequentes como exemplo. */
function only(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number> | ReadonlySet<string>) {
  const missing = [...a].filter(([key]) => !b.has(key)).sort(([x, m], [y, n]) => n - m || x.localeCompare(y));
  return { distinct: missing.length, occurrences: missing.reduce((sum, [, count]) => sum + count, 0), examples: missing.slice(0, REVIEW.examples).map(([key, count]) => ({ text: key, count })) };
}
const sumCounts = (items: CharacterCounts[]) => items.reduce((total, item) => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, (total[key as keyof CharacterCounts] ?? 0) + value])) as CharacterCounts, {} as CharacterCounts);

async function documentText(document: AuditDocument) {
  const info = (await exec('pdfinfo', [document.path], { timeout: 60_000 })).stdout;
  const count = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
  if (!Number.isInteger(count) || count < 1) throw new Error(`${document.file}: número de páginas ilegível.`);
  if (/^Encrypted:\s+yes/m.test(info)) throw new Error(`${document.file}: PDF protegido.`);
  const layout = (await exec('pdftotext', ['-enc', 'UTF-8', '-layout', document.path, '-'], { timeout: 300_000, maxBuffer: 512 * 2 ** 20 })).stdout.split('\f');
  const bbox = bboxPages((await exec('pdftotext', ['-enc', 'UTF-8', '-bbox-layout', document.path, '-'], { timeout: 300_000, maxBuffer: 1024 * 2 ** 20 })).stdout);
  if (layout.length < count) throw new Error(`${document.file}: ${layout.length} páginas no -layout para ${count} do PDF.`);
  if (bbox.length !== count) throw new Error(`${document.file}: ${bbox.length} páginas no -bbox-layout para ${count} do PDF.`);
  // A v1 grava o texto sem NUL; o mesmo aqui, para comparar com a publicação.
  return Array.from({ length: count }, (_, index): PageText => {
    const text = layout[index]!.replace(/\u0000/g, '');
    return { page: index + 1, layout: text, bbox: bbox[index]!.text.replace(/\u0000/g, ''), native: visible(text) >= TEXT_PAGE_MIN_CHARS };
  });
}

/** Núcleo da auditoria: lê os PDFs e mede; `images` (diretório) recebe as páginas listadas para conferência visual. */
export async function auditDocuments(documents: readonly AuditDocument[], options: { images: string | null }) {
  const read: Array<{ document: AuditDocument; pages: PageText[] }> = [], errors: Array<{ file: string; error: string }> = [];
  for (const document of documents) {
    try { read.push({ document, pages: await documentText(document) }); }
    catch (error) { errors.push({ file: document.file, error: error instanceof Error ? error.message.split('\n')[0]! : 'falha na leitura do PDF' }); }
  }
  // Palavras escritas no meio da linha em qualquer documento: evidência de que uma junção é palavra composta ou partida.
  const midLine = new Set(read.flatMap(({ pages }) => pages.filter((page) => page.native).flatMap((page) => midLineTokens(page.bbox))));
  const columnPages: Array<{ sha256: string; file: string; page: number; onlyLayout: number; onlyBbox: number; examples: { onlyLayout: string[]; onlyBbox: string[] }; image: string | null }> = [];
  const qualityPages: Array<{ sha256: string; file: string; page: number; quality: ReturnType<typeof pageQuality>; image: string | null }> = [];
  const others: string[] = [];
  // Texto -layout de cada página (chave sha256/página), para conferir com a v1 publicada.
  const layoutTexts = new Map<string, string>();
  const report = read.map(({ document, pages }) => {
    const native = pages.filter((page) => page.native);
    // Efeito da extração, com a mesma normalização da v1 nos dois textos.
    const layoutV1 = native.map((page) => tokens(searchText(page.layout))), bboxV1 = native.map((page) => tokens(searchText(page.bbox)));
    native.forEach((page, index) => {
      const a = new Set(bigrams(layoutV1[index]!)), b = new Set(bigrams(bboxV1[index]!));
      const onlyLayout = [...a].filter((pair) => !b.has(pair)), onlyBbox = [...b].filter((pair) => !a.has(pair));
      if (onlyLayout.length || onlyBbox.length) columnPages.push({ sha256: document.sha256, file: document.file, page: page.page, onlyLayout: onlyLayout.length, onlyBbox: onlyBbox.length, examples: { onlyLayout: onlyLayout.slice(0, 5), onlyBbox: onlyBbox.slice(0, 5) }, image: null });
    });
    // Efeito da normalização, sobre o texto proposto; e o efeito total, v1 contra a proposta. As grafias com hífen que o marcador
    // acrescenta ficam à parte, para não encobrir as palavras recuperadas (colunas, ligaduras, invisíveis).
    const bboxV2 = native.map((page) => tokens(proposedNormalize(page.bbox)));
    const joined = (words: readonly string[]) => words.map((word) => word.replaceAll(HYPHEN_MARKER, ''));
    const v1Tokens = tally(layoutV1.flat()), bboxV1Tokens = tally(bboxV1.flat()), v2Forms = tally(bboxV2.flat().flatMap(findableForms)), v2Joined = tally(bboxV2.flatMap(joined));
    const v2Hyphenated = tally(bboxV2.flat().filter((word) => word.includes(HYPHEN_MARKER)).map((word) => word.replaceAll(HYPHEN_MARKER, '-')));
    const v1Pairs = tally(layoutV1.flatMap(bigrams)), bboxV1Pairs = tally(bboxV1.flatMap(bigrams)), v2JoinedPairs = tally(bboxV2.flatMap((words) => bigrams(joined(words))));
    const v2Pairs = tally(bboxV2.flatMap((words) => bigrams(words).flatMap((pair) => { const [x, y] = pair.split(' '); return findableForms(x!).flatMap((a) => findableForms(y!).map((b) => `${a} ${b}`)); })));
    const joins = native.flatMap((page) => hyphenJoins(page.bbox));
    const classes = Object.fromEntries(JOIN_CLASSES.map((name) => [name, 0])) as Record<typeof JOIN_CLASSES[number], number>;
    // Exemplos das junções que não são só palavra partida: é onde descartar o hífen (regra da v1) perde a grafia.
    const joinExamples: string[] = [];
    for (const join of joins) { const kind = joinClass(join, midLine); classes[kind]++; if (kind !== 'split') joinExamples.push(`${join.left}-${join.right} (${kind})`); }
    const qualities = native.map((page) => ({ sha256: document.sha256, file: document.file, page: page.page, quality: pageQuality(page.bbox), image: null }));
    qualityPages.push(...qualities);
    for (const page of native) others.push(...otherCharacters(page.bbox));
    for (const page of pages) layoutTexts.set(`${document.sha256}/${page.page}`, page.layout);
    return {
      sha256: document.sha256, file: document.file, candidacies: document.candidacies, pages: pages.length, nativePages: native.length,
      belowThreshold: pages.filter((page) => !page.native).map((page) => page.page),
      // Mesmos caracteres visíveis nos dois modos, salvo o que o -layout repete ou omite; diferença aqui merece conferência.
      visibleDifference: native.filter((page) => visible(page.layout) !== visible(page.bbox)).map((page) => ({ page: page.page, layout: visible(page.layout), bbox: visible(page.bbox) })),
      characters: { layout: sumCounts(native.map((page) => characterCounts(page.layout))), bbox: sumCounts(native.map((page) => characterCounts(page.bbox))) },
      layout: {
        linesWithGap: native.reduce((sum, page) => sum + page.layout.split('\n').filter((line) => /\S {3,}\S/.test(line.trim())).length, 0),
        hyphenBeforeGap: native.reduce((sum, page) => sum + (page.layout.match(/\p{L}-[ \t]{2,}\S/gu) ?? []).length, 0),
        lineEndJoins: native.reduce((sum, page) => sum + hyphenJoins(page.layout).length, 0),
      },
      extraction: { tokensOnlyLayout: only(v1Tokens, bboxV1Tokens), tokensOnlyBbox: only(bboxV1Tokens, v1Tokens), pairsOnlyLayout: only(v1Pairs, bboxV1Pairs), pairsOnlyBbox: only(bboxV1Pairs, v1Pairs) },
      normalization: { tokensOnlyV1: only(bboxV1Tokens, v2Forms), tokensOnlyV2: only(v2Joined, bboxV1Tokens) },
      // Só na v1: o que a busca deixaria de encontrar (precisa de explicação); só na v2: palavras inteiras e pares recuperados;
      // grafias com hífen: o que o marcador passa a encontrar, inclusive as de palavras só partidas ("prote-cao").
      total: { tokensOnlyV1: only(v1Tokens, v2Forms), tokensOnlyV2: only(v2Joined, v1Tokens), hyphenatedOnlyV2: only(v2Hyphenated, v1Tokens),
        pairsOnlyV1: only(v1Pairs, v2Pairs), pairsOnlyV2: only(v2JoinedPairs, v1Pairs) },
      hyphens: { lineEndJoins: joins.length, withDigits: joins.filter((join) => join.digits).length, acrossBlankLine: joins.filter((join) => join.blankLine).length, classes,
        examples: only(tally(joinExamples), new Set()).examples },
      quality: { flagged: qualities.filter((item) => (item.quality.badRatio ?? 0) >= REVIEW.badRatio || (item.quality.vowellessRatio ?? 0) >= REVIEW.vowellessRatio).map((item) => item.page) },
    };
  });

  // Páginas para conferência visual: as que mais mudam entre os modos e as de pior qualidade.
  const byColumns = [...columnPages].sort((a, b) => (b.onlyLayout + b.onlyBbox) - (a.onlyLayout + a.onlyBbox) || a.file.localeCompare(b.file) || a.page - b.page).slice(0, REVIEW.pages);
  const score = (item: typeof qualityPages[number]) => Math.max((item.quality.badRatio ?? 0) / REVIEW.badRatio, (item.quality.vowellessRatio ?? 0) / REVIEW.vowellessRatio);
  const byQuality = qualityPages.filter((item) => score(item) > 0).sort((a, b) => score(b) - score(a) || a.file.localeCompare(b.file) || a.page - b.page).slice(0, REVIEW.pages);
  if (options.images) {
    await mkdir(options.images, { recursive: true });
    for (const item of [...byColumns, ...byQuality]) {
      const document = documents.find((entry) => entry.sha256 === item.sha256)!;
      const name = `${basename(document.file, '.pdf')}-p${item.page}`;
      await exec('pdftoppm', ['-r', '80', '-gray', '-png', '-singlefile', '-f', String(item.page), '-l', String(item.page), document.path, resolve(options.images, name)], { timeout: 120_000 });
      item.image = `${name}.png`;
    }
  }
  const pages = report.reduce((sum, item) => sum + item.pages, 0), nativePages = report.reduce((sum, item) => sum + item.nativePages, 0);
  return {
    summary: { documents: documents.length, read: report.length, errors, pages, nativePages, belowThreshold: pages - nativePages,
      pagesWithColumnDifferences: columnPages.length, pagesFlaggedForQuality: report.reduce((sum, item) => sum + item.quality.flagged.length, 0),
      lineEndJoins: report.reduce((sum, item) => sum + item.hyphens.lineEndJoins, 0),
      joinClasses: Object.fromEntries(JOIN_CLASSES.map((name) => [name, report.reduce((sum, item) => sum + item.hyphens.classes[name], 0)])) },
    documents: report,
    review: { columns: byColumns, quality: byQuality },
    otherCharacters: [...tally(others)].sort(([x, m], [y, n]) => n - m || x.localeCompare(y)).slice(0, 40).map(([char, count]) => ({ code: `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`, char, count })),
    layoutTexts,
  };
}

/** Só leitura: o texto `-layout` reproduz o da v1 publicada? E o efeito da normalização proposta no texto do OCR da v1. */
async function compareWithV1(texts: ReadonlyMap<string, string>, zipSha256: string) {
  if (!process.env.DATABASE_URL) return { compared: false, reason: 'DATABASE_URL ausente.' };
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, options: '-c default_transaction_read_only=on' });
  try {
    const batch = (await pool.query<{ id: string; metadata: { sources?: Array<{ file: string; sha256: string }> } }>("SELECT id, metadata FROM import_batches WHERE published AND scope='2022/proposals/president' LIMIT 1")).rows[0];
    if (!batch) return { compared: false, reason: 'Nenhuma publicação de 2022/proposals/president.' };
    const pages = (await pool.query<{ sha256: string; page: number; method: string; text: string }>('SELECT sha256, page, method, text FROM proposal_pages WHERE batch_id=$1 ORDER BY sha256, page', [batch.id])).rows;
    const native = pages.filter((page) => page.method === 'native'), ocr = pages.filter((page) => page.method === 'ocr');
    const different = native.filter((page) => texts.get(`${page.sha256}/${page.page}`) !== page.text).map((page) => `${page.sha256.slice(0, 12)}/${page.page}`);
    const v1 = tally(ocr.flatMap((page) => tokens(searchText(page.text)))), v2 = ocr.map((page) => tokens(proposedNormalize(page.text)));
    const v2Forms = tally(v2.flat().flatMap(findableForms)), v2Joined = tally(v2.flat().map((word) => word.replaceAll(HYPHEN_MARKER, '')));
    return { compared: true, batchId: batch.id, sameZip: batch.metadata.sources?.find((source) => source.file === 'proposta_governo_2022_BR.zip')?.sha256 === zipSha256,
      nativePages: native.length, nativeIdentical: native.length - different.length, nativeDifferent: different.slice(0, REVIEW.examples),
      ocrPages: ocr.length, ocrNormalization: { tokensOnlyV1: only(v1, v2Forms), tokensOnlyV2: only(v2Joined, v1) } };
  } catch (error) { return { compared: false, reason: `Banco indisponível: ${error instanceof Error ? error.message.split('\n')[0] : 'erro'}` }; }
  finally { await pool.end(); }
}

async function main() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  const images = !process.argv.includes('--sem-imagens');
  const proposals = await sourceFile({ file: 'proposta_governo_2022_BR.zip', entry: 'BR/2022BR<SQ_CANDIDATO>.pdf', directory: 'proposta_governo' });
  const registry = await sourceFile({ file: 'consulta_cand_2022.zip', entry: 'consulta_cand_2022_BR.csv', directory: 'consulta_cand' });
  // Só as colunas da candidatura, como no inventário e no importador.
  const candidacies = new Map<string, { number: string; ballotName: string; situation: string }>();
  for await (const row of rows(registry.path, 'consulta_cand_2022_BR.csv')) if (row.DS_CARGO === 'PRESIDENTE' && row.NR_TURNO === '1') candidacies.set(row.SQ_CANDIDATO!, { number: row.NR_CANDIDATO!, ballotName: row.NM_URNA_CANDIDATO!, situation: row.DS_SITUACAO_CANDIDATURA! });

  // Diretório próprio da auditoria, para nunca apagar o staging de uma importação em andamento.
  const staging = resolve(ROOT, 'data/staging/proposta_governo_2022-auditoria', proposals.sha256);
  await rm(staging, { recursive: true, force: true }); await mkdir(staging, { recursive: true });
  const names = entries(proposals.path);
  const unexpected = names.filter((name) => !FILE_PATTERN.test(name) && name !== 'BR/leiame.pdf');
  if (unexpected.length) throw new Error(`Arquivos não previstos no ZIP: ${unexpected.join(', ')}.`);
  const documents = new Map<string, AuditDocument>();
  for (const name of names.filter((item) => FILE_PATTERN.test(item))) {
    const sq = FILE_PATTERN.exec(name)![1]!;
    const candidacy = candidacies.get(sq);
    if (!candidacy) throw new Error(`Documento sem candidatura no cadastro: ${name}.`);
    const { stdout: bytes } = await exec('unzip', ['-p', proposals.path, name], { encoding: 'buffer', maxBuffer: 256 * 2 ** 20 });
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const existing = documents.get(sha256);
    if (existing) { existing.candidacies.push(candidacy); continue; }
    const path = resolve(staging, `${sha256}.pdf`);
    await writeFile(path, bytes, { mode: 0o444 });
    documents.set(sha256, { sha256, file: name, path, candidacies: [candidacy] });
  }
  const ordered = [...documents.values()].sort((a, b) => Math.min(...a.candidacies.map((item) => Number(item.number))) - Math.min(...b.candidacies.map((item) => Number(item.number))));

  const stamp = new Date().toISOString().replaceAll(':', '-');
  const directory = resolve(ROOT, 'data/analysis', `propostas-texto-${stamp}`);
  await mkdir(directory, { recursive: true });
  const { layoutTexts, ...audit } = await auditDocuments(ordered, { images: images ? resolve(directory, 'paginas') : null });
  const v1Publication = await compareWithV1(layoutTexts, proposals.sha256);
  const extractor = (await exec('pdftotext', ['-v'], { timeout: 10_000 }).catch((error: { stdout?: string; stderr?: string }) => error)).stderr?.split('\n')[0] ?? null;
  const report = {
    generatedAt: new Date().toISOString(), scope: 'Propostas de governo da Presidência, Eleições 2022 (TSE): auditoria do texto para a proposals-2022-v2, sem publicação.',
    plan: 'docs/plano-postgis-propostas.md, seção 19',
    sources: [proposals, registry].map(({ file, url, sha256, sizeBytes, lastModified, downloadedAt }) => ({ file, url, sha256, sizeBytes, lastModified, downloadedAt })),
    method: { extractor, textPageMinChars: TEXT_PAGE_MIN_CHARS, review: REVIEW, v1: 'pdftotext -layout + searchText (contratos)', proposed: 'pdftotext -bbox-layout remontado + proposedNormalize (protótipo em proposals-text.ts)',
      tokens: 'Palavras do texto normalizado sem pontuação nas pontas; aproximação do que a busca literal encontra. Com o marcador, contam as grafias sem e com hífen.', staging },
    ...audit, v1Publication,
    sideEffects: 'Download e preservação dos ZIPs do TSE, se ausentes; PDFs extraídos em data/staging/proposta_governo_2022-auditoria; imagens de páginas no diretório do relatório; nenhuma escrita no banco nem publicação.',
  };
  await writeFile(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ report: resolve(directory, 'report.json'), summary: audit.summary, v1Publication: { ...v1Publication, ocrNormalization: undefined },
    documents: audit.documents.map((item) => ({ candidacies: item.candidacies.map((candidacy) => `${candidacy.number} ${candidacy.ballotName}`).join(' / '), pages: item.pages, native: item.nativePages, joins: item.hyphens.lineEndJoins,
      pairsOnlyLayout: item.extraction.pairsOnlyLayout.distinct, pairsOnlyBbox: item.extraction.pairsOnlyBbox.distinct, tokensOnlyV1: item.total.tokensOnlyV1.distinct, tokensOnlyV2: item.total.tokensOnlyV2.distinct, flagged: item.quality.flagged.length })) }, null, 2));
  if (audit.summary.errors.length) process.exitCode = 1;
}
if (require.main === module) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Auditoria do texto das propostas falhou.'); process.exitCode = 1; });
