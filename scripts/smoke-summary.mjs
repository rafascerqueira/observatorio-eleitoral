import assert from 'node:assert/strict';

const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001';
const web = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:3000';
let requests = 0;
async function request(base, path, status = 200) {
  requests++;
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, status, path);
  return response;
}
for (const round of ['1', '2']) {
  const national = await (await request(api, `/elections/national?round=${round}`)).json();
  assert.equal(national.status, 'published');
  assert.equal(national.includesExterior, true);
  assert.ok(national.exteriorDataset);
  const totals = Object.fromEntries(Object.keys(national.summary.totals).map((key) => [key, 0]));
  const candidates = new Map(); const territories = new Set(); const identities = new Set();
  let sections = 0; let pollingPlaces = 0; let nonInstalledSections = 0;
  let page = 1; let total;
  do {
    const data = await (await request(api, `/elections/municipalities?round=${round}&pageSize=100&page=${page}`)).json();
    assert.equal(data.dataset.id, national.dataset.id);
    total = data.pagination.total;
    for (const item of data.items) {
      const identity = `${item.uf}/${item.code}`;
      assert.equal(identities.has(identity), false);
      identities.add(identity); territories.add(item.uf);
      sections += item.sections; pollingPlaces += item.pollingPlaces; nonInstalledSections += item.nonInstalledSections;
      for (const key of Object.keys(totals)) {
        totals[key] = totals[key] == null || item.totals[key] == null ? null : totals[key] + item.totals[key];
      }
      for (const candidate of item.candidates) candidates.set(candidate.number, (candidates.get(candidate.number) ?? 0) + candidate.votes);
    }
  } while (page++ * 100 < total);
  assert.equal(territories.size, 27);
  assert.equal(identities.size, 5570);
  const foreign = new Set();
  for (const page of [1, 2]) {
    const exterior = await (await request(api, `/elections/exterior?round=${round}&pageSize=100&page=${page}`)).json();
    assert.equal(exterior.status, 'published'); assert.equal(exterior.dataset.id, national.exteriorDataset.id);
    assert.equal(exterior.summary.exteriorCities, 181); assert.equal(exterior.summary.municipalities, 0);
    assert.equal(exterior.summary.totals.valid, round === '1' ? 294525 : 298169);
    for (const item of exterior.items) {
      assert.equal(item.uf, 'ZZ'); assert.equal(foreign.has(item.code), false); foreign.add(item.code);
      sections += item.sections; pollingPlaces += item.pollingPlaces; nonInstalledSections += item.nonInstalledSections;
      for (const key of Object.keys(totals)) totals[key] = totals[key] == null || item.totals[key] == null ? null : totals[key] + item.totals[key];
      for (const candidate of item.candidates) candidates.set(candidate.number, (candidates.get(candidate.number) ?? 0) + candidate.votes);
      if (!item.totals.valid) assert.ok(item.candidates.every((candidate) => candidate.percentValid === null));
    }
  }
  assert.equal(foreign.size, 181); assert.equal(national.summary.exteriorCities, 181);
  assert.equal(national.summary.municipalities, identities.size);
  assert.deepEqual(national.summary.totals, totals);
  assert.equal(national.summary.sections, sections);
  assert.equal(national.summary.pollingPlaces, pollingPlaces);
  assert.equal(national.summary.nonInstalledSections, nonInstalledSections);
  assert.equal(candidates.size, round === '1' ? 11 : 2);
  assert.equal(national.summary.candidates.length, candidates.size);
  for (const candidate of national.summary.candidates) {
    assert.equal(candidate.votes, candidates.get(candidate.number));
    assert.equal(candidate.percentValid, candidate.votes / totals.valid * 100);
  }
  const html = await (await request(web, `/?round=${round}`)).text();
  assert.match(html, /Resultado presidencial — Brasil/);
  assert.match(html, /Todo o Brasil/);
  assert.match(html, /5\.570 municípios/);
  assert.match(html, /localidades eleitorais do exterior/);
  assert.match(html, /Versão exterior/);
  assert.match(html, /MANAUS/);
  assert.equal(national.summary.totals.nonInstalledEligible, 657);
  assert.equal(national.summary.nonInstalledCases.reduce((sum, item) => sum + item.electors, 0), 657);
  assert.doesNotMatch(html, /Abrir locais de votação|Paginação de municípios|Município \/ UF/);
  assert.equal((html.match(/class="municipality-summary"/g) ?? []).length, 1);
  const table = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  assert.ok(table); assert.equal((table.match(/<tr/g) ?? []).length, candidates.size);
  for (const candidate of national.summary.candidates) assert.ok(table.includes(new Intl.NumberFormat('pt-BR').format(candidate.votes)));
  console.log(JSON.stringify({ round, municipalities: identities.size, valid: totals.valid, candidates: candidates.size, summaryMatchesEveryMunicipality: true }));
}
const stalePage = await (await request(web, '/?uf=&search=&page=200&pageSize=1')).text();
assert.match(stalePage, /Consolidado de 5\.570 municípios/);
assert.doesNotMatch(stalePage, /Página anterior|Próxima página/);
for (const path of ['/?uf=SP&search=Sao%20Paulo', '/?search=Recife']) {
  const html = await (await request(web, path)).text();
  assert.match(html, /Resultados por município/);
  assert.match(html, /class="table-scroll municipality-overview"/);
  assert.match(html, /Ver votos e detalhes/);
  assert.match(html, /href="\/municipios\/\d{5}\?[^"\n]*uf=[A-Z]{2}/, 'O detalhe municipal continua acessível pelo código e UF');
  assert.doesNotMatch(html, /Consolidado de 5\.570/);
}
// 2026: publicação nacional própria, nunca a de 2022 com outro rótulo.
const current = await (await request(api, '/elections/national?year=2026')).json();
const previous = await (await request(api, '/elections/national?year=2022')).json();
assert.equal(current.status, 'published'); assert.equal(current.dataset.year, 2026); assert.notEqual(current.dataset.id, previous.dataset.id);
assert.equal(current.exteriorDataset.year, 2026);
const currentHtml = await (await request(web, '/?year=2026')).text();
assert.match(currentHtml, /Presidência · 2026/); assert.doesNotMatch(currentHtml, /Nenhuma base publicada para este recorte/);
await request(api, '/elections/national?uf=SP', 400);
await request(api, '/elections/national?page=2', 400);
console.log(JSON.stringify({ status: 'ok', requests, rounds: 2, allMunicipalitiesCompared: true }));
