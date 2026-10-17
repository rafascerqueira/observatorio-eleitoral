import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { datasetSchema, exteriorCitySchema, pollingPlaceSchema } from '@observatorio/contracts';
import { rows, type Row } from './csv';
import { reconcileExterior, assertEqual, type SectionVote } from './model';
import { SOURCES, ROOT, sourceFile } from './sources';
import { readPartition } from './partition';
import { municipalityCode, normalizeTerritoryKey, territoryKey } from './territory';

const VERSION = 'president-2022-exterior-v1';
const SCOPE = '2022/president/ZZ';
type Manifest = { sources: Array<{ sha256: string; entry: string; generatedAt: string[]; rowsRead: number }>; territories: Record<string, { uf: string; code: string; name: string }>; partitions: Record<string, { sha256: string; rows: number }> };
async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const files = await Promise.all(SOURCES.map(sourceFile));
  const id = createHash('sha256').update(JSON.stringify({ version: VERSION, scope: SCOPE, hashes: files.map((file) => file.sha256) })).digest('hex');
  let cached: { directory: string; manifest: Manifest } | undefined;
  for (const version of ['president-2022-national-v2', 'president-2022-national-v1']) {
    const stageId = createHash('sha256').update(JSON.stringify({ version, scope: '2022/president/BR', hashes: files.map((file) => file.sha256) })).digest('hex');
    const directory = resolve(ROOT, 'data/staging/national', stageId);
    const bytes = await readFile(resolve(directory, 'manifest.json'), 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return null; });
    if (bytes) {
      const manifest = JSON.parse(bytes) as Manifest;
      if (manifest.sources.length !== files.length || files.some((file, index) => manifest.sources[index]?.sha256 !== file.sha256 || manifest.sources[index]?.entry !== file.entry)) throw new Error('Preparação não corresponde aos originais.');
      cached = { directory, manifest }; break;
    }
  }
  if (!cached) throw new Error('Prepare primeiro os originais nacionais; nenhuma fonte parcial será usada.');
  const sources = [];
  const groups = [new Map<string, Row[]>(), new Map<string, Row[]>()];
  for (const index of [0, 1]) {
    const file = files[index]!; let rowsRead = 0, rowsSelected = 0; const generated = new Set<string>();
    for await (const row of rows(file.path, file.entry, (row) => { rowsRead++; return row.ANO_ELEICAO === '2022' && row.CD_CARGO === '1' && row.SG_UF === 'ZZ'; })) {
      const normalized = { ...row, CD_MUNICIPIO: municipalityCode(row.CD_MUNICIPIO!) };
      const key = territoryKey('ZZ', normalized.CD_MUNICIPIO); const group = groups[index]!.get(key) ?? [];
      group.push(normalized); groups[index]!.set(key, group); rowsSelected++;
      generated.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
    }
    const { path: _path, ...metadata } = file;
    sources.push({ ...metadata, generatedAt: [...generated], rowsRead, rowsSelected });
  }
  const parts = new Map<string, string[]>();
  for (const key of Object.keys(cached.manifest.partitions)) if (key.startsWith('ZZ-')) {
    const normalized = normalizeTerritoryKey(key); const list = parts.get(normalized) ?? []; list.push(key); parts.set(normalized, list);
  }
  const prepared = [];
  let sectionRows = 0;
  for (const [key, details] of groups[0]!) {
    const city = { code: municipalityCode(details[0]!.CD_MUNICIPIO!), name: details[0]!.NM_MUNICIPIO! };
    if (details.some((row) => row.NM_MUNICIPIO !== city.name)) throw new Error(`Nome conflitante: ${key}`);
    const nominal = groups[1]!.get(key) ?? [];
    if (nominal.some((row) => row.NM_MUNICIPIO !== city.name)) throw new Error(`Nome nominal conflitante: ${key}`);
    const sections: SectionVote[] = [];
    for (const rawKey of parts.get(key) ?? []) {
      const part = await readPartition<SectionVote>(resolve(cached.directory, `${rawKey}.ndjson`), cached.manifest.partitions[rawKey]!);
      // Preparações antigas guardam a identidade na chave da partição, não em cada linha.
      for (const vote of part) sections.push({ ...vote, uf: vote.uf ?? 'ZZ', municipalityCode: vote.municipalityCode === undefined ? city.code : municipalityCode(vote.municipalityCode) });
    }
    const results = reconcileExterior(details, nominal, sections, city);
    results.summaries.forEach((summary) => exteriorCitySchema.parse(summary));
    results.places.forEach((place) => pollingPlaceSchema.parse(place));
    sectionRows += sections.length; prepared.push({ key, city, sections, results });
  }
  const manifestCities = new Set(Object.values(cached.manifest.territories).filter((item) => item.uf === 'ZZ').map((item) => territoryKey('ZZ', item.code)));
  if (!prepared.length || groups[0]!.size !== groups[1]!.size || prepared.length !== manifestCities.size
    || [...groups[1]!.keys(), ...parts.keys(), ...manifestCities].some((key) => !groups[0]!.has(key))) throw new Error('Cobertura do exterior incompleta.');
  const { path: _path, ...sectionMetadata } = files[2]!;
  sources.push({ ...sectionMetadata, generatedAt: cached.manifest.sources[2]!.generatedAt, rowsRead: cached.manifest.sources[2]!.rowsRead, rowsSelected: sectionRows });
  const dataset = datasetSchema.parse({ id, year: 2022, office: 'president', level: 'exterior', uf: 'ZZ', importedAt: new Date().toISOString(), importerVersion: VERSION,
    sources, validation: 'reconciled', coverage: { expected: prepared.length, reconciled: prepared.length, blocked: 0, excluded: 0 },
    scope: 'Presidência 2022 — Exterior (ZZ), cidades/localidades eleitorais e 1ª Zona Eleitoral do Exterior. Ambos os turnos reconciliados. País não é zona eleitoral; códigos de cidades são identidades TSE, não municípios brasileiros nem códigos IBGE.' });
  const coverage = prepared.map(({ city, sections, results }) => ({ uf: 'ZZ', ...city, status: 'reconciled', reason: null, sectionRows: sections.length, metadataConflicts: results.places.filter((place) => place.metadataConflict).length }));
  const expected = new Map<string, number>();
  for (const { results } of prepared) for (const summary of results.summaries) {
    for (const [number, votes] of [...summary.candidates.map((candidate) => [candidate.number, candidate.votes] as const), ['95', summary.totals.blank] as const, ['96', summary.totals.null] as const]) {
      const key = `${summary.round}/${number}`; expected.set(key, (expected.get(key) ?? 0) + votes);
    }
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext('observatorio:exterior-2022')) AS locked");
    if (!lock.rows[0]?.locked) throw new Error('Importação do exterior já em execução.');
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/003-national.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/004-national-section-lookup.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/005-search-trigram.sql'), 'utf8'));
    const existing = await client.query<{ published: boolean; metadata: unknown }>('SELECT published,metadata FROM import_batches WHERE id=$1', [id]);
    if (!existing.rows[0]?.published) {
      await client.query('BEGIN');
      try {
        for (const file of files) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [file.sha256, file.file, file.sizeBytes]);
        await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [id, SCOPE, dataset]);
        for (const { city, sections, results } of prepared) {
          for (const summary of results.summaries) await client.query("INSERT INTO municipality_results VALUES($1,2022,$2,'president',$3,'ZZ',$4,$5) ON CONFLICT DO NOTHING", [id, Number(summary.round), city.code, city.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), summary]);
          for (let start = 0; start < sections.length; start += 2000) await client.query(`INSERT INTO national_section_votes SELECT $1,2022,x."electionCode",x.round::integer,'president','ZZ',$2,x.zone,x.section,x.local,x.number,x.votes FROM jsonb_to_recordset($3::jsonb) AS x("electionCode" text,round text,zone integer,section integer,local text,number text,votes integer) ON CONFLICT DO NOTHING`, [id, city.code, JSON.stringify(sections.slice(start, start + 2000))]);
          await client.query(`INSERT INTO national_zone_results SELECT $1,2022,'president','ZZ',$2,x.round::integer,x.zone,to_jsonb(x) FROM jsonb_to_recordset($3::jsonb) AS x(round text,zone integer,totals jsonb,candidates jsonb) ON CONFLICT DO NOTHING`, [id, city.code, JSON.stringify(results.zones)]);
          await client.query(`INSERT INTO national_place_results SELECT $1,2022,'president','ZZ',$2,x.round::integer,x.zone,x.code,to_jsonb(x) FROM jsonb_to_recordset($3::jsonb) AS x(round text,zone integer,code text,name text,address text,sections integer,totals jsonb,candidates jsonb,"metadataConflict" boolean,"metadataVariants" jsonb) ON CONFLICT DO NOTHING`, [id, city.code, JSON.stringify(results.places)]);
          await client.query("INSERT INTO import_coverage(batch_id,year,office,uf,code,name,status,section_rows,metadata_conflicts) VALUES($1,2022,'president','ZZ',$2,$3,'reconciled',$4,$5) ON CONFLICT DO NOTHING", [id, city.code, city.name, sections.length, results.places.filter((place) => place.metadataConflict).length]);
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    const persisted = await client.query<{ round: number; number: string; votes: string }>('SELECT round,vote_number AS number,sum(votes)::text AS votes FROM national_section_votes WHERE batch_id=$1 GROUP BY round,vote_number', [id]);
    const actual = new Map(persisted.rows.map((row) => [`${row.round}/${row.number}`, Number(row.votes)]));
    for (const key of new Set([...expected.keys(), ...actual.keys()])) assertEqual(actual.get(key) ?? 0, expected.get(key) ?? 0, `Persistência ${key}`);
    const counts = (await client.query<{ cities: number; rows: number }>('SELECT (SELECT count(*)::integer FROM municipality_results WHERE batch_id=$1) AS cities,(SELECT count(*)::integer FROM national_section_votes WHERE batch_id=$1) AS rows', [id])).rows[0]!;
    assertEqual(counts.cities, prepared.length * 2, 'Localidades/turnos persistidos'); assertEqual(counts.rows, sectionRows, 'Registros de seção persistidos');
    const persistedSections = (await client.query<{ year: number; election_code: string; round: number; office: string; uf: string; municipality_code: string; zone: number; section: number; polling_place_code: string; vote_number: string; votes: number }>('SELECT year,election_code,round,office,uf,municipality_code,zone,section,polling_place_code,vote_number,votes FROM national_section_votes WHERE batch_id=$1', [id])).rows
      .map((row) => JSON.stringify([row.year, row.election_code, row.round, row.office, row.uf, row.municipality_code, row.zone, row.section, row.polling_place_code, row.vote_number, row.votes])).sort();
    const expectedSections = prepared.flatMap(({ city, sections }) => sections.map((vote) => JSON.stringify([2022, vote.electionCode, Number(vote.round), 'president', 'ZZ', city.code, vote.zone, vote.section, vote.local, vote.number, vote.votes]))).sort();
    if (JSON.stringify(persistedSections) !== JSON.stringify(expectedSections)) throw new Error('Chaves/quantidades das seções persistidas divergem dos originais preparados.');
    const storedSummaries = (await client.query<{ result: unknown }>('SELECT result FROM municipality_results WHERE batch_id=$1 ORDER BY code,round', [id])).rows.map((row) => exteriorCitySchema.parse(row.result));
    const expectedSummaries = prepared.flatMap((item) => item.results.summaries).sort((a, b) => a.code.localeCompare(b.code) || a.round.localeCompare(b.round));
    if (JSON.stringify(storedSummaries) !== JSON.stringify(expectedSummaries)) throw new Error('Agregados persistidos divergem da reconciliação.');
    await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
    await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify({ dataset: existing.rows[0]?.published ? datasetSchema.parse(existing.rows[0].metadata) : dataset, coverage, persistedVerification: { at: new Date().toISOString(), ...counts, mismatches: 0 },
      checks: ['Originais SHA-256 e duas entradas ZIP relidas com CRC', 'Partições de votos por seção verificadas por SHA-256 e contagem; preparo completo correspondente aos mesmos originais', `${prepared.length} localidades, candidaturas, votos e participação reconciliados nos dois turnos`, 'Unidades sem seções instaladas: zero somente quando a apuração e o nominal oficiais confirmam; nenhuma linha de seção inventada', 'Todas as linhas de seção persistidas comparadas por ano/eleição/turno/cargo/UF/localidade/zona/seção/local/votável/quantidade', 'Contagens e todos os agregados persistidos reconferidos'],
      limitations: ['País não é zona: única zona eleitoral 1 em ZZ.', 'Nenhum agrupamento por país inferido a partir do nome da cidade.', 'Aptos e abstenção por local continuam indisponíveis.', 'Não representa local de residência nem correspondência IBGE.'] }, null, 2));
    if (!existing.rows[0]?.published) {
      await client.query('BEGIN');
      try {
        await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
        await client.query('UPDATE import_batches SET metadata=$2,published=true WHERE id=$1', [id, dataset]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    console.log(JSON.stringify({ status: existing.rows[0]?.published ? 'already-published-verified' : 'published', id, cities: prepared.length, sectionRows, rounds: 2, mismatches: 0 }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Importação do exterior falhou.'); process.exitCode = 1; });
