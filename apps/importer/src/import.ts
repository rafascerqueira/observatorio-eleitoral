import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { datasetSchema, municipalitySchema, pollingPlaceSchema } from '@observatorio/contracts';
import { rows, pilot, type Row } from './csv';
import { reconcile, sectionVote, IMPORTER_VERSION, type SectionVote } from './model';
import { ROOT, SOURCES, sourceFile } from './sources';

config({ path: resolve(ROOT, '.env'), quiet: true });
const SCOPE = '2022/president/SP/71072';
async function run() {
  const files = await Promise.all(SOURCES.map(sourceFile));
  const id = createHash('sha256').update(JSON.stringify({ version: IMPORTER_VERSION, scope: SCOPE, hashes: files.map((file) => file.sha256) })).digest('hex');
  // Mesmos originais e mesma versão já reconciliados: não reler milhões de
  // linhas nem inserir novamente. Os SHA-256 são recalculados em cada execução.
  if (process.env.DATABASE_URL && !process.argv.includes('--validate-only')) {
    const probe = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
    try {
      const registry = await probe.query("SELECT to_regclass('public.import_batches') AS registry");
      if (registry.rows[0]?.registry) {
        const existing = await probe.query('SELECT id FROM import_batches WHERE id=$1 AND published', [id]);
        if (existing.rowCount) { console.log(`Importação já publicada: ${id}. Checksums conferidos; nenhum registro duplicado.`); return; }
      }
    } finally { await probe.end(); }
  }
  const sources = [];
  const details: Row[] = [], nominal: Row[] = [], sections: SectionVote[] = [];
  const coverage = [];
  for (const [index, source] of SOURCES.entries()) {
    const file = files[index]!;
    let rowsRead = 0, rowsSelected = 0;
    const generatedAt = new Set<string>();
    const nullFields: Record<string, number> = {};
    const columns = new Set<string>();
    console.log(`Lendo ${source.entry} em fluxo…`);
    for await (const row of rows(file.path, file.entry, (row) => { rowsRead++; return pilot(row); })) {
      rowsSelected++;
      for (const [key, value] of Object.entries(row)) {
        columns.add(key);
        if (['#NULO', '#NE', '-1', '-3', ''].includes(value)) nullFields[key] = (nullFields[key] ?? 0) + 1;
      }
      generatedAt.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
      if (index === 0) details.push(row);
      else if (index === 1) nominal.push(row);
      else sections.push(sectionVote(row));
      if (rowsSelected % 50_000 === 0) console.log(`${rowsSelected} registros de São Paulo selecionados.`);
    }
    const { path: _path, ...metadata } = file;
    sources.push({ ...metadata, generatedAt: [...generatedAt], rowsRead, rowsSelected });
    coverage.push({ file: file.file, rowsRead, rowsSelected, rowsOutsidePilot: rowsRead - rowsSelected, nullFields, columns: [...columns] });
  }
  await mkdir(resolve(ROOT, 'data/staging'), { recursive: true });
  await writeFile(resolve(ROOT, 'data/staging/sao-paulo-2022.json'), JSON.stringify({ sources, coverage, details, nominal, sections }));
  console.log('Reconciliando seções, zonas, candidaturas e participação…');
  const results = reconcile(details, nominal, sections);
  results.summaries.forEach((summary) => municipalitySchema.parse(summary));
  results.places.forEach((place) => pollingPlaceSchema.parse(place));
  const dataset = datasetSchema.parse({ id, year: 2022, office: 'president', municipalityCode: '71072', municipalityName: 'São Paulo', uf: 'SP', importedAt: new Date().toISOString(), importerVersion: IMPORTER_VERSION, sources, scope: 'Município de São Paulo; Presidência; 2022; turnos separados. Votos registrados no município, sem associação à residência dos eleitores.', validation: 'reconciled' });
  await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
  const report = {
    dataset, coverage, voteConflicts: 0, discardedSelectedRows: 0,
    metadataConflicts: results.places.filter((place) => place.metadataConflict).map((place) => ({ round: place.round, zone: place.zone, code: place.code, variants: place.metadataVariants })),
    checks: ['Candidaturas reconciliadas por zona contra votação nominal válida', 'Válidos/brancos/nulos reconciliados por zona', 'Comparecimento = válidos + brancos + nulos', 'Aptos = comparecimento + abstenção', 'Seções principais reconciliadas por zona', 'Chaves únicas e correspondência seção/local verificadas'],
    limitations: ['ST_PENDENTE_TOT_FINAL ausente no CSV de apuração consultado; publicação baseada na reconciliação dos totais históricos, não em certificação desse campo.', 'Não há aptos, comparecimento ou abstenção por local neste recorte; ficam null.', 'Nomes ou endereços divergentes por local ficam indisponíveis, com variantes preservadas e conflito explícito.', 'Nenhuma associação IBGE, renda ou geografia residencial foi realizada.'],
    summaries: results.summaries,
  };
  await writeFile(resolve(ROOT, 'data/audit/sao-paulo-2022.json'), JSON.stringify(report, null, 2));
  if (process.argv.includes('--validate-only')) { console.log(JSON.stringify(results.summaries, null, 2)); return; }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória; validação não foi publicada.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('observatorio:sao-paulo-2022'))");
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/003-national.sql'), 'utf8'));
    for (const source of files) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes]);
    const existing = await client.query('SELECT metadata FROM import_batches WHERE id=$1 AND published', [id]);
    if (existing.rowCount) {
      await client.query('COMMIT');
      console.log(`Importação já publicada: ${id}. Nenhum registro duplicado.`);
      return;
    }
    await client.query('INSERT INTO import_batches(id, scope, metadata) VALUES ($1,$2,$3)', [id, SCOPE, dataset]);
    for (const result of results.summaries) await client.query('INSERT INTO municipality_results(batch_id, year, round, office, code, uf, search_name, result) VALUES ($1,2022,$2,\'president\',\'71072\',\'SP\',\'sao paulo\',$3)', [id, Number(result.round), result]);
    for (let start = 0; start < sections.length; start += 2000) {
      const batch = sections.slice(start, start + 2000);
      await client.query(`INSERT INTO section_votes SELECT $1, 2022, x."electionCode", x.round::integer, 'president', '71072', x.zone, x.section, x.local, x.number, x.votes FROM jsonb_to_recordset($2::jsonb) AS x("electionCode" text, round text, zone integer, section integer, local text, number text, votes integer)`, [id, JSON.stringify(batch)]);
    }
    await client.query('INSERT INTO zone_results SELECT $1, x.round::integer, x.zone, to_jsonb(x) FROM jsonb_to_recordset($2::jsonb) AS x(round text, zone integer, totals jsonb, candidates jsonb)', [id, JSON.stringify(results.zones)]);
    await client.query('INSERT INTO polling_place_results SELECT $1, x.round::integer, x.zone, x.code, to_jsonb(x) FROM jsonb_to_recordset($2::jsonb) AS x(round text, zone integer, code text, name text, address text, sections integer, totals jsonb, candidates jsonb, "metadataConflict" boolean, "metadataVariants" jsonb)', [id, JSON.stringify(results.places)]);
    await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
    await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ published: id, sectionRows: sections.length, summaries: results.summaries }, null, 2));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
run().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha na importação.';
  await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
  await writeFile(resolve(ROOT, 'data/audit/sao-paulo-2022-failure.json'), JSON.stringify({ status: 'blocked', message, at: new Date().toISOString(), importerVersion: IMPORTER_VERSION }, null, 2));
  console.error(message); process.exitCode = 1;
});
