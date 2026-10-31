import { reusePublished, publicationId, publishedInputs, preparePublication } from './publication';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { ageGroupOf, ELECTION_YEARS, optionalVoter, STATES, TURNOUT_CELL_ORDER, turnoutProfilesDatasetSchema, type TurnoutRound } from '@observatorio/contracts';
import { parseArgs } from 'node:util';
import { count, entries, rows } from './csv';
import { assertEqual } from './model';
import { ROOT, sourceFile } from './sources';
import { tseCategory } from './context-model';
import { municipalityCode } from './territory';

/**
 * Comparecimento e abstenção por perfil (TSE, base própria, declarada), cruzados por gênero × faixa etária × escolaridade, por
 * UF e turno. Contagens exatas da fonte, não ecológicas; nenhum voto por candidatura (o voto é secreto). Mesma fonte do contexto
 * municipal, que guarda só as marginais por município; os totais por UF precisam coincidir com ele.
 *
 * v2: acrescenta o estado civil ao cruzamento e guarda também cada município (não só a UF), com as faixas etárias já nos grupos
 * por obrigatoriedade (`AGE_GROUPS`, que não misturam voto facultativo e obrigatório). Cada município e turno confere, em totais
 * e em cada marginal (gênero, faixa etária, escolaridade e estado civil), com o contexto municipal publicado.
 */
/*
 * 2026 (`--year 2026`, decisão de Rafael de 31/10/2026): mesmo cruzamento, publicação própria. O arquivo de 2026 traz só o
 * 1º turno (gerado em 13/10/2026), inclui o DF e chama a escolaridade de `DS_GRAU_INSTRUCAO`. Não há contexto municipal de 2026
 * da mesma fonte: em vez das marginais, cada município confere com a lista de municípios dos resultados de 2026, e as
 * identidades de cada linha valem como em 2022.
 */
const versionOf = (year: 2022 | 2026) => year === 2022 ? 'turnout-profiles-2022-v3' : `turnout-profiles-${year}-v1`;
const scopeOf = (year: 2022 | 2026) => `${year}/context/turnout-profiles`;
const DIMENSIONS = ['gender', 'age', 'education', 'maritalStatus'] as const;
type Dimension = typeof DIMENSIONS[number];
type Cube = Map<number, [number, number, number]>;
/** Chave numérica da célula: índices nas ordens de `TURNOUT_CELL_ORDER` (cada uma com menos de 16 categorias). */
const cellKey = (indices: number[]) => indices.reduce((key, index) => key * 16 + index, 0);
const cellIndices = (key: number) => DIMENSIONS.map((_, position) => Math.floor(key / 16 ** (DIMENSIONS.length - 1 - position)) % 16);
const indexOf = (dimension: Dimension, key: string) => { const index = (TURNOUT_CELL_ORDER[dimension] as readonly string[]).indexOf(key); if (index < 0) throw new Error(`Categoria sem posição (${dimension}): ${key}.`); return index; };
const add = (cube: Cube, key: number, cell: [number, number, number]) => { const current = cube.get(key) ?? [0, 0, 0]; current[0] += cell[0]; current[1] += cell[1]; current[2] += cell[2]; cube.set(key, current); };
const flatten = (cube: Cube) => [...cube].sort((a, b) => a[0] - b[0]).flatMap(([key, cell]) => [...cellIndices(key), ...cell]);

/** Confere um cubo municipal com as marginais do contexto municipal (mesma fonte): totais e cada categoria de cada dimensão. */
function checkMarginals(cube: Cube, context: TurnoutRound, label: string) {
  const totals = [...cube.values()].reduce((sum, cell) => [sum[0] + cell[0], sum[1] + cell[1], sum[2] + cell[2]], [0, 0, 0]);
  assertEqual(totals[0], context.eligible, `${label}: aptos`); assertEqual(totals[1], context.turnout, `${label}: comparecimento`); assertEqual(totals[2], context.abstentions, `${label}: abstenção`);
  for (const dimension of context.dimensions) {
    const position = DIMENSIONS.indexOf(dimension.dimension);
    const expected = new Map<string, [number, number, number]>();
    for (const category of dimension.categories) {
      const key = dimension.dimension === 'age' ? ageGroupOf(category.key) : category.key;
      const item = expected.get(key) ?? [0, 0, 0]; item[0] += category.eligible; item[1] += category.turnout; item[2] += category.abstentions; expected.set(key, item);
    }
    const found = new Map<string, [number, number, number]>();
    for (const [key, cell] of cube) {
      const category = TURNOUT_CELL_ORDER[dimension.dimension][cellIndices(key)[position]!]!;
      const item = found.get(category) ?? [0, 0, 0]; item[0] += cell[0]; item[1] += cell[1]; item[2] += cell[2]; found.set(category, item);
    }
    for (const key of new Set([...expected.keys(), ...found.keys()])) {
      const a = expected.get(key) ?? [0, 0, 0], b = found.get(key) ?? [0, 0, 0];
      if (a.some((value, index) => value !== b[index])) throw new Error(`${label} (${dimension.dimension}/${key}): contexto ${a.join('/')}, cubo ${b.join('/')}.`);
    }
  }
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const { values: args } = parseArgs({ options: { year: { type: 'string', default: '2022' } } });
  if (!(ELECTION_YEARS as readonly string[]).includes(args.year!)) throw new Error(`Uso: --year ${ELECTION_YEARS.join('|')}`);
  const YEAR = Number(args.year) as 2022 | 2026;
  const VERSION = versionOf(YEAR), SCOPE = scopeOf(YEAR);
  const started = performance.now();
  const file = YEAR === 2022
    ? await sourceFile({ file: 'perfil_comparecimento_abstencao_2022.zip', entry: 'perfil_comparecimento_abstencao_2022_<UF>.csv (26 UFs; sem DF na fonte)', directory: 'perfil_comparecimento_abstencao' })
    : await sourceFile({ file: `perfil_comparecimento_abstencao_${YEAR}.zip`, entry: `perfil_comparecimento_abstencao_${YEAR}_<UF>.csv (27 UFs; exterior não usado)`, directory: 'perfil_comparecimento_abstencao', year: YEAR });
  // Turnos e UFs auditados por ano: 2022 com os dois turnos e sem DF; 2026 só com o 1º turno, com as 27 UFs.
  const ROUNDS = (YEAR === 2022 ? ['1', '2'] : ['1']) as Array<'1' | '2'>;
  const AUDITED_MISSING = YEAR === 2022 ? 'DF' : '';
  const educationField = YEAR === 2022 ? 'DS_GRAU_ESCOLARIDADE' : 'DS_GRAU_INSTRUCAO';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const inputs = await publishedInputs(client, YEAR === 2022 ? ['2022/context/municipal', '2022/president/BR'] : [`${YEAR}/president/BR`]);
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'migrations/015-turnout-profile-cells.sql'), 'utf8'));
    const { path: _path, ...metadata } = file;
    const id = publicationId(VERSION, [metadata.sha256], inputs);
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { console.log(`Já publicado: ${id}.`); return; }

    // Contexto municipal publicado (marginais da mesma fonte) e aptos dos resultados da Presidência, por município e turno.
    // 2022: contexto municipal (marginais da mesma fonte). 2026: municípios dos resultados de 2026, sem marginais para conferir.
    const context = YEAR === 2022 ? await client.query<{ uf: string; code: string; name: string; turnout: Record<'1' | '2', TurnoutRound | null> | null }>(`SELECT c.uf, c.code, c.result->>'name' AS name, c.result->'turnout' AS turnout
      FROM municipality_context c JOIN import_batches b ON b.id=c.batch_id AND b.published AND b.scope='2022/context/municipal'`)
      : await client.query<{ uf: string; code: string; name: string; turnout: Record<'1' | '2', TurnoutRound | null> | null }>(`SELECT DISTINCT m.uf, m.code, m.result->>'name' AS name, NULL::jsonb AS turnout FROM municipality_results m
        JOIN import_batches b ON b.id=m.batch_id AND b.published AND b.scope=$1 WHERE m.office='president' AND m.uf<>'ZZ' AND m.round=1`, [`${YEAR}/president/BR`]);
    if (!context.rows.length) throw new Error('Contexto municipal precisa estar publicado.');
    const contextOf = new Map(context.rows.map((row) => [`${row.uf}/${row.code}`, row]));
    const results = await client.query<{ uf: string; code: string; round: number; eligible: string }>(`SELECT m.uf, m.code, m.round, (m.result->'totals'->>'eligible') AS eligible FROM municipality_results m
      JOIN import_batches b ON b.id=m.batch_id AND b.published AND b.scope=$1 WHERE m.office='president' AND m.uf<>'ZZ'`, [`${YEAR}/president/BR`]);
    const resultsEligible = new Map(results.rows.map((row) => [`${row.uf}/${row.code}/${row.round}`, Number(row.eligible)]));
    if (!resultsEligible.size) throw new Error('Resultados da Presidência por município precisam estar publicados.');

    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, { kind: 'turnout-profiles', pending: true }]);
      await client.query('DELETE FROM turnout_profile_cells WHERE batch_id=$1', [id]);
      const generated = new Set<string>(); let read = 0, municipalities = 0;
      const ufs: string[] = []; const totals = { '1': [0, 0, 0, 0], '2': [0, 0, 0, 0] };
      // Uma UF por arquivo: os cubos da UF ficam em memória só até serem conferidos e gravados.
      // O exterior (ZZ, só em 2026) não tem município brasileiro: fica fora, contado.
      let exteriorRows = 0, invalidAgeOptional = 0;
      for (const entry of entries(file.path).filter((name) => name.endsWith('.csv') && !name.includes('BRASIL') && !name.endsWith('_ZZ.csv'))) {
        const cubes = new Map<string, Cube>(); let entryUf: string | null = null;
        for await (const row of rows(file.path, entry)) {
          read++;
          if (!(STATES as readonly string[]).includes(row.SG_UF ?? '')) throw new Error(`UF não auditada no comparecimento: ${row.SG_UF}.`);
          if (entryUf && row.SG_UF !== entryUf) throw new Error(`${entry}: mais de uma UF no arquivo.`);
          entryUf = row.SG_UF!;
          if (!(ROUNDS as string[]).includes(row.NR_TURNO ?? '')) throw new Error(`Turno não auditado no comparecimento de ${YEAR}: ${row.NR_TURNO}.`);
          generated.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
          const eligible = count(row, 'QT_APTOS'), present = count(row, 'QT_COMPARECIMENTO'), absent = count(row, 'QT_ABSTENCAO');
          const code = municipalityCode(row.CD_MUNICIPIO!); const label = `${row.SG_UF}/${code}/${row.NR_ZONA}`;
          assertEqual(present + absent, eligible, `${label}: comparecimento + abstenção = aptos`);
          assertEqual(count(row, 'QT_COMPAREC_FACULTATIVO') + count(row, 'QT_COMPAREC_OBRIGATORIO'), present, `${label}: comparecimento facultativo + obrigatório`);
          assertEqual(count(row, 'QT_ABST_FACULTATIVO') + count(row, 'QT_ABST_OBRIGATORIO'), absent, `${label}: abstenção facultativa + obrigatória`);
          const band = tseCategory('age', row.DS_FAIXA_ETARIA ?? '').key, education = tseCategory('education', row[educationField] ?? '').key;
          // A divisão facultativo/obrigatório da fonte precisa seguir a regra constitucional aplicada aqui (idade e analfabetismo).
          const optional = count(row, 'QT_COMPAREC_FACULTATIVO') + count(row, 'QT_ABST_FACULTATIVO');
          // Idade inválida: em 2022 a fonte segue a regra (facultativo só para analfabetos); em 2026 conta todas como facultativas.
          // Divergência declarada só nesse caso, contada e registrada; qualquer outra bloqueia.
          if (YEAR !== 2022 && band === 'invalid') {
            if (optional !== eligible) throw new Error(`${label}: idade inválida com divisão facultativo/obrigatório não auditada.`);
            if (!optionalVoter(band, education)) invalidAgeOptional += eligible;
          } else assertEqual(optional, optionalVoter(band, education) ? eligible : 0, `${label} (${row.DS_FAIXA_ETARIA}, ${row[educationField]}): aptos facultativos`);
          const key = cellKey([indexOf('gender', tseCategory('gender', row.DS_GENERO ?? '').key), indexOf('age', ageGroupOf(band)), indexOf('education', education),
            indexOf('maritalStatus', tseCategory('maritalStatus', row.DS_ESTADO_CIVIL ?? '').key)]);
          const cubeKey = `${code}/${row.NR_TURNO}`; const cube = cubes.get(cubeKey) ?? new Map(); add(cube, key, [eligible, present, absent]); cubes.set(cubeKey, cube);
        }
        if (!entryUf) throw new Error(`${entry}: arquivo vazio.`);
        const uf = entryUf; ufs.push(uf);
        // Conferência e gravação da UF: cada município e turno contra o contexto; a UF é a soma dos seus municípios.
        const expected = context.rows.filter((row) => row.uf === uf);
        for (const round of ROUNDS) {
          const ufCube: Cube = new Map(); let ufResults = 0;
          for (const item of expected) {
            const cube = cubes.get(`${item.code}/${round}`); const contextRound = item.turnout?.[round] ?? null;
            if (YEAR === 2022 && !contextRound) throw new Error(`${uf}/${item.code}/${round}: sem comparecimento no contexto e presente na fonte.`);
            if (!cube) throw new Error(`${uf}/${item.code}/${round}: ${YEAR === 2022 ? 'no contexto' : 'nos resultados'} e ausente na fonte.`);
            if (YEAR === 2022) checkMarginals(cube, contextRound!, `${uf}/${item.code}/${round}º turno`);
            const eligibleResults = resultsEligible.get(`${uf}/${item.code}/${round}`);
            if (eligibleResults === undefined) throw new Error(`${uf}/${item.code}/${round}: sem resultado da Presidência.`);
            for (const [key, cell] of cube) add(ufCube, key, cell);
            ufResults += eligibleResults;
            await client.query('INSERT INTO turnout_profile_cells VALUES($1,$2,$3,$4,$5,$6)', [id, uf, item.code, Number(round), flatten(cube), eligibleResults]);
            if (round === '1') municipalities++;
          }
          const unknown = [...cubes.keys()].filter((key) => key.endsWith(`/${round}`) && !contextOf.has(`${uf}/${key.split('/')[0]}`));
          if (unknown.length) throw new Error(`${uf}: municípios na fonte sem contexto: ${unknown.join(', ')}.`);
          await client.query('INSERT INTO turnout_profile_cells VALUES($1,$2,$3,$4,$5,$6)', [id, uf, '', Number(round), flatten(ufCube), ufResults]);
          const sum = [...ufCube.values()].reduce((total, cell) => [total[0] + cell[0], total[1] + cell[1], total[2] + cell[2]], [0, 0, 0]);
          totals[round] = [totals[round][0]! + sum[0]!, totals[round][1]! + sum[1]!, totals[round][2]! + sum[2]!, totals[round][3]! + ufResults];
        }
        console.log(`${uf}: ${expected.length} municípios conferidos (${Math.round((performance.now() - started) / 1000)} s).`);
      }
      for (const entry of entries(file.path).filter((name) => name.endsWith('_ZZ.csv'))) for await (const _ of rows(file.path, entry)) exteriorRows++;
      const missingUfs = STATES.filter((uf) => !ufs.includes(uf));
      if (missingUfs.join(',') !== AUDITED_MISSING) throw new Error(`UFs sem comparecimento por perfil: ${missingUfs.join(', ') || 'nenhuma'}; auditado: ${AUDITED_MISSING || 'nenhuma'}.`);
      const withTurnout = YEAR === 2022 ? context.rows.filter((row) => row.turnout?.['1']).length : context.rows.length;
      if (withTurnout !== municipalities) throw new Error(`Municípios com comparecimento no contexto: ${withTurnout}; gravados: ${municipalities}.`);

      const sources = [{ ...metadata, generatedAt: [...generated], rowsRead: read, rowsSelected: read }];
      const roundTotals = ROUNDS.map((round) => ({ round, eligible: totals[round][0]!, turnout: totals[round][1]!, abstentions: totals[round][2]!, resultsEligible: totals[round][3]! }));
      const dataset = turnoutProfilesDatasetSchema.parse({ id, kind: 'turnout-profiles', year: YEAR, importedAt: new Date().toISOString(), importerVersion: VERSION, inputs, sources, missingUfs,
        cellFormat: 'int4-groups-v2', order: TURNOUT_CELL_ORDER, municipalities, totals: roundTotals, ...(YEAR === 2022 ? {} : { rounds: ROUNDS }),
        scope: `Comparecimento e abstenção por perfil do eleitorado de ${YEAR} (TSE), cruzados por gênero, faixa etária, escolaridade e estado civil, por UF e por município, em cada turno da fonte: contagens da fonte, base própria que não fecha com os resultados.`,
        notes: [...(YEAR === 2022 ? ['A fonte não traz o Distrito Federal nem o exterior: "Brasil" é a soma das 26 UFs presentes.',
          'Cada município e turno confere com o contexto municipal (mesma fonte) nos totais e em cada categoria de gênero, faixa etária, escolaridade e estado civil; comparecimento + abstenção = aptos em cada linha.']
          : [`O arquivo de ${YEAR} traz só o 1º turno (gerado em ${[...generated].join(', ')}): o 2º turno não está na fonte e aparece como não disponível, nunca como zero.`,
            `As 27 UFs estão na fonte; o exterior (${exteriorRows.toLocaleString('pt-BR')} linhas) fica fora, porque não tem município brasileiro.`,
            'Sem contexto municipal da mesma fonte em 2026: cada município confere com a lista dos resultados da Presidência de 2026 (nenhum a mais nem a menos), e comparecimento + abstenção = aptos em cada linha.',
            `Idade inválida: a fonte de 2026 conta como voto facultativo todos os aptos com idade inválida; ${invalidAgeOptional.toLocaleString('pt-BR')} deles não são analfabetos e, pela regra de idade e escolaridade usada aqui (e seguida pela fonte em 2022), ficam fora do voto facultativo, porque a idade é desconhecida. Diferença declarada, não ajustada.`]),
          'Voto facultativo (16 e 17 anos, 70 anos ou mais e analfabetos) conferido contra a divisão facultativo/obrigatório da própria fonte em cada linha.',
          'Faixas etárias guardadas nos grupos por obrigatoriedade do voto (16–17, 18–24, 25–34, 35–44, 45–59, 60–69, 70+); a faixa de cinco anos da fonte continua no contexto municipal.',
          ...roundTotals.map((total) => `${total.round}º turno: ${total.eligible.toLocaleString('pt-BR')} aptos no perfil; ${total.resultsEligible.toLocaleString('pt-BR')} nos resultados das mesmas UFs (diferença não ajustada).`)] });
      await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [metadata.sha256, metadata.file, metadata.sizeBytes ?? 0]);
      await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
      const report = { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
      await preparePublication(client, { id, scope: SCOPE, inputs, report: report });
      await client.query('COMMIT');

      console.log(JSON.stringify({ published: id, scope: SCOPE, municipalities, totals: roundTotals, elapsedSeconds: report.elapsedSeconds }, null, 2));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Comparecimento por perfil falhou.'); process.exitCode = 1; });
