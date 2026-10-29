import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001';
const web = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:3000';
let requests = 0;
async function request(base, path) { requests++; return fetch(new URL(path, base), { signal: AbortSignal.timeout(120000) }); }
for (const round of ['1', '2']) for (const suffix of ['', '&uf=SP']) for (const path of [`/elections/map/candidates?round=${round}${suffix}`, `/elections/places/groups?indicator=college&round=${round}${suffix}`, `/elections/places/groups?indicator=income-median&radius=500&round=${round}${suffix}`]) {
  // Mapas por candidatura derivam dos resultados (2026 publicado); grupos de locais e sensibilidade só existem para 2022.
  const missing = await request(api, `${path}&year=2026`); assert.equal(missing.status, 200); assert.equal((await missing.json()).status, path.includes('map/candidates') ? 'published' : 'awaiting-import');
  const current = await request(api, `${path}&year=2022`); assert.equal(current.status, 200); assert.equal((await current.json()).status, 'published');
}
const catalog = await (await request(api, '/elections/catalog')).json();
const national = catalog.datasets.find((item) => item.year === 2022 && item.level === 'national');
const expected = await readFile(resolve('data/audit', `${national.id}.json`));
for (const [base, path] of [[api, `/elections/imports/${national.id}/report`], [web, `/arquivos/imports/${national.id}/report`]]) {
  const response = await request(base, path); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/json');
  assert.match(response.headers.get('content-disposition'), /attachment/); assert.equal(Number(response.headers.get('content-length')), expected.length);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
}
const gpkg = catalog.tractsDatasets[0].sources.find((source) => source.file.endsWith('.gpkg'));
for (const [base, prefix] of [[api, '/elections'], [web, '/arquivos']]) {
  const response = await request(base, `${prefix}/sources/${gpkg.sha256}/${gpkg.file}`); assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/geopackage+sqlite3'); assert.equal(Number(response.headers.get('content-length')), gpkg.sizeBytes);
  const reader = response.body.getReader(); const first = await reader.read(); assert.equal(Buffer.from(first.value).subarray(0, 15).toString(), 'SQLite format 3'); await reader.cancel();
}
const context = await (await request(api, '/elections/municipalities/26310/context?uf=PE')).json();
assert.equal(context.item.race.undistributed, 1503); assert.equal(context.item.race.total, 98462);
const page = await (await request(web, '/municipios/26310?uf=PE')).text(); assert.match(page, /Diferença não discriminada nas categorias da fonte/); assert.match(page, /causa não está informada/);
console.log(JSON.stringify({ status: 'ok', requests, sideEffects: 'GET e leitura local de relatório. GeoPackage tem checksum verificado pelo servidor; só o início é recebido e o download é cancelado nas duas rotas. Nenhum original é alterado.' }, null, 2));
