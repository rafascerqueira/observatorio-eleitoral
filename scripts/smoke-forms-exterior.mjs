import assert from 'node:assert/strict';
const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001';
const web = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:3000';
let requests = 0;
async function request(base, path, status = 200) {
  requests++;
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000) });
  if (Array.isArray(status)) assert.ok(status.includes(response.status), `${path}: ${response.status}`);
  else assert.equal(response.status, status, path);
  return response;
}
const home = await (await request(web, '/')).text();
const form = home.match(/<form[\s\S]*?<\/form>/)?.[0]; assert.ok(form);
assert.match(form, /action="\/"/); assert.match(form, /method="get"/);
assert.match(form, /type="radio"/); assert.doesNotMatch(form, /<select[^>]*name="office"/);
for (const label of ['São Paulo — SP', 'Exterior — ZZ', '2026 — ainda não publicado']) assert.ok(home.includes(label));
const corrected = await (await request(web, '/?year=2026&round=2&uf=RJ&search=Rio&page=0')).text();
assert.match(corrected, /id="query-errors"/); assert.match(corrected, /href="#submit-query"/);
assert.match(corrected, /value="2026" selected=""/); assert.match(corrected, /value="RJ" selected=""/);
assert.match(corrected, /checked="" value="2"|value="2" checked=""/);
assert.match(corrected, /value="Rio"/);
const badZone = await (await request(web, '/municipios/71072?year=2026&round=2&uf=SP&zone=-1&section=0002&search=Escola')).text();
assert.match(badZone, /id="places-zone-error"/); assert.match(badZone, /href="#places-zone"/);
assert.match(badZone, /1 a 9999/); assert.match(badZone, /value="-1"/); assert.match(badZone, /value="0002"/);
assert.match(badZone, /value="2026" selected=""/); assert.match(badZone, /value="Escola"/);
const badTurn = await (await request(web, '/?round=3&uf=AM')).text();
assert.match(badTurn, /Turno informado: <!-- -->3|Turno informado: 3/);
assert.match(badTurn, /checked="" value="3"|value="3" checked=""/);
for (const round of ['1', '2']) {
  const exterior = await (await request(api, `/elections/exterior?round=${round}&search=Lisboa`)).json();
  assert.equal(exterior.status, 'published'); assert.equal(exterior.pagination.total, 1);
  assert.equal(exterior.items[0].code, '29955'); assert.equal(exterior.summary.exteriorCities, 181);
  const lookup = await (await request(api, `/elections/exterior/cities/29955/places?round=${round}&uf=ZZ&pageSize=1`)).json();
  assert.equal(lookup.municipality.uf, 'ZZ'); assert.equal(lookup.municipality.name, 'LISBOA');
  const place = lookup.items[0]; assert.ok(place); assert.equal(place.zone, 1);
  const exact = await (await request(api, `/elections/exterior/cities/29955/places?round=${round}&zone=1&section=${place.sectionNumbers[0]}`)).json();
  assert.equal(exact.total, 1); assert.deepEqual(exact.items[0].totals, place.totals);
  const zero = await (await request(api, `/elections/exterior?round=${round}&search=Brazzaville`)).json();
  assert.equal(zero.items[0].totals.valid, 0); assert.equal(zero.items[0].totals.nonInstalledEligible, 3);
  const zeroPlaces = await (await request(api, `/elections/exterior/cities/39187/places?round=${round}`)).json();
  assert.equal(zeroPlaces.total, 0); assert.deepEqual(zeroPlaces.items, []);
  const html = await (await request(web, `/exterior?round=${round}&search=Lisboa`)).text();
  assert.match(html, /Consolidado de todo o exterior/); assert.match(html, /LISBOA/); assert.match(html, /país não é zona eleitoral/);
  const detail = await (await request(web, `/exterior/29955?round=${round}&zone=1&section=${place.sectionNumbers[0]}`)).text();
  assert.match(detail, /LISBOA/); assert.match(detail, /DETALHE DO EXTERIOR/); assert.match(detail, /local inteiro/);
  assert.match(detail, /action="\/exterior\/29955#resultados"/);
}
await request(api, '/elections/exterior/cities/29955/places?uf=SP', 400);
await request(api, '/elections/municipalities/29955/places?uf=ZZ', 404);
// Next mantém HTTP 200 quando notFound() ocorre depois do início do streaming.
// Em ambos os casos, exigir a tela não encontrada, noindex e ausência dos dados.
const wrongUf = await (await request(web, '/exterior/29955?uf=SP', [200, 404])).text();
assert.match(wrongUf, /Página não encontrada/);
assert.match(wrongUf, /name="robots" content="noindex"/);
assert.doesNotMatch(wrongUf, /<h1>LISBOA|class="places-query"/);
const unavailable = await (await request(api, '/elections/exterior?year=2026')).json();
assert.equal(unavailable.status, 'awaiting-import'); assert.equal(unavailable.summary, null);
const unsupported = await (await request(web, '/exterior?year=2026')).text();
assert.match(unsupported, /Nenhuma base publicada para este recorte/);
const route = await request(web, '/?uf=ZZ&round=2&search=Lisboa');
const routeHtml = await route.text();
assert.ok(route.url.includes('/exterior') || /http-equiv="refresh"[^>]*exterior/.test(routeHtml), 'Redirecionamento GET ou meta refresh para Exterior');
const report = await (await request(web, '/arquivos/imports/07b2595f40887756b48dd85a9f78ebc8c464fd115245bcbea223dfb7390276b9/report')).json();
assert.equal(report.coverage.length, 181); assert.equal(report.persistedVerification.rows, 12663); assert.equal(report.persistedVerification.mismatches, 0);
const sources = await (await request(web, '/fontes')).text();
assert.match(sources, /Arquivos da publicação do exterior/); assert.match(sources, /Selecionados para o exterior/);
console.log(JSON.stringify({ status: 'ok', requests, forms: 'GET, valores preservados, erros por campo', exterior: 'dois turnos, Lisboa, locais/seções, unidades zeradas, fronteiras UF', pendingAndVisualBrowserAudit: 'não disponível neste ambiente' }, null, 2));
