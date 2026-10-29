// Confere as publicações de Senador 2022 contra totais lidos diretamente dos originais do TSE
// (apuração, votação nominal e votos por seção coincidiram por UF na auditoria de 17/10/2026).
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

// UF: [aptos, votos, válidos, municípios, registros seção/votável], 1º turno (eleição 546).
const official = { AC: [587222, 455438, 411949, 22, 18286], AL: [2322905, 1802791, 1486153, 102, 38504], AP: [549335, 442101, 400159, 16, 13302], AM: [2643568, 2110875, 1882570, 62, 60648], BA: [11273819, 8866459, 7233261, 417, 204368], CE: [6812993, 5623450, 4856028, 184, 113589], DF: [2193783, 1807484, 1576967, 1, 63297], ES: [2917714, 2311629, 1957350, 78, 70928], GO: [4864247, 3807191, 3164192, 246, 151657], MA: [5036730, 3918212, 3406360, 217, 88681], MT: [2465926, 1889012, 1298767, 141, 62742], MS: [1993121, 1552654, 1360544, 79, 43769], MG: [16271013, 12643691, 10294589, 853, 378788], PA: [6074636, 4785272, 4186083, 144, 152986], PB: [3086030, 2551876, 1571165, 223, 79084], PR: [8466408, 6815688, 5830576, 399, 230191], PE: [7008795, 5732289, 4468754, 185, 171447], PI: [2568604, 2114006, 1874043, 224, 45236], RJ: [12809126, 9893658, 6594041, 92, 323116], RN: [2550291, 2086722, 1692509, 167, 56835], RS: [8582100, 6883341, 5879460, 497, 210276], RO: [1228788, 925763, 756418, 52, 33338], RR: [365395, 304319, 255780, 15, 12392], SC: [5483962, 4471619, 3730254, 295, 159877], SP: [34639761, 27147847, 21556203, 645, 932309], SE: [1669042, 1362604, 1086263, 75, 40252], TO: [1092189, 889580, 783612, 139, 34943] };
// Categorias não válidas auditadas: UF → campo, total e votável com esse total (ou o maior).
const known = { RJ: ['technicalNull', 1573388, '142', 1566352], MT: ['technicalNull', 310481, '111', 310481], PB: ['annulled', 431857, '133', 431857], RO: ['annulled', 63300, '123', 63300], AM: ['annulledSubJudice', 10200, '700', 10200], TO: ['annulledSubJudice', 588, '271', 588] };

const catalog = await json('/elections/catalog');
const senators = catalog.datasets.filter((item) => item.year === 2022 && item.level === 'state' && item.office === 'senator');
assert.ok(senators.length > 0, 'Ao menos uma publicação de Senador 2022 precisa estar concluída.');
assert.ok(catalog.datasets.some((item) => item.level === 'national' && item.office === 'president'), 'Presidência nacional continua publicada.');
const pendingSenate = catalog.plannedOffices.find((item) => item.office === 'senator');
if (senators.length === 27) assert.equal(pendingSenate, undefined, 'Senado completo não aparece como pendente');
else assert.ok(pendingSenate?.label.startsWith('Senador — '));

for (const item of senators) {
  const [eligible, totalVotes, valid, municipalities] = official[item.uf];
  assert.deepEqual(item.rounds, ['1'], `${item.uf}: turno único`);
  assert.equal(item.importerVersion, 'senator-2022-state-v1');
  assert.equal(item.coverage.expected, municipalities); assert.equal(item.coverage.reconciled, municipalities); assert.equal(item.coverage.blocked, 0);
  assert.equal(item.exclusions, undefined, `${item.uf}: nenhuma exclusão declarada para o Senado`);
  const state = await json(`/elections/state?office=senator&uf=${item.uf}&round=1`);
  assert.equal(state.status, 'published'); assert.equal(state.dataset.id, item.id);
  const { totals, candidates, nonValidVotes = [] } = state.summary;
  assert.deepEqual([totals.eligible, totals.totalVotes, totals.valid, state.summary.municipalities], [eligible, totalVotes, valid, municipalities], item.uf);
  assert.equal(candidates.reduce((sum, candidate) => sum + candidate.votes, 0), totals.valid);
  assert.equal(totals.totalVotes, totals.valid + totals.blank + totals.null + totals.annulled + totals.annulledSubJudice, `${item.uf}: composição`);
  assert.equal(totals.eligible, totals.turnout + totals.abstentions + (totals.nonInstalledEligible ?? 0));
  for (const [category, field] of [['annulled', 'annulled'], ['annulled-sub-judice', 'annulledSubJudice'], ['technical-null', 'technicalNull']]) {
    assert.equal(nonValidVotes.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.votes, 0), totals[field], `${item.uf}: ${category}`);
  }
  assert.ok(nonValidVotes.every((entry) => !candidates.some((candidate) => candidate.number === entry.number)));
  // Turno único: o 2º turno é "não realizado", nunca "não importado".
  assert.equal((await json(`/elections/state?office=senator&uf=${item.uf}&round=2`)).status, 'round-not-held');
  assert.equal((await json(`/elections/municipalities?office=senator&uf=${item.uf}&round=2`)).status, 'round-not-held');
  // Mesmo turno e UF, cargo diferente: candidaturas do Senado não coincidem com as do Governador.
  const governor = await json(`/elections/state?office=governor&uf=${item.uf}&round=1`);
  if (governor.status === 'published') {
    assert.notEqual(governor.dataset.id, item.id);
    assert.equal(governor.summary.totals.eligible, eligible, `${item.uf}: mesmos aptos do Governador no 1º turno`);
    assert.notDeepEqual(governor.summary.candidates.map((entry) => entry.number).sort(), candidates.map((entry) => entry.number).sort());
  }
}
for (const [uf, [field, votes, number, numberVotes]] of Object.entries(known)) {
  if (!senators.some((item) => item.uf === uf)) continue;
  const state = await json(`/elections/state?office=senator&uf=${uf}&round=1`);
  assert.equal(state.summary.totals[field], votes, `${uf}: ${field}`);
  assert.equal(state.summary.nonValidVotes.find((entry) => entry.number === number)?.votes, numberVotes, `${uf}: votável ${number}`);
}

// Locais: cada local guarda as candidaturas não válidas (Governador v2 as perdia na gravação).
if (senators.some((item) => item.uf === 'RJ')) {
  const capital = (await json('/elections/municipalities?office=senator&uf=RJ&round=1&search=rio%20de%20janeiro')).items.find((item) => item.code === '60011');
  assert.ok(capital, 'Município do Rio de Janeiro encontrado.');
  const places = await json('/elections/municipalities/60011/places?office=senator&uf=RJ&round=1&pageSize=100');
  assert.equal(places.total, capital.pollingPlaces); assert.equal(places.dataset.office, 'senator');
  for (const place of places.items) {
    const listed = (place.nonValidVotes ?? []).filter((entry) => entry.category === 'technical-null').reduce((sum, entry) => sum + entry.votes, 0);
    assert.equal(listed, place.totals.technicalNull, `local ${place.zone}/${place.code}: nulos técnicos identificados`);
  }
  assert.ok(places.items.some((place) => place.nonValidVotes?.some((entry) => entry.number === '142' && entry.votes > 0)));
  assert.equal((await request(api, '/elections/municipalities/60011/places?office=senator&uf=RJ&round=2', 404)).status, 404);
  const page = await html('/?office=senator&uf=RJ&round=1');
  for (const text of ['Todo o estado: Rio de Janeiro / RJ', 'Cargo: Senador', 'Votos não computados como válidos', 'DANIEL LUCIO DA SILVEIRA', 'Nulo técnico', 'dos quais nulos técnicos: 1.573.388']) assert.ok(page.includes(text), text);
  const second = await html('/?office=senator&uf=RJ&round=2');
  for (const text of ['Não houve 2º turno para Senador em Rio de Janeiro', 'turno único']) assert.ok(second.includes(text), text);
  const placesPage = await html('/municipios/60011?office=senator&uf=RJ&round=1');
  assert.ok(placesPage.includes('Senador · 2022 · 1º turno')); assert.ok(placesPage.includes('name="office" value="senator"'));
  assert.ok(placesPage.includes('Votos não computados como válidos — local'));
  assert.ok((await html('/municipios/60011?office=senator&uf=RJ&round=2')).includes('turno único'));
}

// Cargo estadual sem UF ou com ZZ; Senado não usa a Presidência nem o exterior.
for (const path of ['/elections/municipalities?office=senator', '/elections/national?office=senator', '/elections/exterior?office=senator', '/elections/state?office=senator', '/elections/state?office=senator&uf=ZZ', '/elections/municipalities/60011/places?office=senator', '/elections/exterior/cities/60011/places?office=senator']) await request(api, path, 400);
assert.ok((await html('/?office=senator')).includes('cargo estadual: escolha uma das 27 UFs'));
assert.ok((await html('/?office=senator&uf=ZZ')).includes('Eleitores no exterior não votam'));
const sources = await html('/fontes');
const sample = senators[0];
assert.ok(sources.includes(`Arquivos — Senador 2022 ${sample.uf}`)); assert.ok(sources.includes(`votacao_secao_2022_${sample.uf}.zip`));
console.log(`Smoke de Senador 2022 aprovado: ${senators.length} UF(s), ${requests} requisições.`);
