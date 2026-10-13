import assert from 'node:assert/strict';

const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001';
const web = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:3000';
async function request(base, path, status = 200) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, status, path);
  return response;
}

assert.deepEqual(await (await request(api, '/health/ready')).json(), { status: 'ok', database: 'ok' });
const data = await (await request(api, '/elections/municipalities?year=2026&round=1&uf=SP&pageSize=10')).json();
assert.equal(data.status, 'awaiting-import');
assert.equal(data.dataset, null);
assert.equal(data.pagination.total, 0);
assert.deepEqual(data.items, []);
await request(api, '/elections/municipalities?pageSize=101', 400);

const home = await (await request(web, '/')).text();
assert.match(home, /Resultado presidencial — Brasil/);
assert.match(home, /Todo o Brasil/);
assert.match(home, /<html[^>]+lang="pt-BR"/);
assert.match(home, /<table/);
assert.match(home, /<label[^>]+for="year"/);
assert.match(home, /Ir para o conteúdo/);
for (const path of ['/fontes', '/metodologia']) await request(web, path);
const invalid = await (await request(web, '/?year=2024')).text();
assert.match(invalid, /Confira os filtros da consulta/);
await request(web, '/pagina-inexistente', 404);
if (process.argv.includes('--pilot')) {
  for (const round of [1, 2]) {
    const result = await (await request(api, `/elections/municipalities?year=2022&round=${round}&uf=SP&search=Sao%20Paulo`)).json();
    assert.equal(result.status, 'published'); assert.equal(result.pagination.total, 1);
    const item = result.items[0];
    assert.equal(item.code, '71072'); assert.equal(item.zones, 58);
    assert.equal(item.totals.totalVotes, round === 1 ? 7339532 : 7372124);
    assert.equal(item.totals.valid, round === 1 ? 6892638 : 6869405);
    assert.equal(item.totals.eligible, item.totals.turnout + item.totals.abstentions);
    assert.equal(item.totals.totalVotes, item.totals.valid + item.totals.blank + item.totals.null);
    assert.equal(item.candidates.length, round === 1 ? 11 : 2);
    assert.equal(item.candidates.reduce((sum, candidate) => sum + candidate.votes, 0), item.totals.valid);
    const places = await (await request(api, `/elections/municipalities/71072/places?round=${round}&pageSize=2`)).json();
    assert.equal(places.items.length, 2); assert.equal(places.total, item.pollingPlaces);
    assert.equal(places.items[0].totals.eligible, null);
    const next = await (await request(api, `/elections/municipalities/71072/places?round=${round}&pageSize=2&page=2`)).json();
    assert.notDeepEqual(next.items.map((place) => [place.zone, place.code]), places.items.map((place) => [place.zone, place.code]));
    const noMatch = await (await request(api, `/elections/municipalities?round=${round}&search=Recife`)).json();
    if (result.dataset.level !== 'national') { assert.equal(noMatch.pagination.total, 0); assert.deepEqual(noMatch.items, []); }
    else { assert.equal(noMatch.pagination.total, 1); assert.equal(noMatch.items[0].uf, 'PE'); }
    const nextMunicipality = await (await request(api, `/elections/municipalities?round=${round}&page=2&pageSize=1`)).json();
    if (result.dataset.level !== 'national') { assert.equal(nextMunicipality.pagination.total, 1); assert.deepEqual(nextMunicipality.items, []); }
    else { assert.equal(nextMunicipality.pagination.total, result.dataset.coverage.expected); assert.equal(nextMunicipality.items.length, 1); }
    const html = await (await request(web, `/?year=2022&round=${round}&uf=SP`)).text();
    assert.match(html, /LULA/); assert.match(html, /JAIR BOLSONARO/);
    await request(web, `/municipios/71072?round=${round}`);
  }
}
console.log('Smoke OK: PostgreSQL, API, filtros, páginas e recortes publicados quando solicitados.');
