import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PoolClient } from 'pg';
import { canonicalInputs, checkAuditReport, checkInputs, publicationId, preparePublication, reusePublished, writeAuditReport } from '../src/publication';
const a = { id: 'a'.repeat(64), scope: '2022/context/municipal' }, b = { id: 'b'.repeat(64), scope: '2022/president/BR' };
test('identidade inclui dependências, versão, fontes e configuração sem depender da ordem de entrada', () => {
  const id = publicationId('v1', ['x', 'y'], [a, b]);
  assert.equal(id, publicationId('v1', ['y', 'x'], [b, a]));
  for (const other of [publicationId('v2', ['x', 'y'], [a, b]), publicationId('v1', ['x'], [a, b]), publicationId('v1', ['x', 'y'], [a, { ...b, id: 'c'.repeat(64) }]), publicationId('v1', ['x', 'y'], [a, b], { radius: 250 })]) assert.notEqual(other, id);
  assert.throws(() => canonicalInputs([a, a]), /duplicadas/);
  assert.throws(() => canonicalInputs([a, { ...b, id: a.id }]), /duplicadas/);
});
test('troca de dependência durante a carga bloqueia a publicação em vez de associar versões distintas', async () => {
  let rows = [a, b];
  const client = { query: async () => ({ rows }) } as unknown as PoolClient;
  await checkInputs(client, [b, a]); rows = [a, { ...b, id: 'c'.repeat(64) }]; await assert.rejects(checkInputs(client, [a, b]), /mudou/);
});
test('relatório só fica pronto completo; falha de escrita e ausência não podem virar sucesso idempotente', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'observatorio-report-test-'));
  try {
    await assert.rejects(checkAuditReport(a.id, { id: a.id }, directory));
    await writeAuditReport(a.id, { dataset: { id: a.id }, checks: ['teste'] }, directory); await checkAuditReport(a.id, { id: a.id }, directory);
    assert.deepEqual(await readdir(directory), [`${a.id}.json`]);
    await assert.rejects(writeAuditReport(a.id, { dataset: { id: b.id } }, directory), /divergente/);
    const file = join(directory, 'arquivo'); await writeFile(file, 'x'); await assert.rejects(writeAuditReport(b.id, { dataset: { id: b.id } }, file));
    await checkAuditReport(a.id, { id: a.id }, directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('mesmo ID não encobre relatório incompleto ou com entradas diferentes das persistidas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'observatorio-report-metadata-'));
  const dataset = { id: a.id, importerVersion: 'teste-v1', inputs: [b], coverage: { published: 2 } };
  try {
    await writeAuditReport(a.id, { dataset }, directory);
    await checkAuditReport(a.id, dataset, directory);
    for (const corrupted of [{ id: a.id }, { ...dataset, inputs: [] }, { ...dataset, coverage: { published: 1 } }]) {
      await writeFile(join(directory, `${a.id}.json`), JSON.stringify({ dataset: corrupted }));
      await assert.rejects(checkAuditReport(a.id, dataset, directory), /metadados divergentes/);
    }
    await writeAuditReport(a.id, { dataset }, directory);
    await checkAuditReport(a.id, dataset, directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('reexecução preserva lotes anteriores e confirma entradas e relatório sob a mesma transação', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'observatorio-reuse-'));
  const dataset = { id: b.id, inputs: [a], importerVersion: 'teste-v1' };
  let existing: Array<{ scope: string; published: boolean; metadata: typeof dataset }> = [];
  let inputs = [a]; const queries: string[] = [];
  const client = { query: async (sql: string) => { queries.push(sql); return { rows: sql.startsWith('SELECT scope,') ? existing : sql.startsWith('SELECT id, scope') ? inputs : [] }; } } as unknown as PoolClient;
  const options = { id: b.id, scope: b.scope, inputs: [a], directory };
  try {
    assert.equal(await reusePublished(client, options), false);
    assert.equal(queries.at(-1), 'COMMIT');
    await writeAuditReport(b.id, { dataset }, directory);
    existing = [{ scope: b.scope, published: true, metadata: dataset }];
    queries.length = 0;
    assert.equal(await reusePublished(client, options), true);
    assert.equal(queries[0], 'BEGIN'); assert.equal(queries.at(-1), 'COMMIT');
    assert.equal(queries.filter((sql) => sql.includes('FOR SHARE')).length, 2);
    for (const invalid of [{ ...existing[0]!, published: false }, { ...existing[0]!, scope: 'outro-escopo' }]) {
      existing = [invalid]; await assert.rejects(reusePublished(client, options), /preservar o lote anterior/); assert.equal(queries.at(-1), 'ROLLBACK');
    }
    existing = [{ scope: b.scope, published: true, metadata: dataset }]; inputs = [];
    await assert.rejects(reusePublished(client, options), /mudou/); assert.equal(queries.at(-1), 'ROLLBACK');
    inputs = [a]; await writeFile(join(directory, `${b.id}.json`), JSON.stringify({ dataset: { id: b.id } }));
    await assert.rejects(reusePublished(client, options), /metadados divergentes/); assert.equal(queries.at(-1), 'ROLLBACK');
    assert.ok(queries.every((sql) => !/^(INSERT|UPDATE|DELETE)/.test(sql)), 'Reexecução só consulta e bloqueia as linhas');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('falha do artefato impede a troca pública e dependências divergentes impedem inclusive a escrita', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'observatorio-publication-test-')); const queries: string[] = [];
  let rows = [a];
  const client = { query: async (sql: string) => { queries.push(sql); return { rows }; } } as unknown as PoolClient;
  const options = { id: b.id, scope: b.scope, inputs: [a], report: { dataset: { id: b.id } }, directory };
  try {
    const file = join(directory, 'not-a-directory'); await writeFile(file, 'x');
    await assert.rejects(preparePublication(client, { ...options, directory: file })); assert.equal(queries.filter((sql) => sql.startsWith('UPDATE')).length, 0);
    rows = []; await assert.rejects(preparePublication(client, options), /mudou/); await assert.rejects(checkAuditReport(b.id, { id: b.id }, directory));
    rows = [a]; await preparePublication(client, options); await checkAuditReport(b.id, { id: b.id }, directory); assert.equal(queries.filter((sql) => sql.startsWith('UPDATE')).length, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
