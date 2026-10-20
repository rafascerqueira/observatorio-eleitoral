import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { entries, rows } from './csv';
import { ROOT, sourceFile } from './sources';

/**
 * Fase D1: inventário das propostas de governo da Presidência de 2022, sem publicação e sem escrita no banco.
 * Os PDFs são dados não confiáveis: extraídos num diretório próprio, lidos só por `pdfinfo`/`pdftotext` em processo separado,
 * sem shell e com tempo limite; o texto é apenas contado, nunca exibido nem interpretado. Do cadastro de candidaturas, só as
 * colunas da candidatura (nada de CPF, e-mail, nascimento ou bens). Documento → candidatura pelo `SQ_CANDIDATO` do nome do
 * arquivo; candidatura → resultado publicado pelo número e turno, nunca pelo nome.
 */
const run = promisify(execFile);
/** Página com texto nativo: ao menos 50 caracteres visíveis extraídos (limiar declarado; abaixo disso, provável imagem). */
const TEXT_PAGE_MIN_CHARS = 50;
const FILE_PATTERN = /^BR\/2022BR(\d{12})\.pdf$/;

async function main() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const proposals = await sourceFile({ file: 'proposta_governo_2022_BR.zip', entry: 'BR/2022BR<SQ_CANDIDATO>.pdf', directory: 'proposta_governo' });
  const registry = await sourceFile({ file: 'consulta_cand_2022.zip', entry: 'consulta_cand_2022_BR.csv', directory: 'consulta_cand' });

  // Candidaturas à Presidência no cadastro (só as colunas da candidatura).
  type Candidacy = { round: number; election: string; sq: string; number: string; ballotName: string; party: string; situation: string; result: string };
  const candidacies: Candidacy[] = [];
  for await (const row of rows(registry.path, 'consulta_cand_2022_BR.csv')) {
    if (row.DS_CARGO !== 'PRESIDENTE') continue;
    candidacies.push({ round: Number(row.NR_TURNO), election: row.CD_ELEICAO!, sq: row.SQ_CANDIDATO!, number: row.NR_CANDIDATO!, ballotName: row.NM_URNA_CANDIDATO!, party: row.SG_PARTIDO!,
      situation: row.DS_SITUACAO_CANDIDATURA!, result: row.DS_SIT_TOT_TURNO! });
  }
  const firstRound = candidacies.filter((item) => item.round === 1);
  if (new Set(firstRound.map((item) => item.sq)).size !== firstRound.length) throw new Error('Candidatura repetida no 1º turno do cadastro.');

  // Números com votos nos resultados publicados (Brasil e exterior), por turno.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, options: '-c default_transaction_read_only=on' });
  const published = await pool.query<{ round: string; number: string }>(`SELECT DISTINCT m.result->>'round' AS round, c->>'number' AS number FROM municipality_results m
    JOIN import_batches b ON b.id=m.batch_id AND b.published AND b.scope IN ('2022/president/BR', '2022/president/ZZ'), jsonb_array_elements(m.result->'candidates') c`);
  await pool.end();
  const inResults = new Set(published.rows.map((row) => `${row.round}/${row.number}`));

  // Extração isolada: um diretório por versão do ZIP, recriado a cada execução.
  const staging = resolve(ROOT, 'data/staging/proposta_governo_2022', proposals.sha256);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const names = entries(proposals.path);
  const unexpected = names.filter((name) => !FILE_PATTERN.test(name) && name !== 'BR/leiame.pdf');
  type Document = { file: string; sq: string; sizeBytes: number; sha256: string; pages: number | null; encrypted: boolean | null; textPages: number | null; emptyPages: number | null; replacementChars: number | null; error: string | null; duplicateOf: string | null };
  const documents: Document[] = [];
  for (const name of names.filter((item) => FILE_PATTERN.test(item))) {
    const sq = FILE_PATTERN.exec(name)![1]!;
    const path = resolve(staging, `${sq}.pdf`);
    const { stdout: bytes } = await run('unzip', ['-p', proposals.path, name], { encoding: 'buffer', maxBuffer: 256 * 2 ** 20 });
    await writeFile(path, bytes, { mode: 0o444 });
    const document: Document = { file: name, sq, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), pages: null, encrypted: null, textPages: null, emptyPages: null, replacementChars: null, error: null, duplicateOf: null };
    try {
      const info = (await run('pdfinfo', [path], { timeout: 60_000, maxBuffer: 2 ** 20 })).stdout;
      document.pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? NaN);
      document.encrypted = /^Encrypted:\s+yes/m.test(info);
      const text = (await run('pdftotext', ['-enc', 'UTF-8', '-layout', path, '-'], { timeout: 300_000, maxBuffer: 512 * 2 ** 20 })).stdout;
      // O pdftotext separa as páginas por form feed; a última parte (após o último \f) é vazia.
      const pages = text.split('\f').slice(0, document.pages);
      const visible = pages.map((page) => page.replace(/\s/g, '').length);
      document.textPages = visible.filter((count) => count >= TEXT_PAGE_MIN_CHARS).length;
      document.emptyPages = visible.filter((count) => count === 0).length;
      document.replacementChars = (text.match(/�/g) ?? []).length;
    } catch (error) { document.error = error instanceof Error ? error.message.split('\n')[0]! : 'falha na leitura do PDF'; }
    documents.push(document);
  }
  for (const document of documents) document.duplicateOf = documents.find((other) => other !== document && other.sha256 === document.sha256 && other.sq < document.sq)?.sq ?? null;

  // Candidatura × documento × resultado publicado.
  const bySq = new Map(documents.map((document) => [document.sq, document]));
  const table = firstRound.sort((a, b) => Number(a.number) - Number(b.number) || a.sq.localeCompare(b.sq)).map((item) => ({ ...item, inFirstRoundResults: inResults.has(`1/${item.number}`),
    inSecondRoundResults: inResults.has(`2/${item.number}`), document: bySq.get(item.sq) ?? null }));
  const orphanDocuments = documents.filter((document) => !firstRound.some((item) => item.sq === document.sq)).map((document) => document.file);
  const numbersShared = [...new Set(firstRound.map((item) => item.number))].filter((number) => firstRound.filter((item) => item.number === number).length > 1);
  const resultNumbersWithoutCandidacy = [...inResults].filter((key) => !candidacies.some((item) => `${item.round}/${item.number}` === key));
  const summary = { candidacies: firstRound.length, apt: firstRound.filter((item) => item.situation === 'APTO').length, documents: documents.length, withDocument: table.filter((item) => item.document).length,
    aptWithoutDocument: table.filter((item) => item.situation === 'APTO' && !item.document).map((item) => `${item.number} (${item.sq})`),
    withoutDocument: table.filter((item) => !item.document).map((item) => `${item.number} (${item.sq}, ${item.situation})`),
    duplicates: documents.filter((document) => document.duplicateOf).map((document) => `${document.sq} = ${document.duplicateOf}`),
    pages: documents.reduce((total, document) => total + (document.pages ?? 0), 0), textPages: documents.reduce((total, document) => total + (document.textPages ?? 0), 0),
    unreadable: documents.filter((document) => document.error).map((document) => document.file), encrypted: documents.filter((document) => document.encrypted).map((document) => document.file),
    orphanDocuments, unexpectedEntries: unexpected, numbersShared, resultNumbersWithoutCandidacy };

  const stamp = new Date().toISOString().replaceAll(':', '-');
  const directory = resolve(ROOT, 'data/analysis', `propostas-inventario-${stamp}`);
  await mkdir(directory, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), scope: 'Propostas de governo da Presidência, Eleições 2022 (TSE); inventário sem publicação.',
    sources: [proposals, registry].map(({ file, url, sha256, sizeBytes, lastModified, downloadedAt }) => ({ file, url, sha256, sizeBytes, lastModified, downloadedAt })),
    method: { textPageMinChars: TEXT_PAGE_MIN_CHARS, extractor: (await run('pdftotext', ['-v'], { timeout: 10_000 }).catch((error: { stderr?: string }) => ({ stderr: error.stderr ?? '' }))).stderr?.split('\n')[0] ?? null,
      link: 'Documento → candidatura pelo SQ_CANDIDATO do nome do arquivo; candidatura → resultados publicados pelo número no turno.', staging },
    summary, candidacies: table, sideEffects: 'Download e preservação dos dois ZIPs do TSE; PDFs extraídos em data/staging; nenhuma escrita no banco nem publicação.' };
  await writeFile(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ report: resolve(directory, 'report.json'), summary }, null, 2));
  if (unexpected.length) process.exitCode = 1;
}
if (require.main === module) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Inventário das propostas falhou.'); process.exitCode = 1; });
