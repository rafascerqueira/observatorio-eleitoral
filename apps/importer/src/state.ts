import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { datasetSchema, municipalitySchema, pollingPlaceSchema, STATES, type MunicipalityResult } from '@observatorio/contracts';
import { rows, type Row } from './csv';
import { GOVERNOR_2022, reconcile, sectionVote, type ElectionScope, type SectionVote } from './model';
import { ROOT, sourceFile, stateSources } from './sources';
import { PartitionWriter, readPartition } from './partition';
import { municipalityCode, territoryKey, normalizeTerritoryKey } from './territory';
import { persistTerritory } from './persist';

/** Cargos estaduais auditados. Senado e deputados têm regras próprias e ainda não entram aqui. */
const SCOPES: Record<string, ElectionScope> = { governor: GOVERNOR_2022 };
const LABELS: Record<string, string> = { governor: 'Governador' };
/** Outras eleições do mesmo cargo presentes nas entradas da UF, excluídas de forma declarada e contada.
 * Qualquer outro código de eleição continua bloqueando a importação. */
type Exclusion = { electionCode: string; description: string; reason: string };
const EXCLUSIONS: Record<string, Record<string, Exclusion[]>> = {
  governor: { RR: [{ electionCode: '6278', description: 'Eleição Suplementar Governador 2026 (21/06/2026), tipo 1 — Eleição Extraordinária', reason: 'Outra disputa, posterior à eleição ordinária de 2022; não é somada nem misturada a ela. Fica para uma etapa própria, com auditoria específica.' }] },
};
type Uf = MunicipalityResult['uf'];
type Territory = { code: string; uf: Uf; name: string };
type SourceMetadata = Omit<Awaited<ReturnType<typeof sourceFile>>, 'path'> & { generatedAt: string[]; rowsRead: number; rowsSelected: number };
type Manifest = { sources: SourceMetadata[]; territories: Record<string, Territory>; partitions: Record<string, { sha256: string; rows: number }>; outsideScope: number;
  excluded: Record<string, Record<string, number>> };

function selector(scope: ElectionScope, uf: Uf, exclusions: Exclusion[], excluded?: Map<string, number>) {
  return (row: Row) => {
    if (row.ANO_ELEICAO !== String(scope.year) || row.CD_CARGO !== scope.cargo) return false;
    // A entrada é da UF: outra UF no arquivo é inconsistência, não linha a ignorar.
    if (row.SG_UF !== uf) throw new Error(`UF inesperada na entrada de ${uf}: ${row.SG_UF ?? 'ausente'}. Publicação bloqueada.`);
    if (exclusions.some((item) => item.electionCode === row.CD_ELEICAO)) { excluded?.set(row.CD_ELEICAO!, (excluded.get(row.CD_ELEICAO!) ?? 0) + 1); return false; }
    return true;
  };
}
const keyOf = (row: Row) => {
  if (!/^\d+$/.test(row.CD_MUNICIPIO ?? '') || !row.NM_MUNICIPIO) throw new Error('Identidade territorial ausente/inválida.');
  return territoryKey(row.SG_UF!, row.CD_MUNICIPIO!);
};
async function smallSourceHash(file: Awaited<ReturnType<typeof sourceFile>>, select: (row: Row) => boolean) {
  const hash = createHash('sha256'); hash.update('[');
  let first = true;
  for await (const row of rows(file.path, file.entry, select)) { if (!first) hash.update(','); hash.update(JSON.stringify(row)); first = false; }
  hash.update(']');
  return hash.digest('hex');
}

async function stage(id: string, files: Awaited<ReturnType<typeof sourceFile>>[], scope: ElectionScope, uf: Uf, exclusions: Exclusion[]) {
  const base = resolve(ROOT, 'data/staging/state');
  const directory = resolve(base, id);
  const select = selector(scope, uf, exclusions);
  const cached = await readFile(resolve(directory, 'manifest.json'), 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return null; });
  if (cached) {
    console.log('Preparação concluída encontrada; conferindo contra os originais.');
    const manifest = JSON.parse(cached) as Manifest;
    for (const [index, file] of files.entries()) {
      if (manifest.sources[index]?.sha256 !== file.sha256 || manifest.sources[index]?.entry !== file.entry) throw new Error('Manifesto não corresponde aos originais.');
      if (index >= 2) continue;
      // Apuração e nominal são relidas do ZIP; partições de seção têm SHA-256 próprio.
      const staged = await readFile(resolve(directory, index === 0 ? 'detail.json' : 'nominal.json'));
      if (createHash('sha256').update(staged).digest('hex') !== await smallSourceHash(file, select)) throw new Error('Apuração/nominal da preparação não corresponde ao original.');
    }
    return { directory, manifest };
  }
  await mkdir(base, { recursive: true });
  const temporary = await mkdtemp(resolve(base, `${id}.partial-`));
  const writer = new PartitionWriter(temporary);
  const manifest: Manifest = { sources: [], territories: {}, partitions: {}, outsideScope: 0, excluded: {} };
  try {
    for (const [index, file] of files.entries()) {
      let rowsRead = 0, rowsSelected = 0;
      const generations = new Set<string>();
      const smallRows: Row[] = [];
      const excluded = new Map<string, number>();
      const counting = selector(scope, uf, exclusions, excluded);
      for await (const row of rows(file.path, file.entry, (row) => { rowsRead++; return counting(row); })) {
        rowsSelected++;
        const key = keyOf(row);
        const territory: Territory = { uf, code: municipalityCode(row.CD_MUNICIPIO!), name: row.NM_MUNICIPIO! };
        const previous = manifest.territories[key];
        if (previous && previous.name !== territory.name) throw new Error(`Nome territorial divergente: ${key}`);
        manifest.territories[key] = territory;
        generations.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
        if (index < 2) smallRows.push(row);
        else await writer.write(key, sectionVote({ ...row, CD_MUNICIPIO: territory.code }, scope));
        if (rowsSelected % 250_000 === 0) console.log(`${file.entry}: ${rowsSelected.toLocaleString('pt-BR')} registros preservados; ${rowsRead.toLocaleString('pt-BR')} lidos.`);
      }
      if (!rowsSelected) throw new Error(`Nenhum registro selecionado em ${file.entry}; cabeçalho/escopo precisa de auditoria.`);
      if (index < 2) await writeFile(resolve(temporary, index === 0 ? 'detail.json' : 'nominal.json'), JSON.stringify(smallRows));
      const { path: _path, ...metadata } = file;
      manifest.sources.push({ ...metadata, generatedAt: [...generations], rowsRead, rowsSelected });
      manifest.outsideScope += rowsRead - rowsSelected;
      for (const [code, count] of excluded) (manifest.excluded[code] ??= {})[file.entry] = count;
    }
    // Uma exclusão declarada que não encontra linhas indica fonte diferente da auditada.
    for (const item of exclusions) if (!manifest.excluded[item.electionCode]) throw new Error(`Exclusão declarada sem linhas: eleição ${item.electionCode}. Auditar a fonte.`);
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
  const { values } = parseArgs({ options: { office: { type: 'string' }, uf: { type: 'string' } } });
  let scope = SCOPES[values.office ?? ''];
  const uf = values.uf as Uf | undefined;
  if (!scope || !uf || !(STATES as readonly string[]).includes(uf)) throw new Error(`Uso: --office ${Object.keys(SCOPES).join('|')} --uf <UF>`);
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  // v2: votos Anulado/Anulado sub judice/nulos técnicos reconciliados e exclusões declaradas.
  const version = `${scope.office}-${scope.year}-state-v2`;
  const exclusions = EXCLUSIONS[scope.office]?.[uf] ?? [];
  const scopeKey = `${scope.year}/${scope.office}/${uf}`;
  const started = performance.now();
  const files = await Promise.all(stateSources(uf).map(sourceFile));
  const id = createHash('sha256').update(JSON.stringify({ version, scope: scopeKey, hashes: files.map((file) => file.sha256), entries: files.map((file) => file.entry) })).digest('hex');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${scopeKey}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${scopeKey} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/003-national.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/004-national-section-lookup.sql'), 'utf8'));
    for (const file of files) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [file.sha256, file.file, file.sizeBytes]);
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}; originais e checksums conferidos. Nenhuma duplicação.`); return; }
    const { directory, manifest } = await stage(id, files, scope, uf, exclusions);
    const details = grouped(JSON.parse(await readFile(resolve(directory, 'detail.json'), 'utf8')) as Row[]);
    const nominal = grouped(JSON.parse(await readFile(resolve(directory, 'nominal.json'), 'utf8')) as Row[]);
    // Turnos realizados na UF segundo a apuração: 1º, ou 1º e 2º. Cada município precisa ter todos eles;
    // linhas de turno fora desse conjunto no nominal ou nas seções bloqueiam a reconciliação.
    const rounds = [...new Set([...details.values()].flat().map((row) => row.NR_TURNO ?? 'ausente'))].sort() as Array<'1' | '2'>;
    if (!['1', '1,2'].includes(rounds.join(','))) throw new Error(`Turnos na apuração de ${uf}: ${rounds.join(', ')}. Publicação bloqueada.`);
    scope = { ...scope, rounds };
    const territories = new Map<string, Territory>();
    for (const item of Object.values(manifest.territories)) territories.set(territoryKey(item.uf, item.code), { ...item, code: municipalityCode(item.code) });
    const partitionKeys = new Map<string, string[]>();
    for (const rawKey of Object.keys(manifest.partitions)) { const key = normalizeTerritoryKey(rawKey); const group = partitionKeys.get(key) ?? []; group.push(rawKey); partitionKeys.set(key, group); }
    const partitionCount = (key: string) => (partitionKeys.get(key) ?? []).reduce((sum, rawKey) => sum + manifest.partitions[rawKey]!.rows, 0);
    const label = LABELS[scope.office]!;
    const dataset = datasetSchema.parse({ id, year: scope.year, office: scope.office, level: 'state', uf, rounds,
      ...(exclusions.length ? { exclusions: exclusions.map((item) => ({ ...item, rows: manifest.excluded[item.electionCode] ?? {} })) } : {}), importedAt: new Date().toISOString(), importerVersion: version, sources: manifest.sources, validation: 'reconciled',
      scope: `${label} ${scope.year}, municípios de ${uf}; turnos separados, reconciliados por município e zona. Resultado estadual: soma dos municípios reconciliados, sem comparação com outras UFs. Registros descrevem local de votação, não residência.` });
    await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, scopeKey, dataset]);
    for (const [key, territory] of territories) {
      await client.query(`INSERT INTO import_coverage(batch_id,year,office,uf,code,name,status,reason,section_rows) VALUES($1,$2,$3,$4,$5,$6,'pending',NULL,$7) ON CONFLICT DO NOTHING`, [id, scope.year, scope.office, territory.uf, territory.code, territory.name, partitionCount(key)]);
    }
    const completed = await client.query<{ uf: string; code: string }>("SELECT uf,code FROM import_coverage WHERE batch_id=$1 AND status='reconciled'", [id]);
    const done = new Set(completed.rows.map((row) => territoryKey(row.uf, row.code)));
    let processed = 0;
    for (const [key, territory] of [...territories].sort(([a], [b]) => a.localeCompare(b))) {
      if (done.has(key)) continue;
      const sections: SectionVote[] = [];
      for (const rawKey of partitionKeys.get(key) ?? []) {
        for (const vote of await readPartition<SectionVote>(resolve(directory, `${rawKey}.ndjson`), manifest.partitions[rawKey]!)) sections.push({ ...vote, municipalityCode: municipalityCode(vote.municipalityCode!) });
      }
      let results: ReturnType<typeof reconcile>;
      try {
        results = reconcile(details.get(key) ?? [], nominal.get(key) ?? [], sections, territory, { allowNonInstalled: true, scope });
        results.summaries.forEach((item) => municipalitySchema.parse(item));
        results.places.forEach((item) => pollingPlaceSchema.parse(item));
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Falha de validação.';
        await client.query("UPDATE import_coverage SET status='blocked',reason=$4 WHERE batch_id=$1 AND uf=$2 AND code=$3", [id, territory.uf, territory.code, reason]);
        console.log(`Bloqueado ${key}: ${reason}`); continue;
      }
      await client.query('BEGIN');
      try {
        await persistTerritory(client, id, scope, territory, results, sections);
        await client.query("UPDATE import_coverage SET status='reconciled',reason=NULL,metadata_conflicts=$4 WHERE batch_id=$1 AND uf=$2 AND code=$3", [id, territory.uf, territory.code, results.places.filter((place) => place.metadataConflict).length]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      if (++processed % 100 === 0) console.log(`${done.size + processed} municípios reconciliados e gravados.`);
    }
    const coverage = await client.query<{ status: string; count: number }>('SELECT status,count(*)::integer AS count FROM import_coverage WHERE batch_id=$1 GROUP BY status', [id]);
    const counts = Object.fromEntries(coverage.rows.map((row) => [row.status, row.count]));
    dataset.coverage = { expected: territories.size, reconciled: counts.reconciled ?? 0, blocked: counts.blocked ?? 0, excluded: counts.excluded ?? 0 };
    const verification = await verifyPersisted(client, id, scope, rounds);
    const records = await client.query('SELECT uf,code,name,status,reason,section_rows AS "sectionRows",metadata_conflicts AS "metadataConflicts" FROM import_coverage WHERE batch_id=$1 ORDER BY uf,code', [id]);
    const report = { dataset, coverage: records.rows, rowsOutsideScope: manifest.outsideScope, persistedVerification: verification,
      checks: [`Somente ${label} (CD_CARGO ${scope.cargo}), eleições ${Object.values(scope.electionCodes).join('/')} e UF ${uf}; outra UF na entrada bloqueia`, 'Unicidade eleição/turno/cargo/UF/município/zona/seção/votável', 'Candidaturas e composição dos votos reconciliadas por zona em cada turno realizado', 'Aptos = comparecimento + abstenção + eleitores de seções não instaladas; seções principais = com votos + não instaladas', 'Checksum das partições e CRC das entradas ZIP', 'Votos persistidos por turno/votável e registros por município conferidos antes da publicação', 'Publicação atômica apenas com todos os municípios da UF reconciliados',
        'Votos = válidos + brancos + nulos (incluindo nulos técnicos) + anulados + anulados sub judice, por zona; cada candidatura anulada e cada votável de nulo técnico conferidos por zona', 'Outras eleições somente por exclusão declarada e contada'],
      limitations: ['ST_PENDENTE_TOT_FINAL ausente na apuração: não presumido.', 'Fontes de apuração/nominal e de seções têm datas de geração distintas; a compatibilidade é conferida pela reconciliação, não presumida.', 'Eleitores de seções não instaladas não são reclassificados como abstenção.', 'Aptos, comparecimento e abstenção por local permanecem null.', 'Resultado estadual não é comparável entre UFs: candidaturas diferem.', 'Nulo técnico não tem linha no nominal: nome do votável vem do arquivo de seções, sem partido nem situação.', 'Nenhuma associação residencial, IBGE ou socioeconômica.'],
      elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
    await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
    await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify(report, null, 2));
    await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
    if (!dataset.coverage.expected || counts.blocked || counts.pending || dataset.coverage.reconciled !== dataset.coverage.expected || !verification.ok) throw new Error(`Publicação de ${scopeKey} bloqueada: ${counts.blocked ?? 0} municípios bloqueados, ${counts.pending ?? 0} pendentes, verificação persistida ${verification.ok ? 'aprovada' : 'divergente'}. Consultar relatório ${id}.`);
    await client.query('BEGIN');
    await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [scopeKey]);
    await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
    await client.query('COMMIT');
    await client.query('ANALYZE municipality_results; ANALYZE national_place_results; ANALYZE national_section_votes;');
    console.log(JSON.stringify({ published: id, scope: scopeKey, coverage: dataset.coverage, elapsedSeconds: report.elapsedSeconds, peakRssMiB: report.peakRssMiB }, null, 2));
  } finally { client.release(); await pool.end(); }
}

/** Confere o que foi gravado contra os agregados reconciliados, antes de publicar. */
async function verifyPersisted(client: import('pg').PoolClient, id: string, scope: ElectionScope, rounds: string[]) {
  const stored = await client.query(`SELECT round,vote_number,sum(votes)::text AS votes FROM national_section_votes WHERE batch_id=$1 GROUP BY round,vote_number ORDER BY round,vote_number`, [id]);
  const expected = await client.query(`SELECT round,c->>'number' AS vote_number,sum((c->>'votes')::bigint)::text AS votes FROM municipality_results CROSS JOIN LATERAL jsonb_array_elements(result->'candidates') c WHERE batch_id=$1 GROUP BY round,c->>'number'
    UNION ALL SELECT round,'95',sum((result->'totals'->>'blank')::bigint)::text FROM municipality_results WHERE batch_id=$1 GROUP BY round
    UNION ALL SELECT round,n->>'number',sum((n->>'votes')::bigint)::text FROM municipality_results CROSS JOIN LATERAL jsonb_array_elements(coalesce(result->'nonValidVotes','[]'::jsonb)) n WHERE batch_id=$1 GROUP BY round,n->>'number'
    UNION ALL SELECT round,'96',sum((result->'totals'->>'null')::bigint - coalesce((result->'totals'->>'technicalNull')::bigint,0))::text FROM municipality_results WHERE batch_id=$1 GROUP BY round ORDER BY round,vote_number`, [id]);
  const mismatched = await client.query<{ count: number }>(`SELECT count(*)::integer AS count FROM (
    SELECT uf,municipality_code,count(*) AS rows FROM national_section_votes WHERE batch_id=$1 GROUP BY uf,municipality_code
  ) s FULL JOIN (SELECT uf,code,section_rows FROM import_coverage WHERE batch_id=$1 AND status='reconciled') c ON s.uf=c.uf AND s.municipality_code=c.code WHERE s.rows IS DISTINCT FROM c.section_rows::bigint`, [id]);
  const dimensions = await client.query<{ count: number }>(`SELECT count(*)::integer AS count FROM national_section_votes WHERE batch_id=$1 AND (year<>$2 OR office<>$3 OR NOT (round::text = ANY($4::text[])) OR election_code<>CASE WHEN round=1 THEN $5 ELSE $6 END)`, [id, scope.year, scope.office, rounds, scope.electionCodes['1'], scope.electionCodes['2']]);
  const summaries = await client.query<{ count: number }>('SELECT count(*)::integer AS count FROM municipality_results WHERE batch_id=$1', [id]);
  const reconciled = await client.query<{ count: number }>("SELECT count(*)::integer AS count FROM import_coverage WHERE batch_id=$1 AND status='reconciled'", [id]);
  const votesMatch = JSON.stringify(stored.rows) === JSON.stringify(expected.rows);
  const ok = votesMatch && mismatched.rows[0]!.count === 0 && dimensions.rows[0]!.count === 0 && summaries.rows[0]!.count === reconciled.rows[0]!.count * rounds.length;
  return { at: new Date().toISOString(), ok, votesMatch, mismatchedMunicipalities: mismatched.rows[0]!.count, outOfScopeRows: dimensions.rows[0]!.count, summaries: summaries.rows[0]!.count, votesByRoundAndNumber: stored.rows };
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Importação estadual falhou.'); process.exitCode = 1; });
