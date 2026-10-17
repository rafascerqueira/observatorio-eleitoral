import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { contextDatasetSchema, municipalityContextSchema, STATES, type MunicipalityContext } from '@observatorio/contracts';
import { count, entries, rows } from './csv';
import { assertEqual } from './model';
import { ROOT, sourceFile } from './sources';
import { sidraMetadata, sidraQuery, sidraValue, type PreservedSource, type SidraRow } from './sidra';
import { municipalityCode } from './territory';
import { distribution, populationByAge, tseCategory, tseOrder } from './context-model';

/**
 * Contexto municipal de 2022: Censo 2022 (SIDRA) por código IBGE, ligado ao município do TSE pela tabela oficial de
 * correspondência; perfis do TSE (cadastro e comparecimento) como base própria, declarada (decisão de Rafael, 17/10/2026).
 */
const VERSION = 'municipal-context-2022-v1';
const SCOPE = '2022/context/municipal';
type Uf = typeof STATES[number];
type Link = { uf: Uf; code: string; tseName: string; ibgeCode: string; ibgeName: string; ufIbge: string };
type Dimension = 'gender' | 'age' | 'education' | 'maritalStatus';
const DIMENSIONS: Array<[Dimension, string]> = [['gender', 'DS_GENERO'], ['age', 'DS_FAIXA_ETARIA'], ['education', 'DS_GRAU_ESCOLARIDADE'], ['maritalStatus', 'DS_ESTADO_CIVIL']];
const key = (uf: string, code: string) => `${uf}-${municipalityCode(code)}`;
const tseSpec = (file: string, entry: string, directory: string) => ({ file, entry, directory });

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/003-national.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/006-municipal-context.sql'), 'utf8'));

    // 1. Municípios publicados (Presidência nacional): referência de cobertura e aptos dos resultados para a diferença declarada.
    const published = await client.query<{ uf: Uf; code: string; round: number; eligible: string }>(`SELECT m.uf, m.code, m.round, m.result->'totals'->>'eligible' AS eligible
      FROM municipality_results m JOIN import_batches b ON b.id=m.batch_id AND b.published AND b.scope='2022/president/BR' WHERE m.uf<>'ZZ'`);
    const resultsEligible = new Map<string, { '1': number | null; '2': number | null }>();
    for (const row of published.rows) { const item = resultsEligible.get(key(row.uf, row.code)) ?? { '1': null, '2': null }; item[String(row.round) as '1' | '2'] = Number(row.eligible); resultsEligible.set(key(row.uf, row.code), item); }
    if (resultsEligible.size !== 5570) throw new Error(`Presidência nacional precisa estar publicada (5.570 municípios); encontrados ${resultsEligible.size}.`);

    // 2. Correspondência oficial TSE–IBGE: um código IBGE por município publicado, sem repetição, na UF certa.
    const correspondence = await sourceFile(tseSpec('municipio_tse_ibge.zip', 'municipio_tse_ibge.csv', 'municipio_tse_ibge'));
    const links = new Map<string, Link>(); const ibgeSeen = new Set<string>(); let correspondenceRows = 0; const generatedLinks = new Set<string>();
    for await (const row of rows(correspondence.path, correspondence.entry)) {
      correspondenceRows++; generatedLinks.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
      const link: Link = { uf: row.SG_UF as Uf, code: municipalityCode(row.CD_MUNICIPIO_TSE!), tseName: row.NM_MUNICIPIO_TSE!, ibgeCode: row.CD_MUNICIPIO_IBGE!, ibgeName: row.NM_MUNICIPIO_IBGE!, ufIbge: row.CD_UF_IBGE! };
      if (!/^\d{7}$/.test(link.ibgeCode) || !link.ibgeCode.startsWith(link.ufIbge) || !(STATES as readonly string[]).includes(link.uf)) throw new Error(`Correspondência inválida: ${JSON.stringify(link)}`);
      if (ibgeSeen.has(link.ibgeCode) || links.has(key(link.uf, link.code))) throw new Error(`Correspondência repetida: ${link.uf}/${link.code}/${link.ibgeCode}`);
      ibgeSeen.add(link.ibgeCode);
      if (resultsEligible.has(key(link.uf, link.code))) links.set(key(link.uf, link.code), link);
    }
    const unmatched = [...resultsEligible.keys()].filter((item) => !links.has(item));
    if (unmatched.length) throw new Error(`Municípios publicados sem código IBGE: ${unmatched.join(', ')}`);
    const extra = correspondenceRows - links.size;

    // 3. Censo 2022 na SIDRA, uma consulta por UF e tabela (limite de 50 mil valores por consulta).
    const sources: PreservedSource[] = [];
    const ufCodes = [...new Set([...links.values()].map((link) => `${link.uf}:${link.ufIbge}`))].sort();
    const metadata = await sidraMetadata(9514);
    const ageCategories = metadata.classificacoes.find((item) => item.id === 287)!.categorias;
    const ageNames = ['Total', '0 a 4 anos', '5 a 9 anos', '10 a 14 anos', '15 anos', '16 anos', '17 anos', '18 anos', '19 anos', '20 anos', '20 a 24 anos',
      ...Array.from({ length: 15 }, (_, index) => `${25 + index * 5} a ${29 + index * 5} anos`), '100 anos ou mais'];
    const ageIds = ageNames.map((name) => { const found = ageCategories.find((item) => item.nome === name); if (!found) throw new Error(`Idade ausente na SIDRA 9514: ${name}`); return found.id; });
    const queries = (uf: string) => ({
      age: `/t/9514/n6/in%20n3%20${uf}/v/93/p/2022/c2/6794/c286/113635/c287/${ageIds.join(',')}`,
      race: `/t/9605/n6/in%20n3%20${uf}/v/93/p/2022/c86/all`,
      literacy: `/t/9542/n6/in%20n3%20${uf}/v/950/p/2022/c59/all/c2/6794/c86/95251/c287/100362`,
      education: `/t/10061/n6/in%20n3%20${uf}/v/2667/p/2022/c1568/all/c58/95253/c2/6794/c86/95251`,
      income: `/t/10296/n6/in%20n3%20${uf}/v/13604/p/2022/c2/6794/c86/95251/c386/all`,
      incomeValue: `/t/10295/n6/in%20n3%20${uf}/v/13431,13534/p/2022/c2/6794/c86/95251/c58/95253`,
    });
    const census = new Map<string, Record<string, SidraRow[]>>();
    for (const item of ufCodes) {
      const [uf, code] = item.split(':') as [string, string];
      for (const [name, path] of Object.entries(queries(code))) {
        const result = await sidraQuery(`sidra_${name.toLowerCase()}_${uf.toLowerCase()}`, path);
        sources.push(result.source);
        for (const row of result.rows) { const entry = census.get(row.D1C!) ?? {}; (entry[name] ??= []).push(row); census.set(row.D1C!, entry); }
      }
      console.log(`SIDRA ${uf}: ${Object.keys(queries(code)).length} consultas preservadas.`);
    }
    // Totais das UFs nas tabelas do universo: a soma dos municípios precisa coincidir.
    const ufTotals = await sidraQuery('sidra_uf_totais', '/t/9514/n3/all/v/93/p/2022/c2/6794/c286/113635/c287/100362');
    sources.push(ufTotals.source);
    if (census.size !== 5570 || [...links.values()].some((link) => !census.has(link.ibgeCode))) throw new Error(`Municípios do Censo 2022 na SIDRA: ${census.size}; esperados os 5.570 da correspondência.`);

    // 4. Cadastro do TSE (perfil do eleitorado) e comparecimento por perfil, agregados por município.
    const profileFile = await sourceFile(tseSpec('perfil_eleitorado_2022.zip', 'perfil_eleitorado_2022_<UF>.csv (27 UFs; ZZ e BRASIL não usados)', 'perfil_eleitorado'));
    const turnoutFile = await sourceFile(tseSpec('perfil_comparecimento_abstencao_2022.zip', 'perfil_comparecimento_abstencao_2022_<UF>.csv (26 UFs; sem DF na fonte)', 'perfil_comparecimento_abstencao'));
    type Tally = Map<string, number>;
    const electorate = new Map<string, { eligible: number; dims: Record<Dimension, Tally> }>();
    const generatedProfile = new Set<string>(); let profileRows = 0;
    for (const entry of entries(profileFile.path).filter((name) => name.endsWith('.csv') && !name.includes('BRASIL'))) {
      for await (const row of rows(profileFile.path, entry)) {
        profileRows++; if (row.SG_UF === 'ZZ') continue;
        generatedProfile.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
        const id = key(row.SG_UF!, row.CD_MUNICIPIO!); const value = count(row, 'QT_ELEITORES');
        const item = electorate.get(id) ?? { eligible: 0, dims: { gender: new Map(), age: new Map(), education: new Map(), maritalStatus: new Map() } };
        item.eligible += value;
        for (const [dimension, field] of DIMENSIONS) { const category = tseCategory(dimension, row[field] ?? '').key; item.dims[dimension].set(category, (item.dims[dimension].get(category) ?? 0) + value); }
        electorate.set(id, item);
      }
    }
    const missingProfile = [...links.keys()].filter((item) => !electorate.has(item));
    if (missingProfile.length) throw new Error(`Municípios sem perfil do eleitorado: ${missingProfile.slice(0, 10).join(', ')}`);
    type TurnoutTally = { eligible: number; turnout: number; abstentions: number; dims: Record<Dimension, Map<string, [number, number, number]>> };
    const turnout = new Map<string, TurnoutTally>(); const turnoutUfs = new Set<string>(); const generatedTurnout = new Set<string>(); let turnoutRows = 0;
    for (const entry of entries(turnoutFile.path).filter((name) => name.endsWith('.csv') && !name.includes('BRASIL'))) {
      for await (const row of rows(turnoutFile.path, entry)) {
        turnoutRows++; if (row.SG_UF === 'ZZ') continue;
        generatedTurnout.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
        if (!['1', '2'].includes(row.NR_TURNO ?? '')) throw new Error(`Turno não auditado no comparecimento: ${row.NR_TURNO}`);
        const eligible = count(row, 'QT_APTOS'), present = count(row, 'QT_COMPARECIMENTO'), absent = count(row, 'QT_ABSTENCAO');
        assertEqual(present + absent, eligible, `Comparecimento por perfil ${row.SG_UF}/${row.CD_MUNICIPIO}: aptos`);
        turnoutUfs.add(row.SG_UF!);
        const id = `${key(row.SG_UF!, row.CD_MUNICIPIO!)}/${row.NR_TURNO}`;
        const item = turnout.get(id) ?? { eligible: 0, turnout: 0, abstentions: 0, dims: { gender: new Map(), age: new Map(), education: new Map(), maritalStatus: new Map() } };
        item.eligible += eligible; item.turnout += present; item.abstentions += absent;
        for (const [dimension, field] of DIMENSIONS) {
          const category = tseCategory(dimension, row[field] ?? '').key; const tally = item.dims[dimension].get(category) ?? [0, 0, 0];
          tally[0] += eligible; tally[1] += present; tally[2] += absent; item.dims[dimension].set(category, tally);
        }
        turnout.set(id, item);
      }
    }
    const withoutTurnout = STATES.filter((uf) => !turnoutUfs.has(uf));
    // Só a ausência auditada (DF) é aceita; qualquer outro município sem comparecimento bloqueia.
    if (withoutTurnout.join(',') !== 'DF') throw new Error(`UFs sem comparecimento por perfil: ${withoutTurnout.join(', ') || 'nenhuma'}; auditado: DF.`);
    const missingTurnout = [...links.values()].filter((link) => link.uf !== 'DF' && (!turnout.has(`${key(link.uf, link.code)}/1`) || !turnout.has(`${key(link.uf, link.code)}/2`)));
    if (missingTurnout.length) throw new Error(`Municípios sem comparecimento por perfil: ${missingTurnout.slice(0, 10).map((link) => `${link.uf}/${link.code}`).join(', ')}`);

    // 5. Monta e confere cada município.
    const items: MunicipalityContext[] = [];
    const ufSums = new Map<string, number>();
    for (const link of [...links.values()].sort((a, b) => a.uf.localeCompare(b.uf) || a.code.localeCompare(b.code))) {
      const label = `${link.uf}/${link.code} (IBGE ${link.ibgeCode})`;
      const data = census.get(link.ibgeCode)!;
      const values = (name: string, column: string) => new Map((data[name] ?? []).map((row) => [row[column]!, sidraValue(row.V)] as const));
      const ages = populationByAge(values('age', 'D6N'), label);
      const race = values('race', 'D4N'); const literacy = values('literacy', 'D4N'); const education = values('education', 'D4N'); const income = values('income', 'D6N');
      const incomeValue = new Map((data.incomeValue ?? []).map((row) => [row.D2C!, sidraValue(row.V)] as const));
      const categories = (map: Map<string, number | null>, names: string[], keys: string[]) => names.map((name, index) => { if (!map.has(name)) throw new Error(`${label}: categoria ${name} ausente.`); return { key: keys[index]!, label: name, value: map.get(name)! }; });
      const raceNames = ['Branca', 'Preta', 'Amarela', 'Parda', 'Indígena'];
      const educationNames = ['Sem instrução e fundamental incompleto', 'Fundamental completo e médio incompleto', 'Médio completo e superior incompleto', 'Superior completo'];
      const incomeNames = ['Sem rendimento', 'Até 1/4 de salário mínimo', 'Mais de 1/4 a 1/2 salário mínimo', 'Mais de 1/2 a 1 salário mínimo', 'Mais de 1 a 2 salários mínimos', 'Mais de 2 a 3 salários mínimos',
        'Mais de 3 a 5 salários mínimos', 'Mais de 5 a 10 salários mínimos', 'Mais de 10 a 15 salários mínimos', 'Mais de 15 a 20 salários mínimos', 'Mais de 20 salários mínimos'];
      const raceTotal = race.get('Total') ?? null;
      if (raceTotal !== ages.population.total) throw new Error(`${label}: população por cor ou raça (${raceTotal}) diferente da população por idade (${ages.population.total}).`);
      ufSums.set(link.ufIbge, (ufSums.get(link.ufIbge) ?? 0) + (ages.population.total ?? 0));
      const profile = electorate.get(key(link.uf, link.code))!;
      const tseDistribution = (dimension: Dimension, tally: Map<string, number>) => distribution('cadastro', 'TSE, perfil do eleitorado 2022', profile.eligible,
        tseOrder(dimension).filter((item) => tally.has(item.key) || item.key !== 'invalid').map((item) => ({ ...item, value: tally.get(item.key) ?? 0 })), `${label}: eleitorado por ${dimension}`);
      const turnoutRound = (round: '1' | '2') => {
        const item = turnout.get(`${key(link.uf, link.code)}/${round}`);
        if (!item) return null;
        return { eligible: item.eligible, turnout: item.turnout, abstentions: item.abstentions, dimensions: DIMENSIONS.map(([dimension]) => {
          const categories = tseOrder(dimension).filter((entry) => item.dims[dimension].has(entry.key)).map((entry) => { const [eligible, present, absent] = item.dims[dimension].get(entry.key)!; return { ...entry, eligible, turnout: present, abstentions: absent }; });
          assertEqual(categories.reduce((sum, entry) => sum + entry.eligible, 0), item.eligible, `${label}: comparecimento por ${dimension}`);
          return { dimension, categories };
        }) };
      };
      const context = municipalityContextSchema.parse({
        code: link.code, name: link.tseName, uf: link.uf, ibgeCode: link.ibgeCode, ibgeName: link.ibgeName,
        population: ages.population, populationByAge: ages.populationByAge,
        race: distribution('universo', 'IBGE, Censo 2022 — SIDRA 9605', raceTotal, categories(race, raceNames, ['white', 'black', 'asian', 'brown', 'indigenous']), `${label}: cor ou raça`, 'partial'),
        literacy15: distribution('universo', 'IBGE, Censo 2022 — SIDRA 9542 (15 anos ou mais)', literacy.get('Total') ?? null, categories(literacy, ['Alfabetizadas', 'Não alfabetizadas'], ['literate', 'illiterate']), `${label}: alfabetização`),
        education18: distribution('amostra', 'IBGE, Censo 2022 — SIDRA 10061 (18 anos ou mais; estimativa da amostra)', education.get('Total') ?? null, categories(education, educationNames, ['none-fundamental-incomplete', 'fundamental-complete', 'high-school-complete', 'college-complete']), `${label}: instrução`, 'rounding'),
        incomeClasses: distribution('amostra', 'IBGE, Censo 2022 — SIDRA 10296 (rendimento domiciliar per capita; salário mínimo de R$ 1.212,00; estimativa da amostra)', income.get('Total') ?? null,
          categories(income, incomeNames, ['none', 'upto-1/4', '1/4-1/2', '1/2-1', '1-2', '2-3', '3-5', '5-10', '10-15', '15-20', '20+']), `${label}: rendimento`, 'rounding'),
        incomePerCapita: { mean: incomeValue.get('13431') ?? null, median: incomeValue.get('13534') ?? null, source: 'IBGE, Censo 2022 — SIDRA 10295 (rendimento domiciliar per capita nominal, R$; estimativa da amostra)' },
        electorate: { eligible: profile.eligible, ...Object.fromEntries(DIMENSIONS.map(([dimension]) => [dimension, tseDistribution(dimension, profile.dims[dimension])])) },
        resultsEligible: resultsEligible.get(key(link.uf, link.code))!,
        turnout: { '1': turnoutRound('1'), '2': turnoutRound('2') },
      });
      items.push(context);
    }
    for (const row of ufTotals.rows) assertEqual(ufSums.get(row.D1C!) ?? 0, sidraValue(row.V) ?? -1, `UF ${row.D1N}: soma da população dos municípios`);
    const electorateTotal = items.reduce((sum, item) => sum + item.electorate.eligible, 0);

    // 6. Publicação atômica, idempotente pelos originais.
    const tseSources = [correspondence, profileFile, turnoutFile].map(({ path: _path, ...metadata }, index) => ({ ...metadata, generatedAt: [[...generatedLinks], [...generatedProfile], [...generatedTurnout]][index]!,
      rowsRead: [correspondenceRows, profileRows, turnoutRows][index]!, rowsSelected: [links.size, profileRows, turnoutRows][index]! }));
    const allSources = [...tseSources, ...sources];
    const id = createHash('sha256').update(JSON.stringify({ version: VERSION, scope: SCOPE, hashes: allSources.map((source) => source.sha256) })).digest('hex');
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}. Nenhuma duplicação.`); return; }
    const dataset = contextDatasetSchema.parse({ id, kind: 'municipal-context', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, sources: allSources, validation: 'checked',
      scope: 'Contexto municipal de 2022: Censo 2022 (IBGE, SIDRA) ligado aos municípios do TSE pela correspondência oficial de códigos; perfil do eleitorado e comparecimento por perfil do TSE como base própria, que não fecha com os resultados.',
      coverage: { expected: links.size, published: items.length, withoutTurnout },
      notes: [`Correspondência TSE–IBGE: ${correspondenceRows} linhas; ${extra} sem município publicado em 2022 (criação posterior).`,
        `Perfil do eleitorado: ${electorateTotal.toLocaleString('pt-BR')} aptos nos municípios (sem exterior); difere dos resultados por município.`,
        'Comparecimento por perfil: a fonte não traz o DF nem o exterior; para o DF, "não disponível".',
        'Cor/raça, identidade de gênero e quilombola do eleitorado de 2022: 100% "não informado" na fonte; não publicados.',
        'Rendimento e instrução são estimativas da amostra do Censo, com erro amostral maior em municípios pequenos; as classes são arredondadas célula a célula e podem diferir do total em poucas pessoas (registrado por município, nunca ajustado).',
        `Cor ou raça (SIDRA 9605): em ${items.filter((item) => item.race.undistributed).length} municípios o total supera a soma das cinco categorias publicadas; a diferença aparece como não discriminada na fonte, sem ser redistribuída.`] });
    for (const source of allSources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes]);
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, dataset]);
      await client.query('DELETE FROM municipality_context WHERE batch_id=$1', [id]);
      for (let start = 0; start < items.length; start += 200) {
        await client.query(`INSERT INTO municipality_context SELECT $1, x->>'uf', x->>'code', x->>'ibgeCode', x FROM jsonb_array_elements($2::jsonb) AS x`, [id, JSON.stringify(items.slice(start, start + 200))]);
      }
      // Indicadores do mapa derivados destas linhas (mesma regra da migration 008).
      await client.query(await readFile(resolve(__dirname, 'migrations/008-map-indicators.sql'), 'utf8'));
      const stored = await client.query<{ count: number; eligible: string }>("SELECT count(*)::integer AS count, sum((result->'electorate'->>'eligible')::bigint)::text AS eligible FROM municipality_context WHERE batch_id=$1", [id]);
      assertEqual(stored.rows[0]!.count, items.length, 'Municípios gravados'); assertEqual(Number(stored.rows[0]!.eligible), electorateTotal, 'Eleitorado gravado');
      await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
      await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    const differences = items.map((item) => item.electorate.eligible - (item.resultsEligible['1'] ?? 0));
    const report = { dataset, electorateTotal, electorateVsResults: { municipalitiesWithDifference: differences.filter(Boolean).length, maxAbsoluteDifference: Math.max(...differences.map(Math.abs)) },
      elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
    await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
    await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ published: id, scope: SCOPE, coverage: dataset.coverage, electorateTotal, elapsedSeconds: report.elapsedSeconds, peakRssMiB: report.peakRssMiB }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Importação do contexto municipal falhou.'); process.exitCode = 1; });
