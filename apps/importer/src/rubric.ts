import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { parse } from 'csv-parse/sync';
import { PROPOSALS_NORMALIZATION, searchNormalize, searchPattern, searchText } from '@observatorio/contracts';
import { ROOT, sourceFile } from './sources';
import { adjudicationTemplate, agreement, authorship, consolidate, criterionReliability, MIN_CRITERION_AC1, RELIABILITY_RESAMPLES, CODING_COLUMNS, codingTemplate, csv, documentId, readCoding, RUBRIC_CRITERIA, RUBRIC_EXCLUDED_TERMS, RUBRIC_TERMS, RUBRIC_THEME, RUBRIC_VERSION,
  validateCoding, type CodingRow, type Criterion, type RubricDocument } from './rubric-core';

/**
 * Fase D3, preparação da rubrica (livro de códigos em docs/rubrica-propostas.md), sem publicação e com o banco só em leitura.
 * `pacote`: material idêntico para as duas codificações independentes (PDFs conferidos pelo SHA-256, texto publicado de cada página, de
 * onde copiar os trechos, trechos candidatos da busca literal, modelo da planilha e manifesto com a versão da rubrica e a
 * publicação do texto). `concordancia`: valida as duas planilhas contra
 * o texto publicado, mede a concordância e gera a planilha de adjudicação; com a adjudicação preenchida, consolida a codificação
 * final. Os PDFs são dados não confiáveis: só copiados, nunca abertos nem executados.
 */
const exec = promisify(execFile);
const SCOPE = '2022/proposals/president', EXCERPT_CONTEXT = 140;
const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
type Manifest = { rubric: string; publication: { batchId: string }; documents: Array<RubricDocument & { file: string; pdf: string; text: string; candidatePages: number[] }> };
type Final = ReturnType<typeof consolidate>['final'];
/**
 * Livro de códigos aplicado pelo pacote e pela concordância: a rubrica de acessibilidade e mobilidade (D3) e a bússola política
 * usam o mesmo fluxo. `terms` pode marcar a que critérios cada termo pertence (coluna `criterios` dos trechos candidatos).
 */
export type CodebookDefinition = {
  version: string; theme: string; codebook: string; dataDirectory: string; command: string;
  terms: ReadonlyArray<{ term: string; criteria?: readonly string[] }>; excludedTerms: ReadonlyArray<{ term: string; reason: string }>; criteria: readonly Criterion[];
  validate: (rows: readonly CodingRow[], documents: readonly RubricDocument[], pageText: (sha256: string, page: number) => string | null) => string[];
  readingHint: string; manifestExtra?: Record<string, unknown>;
  /** Medidas a mais na concordância e arquivos a mais com a codificação final (a bússola grava as posições calculadas). */
  report?: (a: readonly CodingRow[], b: readonly CodingRow[]) => Record<string, unknown>;
  afterFinal?: (final: Final, documents: Manifest['documents'], output: string) => Promise<void>;
};
const ACCESSIBILITY: CodebookDefinition = { version: RUBRIC_VERSION, theme: RUBRIC_THEME, codebook: 'docs/rubrica-propostas.md', dataDirectory: 'data/rubric', command: 'rubric:agreement',
  terms: RUBRIC_TERMS.map((term) => ({ term })), excludedTerms: RUBRIC_EXCLUDED_TERMS, criteria: RUBRIC_CRITERIA, validate: validateCoding,
  readingHint: 'Leia cada documento inteiro (documentos/ e textos/), não só as seções sobre cidades, transporte, infraestrutura e pessoas com deficiência; trechos-candidatos.csv é ponto de partida, não substitui a leitura.',
  // Confiabilidade fixada antes da codificação (livro de códigos, seção 7): AC1 de Gwet por critério, com intervalo e mínimo.
  report: (a, b) => ({ reliability: { statistic: 'gwet-ac1', minimum: MIN_CRITERION_AC1, resamples: RELIABILITY_RESAMPLES, byCriterion: criterionReliability(a, b, RUBRIC_CRITERIA) } }) };

function pool() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, options: '-c default_transaction_read_only=on' });
}

export async function packet(definition: CodebookDefinition) {
  const database = pool();
  try {
    const batch = (await database.query<{ id: string; metadata: { importerVersion: string; method: { normalization?: string; pdftotext: string; tesseract: string } } }>(
      'SELECT id, metadata FROM import_batches WHERE published AND scope=$1', [SCOPE])).rows[0];
    if (!batch) throw new Error('Propostas sem publicação.');
    if (batch.metadata.method.normalization !== PROPOSALS_NORMALIZATION) throw new Error('Publicação das propostas com normalização anterior; reimportar antes de gerar o pacote.');
    const rows = (await database.query<{ sha256: string; file: string; pages: number; holder: string; others: string | null }>(
      `SELECT d.sha256, d.file, d.pages,
        string_agg(c.number || ' · ' || c.ballot_name || CASE WHEN c.listing = 'no-votes' THEN ' (sem votos)' ELSE '' END, '; ') FILTER (WHERE c.listing <> 'same-document') AS holder,
        string_agg(c.number || ' · ' || c.ballot_name, '; ') FILTER (WHERE c.listing = 'same-document') AS others
      FROM proposal_documents d JOIN proposal_candidacies c ON c.batch_id = d.batch_id AND c.document_sha256 = d.sha256 WHERE d.batch_id = $1
      GROUP BY d.sha256, d.file, d.pages ORDER BY min(c.number::integer), d.sha256`, [batch.id])).rows;
    const documents = rows.map((row) => ({ id: documentId(row.sha256), sha256: row.sha256, file: row.file, pages: row.pages,
      candidacies: `${row.holder}${row.others ? ` (mesmo documento: ${row.others})` : ''}` }));
    if (new Set(documents.map((document) => document.id)).size !== documents.length) throw new Error('Identificadores de documento repetidos.');

    // Trechos candidatos: uma linha por documento, página e termo, com o trecho da primeira ocorrência na página.
    const clean = (text: string) => text.replace(/\s+/g, ' ');
    const candidates: Array<{ document: typeof documents[number]; page: number; method: string; term: string; criteria: string; excerpt: string; order: number }> = [];
    for (const [order, { term, criteria = [] }] of definition.terms.entries()) {
      const pattern = searchPattern(searchText(term)), expression = new RegExp(pattern, 'u');
      for (const page of (await database.query<{ sha256: string; page: number; method: string; text: string }>(
        'SELECT sha256, page, method, text FROM proposal_pages WHERE batch_id=$1 AND search_text ~ $2', [batch.id, pattern])).rows) {
        const { normalized, map } = searchNormalize(page.text), match = expression.exec(normalized);
        const document = documents.find((item) => item.sha256 === page.sha256);
        if (!match || !document) throw new Error('Texto das propostas inconsistente.');
        const start = map[match.index]!, end = map[match.index + match[0].length - 1]! + 1;
        candidates.push({ document, page: page.page, method: page.method === 'ocr' ? 'OCR' : 'texto do PDF', term, criteria: criteria.join(', '), order,
          excerpt: `…${clean(page.text.slice(Math.max(0, start - EXCERPT_CONTEXT), start)).trimStart()}«${clean(page.text.slice(start, end))}»${clean(page.text.slice(end, end + EXCERPT_CONTEXT)).trimEnd()}…` });
      }
    }
    candidates.sort((a, b) => documents.indexOf(a.document) - documents.indexOf(b.document) || a.page - b.page || a.order - b.order);

    const stamp = new Date().toISOString().replaceAll(':', '-');
    const directory = resolve(ROOT, definition.dataDirectory, definition.version, `pacote-${stamp}`);
    await mkdir(resolve(directory, 'documentos'), { recursive: true }); await mkdir(resolve(directory, 'textos'), { recursive: true });
    // PDFs do ZIP preservado, conferidos pelo SHA-256 publicado.
    const proposals = await sourceFile({ file: 'proposta_governo_2022_BR.zip', entry: 'BR/2022BR<SQ_CANDIDATO>.pdf', directory: 'proposta_governo' });
    // Texto publicado de cada página: é dele que os trechos são copiados (nas páginas por OCR, a imagem não tem texto).
    const pageTexts = (await database.query<{ sha256: string; page: number; method: string; text: string }>('SELECT sha256, page, method, text FROM proposal_pages WHERE batch_id=$1 ORDER BY sha256, page', [batch.id])).rows;
    const manifestDocuments = [];
    for (const document of documents) {
      const { stdout: bytes } = await exec('unzip', ['-p', proposals.path, document.file], { encoding: 'buffer', maxBuffer: 256 * 2 ** 20 });
      if (sha256(bytes) !== document.sha256) throw new Error(`${document.file}: SHA-256 diferente do publicado.`);
      const name = `${document.candidacies.split(' · ')[0]}-${document.sha256.slice(0, 12)}`, pdf = `documentos/${name}.pdf`, text = `textos/${name}.txt`;
      await writeFile(resolve(directory, pdf), bytes, { mode: 0o444 });
      await writeFile(resolve(directory, text), pageTexts.filter((page) => page.sha256 === document.sha256)
        .map((page) => `=== Página ${page.page} (${page.method === 'ocr' ? 'OCR' : page.method === 'empty' ? 'sem texto' : 'texto do PDF'}) ===\n${page.text.trim()}\n`).join('\n'));
      manifestDocuments.push({ ...document, pdf, text, candidatePages: [...new Set(candidates.filter((item) => item.document === document).map((item) => item.page))].sort((a, b) => a - b) });
    }
    const labelled = definition.terms.some((item) => item.criteria?.length);
    await writeFile(resolve(directory, 'trechos-candidatos.csv'), csv([['documento', 'candidaturas', 'pagina', 'metodo', 'termo', ...(labelled ? ['criterios'] : []), 'trecho'],
      ...candidates.map((item) => [item.document.id, item.document.candidacies, item.page, item.method, item.term, ...(labelled ? [item.criteria] : []), item.excerpt])]));
    await writeFile(resolve(directory, 'codificacao-modelo.csv'), codingTemplate(documents, definition.criteria));
    const manifest = { rubric: definition.version, theme: definition.theme, codebook: definition.codebook, generatedAt: new Date().toISOString(),
      publication: { scope: SCOPE, batchId: batch.id, importerVersion: batch.metadata.importerVersion, normalization: batch.metadata.method.normalization, pdftotext: batch.metadata.method.pdftotext, tesseract: batch.metadata.method.tesseract },
      source: { file: proposals.file, sha256: proposals.sha256 }, terms: labelled ? definition.terms : definition.terms.map((item) => item.term), excludedTerms: definition.excludedTerms,
      criteria: definition.criteria.map((criterion) => ({ code: criterion.code, question: criterion.question, values: criterion.values })), ...definition.manifestExtra,
      documents: manifestDocuments, totals: { documents: documents.length, candidateRows: candidates.length, candidatePages: manifestDocuments.reduce((sum, item) => sum + item.candidatePages.length, 0), codingRows: documents.length * definition.criteria.length } };
    await writeFile(resolve(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(resolve(directory, 'LEIA-ME.txt'), [
      `Pacote de codificação — ${definition.theme} (${definition.version})`, '',
      `O mesmo pacote vai para as duas codificações independentes: primeiro a de uma pessoa, em público; depois a de um modelo de linguagem, numa execução isolada que recebe só este pacote e o livro de códigos. A autoria de cada uma é declarada na concordância e na publicação. Regras completas no livro de códigos: ${definition.codebook}.`, '',
      '1. Copie codificacao-modelo.csv para codificacao-<a ou b>.csv, fora deste diretório, e preencha valor, paginas, trecho e observacao em todas as linhas.',
      '2. Não converse sobre a codificação nem veja a outra planilha, ou notas sobre ela, até as duas terminarem. Este diretório só tem o material comum: nenhuma planilha preenchida fica aqui.',
      `3. ${definition.readingHint}`,
      `4. Valores que afirmam algo exigem página e trecho copiado do texto publicado (textos/), sem resumir nem corrigir; nas páginas por OCR, registre na observação o que o OCR leu errado. ${definition.criteria[0]!.values.some((value) => value.code === 'nao-localizado') ? '"nao-localizado" quer dizer não encontrado no texto revisado, não que o documento não proponha.' : '"sem-posicao" quer dizer posição não encontrada no texto revisado, não que a candidatura não tenha posição.'}`,
      '5. Salve como CSV UTF-8 com separador ";" (Excel: "CSV UTF-8"; LibreOffice: conjunto de caracteres UTF-8, separador ponto e vírgula).',
      '', `Texto: publicação ${batch.id.slice(0, 12)}… (${batch.metadata.importerVersion}, ${batch.metadata.method.normalization}). Documentos: ${documents.length}; linhas da planilha: ${manifest.totals.codingRows}.`, ''].join('\n'));
    console.log(JSON.stringify({ packet: directory, ...manifest.totals }, null, 2));
  } finally { await database.end(); }
}

export async function agreementReport(definition: CodebookDefinition) {
  const directory = option('pacote'), fileA = option('a'), fileB = option('b'), fileDecisions = option('adjudicacao');
  if (!directory || !fileA || !fileB) throw new Error(`Uso: npm run ${definition.command} -- --pacote=<diretório> --a=<planilha> --autoria-a=<pessoa|modelo:id> [--isolamento-a=<api|sessao>] --b=<planilha> --autoria-b=<pessoa|modelo:id> [--isolamento-b=<api|sessao>] [--adjudicacao=<planilha> | --consistencia]`);
  // Consistência do modelo: duas codificações do mesmo modelo, só para medir. O resultado fica ao lado da planilha A, fora do
  // pacote (que vai para quem ainda codifica), e não gera planilha de adjudicação.
  const consistency = process.argv.includes('--consistencia');
  if (consistency && fileDecisions) throw new Error('--consistencia só mede a concordância do modelo consigo mesmo; não aceita --adjudicacao.');
  const authors = authorship(option('autoria-a'), option('autoria-b'), { consistency, isolation: [option('isolamento-a'), option('isolamento-b')] });
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')) as Manifest;
  if (manifest.rubric !== definition.version) throw new Error(`Pacote da ${manifest.rubric}; este código aplica a ${definition.version}.`);
  const database = pool();
  const texts = new Map<string, string>();
  try {
    for (const row of (await database.query<{ sha256: string; page: number; search_text: string }>('SELECT sha256, page, search_text FROM proposal_pages WHERE batch_id=$1', [manifest.publication.batchId])).rows) texts.set(`${row.sha256}/${row.page}`, row.search_text);
  } finally { await database.end(); }
  if (!texts.size) throw new Error(`Texto da publicação ${manifest.publication.batchId} ausente do banco.`);
  const pageText = (document: string, page: number) => texts.get(`${document}/${page}`) ?? null;
  const files = [fileA, fileB, ...(fileDecisions ? [fileDecisions] : [])];
  const raw = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  const [a, b] = [readCoding(raw[0]!), readCoding(raw[1]!)];
  const problems = [...definition.validate(a, manifest.documents, pageText).map((item) => `A (${basename(fileA)}): ${item}`), ...definition.validate(b, manifest.documents, pageText).map((item) => `B (${basename(fileB)}): ${item}`)];
  if (problems.length) { console.error(problems.join('\n')); throw new Error(`${problems.length} problema(s) nas planilhas; concordância não calculada.`); }

  const result = agreement(a, b, definition.criteria);
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const output = consistency ? resolve(dirname(fileA), `consistencia-${stamp}`) : resolve(directory, `resultado-${stamp}`);
  await mkdir(output, { recursive: true });
  const inputs = files.map((file, index) => ({ role: ['a', 'b', 'adjudicacao'][index], file: basename(file), sha256: sha256(raw[index]!), ...(index < 2 ? { author: authors[index] } : {}) }));
  const report = { rubric: definition.version, purpose: consistency ? 'consistencia-do-modelo' : 'concordancia', publication: manifest.publication, generatedAt: new Date().toISOString(), inputs, byCriterion: result.byCriterion, overall: result.overall, ...definition.report?.(a, b), divergences: result.divergences.length };
  await writeFile(resolve(output, 'concordancia.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (!consistency) await writeFile(resolve(output, 'adjudicacao-modelo.csv'), adjudicationTemplate(result.divergences, manifest.documents));
  if (fileDecisions) {
    const decisions = parse(raw[2]!, { delimiter: ';', columns: true, bom: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;
    const { final, problems: pending } = consolidate(a, b, decisions);
    const invalid = definition.validate(final, manifest.documents, pageText);
    if (pending.length || invalid.length) { console.error([...pending, ...invalid.map((item) => `Final: ${item}`)].join('\n')); throw new Error('Adjudicação incompleta ou inválida; codificação final não gravada.'); }
    const documentOf = new Map(manifest.documents.map((document) => [document.id, document]));
    await writeFile(resolve(output, 'codificacao-final.csv'), csv([[...CODING_COLUMNS.filter((column) => !['pergunta', 'valores_permitidos'].includes(column)), 'origem', 'justificativa'],
      ...final.map((row) => [row.documento, documentOf.get(row.documento)!.candidacies, row.criterio, row.valor, row.paginas.join(', '), row.trecho, row.observacao, row.origem, row.justificativa])]));
    await definition.afterFinal?.(final, manifest.documents, output);
  }
  console.log(JSON.stringify({ output, divergences: result.divergences.length, overall: result.overall, final: Boolean(fileDecisions) }, null, 2));
}

const command = process.argv[2];
if (require.main === module) (command === 'pacote' ? packet(ACCESSIBILITY) : command === 'concordancia' ? agreementReport(ACCESSIBILITY) : Promise.reject(new Error('Comando: pacote ou concordancia.')))
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Rubrica: falha.'); process.exitCode = 1; });
