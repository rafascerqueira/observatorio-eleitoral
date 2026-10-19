import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app';
import { DatabaseService } from '../src/database/database.service';
import { readConfig } from '../src/config';

// Arquivos sintéticos isolados; nenhum original nem relatório do projeto é alterado.
let app: INestApplication, base: string, directory: string;
const batch = 'a'.repeat(64);
const report = Buffer.from(JSON.stringify({ dataset: { id: batch }, checks: ['relatório de teste'] }));
const sources = new Map<string, { file: string; bytes: Buffer }>();
const originalEnv = { audit: process.env.AUDIT_DIRECTORY, originals: process.env.ORIGINALS_DIRECTORY };
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'observatorio-download-test-'));
  process.env.AUDIT_DIRECTORY = join(directory, 'audit'); process.env.ORIGINALS_DIRECTORY = join(directory, 'originals');
  await mkdir(process.env.AUDIT_DIRECTORY, { recursive: true });
  await writeFile(join(process.env.AUDIT_DIRECTORY, `${batch}.json`), report);
  for (const extension of ['gpkg', 'zip', 'json', 'xlsx']) {
    const bytes = Buffer.from(`Arquivo sintético ${extension}`), hash = createHash('sha256').update(bytes).digest('hex');
    sources.set(hash, { file: `teste.${extension}`, bytes });
    const folder = join(process.env.ORIGINALS_DIRECTORY, hash); await mkdir(folder, { recursive: true }); await writeFile(join(folder, `teste.${extension}`), bytes);
  }
  const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ DATABASE_URL: 'postgresql://test:test@localhost/test' }))] })
    .overrideProvider(DatabaseService).useValue({ query: async (sql: string, params: string[]) => {
      if (sql.includes('to_regclass')) return { rows: [{ registry: 'preserved' }] };
      if (sql.includes('FROM import_batches')) return { rows: params[0] === batch ? [{ id: batch }] : [] };
      if (sql.includes('FROM original_sources')) { const source = sources.get(params[0]!); return { rows: source?.file === params[1] ? [{ size_bytes: String(source.bytes.length) }] : [] }; }
      throw new Error('Consulta inesperada');
    } }).compile();
  app = module.createNestApplication(); app.useLogger(false); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
});
after(async () => {
  await app?.close(); if (directory) await rm(directory, { recursive: true, force: true });
  for (const [key, value] of [['AUDIT_DIRECTORY', originalEnv.audit], ['ORIGINALS_DIRECTORY', originalEnv.originals]]) { if (value === undefined) delete process.env[key!]; else process.env[key!] = value; }
});

test('relatório HTTP entrega os bytes e cabeçalhos do arquivo no runner tsx, nunca objeto interno', async () => {
  const response = await fetch(`${base}/elections/imports/${batch}/report`);
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/json');
  assert.match(response.headers.get('content-disposition')!, /attachment; filename="report-/);
  assert.equal(Number(response.headers.get('content-length')), report.length);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), report);
  assert.equal((await fetch(`${base}/elections/imports/${'b'.repeat(64)}/report`)).status, 404);
  await rm(join(process.env.AUDIT_DIRECTORY!, `${batch}.json`));
  assert.equal((await fetch(`${base}/elections/imports/${batch}/report`)).status, 404);
  await writeFile(join(process.env.AUDIT_DIRECTORY!, `${batch}.json`), report);
});

test('originais incluem GeoPackage sem regredir formatos anteriores, integridade ou isolamento de caminho', async () => {
  const types = ['application/geopackage+sqlite3', 'application/zip', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  let index = 0;
  for (const [hash, { file, bytes }] of sources) {
    const response = await fetch(`${base}/elections/sources/${hash}/${file}`);
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), types[index++]);
    assert.equal(Number(response.headers.get('content-length')), bytes.length);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  }
  const [hash, source] = [...sources][0]!;
  for (const file of ['teste.exe', 'teste.gpkg.zip', '%2e%2e%2fsecret.gpkg', 'outro.gpkg']) assert.equal((await fetch(`${base}/elections/sources/${hash}/${file}`)).status, 404, file);
  assert.equal((await fetch(`${base}/elections/sources/${'b'.repeat(64)}/teste.gpkg`)).status, 404);
  const path = join(process.env.ORIGINALS_DIRECTORY!, hash, source.file), info = await stat(path);
  await writeFile(path, Buffer.alloc(source.bytes.length, 0)); await utimes(path, info.atime, info.mtime);
  assert.equal((await fetch(`${base}/elections/sources/${hash}/${source.file}`)).status, 503, 'Mesmo tamanho e mtime não reutilizam checksum após alteração');
  await writeFile(path, 'truncado');
  assert.equal((await fetch(`${base}/elections/sources/${hash}/${source.file}`)).status, 503);
  await rm(path);
  assert.equal((await fetch(`${base}/elections/sources/${hash}/${source.file}`)).status, 503);
});

test('cancelar um download não interrompe o servidor nem impede a próxima consulta', async () => {
  const bytes = Buffer.alloc(4 * 1024 * 1024, 7), hash = createHash('sha256').update(bytes).digest('hex'), file = 'grande.gpkg';
  sources.set(hash, { file, bytes }); const folder = join(process.env.ORIGINALS_DIRECTORY!, hash); await mkdir(folder); await writeFile(join(folder, file), bytes);
  const response = await fetch(`${base}/elections/sources/${hash}/${file}`); await response.body!.cancel();
  const next = await fetch(`${base}/elections/imports/${batch}/report`); assert.equal(next.status, 200); assert.deepEqual(Buffer.from(await next.arrayBuffer()), report);
  assert.deepEqual(await readFile(join(folder, file)), bytes, 'Cancelamento não altera o original');
});
