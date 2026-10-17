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

// Todas as UFs publicadas para Governador: invariantes, turnos realizados e categorias não válidas.
const SECOND_ROUND = ['AL', 'AM', 'BA', 'ES', 'MS', 'PB', 'PE', 'RO', 'RS', 'SC', 'SE', 'SP'];
const governorDatasets = catalog.datasets.filter((item) => item.level === 'state' && item.office === 'governor');
for (const item of governorDatasets) {
  assert.equal(item.coverage.blocked, 0); assert.equal(item.coverage.expected, item.coverage.reconciled);
  assert.deepEqual(item.rounds, SECOND_ROUND.includes(item.uf) ? ['1', '2'] : ['1'], `turnos de ${item.uf}`);
  for (const round of ['1', '2']) {
    const state = await json(`/elections/state?office=governor&uf=${item.uf}&round=${round}`);
    if (!item.rounds.includes(round)) {
      assert.equal(state.status, 'round-not-held', `${item.uf} ${round}`);
      assert.equal((await json(`/elections/municipalities?office=governor&uf=${item.uf}&round=${round}`)).status, 'round-not-held');
      continue;
    }
    const { totals, candidates, nonValidVotes = [] } = state.summary;
    assert.equal(state.summary.municipalities, item.coverage.reconciled);
    assert.equal(candidates.reduce((sum, candidate) => sum + candidate.votes, 0), totals.valid);
    assert.equal(totals.totalVotes, totals.valid + totals.blank + totals.null + (totals.annulled ?? 0) + (totals.annulledSubJudice ?? 0), `${item.uf} ${round}: composição`);
    assert.equal(totals.eligible, totals.turnout + totals.abstentions + (totals.nonInstalledEligible ?? 0));
    if (!item.importerVersion.endsWith('-v1')) {
      for (const [category, field] of [['annulled', 'annulled'], ['annulled-sub-judice', 'annulledSubJudice'], ['technical-null', 'technicalNull']]) {
        assert.equal(nonValidVotes.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.votes, 0), totals[field], `${item.uf} ${round}: ${category}`);
      }
      assert.ok(nonValidVotes.every((entry) => !candidates.some((candidate) => candidate.number === entry.number)));
    }
  }
}
// Casos auditados nos originais: nulos técnicos (SE), anulados (PR), sub judice (AM) e exclusão declarada (RR).
const known = { SE: ['technicalNull', 457922, '22'], PR: ['annulled', 10337, '33'], AM: ['annulledSubJudice', 1895, '36'] };
for (const [uf, [field, votes, numberWithVotes]] of Object.entries(known)) {
  if (!governorDatasets.some((item) => item.uf === uf)) continue;
  const state = await json(`/elections/state?office=governor&uf=${uf}&round=1`);
  assert.equal(state.summary.totals[field], votes, `${uf}: ${field}`);
  assert.equal(state.summary.nonValidVotes.find((entry) => entry.number === numberWithVotes)?.votes, votes);
}
const roraima = governorDatasets.find((item) => item.uf === 'RR');
if (roraima) {
  assert.equal(roraima.exclusions?.[0]?.electionCode, '6278');
  assert.ok(Object.values(roraima.exclusions[0].rows).every((rows) => rows > 0));
  const state = await json('/elections/state?office=governor&uf=RR&round=1');
  assert.equal(state.dataset.id, roraima.id); assert.equal(state.summary.totals.annulledSubJudice, 0, 'Sub judice da suplementar de 2026 não entra em 2022');
  assert.equal(state.summary.totals.totalVotes, 304319);
}
// v3: locais guardam as candidaturas não válidas (a v2 as descartava na gravação).
const sergipe = governorDatasets.find((item) => item.uf === 'SE');
if (sergipe && !['-v1', '-v2'].some((suffix) => sergipe.importerVersion.endsWith(suffix))) {
  const places = await json('/elections/municipalities/31054/places?office=governor&uf=SE&round=1&pageSize=100');
  assert.ok(places.items.length > 0);
  for (const place of places.items) assert.equal((place.nonValidVotes ?? []).filter((entry) => entry.category === 'technical-null').reduce((sum, entry) => sum + entry.votes, 0), place.totals.technicalNull, `local ${place.zone}/${place.code}`);
  assert.ok(places.items.some((place) => place.nonValidVotes?.some((entry) => entry.number === '22' && entry.votes > 0)));
}
if (governorDatasets.some((item) => item.uf === 'SE')) {
  const page = await html('/?office=governor&uf=SE&round=1');
  for (const text of ['Votos não computados como válidos', 'VALMIR DOS SANTOS COSTA', 'Nulo técnico', 'dos quais nulos técnicos: 457.922']) assert.ok(page.includes(text), text);
  const second = await html('/?office=governor&uf=CE&round=2');
  if (governorDatasets.some((item) => item.uf === 'CE')) assert.ok(second.includes('Não houve 2º turno para Governador em Ceará'));
}

// Cargo estadual sem UF, com ZZ ou em outra UF não publicada.
for (const path of ['/elections/municipalities?office=governor', '/elections/national?office=governor', '/elections/exterior?office=governor', '/elections/state?office=governor', '/elections/municipalities/71072/places?office=governor']) await request(api, path, 400);
const unpublished = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SE', 'TO'].find((uf) => !governorDatasets.some((item) => item.uf === uf));
if (unpublished) {
  assert.equal((await json(`/elections/state?office=governor&uf=${unpublished}`)).status, 'awaiting-import');
  assert.equal((await json(`/elections/municipalities?office=governor&uf=${unpublished}`)).status, 'awaiting-import');
}
await request(api, '/elections/municipalities/71072/places?office=governor&uf=RJ', 404);

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
console.log(`Smoke de Governador 2022 aprovado: ${governorDatasets.length} UF(s), ${requests} requisições.`);
