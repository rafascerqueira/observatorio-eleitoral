import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { datasetSchema, municipalitySchema, percent, pollingPlaceSchema } from '@observatorio/contracts';
import { ROOT } from './sources';

config({ path: resolve(ROOT, '.env'), quiet: true });
async function analyze() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const batch = await pool.query("SELECT metadata FROM import_batches WHERE published AND scope='2022/president/SP/71072'");
    const dataset = datasetSchema.parse(batch.rows[0]?.metadata);
    const records = await pool.query('SELECT result FROM municipality_results WHERE batch_id=$1 ORDER BY round', [dataset.id]);
    const summaries = records.rows.map((row) => municipalitySchema.parse(row.result));
    assert.equal(summaries.length, 2);
    const votes = await pool.query('SELECT round, vote_number, sum(votes)::bigint AS votes FROM section_votes WHERE batch_id=$1 GROUP BY round, vote_number', [dataset.id]);
    const sections = await pool.query('SELECT count(*)::integer AS count FROM section_votes WHERE batch_id=$1', [dataset.id]);
    assert.equal(sections.rows[0]?.count, dataset.sources[2]?.rowsSelected);
    const zones = await pool.query('SELECT round, zone, result FROM zone_results WHERE batch_id=$1 ORDER BY round, zone', [dataset.id]);
    const places = await pool.query('SELECT round, zone, code, result FROM polling_place_results WHERE batch_id=$1 ORDER BY round, zone, code', [dataset.id]);
    const metadataConflicts = places.rows.filter((row) => pollingPlaceSchema.parse(row.result).metadataConflict).map((row) => ({ round: String(row.round), zone: row.zone, code: row.code, variants: row.result.metadataVariants }));
    const roundAnalysis = summaries.map((summary) => {
      const get = (number: string) => Number(votes.rows.find((row) => String(row.round) === summary.round && row.vote_number === number)?.votes ?? 0);
      assert.equal(get('95'), summary.totals.blank); assert.equal(get('96'), summary.totals.null);
      for (const candidate of summary.candidates) assert.equal(get(candidate.number), candidate.votes);
      const zoneRows = zones.rows.filter((row) => String(row.round) === summary.round);
      assert.equal(zoneRows.length, summary.zones);
      assert.equal(places.rows.filter((row) => String(row.round) === summary.round).length, summary.pollingPlaces);
      const leadership: Record<string, number> = {};
      for (const row of zoneRows) {
        const [first, second] = row.result.candidates;
        const leader = second && first.votes === second.votes ? 'tie' : first.number;
        leadership[leader] = (leadership[leader] ?? 0) + 1;
      }
      const lula = summary.candidates.find((candidate) => candidate.number === '13')!;
      const bolsonaro = summary.candidates.find((candidate) => candidate.number === '22')!;
      return { ...summary, abstentionRate: percent(summary.totals.abstentions!, summary.totals.eligible!), blankRate: percent(summary.totals.blank, summary.totals.totalVotes), nullRate: percent(summary.totals.null, summary.totals.totalVotes), lulaMinusBolsonaroVotes: lula.votes - bolsonaro.votes, lulaMinusBolsonaroPP: lula.percentValid! - bolsonaro.percentValid!, zoneLeadership: leadership, metadataConflictCount: metadataConflicts.filter((item) => item.round === summary.round).length };
    });
    const first = summaries[0]!, second = summaries[1]!;
    const change = Object.fromEntries(Object.keys(first.totals).map((key) => {
      const field = key as keyof typeof first.totals;
      const a = first.totals[field], b = second.totals[field];
      return [field, a == null || b == null ? null : b - a];
    }));
    await mkdir(resolve(ROOT, 'data/analysis'), { recursive: true });
    const analysis = { dataset, rounds: roundAnalysis, secondMinusFirst: change, sectionRowsVerified: sections.rows[0]?.count, metadataConflicts, scope: 'Descrição agregada do município. Sem inferências sobre motivos ou transferência individual de votos.' };
    await writeFile(resolve(ROOT, 'data/analysis/sao-paulo-2022.json'), JSON.stringify(analysis, null, 2));
    // Atualiza o relatório com os conflitos preservados no banco, inclusive
    // quando a validação anterior foi produzida por uma execução mais antiga.
    const reportPath = resolve(ROOT, 'data/audit/sao-paulo-2022.json');
    const prior = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(prior.dataset.id, dataset.id);
    const { conflicts: _legacyConflicts, ...audit } = prior;
    await writeFile(reportPath, JSON.stringify({ ...audit, dataset, voteConflicts: 0, metadataConflicts, databaseSectionRowsVerified: sections.rows[0]?.count, databaseVerifiedAt: new Date().toISOString() }, null, 2));
    console.log(JSON.stringify({ rounds: roundAnalysis, secondMinusFirst: change, metadataConflictCount: metadataConflicts.length, sectionRowsVerified: sections.rows[0]?.count }, null, 2));
  } finally { await pool.end(); }
}
analyze().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
