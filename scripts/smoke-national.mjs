import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001';
const web = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:3000';
const timings = [];
async function request(base, path, status = 200) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(600_000) });
  timings.push({ path, milliseconds: Math.round(performance.now() - start) });
  assert.equal(response.status, status, path);
  return response;
}
const catalog = await (await request(api, '/elections/catalog')).json();
const dataset = catalog.datasets.find((item) => item.level === 'national');
assert.ok(dataset, 'Publicação nacional precisa estar concluída.');
assert.equal(dataset.coverage.blocked, 0);
assert.equal(dataset.coverage.expected, dataset.coverage.reconciled);
const nationalImport = catalog.imports.find((item) => item.id === dataset.id);
assert.equal(nationalImport.published, true);
const domestic = nationalImport.coverage.filter((item) => item.uf !== 'ZZ');
assert.equal(new Set(domestic.map((item) => item.uf)).size, 27);
assert.ok(domestic.every((item) => item.status === 'reconciled'));
assert.ok(nationalImport.coverage.some((item) => item.uf === 'ZZ' && item.status === 'excluded'));
assert.ok(catalog.plannedOffices.every((item) => item.status === 'not-imported'));

for (const round of ['1', '2']) {
  const all = await (await request(api, `/elections/municipalities?round=${round}&pageSize=1`)).json();
  assert.equal(all.pagination.total, dataset.coverage.expected);
  for (const coverage of domestic) {
    const response = await (await request(api, `/elections/municipalities?round=${round}&uf=${coverage.uf}&pageSize=1`)).json();
    assert.equal(response.status, 'published');
    assert.equal(response.pagination.total, coverage.municipalities);
    const municipality = response.items[0];
    assert.equal(municipality.uf, coverage.uf);
    assert.equal(municipality.totals.eligible, municipality.totals.turnout + municipality.totals.abstentions + (municipality.totals.nonInstalledEligible ?? 0));
    assert.equal(municipality.candidates.reduce((sum, item) => sum + item.votes, 0), municipality.totals.valid);
    const places = await (await request(api, `/elections/municipalities/${municipality.code}/places?round=${round}&uf=${coverage.uf}&pageSize=1`)).json();
    assert.equal(places.municipality.code, municipality.code);
    assert.equal(places.total, municipality.pollingPlaces);
    const place = places.items[0];
    assert.ok(place);
    assert.equal(place.sectionNumbers.length, place.sections);
    const found = await (await request(api, `/elections/municipalities/${municipality.code}/places?round=${round}&uf=${coverage.uf}&zone=${place.zone}&section=${place.sectionNumbers[0]}`)).json();
    assert.equal(found.total, 1);
    assert.equal(found.items[0].code, place.code);
    assert.deepEqual(found.items[0].totals, place.totals);
  }
}
const first = await (await request(api, '/elections/municipalities?pageSize=2')).json();
for (const round of ['1', '2']) {
  const manaus = (await (await request(api, `/elections/municipalities?uf=AM&search=Manaus&round=${round}`)).json()).items[0];
  assert.equal(manaus.code, '02550');
  assert.equal(manaus.totals.nonInstalledEligible, 84);
  assert.equal(manaus.nonInstalledSections, 1);
  assert.equal(manaus.totals.eligible, manaus.totals.turnout + manaus.totals.abstentions + 84);
}
const second = await (await request(api, '/elections/municipalities?pageSize=2&page=2')).json();
assert.notDeepEqual(first.items.map((item) => item.code), second.items.map((item) => item.code));
const report = await (await request(web, `/arquivos/imports/${dataset.id}/report`)).json();
assert.equal(report.dataset.id, dataset.id);
assert.equal(report.coverage.filter((item) => item.status === 'reconciled').length, dataset.coverage.expected);
assert.equal(report.coverage.reduce((sum, item) => sum + item.sectionRows, 0), dataset.sources[2].rowsSelected);
// Verifica bytes realmente entregues, sem carregar ZIPs inteiros na RAM.
for (const [index, source] of dataset.sources.entries()) {
  const response = await request(index === 0 ? web : api, index === 0 ? `/arquivos/sources/${source.sha256}/${source.file}` : source.originalUrl);
  assert.match(response.headers.get('content-type'), /application\/zip/);
  assert.equal(Number(response.headers.get('content-length')), source.sizeBytes);
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of response.body) { hash.update(chunk); bytes += chunk.length; }
  assert.equal(bytes, source.sizeBytes);
  assert.equal(hash.digest('hex'), source.sha256);
}
const home = await (await request(web, '/')).text();
assert.match(home, /Cobertura nacional/);
const manausHtml = await (await request(web, '/?uf=AM&search=Manaus')).text();
assert.match(manausHtml, /seção\(ões\) não instalada\(s\)/);
assert.match(manausHtml, /Permanecem separados da abstenção/);
const fontes = await (await request(web, '/fontes')).text();
for (const label of ['Presidência 2022: cobertura nacional publicada', 'Baixar original preservado', 'Consultar arquivo atual no TSE', 'ZZ — exterior', 'Senador', 'SHA-256']) assert.ok(fontes.includes(label), label);
const sample = domestic.find((item) => item.uf === 'RJ');
const municipality = (await (await request(api, `/elections/municipalities?uf=${sample.uf}&pageSize=1`)).json()).items[0];
const html = await (await request(web, `/municipios/${municipality.code}?uf=RJ&zone=1`)).text();
assert.ok(html.includes(municipality.name));
await request(api, `/elections/municipalities/${municipality.code}/places?uf=SP`, 404);
await request(api, '/elections/municipalities?uf=ZZ', 400);
await request(api, '/elections/municipalities?office=senator', 400);
const missing = await (await request(api, '/elections/municipalities?year=2026')).json();
assert.equal(missing.status, 'awaiting-import');
console.log(JSON.stringify({ status: 'ok', municipalities: dataset.coverage.reconciled, territories: 27, requests: timings.length, maximumResponseHeadersMilliseconds: Math.max(...timings.map((item) => item.milliseconds)), reportElapsedSeconds: report.elapsedSeconds, peakImporterRssMiB: report.peakRssMiB, originalChecksumsVerified: dataset.sources.length }, null, 2));
