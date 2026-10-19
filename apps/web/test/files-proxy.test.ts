import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET } from '../app/arquivos/[...path]/route';
const hash = 'a'.repeat(64);
test('proxy preserva bytes/cabeçalhos de GeoPackage e propaga cancelamento; falhas não viram arquivo vazio', async () => {
  const fetchBefore = globalThis.fetch; let calls = 0; let status = 200;
  const controller = new AbortController(); const bytes = new Uint8Array([0, 12, 255, 10]);
  globalThis.fetch = async (input, options) => {
    calls++; assert.equal(new URL(String(input)).pathname, `/elections/sources/${hash}/teste.gpkg`);
    assert.equal(options?.cache, 'no-store');
    assert.equal(options?.signal?.aborted, controller.signal.aborted);
    return new Response(status === 200 ? bytes : null, { status, headers: { 'content-type': 'application/geopackage+sqlite3', 'content-length': String(bytes.length), 'content-disposition': 'attachment; filename="teste.gpkg"' } });
  };
  const context = { params: Promise.resolve({ path: ['sources', hash, 'teste.gpkg'] }) };
  const request = new Request('http://localhost/arquivos', { signal: controller.signal });
  try {
    const response = await GET(request, context); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/geopackage+sqlite3');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    for (const code of [404, 500]) { status = code; assert.equal((await GET(request, context)).status, code === 404 ? 404 : 503); }
    controller.abort(); await GET(request, context);
    const before = calls;
    for (const path of [['sources', hash, '../teste.gpkg'], ['sources', hash, 'teste.exe'], ['imports', 'invalid', 'report'], ['sources', hash, 'teste.gpkg.zip']]) assert.equal((await GET(request, { params: Promise.resolve({ path }) })).status, 404);
    assert.equal(calls, before, 'Caminho inválido não consulta a API');
    globalThis.fetch = async () => { throw new Error('falha técnica'); };
    assert.equal((await GET(request, context)).status, 503);
  } finally { globalThis.fetch = fetchBefore; }
});
