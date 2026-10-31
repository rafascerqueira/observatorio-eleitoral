import { reusePublished, publicationId, publishedInputs, preparePublication } from './publication';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { censusIndicatorsDatasetSchema, censusIndicatorsSchema, FAVELA_STATUSES, type CensusIndicators, type CensusShare, type CensusTheme } from '@observatorio/contracts';
import { entries, rows } from './csv';
import { ROOT } from './sources';
import { preservedDownload, sidraValue, type PreservedSource } from './sidra';
import { buildDistribution, categoryKey, DISABILITY, DISABILITY_TYPES, DISTRIBUTIONS, FAVELA, FAVELA_DIVERGENCES, favelaStatus, MIGRATION, sliceCount, sliceValue, specCoverageErrors, ufTolerance, type Kind, type Slice } from './census-indicators-model';

/**
 * Indicadores do Censo 2022 pela idade de voto (docs/plano-indicadores-censo-2022.md): 23 tabelas da SIDRA por município, em
 * consultas por UF preservadas como originais (formato `/f/c`, só códigos; os nomes vêm dos metadados preservados de cada
 * tabela). Cada distribuição usa a base da própria tabela; os recortes de idade são somas e subtrações de faixas da fonte.
 * Conferências que bloqueiam: categorias × total (universo exato; amostra dentro do arredondamento), soma dos municípios × UF,
 * 16+ e total da 9606 × contexto municipal publicado, pesos comuns da amostra e favelas × agregados por setor.
 */
const VERSION = 'census-indicators-2022-v1';
const SCOPE = '2022/context/census-indicators';
const LIMIT = 40_000;
const CONCURRENCY = 4;
// Agregados por setor do Censo 2022 (mesmo original de `sectors.ts`, reaproveitado pelos bytes).
const IBGE = 'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios';
type Metadata = { id: number; nome: string; variaveis: Array<{ id: number; nome: string }>; classificacoes: Array<{ id: number; nome: string; categorias: Array<{ id: number; nome: string }> }> };
type TableQuery = { table: number; kind: Kind; variables: Set<number>; dims: Map<string, Set<string>> };

function tableQueries() {
  const queries = new Map<number, TableQuery>();
  const add = (table: number, kind: Kind, variables: number[], dims: Record<string, string[]>) => {
    const query = queries.get(table) ?? { table, kind, variables: new Set(), dims: new Map() };
    if (query.kind !== kind) throw new Error(`Tabela ${table} com dois tipos de fonte.`);
    variables.forEach((variable) => query.variables.add(variable));
    for (const [dim, cats] of Object.entries(dims)) { const set = query.dims.get(dim) ?? new Set(); cats.forEach((cat) => set.add(cat)); query.dims.set(dim, set); }
    queries.set(table, query);
  };
  const ages = (slices: Record<string, Slice>) => [...new Set(Object.values(slices).flatMap((slice) => [...slice.plus, ...(slice.minus ?? [])]))];
  for (const spec of DISTRIBUTIONS) {
    add(spec.table, spec.kind, [spec.variable], { [spec.dimension]: [spec.total ?? 'Total', ...spec.categories], ...(spec.age ? { [spec.age]: ages(spec.slices) } : {}), ...Object.fromEntries(spec.fixed.map((dim) => [dim, ['Total']])) });
  }
  add(DISABILITY.table, 'amostra', [DISABILITY.numerator, DISABILITY.denominator], { [DISABILITY.age]: ages(DISABILITY.slices), ...Object.fromEntries(DISABILITY.fixed.map((dim) => [dim, ['Total']])) });
  add(DISABILITY_TYPES.table, 'amostra', [DISABILITY_TYPES.numerator, DISABILITY_TYPES.denominator], { [DISABILITY_TYPES.dimension]: ['Total', ...DISABILITY_TYPES.categories] });
  add(MIGRATION.table, 'amostra', [MIGRATION.variable], { [MIGRATION.age]: ages(MIGRATION.slices), ...Object.fromEntries(MIGRATION.fixed.map((dim) => [dim, ['Total']])) });
  add(FAVELA.table, 'universo', [FAVELA.variable], { [FAVELA.age]: ages({ x: FAVELA.slice }), ...Object.fromEntries(FAVELA.fixed.map((dim) => [dim, ['Total']])) });
  add(FAVELA.countTable, 'universo', [FAVELA.countVariable], {});
  return [...queries.values()].sort((a, b) => a.table - b.table);
}

/** Caminhos da API de valores, divididos pela maior classificação até caber no limite de valores por consulta. */
function paths(query: TableQuery, ids: Map<string, Map<string, number>>, classIds: Map<string, number>, locality: string, locations: number) {
  const dims = [...query.dims].map(([dim, cats]) => ({ id: classIds.get(dim)!, cats: [...cats].map((cat) => ids.get(dim)!.get(cat)!) }));
  const size = locations * query.variables.size * dims.reduce((product, dim) => product * dim.cats.length, 1);
  const chunks = Math.max(1, Math.ceil(size / LIMIT));
  const big = dims.length ? dims.reduce((best, dim, index) => dim.cats.length > dims[best]!.cats.length ? index : best, 0) : -1;
  return Array.from({ length: chunks }, (_, k) => {
    const cls = dims.map((dim, index) => {
      const cats = index === big && chunks > 1 ? dim.cats.slice(k * Math.ceil(dim.cats.length / chunks), (k + 1) * Math.ceil(dim.cats.length / chunks)) : dim.cats;
      return cats.length ? `/c${dim.id}/${cats.join(',')}` : null;
    });
    return cls.includes(null) ? null : `/t/${query.table}/${locality}/v/${[...query.variables].join(',')}/p/2022${cls.join('')}/f/c`;
  }).filter((path): path is string => path !== null);
}

async function pool<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (next < items.length) { const index = next++; results[index] = await worker(items[index]!); } }));
  return results;
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const coverage = specCoverageErrors();
  if (coverage.length) throw new Error(`Especificação incompleta: ${coverage.join('; ')}`);
  const started = performance.now();
  const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await db.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    const inputs = await publishedInputs(client, ['2022/context/municipal']);
    await client.query(await readFile(resolve(__dirname, 'migrations/021-census-indicators.sql'), 'utf8'));
    const context = (await client.query<{ ibge_code: string; uf: string; code: string; name: string; total: number | null; age16plus: number | null }>(`SELECT c.ibge_code, c.uf, c.code, c.result->>'name' AS name,
      (c.result->'population'->>'total')::bigint::int AS total, (c.result->'population'->>'age16plus')::bigint::int AS age16plus
      FROM municipality_context c JOIN import_batches b ON b.id=c.batch_id AND b.published AND b.scope='2022/context/municipal' ORDER BY c.ibge_code`)).rows;
    if (context.length !== 5570) throw new Error(`Contexto municipal com ${context.length} municípios; esperados 5.570.`);
    const munis = new Map(context.map((row) => [row.ibge_code, row]));
    const ufCodes = [...new Set(context.map((row) => row.ibge_code.slice(0, 2)))].sort();
    const perUf = new Map(ufCodes.map((uf) => [uf, context.filter((row) => row.ibge_code.startsWith(uf)).length]));

    // 1. Metadados preservados: nomes ↔ códigos; classificação nova ou categoria ausente bloqueia.
    const queries = tableQueries();
    const sources: PreservedSource[] = [];
    const meta = new Map<number, { classIds: Map<string, number>; ids: Map<string, Map<string, number>>; names: Map<number, Map<string, string>> }>();
    for (const query of queries) {
      const download = await preservedDownload(`cdi_meta_${query.table}`, `https://servicodados.ibge.gov.br/api/v3/agregados/${query.table}/metadados`, 'sidra', `metadados da tabela ${query.table}`);
      const metadata = JSON.parse((await download.read()).toString('utf8')) as Metadata;
      sources.push({ ...download.source, rowsRead: 1, rowsSelected: 1 });
      if (metadata.id !== query.table) throw new Error(`Metadados da tabela ${query.table} trazem ${metadata.id}.`);
      for (const variable of query.variables) if (!metadata.variaveis.some((item) => item.id === variable)) throw new Error(`Tabela ${query.table}: variável ${variable} ausente.`);
      const unknown = metadata.classificacoes.filter((item) => !query.dims.has(item.nome)).map((item) => item.nome);
      if (unknown.length) throw new Error(`Tabela ${query.table}: classificações não auditadas (${unknown.join(', ')}). Publicação bloqueada.`);
      const classIds = new Map<string, number>(), ids = new Map<string, Map<string, number>>(), names = new Map<number, Map<string, string>>();
      for (const [dim, cats] of query.dims) {
        const item = metadata.classificacoes.find((entry) => entry.nome === dim);
        if (!item) throw new Error(`Tabela ${query.table}: classificação ${dim} ausente.`);
        classIds.set(dim, item.id);
        const byName = new Map<string, number>();
        for (const cat of cats) {
          const found = item.categorias.filter((entry) => entry.nome === cat);
          if (found.length !== 1) throw new Error(`Tabela ${query.table}: categoria "${cat}" de ${dim} ${found.length ? 'repetida' : 'ausente'}.`);
          byName.set(cat, found[0]!.id);
        }
        ids.set(dim, byName); names.set(item.id, new Map(item.categorias.map((entry) => [String(entry.id), entry.nome])));
      }
      meta.set(query.table, { classIds, ids, names });
    }

    // 2. Consultas por UF (municípios) e por UF agregada, preservadas. Células indexadas por variável e categorias.
    type Job = { table: number; name: string; path: string; level: 'mun' | 'uf' };
    const jobs: Job[] = [];
    for (const query of queries) {
      const { ids, classIds } = meta.get(query.table)!;
      for (const uf of ufCodes) paths(query, ids, classIds, `n6/in%20n3%20${uf}`, perUf.get(uf)!).forEach((path, k) => jobs.push({ table: query.table, name: `cdi_${query.table}_${uf}_${k}`, path, level: 'mun' }));
      paths(query, ids, classIds, 'n3/all', ufCodes.length).forEach((path, k) => jobs.push({ table: query.table, name: `cdi_${query.table}_uf_${k}`, path, level: 'uf' }));
    }
    console.log(`${queries.length} tabelas, ${jobs.length} consultas.`);
    const cells = new Map<number, { mun: Map<string, Map<string, number | null>>; uf: Map<string, Map<string, number | null>> }>(queries.map((query) => [query.table, { mun: new Map(), uf: new Map() }]));
    let done = 0;
    const downloaded = await pool(jobs, async (job) => {
      const download = await preservedDownload(job.name, `https://apisidra.ibge.gov.br/values${job.path}`, 'sidra', job.path);
      if (++done % 100 === 0) console.log(`${done}/${jobs.length} consultas`);
      return { job, download, body: JSON.parse((await download.read()).toString('utf8')) as Array<Record<string, string>> };
    });
    for (const { job, download, body } of downloaded) {
      if (!Array.isArray(body) || body.length < 2) throw new Error(`${job.name}: resposta vazia ou sem cabeçalho.`);
      const header = body[0]!; const { names } = meta.get(job.table)!;
      const columns = Object.keys(header).filter((key) => /^D\d+C$/.test(key));
      const label = (key: string) => header[key]!.replace(/ \(Código\)$/, '');
      const variableColumn = columns.find((key) => label(key) === 'Variável'), yearColumn = columns.find((key) => label(key) === 'Ano');
      const dimColumns = columns.filter((key) => key !== 'D1C' && key !== variableColumn && key !== yearColumn).map((key) => ({ key, id: [...meta.get(job.table)!.classIds].find(([dim]) => dim === label(key))?.[1] }));
      if (!variableColumn || dimColumns.some((column) => column.id === undefined)) throw new Error(`${job.name}: cabeçalho inesperado.`);
      const target = cells.get(job.table)![job.level];
      for (const row of body.slice(1)) {
        if (row[yearColumn!] !== '2022') throw new Error(`${job.name}: ano ${row[yearColumn!]}.`);
        const parts = dimColumns.map((column) => { const name = names.get(column.id!)!.get(row[column.key]!); if (!name) throw new Error(`${job.name}: categoria ${row[column.key]} desconhecida.`); return `${label(column.key)}=${name}`; }).sort();
        const key = [row[variableColumn]!, ...parts].join('|');
        const loc = target.get(row.D1C!) ?? new Map<string, number | null>();
        if (loc.has(key)) throw new Error(`${job.name}: célula repetida (${row.D1C} ${key}). Publicação bloqueada.`);
        loc.set(key, sidraValue(row.V)); target.set(row.D1C!, loc);
      }
      sources.push({ ...download.source, rowsRead: body.length - 1, rowsSelected: body.length - 1 });
    }

    // 3. Cobertura: todos os municípios do contexto em todas as tabelas, exceto as de favelas (só municípios com favela).
    for (const query of queries) {
      const present = cells.get(query.table)!.mun;
      const extra = [...present.keys()].filter((code) => !munis.has(code));
      if (extra.length) throw new Error(`Tabela ${query.table}: municípios fora do contexto (${extra.slice(0, 5).join(', ')}).`);
      if (query.table !== FAVELA.table && query.table !== FAVELA.countTable && present.size !== munis.size) throw new Error(`Tabela ${query.table}: ${present.size} municípios; esperados ${munis.size}.`);
    }
    const dimsOf = (table: number) => [...queries.find((query) => query.table === table)!.dims.keys()];
    /** Célula obrigatória: classificações omitidas valem "Total"; ausência estrutural bloqueia. */
    const cell = (table: number, code: string, variable: number, cats: Record<string, string> = {}) => {
      const key = [String(variable), ...dimsOf(table).map((dim) => `${dim}=${cats[dim] ?? 'Total'}`).sort()].join('|');
      const loc = cells.get(table)!.mun.get(code);
      if (!loc?.has(key)) throw new Error(`Tabela ${table}, ${code}: célula ausente (${key}). Publicação bloqueada.`);
      return loc.get(key)!;
    };

    // 4. Soma dos municípios × valor da UF.
    const ufChecks = queries.map((query) => {
      const data = cells.get(query.table)!; let compared = 0, exact = 0, maxAbsDifference = 0;
      for (const [uf, ufCells] of data.uf) {
        const codes = [...data.mun.keys()].filter((code) => code.startsWith(uf));
        for (const [key, value] of ufCells) {
          const parts = codes.map((code) => data.mun.get(code)!.get(key));
          if (value === null || parts.some((part) => part === null || part === undefined) && query.table !== FAVELA.table && query.table !== FAVELA.countTable) continue;
          const sum = parts.reduce<number>((total, part) => total + (part ?? 0), 0);
          const difference = Math.abs(sum - value); compared++; if (!difference) exact++; maxAbsDifference = Math.max(maxAbsDifference, difference);
          if (difference > ufTolerance(query.kind, perUf.get(uf)!)) throw new Error(`Tabela ${query.table}, UF ${uf}: municípios somam ${sum}, UF ${value} (${key}). Publicação bloqueada.`);
        }
      }
      if (!compared) throw new Error(`Tabela ${query.table}: nenhuma célula da UF conferida.`);
      return { table: query.table, kind: query.kind, cells: compared, exact, maxAbsDifference };
    });

    // 5. Favelas nos agregados por setor (moradores em setor com nome de favela ou comunidade urbana).
    const basic = await preservedDownload('agregados_setores_basico', `${IBGE}/Agregados_por_Setor_csv/Agregados_por_setores_basico_BR_20260520.zip`, 'setores', 'Agregados_por_setores_basico_BR_20260520.zip', [], 'zip');
    const favelaTracts = new Set<string>(); let basicRows = 0;
    const entry = entries(basic.path).find((name) => name.toLowerCase().endsWith('.csv'));
    if (!entry) throw new Error('Agregados básicos sem CSV.');
    for await (const row of rows(basic.path, entry)) { basicRows++; if ((row.NM_FCU ?? '').trim()) favelaTracts.add(row.CD_MUN!); }
    sources.push({ ...basic.source, rowsRead: basicRows, rowsSelected: basicRows });

    // 6. Indicadores por município, com as travas.
    const items: CensusIndicators[] = []; const favelaTotals = Object.fromEntries(FAVELA_STATUSES.map((status) => [status, 0])) as Record<typeof FAVELA_STATUSES[number], number>;
    let undistributedRace = 0, maxWeightDifference = 0;
    const share = (kind: Kind, source: string, numerator: number | null, denominator: number | null): CensusShare => ({ kind, source, numerator, denominator });
    for (const row of context) {
      const code = row.ibge_code; const label = `${row.uf}/${row.code} (IBGE ${code})`;
      const distributions = {} as Record<CensusTheme, Record<string, ReturnType<typeof buildDistribution>>>;
      for (const spec of DISTRIBUTIONS) {
        distributions[spec.theme] = {};
        for (const [name, slice] of Object.entries(spec.slices)) {
          const value = (category: string) => sliceValue(slice, (age) => cell(spec.table, code, spec.variable, { [spec.dimension]: category, ...(spec.age && age ? { [spec.age]: age } : {}) }));
          distributions[spec.theme][name] = buildDistribution(spec, value(spec.total ?? 'Total'), spec.categories.map((category) => ({ label: category, value: value(category) })), sliceCount(slice), `${label}: ${spec.theme} ${name}`);
        }
      }
      const race = distributions.race;
      if (race['16+']!.total !== row.age16plus) throw new Error(`${label}: 16+ da 9606 (${race['16+']!.total}) ≠ contexto municipal (${row.age16plus}).`);
      if (cell(9606, code, 93, {}) !== row.total || cell(10089, code, 93, {}) !== row.total) throw new Error(`${label}: população total da 9606/10089 ≠ contexto municipal.`);
      if (distributions.literacy['16+']!.total! + cell(9542, code, 950, { Idade: '15 anos' })! !== race['15+']!.total) throw new Error(`${label}: 15+ da 9542 ≠ 15+ da 9606.`);
      undistributedRace += race['16+']!.undistributed ? 1 : 0;
      const age15 = cell(9606, code, 93, { Idade: '15 anos' });
      // Pesos comuns da amostra: 15+ e 70+ da religião (denominador da migração) × deficiência.
      const disability = Object.fromEntries((['15+', '70+'] as const).map((name) => {
        const slice = DISABILITY.slices[name];
        return [name, share('amostra', 'IBGE, Censo 2022 — SIDRA 10125 (pessoas com deficiência; estimativa da amostra)',
          sliceValue(slice, (age) => cell(DISABILITY.table, code, DISABILITY.numerator, { [DISABILITY.age]: age! })), sliceValue(slice, (age) => cell(DISABILITY.table, code, DISABILITY.denominator, { [DISABILITY.age]: age! })))];
      })) as Record<'15+' | '70+', CensusShare>;
      for (const name of ['15+', '70+'] as const) {
        const difference = Math.abs(disability[name].denominator! - distributions.religion[name]!.total!);
        maxWeightDifference = Math.max(maxWeightDifference, difference);
        if (difference > sliceCount(DISABILITY.slices[name]) + sliceCount(MIGRATION.slices[name])) throw new Error(`${label}: ${name} da amostra difere entre 10125 e 9537 (${difference}); pesos comuns não confirmados.`);
      }
      const typeDenominator = cell(DISABILITY_TYPES.table, code, DISABILITY_TYPES.denominator, { [DISABILITY_TYPES.dimension]: 'Total' });
      if (cell(DISABILITY_TYPES.table, code, DISABILITY_TYPES.numerator, { [DISABILITY_TYPES.dimension]: 'Total' }) !== cell(DISABILITY.table, code, DISABILITY.numerator, { [DISABILITY.age]: 'Total' })) throw new Error(`${label}: pessoas com deficiência da 10127 ≠ 10125.`);
      const types = DISABILITY_TYPES.categories.map((category) => ({ key: categoryKey(category), label: category,
        ...share('amostra', 'IBGE, Censo 2022 — SIDRA 10127 (pessoas de 2 anos ou mais; a fonte não separa por idade; estimativa da amostra)', cell(DISABILITY_TYPES.table, code, DISABILITY_TYPES.numerator, { [DISABILITY_TYPES.dimension]: category }), typeDenominator) }));
      const migration = Object.fromEntries((['15+', '70+'] as const).map((name) => [name, share('amostra', 'IBGE, Censo 2022 — SIDRA 10160 ÷ 9537 (não moravam no município 5 anos antes; denominador da mesma amostra)',
        sliceValue(MIGRATION.slices[name], (age) => cell(MIGRATION.table, code, MIGRATION.variable, { [MIGRATION.age]: age! })), distributions.religion[name]!.total)])) as Record<'15+' | '70+', CensusShare>;
      const inSidra = cells.get(FAVELA.table)!.mun.has(code);
      if (inSidra !== cells.get(FAVELA.countTable)!.mun.has(code)) throw new Error(`${label}: favelas presentes em só uma das tabelas 9883/9884.`);
      const status = favelaStatus(code, inSidra, favelaTracts.has(code)); favelaTotals[status]++;
      const favelaSource = 'IBGE, Censo 2022 — SIDRA 9884 ÷ 9606 (moradores de 15 anos ou mais em favelas e comunidades urbanas; universo)';
      const favela = status === 'present' ? { status, favelas: cell(FAVELA.countTable, code, FAVELA.countVariable), '15+': share('universo', favelaSource, sliceValue(FAVELA.slice, (age) => cell(FAVELA.table, code, FAVELA.variable, { [FAVELA.age]: age! })), race['15+']!.total) }
        : status === 'not-delimited' ? { status, favelas: 0, '15+': share('universo', favelaSource, 0, race['15+']!.total) }
        : { status, favelas: null, '15+': null, note: FAVELA_DIVERGENCES[code]! };
      items.push(censusIndicatorsSchema.parse({ ibgeCode: code, code: row.code, uf: row.uf, name: row.name, age15: { age15, age15plus: race['15+']!.total }, distributions, disability: { ...disability, types }, migration, favela }));
    }

    // 7. Publicação atômica, idempotente pelos originais.
    const id = publicationId(VERSION, sources.map((source) => source.sha256), inputs);
    for (const source of sources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes ?? 0]);
    // Células derivadas (migração 022): leitura rápida por tema e recorte na API; idempotente, recalculada se faltar.
    const cellsFor = async (batch: string) => {
      const exists = (await client.query<{ registry: string | null }>("SELECT to_regclass('public.census_indicator_cells')::text AS registry")).rows[0]?.registry;
      if (exists && (await client.query('SELECT 1 FROM census_indicator_cells WHERE batch_id=$1 LIMIT 1', [batch])).rows.length) return;
      await client.query(await readFile(resolve(__dirname, 'migrations/022-census-indicator-cells.sql'), 'utf8'));
      const derived = (await client.query<{ n: number }>("SELECT count(*)::int AS n FROM census_indicator_cells WHERE batch_id=$1 AND theme='race' AND slice='16+'", [batch])).rows[0]!;
      if (derived.n !== 5570) throw new Error(`Células derivadas incompletas (${derived.n} municípios).`);
    };
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { await cellsFor(id); console.log(`Já publicado: ${id}. Nenhuma duplicação.`); return; }
    const sizes = sources.reduce((sum, source) => sum + (source.sizeBytes ?? 0), 0);
    const dataset = censusIndicatorsDatasetSchema.parse({ id, kind: 'census-indicators', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, inputs, sources,
      scope: 'Indicadores do Censo 2022 por município pela idade de voto: cor ou raça, religião, escolaridade, alfabetização, trabalho, internet e moradia, saneamento, urbano × rural, favelas, deficiência e migração (SIDRA, 23 tabelas), cada um com a base da própria tabela.',
      totals: { municipalities: items.length, queries: jobs.length, favela: favelaTotals }, ufChecks,
      notes: [
        'Base de idade: 16 anos ou mais quando a tabela permite (cor ou raça, alfabetização), com 16–17, 18–69 e 70+; 18+ na instrução; 18–69 e 70+ no trabalho; 14+ (definição do IBGE) onde a tabela não tem idade.',
        'Recorte 15+ só onde a tabela agrupa 15–19 anos; a parcela entre 15+ difere da parcela entre 16+ em no máximo (pessoas de 15 anos ÷ 15+) × 100 pontos percentuais, guardado por município (`age15`). Nada é estimado ou reponderado.',
        'Amostra com denominador da amostra: a amostra não fecha com o universo por idade. A migração (10160, sem total próprio) usa o 15+ e o 70+ da 9537, da mesma amostra; os pesos comuns são conferidos contra a 10125 em cada município (maior diferença: ' + maxWeightDifference + ' pessoa(s)).',
        'Recortes de idade são somas e subtrações das faixas da fonte; na amostra, o limite do arredondamento multiplica-se pelo número de recortes combinados (`slices`).',
        `Cor ou raça (9606): em ${undistributedRace.toLocaleString('pt-BR')} municípios o total de 16+ supera a soma das cinco categorias; a diferença fica como não discriminada, sem redistribuição.`,
        '"Empregado no setor público" é a categoria de primeiro nível da fonte, que não inclui militares nem empregados de empresas estatais (categorias próprias).',
        `Favelas: ${favelaTotals.present} municípios nas tabelas 9883/9884; ${favelaTotals['not-delimited'].toLocaleString('pt-BR')} ausentes delas e sem setor de favela nos agregados por setor (zero conferido); ${favelaTotals.divergent} com fontes em desacordo, sem valor (${Object.values(FAVELA_DIVERGENCES).join(' ')})`,
        `Originais: ${jobs.length} consultas no formato só de códigos (/f/c) e os metadados de cada tabela, ${(sizes / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MB.`,
      ] });
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, dataset]);
      await client.query('DELETE FROM census_indicators WHERE batch_id=$1', [id]);
      for (let start = 0; start < items.length; start += 500) {
        await client.query('INSERT INTO census_indicators SELECT $1, x."ibgeCode", x.uf, x.code, x.result FROM jsonb_to_recordset($2::jsonb) AS x("ibgeCode" text, uf text, code text, result jsonb)',
          [id, JSON.stringify(items.slice(start, start + 500).map((item) => ({ ibgeCode: item.ibgeCode, uf: item.uf, code: item.code, result: item })))]);
      }
      const stored = (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM census_indicators WHERE batch_id=$1', [id])).rows[0]!;
      if (stored.n !== items.length) throw new Error('Indicadores gravados não conferem.');
      await preparePublication(client, { id, scope: SCOPE, inputs, report: { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000) } });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    await cellsFor(id);
    console.log(JSON.stringify({ published: id, scope: SCOPE, totals: dataset.totals, ufChecks, originalsBytes: sizes, elapsedSeconds: Math.round((performance.now() - started) / 1000) }, null, 2));
  } finally { client.release(); await db.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Indicadores do Censo falharam.'); process.exitCode = 1; });
