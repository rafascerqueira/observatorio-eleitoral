// Ensaio B1 do plano de melhorias (docs/plano-postgis-propostas.md): malha de setores preservada carregada em tabelas
// temporárias, dentro de uma transação desfeita no fim. Nenhuma tabela pública é escrita; o relatório vai para data/analysis.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { config } from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import { loadTracts } from '../apps/importer/src/sectors';

const WIDTH = 600; // largura dos mapas da interface, em px
const MUNICIPALITIES: Record<string, string> = { '3550308': 'São Paulo', '3304557': 'Rio de Janeiro', '5300108': 'Brasília', '3106200': 'Belo Horizonte', '1100080': 'Município mediano (30 setores)' };
const seconds = (start: number) => Math.round((performance.now() - start) / 100) / 10;
const kb = (bytes: number) => Math.round(bytes / 1024);

/** Etapa opcional: um erro do PostGIS (ex.: cobertura inválida) é registrado sem abortar a transação do ensaio. */
async function step<T>(client: PoolClient, run: () => Promise<T>): Promise<{ value?: T; error?: string; seconds: number }> {
  const start = performance.now();
  await client.query('SAVEPOINT etapa');
  try { const value = await run(); await client.query('RELEASE SAVEPOINT etapa'); return { value, seconds: seconds(start) }; }
  catch (error) { await client.query('ROLLBACK TO SAVEPOINT etapa'); return { error: error instanceof Error ? error.message : String(error), seconds: seconds(start) }; }
}

/** Tamanho do desenho de um conjunto de setores na largura dos mapas: bruto e com `ST_CoverageSimplify` na tolerância de ~1 px. */
async function drawing(client: PoolClient, label: string, filter: string, value: string) {
  const box = (await client.query<{ x0: number; x1: number; y0: number; y1: number; n: number }>(`SELECT ST_XMin(e) x0, ST_XMax(e) x1, ST_YMin(e) y0, ST_YMax(e) y1, n FROM (SELECT ST_Extent(geom)::geometry e, count(*)::int n FROM tracts WHERE ${filter}=$1) s`, [value])).rows[0]!;
  // Equiretangular com correção de cos(latitude) só para medir o tamanho; a interface usaria a sua própria projeção.
  const kx = Math.cos((box.y0 + box.y1) / 2 * Math.PI / 180), scale = WIDTH / ((box.x1 - box.x0) * kx), tolerance = 1 / scale;
  const affine = `ST_Affine(geom, ${kx * scale}, 0, 0, ${-scale}, ${-box.x0 * kx * scale}, ${box.y1 * scale})`;
  const raw = (await client.query<{ bytes: string; points: string }>(`SELECT sum(length(ST_AsSVG(${affine}, 0, 1)))::text AS bytes, sum(ST_NPoints(geom))::text AS points FROM tracts WHERE ${filter}=$1`, [value])).rows[0]!;
  const simplified = await step(client, async () => {
    const rows = (await client.query<{ path: string; points: number; valid: boolean }>(`SELECT ST_AsSVG(${affine}, 0, 1) AS path, ST_NPoints(geom) AS points, ST_IsValid(geom) AS valid FROM (
      SELECT ST_CoverageSimplify(geom, ${tolerance}) OVER () AS geom FROM tracts WHERE ${filter}=$1) s`, [value])).rows;
    const svg = rows.map((row) => `<path d="${row.path}"/>`).join('');
    return { bytes: Buffer.byteLength(svg), gzipBytes: gzipSync(svg).length, points: rows.reduce((sum, row) => sum + row.points, 0), invalid: rows.filter((row) => !row.valid).length };
  });
  const result = { label, tracts: box.n, heightPx: Math.round((box.y1 - box.y0) * scale), toleranceDegrees: tolerance, rawPoints: Number(raw.points), rawSvgKb: kb(Number(raw.bytes)),
    simplified: simplified.value ? { svgKb: kb(simplified.value.bytes), gzipKb: kb(simplified.value.gzipBytes), points: simplified.value.points, invalidAfter: simplified.value.invalid } : null, error: simplified.error ?? null, seconds: simplified.seconds };
  console.log(JSON.stringify(result));
  return result;
}

async function sha256(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function run() {
  config({ path: resolve('.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  let publicBefore: string | null = null;
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), sideEffects: 'Somente tabelas temporárias numa transação desfeita (ROLLBACK); nenhuma escrita em tabelas públicas.' };
  try {
    // Mesmo GeoPackage da associação publicada, conferido pelo SHA-256 antes de usar.
    const tracts = (await client.query<{ id: string; metadata: { importerVersion: string; sources: Array<{ file: string; sha256: string }> } }>("SELECT id, metadata FROM import_batches WHERE published AND scope='2022/places/tracts'")).rows[0];
    assert.ok(tracts, 'Associação local → setor precisa estar publicada.');
    const source = tracts.metadata.sources.find((item) => item.file === 'br_setores_cd2022.gpkg');
    assert.ok(source, 'GeoPackage ausente das fontes da associação.');
    const gpkg = resolve('data/originals', source.sha256, source.file);
    let start = performance.now();
    assert.equal(await sha256(gpkg), source.sha256, 'GeoPackage preservado com SHA-256 divergente.');
    report.source = { file: source.file, sha256: source.sha256, publication: tracts.id, importerVersion: tracts.metadata.importerVersion, hashSeconds: seconds(start) };
    publicBefore = (await client.query<{ n: string }>("SELECT count(*)::text || '/' || count(*) FILTER (WHERE published)::text AS n FROM import_batches")).rows[0]!.n;
    report.settings = Object.fromEntries((await client.query<{ name: string; setting: string; unit: string | null }>("SELECT name, setting, unit FROM pg_settings WHERE name IN ('shared_buffers','work_mem','maintenance_work_mem','temp_buffers','max_wal_size','max_parallel_workers_per_gather')")).rows.map((row) => [row.name, `${row.setting}${row.unit ?? ''}`]));

    await client.query('BEGIN');
    start = performance.now();
    const loaded = await loadTracts(client, gpkg);
    const sizes = (await client.query<{ table: string; total: string; indexes: string }>("SELECT pg_relation_size('pg_temp.tracts')::text AS table, pg_total_relation_size('pg_temp.tracts')::text AS total, pg_indexes_size('pg_temp.tracts')::text AS indexes")).rows[0]!;
    report.load = { ...loaded, seconds: seconds(start), tableMb: Math.round(Number(sizes.table) / 2 ** 20), indexesMb: Math.round(Number(sizes.indexes) / 2 ** 20), totalMb: Math.round(Number(sizes.total) / 2 ** 20), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
    console.log('carga', JSON.stringify(report.load));

    // Validade: setor unido e, para os inválidos, se cada parte é válida (ST_Collect de partes adjacentes pode invalidar a coleção).
    report.validity = await step(client, async () => {
      const reasons = (await client.query<{ reason: string; tracts: number; multipart: number; partsValid: number }>(`SELECT reason, count(*)::int AS tracts, count(*) FILTER (WHERE parts > 1)::int AS multipart, count(*) FILTER (WHERE parts_valid)::int AS "partsValid"
        FROM (SELECT split_part(ST_IsValidReason(geom), '[', 1) AS reason, parts, NOT EXISTS (SELECT 1 FROM ST_Dump(geom) d WHERE NOT ST_IsValid(d.geom)) AS parts_valid FROM tracts WHERE NOT ST_IsValid(geom)) s GROUP BY 1 ORDER BY 2 DESC`)).rows;
      const examples = (await client.query<{ cd_setor: string; reason: string }>('SELECT cd_setor, ST_IsValidReason(geom) AS reason FROM tracts WHERE NOT ST_IsValid(geom) ORDER BY cd_setor LIMIT 5')).rows;
      return { invalid: reasons.reduce((sum, row) => sum + row.tracts, 0), reasons, examples };
    });
    console.log('validade', JSON.stringify(report.validity));

    // Cobertura por município (sobreposições e lacunas entre setores vizinhos), só com setores válidos.
    report.coverage = await step(client, async () => {
      await client.query('CREATE TEMP TABLE coverage_edges AS SELECT cd_mun, cd_setor, ST_CoverageInvalidEdges(geom, 0) OVER (PARTITION BY cd_mun) AS edges FROM tracts WHERE ST_IsValid(geom)');
      const summary = (await client.query<{ checked: number; tracts: number; municipalities: number }>('SELECT count(*)::int AS checked, count(*) FILTER (WHERE edges IS NOT NULL)::int AS tracts, count(DISTINCT cd_mun) FILTER (WHERE edges IS NOT NULL)::int AS municipalities FROM coverage_edges')).rows[0]!;
      const top = (await client.query<{ cd_mun: string; tracts: number }>('SELECT cd_mun, count(*)::int AS tracts FROM coverage_edges WHERE edges IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 5')).rows;
      return { ...summary, top };
    });
    console.log('cobertura', JSON.stringify(report.coverage));

    // Equivalência com a associação publicada: mesmos pontos (coordenada única, local não realocado) recontados na malha temporária.
    report.equivalence = await step(client, async () => {
      const rows = (await client.query<{ status: string; total: number; equal: number }>(`WITH pub AS (SELECT p.* FROM polling_place_tracts p WHERE p.batch_id=$1 AND p.status IN ('associated','outside-tracts','ambiguous','other-municipality')),
        hit AS (SELECT pub.status, pub.cd_setor, pub.ibge_code, h.n, h.setor, h.mun FROM pub LEFT JOIN LATERAL (SELECT count(*)::int AS n, min(t.cd_setor) AS setor, min(t.cd_mun) AS mun FROM tracts t
          WHERE ST_Intersects(t.geom, ST_SetSRID(ST_MakePoint(pub.longitude, pub.latitude), 4674))) h ON true)
        SELECT status, count(*)::int AS total, count(*) FILTER (WHERE (CASE WHEN n = 0 THEN 'outside-tracts' WHEN n > 1 THEN 'ambiguous' WHEN mun <> ibge_code THEN 'other-municipality' ELSE 'associated' END) = status
          AND (status <> 'associated' OR setor = cd_setor))::int AS equal FROM hit GROUP BY 1 ORDER BY 1`, [tracts.id])).rows;
      return { byStatus: rows, total: rows.reduce((sum, row) => sum + row.total, 0), equal: rows.reduce((sum, row) => sum + row.equal, 0) };
    });
    console.log('equivalência', JSON.stringify(report.equivalence));

    // Representação: municípios de referência e o maior distrito de São Paulo (código do distrito contido no CD_SETOR).
    const drawings: Array<Awaited<ReturnType<typeof drawing>>> = [];
    for (const [code, label] of Object.entries(MUNICIPALITIES)) drawings.push(await drawing(client, `${label} (${code})`, 'cd_mun', code));
    const district = (await client.query<{ district: string; n: number }>("SELECT left(cd_setor, 9) AS district, count(*)::int AS n FROM tracts WHERE cd_mun='3550308' GROUP BY 1 ORDER BY 2 DESC LIMIT 1")).rows[0]!;
    drawings.push(await drawing(client, `Maior distrito de São Paulo (${district.district})`, 'left(cd_setor, 9)', district.district));
    report.drawings = drawings;
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    report.rolledBack = (await client.query<{ temp: string | null }>("SELECT to_regclass('pg_temp.tracts')::text AS temp")).rows[0]!.temp === null;
    const publicAfter = (await client.query<{ n: string }>("SELECT count(*)::text || '/' || count(*) FILTER (WHERE published)::text AS n FROM import_batches")).rows[0]!.n;
    report.publicBatches = { before: publicBefore, after: publicAfter, unchanged: publicBefore === publicAfter };
    report.elapsedSeconds = seconds(started);
    client.release(); await pool.end();
  }
  const directory = resolve('data/analysis', `geo-ensaio-${new Date().toISOString().replaceAll(':', '-')}`);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ status: 'ok', report: directory, rolledBack: report.rolledBack, elapsedSeconds: report.elapsedSeconds }));
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
