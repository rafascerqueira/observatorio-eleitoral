import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { datasetSchema, municipalitySchema, pollingPlaceSchema, TERRITORIES, type MunicipalityResult } from '@observatorio/contracts';
import { rows, type Row } from './csv';
import { reconcile, sectionVote, type SectionVote } from './model';
import { ROOT, SOURCES, sourceFile } from './sources';
import { PartitionWriter, readPartition } from './partition';
import { municipalityCode, territoryKey, normalizeTerritoryKey, assertNationalTerritories } from './territory';

export const NATIONAL_VERSION = 'president-2022-national-v2';
const SCOPE = '2022/president/BR';
type Territory = { code: string; uf: typeof TERRITORIES[number]; name: string };
type Manifest = { sources: Array<Omit<Awaited<ReturnType<typeof sourceFile>>, 'path'> & { generatedAt: string[]; rowsRead: number; rowsSelected: number }>; territories: Record<string, Territory>; partitions: Record<string, { sha256: string; rows: number }>; outsideScope: number };
const keyOf = (row: Row) => {
  if (!(TERRITORIES as readonly string[]).includes(row.SG_UF!) || !/^\d+$/.test(row.CD_MUNICIPIO!) || !row.NM_MUNICIPIO) throw new Error('Identidade territorial ausente/inválida.');
  return territoryKey(row.SG_UF!, row.CD_MUNICIPIO!);
};
const selected = (row: Row) => row.ANO_ELEICAO === '2022' && row.CD_CARGO === '1';

async function stage(id: string, files: Awaited<ReturnType<typeof sourceFile>>[]) {
  let directory = resolve(ROOT, 'data/staging/national', id);
  const readManifest = (directory: string) => readFile(resolve(directory, 'manifest.json'), 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return null; });
  let cached = await readManifest(directory);
  if (!cached) {
    // A v2 muda identidade, não os bytes de votação. Reutilizar a preparação
    // completa da v1 apenas quando TODOS os hashes e entradas coincidirem.
    const priorId = createHash('sha256').update(JSON.stringify({ version: 'president-2022-national-v1', scope: SCOPE, hashes: files.map((file) => file.sha256) })).digest('hex');
    const priorDirectory = resolve(ROOT, 'data/staging/national', priorId);
    const prior = await readManifest(priorDirectory);
    if (prior) { cached = prior; directory = priorDirectory; }
  }
    if (cached) {
      console.log('Partições concluídas encontradas; retomando por município.');
      const manifest = JSON.parse(cached) as Manifest;
      for (const [index, file] of files.entries()) {
        if (manifest.sources[index]?.sha256 !== file.sha256 || manifest.sources[index]?.entry !== file.entry) throw new Error('Manifesto não corresponde aos originais.');
        if (index >= 2) continue;
        // Reconfere as duas pequenas fontes diretamente no ZIP. Evita confiar
        // em apuração/nominal editadas ou truncadas no cache de uma retomada.
        const originalHash = createHash('sha256'); originalHash.update('[');
        let first = true;
        for await (const row of rows(file.path, file.entry, selected)) { if (!first) originalHash.update(','); originalHash.update(JSON.stringify(row)); first = false; }
        originalHash.update(']');
        const staged = await readFile(resolve(directory, index === 0 ? 'detail.json' : 'nominal.json'));
        if (createHash('sha256').update(staged).digest('hex') !== originalHash.digest('hex')) throw new Error('Apuração/nominal da preparação não corresponde ao original.');
      }
      return { directory, manifest };
    }
  await mkdir(resolve(ROOT, 'data/staging/national'), { recursive: true });
  const temporary = await mkdtemp(resolve(ROOT, 'data/staging/national', `${id}.partial-`));
  const writer = new PartitionWriter(temporary);
  const manifest: Manifest = { sources: [], territories: {}, partitions: {}, outsideScope: 0 };
  try {
    for (const [index, file] of files.entries()) {
      let rowsRead = 0, rowsSelected = 0;
      const generations = new Set<string>();
      // Detalhe e nominal são pequenos. Seções vão diretamente às partições.
      const smallRows: Row[] = [];
      for await (const row of rows(file.path, file.entry, (row) => { rowsRead++; return selected(row); })) {
        rowsSelected++;
        const key = keyOf(row);
        const territory: Territory = { uf: row.SG_UF as Territory['uf'], code: municipalityCode(row.CD_MUNICIPIO!), name: row.NM_MUNICIPIO! };
        const previous = manifest.territories[key];
        if (previous && previous.name !== territory.name) throw new Error(`Nome territorial divergente: ${key}`);
        manifest.territories[key] = territory;
        generations.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
        if (index < 2) smallRows.push(row);
        else await writer.write(key, sectionVote({ ...row, CD_MUNICIPIO: territory.code }));
        if (rowsSelected % 250_000 === 0) console.log(`${file.entry}: ${rowsSelected.toLocaleString('pt-BR')} registros preservados; RSS ${Math.round(process.memoryUsage().rss / 1024 ** 2)} MiB.`);
      }
      if (!rowsSelected) throw new Error(`Nenhum registro selecionado em ${file.entry}; cabeçalho/escopo precisa de auditoria.`);
      if (index < 2) await writeFile(resolve(temporary, index === 0 ? 'detail.json' : 'nominal.json'), JSON.stringify(smallRows));
      const { path: _path, ...metadata } = file;
      manifest.sources.push({ ...metadata, generatedAt: [...generations], rowsRead, rowsSelected });
      manifest.outsideScope += rowsRead - rowsSelected;
    }
    // CRC do ZIP já foi verificado por rows(); o marcador só existe após fechamento.
    manifest.partitions = await writer.close();
    await writeFile(resolve(temporary, 'manifest.json'), JSON.stringify(manifest));
    await rename(temporary, directory);
    return { directory, manifest };
  } catch (error) { writer.abort(); throw error; }
}
function grouped(records: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of records) { const key = keyOf(row); const group = groups.get(key) ?? []; group.push({ ...row, CD_MUNICIPIO: municipalityCode(row.CD_MUNICIPIO!) }); groups.set(key, group); }
  return groups;
}
async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const files = await Promise.all(SOURCES.map(sourceFile));
  const id = createHash('sha256').update(JSON.stringify({ version: NATIONAL_VERSION, scope: SCOPE, hashes: files.map((file) => file.sha256) })).digest('hex');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    // Lock de sessão: evita duas importações concorrentes do mesmo recorte.
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext('observatorio:national-2022')) AS locked");
    if (!lock.rows[0]?.locked) throw new Error('Já há uma importação nacional em execução.');
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/003-national.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/004-national-section-lookup.sql'), 'utf8'));
    for (const file of files) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [file.sha256, file.file, file.sizeBytes]);
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}; originais e checksums conferidos. Nenhuma duplicação.`); return; }
    const { directory, manifest } = await stage(id, files);
    const territories: Record<string, Territory> = {};
    for (const item of Object.values(manifest.territories)) {
      const key = territoryKey(item.uf, item.code);
      if (territories[key] && territories[key]!.name !== item.name) throw new Error(`Nomes divergentes após normalização: ${key}`);
      territories[key] = { ...item, code: municipalityCode(item.code) };
    }
    assertNationalTerritories(Object.values(territories));
    const partitionKeys = new Map<string, string[]>();
    for (const rawKey of Object.keys(manifest.partitions)) {
      const key = normalizeTerritoryKey(rawKey);
      const group = partitionKeys.get(key) ?? []; group.push(rawKey); partitionKeys.set(key, group);
    }
    const partitionCount = (key: string) => (partitionKeys.get(key) ?? []).reduce((sum, rawKey) => sum + manifest.partitions[rawKey]!.rows, 0);
    const priorId = createHash('sha256').update(JSON.stringify({ version: 'president-2022-national-v1', scope: SCOPE, hashes: files.map((file) => file.sha256) })).digest('hex');
    const priorBatch = await client.query('SELECT metadata FROM import_batches WHERE id=$1 AND NOT published', [priorId]);
    if (priorBatch.rows.length) {
      const reason = 'Importador v1 interrompido: códigos municipais com e sem zero inicial foram tratados como identidades distintas. Erro de normalização corrigido na v2, não ausência de dados do TSE. Quantidades dessa tentativa são diagnósticos de identificadores brutos, não contagem oficial de municípios.';
      const priorCoverage = await client.query('SELECT uf,code,name,status,reason,section_rows AS "sectionRows" FROM import_coverage WHERE batch_id=$1 ORDER BY uf,code', [priorId]);
      await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
      const failedMetadata = { ...priorBatch.rows[0]!.metadata, validation: 'blocked', failureReason: reason, supersededBy: id };
      await writeFile(resolve(ROOT, 'data/audit', `${priorId}.json`), JSON.stringify({ status: 'blocked', failureReason: reason, supersededBy: id, at: new Date().toISOString(), dataset: failedMetadata, coverage: priorCoverage.rows }, null, 2));
      await client.query("UPDATE import_batches SET metadata=metadata || jsonb_build_object('validation','blocked','failureReason',$2::text,'supersededBy',$3::text) WHERE id=$1 AND NOT published", [priorId, reason, id]);
    }
    const details = grouped(JSON.parse(await readFile(resolve(directory, 'detail.json'), 'utf8')) as Row[]);
    const nominal = grouped(JSON.parse(await readFile(resolve(directory, 'nominal.json'), 'utf8')) as Row[]);
    const dataset = datasetSchema.parse({ id, year: 2022, office: 'president', level: 'national', importedAt: new Date().toISOString(), importerVersion: NATIONAL_VERSION, sources: manifest.sources, scope: 'Presidência 2022, municípios das 27 UFs; turnos separados. Exterior (ZZ) preservado nas fontes e discriminado na cobertura, sem publicação municipal nesta versão. Registros descrevem local de votação, não residência.', validation: 'reconciled' });
    await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, SCOPE, dataset]);
    for (const [key, territory] of Object.entries(territories)) {
      const excluded = territory.uf === 'ZZ';
      await client.query(`INSERT INTO import_coverage(batch_id,year,office,uf,code,name,status,reason,section_rows) VALUES($1,2022,'president',$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [id, territory.uf, territory.code, territory.name, excluded ? 'excluded' : 'pending', excluded ? 'Exterior: identidade e seções não instaladas exigem regra própria; preservado no original, não misturado aos municípios brasileiros.' : null, partitionCount(key)]);
    }
    const completed = await client.query<{ uf: string; code: string }>("SELECT uf,code FROM import_coverage WHERE batch_id=$1 AND status='reconciled'", [id]);
    const done = new Set(completed.rows.map((row) => `${row.uf}-${row.code}`));
    let processed = 0;
    for (const [key, territory] of Object.entries(territories).sort(([a], [b]) => a.localeCompare(b))) {
      if (territory.uf === 'ZZ' || done.has(key)) continue;
      const sections: SectionVote[] = [];
      for (const rawKey of partitionKeys.get(key) ?? []) {
        const part = await readPartition<SectionVote>(resolve(directory, `${rawKey}.ndjson`), manifest.partitions[rawKey]!);
        for (const vote of part) { if (vote.municipalityCode) vote.municipalityCode = municipalityCode(vote.municipalityCode); sections.push(vote); }
      }
      let results: ReturnType<typeof reconcile>;
      try {
        results = reconcile(details.get(key) ?? [], nominal.get(key) ?? [], sections, territory as { code: string; name: string; uf: MunicipalityResult['uf'] }, { allowNonInstalled: true });
        results.summaries.forEach((item) => municipalitySchema.parse(item));
        results.places.forEach((item) => pollingPlaceSchema.parse(item));
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Falha de validação.';
        await client.query("UPDATE import_coverage SET status='blocked',reason=$4 WHERE batch_id=$1 AND uf=$2 AND code=$3", [id, territory.uf, territory.code, reason]);
        console.log(`Bloqueado ${key}: ${reason}`); continue;
      }
      await client.query('BEGIN');
      try {
        for (const summary of results.summaries) await client.query('INSERT INTO municipality_results VALUES($1,2022,$2,\'president\',$3,$4,$5,$6)', [id, Number(summary.round), territory.code, territory.uf, territory.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), summary]);
        for (let start = 0; start < sections.length; start += 2000) {
          await client.query(`INSERT INTO national_section_votes SELECT $1,2022,x."electionCode",x.round::integer,'president',$2,$3,x.zone,x.section,x.local,x.number,x.votes FROM jsonb_to_recordset($4::jsonb) AS x("electionCode" text,round text,zone integer,section integer,local text,number text,votes integer)`, [id, territory.uf, territory.code, JSON.stringify(sections.slice(start, start + 2000))]);
        }
        await client.query(`INSERT INTO national_zone_results SELECT $1,2022,'president',$2,$3,x.round::integer,x.zone,to_jsonb(x) FROM jsonb_to_recordset($4::jsonb) AS x(round text,zone integer,totals jsonb,candidates jsonb)`, [id, territory.uf, territory.code, JSON.stringify(results.zones)]);
        await client.query(`INSERT INTO national_place_results SELECT $1,2022,'president',$2,$3,x.round::integer,x.zone,x.code,to_jsonb(x) FROM jsonb_to_recordset($4::jsonb) AS x(round text,zone integer,code text,name text,address text,sections integer,totals jsonb,candidates jsonb,"metadataConflict" boolean,"metadataVariants" jsonb)`, [id, territory.uf, territory.code, JSON.stringify(results.places)]);
        await client.query("UPDATE import_coverage SET status='reconciled',reason=NULL,metadata_conflicts=$4 WHERE batch_id=$1 AND uf=$2 AND code=$3", [id, territory.uf, territory.code, results.places.filter((place) => place.metadataConflict).length]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      if (++processed % 100 === 0) console.log(`${done.size + processed} municípios reconciliados e gravados; checkpoint transacional concluído.`);
    }
    const coverage = await client.query<{ status: string; count: number }>('SELECT status,count(*)::integer AS count FROM import_coverage WHERE batch_id=$1 GROUP BY status', [id]);
    const counts = Object.fromEntries(coverage.rows.map((row) => [row.status, row.count]));
    dataset.coverage = { expected: Object.values(territories).filter((item) => item.uf !== 'ZZ').length, reconciled: counts.reconciled ?? 0, blocked: counts.blocked ?? 0, excluded: counts.excluded ?? 0 };
    const records = await client.query('SELECT uf,code,name,status,reason,section_rows AS "sectionRows",metadata_conflicts AS "metadataConflicts" FROM import_coverage WHERE batch_id=$1 ORDER BY uf,code', [id]);
    const report = { dataset, coverage: records.rows, rowsOutsideScope: manifest.outsideScope, checks: ['Unicidade eleição/turno/cargo/UF/município/zona/seção/votável', 'Candidaturas e composição dos votos reconciliadas por zona nos dois turnos', 'Aptos = comparecimento + abstenção + eleitores de seções não instaladas; seções principais = com votos + não instaladas', 'Checksum das partições e CRC das entradas ZIP', 'Publicação atômica apenas após conclusão da cobertura doméstica'], limitations: ['ZZ separado e não publicado nesta versão.', 'ST_PENDENTE_TOT_FINAL ausente na apuração: não presumido.', 'Trânsito marcado S e categorias não auditadas bloqueiam o recorte, sem descarte silencioso.', 'Eleitores de seções não instaladas não são reclassificados como abstenção; quantitativo mantido em categoria própria.', 'Aptos, comparecimento e abstenção por local permanecem null.', 'Nenhuma associação residencial, IBGE ou socioeconômica.'], elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
    await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
    await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify(report, null, 2));
    await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
    if (!dataset.coverage.expected || counts.blocked || counts.pending || dataset.coverage.reconciled !== dataset.coverage.expected) throw new Error(`Publicação nacional bloqueada: ${counts.blocked ?? 0} municípios bloqueados, ${counts.pending ?? 0} pendentes. Piloto preservado; consultar relatório ${id}.`);
    await client.query('BEGIN');
    await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
    await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
    await client.query('COMMIT');
    await client.query('ANALYZE municipality_results; ANALYZE national_place_results; ANALYZE national_section_votes;');
    console.log(JSON.stringify({ published: id, coverage: dataset.coverage, elapsedSeconds: report.elapsedSeconds, peakRssMiB: report.peakRssMiB }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Importação nacional falhou.'); process.exitCode = 1; });
