import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { checkAuditReport, preparePublication, reusePublished, writeAuditReport } from '../apps/importer/src/publication';

// Integração SQL isolada: import_batches temporária sombreia a tabela pública só nesta conexão.
async function run() {
  config({ path: resolve('.env'), quiet: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect(); const directory = await mkdtemp(join(tmpdir(), 'observatorio-publication-sql-'));
  try {
    const before = (await client.query('SELECT id, published FROM public.import_batches ORDER BY id')).rows;
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE import_batches (id text PRIMARY KEY, scope text NOT NULL, published boolean NOT NULL) ON COMMIT DROP');
    assert.equal((await client.query("SELECT to_regclass('import_batches')=to_regclass('pg_temp.import_batches') AS isolated")).rows[0].isolated, true);
    const input = { id: 'a'.repeat(64), scope: '2022/context/municipal' }, old = 'b'.repeat(64), id = 'c'.repeat(64), scope = '2022/places/groups';
    await client.query('INSERT INTO import_batches VALUES($1,$2,true),($3,$4,true),($5,$4,false)', [input.id, input.scope, old, scope, id]);
    const options = { id, scope, inputs: [input], report: { dataset: { id } }, directory };
    const invalidDirectory = join(directory, 'not-directory'); await writeFile(invalidDirectory, 'fixture');
    await assert.rejects(preparePublication(client, { ...options, directory: invalidDirectory }));
    assert.equal((await client.query('SELECT published FROM import_batches WHERE id=$1', [old])).rows[0].published, true);
    await preparePublication(client, options); await checkAuditReport(id, options.report.dataset, directory);
    assert.deepEqual((await client.query('SELECT id FROM import_batches WHERE published AND scope=$1', [scope])).rows.map((row) => row.id), [id]);
    await client.query('ROLLBACK');

    // Reexecução gerencia sua própria transação; a tabela TEMP persiste só nesta conexão até o DROP explícito.
    await client.query('CREATE TEMP TABLE import_batches (id text PRIMARY KEY, scope text NOT NULL, published boolean NOT NULL, metadata jsonb NOT NULL)');
    assert.equal((await client.query("SELECT to_regclass('import_batches')=to_regclass('pg_temp.import_batches') AS isolated")).rows[0].isolated, true);
    const dataset = { id, importerVersion: 'teste-v1', inputs: [input] };
    await client.query('INSERT INTO import_batches VALUES($1,$2,true,$3),($4,$5,true,$6)', [input.id, input.scope, { id: input.id }, id, scope, dataset]);
    await writeAuditReport(id, { dataset }, directory);
    const reuse = { id, scope, inputs: [input], directory };
    assert.equal(await reusePublished(client, reuse), true);
    await client.query('UPDATE import_batches SET published=false WHERE id=$1', [input.id]);
    await assert.rejects(reusePublished(client, reuse), /mudou/);
    await client.query('UPDATE import_batches SET published=true WHERE id=$1', [input.id]);
    await client.query('UPDATE import_batches SET published=false WHERE id=$1', [id]);
    await assert.rejects(reusePublished(client, reuse), /preservar o lote anterior/);
    assert.deepEqual((await client.query('SELECT metadata FROM import_batches WHERE id=$1', [id])).rows[0].metadata, dataset);
    await client.query('DROP TABLE pg_temp.import_batches');

    assert.deepEqual((await client.query('SELECT id, published FROM public.import_batches ORDER BY id')).rows, before);
    console.log(JSON.stringify({ status: 'ok', reuseChecks: ['relatório íntegro aceito', 'entrada substituída bloqueada', 'lote anterior preservado'], effects: 'CREATE TEMP, INSERT/UPDATE só nas tabelas temporárias; ROLLBACK da publicação e COMMIT apenas das consultas de reexecução. DROP da tabela TEMP e arquivos de /tmp removidos. IDs e flags públicos intactos.' }, null, 2));
  } finally { await client.query('ROLLBACK').catch(() => {}); client.release(); await pool.end(); await rm(directory, { recursive: true, force: true }); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
