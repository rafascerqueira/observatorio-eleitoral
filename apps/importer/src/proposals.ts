import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { PROPOSALS_NORMALIZATION, proposalsDatasetSchema, searchText } from '@observatorio/contracts';
import { entries, rows } from './csv';
import { ROOT, sourceFile } from './sources';
import { bboxPages, defaultModeText, exceedsQuality, pageQuality, WORD_SPACE } from './proposals-text';
import { preparePublication, publicationId, publishedInputs, reusePublished } from './publication';

/**
 * Propostas de governo da Presidência de 2022 para a busca literal (fase D2; v2 de 20/10/2026, plano de melhorias, seção 19). Texto
 * por página: o do próprio PDF, em ordem de leitura (`pdftotext -bbox-layout` remontado e conferido com o modo padrão), quando tem
 * ao menos 50 caracteres visíveis; senão, OCR (Tesseract, português, 300 dpi) da página inteira, mantido só se render ao menos tanto
 * texto quanto o PDF. Texto do PDF acima dos limiares de texto ilegível bloqueia a publicação. Os PDFs são dados não confiáveis:
 * extraídos num diretório próprio e lidos só por pdfinfo/pdftotext/pdftoppm/tesseract em processo separado, sem shell e com tempo
 * limite; nada do texto é executado nem tratado como instrução.
 * Documento → candidatura pelo `SQ_CANDIDATO` do nome do arquivo; candidatura → resultados pelo número, nunca pelo nome.
 */
const VERSION = 'proposals-2022-v2';
const SCOPE = '2022/proposals/president';
const TEXT_PAGE_MIN_CHARS = 50, OCR_DPI = 300, OCR_LANGUAGE = 'por';
/**
 * Limiares de texto ilegível nas páginas com texto do PDF: fração de U+FFFD, uso privado e controles sobre os caracteres visíveis
 * e de palavras de 3+ letras sem vogal. Na auditoria de 20/10/2026, os maiores valores foram 0,4 % e 9,9 %.
 */
const QUALITY = { maxBadRatio: 0.01, maxVowellessRatio: 0.2 };
const PACKAGES: Record<string, string> = { pdftotext: 'poppler-utils', tesseract: 'tesseract-ocr e tesseract-ocr-por' };
const FILE_PATTERN = /^BR\/2022BR(\d{12})\.pdf$/;
const exec = promisify(execFile);
const visible = (text: string) => text.replace(/\s/g, '').length;
/** `quality`: medida só nas páginas com texto do PDF acima do limiar; nas demais, nula (não medida). */
type Page = { page: number; method: 'native' | 'ocr' | 'empty'; text: string; quality: ReturnType<typeof pageQuality> | null };

async function version(command: string, args: string[]) {
  const output = await exec(command, args, { timeout: 10_000 }).catch((error: { stdout?: string; stderr?: string; code?: string }) => {
    if (error.code === 'ENOENT') throw new Error(`${command} não instalado; instale ${PACKAGES[command] ?? command}.${command === 'tesseract' ? ' Sem OCR, a busca seria desigual entre candidaturas.' : ''}`);
    return { stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  });
  const line = `${output.stdout}${output.stderr}`.split('\n').find((item) => item.trim());
  if (!line) throw new Error(`${command} ${args.join(' ')} não informou a versão; importação bloqueada.`);
  return line.trim();
}

/**
 * Páginas de um PDF: texto do PDF em ordem de leitura (`-bbox-layout` remontado e conferido, página a página, com o modo padrão do
 * pdftotext; qualquer diferença bloqueia) e, nas páginas abaixo do limiar, OCR da página renderizada.
 */
export async function documentPages(path: string, work: string): Promise<Page[]> {
  const info = (await exec('pdfinfo', [path], { timeout: 60_000 })).stdout;
  const count = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
  if (!Number.isInteger(count) || count < 1) throw new Error(`${path}: número de páginas ilegível.`);
  if (/^Encrypted:\s+yes/m.test(info)) throw new Error(`${path}: PDF protegido; importação bloqueada.`);
  const bbox = bboxPages((await exec('pdftotext', ['-enc', 'UTF-8', '-bbox-layout', path, '-'], { timeout: 300_000, maxBuffer: 1024 * 2 ** 20 })).stdout);
  const plain = (await exec('pdftotext', ['-enc', 'UTF-8', path, '-'], { timeout: 300_000, maxBuffer: 512 * 2 ** 20 })).stdout.split('\f');
  if (bbox.length !== count) throw new Error(`${path}: ${bbox.length} páginas no -bbox-layout para ${count} do PDF.`);
  if (plain.length < count) throw new Error(`${path}: ${plain.length} páginas no modo padrão para ${count} do PDF.`);
  const pages: Page[] = [];
  for (let page = 1; page <= count; page++) {
    if (defaultModeText(bbox[page - 1]!) !== plain[page - 1]) throw new Error(`${path}: página ${page} remontada diverge do modo padrão do pdftotext; importação bloqueada.`);
    const text = bbox[page - 1]!.text.replace(/\u0000/g, '');
    if (visible(text) >= TEXT_PAGE_MIN_CHARS) { pages.push({ page, method: 'native', text, quality: pageQuality(text) }); continue; }
    const image = resolve(work, `p${page}`);
    await exec('pdftoppm', ['-r', String(OCR_DPI), '-gray', '-png', '-singlefile', '-f', String(page), '-l', String(page), path, image], { timeout: 300_000 });
    const ocr = (await exec('tesseract', [`${image}.png`, 'stdout', '-l', OCR_LANGUAGE], { timeout: 600_000, maxBuffer: 64 * 2 ** 20 })).stdout.replace(/\u0000/g, '');
    await rm(`${image}.png`);
    if (visible(ocr) > 0 && visible(ocr) >= visible(text)) pages.push({ page, method: 'ocr', text: ocr, quality: null });
    else pages.push({ page, method: visible(text) > 0 ? 'native' : 'empty', text, quality: null });
  }
  return pages;
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const method = { textPageMinChars: TEXT_PAGE_MIN_CHARS, pdftotext: await version('pdftotext', ['-v']), tesseract: await version('tesseract', ['--version']), ocrLanguage: OCR_LANGUAGE, ocrDpi: OCR_DPI,
    extraction: 'bbox-layout' as const, wordSpace: WORD_SPACE, normalization: PROPOSALS_NORMALIZATION, quality: QUALITY };
  if (!(await exec('tesseract', ['--list-langs'], { timeout: 10_000 })).stdout.split('\n').includes(OCR_LANGUAGE)) throw new Error('Tesseract sem o idioma português (tesseract-ocr-por).');
  const proposals = await sourceFile({ file: 'proposta_governo_2022_BR.zip', entry: 'BR/2022BR<SQ_CANDIDATO>.pdf', directory: 'proposta_governo' });
  const registry = await sourceFile({ file: 'consulta_cand_2022.zip', entry: 'consulta_cand_2022_BR.csv', directory: 'consulta_cand' });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'migrations/020-proposals.sql'), 'utf8'));
    const inputs = await publishedInputs(client, ['2022/president/BR', '2022/president/ZZ']);
    const id = publicationId(VERSION, [proposals.sha256, registry.sha256], inputs, method);
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { console.log(`Já publicado: ${id}.`); return; }

    // Candidaturas do 1º turno (só colunas da candidatura) e números com votos nos resultados publicados.
    type Candidacy = { sq: string; number: string; ballotName: string; party: string; situation: string };
    const candidacies: Candidacy[] = [], generated = new Set<string>(); let registryRows = 0;
    for await (const row of rows(registry.path, 'consulta_cand_2022_BR.csv')) {
      registryRows++; generated.add(`${row.DT_GERACAO} ${row.HH_GERACAO}`);
      if (row.DS_CARGO === 'PRESIDENTE' && row.NR_TURNO === '1') candidacies.push({ sq: row.SQ_CANDIDATO!, number: row.NR_CANDIDATO!, ballotName: row.NM_URNA_CANDIDATO!, party: row.SG_PARTIDO!, situation: row.DS_SITUACAO_CANDIDATURA! });
    }
    const voted = new Set((await client.query<{ number: string }>(`SELECT DISTINCT c->>'number' AS number FROM municipality_results m JOIN import_batches b ON b.id=m.batch_id AND b.id = ANY($1::text[]),
      jsonb_array_elements(m.result->'candidates') c WHERE m.result->>'round' = '1'`, [inputs.map((input) => input.id)])).rows.map((row) => row.number));
    // Votos de um número pertencem à única candidatura apta com ele; qualquer outra combinação bloqueia.
    const withVotes = (item: Candidacy) => voted.has(item.number) && item.situation === 'APTO';
    for (const number of voted) if (candidacies.filter((item) => item.number === number && item.situation === 'APTO').length !== 1) throw new Error(`Número ${number} dos resultados sem exatamente uma candidatura apta.`);
    for (const item of candidacies) if (item.situation === 'APTO' && !voted.has(item.number)) throw new Error(`Candidatura apta ${item.number} sem votos nos resultados.`);

    // Extração isolada dos PDFs e texto por página (um processamento por documento único).
    const staging = resolve(ROOT, 'data/staging/proposta_governo_2022', proposals.sha256);
    await rm(staging, { recursive: true, force: true }); await mkdir(staging, { recursive: true });
    const names = entries(proposals.path);
    const unexpected = names.filter((name) => !FILE_PATTERN.test(name) && name !== 'BR/leiame.pdf');
    if (unexpected.length) throw new Error(`Arquivos não previstos no ZIP: ${unexpected.join(', ')}.`);
    const documentOf = new Map<string, string>();
    const documents = new Map<string, { file: string; sizeBytes: number; pages: Page[] }>();
    for (const name of names.filter((item) => FILE_PATTERN.test(item))) {
      const sq = FILE_PATTERN.exec(name)![1]!;
      const { stdout: bytes } = await exec('unzip', ['-p', proposals.path, name], { encoding: 'buffer', maxBuffer: 256 * 2 ** 20 });
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      documentOf.set(sq, sha256);
      if (documents.has(sha256)) continue;
      const path = resolve(staging, `${sha256}.pdf`), work = resolve(staging, sha256);
      await writeFile(path, bytes, { mode: 0o444 }); await mkdir(work);
      const pages = await documentPages(path, work);
      documents.set(sha256, { file: name, sizeBytes: bytes.length, pages });
      console.log(`${name}: ${pages.length} páginas (${pages.filter((page) => page.method === 'ocr').length} por OCR, ${Math.round((performance.now() - started) / 1000)} s).`);
    }
    const orphan = [...documentOf.keys()].filter((sq) => !candidacies.some((item) => item.sq === sq));
    if (orphan.length) throw new Error(`Documentos sem candidatura no cadastro: ${orphan.join(', ')}.`);
    // Texto do PDF possivelmente ilegível (fonte sem mapa Unicode, por exemplo) bloqueia, como as demais divergências.
    const unreadable = [...documents.values()].flatMap((document) => document.pages.filter((page) => page.quality && exceedsQuality(page.quality, QUALITY)).map((page) => `${document.file} p. ${page.page}`));
    if (unreadable.length) throw new Error(`Texto do PDF acima dos limiares de texto ilegível: ${unreadable.join(', ')}; importação bloqueada.`);
    const highest = (values: Array<number | null>) => { const known = values.filter((value): value is number => value !== null); return known.length ? Math.max(...known) : null; };
    const quality = { limits: QUALITY, documents: [...documents].map(([sha256, document]) => {
      const measured = document.pages.flatMap((page) => page.quality ? [page.quality] : []);
      return { sha256, file: document.file, measuredPages: measured.length, maxBadRatio: highest(measured.map((item) => item.badRatio)), maxVowellessRatio: highest(measured.map((item) => item.vowellessRatio)) };
    }) };

    // Documento idêntico em mais de uma candidatura: fica com a que tem votos; as demais apontam para ele.
    const listing = (item: Candidacy) => {
      const sha = documentOf.get(item.sq);
      const sharing = sha ? candidacies.filter((other) => documentOf.get(other.sq) === sha) : [item];
      if (sharing.length > 1) {
        const holders = sharing.filter(withVotes);
        if (holders.length !== 1) throw new Error(`Documento ${sha} repetido sem uma única candidatura com votos.`);
        if (holders[0] !== item) return 'same-document' as const;
      }
      return withVotes(item) ? 'candidate' as const : 'no-votes' as const;
    };
    const stored = candidacies.map((item) => ({ ...item, listing: listing(item), document: documentOf.get(item.sq) ?? null }));
    const allPages = [...documents.values()].flatMap((document) => document.pages);
    const totals = { candidacies: stored.length, documents: documents.size, pages: allPages.length, nativePages: allPages.filter((page) => page.method === 'native').length,
      ocrPages: allPages.filter((page) => page.method === 'ocr').length, emptyPages: allPages.filter((page) => page.method === 'empty').length };
    // O ZIP das propostas não traz data de geração; a do cadastro vem de DT_GERACAO/HH_GERACAO.
    const sources = [{ ...proposals, generatedAt: [], rowsRead: documentOf.size, rowsSelected: documentOf.size }, { ...registry, generatedAt: [...generated].sort(), rowsRead: registryRows, rowsSelected: candidacies.length }]
      .map(({ path: _path, ...source }) => source);
    const without = stored.filter((item) => !item.document && item.listing === 'candidate');
    const shared = stored.filter((item) => item.listing === 'same-document');
    const dataset = proposalsDatasetSchema.parse({ id, kind: 'proposals', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, inputs, sources, method, totals,
      scope: 'Propostas de governo registradas no TSE pelas candidaturas à Presidência em 2022, com o texto de cada página para busca literal.',
      notes: [`${totals.pages} páginas: ${totals.nativePages} com o texto do próprio PDF, ${totals.ocrPages} por OCR (${method.tesseract}, ${OCR_LANGUAGE}, ${OCR_DPI} dpi) e ${totals.emptyPages} sem texto em nenhum dos dois.`,
        `Texto do PDF em ordem de leitura (pdftotext -bbox-layout, conferido página a página com o modo padrão), usado quando a página tem ao menos ${TEXT_PAGE_MIN_CHARS} caracteres visíveis; abaixo disso, OCR da página inteira. OCR pode errar letras e palavras: ausência de ocorrência não indica que o tema não esteja no documento.`,
        `Busca (${PROPOSALS_NORMALIZATION}): maiúsculas, acentos e ligaduras ignorados; palavra partida por hífen no fim da linha encontrada inteira ou com o hífen.`,
        `Nenhuma página com texto do PDF acima dos limiares de texto ilegível (${(QUALITY.maxBadRatio * 100).toLocaleString('pt-BR')} % de caracteres sem correspondência, de uso privado ou de controle; ${(QUALITY.maxVowellessRatio * 100).toLocaleString('pt-BR')} % de palavras sem vogal).`,
        ...shared.map((item) => `Documento da candidatura ${item.number} (${item.ballotName}, ${item.situation.toLowerCase()}) idêntico ao de outra candidatura do mesmo número; exibido só na candidatura com votos.`),
        ...stored.filter((item) => item.listing === 'no-votes').map((item) => `Candidatura ${item.number} (${item.ballotName}, ${item.situation.toLowerCase()}) sem votos nos resultados: listada à parte.`),
        ...(without.length ? [`Candidaturas com votos sem documento no arquivo do TSE: ${without.map((item) => item.number).join(', ')}.`] : []),
        'Fonte: Tribunal Superior Eleitoral, Portal de Dados Abertos (licença Creative Commons Atribuição). O ZIP original é servido sem alteração.'] });

    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, SCOPE, { kind: 'proposals', pending: true }]);
      for (const table of ['proposal_pages', 'proposal_candidacies', 'proposal_documents']) await client.query(`DELETE FROM ${table} WHERE batch_id=$1`, [id]);
      for (const [sha256, document] of documents) {
        const count = (method: Page['method']) => document.pages.filter((page) => page.method === method).length;
        await client.query('INSERT INTO proposal_documents VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [id, sha256, document.file, document.sizeBytes, document.pages.length, count('native'), count('ocr'), count('empty')]);
        await client.query('INSERT INTO proposal_pages SELECT $1, $2, x.page, x.method, x.text, x.search FROM jsonb_to_recordset($3::jsonb) AS x(page integer, method text, text text, search text)',
          [id, sha256, JSON.stringify(document.pages.map((page) => ({ page: page.page, method: page.method, text: page.text, search: searchText(page.text) })))]);
      }
      await client.query('INSERT INTO proposal_candidacies SELECT $1, x.sq, x.number, x."ballotName", x.party, x.situation, x.listing, x.document FROM jsonb_to_recordset($2::jsonb) AS x(sq text, number text, "ballotName" text, party text, situation text, listing text, document text)',
        [id, JSON.stringify(stored)]);
      const check = (await client.query<{ pages: number; candidacies: number }>('SELECT (SELECT count(*)::int FROM proposal_pages WHERE batch_id=$1) AS pages, (SELECT count(*)::int FROM proposal_candidacies WHERE batch_id=$1) AS candidacies', [id])).rows[0]!;
      if (check.pages !== totals.pages || check.candidacies !== totals.candidacies) throw new Error('Propostas gravadas não conferem.');
      for (const source of sources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes ?? 0]);
      await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
      await preparePublication(client, { id, scope: SCOPE, inputs, report: { dataset, candidacies: stored, quality, elapsedSeconds: Math.round((performance.now() - started) / 1000) } });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    console.log(JSON.stringify({ published: id, scope: SCOPE, totals, elapsedSeconds: Math.round((performance.now() - started) / 1000) }, null, 2));
  } finally { client.release(); await pool.end(); }
}
if (require.main === module) run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Importação das propostas falhou.'); process.exitCode = 1; });
