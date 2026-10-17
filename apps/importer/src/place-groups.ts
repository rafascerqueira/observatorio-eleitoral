import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import { percent, placeGroupsSchema, placeProfilesDatasetSchema, PLACE_GROUP_INDICATORS, STATES, type PlaceGroupIndicator, type PlaceGroups } from '@observatorio/contracts';
import { ROOT } from './sources';

/**
 * Métrica E pré-calculada (agregado persistido, como os resultados): para cada recorte publicado (cargo, UF ou Brasil,
 * turno realizado) e indicador, locais em quintis ponderados pelos eleitores aptos e votos somados por grupo. Os grupos
 * descrevem locais, não eleitores. Deriva só de publicações existentes; nenhum dado novo.
 */
const VERSION = 'place-groups-2022-v1';
const SCOPE = '2022/places/groups';
type Input = { id: string; scope: string; metadata: { rounds?: Array<'1' | '2'>; level?: string; office?: string; uf?: string } };

async function compute(client: PoolClient, input: { results: string; profiles: string; tracts: string; college: number; office: string; uf: string | null; round: string; indicator: PlaceGroupIndicator }): Promise<PlaceGroups> {
  const indicatorSql = input.indicator === 'college'
    ? `SELECT uf, municipality_code, zone, place_code AS code, (counts->'education'->>${input.college})::numeric * 100 / eligible AS value, eligible AS weight FROM polling_place_profiles WHERE batch_id=$5 AND eligible > 0`
    : `SELECT t.uf, t.municipality_code, t.zone, t.place_code AS code, c.responsible_income_median AS value, pp.eligible AS weight
       FROM polling_place_tracts t JOIN census_tract_context c ON c.batch_id=t.batch_id AND c.cd_setor=t.cd_setor
       JOIN polling_place_profiles pp ON pp.batch_id=$5 AND pp.uf=t.uf AND pp.municipality_code=t.municipality_code AND pp.zone=t.zone AND pp.place_code=t.place_code
       WHERE t.batch_id=$6 AND t.status='associated' AND t.shared_coordinate=0 AND c.responsible_income_median IS NOT NULL AND pp.eligible > 0`;
  const params = [input.results, Number(input.round), input.office, input.uf, input.profiles, ...(input.indicator === 'income-median' ? [input.tracts] : [])];
  const rows = await client.query<{ kind: string; g: number; from: string | null; to: string | null; places: number | null; eligible: string | null; valid: string | null; blank: string | null; nulls: string | null; total: string | null; number: string | null; name: string | null; party: string | null; votes: string | null }>(`
    WITH ind AS (${indicatorSql}),
    base AS (SELECT p.result, ind.value, ind.weight, p.uf, p.municipality_code, p.zone, p.code FROM national_place_results p
      JOIN ind ON ind.uf=p.uf AND ind.municipality_code=p.municipality_code AND ind.zone=p.zone AND ind.code=p.code
      WHERE p.batch_id=$1 AND p.round=$2 AND p.office=$3 AND p.uf<>'ZZ' AND ($4::text IS NULL OR p.uf=$4)),
    -- Quintis ponderados: cada local entra no grupo da fração acumulada de eleitores aptos antes dele (ordem: indicador e chave).
    grouped AS (SELECT *, least(4, floor((sum(weight) OVER (ORDER BY value, uf, municipality_code, zone, code) - weight)::numeric / sum(weight) OVER () * 5))::integer + 1 AS g FROM base)
    SELECT 'group' AS kind, g, min(value)::text AS "from", max(value)::text AS "to", count(*)::integer AS places, sum(weight)::text AS eligible,
      sum((result->'totals'->>'valid')::bigint)::text AS valid, sum((result->'totals'->>'blank')::bigint)::text AS blank, sum((result->'totals'->>'null')::bigint)::text AS nulls,
      sum((result->'totals'->>'totalVotes')::bigint)::text AS total, NULL AS number, NULL AS name, NULL AS party, NULL AS votes FROM grouped GROUP BY g
    UNION ALL SELECT 'candidate', g, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, c->>'number', c->>'name', c->>'party', sum((c->>'votes')::bigint)::text
      FROM grouped CROSS JOIN LATERAL jsonb_array_elements(result->'candidates') c GROUP BY g, c->>'number', c->>'name', c->>'party'`, params);
  const coverage = await client.query<{ places: number; total: string }>("SELECT count(*)::integer AS places, coalesce(sum((result->'totals'->>'totalVotes')::bigint), 0)::text AS total FROM national_place_results WHERE batch_id=$1 AND round=$2 AND office=$3 AND uf<>'ZZ' AND ($4::text IS NULL OR uf=$4)", [input.results, Number(input.round), input.office, input.uf]);
  const groups = rows.rows.filter((row) => row.kind === 'group').sort((a, b) => a.g - b.g).map((row) => {
    const valid = Number(row.valid);
    const candidates = rows.rows.filter((entry) => entry.kind === 'candidate' && entry.g === row.g).map((entry) => ({ number: entry.number!, name: entry.name!, party: entry.party!, votes: Number(entry.votes), percentValid: percent(Number(entry.votes), valid) }))
      .sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number));
    if (candidates.reduce((sum, item) => sum + item.votes, 0) !== valid) throw new Error(`Grupo ${row.g} (${input.office}/${input.uf ?? 'BR'}/${input.round}/${input.indicator}): candidaturas não somam os válidos.`);
    return { index: row.g, from: Number(row.from), to: Number(row.to), places: row.places!, eligible: Number(row.eligible), valid, blank: Number(row.blank), null: Number(row.nulls), totalVotes: Number(row.total), candidates };
  });
  return placeGroupsSchema.parse({ status: 'published', indicator: input.indicator, office: input.office, round: input.round, uf: input.uf,
    groups, coverage: { places: coverage.rows[0]!.places, placesInGroups: groups.reduce((sum, group) => sum + group.places, 0), totalVotes: Number(coverage.rows[0]!.total), votesInGroups: groups.reduce((sum, group) => sum + group.totalVotes, 0) } });
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query(await readFile(resolve(__dirname, 'migrations/011-place-groups.sql'), 'utf8'));
    const published = (await client.query<Input>("SELECT id, scope, metadata FROM import_batches WHERE published AND (scope='2022/president/BR' OR scope LIKE '2022/governor/%' OR scope LIKE '2022/senator/%' OR scope IN ('2022/places/profiles','2022/places/tracts'))")).rows;
    const profiles = published.find((row) => row.scope === '2022/places/profiles'); const tracts = published.find((row) => row.scope === '2022/places/tracts');
    if (!profiles || !tracts) throw new Error('Perfil por local e associação aos setores precisam estar publicados.');
    const college = placeProfilesDatasetSchema.parse(profiles.metadata).order.education.indexOf('college-complete');
    const recortes: Array<{ results: string; office: string; uf: string | null; round: string }> = [];
    for (const batch of published.filter((row) => !row.scope.startsWith('2022/places/'))) {
      const [, office, territory] = batch.scope.split('/') as [string, string, string];
      const rounds = batch.metadata.rounds ?? ['1', '2'];
      for (const round of rounds) for (const uf of territory === 'BR' ? [null, ...STATES] : [territory]) recortes.push({ results: batch.id, office, uf, round });
    }
    const id = createHash('sha256').update(JSON.stringify({ version: VERSION, inputs: published.map((row) => row.id).sort() })).digest('hex');
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}.`); return; }
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, SCOPE, { kind: 'place-groups', pending: true }]);
      await client.query('DELETE FROM place_groups WHERE batch_id=$1', [id]);
      let done = 0;
      for (const recorte of recortes) for (const indicator of Object.keys(PLACE_GROUP_INDICATORS) as PlaceGroupIndicator[]) {
        const result = await compute(client, { ...recorte, profiles: profiles.id, tracts: tracts.id, college, indicator });
        await client.query('INSERT INTO place_groups VALUES($1,$2,$3,$4,$5,$6,$7)', [id, recorte.results, recorte.office, recorte.uf ?? 'BR', Number(recorte.round), indicator, result]);
        if (++done % 50 === 0) console.log(`${done} recortes calculados.`);
      }
      const dataset = { kind: 'place-groups', id, importerVersion: VERSION, importedAt: new Date().toISOString(), inputs: published.map((row) => ({ id: row.id, scope: row.scope })), recortes: done,
        scope: 'Métrica E: locais agrupados em quintis ponderados por eleitores aptos, por escolaridade declarada (TSE) ou rendimento mediano do responsável no setor do local (IBGE), com votos somados por grupo.' };
      await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
      await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
      await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
      await client.query('COMMIT');
      await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
      await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify({ dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000) }, null, 2));
      console.log(JSON.stringify({ published: id, scope: SCOPE, recortes: done, elapsedSeconds: Math.round((performance.now() - started) / 1000) }));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Grupos de locais falharam.'); process.exitCode = 1; });
