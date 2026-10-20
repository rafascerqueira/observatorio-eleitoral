import { reusePublished, publicationId, preparePublication } from './publication';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { tractGeometriesDatasetSchema } from '@observatorio/contracts';
import { ROOT } from './sources';
import { preservedDownload } from './sidra';
import { IBGE, loadTracts } from './sectors';

/**
 * Fase B2: malha de setores do Censo 2022 guardada com a geometria exata, a partir do mesmo GeoPackage preservado da associação
 * local → setor e pelo mesmo carregador (`loadTracts`). Validade de cada setor registrada sem reparo. Antes de publicar, os pontos
 * da associação publicada são recontados nesta malha: situação e setor precisam ser idênticos, senão a publicação é bloqueada.
 * Não depende de outra publicação: a comparação é conferência, e a associação não passa a ler esta malha (evita republicações).
 */
const VERSION = 'tract-geometries-2022-v1';
const SCOPE = '2022/geo/tracts';

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
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/018-tract-geometries.sql'), 'utf8'));
    const id = publicationId(VERSION, [gpkg.source.sha256], []);
    if (await reusePublished(client, { id, scope: SCOPE, inputs: [] })) { console.log(`Já publicado: ${id}.`); return; }
    const association = (await client.query<{ id: string }>("SELECT id FROM import_batches WHERE published AND scope='2022/places/tracts'")).rows[0];
    if (!association) throw new Error('Associação local → setor precisa estar publicada para a conferência.');

    const loaded = await loadTracts(client, gpkg.path);
    console.log(`${loaded.tracts.toLocaleString('pt-BR')} setores na malha temporária (${Math.round((performance.now() - started) / 1000)} s).`);
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, SCOPE, { kind: 'tract-geometries', pending: true }]);
      await client.query('DELETE FROM tract_geometries WHERE batch_id=$1', [id]);
      await client.query(`INSERT INTO tract_geometries SELECT $1, cd_setor, cd_mun, situation, parts, ST_IsValid(geom), CASE WHEN ST_IsValid(geom) THEN NULL ELSE ST_IsValidReason(geom) END, geom FROM tracts`, [id]);
      const stored = (await client.query<{ n: number; multipart: number }>('SELECT count(*)::int AS n, count(*) FILTER (WHERE parts > 1)::int AS multipart FROM tract_geometries WHERE batch_id=$1', [id])).rows[0]!;
      if (stored.n !== loaded.tracts || stored.multipart !== loaded.multipart) throw new Error(`Malha gravada não confere: ${stored.n} setores, ${stored.multipart} com partes.`);
      // Linhas ainda não confirmadas ficam sem estatísticas: na publicação v1 a transação levou ~66 min; a conferência sozinha, com estatísticas, 46 s.
      await client.query('ANALYZE tract_geometries');
      const invalid = (await client.query<{ cd_setor: string; invalid_reason: string }>('SELECT cd_setor, invalid_reason FROM tract_geometries WHERE batch_id=$1 AND NOT valid ORDER BY cd_setor', [id])).rows;
      // Conferência com a associação publicada: mesmos pontos (coordenada única, local não realocado) recontados na malha gravada.
      const equivalence = (await client.query<{ total: number; equal: number }>(`WITH pub AS (SELECT p.* FROM polling_place_tracts p WHERE p.batch_id=$2 AND p.status IN ('associated','outside-tracts','ambiguous','other-municipality')),
        hit AS (SELECT pub.status, pub.cd_setor, pub.ibge_code, h.n, h.setor, h.mun FROM pub LEFT JOIN LATERAL (SELECT count(*)::int AS n, min(t.cd_setor) AS setor, min(t.cd_mun) AS mun FROM tract_geometries t
          WHERE t.batch_id=$1 AND ST_Intersects(t.geom, ST_SetSRID(ST_MakePoint(pub.longitude, pub.latitude), 4674))) h ON true)
        SELECT count(*)::int AS total, count(*) FILTER (WHERE (CASE WHEN n = 0 THEN 'outside-tracts' WHEN n > 1 THEN 'ambiguous' WHEN mun <> ibge_code THEN 'other-municipality' ELSE 'associated' END) = status
          AND (status <> 'associated' OR setor = cd_setor))::int AS equal FROM hit`, [id, association.id])).rows[0]!;
      if (!equivalence.total || equivalence.equal !== equivalence.total) throw new Error(`Malha gravada diverge da associação publicada: ${equivalence.equal} de ${equivalence.total} locais iguais; publicação bloqueada.`);
      const sizes = (await client.query<{ total: string }>("SELECT pg_total_relation_size('tract_geometries')::text AS total")).rows[0]!;
      const totals = { rows: loaded.rows, tracts: loaded.tracts, multipart: loaded.multipart, invalid: invalid.length, comparedPlaces: equivalence.total, equalPlaces: equivalence.equal };
      const source = { ...gpkg.source, rowsRead: loaded.rows, rowsSelected: loaded.tracts };
      const dataset = tractGeometriesDatasetSchema.parse({ id, kind: 'tract-geometries', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, sources: [source], totals,
        scope: 'Malha de setores censitários do Censo 2022 (IBGE) com a geometria exata, em SIRGAS 2000 (SRID 4674), uma linha por setor, para consultas espaciais e desenho dos setores.',
        notes: [`${loaded.rows.toLocaleString('pt-BR')} linhas do GeoPackage, ${loaded.tracts.toLocaleString('pt-BR')} setores; ${loaded.multipart} setores descontínuos com as partes unidas (atributos idênticos conferidos).`,
          `${invalid.length} setores com geometria inválida (${[...new Set(invalid.map((item) => item.invalid_reason.split('[')[0]))].join(', ') || 'nenhum motivo'}): registrados sem reparo; usos espaciais devem filtrar a validade.`,
          `Conferência com a associação local → setor publicada (${association.id}): ${equivalence.equal.toLocaleString('pt-BR')} de ${equivalence.total.toLocaleString('pt-BR')} locais com a mesma situação e o mesmo setor.`,
          'A associação local → setor e a sensibilidade continuam lendo o GeoPackage preservado; esta malha não é entrada delas.'] });
      await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
      await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes ?? 0]);
      const report = { dataset, invalid, tableBytes: Number(sizes.total), elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
      await preparePublication(client, { id, scope: SCOPE, inputs: [], report });
      await client.query('COMMIT');
      console.log(JSON.stringify({ published: id, scope: SCOPE, totals, tableMb: Math.round(Number(sizes.total) / 2 ** 20), elapsedSeconds: report.elapsedSeconds }, null, 2));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { client.release(); await pool.end(); }
}
if (require.main === module) run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Malha de setores falhou.'); process.exitCode = 1; });
