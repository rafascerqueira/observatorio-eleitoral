import { canonicalInputs, reusePublished, publicationId, preparePublication } from './publication';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import { ELECTION_YEARS, percent, PLACE_GROUP_CUTS, placeGroupLimits, placeGroupsSchema, placeProfilesDatasetSchema, PLACE_GROUP_INDICATORS, PLACE_GROUP_METHODS, PLACE_GROUP_NUMERATORS, STATES, type PlaceGroupIndicator, type PlaceGroups } from '@observatorio/contracts';
import { parseArgs } from 'node:util';
import { ROOT } from './sources';
import { entries, rows as csvRows } from './csv';
import { preservedDownload } from './sidra';
import { IBGE } from './sectors';

/**
 * Métrica E pré-calculada (agregado persistido, como os resultados): para cada recorte publicado (cargo, UF ou Brasil,
 * turno realizado) e indicador, locais agrupados e votos somados por grupo. Os grupos descrevem locais, não eleitores.
 * Deriva de publicações existentes e, desde a v6, do arquivo básico por setor preservado (favelas e comunidades urbanas).
 *
 * v2: a renda usa faixas fixas de salário mínimo (`INCOME_BANDS`), iguais em todos os recortes; a escolaridade segue em
 * quintis ponderados por eleitores aptos, mas locais com o mesmo valor ficam sempre no mesmo grupo. A v1 desempatava
 * pela chave do local e, onde muitos setores têm mediana de 1 SM, separava valores iguais em grupos diferentes.
 * v3: novos indicadores do perfil por local (até fundamental incompleto, eleitoras, 16 a 24 anos, 60 anos ou mais), em
 * quintis como a escolaridade; regras de v2 mantidas.
 * v4 (decisão de Rafael): todos os indicadores em faixas fixas (`PLACE_GROUP_CUTS`), iguais em todos os recortes — quintis
 * davam sempre ~1/5 dos eleitores por grupo e limites que mudavam a cada recorte, sem definição estável.
 * v6 (decisões de Rafael, 31/10/2026): eleitores de 70 anos ou mais (voto facultativo), ao lado de 60+; e grupos por categoria
 * do setor do local: situação urbana ou rural e setor de favela ou comunidade urbana (método `categories`).
 */
// 2026 (`--year 2026`, 31/10/2026): os mesmos indicadores sobre os resultados, perfis e associação de 2026, em publicação própria.
const versionOf = (year: 2022 | 2026) => year === 2022 ? 'place-groups-2022-v6' : `place-groups-${year}-v1`;
type Input = { id: string; scope: string; metadata: { rounds?: Array<'1' | '2'>; level?: string; office?: string; uf?: string } };

/**
 * `banded`: SQL alternativo que já entrega a faixa (1–5) em `value` (uf, municipality_code, zone, code, value, weight; pode usar
 * $5 = perfil por local), usado pela análise de sensibilidade da associação local → setor; os valores observados ficam nulos.
 */
export async function compute(client: PoolClient, input: { results: string; profiles: string; tracts: string; numerators: Record<string, string>; office: string; uf: string | null; round: string; indicator: PlaceGroupIndicator; banded?: string }): Promise<PlaceGroups> {
  // Por setor do local (renda e categorias): só locais associados, com coordenada própria (ponto compartilhado indica ponto padrão).
  const tractJoin = `FROM polling_place_tracts t JOIN census_tract_context c ON c.batch_id=t.batch_id AND c.cd_setor=t.cd_setor
       JOIN polling_place_profiles pp ON pp.batch_id=$5 AND pp.uf=t.uf AND pp.municipality_code=t.municipality_code AND pp.zone=t.zone AND pp.place_code=t.place_code`;
  const tractWhere = `t.batch_id=$6 AND t.status='associated' AND t.shared_coordinate=0 AND pp.eligible > 0`;
  const byTract = input.indicator === 'income-median' || input.indicator === 'tract-situation' || input.indicator === 'tract-favela';
  const indicatorSql = input.banded ?? (input.indicator === 'income-median'
    ? `SELECT t.uf, t.municipality_code, t.zone, t.place_code AS code, c.responsible_income_median AS value, pp.eligible AS weight ${tractJoin}
       WHERE ${tractWhere} AND c.responsible_income_median IS NOT NULL`
    // Categorias: 1 = urbana / em favela; 2 = rural / fora de favela. Setor sem situação fica fora (não vira rural).
    : input.indicator === 'tract-situation'
    ? `SELECT t.uf, t.municipality_code, t.zone, t.place_code AS code, CASE c.situation WHEN 'Urbana' THEN 1 WHEN 'Rural' THEN 2 END AS value, pp.eligible AS weight ${tractJoin}
       WHERE ${tractWhere} AND c.situation IN ('Urbana', 'Rural')`
    : input.indicator === 'tract-favela'
    ? `SELECT t.uf, t.municipality_code, t.zone, t.place_code AS code, CASE WHEN f.cd_setor IS NULL THEN 2 ELSE 1 END AS value, pp.eligible AS weight ${tractJoin}
       LEFT JOIN favela_tracts f ON f.cd_setor=t.cd_setor WHERE ${tractWhere}`
    : `SELECT uf, municipality_code, zone, place_code AS code, (${input.numerators[input.indicator]}) * 100 / eligible AS value, eligible AS weight FROM polling_place_profiles WHERE batch_id=$5 AND eligible > 0`);
  const method = PLACE_GROUP_METHODS[input.indicator];
  // Faixas fixas: limite superior incluído; valores iguais ficam sempre na mesma faixa. Categorias: o valor já é o grupo.
  const cuts = PLACE_GROUP_CUTS[input.indicator];
  const groupSql = input.banded || method === 'categories' ? 'value::integer' : `CASE ${cuts.map((cut, index) => `WHEN value <= ${cut} THEN ${index + 1}`).join(' ')} ELSE ${cuts.length + 1} END`;
  const params = [input.results, Number(input.round), input.office, input.uf, input.profiles, ...(byTract && !input.banded ? [input.tracts] : [])];
  const rows = await client.query<{ kind: string; g: number; from: string | null; to: string | null; places: number | null; eligible: string | null; valid: string | null; blank: string | null; nulls: string | null; total: string | null; number: string | null; name: string | null; party: string | null; votes: string | null }>(`
    WITH ind AS (${indicatorSql}),
    base AS (SELECT p.result, ind.value, ind.weight, p.uf, p.municipality_code, p.zone, p.code FROM national_place_results p
      JOIN ind ON ind.uf=p.uf AND ind.municipality_code=p.municipality_code AND ind.zone=p.zone AND ind.code=p.code
      WHERE p.batch_id=$1 AND p.round=$2 AND p.office=$3 AND p.uf<>'ZZ' AND ($4::text IS NULL OR p.uf=$4)),
    grouped AS (SELECT *, ${groupSql} AS g FROM base)
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
    const limits = method === 'categories' ? { lower: null, upper: null } : placeGroupLimits(input.indicator, row.g);
    const valued = !input.banded && method !== 'categories';
    return { index: row.g, from: valued ? Number(row.from) : null, to: valued ? Number(row.to) : null, ...limits, places: row.places!, eligible: Number(row.eligible), valid, blank: Number(row.blank), null: Number(row.nulls), totalVotes: Number(row.total), candidates };
  });
  return placeGroupsSchema.parse({ status: 'published', indicator: input.indicator, method, office: input.office, round: input.round, uf: input.uf,
    groups, coverage: { places: coverage.rows[0]!.places, placesInGroups: groups.reduce((sum, group) => sum + group.places, 0), totalVotes: Number(coverage.rows[0]!.total), votesInGroups: groups.reduce((sum, group) => sum + group.totalVotes, 0) } });
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const { values: args } = parseArgs({ options: { year: { type: 'string', default: '2022' } } });
  if (!(ELECTION_YEARS as readonly string[]).includes(args.year!)) throw new Error(`Uso: --year ${ELECTION_YEARS.join('|')}`);
  const YEAR = Number(args.year) as 2022 | 2026;
  const VERSION = versionOf(YEAR), SCOPE = `${YEAR}/places/groups`;
  const started = performance.now();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'migrations/011-place-groups.sql'), 'utf8'));
    const published = (await client.query<Input>("SELECT id, scope, metadata FROM import_batches WHERE published AND (scope=$1 || '/president/BR' OR scope LIKE $1 || '/governor/%' OR scope LIKE $1 || '/senator/%' OR scope IN ($1 || '/places/profiles', $1 || '/places/tracts'))", [String(YEAR)])).rows;
    const profiles = published.find((row) => row.scope === `${YEAR}/places/profiles`); const tracts = published.find((row) => row.scope === `${YEAR}/places/tracts`);
    if (!profiles || !tracts) throw new Error('Perfil por local e associação aos setores precisam estar publicados.');
    // Numerador de cada indicador percentual: soma das categorias do perfil por local, pelas posições guardadas na publicação.
    const order = placeProfilesDatasetSchema.parse(profiles.metadata).order;
    const numerators = Object.fromEntries(Object.entries(PLACE_GROUP_NUMERATORS).map(([indicator, { dimension, keys }]) => {
      const positions = keys.map((key) => { const index = order[dimension]!.indexOf(key); if (index < 0) throw new Error(`${indicator}: categoria ${dimension}/${key} ausente no perfil por local.`); return index; });
      return [indicator, positions.map((index) => `(counts->'${dimension}'->>${index})::numeric`).join(' + ')];
    }));
    const recortes: Array<{ results: string; office: string; uf: string | null; round: string }> = [];
    for (const batch of published.filter((row) => !row.scope.startsWith(`${YEAR}/places/`))) {
      const [, office, territory] = batch.scope.split('/') as [string, string, string];
      const rounds = batch.metadata.rounds ?? ['1', '2'];
      for (const round of rounds) for (const uf of territory === 'BR' ? [null, ...STATES] : [territory]) recortes.push({ results: batch.id, office, uf, round });
    }
    if (!recortes.length) throw new Error('Nenhum recorte eleitoral publicado; importação bloqueada.');
    // Situação do setor: só "Urbana" e "Rural" viram grupo; outro valor da fonte bloqueia (não é tratado como uma das duas).
    const situations = (await client.query<{ situation: string | null }>('SELECT DISTINCT situation FROM census_tract_context WHERE batch_id=$1', [tracts.id])).rows.map((row) => row.situation ?? '');
    const unexpected = situations.filter((value) => !['Urbana', 'Rural', ''].includes(value));
    if (unexpected.length) throw new Error(`Situação de setor não auditada: ${unexpected.join(', ')}. Publicação bloqueada.`);
    // Setores de favela ou comunidade urbana: nome da favela no arquivo básico por setor (o mesmo original de `sectors.ts`).
    const basic = await preservedDownload('agregados_setores_basico', `${IBGE}/Agregados_por_Setor_csv/Agregados_por_setores_basico_BR_20260520.zip`, 'setores', 'Agregados_por_setores_basico_BR_20260520.zip', [], 'zip');
    const entry = entries(basic.path).find((name) => name.toLowerCase().endsWith('.csv'));
    if (!entry) throw new Error('Agregados básicos sem CSV.');
    const favela: string[] = []; let basicRows = 0;
    for await (const row of csvRows(basic.path, entry)) { basicRows++; if (!/^\d{15}$/.test(row.CD_SETOR ?? '')) throw new Error(`Setor inválido: ${row.CD_SETOR}.`); if ((row.NM_FCU ?? '').trim()) favela.push(row.CD_SETOR!); }
    if (!favela.length) throw new Error('Nenhum setor de favela no arquivo básico; publicação bloqueada.');
    await client.query('DROP TABLE IF EXISTS favela_tracts');
    await client.query('CREATE TEMP TABLE favela_tracts (cd_setor text PRIMARY KEY)');
    for (let start = 0; start < favela.length; start += 10_000) await client.query('INSERT INTO favela_tracts SELECT unnest($1::text[])', [favela.slice(start, start + 10_000)]);
    const inputs = canonicalInputs(published);
    const id = publicationId(VERSION, [basic.source.sha256], inputs);
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { console.log(`Já publicado: ${id}.`); return; }
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, SCOPE, { kind: 'place-groups', pending: true }]);
      await client.query('DELETE FROM place_groups WHERE batch_id=$1', [id]);
      let done = 0;
      for (const recorte of recortes) for (const indicator of Object.keys(PLACE_GROUP_INDICATORS) as PlaceGroupIndicator[]) {
        const result = await compute(client, { ...recorte, profiles: profiles.id, tracts: tracts.id, numerators, indicator });
        await client.query('INSERT INTO place_groups VALUES($1,$2,$3,$4,$5,$6,$7)', [id, recorte.results, recorte.office, recorte.uf ?? 'BR', Number(recorte.round), indicator, result]);
        if (++done % 50 === 0) console.log(`${done} recortes calculados.`);
      }
      const dataset = { kind: 'place-groups', id, importerVersion: VERSION, inputs, importedAt: new Date().toISOString(), recortes: done,
        scope: 'Métrica E: locais agrupados pelo perfil declarado dos seus eleitores (TSE: superior completo, até fundamental incompleto, eleitoras, 16 a 24 anos, 60 anos ou mais e 70 anos ou mais) ou pelo setor censitário do local (IBGE: rendimento mediano do responsável, em salários mínimos de 2022; situação urbana ou rural; favela ou comunidade urbana), em faixas fixas iguais em todos os recortes ou nas categorias do setor, com votos somados por grupo.',
        sources: [{ ...basic.source, rowsRead: basicRows, rowsSelected: favela.length }],
        notes: [`Setores de favela ou comunidade urbana: ${favela.length.toLocaleString('pt-BR')} setores com nome de favela no arquivo básico por setor do Censo 2022 (${basicRows.toLocaleString('pt-BR')} setores lidos).`,
          'Situação e favela são do setor que contém o ponto do local no cadastro do TSE, com os mesmos locais da renda (associados, com coordenada própria); o endereço do local não indica onde os eleitores moram.'] };
      await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
      await preparePublication(client, { id, scope: SCOPE, inputs, report: { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000) } });
      await client.query('COMMIT');

      console.log(JSON.stringify({ published: id, scope: SCOPE, recortes: done, elapsedSeconds: Math.round((performance.now() - started) / 1000) }));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { client.release(); await pool.end(); }
}
if (require.main === module) run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Grupos de locais falharam.'); process.exitCode = 1; });
