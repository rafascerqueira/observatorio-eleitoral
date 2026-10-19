import { reusePublished, publicationId, publishedInputs, preparePublication } from './publication';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { URBAN_CHARACTERISTICS, URBAN_COUNTS, urbanIdentityErrors, urbanSurroundingsDatasetSchema, urbanSurroundingsSchema } from '@observatorio/contracts';
import { entries, rows, type Row } from './csv';
import { ROOT } from './sources';
import { preservedDownload } from './sidra';
import { xlsxPairs } from './xlsx';

/**
 * Entorno dos domicílios (Censo 2022, agregados por setor e por município das características urbanísticas do entorno): moradores
 * em domicílios particulares permanentes ocupados dos setores escolhidos para a pesquisa (V05200) por característica da face de
 * quadra (V05201–V05234). Cada característica soma a base em cada setor e município. A soma dos setores é igual ao arquivo
 * municipal onde não há setor omitido ("X") e não o ultrapassa onde há: o arquivo municipal inclui os omitidos, nunca deduzidos.
 * Por setor, guarda só os associados a locais de votação (cartão do local); por município, todos.
 */
const VERSION = 'urban-surroundings-2022-v1';
const SCOPE = '2022/context/urban-surroundings';
const ENTORNO = 'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios_Caracteristicas_urbanisticas_do_entorno_dos_domicilios';
const VARIABLES = Array.from({ length: URBAN_COUNTS }, (_, index) => `V${String(5200 + index).padStart(5, '0')}`);
// Rótulos auditados no dicionário preservado (planilha de pessoas, 07/05/2025); divergência bloqueia.
const BASE_LABEL = '[QUANTIDADE DE MORADORES][Domicílios particulares permanentes ocupados][DOMICÍLIO EM SETOR ESCOLHIDO PARA APLICAÇÃO DO ENTORNO]';
export const URBAN_LABELS = [BASE_LABEL, ...URBAN_CHARACTERISTICS.flatMap((item) => item.categories.map((category) => `${BASE_LABEL}[DOMICÍLIOS EM FACE COM ${item.dictionary} - ${category}]`))];

/** Contagens de uma linha: todas numéricas e coerentes, ou todas "X" (omitidas pelo IBGE → `null`). Mistura ou outro símbolo bloqueia. */
export function urbanCounts(row: Row, label: string): number[] | null {
  const raw = VARIABLES.map((variable) => { const value = row[variable]; if (value === undefined) throw new Error(`${label}: ${variable} ausente.`); return value.trim(); });
  if (raw.every((value) => value === 'X')) return null;
  const unexpected = [...new Set(raw.filter((value) => !/^\d+$/.test(value)))];
  if (unexpected.length) throw new Error(`${label}: valores não previstos (${unexpected.join(', ')}).`);
  const counts = raw.map(Number);
  const errors = urbanIdentityErrors(counts);
  if (errors.length) throw new Error(`${label}: categorias não somam a base em ${errors.join(', ')}.`);
  return counts;
}
/** Conferência do arquivo municipal com a soma dos setores divulgados: exata sem setor omitido; com omitido, nunca abaixo da soma. */
export function municipalMatches(municipal: readonly number[], tracts: readonly number[], suppressed: number) {
  return suppressed === 0 ? municipal.every((value, index) => value === tracts[index]) : municipal.every((value, index) => value >= tracts[index]!);
}

function csvEntry(zip: string) {
  const entry = entries(zip).find((name) => name.toLowerCase().endsWith('.csv'));
  if (!entry) throw new Error(`Sem CSV em ${zip}.`);
  return entry;
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const tracts = await preservedDownload('agregados_setores_entorno_moradores', `${ENTORNO}/Agregados_por_Setor_csv/Agregados_por_setores_entorno_moradores_BR.zip`, 'setores', 'Agregados_por_setores_entorno_moradores_BR.zip', [], 'zip');
  const municipal = await preservedDownload('agregados_municipios_entorno_moradores', `${ENTORNO}/Agregados_por_Municipio_csv/Agregados_por_municipios_entorno_moradores_BR.zip`, 'setores', 'Agregados_por_municipios_entorno_moradores_BR.zip', [], 'zip');
  const dictionary = await preservedDownload('dicionarios_entorno', `${ENTORNO}/dicionarios_de_dados_entorno.zip`, 'setores', 'dicionarios_de_dados_entorno.zip', [], 'zip');
  // O dicionário é um ZIP com uma planilha por unidade; a de pessoas (moradores) é lida numa cópia temporária, fora de `data/`.
  const scratch = await mkdtemp(join(tmpdir(), 'entorno-'));
  let labels: Map<string, string>;
  try {
    const sheet = join(scratch, 'pessoas.xlsx');
    await writeFile(sheet, execFileSync('unzip', ['-p', dictionary.path, 'dicionario_entorno_pessoas.xlsx'], { maxBuffer: 64 * 1024 * 1024 }));
    labels = xlsxPairs(sheet);
  } finally { await rm(scratch, { recursive: true, force: true }); }
  const wrong = VARIABLES.filter((variable, index) => labels.get(variable) !== URBAN_LABELS[index]);
  if (wrong.length) throw new Error(`Dicionário do IBGE diverge do auditado: ${wrong.map((variable) => `${variable} "${labels.get(variable)}"`).join('; ')}.`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    const inputs = await publishedInputs(client, ['2022/context/municipal', '2022/places/tracts']);
    await client.query(await readFile(resolve(__dirname, 'migrations/017-urban-surroundings.sql'), 'utf8'));
    // Municípios pelo contexto publicado (código IBGE validado contra a correspondência TSE–IBGE) e setores associados a locais.
    const context = await client.query<{ ibge_code: string; uf: string; code: string; name: string }>("SELECT c.ibge_code, c.uf, c.code, c.result->>'name' AS name FROM municipality_context c JOIN import_batches b ON b.id=c.batch_id AND b.published AND b.scope='2022/context/municipal'");
    if (!context.rows.length) throw new Error('Contexto municipal precisa estar publicado.');
    const municipalities = new Map(context.rows.map((row) => [row.ibge_code, row]));
    const associated = new Set((await client.query<{ cd_setor: string }>("SELECT DISTINCT t.cd_setor FROM polling_place_tracts t JOIN import_batches b ON b.id=t.batch_id AND b.published AND b.scope='2022/places/tracts' WHERE t.status='associated'")).rows.map((row) => row.cd_setor));
    if (!associated.size) throw new Error('Associação local → setor precisa estar publicada.');

    // 1. Setores: código único de município do contexto; contagens coerentes ou omitidas por inteiro.
    const byMunicipality = new Map<string, { tracts: number; suppressed: number; counts: number[] }>();
    const kept: Array<{ setor: string; counts: number[] | null }> = []; const seen = new Set<string>(); let read = 0;
    for await (const row of rows(tracts.path, csvEntry(tracts.path))) {
      read++;
      const setor = row.CD_setor ?? row.CD_SETOR ?? '';
      if (!/^\d{15}$/.test(setor)) throw new Error(`Código de setor inválido: ${setor}.`);
      if (seen.has(setor)) throw new Error(`Setor repetido: ${setor}.`);
      seen.add(setor);
      const code = setor.slice(0, 7);
      if (!municipalities.has(code)) throw new Error(`Setor ${setor} de município fora do contexto publicado.`);
      const counts = urbanCounts(row, `Setor ${setor}`);
      const sum = byMunicipality.get(code) ?? { tracts: 0, suppressed: 0, counts: new Array<number>(URBAN_COUNTS).fill(0) };
      sum.tracts++;
      if (counts === null) sum.suppressed++; else counts.forEach((value, index) => { sum.counts[index]! += value; });
      byMunicipality.set(code, sum);
      if (associated.has(setor)) kept.push({ setor, counts });
    }
    // 2. Municípios: arquivo municipal coerente, completo e conferido com os setores divulgados.
    const municipalCounts = new Map<string, number[]>(); const divergent: string[] = []; let municipalRows = 0;
    for await (const row of rows(municipal.path, csvEntry(municipal.path))) {
      municipalRows++;
      const code = row.CD_MUN ?? '';
      if (!municipalities.has(code)) throw new Error(`Município ${code} fora do contexto publicado.`);
      if (municipalCounts.has(code)) throw new Error(`Município repetido: ${code}.`);
      const counts = urbanCounts(row, `Município ${code}`);
      if (counts === null) throw new Error(`Município ${code} omitido no arquivo municipal; não previsto.`);
      municipalCounts.set(code, counts);
      const sum = byMunicipality.get(code) ?? { tracts: 0, suppressed: 0, counts: new Array<number>(URBAN_COUNTS).fill(0) };
      if (!municipalMatches(counts, sum.counts, sum.suppressed)) divergent.push(`${code}: municipal ${counts[0]}, setores ${sum.counts[0]} (${sum.suppressed} omitidos)`);
    }
    if (divergent.length) throw new Error(`${divergent.length} municípios divergem dos setores; publicação bloqueada. ${divergent.slice(0, 5).join('; ')}`);
    if (municipalRows !== municipalities.size || municipalCounts.size !== municipalities.size || [...byMunicipality.keys()].some((code) => !municipalCounts.has(code))) throw new Error(`Municípios: ${municipalRows} no arquivo municipal, ${byMunicipality.size} com setores, ${municipalities.size} no contexto.`);

    const results = [...municipalCounts].map(([ibge, counts]) => {
      const sum = byMunicipality.get(ibge);
      const item = urbanSurroundingsSchema.parse({ tracts: sum?.tracts ?? 0, suppressedTracts: sum?.suppressed ?? 0, counts });
      const { uf, code, name } = municipalities.get(ibge)!;
      return { ibge, uf, code, name, ...item };
    });
    const suppressed = results.reduce((total, item) => total + item.suppressedTracts, 0);
    const totals = { municipalities: results.length, tracts: read, suppressedTracts: suppressed, residents: results.reduce((total, item) => total + item.counts[0]!, 0),
      associatedTracts: associated.size, associatedSurveyed: kept.length, associatedSuppressed: kept.filter((item) => item.counts === null).length };
    const sources = [{ ...tracts.source, rowsRead: read, rowsSelected: kept.length }, { ...municipal.source, rowsRead: municipalRows, rowsSelected: municipalRows }, { ...dictionary.source, rowsRead: 0, rowsSelected: 0 }];
    const id = publicationId(VERSION, sources.map((source) => source.sha256), inputs);
    for (const source of sources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes ?? 0]);
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { console.log(`Já publicado: ${id}.`); return; }
    const exact = results.filter((item) => item.suppressedTracts === 0).length;
    const dataset = urbanSurroundingsDatasetSchema.parse({ id, kind: 'urban-surroundings', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, inputs, sources, totals,
      scope: 'Moradores em domicílios particulares permanentes ocupados dos setores escolhidos para a pesquisa do entorno (Censo 2022, universo), por característica da face de quadra: circulação, pavimentação, bueiro, iluminação, ponto de ônibus, via sinalizada para bicicleta, calçada, obstáculo, rampa e arborização.',
      notes: [`Categorias de cada característica somam a base em todos os ${read.toLocaleString('pt-BR')} setores divulgados e nos ${results.length.toLocaleString('pt-BR')} municípios.`,
        `Soma dos setores igual ao arquivo municipal nos ${exact.toLocaleString('pt-BR')} municípios sem setor omitido; nos ${(results.length - exact).toLocaleString('pt-BR')} demais, o arquivo municipal inclui os setores omitidos e nunca fica abaixo da soma divulgada.`,
        `${suppressed.toLocaleString('pt-BR')} setores omitidos pelo IBGE ("X") em todas as variáveis: sem contagens por setor, nunca estimadas.`,
        'Base: moradores dos setores com a pesquisa do entorno. Setores fora dela não entram no denominador, e estar fora da pesquisa não indica ausência da infraestrutura.',
        '"Não declarado" inclui faces em que o item não foi avaliado — sem calçada, no caso de rampa e obstáculo na calçada — e "saltado", faces não percorridas.',
        `Por setor, só os ${totals.associatedTracts.toLocaleString('pt-BR')} setores associados a locais de votação: ${totals.associatedSurveyed.toLocaleString('pt-BR')} na pesquisa, dos quais ${totals.associatedSuppressed.toLocaleString('pt-BR')} omitidos.`] });
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, dataset]);
      await client.query('DELETE FROM municipality_urban_surroundings WHERE batch_id=$1', [id]); await client.query('DELETE FROM tract_urban_surroundings WHERE batch_id=$1', [id]);
      const vector = (counts: number[] | null) => counts === null ? null : `{${counts.join(',')}}`;
      await client.query(`INSERT INTO municipality_urban_surroundings SELECT $1, x.ibge, x.uf, x.code, x.name, x.tracts, x.suppressed, x.counts::integer[]
        FROM jsonb_to_recordset($2::jsonb) AS x(ibge text, uf text, code text, name text, tracts integer, suppressed integer, counts text)`,
        [id, JSON.stringify(results.map((item) => ({ ibge: item.ibge, uf: item.uf, code: item.code, name: item.name, tracts: item.tracts, suppressed: item.suppressedTracts, counts: vector(item.counts) })))]);
      for (let start = 0; start < kept.length; start += 10000) {
        await client.query('INSERT INTO tract_urban_surroundings SELECT $1, x.setor, x.counts::integer[] FROM jsonb_to_recordset($2::jsonb) AS x(setor text, counts text)',
          [id, JSON.stringify(kept.slice(start, start + 10000).map((item) => ({ setor: item.setor, counts: vector(item.counts) })))]);
      }
      // Conferência do que foi gravado: municípios, base somada e setores (com e sem contagens).
      const stored = await client.query<{ municipalities: number; residents: string; tracts: number; suppressed: number }>(`SELECT (SELECT count(*)::integer FROM municipality_urban_surroundings WHERE batch_id=$1) AS municipalities,
        (SELECT sum(counts[1])::text FROM municipality_urban_surroundings WHERE batch_id=$1) AS residents, (SELECT count(*)::integer FROM tract_urban_surroundings WHERE batch_id=$1) AS tracts,
        (SELECT count(*)::integer FROM tract_urban_surroundings WHERE batch_id=$1 AND counts IS NULL) AS suppressed`, [id]);
      const check = stored.rows[0]!;
      if (check.municipalities !== totals.municipalities || Number(check.residents) !== totals.residents || check.tracts !== totals.associatedSurveyed || check.suppressed !== totals.associatedSuppressed) throw new Error('Entorno gravado não confere.');
      await preparePublication(client, { id, scope: SCOPE, inputs, report: { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) } });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }

    console.log(JSON.stringify({ published: id, scope: SCOPE, totals, elapsedSeconds: Math.round((performance.now() - started) / 1000) }, null, 2));
  } finally { client.release(); await pool.end(); }
}
if (require.main === module) run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Entorno dos domicílios falhou.'); process.exitCode = 1; });
