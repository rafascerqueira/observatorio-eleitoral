// Confere o contexto municipal (Censo 2022 + perfis do TSE) contra valores lidos diretamente das fontes em 17/10/2026.
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
const html = async (path) => (await (await request(web, path)).text()).replaceAll('<!-- -->', '');
const sum = (items, field = 'value') => items.reduce((total, item) => total + item[field], 0);

const catalog = await json('/elections/catalog');
const [dataset] = catalog.contextDatasets;
assert.ok(dataset, 'Contexto municipal precisa estar publicado.');
assert.equal(catalog.contextDatasets.length, 1);
assert.deepEqual([dataset.coverage.expected, dataset.coverage.published], [5570, 5570]);
assert.deepEqual(dataset.coverage.withoutTurnout, ['DF']);
assert.ok(dataset.sources.some((source) => source.file === 'municipio_tse_ibge.zip'));
assert.equal(dataset.sources.filter((source) => source.url.includes('apisidra')).length, 163, '6 tabelas × 27 UFs + totais das UFs');
assert.ok(!catalog.datasets.some((item) => item.kind), 'Contexto não aparece entre as publicações de cargo');

// São Paulo: rendimento domiciliar per capita da SIDRA 10296/10295 (consulta direta).
const sp = (await json('/elections/municipalities/71072/context?uf=SP')).item;
assert.equal(sp.ibgeCode, '3550308');
assert.equal(sp.incomeClasses.total, 11394118); assert.equal(sp.incomeClasses.categories.find((item) => item.key === 'upto-1/4').value, 542687);
assert.equal(sp.incomePerCapita.median, 1340); assert.equal(sp.incomePerCapita.mean, 2713.36);
assert.equal(sp.incomeClasses.kind, 'amostra'); assert.equal(sp.race.kind, 'universo'); assert.equal(sp.electorate.education.kind, 'cadastro');
for (const item of [sp]) {
  assert.equal(item.race.total, item.population.total);
  assert.equal(sum(item.populationByAge.categories), item.population.age16plus);
  assert.equal(item.population.age16to17 + item.population.age18to69 + item.population.age70plus, item.population.age16plus);
  for (const dimension of ['gender', 'age', 'education', 'maritalStatus']) assert.equal(sum(item.electorate[dimension].categories), item.electorate.eligible, dimension);
  for (const round of ['1', '2']) {
    const turnout = item.turnout[round];
    assert.equal(turnout.turnout + turnout.abstentions, turnout.eligible);
    for (const dimension of turnout.dimensions) assert.equal(sum(dimension.categories, 'eligible'), turnout.eligible);
  }
}
// Nomes diferentes nas duas fontes: ligação pelo código (RN: Campo Grande no TSE = Augusto Severo no IBGE).
const suggestions = await json('/elections/municipalities/suggest?q=campo%20grande&office=president&uf=RN');
const campoGrande = suggestions.items.find((item) => item.name === 'CAMPO GRANDE' && item.uf === 'RN');
assert.ok(campoGrande);
assert.equal((await json(`/elections/municipalities/${campoGrande.code}/context?uf=RN`)).item.ibgeName, 'Augusto Severo');
// DF: a fonte de comparecimento por perfil não traz a UF — não disponível, nunca zero.
const brasilia = (await json('/elections/municipalities/97012/context?uf=DF')).item;
assert.equal(brasilia.turnout['1'], null); assert.equal(brasilia.turnout['2'], null);
assert.ok(brasilia.electorate.eligible > 0);
await request(api, '/elections/municipalities/71072/context', 400);
await request(api, '/elections/municipalities/71072/context?uf=RJ', 404);

const page = await html('/municipios/71072?uf=SP&round=1');
for (const text of ['Contexto de São Paulo / SP', 'Estimativa da amostra', 'Cadastro do TSE', 'Universo do Censo', 'o voto é secreto', 'R$ 1.212,00']) assert.ok(page.includes(text), text);
assert.ok((await html('/municipios/97012?uf=DF&round=1')).includes('não traz esta UF'));
assert.ok((await html('/fontes')).includes('Contexto municipal: Censo 2022'));
// Mapa: malhas do IBGE ligadas pelo código; valores somando numeradores e denominadores (nunca média de percentuais).
assert.equal(catalog.mapDatasets.length, 1); assert.equal(catalog.mapDatasets[0].importerVersion, 'maps-ibge-2022-v2');
const brGeometry = await json('/elections/map/geometry');
assert.equal(Object.values(brGeometry.topology.objects)[0].geometries.length, 27);
assert.equal(Object.values((await json('/elections/map/geometry?uf=MG')).topology.objects)[0].geometries.length, 853);
const literacyUf = await json('/elections/map/values?indicator=literacy-15');
assert.equal(literacyUf.items.length, 27);
assert.deepEqual([sum(literacyUf.items, 'numerator'), sum(literacyUf.items, 'denominator')], [151547694, 162951495], 'Alfabetização 15+, Brasil (Censo 2022)');
const literacySp = await json('/elections/map/values?indicator=literacy-15&uf=SP');
assert.equal(literacySp.items.length, 645);
assert.equal(sum(literacySp.items, 'numerator'), literacyUf.items.find((item) => item.uf === 'SP').numerator, 'UF = soma dos municípios');
const abstentionSp = (await json('/elections/map/values?indicator=abstention&round=2')).items.find((item) => item.uf === 'SP');
const stateSp = await json('/elections/state?office=president&uf=SP&round=2');
assert.deepEqual([abstentionSp.numerator, abstentionSp.denominator], [stateSp.summary.totals.abstentions, stateSp.summary.totals.eligible], 'Abstenção do mapa = resultado publicado da UF');
await request(api, '/elections/map/values?indicator=renda', 400); await request(api, '/elections/map/values', 400);
const mapPage = await html('/mapa');
assert.equal((mapPage.match(/<figure class="choropleth"/g) ?? []).length, 2);
for (const text of ['Moradores com rendimento domiciliar per capita de até ½ salário mínimo', 'Abstenção na Presidência — 1º turno', 'Quintis', 'não demonstram relação de causa', 'Tabela dos mapas']) assert.ok(mapPage.includes(text), text);
assert.ok((await html('/mapa?uf=PE')).includes('Fernando de Noronha'));
// Fase 3: locais → setores (v2) e grupos de locais (métrica E).
if (catalog.tractsDatasets?.length) {
  const [tracts] = catalog.tractsDatasets;
  assert.equal(tracts.importerVersion, 'polling-place-tracts-2022-v2');
  assert.equal(sum(tracts.coverage, 'electors'), 155756933, 'Locais somam o cadastro doméstico');
  const associated = tracts.coverage.reduce((total, item) => total + item.byStatus.associated.electors, 0);
  assert.ok(associated / 155756933 > 0.9, 'Mais de 90% dos eleitores em locais associados');
  assert.ok(tracts.coverage.find((item) => item.uf === 'AP').byStatus.associated.electors / tracts.coverage.find((item) => item.uf === 'AP').electors > 0.8, 'AP: coordenadas sem zero inicial aceitas');
  assert.ok((await html('/fontes')).includes('Locais de votação e setores censitários'));
}
if (catalog.placeProfilesDatasets?.length && catalog.tractsDatasets?.length) {
  for (const indicator of ['college', 'income-median']) {
    const groups = await json(`/elections/places/groups?indicator=${indicator}&round=2`);
    assert.equal(groups.status, 'published'); assert.equal(groups.groups.length, 5);
    for (const group of groups.groups) {
      assert.equal(sum(group.candidates, 'votes'), group.valid, `${indicator} grupo ${group.index}: candidaturas = válidos`);
      assert.ok(group.from <= group.to);
    }
    for (let index = 1; index < 5; index++) assert.ok(groups.groups[index].from >= groups.groups[index - 1].to, 'Grupos ordenados pelo indicador');
    assert.equal(sum(groups.groups, 'totalVotes'), groups.coverage.votesInGroups); assert.ok(groups.coverage.votesInGroups <= groups.coverage.totalVotes);
    const shares = groups.groups.map((group) => group.eligible / sum(groups.groups, 'eligible'));
    assert.ok(shares.every((share) => share > 0.15 && share < 0.25), `${indicator}: grupos com ~1/5 do eleitorado`);
  }
  const page = await html('/perfis?indicator=income-median&round=2');
  for (const text of ['Resultados por perfil dos locais', 'Grupos de locais', 'descrevem locais, não pessoas', 'Grupo 5']) assert.ok(page.includes(text), text);
  await request(api, '/elections/places/groups?indicator=college&office=governor', 400);
}
console.log(`Smoke do contexto municipal aprovado: ${requests} requisições.`);
