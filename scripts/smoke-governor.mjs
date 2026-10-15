// Confere a publicação de Governador 2022/SP contra totais lidos diretamente dos originais do TSE
// (apuração, votação nominal e votos por seção coincidiram na auditoria de 15/10/2026).
import assert from 'node:assert/strict';

const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001';
const web = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:3000';
let requests = 0;
async function request(base, path, status = 200) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000) });
  requests++;
  assert.equal(response.status, status, path);
  return response;
}
const json = async (path, status) => (await request(api, path, status)).json();
// O HTML do servidor separa trechos de texto com comentários do React.
const html = async (path) => (await (await request(web, path)).text()).replaceAll('<!-- -->', '');

const official = {
  1: { eligible: 34639761, turnout: 27147847, abstentions: 7491914, valid: 23352549, blank: 1645522, null: 2149776, totalVotes: 27147847,
    candidates: { 10: 9881995, 12: 281712, 13: 8337139, 16: 14859, 21: 46727, 27: 10778, 29: 5305, 30: 388974, 45: 4296293, 80: 88767 } },
  2: { eligible: 34642067, turnout: 27341816, abstentions: 7300251, valid: 24390014, blank: 1102504, null: 1849298, totalVotes: 27341816,
    candidates: { 10: 13480643, 13: 10909371 } },
};

const catalog = await json('/elections/catalog');
const dataset = catalog.datasets.find((item) => item.level === 'state' && item.office === 'governor' && item.uf === 'SP');
assert.ok(dataset, 'Publicação de Governador 2022/SP precisa estar concluída.');
assert.deepEqual(dataset.rounds, ['1', '2']);
assert.equal(dataset.coverage.expected, 645); assert.equal(dataset.coverage.reconciled, 645); assert.equal(dataset.coverage.blocked, 0);
assert.ok(catalog.datasets.some((item) => item.level === 'national' && item.office === 'president'), 'Presidência nacional continua publicada.');

for (const round of ['1', '2']) {
  const state = await json(`/elections/state?office=governor&uf=SP&round=${round}`);
  assert.equal(state.status, 'published'); assert.equal(state.dataset.id, dataset.id);
  const { candidates, ...totals } = official[round];
  for (const [field, value] of Object.entries(totals)) assert.equal(state.summary.totals[field], value, `turno ${round}: ${field}`);
  assert.deepEqual(Object.fromEntries(state.summary.candidates.map((item) => [item.number, item.votes])), Object.fromEntries(Object.entries(candidates).map(([number, votes]) => [number, votes])));
  assert.equal(state.summary.municipalities, 645); assert.equal(state.summary.sections, 101073);
  assert.equal(state.summary.exteriorCities, 0);
  // Mesmo turno, cargo diferente: a Presidência de SP não pode coincidir com Governador.
  const president = await json(`/elections/state?office=president&uf=SP&round=${round}`);
  assert.equal(president.status, 'published'); assert.notEqual(president.dataset.id, dataset.id);
  assert.notDeepEqual(president.summary.candidates.map((item) => item.number), state.summary.candidates.map((item) => item.number));

  const list = await json(`/elections/municipalities?office=governor&uf=SP&round=${round}&pageSize=100`);
  assert.equal(list.status, 'published'); assert.equal(list.pagination.total, 645);
  assert.ok(list.items.every((item) => item.uf === 'SP' && item.electionCode === (round === '1' ? '546' : '547')));
  const capital = (await json(`/elections/municipalities?office=governor&uf=SP&round=${round}&search=sao%20paulo&pageSize=100`)).items.find((item) => item.code === '71072');
  assert.ok(capital, 'Município de São Paulo encontrado.');
  assert.equal(capital.totals.eligible, capital.totals.turnout + capital.totals.abstentions + (capital.totals.nonInstalledEligible ?? 0));
  const places = await json(`/elections/municipalities/71072/places?office=governor&uf=SP&round=${round}&pageSize=5`);
  assert.equal(places.total, capital.pollingPlaces); assert.equal(places.dataset.office, 'governor');
  assert.equal(places.items[0].candidates.length, Object.keys(candidates).length);
  const section = await json(`/elections/municipalities/71072/places?office=governor&uf=SP&round=${round}&zone=1&section=1`);
  assert.equal(section.total, 1); assert.ok(section.items[0].sectionNumbers.includes(1));
}

// Cargo estadual sem UF, com ZZ ou em outra UF não publicada.
for (const path of ['/elections/municipalities?office=governor', '/elections/national?office=governor', '/elections/exterior?office=governor', '/elections/state?office=governor', '/elections/municipalities/71072/places?office=governor']) await request(api, path, 400);
assert.equal((await json('/elections/state?office=governor&uf=RJ')).status, 'awaiting-import');
assert.equal((await json('/elections/municipalities?office=governor&uf=RJ')).status, 'awaiting-import');
await request(api, '/elections/municipalities/60011/places?office=governor&uf=RJ', 404);

const page = await html('/?office=governor&uf=SP&round=2');
for (const text of ['Todo o estado: São Paulo / SP', 'TARCÍSIO', 'FERNANDO HADDAD', 'Municípios de São Paulo', 'Cargo: Governador']) assert.ok(page.includes(text), text);
const missingUf = await html('/?office=governor');
assert.ok(missingUf.includes('cargo estadual: escolha uma das 27 UFs'));
const exterior = await html('/?office=governor&uf=ZZ');
assert.ok(exterior.includes('Eleitores no exterior não votam'));
const placesPage = await html('/municipios/71072?office=governor&uf=SP&round=1');
assert.ok(placesPage.includes('Governador · 2022 · 1º turno')); assert.ok(placesPage.includes('name="office" value="governor"'));
const sources = await html('/fontes');
assert.ok(sources.includes('Arquivos — Governador SP')); assert.ok(sources.includes('votacao_secao_2022_SP.zip'));
console.log(`Smoke de Governador 2022/SP aprovado: ${requests} requisições.`);
