import { reusePublished, publicationId, publishedInputs, preparePublication } from './publication';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { INCOME_BANDS, placeGroupBandOf, TRACT_DEMOGRAPHY_BASE, TRACT_DEMOGRAPHY_INDICATORS, tractDemographyDatasetSchema, tractDemographySchema, type IncomeBandPopulation, type TractDemographyIndicator } from '@observatorio/contracts';
import { entries, rows } from './csv';
import { ROOT } from './sources';
import { preservedDownload, sidraValue } from './sidra';
import { IBGE } from './sectors';

/**
 * Moradores por faixa de perfil do setor (Censo 2022, agregados por setor de demografia, universo): o equivalente censitário
 * dos indicadores de eleitoras, 16 a 24 anos e 60 anos ou mais de `/perfis`. Cada setor entra inteiro na faixa (mesmos
 * cortes de `PLACE_GROUP_CUTS`) pela parcela calculada entre os seus moradores de 15 anos ou mais — o agregado por setor
 * agrupa 15 a 19 anos, então a base é 15+ e a faixa jovem é 15 a 24. Descreve o território, não o eleitorado.
 */
const VERSION = 'tract-demography-2022-v2';
const SCOPE = '2022/context/tract-demography';
const SEX_AGE = { male: ['V01009', 'V01010', 'V01011', 'V01012', 'V01013', 'V01014', 'V01015', 'V01016', 'V01017', 'V01018', 'V01019'], female: ['V01020', 'V01021', 'V01022', 'V01023', 'V01024', 'V01025', 'V01026', 'V01027', 'V01028', 'V01029', 'V01030'],
  age: ['V01031', 'V01032', 'V01033', 'V01034', 'V01035', 'V01036', 'V01037', 'V01038', 'V01039', 'V01040', 'V01041'] };
// Rótulos auditados no dicionário preservado (planilha "Pessoas", tema Demografia); divergência bloqueia.
const LABELS: Record<string, string> = { V01006: 'Quantidade de moradores', V01007: 'Sexo masculino', V01008: 'Sexo feminino',
  ...Object.fromEntries(['0 a 4 anos', '5 a 9 anos', '10 a 14 anos', '15 a 19 anos', '20 a 24 anos', '25 a 29 anos', '30 a 39 anos', '40 a 49 anos', '50 a 59 anos', '60 a 69 anos', '70 anos ou mais']
    .flatMap((band, index) => [[SEX_AGE.male[index]!, `Sexo masculino, ${band}`], [SEX_AGE.female[index]!, `Sexo feminino, ${band}`], [SEX_AGE.age[index]!, band]])) };
const INDICATORS = Object.keys(TRACT_DEMOGRAPHY_INDICATORS) as TractDemographyIndicator[];
const emptyPopulation = (): IncomeBandPopulation => ({ total: 0, bands: INCOME_BANDS.map((band) => ({ index: band.index, residents: 0, tracts: 0 })), noData: { residents: 0, tracts: 0 }, undisclosed: { tracts: 0 }, coverage: { residents: 0, total: 0 } });

/** Pares código → descrição das planilhas de um XLSX (strings compartilhadas e valores inline), sem dependência externa. */
function xlsxPairs(path: string) {
  const read = (entry: string) => execFileSync('unzip', ['-p', path, entry], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
  const decode = (text: string) => text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => decode(match[1]!));
  const pairs = new Map<string, string>();
  for (const sheet of entries(path).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))) {
    for (const row of read(sheet).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const values = [...row[1]!.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].flatMap((cell) => {
        const value = /<v>([\s\S]*?)<\/v>/.exec(cell[2] ?? '')?.[1];
        return value === undefined ? [] : [/t="s"/.test(cell[1]!) ? shared[Number(value)]! : decode(value)];
      });
      for (let index = 0; index < values.length - 1; index++) if (/^V\d{5}$/.test(values[index]!)) pairs.set(values[index]!, values[index + 1]!.trim());
    }
  }
  return pairs;
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const tracts = await preservedDownload('agregados_setores_demografia', `${IBGE}/Agregados_por_Setor_csv/Agregados_por_setores_demografia_BR.zip`, 'setores', 'Agregados_por_setores_demografia_BR.zip', [], 'zip');
  const dictionary = await preservedDownload('dicionario_agregados_setores', `${IBGE}/dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx`, 'setores', 'dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx', [], 'xlsx');
  const labels = xlsxPairs(dictionary.path);
  const wrong = Object.entries(LABELS).filter(([code, label]) => labels.get(code) !== label);
  if (wrong.length) throw new Error(`Dicionário do IBGE diverge do auditado: ${wrong.map(([code, label]) => `${code} "${labels.get(code)}" ≠ "${label}"`).join('; ')}.`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    const inputs = await publishedInputs(client, ['2022/context/municipal']);
    await client.query(await readFile(resolve(__dirname, 'migrations/016-tract-demography.sql'), 'utf8'));
    const context = await client.query<{ ibge_code: string; uf: string; population: number | null }>(`SELECT c.ibge_code, c.uf, (c.result->'population'->>'total')::bigint AS population FROM municipality_context c
      JOIN import_batches b ON b.id=c.batch_id AND b.published AND b.scope='2022/context/municipal'`);
    if (!context.rows.length) throw new Error('Contexto municipal precisa estar publicado.');
    const contextOf = new Map(context.rows.map((row) => [row.ibge_code, row]));

    type Municipality = { residents: number; undisclosed: number; indicators: Record<TractDemographyIndicator, IncomeBandPopulation> };
    const byMunicipality = new Map<string, Municipality>(); let read = 0;
    const entry = entries(tracts.path).find((name) => name.toLowerCase().endsWith('.csv'));
    if (!entry) throw new Error('Sem CSV no agregado de demografia.');
    for await (const row of rows(tracts.path, entry)) {
      read++;
      const setor = row.CD_SETOR ?? row.CD_setor ?? '';
      if (!/^\d{15}$/.test(setor)) throw new Error(`Código de setor inválido: ${setor}.`);
      const code = setor.slice(0, 7);
      if (!contextOf.has(code)) throw new Error(`Setor ${setor} de município fora do contexto publicado.`);
      const item = byMunicipality.get(code) ?? { residents: 0, undisclosed: 0, indicators: Object.fromEntries(INDICATORS.map((indicator) => [indicator, emptyPopulation()])) as Municipality['indicators'] };
      byMunicipality.set(code, item);
      const fields = ['V01006', 'V01007', 'V01008', ...SEX_AGE.male, ...SEX_AGE.female, ...SEX_AGE.age];
      const raw = Object.fromEntries(fields.map((field) => { const value = row[field]; if (value === undefined) throw new Error(`${setor}: campo ${field} ausente.`); return [field, value]; }));
      // Setor inteiro omitido ("X"): nada divulgado, nada estimado. O IBGE também omite células isoladas (27% dos setores):
      // o setor fica fora só dos indicadores que dependem de uma célula omitida; nada é deduzido por diferença.
      const omitted = new Set(fields.filter((field) => raw[field] === 'X'));
      if (omitted.size === fields.length) { item.undisclosed++; for (const indicator of INDICATORS) item.indicators[indicator].undisclosed.tracts++; continue; }
      if (omitted.has('V01006')) throw new Error(`${setor}: moradores omitidos e outras células divulgadas.`);
      const value = Object.fromEntries(fields.filter((field) => !omitted.has(field)).map((field) => { const number = sidraValue(raw[field]); if (number === null) throw new Error(`${setor} ${field}: "${raw[field]}" não previsto.`); return [field, number]; }));
      const sum = (codes: readonly string[]) => codes.reduce((total, field) => total + (value[field] ?? 0), 0);
      // Conferências internas: com tudo divulgado, sexo e idade somam os moradores; com omissões, o divulgado não passa do total.
      const complete = (codes: readonly string[]) => codes.every((field) => !omitted.has(field));
      const check = (codes: readonly string[], total: string) => { if (omitted.has(total)) return; const known = sum(codes), expected = value[total]!;
        if (complete(codes) ? known !== expected : known > expected) throw new Error(`${setor}: ${codes[0]}…${codes.at(-1)} (${known}) incompatível com ${total} (${expected}).`); };
      check(['V01007', 'V01008'], 'V01006'); check(SEX_AGE.age, 'V01006'); check(SEX_AGE.male, 'V01007'); check(SEX_AGE.female, 'V01008');
      item.residents += value.V01006!;
      for (const indicator of INDICATORS) {
        const population = item.indicators[indicator];
        population.coverage!.total += value.V01006!;
        const needed = [...TRACT_DEMOGRAPHY_BASE, ...TRACT_DEMOGRAPHY_INDICATORS[indicator].numerator];
        if (!complete(needed)) { population.undisclosed.tracts++; continue; }
        const base = sum(TRACT_DEMOGRAPHY_BASE);
        population.coverage!.residents += value.V01006!; population.total += base;
        if (base === 0) { population.noData.tracts++; continue; }
        const band = population.bands[placeGroupBandOf(indicator, sum(TRACT_DEMOGRAPHY_INDICATORS[indicator].numerator), base) - 1]!;
        band.residents += base; band.tracts++;
      }
    }
    // Conferência por município: com todos os setores divulgados, a soma dos moradores = população do Censo no contexto (SIDRA).
    const divergent: string[] = []; let withOmission = 0;
    for (const [code, item] of byMunicipality) {
      const expected = contextOf.get(code)!.population;
      if (item.undisclosed) { withOmission++; if (expected !== null && item.residents > expected) divergent.push(`${code}: setores ${item.residents} > população ${expected}`); }
      else if (expected === null || item.residents !== Number(expected)) divergent.push(`${code}: setores ${item.residents}, população ${expected}`);
    }
    if (divergent.length) throw new Error(`${divergent.length} municípios divergem da população do Censo; publicação bloqueada. ${divergent.slice(0, 5).join('; ')}`);
    if (byMunicipality.size !== contextOf.size) throw new Error(`Municípios: ${byMunicipality.size} nos setores, ${contextOf.size} no contexto.`);

    const sources = [{ ...tracts.source, rowsRead: read, rowsSelected: read }, { ...dictionary.source, rowsRead: 0, rowsSelected: 0 }];
    const id = publicationId(VERSION, sources.map((source) => source.sha256), inputs);
    for (const source of sources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes ?? 0]);
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { console.log(`Já publicado: ${id}.`); return; }
    const residents = [...byMunicipality.values()].reduce((sum, item) => sum + item.residents, 0);
    const undisclosed = [...byMunicipality.values()].reduce((sum, item) => sum + item.undisclosed, 0);
    const dataset = tractDemographyDatasetSchema.parse({ id, kind: 'tract-demography', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, inputs, sources,
      scope: 'Moradores de 15 anos ou mais de todos os setores censitários (Censo 2022, universo, agregados de demografia), somados pela faixa do setor em mulheres, 15 a 24 anos e 60 anos ou mais entre os moradores de 15+, nos mesmos cortes de /perfis.',
      totals: { municipalities: byMunicipality.size, tracts: read, residents, undisclosedTracts: undisclosed },
      notes: [`Rótulos de ${Object.keys(LABELS).length} variáveis conferidos no dicionário do IBGE. Em cada setor sem célula omitida, sexo e faixas etárias somam os moradores; com células omitidas, a soma do divulgado não passa do total.`,
        `Soma dos setores igual à população do Censo (contexto municipal) nos ${(byMunicipality.size - withOmission).toLocaleString('pt-BR')} municípios sem setor omitido; nos ${withOmission.toLocaleString('pt-BR')} com setores omitidos ("X", ${undisclosed.toLocaleString('pt-BR')} setores), a soma fica abaixo e nada é estimado.`,
        ...INDICATORS.map((indicator) => { const covered = [...byMunicipality.values()].reduce((sum, item) => ({ residents: sum.residents + item.indicators[indicator].coverage!.residents, tracts: sum.tracts + item.indicators[indicator].undisclosed.tracts }), { residents: 0, tracts: 0 });
          return `${TRACT_DEMOGRAPHY_INDICATORS[indicator].definition}: ${(covered.residents / residents * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% dos moradores divulgados estão em setores com todas as células do indicador; ${covered.tracts.toLocaleString('pt-BR')} setores com célula omitida ficam fora.`; }),
        'O agregado por setor agrupa 15 a 19 anos: a base é 15 anos ou mais (não 16+, a idade mínima para votar) e a faixa jovem é 15 a 24 anos.',
        'Descreve quem mora no setor, não o eleitorado do local de votação; domicílio eleitoral não é residência.'] });
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, dataset]);
      await client.query('DELETE FROM municipality_tract_demography WHERE batch_id=$1', [id]);
      const list = [...byMunicipality].map(([code, item]) => ({ code, uf: contextOf.get(code)!.uf, result: tractDemographySchema.parse({ residents: item.residents, indicators: item.indicators }) }));
      await client.query('INSERT INTO municipality_tract_demography SELECT $1, x.code, x.uf, x.result FROM jsonb_to_recordset($2::jsonb) AS x(code text, uf text, result jsonb)', [id, JSON.stringify(list)]);
      await preparePublication(client, { id, scope: SCOPE, inputs, report: { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000) } });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }

    console.log(JSON.stringify({ published: id, scope: SCOPE, totals: dataset.totals, elapsedSeconds: Math.round((performance.now() - started) / 1000) }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Demografia por setor falhou.'); process.exitCode = 1; });
