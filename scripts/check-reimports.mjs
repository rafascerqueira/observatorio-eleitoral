// Baseline e comparação somente de leitura das nove reimportações de 2022.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';

const definitions = [
  ['2022/context/municipal', 'municipal-context-2022-v3', ['municipality_context', 'municipality_indicators']],
  ['2022/maps/ibge', 'maps-ibge-2022-v3', ['map_geometries']],
  ['2022/places/tracts', 'polling-place-tracts-2022-v3', ['polling_place_tracts', 'census_tract_context']],
  ['2022/places/profiles', 'place-profiles-2022-v2', ['polling_place_profiles']],
  ['2022/context/income-bands', 'income-bands-2022-v2', ['municipality_income_bands']],
  ['2022/context/turnout-profiles', 'turnout-profiles-2022-v3', ['turnout_profile_cells']],
  ['2022/context/tract-demography', 'tract-demography-2022-v2', ['municipality_tract_demography']],
  ['2022/places/groups', 'place-groups-2022-v5', ['place_groups']],
  ['2022/places/tract-sensitivity', 'tract-sensitivity-2022-v2', ['place_group_sensitivity']],
];
const [mode, baselinePath, reportPath, ...selectedScopes] = process.argv.slice(2);
assert.ok(['snapshot', 'verify'].includes(mode) && baselinePath, 'Uso: node scripts/check-reimports.mjs snapshot|verify baseline.json [relatorio.json [escopos...]]');
assert.ok(mode === 'verify' || selectedScopes.length === 0, 'Escopos parciais só são aceitos na comparação');
assert.equal(new Set(selectedScopes).size, selectedScopes.length, 'Escopos repetidos');
const selected = selectedScopes.length ? definitions.filter(([scope]) => selectedScopes.includes(scope)) : definitions;
assert.ok(!selectedScopes.length || selected.length === selectedScopes.length, 'Escopo não previsto nesta reimportação');
config({ path: resolve('.env'), quiet: true });
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL obrigatória');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, options: '-c default_transaction_read_only=on -c statement_timeout=120000' });
const client = await pool.connect();
try {
  await client.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ');
  const batches = (await client.query('SELECT id, scope, metadata FROM import_batches WHERE published ORDER BY scope')).rows;
  const publication = (scope) => { const matches = batches.filter((batch) => batch.scope === scope); assert.equal(matches.length, 1, scope); return matches[0]; };
  const fingerprint = async (table, id) => (await client.query(`SELECT count(*)::integer AS rows,
    encode(sha256(convert_to(coalesce(string_agg(hash, '' ORDER BY hash), ''), 'UTF8')), 'hex') AS sha256
    FROM (SELECT encode(sha256(convert_to((to_jsonb(t)-'batch_id')::text, 'UTF8')), 'hex') AS hash FROM ${table} t WHERE batch_id=$1) hashes`, [id])).rows[0];
  if (mode === 'snapshot') {
    const tables = [];
    for (const [scope, , names] of definitions) for (const table of names) {
      const batch = publication(scope), result = await fingerprint(table, batch.id);
      assert.ok(result.rows > 0, `Baseline vazia: ${table}`);
      tables.push({ scope, table, batchId: batch.id, ...result });
      console.log(`${table}: ${result.rows} linhas conferidas`);
    }
    await writeFile(baselinePath, JSON.stringify({ createdAt: new Date().toISOString(), batches, tables }, null, 2) + '\n', { flag: 'wx' });
  } else {
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
    assert.deepEqual(batches.map(({ scope }) => scope), baseline.batches.map(({ scope }) => scope), 'Escopos publicados mudaram');
    const tableResults = [], datasets = [];
    for (const [scope, version, names] of selected) {
      const current = publication(scope), previous = baseline.batches.find((batch) => batch.scope === scope);
      assert.ok(previous && current.id !== previous.id, `Nova versão não publicada: ${scope}`);
      assert.equal(current.metadata.importerVersion, version);
      assert.ok(current.metadata.inputs?.length > 0, `Sem entradas registradas: ${scope}`);
      for (const input of current.metadata.inputs) assert.equal(publication(input.scope).id, input.id, `Dependência antiga: ${scope}`);
      const sourceKeys = (batch) => (batch.metadata.sources ?? []).map(({ sha256, file }) => `${sha256}/${file}`).sort();
      assert.deepEqual(sourceKeys(current), sourceKeys(previous), `Fontes mudaram: ${scope}`);
      const old = (await client.query('SELECT published, metadata FROM import_batches WHERE id=$1', [previous.id])).rows;
      assert.equal(old.length, 1); assert.equal(old[0].published, false); assert.deepEqual(old[0].metadata, previous.metadata, 'Metadados anteriores foram reescritos');
      const audit = JSON.parse(await readFile(resolve('data/audit', `${current.id}.json`), 'utf8'));
      assert.deepEqual(audit.dataset, current.metadata, `Relatório não corresponde ao banco: ${scope}`);
      for (const table of names) {
        const original = baseline.tables.find((item) => item.scope === scope && item.table === table);
        assert.ok(original, `Tabela não capturada: ${table}`);
        const expected = { rows: original.rows, sha256: original.sha256 };
        assert.deepEqual(await fingerprint(table, previous.id), expected, `Dados anteriores alterados: ${table}`);
        const actual = await fingerprint(table, current.id);
        assert.deepEqual(actual, expected, `Dados reimportados divergem: ${table}`);
        tableResults.push({ scope, table, ...actual, previousPreserved: true, identicalContent: true });
        console.log(`${table}: ${actual.rows} linhas idênticas; versão anterior preservada`);
      }
      datasets.push({ scope, previous: previous.id, current: current.id, version, inputs: current.metadata.inputs.length });
    }
    for (const previous of baseline.batches.filter((batch) => !definitions.some(([scope]) => scope === batch.scope))) assert.deepEqual(publication(previous.scope), previous, 'Publicação eleitoral alterada');
    const result = { status: 'ok', complete: selected.length === definitions.length, plannedDatasets: definitions.length, checkedAt: new Date().toISOString(), datasets, tables: tableResults, unchangedOtherPublications: baseline.batches.length - definitions.length, sideEffects: 'SELECT em transação READ ONLY; grava somente este relatório local, sem trocar publicações.' };
    assert.ok(reportPath, 'Informe o caminho do relatório');
    await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: result.status, complete: result.complete, datasets: datasets.length, tables: tableResults.length, unchangedOtherPublications: result.unchangedOtherPublications }));
  }
  await client.query('COMMIT');
} finally { client.release(); await pool.end(); }
