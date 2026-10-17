import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { mapDatasetSchema, STATES } from '@observatorio/contracts';
import { rows } from './csv';
import { ROOT, sourceFile } from './sources';
import { preservedDownload, type PreservedSource } from './sidra';

/**
 * Malhas do IBGE (API de malhas v3, período 2022) para mapas coropléticos: Brasil por UF e cada UF por município.
 * Cada polígono traz o código IBGE (`codarea`), conferido contra a correspondência oficial TSE–IBGE: nenhum município a
 * mais, a menos ou repetido. Geometrias são só desenho; nenhuma medida é calculada a partir delas.
 */
// v2: municípios na qualidade mínima (v1 usava a intermediária, ~3× maior e sem ganho visível a 600 px).
const VERSION = 'maps-ibge-2022-v2';
const SCOPE = '2022/maps/ibge';
type Topology = { type: 'Topology'; objects: Record<string, { type: string; geometries: Array<{ properties?: { codarea?: string } }> }> };
const API = 'https://servicodados.ibge.gov.br/api/v3/malhas';

function codes(topology: Topology, label: string) {
  if (topology.type !== 'Topology') throw new Error(`${label}: resposta não é TopoJSON.`);
  const objects = Object.values(topology.objects);
  if (objects.length !== 1) throw new Error(`${label}: esperado um objeto na topologia.`);
  const list = objects[0]!.geometries.map((geometry) => geometry.properties?.codarea ?? '');
  if (list.some((code) => !/^\d+$/.test(code)) || new Set(list).size !== list.length) throw new Error(`${label}: códigos ausentes ou repetidos.`);
  return list;
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const correspondence = await sourceFile({ file: 'municipio_tse_ibge.zip', entry: 'municipio_tse_ibge.csv', directory: 'municipio_tse_ibge' });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/007-map-geometries.sql'), 'utf8'));
    // Municípios publicados (Presidência nacional) com o código IBGE da correspondência oficial.
    const published = await client.query<{ uf: string; code: string }>("SELECT DISTINCT m.uf, m.code FROM municipality_results m JOIN import_batches b ON b.id=m.batch_id AND b.published AND b.scope='2022/president/BR' WHERE m.uf<>'ZZ'");
    const publishedKeys = new Set(published.rows.map((row) => `${row.uf}/${row.code}`));
    const expected = new Map<string, Set<string>>(); const ufCodes = new Map<string, string>();
    for await (const row of rows(correspondence.path, correspondence.entry)) {
      if (!publishedKeys.has(`${row.SG_UF}/${row.CD_MUNICIPIO_TSE}`)) continue;
      ufCodes.set(row.SG_UF!, row.CD_UF_IBGE!);
      const set = expected.get(row.SG_UF!) ?? new Set(); set.add(row.CD_MUNICIPIO_IBGE!); expected.set(row.SG_UF!, set);
    }
    if ([...expected.values()].reduce((sum, set) => sum + set.size, 0) !== 5570) throw new Error('Correspondência não cobre os 5.570 municípios publicados.');
    const sources: PreservedSource[] = []; const topologies: Array<{ level: 'uf' | 'municipality'; uf: string; topology: Topology }> = [];
    const ufs = await preservedDownload('malha_br_uf', `${API}/paises/BR?formato=application/json&intrarregiao=UF&qualidade=minima&periodo=2022`, 'malhas', 'Brasil por UF, qualidade mínima, 2022');
    const ufTopology = JSON.parse(ufs.bytes.toString('utf8')) as Topology;
    const ufList = codes(ufTopology, 'Brasil por UF');
    if (ufList.sort().join() !== [...ufCodes.values()].sort().join()) throw new Error('Malha de UFs não corresponde às 27 UFs.');
    sources.push({ ...ufs.source, rowsRead: ufList.length, rowsSelected: ufList.length }); topologies.push({ level: 'uf', uf: 'BR', topology: ufTopology });
    for (const uf of STATES) {
      const result = await preservedDownload(`malha_${uf.toLowerCase()}_municipios_minima`, `${API}/estados/${ufCodes.get(uf)}?formato=application/json&intrarregiao=municipio&qualidade=minima&periodo=2022`, 'malhas', `${uf} por município, qualidade mínima, 2022`);
      const topology = JSON.parse(result.bytes.toString('utf8')) as Topology;
      const list = codes(topology, `${uf} por município`);
      const missing = [...expected.get(uf)!].filter((code) => !list.includes(code)); const extra = list.filter((code) => !expected.get(uf)!.has(code));
      if (missing.length || extra.length) throw new Error(`Malha de ${uf}: faltam ${missing.join(', ') || 'nenhum'}; sobram ${extra.join(', ') || 'nenhum'}. Importação bloqueada.`);
      sources.push({ ...result.source, rowsRead: list.length, rowsSelected: list.length }); topologies.push({ level: 'municipality', uf, topology });
    }
    const { path: _path, ...correspondenceSource } = correspondence;
    const allSources = [{ ...correspondenceSource, generatedAt: [], rowsRead: 5571, rowsSelected: 5570 }, ...sources];
    const id = createHash('sha256').update(JSON.stringify({ version: VERSION, hashes: allSources.map((source) => source.sha256) })).digest('hex');
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}.`); return; }
    const dataset = mapDatasetSchema.parse({ id, kind: 'maps', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, sources: allSources,
      scope: 'Malhas do IBGE (2022): Brasil por UF (qualidade mínima) e UFs por município (qualidade mínima), ligadas aos municípios do TSE pelo código IBGE da correspondência oficial.' });
    for (const source of allSources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes]);
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, dataset]);
      await client.query('DELETE FROM map_geometries WHERE batch_id=$1', [id]);
      for (const item of topologies) await client.query('INSERT INTO map_geometries VALUES($1,$2,$3,$4)', [id, item.level, item.uf, item.topology]);
      await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
      await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
    await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify({ dataset, topologies: topologies.map((item) => ({ level: item.level, uf: item.uf })) }, null, 2));
    console.log(JSON.stringify({ published: id, scope: SCOPE, topologies: topologies.length }));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Importação das malhas falhou.'); process.exitCode = 1; });
