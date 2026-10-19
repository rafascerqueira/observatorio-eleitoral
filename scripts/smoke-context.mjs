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
assert.equal(catalog.mapDatasets.length, 1); assert.equal(catalog.mapDatasets[0].importerVersion, 'maps-ibge-2022-v3');
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
// Série padrão: abstenção da Presidência (desde 19/10/2026 o cargo é escolhido no formulário).
for (const text of ['Moradores com rendimento domiciliar per capita de até ½ salário mínimo', 'Abstenção — Presidência, 1º turno', 'Quintis', 'não significam relação de causa', 'Tabela dos mapas', 'class="scatter-figure"']) assert.ok(mapPage.includes(text), text);
assert.ok((await html('/mapa?uf=PE')).includes('Fernando de Noronha'));
// Fase 3: locais → setores (v3, mesma associação da v2 com proveniência) e grupos de locais (métrica E).
if (catalog.tractsDatasets?.length) {
  const [tracts] = catalog.tractsDatasets;
  assert.equal(tracts.importerVersion, 'polling-place-tracts-2022-v3');
  assert.equal(sum(tracts.coverage, 'electors'), 155756933, 'Locais somam o cadastro doméstico');
  const associated = tracts.coverage.reduce((total, item) => total + item.byStatus.associated.electors, 0);
  assert.ok(associated / 155756933 > 0.9, 'Mais de 90% dos eleitores em locais associados');
  assert.ok(tracts.coverage.find((item) => item.uf === 'AP').byStatus.associated.electors / tracts.coverage.find((item) => item.uf === 'AP').electors > 0.8, 'AP: coordenadas sem zero inicial aceitas');
  assert.ok((await html('/fontes')).includes('Locais de votação e setores censitários'));
}
if (catalog.placeProfilesDatasets?.length && catalog.tractsDatasets?.length) {
  for (const indicator of ['college', 'education-low', 'women', 'age-16-24', 'age-60-plus', 'income-median']) {
    const groups = await json(`/elections/places/groups?indicator=${indicator}&round=2`);
    assert.equal(groups.status, 'published'); assert.ok(groups.groups.length >= 3, `${indicator}: faixas com locais`);
    assert.equal(groups.method, 'bands');
    for (const group of groups.groups) {
      assert.equal(sum(group.candidates, 'votes'), group.valid, `${indicator} grupo ${group.index}: candidaturas = válidos`);
      assert.ok(group.from <= group.to);
    }
    // Valores iguais nunca ficam em grupos diferentes (v2).
    for (let index = 1; index < groups.groups.length; index++) assert.ok(groups.groups[index].index > groups.groups[index - 1].index && groups.groups[index].from > groups.groups[index - 1].to, 'Grupos ordenados, sem empates divididos');
    // Faixas fixas: os mesmos limites no Brasil e numa UF (v4).
    const ma = await json(`/elections/places/groups?indicator=${indicator}&round=2&uf=MA`);
    for (const group of ma.groups) { const br = groups.groups.find((item) => item.index === group.index); if (br) assert.deepEqual([group.lower, group.upper], [br.lower, br.upper], `${indicator}: limites iguais no Brasil e no MA`); }
    assert.equal(sum(groups.groups, 'totalVotes'), groups.coverage.votesInGroups); assert.ok(groups.coverage.votesInGroups <= groups.coverage.totalVotes);
    for (const group of groups.groups) assert.ok((group.lower === null || group.from > group.lower) && (group.upper === null || group.to <= group.upper), `Faixa ${group.index}: valores dentro dos limites`);
  }
  // Moradores por faixa (todos os setores): faixas + sem mediana = total; UFs somam o Brasil; página do município mostra a tabela.
  if (catalog.incomeBandsDatasets?.length) {
    const br = (await json('/elections/places/groups?indicator=income-median&round=1')).population;
    assert.ok(br, 'Moradores por faixa na resposta de renda');
    assert.equal(sum(br.bands, 'residents') + br.noData.residents, br.total, 'Faixas + sem mediana = total');
    assert.equal(br.total, catalog.incomeBandsDatasets[0].totals.total, 'Brasil = total publicado');
    const ma = (await json('/elections/places/groups?indicator=income-median&round=1&uf=MA')).population;
    assert.ok(ma.total > 0 && ma.total < br.total);
    assert.equal((await json('/elections/places/groups?indicator=college&round=1')).population ?? null, null, 'Escolaridade sem moradores por faixa');
    const context = await json('/elections/municipalities/71072/context?year=2022&uf=SP');
    assert.equal(sum(context.incomeBands.bands, 'residents') + context.incomeBands.noData.residents, context.incomeBands.total);
    assert.ok((await html('/municipios/71072?uf=SP&round=1')).includes('Moradores por faixa de renda mediana do setor'));
    assert.ok((await html('/perfis?indicator=income-median&uf=MA')).includes('Moradores do território em setores da faixa'));
  }
  const page = await html('/perfis?indicator=income-median&round=2');
  for (const text of ['Resultados por perfil dos locais', 'Grupos de locais', 'descrevem locais, não pessoas', 'Mais de 3 SM', '3.636']) assert.ok(page.includes(text), text);
  await request(api, '/elections/places/groups?indicator=college&office=governor', 400);
  // Sensibilidade da associação local → setor: mesmos locais e votos do recorte; muda só a faixa de cada local.
  if (catalog.tractSensitivityImport) {
    const reference = await json('/elections/places/groups?indicator=income-median&round=1');
    for (const radius of ['250', '500', '1000']) {
      const groups = await json(`/elections/places/groups?indicator=income-median&round=1&radius=${radius}`);
      assert.equal(groups.status, 'published'); assert.equal(groups.association.radius, radius);
      assert.deepEqual([groups.coverage.places, groups.coverage.totalVotes], [reference.coverage.places, reference.coverage.totalVotes], `${radius} m: mesmo universo`);
      for (const group of groups.groups) { assert.equal(sum(group.candidates, 'votes'), group.valid); assert.equal(group.from, null); }
      const agreement = Object.values(groups.association.agreement);
      assert.equal(sum(agreement, 'places'), sum(Object.values(catalog.tractSensitivityImport.national[radius]), 'places'), `${radius} m: concordância nacional`);
    }
    await request(api, '/elections/places/groups?indicator=college&round=1&radius=500', 400);
    const alternative = await html('/perfis?indicator=income-median&round=1&radius=500');
    for (const text of ['Associação alternativa: setores a até 500 m', 'Sensibilidade à associação local → setor', 'vs. publicada']) assert.ok(alternative.includes(text), text);
  }
  // Demografia por setor (Censo): moradores de 15+ por faixa de eleitoras e de idade; escolaridade não tem equivalente.
  if (catalog.tractDemographyDatasets?.length) {
    const [demography] = catalog.tractDemographyDatasets;
    for (const indicator of ['women', 'age-16-24', 'age-60-plus']) {
      const population = (await json(`/elections/places/groups?indicator=${indicator}&round=1`)).population;
      assert.ok(population, `${indicator}: moradores por faixa`);
      assert.equal(sum(population.bands, 'residents'), population.total, `${indicator}: faixas = total de 15+`);
      assert.equal(sum(population.bands, 'tracts') + population.noData.tracts + population.undisclosed.tracts, demography.totals.tracts, `${indicator}: todos os setores`);
    }
    assert.equal((await json('/elections/places/groups?indicator=education-low&round=1')).population ?? null, null);
    assert.ok((await html('/perfis?indicator=age-60-plus&uf=MA')).includes('Moradores de 15+ em setores da faixa'));
  }
}
// Participação por perfil (TSE): contagens somam os totais publicados; DF fora da fonte; facultativo pela regra constitucional.
if (catalog.turnoutProfilesDatasets?.length) {
  const dataset = catalog.turnoutProfilesDatasets[0];
  assert.deepEqual(dataset.missingUfs, ['DF']);
  for (const round of ['1', '2']) {
    const br = await json(`/elections/turnout/profiles?round=${round}`);
    assert.equal(br.status, 'published'); assert.equal(br.ufs.length, 26); assert.deepEqual(br.missingUfs, ['DF']);
    const total = dataset.totals.find((item) => item.round === round);
    assert.equal(sum(br.cells, 'eligible'), total.eligible, `${round}º turno: aptos = total publicado`);
    assert.equal(sum(br.cells, 'abstentions'), total.abstentions); assert.equal(br.resultsEligible, total.resultsEligible);
    for (const cell of br.cells) {
      assert.equal(cell.turnout + cell.abstentions, cell.eligible, 'comparecimento + abstenção = aptos');
      assert.equal(cell.optional, cell.age === '16-17' || cell.age === '70+' || cell.education === 'illiterate', `facultativo: ${cell.age}/${cell.education}`);
    }
  }
  const sp = await json('/elections/turnout/profiles?round=2&uf=SP');
  assert.equal(sp.ufs.join(), 'SP'); assert.ok(sum(sp.cells, 'eligible') > 0);
  assert.equal((await json('/elections/turnout/profiles?uf=DF')).status, 'not-in-source');
  await request(api, '/elections/turnout/profiles?rows=age', 400);
  const page = await html('/participacao?uf=BA&round=1&rows=education&cols=obligation');
  for (const text of ['Taxa de abstenção', 'Facultativo (16–17, 70+ ou analfabeto)', 'Superior completo', 'não indica motivação']) assert.ok(page.includes(text), text);
  assert.ok((await html('/participacao?rows=age&cols=age')).includes('Escolha dimensões diferentes para linhas e colunas.'));
  assert.ok((await html('/participacao?uf=DF')).includes('não traz o'));
  // v2: estado civil e municípios, conferidos com as marginais do contexto municipal.
  if (dataset.cellFormat === 'int4-groups-v2') {
    const city = await json('/elections/turnout/profiles?round=1&uf=SP&municipality=71072');
    const context = (await json('/elections/municipalities/71072/context?uf=SP')).item.turnout['1'];
    assert.equal(city.municipality.name, 'São Paulo'); assert.equal(sum(city.cells, 'eligible'), context.eligible);
    const marital = context.dimensions.find((item) => item.dimension === 'maritalStatus');
    for (const category of marital.categories) assert.equal(sum(city.cells.filter((cell) => cell.maritalStatus === category.key), 'abstentions'), category.abstentions, `estado civil ${category.key}`);
    assert.ok((await json('/elections/turnout/profiles?round=1&uf=SP')).municipalities.length === 645);
    await request(api, '/elections/turnout/profiles?municipality=71072', 400);
    await request(api, '/elections/turnout/profiles?uf=SP&municipality=99999', 404);
    const page = await html('/participacao?uf=SP&municipality=71072&round=1&rows=maritalStatus&cols=gender');
    for (const text of ['Participação por perfil — São Paulo / SP', 'Solteiro(a)', 'Viúvo(a)']) assert.ok(page.includes(text), text);
    assert.ok((await html('/participacao?uf=SP&municipality=99999')).includes('não é de um município'));
    // Envio sem JavaScript: "Toda a UF" chega como municipality vazio e vale como ausência do filtro.
    assert.ok((await html('/participacao?uf=SP&municipality=&round=1&rows=education&cols=gender')).includes('Taxa de abstenção: Escolaridade declarada × Gênero'));
  }
}
assert.ok((await html('/municipios/71072?uf=SP&round=1')).includes('Estado civil dos eleitores aptos'));
// Mapa por candidatura: escala fixa; cada unidade traz todas as candidaturas e soma os válidos.
{
  const map = await json('/elections/map/candidates?round=1');
  assert.equal(map.status, 'published'); assert.equal(map.items.length, 27); assert.equal(map.candidates.length, 11);
  for (const item of map.items) assert.equal(sum(item.votes.map((value) => ({ value }))), item.valid, item.uf);
  map.candidates.forEach((candidate, index) => assert.equal(sum(map.items.map((item) => ({ value: item.votes[index] }))), candidate.votes, candidate.number));
  const governor = await json('/elections/map/candidates?office=governor&uf=SP&round=2');
  assert.equal(governor.items.length, 645); assert.equal(governor.candidates.length, 2);
  await request(api, '/elections/map/candidates?office=governor', 400);
  assert.equal((await json('/elections/map/candidates?office=senator&uf=SP&round=2')).status, 'round-not-held');
  const page = await html('/mapa/candidaturas?office=governor&uf=SP&round=2');
  for (const text of ['Votação por candidatura — São Paulo', 'mesma escala em todos os mapas', 'maioria absoluta dos votos válidos']) assert.ok(page.includes(text), text);
}
// Série comparada em /mapa (19/10/2026): abstenção do cargo escolhido = consolidado publicado da UF; candidatura; dispersão e CSV.
{
  for (const [office, round] of [['governor', '2'], ['senator', '1']]) {
    const values = await json(`/elections/map/values?indicator=abstention&office=${office}&uf=SP&round=${round}`);
    const state = await json(`/elections/state?office=${office}&uf=SP&round=${round}`);
    assert.equal(values.office, office);
    assert.deepEqual([sum(values.items, 'numerator'), sum(values.items, 'denominator')], [state.summary.totals.abstentions, state.summary.totals.eligible], `Abstenção de ${office} = resultado publicado da UF`);
  }
  assert.equal((await json('/elections/map/values?indicator=abstention&office=senator&uf=SP&round=2')).status, 'round-not-held');
  await request(api, '/elections/map/values?indicator=abstention&office=governor', 400);
  const page = await html('/mapa?uf=SP&office=governor&round=2&series=13');
  for (const text of ['Comparar com', 'FERNANDO HADDAD (13) — % dos votos válidos', 'class="scatter-figure"', 'Escala fixa, igual em todos os recortes', 'não traça tendência', 'Baixar estes dados (CSV)']) assert.ok(page.includes(text), text);
  const dots = (page.match(/class="scatter-dot"/g) ?? []).length;
  assert.ok(dots === 645 || page.includes(`${645 - dots} unidades sem um dos dois valores`), 'Um ponto por município com os dois valores; os demais declarados');
  assert.ok((await html('/mapa?uf=SP&office=governor&series=99')).includes('não está em Governador'));
  const lines = (await (await request(web, '/mapa/dados.csv?uf=SP&office=governor&round=2&series=13&indicator=literacy-15')).text()).replace(/^﻿/, '').trimEnd().split('\r\n');
  assert.equal(lines.length, 646); assert.ok(lines[0].startsWith('uf;codigo_tse;codigo_ibge;nome;'));
  const governor = await json('/elections/map/candidates?office=governor&uf=SP&round=2');
  assert.equal(lines.slice(1).reduce((total, line) => total + Number(line.split(';')[9]), 0), governor.candidates.find((item) => item.number === '13').votes, 'CSV soma os votos publicados da candidatura');
  await request(web, '/mapa/dados.csv?uf=SP&office=governor&series=99', 400);
}
// Associação local → setor por local (São Paulo: 2.049 locais no cadastro, 2.030 associados; conferido no banco em 19/10/2026).
if (catalog.tractsDatasets?.length) {
  const tracts = await json('/elections/municipalities/71072/place-tracts?uf=SP');
  assert.equal(tracts.items.length, 2049); assert.equal(tracts.summary.associated.places, 2030);
  assert.equal(sum(Object.values(tracts.summary), 'places'), tracts.items.length);
  assert.equal(tracts.items.find((item) => item.zone === 1 && item.code === '1015').tract.code, '355030807000234');
  await request(api, '/elections/municipalities/71072/place-tracts', 400);
  const page = await html('/municipios/71072?uf=SP&round=1');
  for (const text of ['Setor censitário 355030807000234', 'Locais deste município por situação da associação', 'não os eleitores que votam nele']) assert.ok(page.includes(text), text);
  assert.ok(!page.includes('Não há associação socioeconômica validada'));
  assert.ok(!(await html('/metodologia')).includes('O método geográfico ainda não foi definido'));
}
console.log(`Smoke do contexto municipal aprovado: ${requests} requisições.`);
