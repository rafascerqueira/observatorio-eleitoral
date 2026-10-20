import { reusePublished, publicationId, publishedInputs, preparePublication } from './publication';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { config } from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import { tractDisplayDatasetSchema, TRACT_DISPLAY } from '@observatorio/contracts';
import { ROOT } from './sources';
import { preservedDownload } from './sidra';
import { IBGE } from './sectors';

/**
 * Fase B3: desenho dos setores para o mapa local → setor, calculado uma vez a partir da malha publicada (`2022/geo/tracts`).
 * Cada vista (município; se o desenho passar do limite, distritos; se ainda passar ou houver um só distrito, subdistritos) é
 * simplificada com `ST_CoverageSimplify` na tolerância de ~1 px e projetada em equirretangular com correção de cos(latitude).
 * Setores com geometria inválida na fonte ficam fora da simplificação de cobertura e são desenhados exatos, sem reparo.
 * Nenhum valor é desenhado aqui: a cor vem, na consulta, de indicadores do Censo publicados à parte.
 */
const VERSION = 'tract-display-2022-v1';
const SCOPE = '2022/geo/tract-display';
const { width: WIDTH, maxHeight: MAX_HEIGHT, margin: MARGIN, gzipLimit: GZIP_LIMIT } = TRACT_DISPLAY;
type Level = 'municipality' | 'district' | 'subdistrict';
type View = { id: string; mun: string; level: Level; name: string | null };
type Stored = { views: number; served: number; split: number; oversizeServed: string[]; tracts: number; simplified: number; exact: number; invalidAfter: number; emptyPaths: number; svgBytes: number; gzipBytes: number };

/** Nomes de distritos e subdistritos no GeoPackage preservado (só atributos). */
function divisionNames(gpkg: string) {
  const db = new DatabaseSync(gpkg, { readOnly: true });
  const table = JSON.stringify((db.prepare("SELECT table_name FROM gpkg_contents WHERE data_type='features'").get() as { table_name: string }).table_name);
  const names = new Map<string, string>();
  for (const row of db.prepare(`SELECT DISTINCT CD_DIST, NM_DIST, CD_SUBDIST, NM_SUBDIST FROM ${table}`).iterate() as Iterable<{ CD_DIST: string; NM_DIST: string; CD_SUBDIST: string; NM_SUBDIST: string | null }>) {
    for (const [code, name] of [[String(row.CD_DIST), row.NM_DIST], [String(row.CD_SUBDIST), row.NM_SUBDIST]] as const) {
      const known = names.get(code);
      if (known !== undefined && known !== (name ?? '')) throw new Error(`Divisão ${code} com nomes diferentes no GeoPackage.`);
      names.set(code, name ?? '');
    }
  }
  db.close();
  return names;
}

/** Vistas menores de uma vista acima do limite: distritos se houver mais de um; senão (ou abaixo de um distrito), subdistritos. */
async function children(client: PoolClient, batch: string, view: View, names: Map<string, string>): Promise<View[]> {
  const prefixes = async (length: number) => (await client.query<{ prefix: string }>('SELECT DISTINCT left(cd_setor, $3) AS prefix FROM tract_geometries WHERE batch_id=$1 AND cd_mun=$2 AND left(cd_setor, $4)=$5 ORDER BY 1',
    [batch, view.mun, length, view.id.length, view.id])).rows.map((row) => row.prefix);
  if (view.level === 'municipality') {
    const districts = await prefixes(9);
    if (districts.length > 1) return districts.map((id) => ({ id, mun: view.mun, level: 'district' as const, name: names.get(id) || null }));
  }
  if (view.level === 'subdistrict') return [];
  const subdistricts = await prefixes(11);
  return subdistricts.length > 1 ? subdistricts.map((id) => ({ id, mun: view.mun, level: 'subdistrict' as const, name: names.get(id) || null })) : [];
}

/** Desenha uma vista; se passar do limite e puder ser dividida, guarda só a vista (split) e desce às menores. */
async function draw(client: PoolClient, id: string, source: string, view: View, names: Map<string, string>, stored: Stored) {
  const filter = 'batch_id=$1 AND cd_mun=$2 AND left(cd_setor, $3)=$4';
  const params = [source, view.mun, view.id.length, view.id];
  const box = (await client.query<{ x0: number; x1: number; y0: number; y1: number; n: number }>(`SELECT ST_XMin(e) x0, ST_XMax(e) x1, ST_YMin(e) y0, ST_YMax(e) y1, n FROM (
    SELECT ST_Extent(geom)::geometry e, count(*)::int n FROM tract_geometries WHERE ${filter}) s`, params)).rows[0]!;
  if (!box.n) throw new Error(`Vista ${view.id} sem setores.`);
  const kx = Math.cos((box.y0 + box.y1) / 2 * Math.PI / 180);
  const spanX = Math.max((box.x1 - box.x0) * kx, 1e-9), spanY = Math.max(box.y1 - box.y0, 1e-9);
  const scale = Math.min((WIDTH - 2 * MARGIN) / spanX, (MAX_HEIGHT - 2 * MARGIN) / spanY);
  const offsetX = MARGIN + ((WIDTH - 2 * MARGIN) - spanX * scale) / 2, height = Math.ceil(spanY * scale) + 2 * MARGIN, tolerance = 1 / scale;
  // ST_AsSVG nega o Y: y' = lat·scale − (y1·scale + margem) resulta em y = margem + (y1 − lat)·scale no SVG.
  const affine = `ST_Affine(g, ${kx * scale}, 0, 0, ${scale}, ${offsetX - box.x0 * kx * scale}, ${-(box.y1 * scale + MARGIN)})`;
  const rows = (await client.query<{ cd_setor: string; path: string; simplified: boolean; valid: boolean }>(`SELECT cd_setor, ST_AsSVG(${affine}, 1, 1) AS path, simplified, ST_IsValid(g) AS valid FROM (
      SELECT cd_setor, ST_CoverageSimplify(geom, ${tolerance}) OVER () AS g, true AS simplified FROM tract_geometries WHERE ${filter} AND valid
      UNION ALL SELECT cd_setor, geom, false FROM tract_geometries WHERE ${filter} AND NOT valid) s ORDER BY cd_setor`, params)).rows;
  if (rows.length !== box.n) throw new Error(`Vista ${view.id}: ${rows.length} desenhos para ${box.n} setores.`);
  const svg = rows.map((row) => `<path d="${row.path}"/>`).join('');
  const svgBytes = Buffer.byteLength(svg), gzipBytes = gzipSync(svg).length, oversize = gzipBytes > GZIP_LIMIT;
  const smaller = oversize ? await children(client, source, view, names) : [];
  const split = smaller.length > 0;
  await client.query(`INSERT INTO tract_display_views VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
    [id, view.id, view.mun, view.level, view.name, box.x0, box.y1, kx, scale, offsetX, MARGIN, WIDTH, height, tolerance, box.n, svgBytes, gzipBytes, oversize, split]);
  stored.views++;
  if (split) { stored.split++; for (const child of smaller) await draw(client, id, source, child, names, stored); return; }
  await client.query('INSERT INTO tract_display SELECT $1, $2, x.s, x.p, x.f FROM unnest($3::text[], $4::text[], $5::boolean[]) AS x(s, p, f)',
    [id, view.id, rows.map((row) => row.cd_setor), rows.map((row) => row.path), rows.map((row) => row.simplified)]);
  stored.served++; stored.tracts += rows.length; stored.svgBytes += svgBytes; stored.gzipBytes += gzipBytes;
  if (oversize) stored.oversizeServed.push(`${view.id} (${Math.round(gzipBytes / 1024)} KB)`);
  for (const row of rows) { if (row.simplified) stored.simplified++; else stored.exact++; if (row.simplified && !row.valid) stored.invalidAfter++; if (!/\d/.test(row.path)) stored.emptyPaths++; }
}

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const gpkg = await preservedDownload('br_setores_cd2022', `${IBGE}/malha_com_atributos/setores/gpkg/BR/BR_setores_CD2022.gpkg`, 'setores', 'BR_setores_CD2022.gpkg (malha de setores com atributos)', [], 'gpkg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'migrations/019-tract-maps.sql'), 'utf8'));
    const inputs = await publishedInputs(client, ['2022/geo/tracts']);
    const source = inputs[0]!.id;
    const drawing = { width: WIDTH, maxHeight: MAX_HEIGHT, margin: MARGIN, gzipLimit: GZIP_LIMIT, tolerancePx: 1, precision: 1 };
    const id = publicationId(VERSION, [gpkg.source.sha256], inputs, drawing);
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { console.log(`Já publicado: ${id}.`); return; }
    const names = divisionNames(gpkg.path);
    const municipalities = (await client.query<{ cd_mun: string }>("SELECT DISTINCT cd_mun FROM tract_geometries WHERE batch_id=$1 AND cd_mun ~ '^\\d{7}$' ORDER BY 1", [source])).rows.map((row) => row.cd_mun);
    // Exclusão declarada: polígonos da malha sem município (CD_MUN "0", sem nome nem situação; no RS, na posição das lagoas dos Patos e Mirim).
    const outside = (await client.query<{ cd_setor: string; cd_mun: string; km2: number }>("SELECT cd_setor, cd_mun, round(ST_Area(geom::geography) / 1e6)::int AS km2 FROM tract_geometries WHERE batch_id=$1 AND cd_mun !~ '^\\d{7}$' ORDER BY 1", [source])).rows;
    if (municipalities.length !== 5570) throw new Error(`Malha com ${municipalities.length} municípios; esperados os 5.570 do Censo 2022.`);
    if (outside.some((row) => row.cd_mun !== '0')) throw new Error(`Setores com município fora do padrão: ${outside.map((row) => `${row.cd_setor}/${row.cd_mun}`).join(', ')}.`);
    const stored: Stored = { views: 0, served: 0, split: 0, oversizeServed: [], tracts: 0, simplified: 0, exact: 0, invalidAfter: 0, emptyPaths: 0, svgBytes: 0, gzipBytes: 0 };
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, SCOPE, { kind: 'tract-display', pending: true }]);
      await client.query('DELETE FROM tract_display WHERE batch_id=$1', [id]);
      await client.query('DELETE FROM tract_display_views WHERE batch_id=$1', [id]);
      for (const [index, mun] of municipalities.entries()) {
        await draw(client, id, source, { id: mun, mun, level: 'municipality', name: null }, names, stored);
        if ((index + 1) % 500 === 0) console.log(`${(index + 1).toLocaleString('pt-BR')} municípios desenhados (${Math.round((performance.now() - started) / 1000)} s).`);
      }
      // Cada setor da malha em exatamente uma vista servida; nenhuma vista servida sem caminhos nem dividida com caminhos.
      const check = (await client.query<{ tracts: number; drawn: number; distinct: number; orphan: number; splitWithPaths: number }>(`SELECT
        (SELECT count(*)::int FROM tract_geometries WHERE batch_id=$2 AND cd_mun ~ '^\\d{7}$') AS tracts, (SELECT count(*)::int FROM tract_display WHERE batch_id=$1) AS drawn,
        (SELECT count(DISTINCT cd_setor)::int FROM tract_display WHERE batch_id=$1) AS distinct,
        (SELECT count(*)::int FROM tract_display_views v WHERE batch_id=$1 AND NOT split AND NOT EXISTS (SELECT 1 FROM tract_display d WHERE d.batch_id=v.batch_id AND d.view_id=v.view_id)) AS orphan,
        (SELECT count(*)::int FROM tract_display_views v WHERE batch_id=$1 AND split AND EXISTS (SELECT 1 FROM tract_display d WHERE d.batch_id=v.batch_id AND d.view_id=v.view_id)) AS "splitWithPaths"`, [id, source])).rows[0]!;
      if (check.tracts !== check.drawn || check.drawn !== check.distinct || check.orphan || check.splitWithPaths || check.drawn !== stored.tracts) throw new Error(`Desenho não confere com a malha: ${JSON.stringify(check)}; publicação bloqueada.`);
      if (stored.emptyPaths) throw new Error(`${stored.emptyPaths} setores sem desenho depois da simplificação; publicação bloqueada.`);
      const sizes = (await client.query<{ total: string }>("SELECT (pg_total_relation_size('tract_display') + pg_total_relation_size('tract_display_views'))::text AS total")).rows[0]!;
      const levels = (await client.query<{ level: Level; n: number }>('SELECT level, count(*)::int AS n FROM tract_display_views WHERE batch_id=$1 AND NOT split GROUP BY level', [id])).rows;
      const served = Object.fromEntries(levels.map((row) => [row.level, row.n])) as Partial<Record<Level, number>>;
      const totals = { municipalities: municipalities.length, tracts: stored.tracts, excludedTracts: outside.length, views: stored.views, servedViews: stored.served, splitViews: stored.split,
        districtViews: served.district ?? 0, subdistrictViews: served.subdistrict ?? 0, exactTracts: stored.exact, invalidAfterSimplify: stored.invalidAfter, oversizeServed: stored.oversizeServed.length };
      const sourceEntry = { ...gpkg.source, rowsRead: 0, rowsSelected: 0 };
      const dataset = tractDisplayDatasetSchema.parse({ id, kind: 'tract-display', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, inputs, sources: [sourceEntry], totals, config: drawing,
        scope: 'Desenho simplificado dos setores censitários do Censo 2022 por município (e por distrito ou subdistrito nos municípios grandes), para o mapa local → setor; sem valores associados.',
        notes: [`Simplificação de cobertura (ST_CoverageSimplify) com tolerância de 1 px na largura de ${WIDTH} px, a partir da malha ${source}; ${stored.exact} setores com geometria inválida na fonte desenhados exatos, sem reparo.`,
          `Vista do município dividida quando o desenho comprimido passa de ${Math.round(GZIP_LIMIT / 1024)} KB: ${stored.split} vistas divididas, ${served.district ?? 0} de distrito e ${served.subdistrict ?? 0} de subdistrito servidas.`,
          `${stored.invalidAfter} desenhos simplificados inválidos (afeta só o traço, não a associação nem os dados); os setores inválidos na fonte, desenhados exatos, não entram nessa conta.`,
          ...(stored.oversizeServed.length ? [`Vistas servidas acima do limite por não haver divisão menor: ${stored.oversizeServed.join(', ')}.`] : []),
          ...(outside.length ? [`${outside.length} polígonos da malha sem município (CD_MUN "0", sem nome nem situação) fora do desenho: ${outside.map((row) => `${row.cd_setor} (${row.km2.toLocaleString('pt-BR')} km²)`).join(', ')}.`] : []),
          'Nomes de distritos e subdistritos do GeoPackage preservado (atributos NM_DIST e NM_SUBDIST).'] });
      await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
      const report = { dataset, svgBytes: stored.svgBytes, gzipBytes: stored.gzipBytes, tableBytes: Number(sizes.total), elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
      await preparePublication(client, { id, scope: SCOPE, inputs, report });
      await client.query('COMMIT');
      console.log(JSON.stringify({ published: id, scope: SCOPE, totals, tableMb: Math.round(Number(sizes.total) / 2 ** 20), elapsedSeconds: report.elapsedSeconds }, null, 2));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { client.release(); await pool.end(); }
}
if (require.main === module) run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Desenho dos setores falhou.'); process.exitCode = 1; });
