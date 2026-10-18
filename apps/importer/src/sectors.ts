import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import { tractsDatasetSchema, STATES } from '@observatorio/contracts';
import { count, entries, rows } from './csv';
import { ROOT, sourceFile } from './sources';
import { preservedDownload, sidraValue } from './sidra';
import { municipalityCode } from './territory';

/**
 * Fase 3: local de votação → setor censitário do Censo 2022. Método v1: o setor que contém a coordenada do local
 * informada pelo TSE (ST_Intersects), aceito só se for único e do município esperado pelo código IBGE oficial.
 * Nada é escolhido em caso de dúvida: locais sem coordenada, com coordenadas conflitantes, fora dos setores, em setor de
 * outro município ou na divisa de dois setores ficam sem associação, contados e declarados.
 */
// v2: aceita coordenadas sem zero inicial (".85"); a v1 as descartava e deixava sem associação locais perto do Equador.
const VERSION = 'polling-place-tracts-2022-v2';
const SCOPE = '2022/places/tracts';
export const IBGE = 'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios';
const STATUSES = ['associated', 'no-coordinate', 'conflicting-coordinates', 'relocated', 'outside-tracts', 'other-municipality', 'ambiguous'] as const;
type Status = typeof STATUSES[number];
type Place = { uf: string; code: string; zone: number; local: string; ibge: string; names: Set<string>; coordinates: Set<string>; electors: number; relocated: boolean };

/** Geometria do GeoPackage: cabeçalho "GP" + envelope opcional, seguido do WKB (padrão OGC GeoPackage 1.x). */
export function gpkgWkb(blob: Uint8Array): Buffer | null {
  const bytes = Buffer.from(blob);
  if (bytes[0] !== 0x47 || bytes[1] !== 0x50) throw new Error('Geometria GeoPackage sem cabeçalho GP.');
  const flags = bytes[3]!;
  if (flags & 0b10000) return null; // geometria vazia
  const envelope = [0, 32, 48, 48, 64][(flags >> 1) & 0b111];
  if (envelope === undefined) throw new Error('Envelope GeoPackage inválido.');
  return bytes.subarray(8 + envelope);
}
/** Coordenada do TSE válida para o Brasil continental e ilhas; sentinelas e zeros não viram ponto. */
export function coordinate(latitude: string | undefined, longitude: string | undefined): [number, number] | null {
  // O TSE grava valores entre −1 e 1 sem o zero inicial (".85", "-.5"): são decimais válidos.
  const decimal = /^-?(\d+(\.\d*)?|\.\d+)$/;
  if (!latitude || !longitude || !decimal.test(latitude) || !decimal.test(longitude)) return null;
  const lat = Number(latitude), lon = Number(longitude);
  return lat > -34 && lat < 6 && lon > -74 && lon < -28 ? [lat, lon] : null;
}

export async function loadTracts(client: PoolClient, gpkgPath: string) {
  const db = new DatabaseSync(gpkgPath, { readOnly: true });
  const contents = db.prepare("SELECT table_name, srs_id FROM gpkg_contents WHERE data_type='features'").all() as Array<{ table_name: string; srs_id: number }>;
  if (contents.length !== 1) throw new Error(`GeoPackage com ${contents.length} camadas; esperada uma.`);
  const [{ table_name: table, srs_id: srid }] = contents as [{ table_name: string; srs_id: number }];
  if (srid !== 4674) throw new Error(`Malha de setores em SRID ${srid}; auditado: 4674 (SIRGAS 2000).`);
  const geometryColumn = (db.prepare('SELECT column_name FROM gpkg_geometry_columns WHERE table_name=?').get(table) as { column_name: string }).column_name;
  const columns = (db.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all() as Array<{ name: string }>).map((column) => column.name);
  for (const required of ['CD_SETOR', 'CD_MUN', 'SITUACAO']) if (!columns.includes(required)) throw new Error(`Malha de setores sem a coluna ${required}.`);
  // Setores descontínuos vêm em várias linhas (uma por parte, com os mesmos atributos): as partes são unidas por código.
  await client.query('CREATE TEMP TABLE tract_parts (cd_setor text NOT NULL, cd_mun text NOT NULL, situation text, geom geometry(MultiPolygon, 4674) NOT NULL)');
  let batch: { setor: string[]; mun: string[]; situation: string[]; wkb: Buffer[] } = { setor: [], mun: [], situation: [], wkb: [] }; let total = 0, empty = 0;
  const flush = async () => {
    if (!batch.setor.length) return;
    await client.query('INSERT INTO tract_parts SELECT s, m, t, ST_Multi(ST_GeomFromWKB(w, 4674)) FROM unnest($1::text[], $2::text[], $3::text[], $4::bytea[]) AS x(s, m, t, w)', [batch.setor, batch.mun, batch.situation, batch.wkb]);
    batch = { setor: [], mun: [], situation: [], wkb: [] };
  };
  for (const row of db.prepare(`SELECT CD_SETOR, CD_MUN, SITUACAO, ${JSON.stringify(geometryColumn)} AS geom FROM ${JSON.stringify(table)}`).iterate() as Iterable<{ CD_SETOR: string | number; CD_MUN: string | number; SITUACAO: string; geom: Uint8Array }>) {
    const wkb = gpkgWkb(row.geom);
    total++;
    if (!wkb) { empty++; continue; }
    batch.setor.push(String(row.CD_SETOR)); batch.mun.push(String(row.CD_MUN)); batch.situation.push(row.SITUACAO); batch.wkb.push(wkb);
    if (batch.setor.length === 2000) await flush();
    if (total % 100_000 === 0) console.log(`${total.toLocaleString('pt-BR')} setores carregados.`);
  }
  await flush();
  db.close();
  if (empty) throw new Error(`${empty} setores com geometria vazia; auditar a malha.`);
  const conflicts = await client.query<{ n: number }>('SELECT count(*)::integer AS n FROM (SELECT cd_setor FROM tract_parts GROUP BY cd_setor HAVING count(DISTINCT cd_mun) > 1 OR count(DISTINCT situation) > 1) c');
  if (conflicts.rows[0]!.n) throw new Error(`${conflicts.rows[0]!.n} setores com partes de atributos diferentes; importação bloqueada.`);
  await client.query('CREATE TEMP TABLE tracts AS SELECT cd_setor, min(cd_mun) AS cd_mun, min(situation) AS situation, ST_Multi(ST_CollectionExtract(ST_Collect(geom), 3))::geometry(MultiPolygon, 4674) AS geom, count(*)::integer AS parts FROM tract_parts GROUP BY cd_setor');
  await client.query('DROP TABLE tract_parts');
  await client.query('ALTER TABLE tracts ADD PRIMARY KEY (cd_setor)'); await client.query('CREATE INDEX ON tracts USING gist (geom)'); await client.query('ANALYZE tracts');
  const distinct = await client.query<{ n: number; parts: number }>('SELECT count(*)::integer AS n, count(*) FILTER (WHERE parts > 1)::integer AS parts FROM tracts');
  return { rows: total, tracts: distinct.rows[0]!.n, multipart: distinct.rows[0]!.parts };
}

/** Valores por setor de um agregado do IBGE (CSV do FTP), só para os setores pedidos (`null`: todos). */
export async function tractValues(zip: string, wanted: Set<string> | null, fields: string[]) {
  const values = new Map<string, Record<string, number | null>>();
  const entry = entries(zip).find((name) => name.toLowerCase().endsWith('.csv'));
  if (!entry) throw new Error(`Sem CSV em ${zip}.`);
  for await (const row of rows(zip, entry)) {
    const setor = row.CD_SETOR ?? row.CD_setor;
    if (!setor || (wanted && !wanted.has(setor))) continue;
    values.set(setor, Object.fromEntries(fields.map((field) => {
      const raw = (row[field] ?? row[field.toLowerCase()])?.replace(',', '.');
      if (raw === undefined) throw new Error(`Campo ${field} ausente em ${entry}.`);
      return [field, sidraValue(raw)];
    })));
  }
  return values;
}

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
    await client.query(await readFile(resolve(__dirname, 'migrations/009-polling-place-tracts.sql'), 'utf8'));

    // 1. Correspondência TSE–IBGE e locais do TSE (1º turno; o exterior não tem setor do IBGE).
    const correspondence = await sourceFile({ file: 'municipio_tse_ibge.zip', entry: 'municipio_tse_ibge.csv', directory: 'municipio_tse_ibge' });
    const ibgeOf = new Map<string, string>();
    for await (const row of rows(correspondence.path, correspondence.entry)) ibgeOf.set(`${row.SG_UF}/${municipalityCode(row.CD_MUNICIPIO_TSE!)}`, row.CD_MUNICIPIO_IBGE!);
    const locais = await sourceFile({ file: 'eleitorado_local_votacao_2022.zip', entry: 'eleitorado_local_votacao_2022.csv', directory: 'eleitorado_locais_votacao' });
    const places = new Map<string, Place>(); let localRows = 0; const generated = new Set<string>();
    for await (const row of rows(locais.path, locais.entry)) {
      localRows++;
      if (row.NR_TURNO !== '1' || row.SG_UF === 'ZZ') continue;
      generated.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
      const code = municipalityCode(row.CD_MUNICIPIO!);
      const ibge = ibgeOf.get(`${row.SG_UF}/${code}`);
      if (!ibge) throw new Error(`Local em município sem código IBGE: ${row.SG_UF}/${code}.`);
      // O cadastro foi gerado depois da eleição: o código do dia da eleição é o "original" (casa com 100% dos locais dos
      // resultados). Se a seção hoje aponta outro local, a coordenada pode ser do prédio novo: o local não é associado.
      const local = row.NR_LOCAL_VOTACAO_ORIGINAL && row.NR_LOCAL_VOTACAO_ORIGINAL !== '-1' ? row.NR_LOCAL_VOTACAO_ORIGINAL : row.NR_LOCAL_VOTACAO!;
      const key = `${row.SG_UF}/${code}/${count(row, 'NR_ZONA')}/${local}`;
      const place = places.get(key) ?? { uf: row.SG_UF!, code, zone: count(row, 'NR_ZONA'), local, ibge, names: new Set(), coordinates: new Set(), electors: 0, relocated: false };
      place.names.add(row.NM_LOCAL_VOTACAO_ORIGINAL || row.NM_LOCAL_VOTACAO || '');
      if (row.NR_LOCAL_VOTACAO !== local) place.relocated = true;
      const point = coordinate(row.NR_LATITUDE, row.NR_LONGITUDE);
      if (point) place.coordinates.add(point.join(','));
      place.electors += count(row, 'QT_ELEITOR_SECAO');
      places.set(key, place);
    }
    // Cobertura frente aos locais com votos publicados (Presidência nacional, 1º turno).
    const resultPlaces = await client.query<{ key: string }>(`SELECT DISTINCT p.uf || '/' || p.municipality_code || '/' || p.zone || '/' || p.code AS key FROM national_place_results p
      JOIN import_batches b ON b.id=p.batch_id AND b.published AND b.scope='2022/president/BR' WHERE p.round=1 AND p.uf<>'ZZ'`);
    const withoutLocal = resultPlaces.rows.filter((row) => !places.has(row.key)).map((row) => row.key);
    console.log(`${places.size.toLocaleString('pt-BR')} locais no cadastro do TSE; ${resultPlaces.rows.length.toLocaleString('pt-BR')} com votos publicados; ${withoutLocal.length} destes sem linha no cadastro de locais.`);

    // 2. Malha de setores e agregados do IBGE, preservados.
    const gpkg = await preservedDownload('br_setores_cd2022', `${IBGE}/malha_com_atributos/setores/gpkg/BR/BR_setores_CD2022.gpkg`, 'setores', 'BR_setores_CD2022.gpkg (malha de setores com atributos)', [], 'gpkg');
    const income = await preservedDownload('agregados_setores_renda_responsavel', `${IBGE}_Rendimento_do_Responsavel/Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip`, 'setores', 'Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip', [], 'zip');
    const basic = await preservedDownload('agregados_setores_basico', `${IBGE}/Agregados_por_Setor_csv/Agregados_por_setores_basico_BR_20260520.zip`, 'setores', 'Agregados_por_setores_basico_BR_20260520.zip', [], 'zip');
    const loaded = await loadTracts(client, gpkg.path);
    const tractCount = loaded.tracts;
    console.log(`${loaded.rows.toLocaleString('pt-BR')} linhas na malha; ${tractCount.toLocaleString('pt-BR')} setores (${loaded.multipart} com partes descontínuas, unidas).`);

    // 3. Associação ponto → setor, inteiramente no PostGIS.
    await client.query('CREATE TEMP TABLE places (uf text, code text, zone integer, local text, ibge text, name text, latitude double precision, longitude double precision, electors integer, coordinates integer, relocated boolean, point geometry(Point, 4674))');
    await client.query('CREATE INDEX ON places (ibge)');
    const list = [...places.values()];
    for (let start = 0; start < list.length; start += 5000) {
      const chunk = list.slice(start, start + 5000).map((place) => { const [lat, lon] = place.coordinates.size === 1 ? [...place.coordinates][0]!.split(',').map(Number) : [null, null];
        return { uf: place.uf, code: place.code, zone: place.zone, local: place.local, ibge: place.ibge, name: place.names.size === 1 ? [...place.names][0] : null, latitude: lat, longitude: lon, electors: place.electors, coordinates: place.coordinates.size, relocated: place.relocated }; });
      await client.query(`INSERT INTO places SELECT x.uf, x.code, x.zone, x.local, x.ibge, x.name, x.latitude, x.longitude, x.electors, x.coordinates, x.relocated,
        CASE WHEN x.latitude IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(x.longitude, x.latitude), 4674) END FROM jsonb_to_recordset($1::jsonb) AS x(uf text, code text, zone integer, local text, ibge text, name text, latitude double precision, longitude double precision, electors integer, coordinates integer, relocated boolean)`, [JSON.stringify(chunk)]);
    }
    const id = createHash('sha256').update(JSON.stringify({ version: VERSION, hashes: [correspondence.sha256, locais.sha256, gpkg.source.sha256, income.source.sha256, basic.source.sha256] })).digest('hex');
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}.`); return; }
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, SCOPE, { pending: true }]);
      await client.query('DELETE FROM polling_place_tracts WHERE batch_id=$1', [id]); await client.query('DELETE FROM census_tract_context WHERE batch_id=$1', [id]);
      await client.query(`INSERT INTO polling_place_tracts
        SELECT $1, p.uf, p.code, p.zone, p.local, p.ibge, p.name, p.latitude, p.longitude, p.electors,
          CASE WHEN p.relocated THEN 'relocated' WHEN p.coordinates = 0 THEN 'no-coordinate' WHEN p.coordinates > 1 THEN 'conflicting-coordinates' WHEN hit.n = 0 THEN 'outside-tracts'
            WHEN hit.n > 1 THEN 'ambiguous' WHEN hit.mun <> p.ibge THEN 'other-municipality' ELSE 'associated' END,
          coalesce(shared.n, 0), CASE WHEN NOT p.relocated AND p.coordinates = 1 AND hit.n = 1 AND hit.mun = p.ibge THEN hit.setor END
        FROM places p
        LEFT JOIN LATERAL (SELECT count(*)::integer AS n, min(t.cd_setor) AS setor, min(t.cd_mun) AS mun FROM tracts t WHERE p.point IS NOT NULL AND ST_Intersects(t.geom, p.point)) hit ON true
        LEFT JOIN LATERAL (SELECT count(DISTINCT o.name)::integer AS n FROM places o WHERE o.ibge = p.ibge AND o.point IS NOT NULL AND p.point IS NOT NULL AND ST_Equals(o.point, p.point) AND o.name IS DISTINCT FROM p.name) shared ON true`, [id]);
      // 4. Contexto só dos setores associados: população (universo) e rendimento do responsável (média e mediana).
      const associated = new Set((await client.query<{ cd_setor: string }>("SELECT DISTINCT cd_setor FROM polling_place_tracts WHERE batch_id=$1 AND status='associated'", [id])).rows.map((row) => row.cd_setor));
      const incomeValues = await tractValues(income.path, associated, ['V06001', 'V06004', 'V06006']);
      const basicValues = await tractValues(basic.path, associated, ['V0001']);
      const contextRows = [...associated].map((setor) => ({ setor, population: basicValues.get(setor)?.V0001 ?? null, responsible: incomeValues.get(setor)?.V06001 ?? null, mean: incomeValues.get(setor)?.V06004 ?? null, median: incomeValues.get(setor)?.V06006 ?? null }));
      for (let start = 0; start < contextRows.length; start += 5000) {
        await client.query(`INSERT INTO census_tract_context SELECT $1, x.setor, t.cd_mun, t.situation, x.population, x.responsible, x.mean, x.median
          FROM jsonb_to_recordset($2::jsonb) AS x(setor text, population bigint, responsible bigint, mean numeric, median numeric) JOIN tracts t ON t.cd_setor = x.setor`, [id, JSON.stringify(contextRows.slice(start, start + 5000))]);
      }
      const missingContext = contextRows.filter((row) => !basicValues.has(row.setor)).length;
      if (missingContext) throw new Error(`${missingContext} setores associados sem linha no agregado básico do IBGE.`);
      // 5. Cobertura por UF e status, em locais e eleitores.
      const summary = await client.query<{ uf: string; status: Status; places: number; electors: string; shared: number }>(`SELECT uf, status, count(*)::integer AS places, sum(electors)::text AS electors, count(*) FILTER (WHERE shared_coordinate > 0)::integer AS shared
        FROM polling_place_tracts WHERE batch_id=$1 GROUP BY uf, status`, [id]);
      const coverage = STATES.map((uf) => {
        const rowsUf = summary.rows.filter((row) => row.uf === uf);
        const byStatus = Object.fromEntries(STATUSES.map((status) => { const row = rowsUf.find((item) => item.status === status); return [status, { places: row?.places ?? 0, electors: Number(row?.electors ?? 0) }]; }));
        return { uf, places: rowsUf.reduce((sum, row) => sum + row.places, 0), electors: rowsUf.reduce((sum, row) => sum + Number(row.electors), 0), sharedCoordinate: rowsUf.reduce((sum, row) => sum + row.shared, 0), byStatus };
      });
      if (coverage.some((item) => !item.places)) throw new Error('UF sem locais de votação no cadastro.');
      const tse = (file: Awaited<ReturnType<typeof sourceFile>>, generatedAt: string[], rowsRead: number, rowsSelected: number) => { const { path: _path, ...metadata } = file; return { ...metadata, generatedAt, rowsRead, rowsSelected }; };
      const sources = [tse(correspondence, [], 5571, 5570), tse(locais, [...generated], localRows, places.size), { ...gpkg.source, rowsRead: loaded.rows, rowsSelected: tractCount },
        { ...income.source, rowsRead: incomeValues.size, rowsSelected: incomeValues.size }, { ...basic.source, rowsRead: basicValues.size, rowsSelected: basicValues.size }];
      const dataset = tractsDatasetSchema.parse({ id, kind: 'polling-place-tracts', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, sources, coverage,
        scope: 'Locais de votação de 2022 (cadastro do TSE, 1º turno, sem exterior) associados ao setor censitário do Censo 2022 que contém a coordenada informada pelo TSE.',
        method: 'v1 — setor que contém o ponto (PostGIS ST_Intersects, SIRGAS 2000). Associado só quando há uma única coordenada para o local, um único setor contendo o ponto e esse setor pertence ao município esperado pelo código IBGE oficial. A coordenada do TSE indica onde fica o local, não onde moram os eleitores.',
        notes: [`${withoutLocal.length} locais com votos publicados não aparecem no cadastro de locais do TSE (chave: código original do local, o do dia da eleição).`,
          `Malha: ${loaded.rows.toLocaleString('pt-BR')} linhas, ${tractCount.toLocaleString('pt-BR')} setores; ${loaded.multipart} setores descontínuos tiveram as partes unidas (atributos idênticos conferidos).`,
          'Locais com alguma seção realocada depois de 2022 no cadastro do TSE não são associados: a coordenada pode ser do prédio novo.', 'Locais de nomes diferentes na mesma coordenada exata são contados (indício de ponto padrão); continuam associados, com o aviso.',
          'Coordenadas do TSE tratadas como SIRGAS 2000 (diferença para WGS 84 desprezível nesta escala).', 'A geometria dos setores não é guardada no banco; o GeoPackage preservado permite refazer a associação.'] });
      await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
      await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
      await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
      await client.query('COMMIT');
      for (const source of sources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes ?? 0]);
      const totals = coverage.reduce((sum, item) => ({ places: sum.places + item.places, electors: sum.electors + item.electors, associated: sum.associated + item.byStatus.associated!.places, associatedElectors: sum.associatedElectors + item.byStatus.associated!.electors }), { places: 0, electors: 0, associated: 0, associatedElectors: 0 });
      const report = { dataset, totals, withoutLocal, elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
      await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
      await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ published: id, scope: SCOPE, totals, elapsedSeconds: report.elapsedSeconds }, null, 2));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { client.release(); await pool.end(); }
}
if (require.main === module) run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Associação local → setor falhou.'); process.exitCode = 1; });
