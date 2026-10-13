import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { ROOT } from './sources';
import assert from 'node:assert/strict';
import { rows, count as sourceCount } from './csv';
import { municipalityCode } from './territory';

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const batch = await pool.query("SELECT id,metadata FROM import_batches WHERE published AND scope='2022/president/BR'");
    const dataset = batch.rows[0]?.metadata;
    assert.ok(dataset, 'Publicação nacional não concluída.');
    const id = batch.rows[0]!.id;
    // Tentativas rejeitadas não podem conservar o rótulo provisório de validação.
    const failed = await pool.query("SELECT id FROM import_batches WHERE NOT published AND metadata->>'supersededBy'=$1 AND metadata->>'failureReason' IS NOT NULL", [id]);
    for (const item of failed.rows) {
      const path = resolve(ROOT, 'data/audit', `${item.id}.json`);
      const prior = JSON.parse(await readFile(path, 'utf8'));
      prior.dataset.validation = 'blocked';
      await writeFile(path, JSON.stringify(prior, null, 2));
      await pool.query("UPDATE import_batches SET metadata=jsonb_set(metadata,'{validation}','\"blocked\"') WHERE id=$1 AND NOT published", [item.id]);
    }
    const counts = await pool.query(`SELECT
      (SELECT count(*)::integer FROM national_section_votes WHERE batch_id=$1) AS sections,
      (SELECT count(*)::integer FROM municipality_results WHERE batch_id=$1) AS municipalities,
      (SELECT count(*)::integer FROM national_zone_results WHERE batch_id=$1) AS zones,
      (SELECT count(*)::integer FROM national_place_results WHERE batch_id=$1) AS places,
      (SELECT sum(section_rows)::integer FROM import_coverage WHERE batch_id=$1 AND status='reconciled') AS expected_section_rows`, [id]);
    const count = counts.rows[0]!;
    assert.equal(count.sections, count.expected_section_rows);
    assert.equal(count.municipalities, dataset.coverage.reconciled * 2);
    const stored = await pool.query(`SELECT round,vote_number,sum(votes)::text AS votes FROM national_section_votes WHERE batch_id=$1 GROUP BY round,vote_number ORDER BY round,vote_number`, [id]);
    const expected = await pool.query(`SELECT round,c->>'number' AS vote_number,sum((c->>'votes')::bigint)::text AS votes FROM municipality_results CROSS JOIN LATERAL jsonb_array_elements(result->'candidates') c WHERE batch_id=$1 GROUP BY round,c->>'number'
      UNION ALL SELECT round,'95',sum((result->'totals'->>'blank')::bigint)::text FROM municipality_results WHERE batch_id=$1 GROUP BY round
      UNION ALL SELECT round,'96',sum((result->'totals'->>'null')::bigint)::text FROM municipality_results WHERE batch_id=$1 GROUP BY round ORDER BY round,vote_number`, [id]);
    assert.deepEqual(stored.rows, expected.rows, 'Votos persistidos devem reproduzir todas as candidaturas/brancos/nulos dos dois turnos.');
    const wrongCount = await pool.query(`SELECT count(*)::integer AS count FROM (
      SELECT uf,municipality_code,count(*) AS rows FROM national_section_votes WHERE batch_id=$1 GROUP BY uf,municipality_code
    ) s FULL JOIN (SELECT uf,code,section_rows FROM import_coverage WHERE batch_id=$1 AND status='reconciled') c ON s.uf=c.uf AND s.municipality_code=c.code WHERE s.rows IS DISTINCT FROM c.section_rows::bigint`, [id]);
    assert.equal(wrongCount.rows[0]!.count, 0, 'Cada município precisa conservar todos os registros selecionados.');
    const dimensions = await pool.query(`SELECT count(*)::integer AS count FROM national_section_votes WHERE batch_id=$1 AND (year<>2022 OR office<>'president' OR uf='ZZ' OR election_code<>CASE WHEN round=1 THEN '544' ELSE '545' END)`, [id]);
    assert.equal(dimensions.rows[0]!.count, 0);
    const volumes = await pool.query(`SELECT pg_database_size(current_database())::text AS database_bytes,pg_total_relation_size('national_section_votes')::text AS section_table_and_indexes_bytes`);
    const nonInstalled = [];
    const detailSource = dataset.sources[0];
    for await (const row of rows(resolve(ROOT, 'data/originals', detailSource.sha256, detailSource.file), detailSource.entry, (row) => row.SG_UF !== 'ZZ' && row.ANO_ELEICAO === '2022' && row.CD_CARGO === '1' && sourceCount(row, 'QT_SECOES_NAO_INSTALADAS') > 0)) {
      const code = municipalityCode(row.CD_MUNICIPIO!);
      const actual = await pool.query('SELECT count(DISTINCT section)::integer AS sections FROM national_section_votes WHERE batch_id=$1 AND uf=$2 AND municipality_code=$3 AND round=$4 AND zone=$5', [id, row.SG_UF, code, Number(row.NR_TURNO), Number(row.NR_ZONA)]);
      const principal = sourceCount(row, 'QT_SECOES_PRINCIPAIS'), missing = sourceCount(row, 'QT_SECOES_NAO_INSTALADAS'), missingEligible = sourceCount(row, 'QT_ELEITORES_SECOES_NAO_INSTALADAS');
      assert.equal(actual.rows[0]!.sections + missing, principal);
      assert.equal(sourceCount(row, 'QT_APTOS'), sourceCount(row, 'QT_COMPARECIMENTO') + sourceCount(row, 'QT_ABSTENCOES') + missingEligible);
      nonInstalled.push({ uf: row.SG_UF, code, name: row.NM_MUNICIPIO, round: row.NR_TURNO, zone: Number(row.NR_ZONA), principalSections: principal, sectionsWithRecords: actual.rows[0]!.sections, nonInstalledSections: missing, nonInstalledEligible: missingEligible });
    }
    const reportPath = resolve(ROOT, 'data/audit', `${id}.json`);
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    report.persistedVerification = { at: new Date().toISOString(), counts: count, mismatchedMunicipalities: 0, votesByRoundAndNumber: stored.rows, nonInstalled, volumes: volumes.rows[0] };
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.persistedVerification, null, 2));
  } finally { await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Verificação falhou.'); process.exitCode = 1; });
