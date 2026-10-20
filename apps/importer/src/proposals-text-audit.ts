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
import { bboxPages, bigrams, characterCounts, defaultModeText, findableForms, HYPHEN_MARKER, hyphenJoins, JOIN_CLASSES, joinClass, midLineTokens, otherCharacters, pageQuality, proposedNormalize, proposedSearchPattern, tokens, WORD_SPACE, type CharacterCounts, type WordGaps } from './proposals-text';

/**
 * Auditoria do texto das propostas para a v2 (plano de melhorias, seção 19), sem publicação e sem escrita no banco. Compara, por
 * documento e pelas candidaturas que o apresentaram, o texto da v1 (`pdftotext -layout` + `searchText`) com o proposto
 * (`-bbox-layout` remontado + `proposedNormalize`): colunas, hífens de fim de linha, caracteres a normalizar, sinais de texto
 * ilegível e palavras e pares de palavras que a busca encontraria em cada um. A remontagem é conferida, página a página, contra o
 * modo padrão do pdftotext (o mesmo texto, com o hífen de fim de linha descartado). Os PDFs são dados não confiáveis: extraídos num
 * diretório próprio, lidos só por pdfinfo/pdftotext/pdftoppm em processo separado, sem shell e com tempo limite; nada do texto é
 * executado nem tratado como instrução. Com banco disponível, confere só por leitura que o texto `-layout` reproduz a v1 publicada.
 */
const exec = promisify(execFile);
/** Mesmo limiar da v1: abaixo dele a página vai para o OCR e fica fora da comparação de extração. */
const TEXT_PAGE_MIN_CHARS = 50;
/** Limiares provisórios, só para listar páginas para conferência visual; os da v2 saem desta auditoria. */
const REVIEW = { badRatio: 0.01, vowellessRatio: 0.2, pages: 12, pagesPerDocument: 2, examples: 20 };
const FILE_PATTERN = /^BR\/2022BR(\d{12})\.pdf$/;
const visible = (text: string) => text.replace(/\s/g, '').length;

export type AuditDocument = { sha256: string; file: string; path: string; candidacies: Array<{ number: string; ballotName: string; situation: string }> };
/**
 * `defaultMode`: nulo quando a remontagem com o descarte do hífen reproduz o modo padrão; senão, onde os dois começam a diferir.
 * `raw`: ordem do conteúdo do PDF, independente das outras duas, para conferir o que só a v1 encontra.
 */
type PageText = { page: number; layout: string; bbox: string; raw: string; native: boolean; defaultMode: { at: number; bbox: string; defaultMode: string } | null; gaps: WordGaps };

/** Contagem de ocorrências por chave. */
function tally(items: Iterable<string>) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}
function firstDifference(a: string, b: string) {
  if (a === b) return null;
  let at = 0;
  while (a[at] === b[at]) at++;
  return { at, bbox: a.slice(Math.max(0, at - 40), at + 40), defaultMode: b.slice(Math.max(0, at - 40), at + 40) };
}
const sumGaps = (items: WordGaps[]): WordGaps => {
  const extreme = (values: Array<number | null>, pick: (...numbers: number[]) => number) => { const known = values.filter((value): value is number => value !== null); return known.length ? pick(...known) : null; };
  return { joined: items.reduce((sum, item) => sum + item.joined, 0), spaced: items.reduce((sum, item) => sum + item.spaced, 0),
    maxJoined: extreme(items.map((item) => item.maxJoined), Math.max), minSpaced: extreme(items.map((item) => item.minSpaced), Math.min) };
};
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
  const plain = (await exec('pdftotext', ['-enc', 'UTF-8', document.path, '-'], { timeout: 300_000, maxBuffer: 512 * 2 ** 20 })).stdout.split('\f');
  const raw = (await exec('pdftotext', ['-enc', 'UTF-8', '-raw', document.path, '-'], { timeout: 300_000, maxBuffer: 512 * 2 ** 20 })).stdout.split('\f');
  if (layout.length < count) throw new Error(`${document.file}: ${layout.length} páginas no -layout para ${count} do PDF.`);
  if (bbox.length !== count) throw new Error(`${document.file}: ${bbox.length} páginas no -bbox-layout para ${count} do PDF.`);
  if (plain.length < count) throw new Error(`${document.file}: ${plain.length} páginas no modo padrão para ${count} do PDF.`);
  if (raw.length < count) throw new Error(`${document.file}: ${raw.length} páginas no -raw para ${count} do PDF.`);
  // A v1 grava o texto sem NUL; o mesmo aqui, para comparar com a publicação.
  return Array.from({ length: count }, (_, index): PageText => {
    const text = layout[index]!.replace(/\u0000/g, '');
    return { page: index + 1, layout: text, bbox: bbox[index]!.text.replace(/\u0000/g, ''), raw: raw[index]!.replace(/\u0000/g, ''), native: visible(text) >= TEXT_PAGE_MIN_CHARS,
      defaultMode: firstDifference(defaultModeText(bbox[index]!), plain[index]!), gaps: bbox[index]!.gaps };
  });
}

/**
 * Núcleo da auditoria: lê os PDFs e mede; `images` (diretório) recebe as páginas listadas para conferência visual; `terms`, se
 * dados, são contados (ocorrências na v1 e na proposta) em cada documento.
 */
export async function auditDocuments(documents: readonly AuditDocument[], options: { images: string | null; terms?: readonly string[] }) {
  const read: Array<{ document: AuditDocument; pages: PageText[] }> = [], errors: Array<{ file: string; error: string }> = [];
  for (const document of documents) {
    try { read.push({ document, pages: await documentText(document) }); }
    catch (error) { errors.push({ file: document.file, error: error instanceof Error ? error.message.split('\n')[0]! : 'falha na leitura do PDF' }); }
  }
  // Efeito na busca, com a semântica de cada uma: a v1 procura o termo normalizado no texto (`strpos`); a proposta, a expressão
  // com o marcador opcional. Termos: todas as palavras de 3+ caracteres do corpus, na grafia em que seriam digitadas. O que só a v1
  // encontra é procurado também no texto `-raw`: se não estiver lá, é palavra colada pela v1, não texto do PDF.
  const searchable = read.map(({ pages }) => pages.filter((page) => page.native).map((page) => {
    const v2 = proposedNormalize(page.bbox);
    return { page: page.page, v1: searchText(page.layout), v2, v2Joined: v2.replaceAll(HYPHEN_MARKER, ''), raw: proposedNormalize(page.raw).replaceAll(HYPHEN_MARKER, '') };
  }));
  const query = (term: string) => {
    const v1 = searchText(term), v2 = proposedNormalize(term);
    return { v1: v1.length >= 3 ? v1 : null, v2: v2.length >= 3 ? v2 : null };
  };
  const queries = [...new Set(searchable.flat().flatMap((page) => [...tokens(page.v1).map((token) => proposedNormalize(token).replaceAll(HYPHEN_MARKER, '')), ...tokens(page.v2).flatMap(findableForms)]))]
    .map((term) => { const { v1, v2 } = query(term); return { term, v1, v2, pattern: v2?.includes('-') ? proposedSearchPattern(v2) : null }; });
  const search = searchable.map((pages) => {
    const onlyV1: Array<{ text: string; pages: number[]; inRaw: number[] }> = [], onlyV2: Array<{ text: string; pages: number[] }> = [];
    for (const { term, v1, v2, pattern } of queries) {
      const found1 = v1 ? pages.filter((page) => page.v1.includes(v1)) : [];
      const found2 = v2 ? pages.filter((page) => pattern ? pattern.test(page.v2) : page.v2Joined.includes(v2)) : [];
      const a = found1.filter((page) => !found2.includes(page)), b = found2.filter((page) => !found1.includes(page));
      if (a.length) onlyV1.push({ text: term, pages: a.map((page) => page.page), inRaw: a.filter((page) => page.raw.includes(v2 ?? v1!)).map((page) => page.page) });
      if (b.length) onlyV2.push({ text: term, pages: b.map((page) => page.page) });
    }
    const pairs = (items: Array<{ pages: number[] }>) => items.reduce((sum, item) => sum + item.pages.length, 0);
    const top = <T extends { text: string; pages: number[] }>(items: T[]) => [...items].sort((x, y) => y.pages.length - x.pages.length || x.text.localeCompare(y.text)).slice(0, REVIEW.examples);
    return { onlyV1: { terms: onlyV1.length, pairs: pairs(onlyV1), inRaw: onlyV1.reduce((sum, item) => sum + item.inRaw.length, 0), examples: top(onlyV1) },
      onlyV2: { terms: onlyV2.length, pairs: pairs(onlyV2), examples: top(onlyV2) } };
  });
  // Ocorrências de termos escolhidos, v1 e proposta, por documento (nulo: termo curto demais para a busca).
  const terms = (options.terms ?? []).map((term) => {
    const { v1, v2 } = query(term), pattern = v2 ? proposedSearchPattern(v2, 'gu') : null;
    return { term, documents: read.map(({ document }, index) => ({ numbers: document.candidacies.map((item) => item.number),
      v1: v1 ? searchable[index]!.reduce((sum, page) => sum + page.v1.split(v1).length - 1, 0) : null,
      v2: pattern ? searchable[index]!.reduce((sum, page) => sum + (page.v2.match(pattern) ?? []).length, 0) : null })) };
  });
  // Palavras escritas no meio da linha em qualquer documento: evidência de que uma junção é palavra composta ou partida.
  const midLine = new Set(read.flatMap(({ pages }) => pages.filter((page) => page.native).flatMap((page) => midLineTokens(page.bbox))));
  const columnPages: Array<{ sha256: string; file: string; page: number; onlyLayout: number; onlyBbox: number; examples: { onlyLayout: string[]; onlyBbox: string[] }; image: string | null }> = [];
  const qualityPages: Array<{ sha256: string; file: string; page: number; quality: ReturnType<typeof pageQuality>; image: string | null }> = [];
  const others: string[] = [];
  // Texto -layout de cada página (chave sha256/página), para conferir com a v1 publicada.
  const layoutTexts = new Map<string, string>();
  const report = read.map(({ document, pages }, index) => {
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
      // Em todas as páginas: a remontagem, com o hífen descartado como o Poppler faz, precisa ser o texto do modo padrão.
      defaultMode: { identical: pages.filter((page) => !page.defaultMode).length, different: pages.filter((page) => page.defaultMode).map((page) => ({ page: page.page, ...page.defaultMode! })) },
      wordGaps: sumGaps(pages.map((page) => page.gaps)),
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
      // Pares termo × página que só uma das buscas encontra (`inRaw`: dos só da v1, quantos existem no texto `-raw`).
      search: search[index]!,
      hyphens: { lineEndJoins: joins.length, withDigits: joins.filter((join) => join.digits).length, acrossBlankLine: joins.filter((join) => join.blankLine).length, classes,
        examples: only(tally(joinExamples), new Set()).examples },
      quality: { flagged: qualities.filter((item) => (item.quality.badRatio ?? 0) >= REVIEW.badRatio || (item.quality.vowellessRatio ?? 0) >= REVIEW.vowellessRatio).map((item) => item.page) },
    };
  });

  // Páginas para conferência visual: as que mais mudam entre os modos, por documento (senão a amostra fica toda no documento de
  // maior diferença), e as de pior qualidade.
  const byColumns = read.flatMap(({ document }) => columnPages.filter((item) => item.sha256 === document.sha256)
    .sort((a, b) => (b.onlyLayout + b.onlyBbox) - (a.onlyLayout + a.onlyBbox) || a.page - b.page).slice(0, REVIEW.pagesPerDocument));
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
      pagesDifferentFromDefaultMode: report.reduce((sum, item) => sum + item.defaultMode.different.length, 0), wordGaps: sumGaps(report.map((item) => item.wordGaps)),
      pagesWithColumnDifferences: columnPages.length, pagesFlaggedForQuality: report.reduce((sum, item) => sum + item.quality.flagged.length, 0),
      lineEndJoins: report.reduce((sum, item) => sum + item.hyphens.lineEndJoins, 0),
      search: { onlyV1Pairs: report.reduce((sum, item) => sum + item.search.onlyV1.pairs, 0), onlyV1InRaw: report.reduce((sum, item) => sum + item.search.onlyV1.inRaw, 0),
        onlyV2Pairs: report.reduce((sum, item) => sum + item.search.onlyV2.pairs, 0) },
      joinClasses: Object.fromEntries(JOIN_CLASSES.map((name) => [name, report.reduce((sum, item) => sum + item.hyphens.classes[name], 0)])) },
    documents: report,
    terms,
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
  const terms = process.argv.find((arg) => arg.startsWith('--termos='))?.slice('--termos='.length).split(',').map((term) => term.trim()).filter(Boolean) ?? [];
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
  const { layoutTexts, ...audit } = await auditDocuments(ordered, { images: images ? resolve(directory, 'paginas') : null, terms });
  const v1Publication = await compareWithV1(layoutTexts, proposals.sha256);
  const extractor = (await exec('pdftotext', ['-v'], { timeout: 10_000 }).catch((error: { stdout?: string; stderr?: string }) => error)).stderr?.split('\n')[0] ?? null;
  const report = {
    generatedAt: new Date().toISOString(), scope: 'Propostas de governo da Presidência, Eleições 2022 (TSE): auditoria do texto para a proposals-2022-v2, sem publicação.',
    plan: 'docs/plano-postgis-propostas.md, seção 19',
    sources: [proposals, registry].map(({ file, url, sha256, sizeBytes, lastModified, downloadedAt }) => ({ file, url, sha256, sizeBytes, lastModified, downloadedAt })),
    method: { extractor, textPageMinChars: TEXT_PAGE_MIN_CHARS, review: REVIEW, bboxWordSpace: WORD_SPACE, v1: 'pdftotext -layout + searchText (contratos)',
      proposed: 'pdftotext -bbox-layout remontado (espaço entre palavras a partir de bboxWordSpace da altura da linha; conferido contra o modo padrão) + proposedNormalize (protótipo em proposals-text.ts)',
      tokens: 'Palavras do texto normalizado sem pontuação nas pontas; aproximação do que a busca literal encontra. Com o marcador, contam as grafias sem e com hífen.', staging },
    ...audit, v1Publication,
    sideEffects: 'Download e preservação dos ZIPs do TSE, se ausentes; PDFs extraídos em data/staging/proposta_governo_2022-auditoria; imagens de páginas no diretório do relatório; nenhuma escrita no banco nem publicação.',
  };
  await writeFile(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ report: resolve(directory, 'report.json'), summary: audit.summary, v1Publication: { ...v1Publication, ocrNormalization: undefined },
    documents: audit.documents.map((item) => ({ candidacies: item.candidacies.map((candidacy) => `${candidacy.number} ${candidacy.ballotName}`).join(' / '), pages: item.pages, native: item.nativePages,
      defaultModeDifferent: item.defaultMode.different.length, searchOnlyV1: item.search.onlyV1.pairs, searchOnlyV1InRaw: item.search.onlyV1.inRaw, searchOnlyV2: item.search.onlyV2.pairs, joins: item.hyphens.lineEndJoins,
      pairsOnlyLayout: item.extraction.pairsOnlyLayout.distinct, pairsOnlyBbox: item.extraction.pairsOnlyBbox.distinct, tokensOnlyV1: item.total.tokensOnlyV1.distinct, tokensOnlyV2: item.total.tokensOnlyV2.distinct, flagged: item.quality.flagged.length })) }, null, 2));
  if (audit.summary.errors.length) process.exitCode = 1;
}
if (require.main === module) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Auditoria do texto das propostas falhou.'); process.exitCode = 1; });
