import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { incomeBandOf, incomeBandPopulationSchema, incomeBandsDatasetSchema, INCOME_BANDS, type IncomeBandPopulation } from '@observatorio/contracts';
import { entries, rows } from './csv';
import { ROOT } from './sources';
import { preservedDownload, sidraValue } from './sidra';

/**
 * Moradores por faixa fixa de renda do setor (Censo 2022, universo): para cada setor do arquivo de rendimento do responsável,
 * os moradores em domicílios particulares permanentes ocupados (V06002) entram na faixa da mediana do setor (V06006). Inclui
 * todos os setores, com ou sem local de votação. Cada município confere com o V06002 do arquivo municipal do IBGE.
 */
const VERSION = 'income-bands-2022-v1';
const SCOPE = '2022/context/income-bands';
const IBGE = 'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel';
const empty = (): IncomeBandPopulation => ({ total: 0, bands: INCOME_BANDS.map((band) => ({ index: band.index, residents: 0, tracts: 0 })), noData: { residents: 0, tracts: 0 }, undisclosed: { tracts: 0 } });

/** Primeiro CSV do ZIP preservado. */
function csvEntry(zip: string) {
  const entry = entries(zip).find((name) => name.toLowerCase().endsWith('.csv'));
  if (!entry) throw new Error(`Sem CSV em ${zip}.`);
  return entry;
}
const value = (raw: string | undefined, label: string) => {
  if (raw === undefined) throw new Error(`${label}: campo ausente.`);
  return sidraValue(raw.replace(',', '.'));
};

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const tracts = await preservedDownload('agregados_setores_renda_responsavel', `${IBGE}/Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip`, 'setores', 'Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip', [], 'zip');
  const municipal = await preservedDownload('agregados_municipios_renda_responsavel', `${IBGE}/Agregados_por_municipios_renda_responsavel_BR_20260508_csv.zip`, 'setores', 'Agregados_por_municipios_renda_responsavel_BR_20260508_csv.zip', [], 'zip');
  const dictionary = await preservedDownload('dicionario_renda_responsavel', `${IBGE}/dicionario_de_dados_renda_responsavel_20260508.xlsx`, 'setores', 'dicionario_de_dados_renda_responsavel_20260508.xlsx', [], 'xlsx');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query(await readFile(resolve(__dirname, 'migrations/012-income-bands.sql'), 'utf8'));
    // UF de cada município pelo contexto municipal publicado (código IBGE validado contra a correspondência TSE–IBGE).
    const context = await client.query<{ ibge_code: string; uf: string }>("SELECT c.ibge_code, c.uf FROM municipality_context c JOIN import_batches b ON b.id=c.batch_id AND b.published AND b.scope='2022/context/municipal'");
    if (!context.rows.length) throw new Error('Contexto municipal precisa estar publicado.');
    const ufOf = new Map(context.rows.map((row) => [row.ibge_code, row.uf]));

    const byMunicipality = new Map<string, IncomeBandPopulation>(); let read = 0;
    for await (const row of rows(tracts.path, csvEntry(tracts.path))) {
      read++;
      const setor = row.CD_SETOR ?? '';
      if (!/^\d{15}$/.test(setor)) throw new Error(`Código de setor inválido: ${setor}.`);
      const code = setor.slice(0, 7);
      if (!ufOf.has(code)) throw new Error(`Setor ${setor} de município fora do contexto publicado.`);
      const item = byMunicipality.get(code) ?? empty();
      const residents = value(row.V06002, `${setor} V06002`), median = value(row.V06006, `${setor} V06006`);
      if (row.V06002 === 'X') { if (row.V06006 !== 'X') throw new Error(`${setor}: moradores omitidos e mediana divulgada.`); item.undisclosed.tracts++; }
      else if (residents === null) throw new Error(`${setor}: V06002 "${row.V06002}" não previsto.`);
      else if (median === null) { item.noData.residents += residents; item.noData.tracts++; item.total += residents; }
      else { const band = item.bands[incomeBandOf(median) - 1]!; band.residents += residents; band.tracts++; item.total += residents; }
      byMunicipality.set(code, item);
    }
    // Conferência por município: soma dos setores = V06002 do arquivo municipal (os setores "X" não entram no total do IBGE).
    let municipalRows = 0; const divergent: string[] = [];
    for await (const row of rows(municipal.path, csvEntry(municipal.path))) {
      municipalRows++;
      const code = row.CD_MUN ?? '';
      const total = value(row.V06002, `${code} V06002`);
      if (total === null || total !== byMunicipality.get(code)?.total) divergent.push(`${code}: municipal ${row.V06002}, setores ${byMunicipality.get(code)?.total ?? 'ausente'}`);
    }
    if (divergent.length) throw new Error(`${divergent.length} municípios divergem do total municipal do IBGE; publicação bloqueada. ${divergent.slice(0, 5).join('; ')}`);
    if (municipalRows !== byMunicipality.size || byMunicipality.size !== ufOf.size) throw new Error(`Municípios: ${municipalRows} no arquivo municipal, ${byMunicipality.size} nos setores, ${ufOf.size} no contexto.`);

    const totals = empty();
    for (const item of byMunicipality.values()) {
      incomeBandPopulationSchema.parse(item);
      totals.total += item.total; totals.noData.residents += item.noData.residents; totals.noData.tracts += item.noData.tracts; totals.undisclosed.tracts += item.undisclosed.tracts;
      for (const band of item.bands) { totals.bands[band.index - 1]!.residents += band.residents; totals.bands[band.index - 1]!.tracts += band.tracts; }
    }
    const sources = [{ ...tracts.source, rowsRead: read, rowsSelected: read }, { ...municipal.source, rowsRead: municipalRows, rowsSelected: municipalRows }, { ...dictionary.source, rowsRead: 0, rowsSelected: 0 }];
    const id = createHash('sha256').update(JSON.stringify({ version: VERSION, hashes: sources.map((source) => source.sha256) })).digest('hex');
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    for (const source of sources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes ?? 0]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}.`); return; }
    const dataset = incomeBandsDatasetSchema.parse({ id, kind: 'income-bands', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, sources,
      scope: 'Moradores em domicílios particulares permanentes ocupados (V06002, universo do Censo 2022) de todos os setores censitários, somados pela faixa fixa da renda mediana do responsável com rendimento no setor (V06006), em salários mínimos de 2022.',
      totals: { municipalities: byMunicipality.size, tracts: read, ...totals },
      notes: [`Soma dos setores igual ao V06002 do arquivo municipal do IBGE nos ${byMunicipality.size.toLocaleString('pt-BR')} municípios.`,
        `${totals.undisclosed.tracts.toLocaleString('pt-BR')} setores com dados omitidos pelo IBGE ("X"): moradores não divulgados e fora do total municipal; não estimados.`,
        `${totals.noData.tracts.toLocaleString('pt-BR')} setores sem mediana por não se aplicar ("."), com ${totals.noData.residents.toLocaleString('pt-BR')} moradores: contados no total, fora das faixas.`,
        'Moradores em domicílios particulares permanentes ocupados não incluem domicílios coletivos nem improvisados; o total difere da população residente do Censo.'] });
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, dataset]);
      await client.query('DELETE FROM municipality_income_bands WHERE batch_id=$1', [id]);
      const list = [...byMunicipality].map(([code, result]) => ({ code, uf: ufOf.get(code), result }));
      await client.query('INSERT INTO municipality_income_bands SELECT $1, x.code, x.uf, x.result FROM jsonb_to_recordset($2::jsonb) AS x(code text, uf text, result jsonb)', [id, JSON.stringify(list)]);
      const stored = await client.query<{ n: number; total: string }>("SELECT count(*)::integer AS n, sum((result->>'total')::bigint)::text AS total FROM municipality_income_bands WHERE batch_id=$1", [id]);
      if (stored.rows[0]!.n !== list.length || Number(stored.rows[0]!.total) !== totals.total) throw new Error('Faixas gravadas não conferem.');
      await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
      await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
    await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify({ dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000) }, null, 2));
    console.log(JSON.stringify({ published: id, scope: SCOPE, totals: dataset.totals, elapsedSeconds: Math.round((performance.now() - started) / 1000) }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Faixas de renda falharam.'); process.exitCode = 1; });
