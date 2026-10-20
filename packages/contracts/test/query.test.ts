import assert from 'node:assert/strict';
import { test } from 'node:test';
import { municipalityQuerySchema, placesQuerySchema, exteriorQuerySchema, exteriorResponseSchema, nationalQuerySchema, stateQuerySchema, datasetSchema, isStateOffice, roundHeld, SINGLE_ROUND_OFFICES, incomeBandOf, INCOME_BANDS, MINIMUM_WAGE_2022, placeGroupBandOf, placeGroupsQuerySchema, turnoutProfilesQuerySchema, mapQuerySchema, mapPageQuerySchema, placeTractsQuerySchema, placeTractsSchema, TRACT_STATUSES, URBAN_COUNTS, URBAN_INDICATORS, MAP_INDICATORS, CENSUS_MAP_INDICATORS, urbanIndex, urbanIdentityErrors, urbanIndicatorCounts, urbanSurroundingsSchema, hasControlCharacters, suggestQuerySchema, proposalsQuerySchema } from '../src';

test('aplica defaults e limita a paginação sem coerção de entradas vazias', () => {
  const defaults = municipalityQuerySchema.parse({});
  assert.equal(defaults.year, '2022');
  assert.equal(defaults.pageSize, 25);
  assert.equal(municipalityQuerySchema.parse({ page: '2', pageSize: '100' }).page, 2);
  for (const input of [{ page: '0' }, { page: '' }, { page: '1.5' }, { pageSize: '101' }, { uf: 'XX' }, { year: '2024' }, { round: '3' }, { office: 'deputies' }, { unknown: 'field' }, { year: ['2022', '2026'] }]) {
    assert.equal(municipalityQuerySchema.safeParse(input).success, false, JSON.stringify(input));
  }
});

test('filtros de locais aceitam identificadores exatos com zeros iniciais', () => {
  const result = placesQuerySchema.parse({ zone: '0001', section: '0002', local: '01015', search: '  Colégio  ' });
  assert.equal(result.zone, 1);
  assert.equal(result.section, 2);
  assert.equal(result.local, 1015);
  assert.equal(result.search, 'Colégio');
  for (const input of [{ zone: '0' }, { zone: '10000' }, { section: '-1' }, { section: '1.5' }, { local: 'abc' }, { zone: ['1', '2'] }, { section: '' }, { sort: 'municipality' }, { search: 'a'.repeat(101) }]) {
    assert.equal(placesQuerySchema.safeParse(input).success, false, JSON.stringify(input));
  }
});
test('resposta do exterior aceita filtros já normalizados, sem revalidar números como strings de URL', () => {
  const filters = exteriorQuerySchema.parse({ page: '2', pageSize: '100', year: '2026' });
  const data = exteriorResponseSchema.parse({ status: 'awaiting-import', filters, summary: null, dataset: null, items: [], pagination: { page: 2, pageSize: 100, total: 0 } });
  assert.equal(data.filters.page, 2); assert.equal(data.filters.pageSize, 100);
  assert.equal(exteriorQuerySchema.safeParse({ uf: 'SP' }).success, false);
});

test('governador é cargo estadual: aceito por UF, rejeitado no Brasil e no exterior', () => {
  assert.equal(municipalityQuerySchema.parse({ office: 'governor', uf: 'SP' }).office, 'governor');
  assert.equal(isStateOffice('governor'), true); assert.equal(isStateOffice('president'), false);
  assert.equal(nationalQuerySchema.safeParse({ office: 'governor' }).success, false);
  assert.equal(exteriorQuerySchema.safeParse({ office: 'governor' }).success, false);
  assert.equal(stateQuerySchema.safeParse({ office: 'governor' }).success, false, 'UF obrigatória');
  assert.equal(stateQuerySchema.safeParse({ office: 'governor', uf: 'ZZ' }).success, false);
  assert.equal(stateQuerySchema.parse({ office: 'governor', uf: 'SP' }).round, '1');
  // Versões antigas não têm `rounds`: ausência não vira turno único.
  const old = datasetSchema.parse({ id: 'x', year: 2022, office: 'president', importedAt: 'x', importerVersion: 'x', sources: [], scope: 'x', validation: 'reconciled' });
  assert.equal(old.rounds, undefined);
  assert.equal(roundHeld(old, '2'), true);
  assert.equal(roundHeld({ rounds: ['1'] }, '2'), false); assert.equal(roundHeld({ rounds: ['1'] }, '1'), true);
});

test('senador é cargo estadual de turno único', () => {
  assert.equal(isStateOffice('senator'), true);
  assert.equal(municipalityQuerySchema.parse({ office: 'senator', uf: 'RJ' }).office, 'senator');
  for (const schema of [nationalQuerySchema, exteriorQuerySchema]) assert.equal(schema.safeParse({ office: 'senator' }).success, false);
  assert.equal(stateQuerySchema.safeParse({ office: 'senator', uf: 'ZZ' }).success, false);
  assert.deepEqual(SINGLE_ROUND_OFFICES, ['senator']);
});

test('faixas fixas de renda: limite superior incluído, em salários mínimos de 2022', () => {
  assert.deepEqual([100, 1212, 1212.5, 1818, 1818.5, 2424, 2425, 3636, 3640, 22600].map(incomeBandOf), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(INCOME_BANDS.length, 5); assert.equal(MINIMUM_WAGE_2022, 1212);
});

test('faixa de um percentual por contagens: limite superior incluído, sem arredondar', () => {
  // Mulheres: cortes 50, 52, 54, 56. Exatamente 50% fica na 1ª faixa; 50,01% passa à 2ª.
  assert.equal(placeGroupBandOf('women', 50, 100), 1); assert.equal(placeGroupBandOf('women', 5001, 10000), 2);
  assert.equal(placeGroupBandOf('women', 13, 25), 2); assert.equal(placeGroupBandOf('women', 57, 100), 5);
  // 16 a 24 anos: corte de 12,5% exato (1/8).
  assert.equal(placeGroupBandOf('age-16-24', 1, 8), 2); assert.equal(placeGroupBandOf('age-16-24', 126, 1000), 3);
});

test('raio da sensibilidade e município da participação têm formatos fechados', () => {
  assert.equal(placeGroupsQuerySchema.parse({ indicator: 'income-median', radius: '500' }).radius, '500');
  assert.equal(placeGroupsQuerySchema.safeParse({ indicator: 'income-median', radius: '300' }).success, false);
  assert.equal(turnoutProfilesQuerySchema.parse({ uf: 'SP', municipality: '71072' }).municipality, '71072');
  for (const municipality of ['7107', '710720', 'abcde']) assert.equal(turnoutProfilesQuerySchema.safeParse({ uf: 'SP', municipality }).success, false, municipality);
});

test('página do mapa: abstenção como série padrão, só indicadores do Censo à esquerda e candidatura pelo número de urna', () => {
  assert.deepEqual(mapPageQuerySchema.parse({}), { year: '2022', round: '1', office: 'president', indicator: 'income-upto-half-mw', series: 'abstention' });
  assert.equal(mapPageQuerySchema.parse({ office: 'senator', uf: 'SE', series: '131' }).series, '131');
  for (const input of [{ indicator: 'abstention' }, { series: 'lula' }, { series: '1' }, { series: '123456' }, { office: 'deputies' }, { unknown: '1' }]) assert.equal(mapPageQuerySchema.safeParse(input).success, false, JSON.stringify(input));
  assert.equal(mapQuerySchema.parse({ indicator: 'abstention' }).office, 'president', 'Respostas anteriores eram sempre da Presidência');
});

test('associação local → setor: UF obrigatória, setor só para local associado e resumo igual aos locais', () => {
  assert.equal(placeTractsQuerySchema.safeParse({ uf: 'ZZ' }).success, false); assert.equal(placeTractsQuerySchema.safeParse({}).success, false);
  const summary = Object.fromEntries(TRACT_STATUSES.map((status) => [status, { places: status === 'associated' ? 1 : 0, electors: 0 }]));
  const item = { zone: 1, code: '1015', status: 'associated', latitude: -23.5, longitude: -46.6, sharedCoordinate: 0, tract: { code: '355030807000234', situation: 'Urbana', residents: 10, incomeMedian: MINIMUM_WAGE_2022, incomeBand: 1 } };
  assert.equal(placeTractsSchema.safeParse({ status: 'published', batchId: 'x', summary, items: [item] }).success, true);
  for (const items of [[{ ...item, tract: { ...item.tract, incomeBand: 2 } }], [{ ...item, status: 'ambiguous' }], [{ ...item, tract: null }], [item, item], [{ ...item, tract: { ...item.tract, code: '3550308' } }]]) {
    assert.equal(placeTractsSchema.safeParse({ status: 'published', batchId: 'x', summary, items }).success, false, JSON.stringify(items));
  }
});

test('entorno: 35 contagens na ordem do dicionário, categorias somando a base e indicadores no mapa do Censo', () => {
  assert.equal(URBAN_COUNTS, 35);
  assert.deepEqual([urbanIndex('circulation', 'CAMINHÃO, ÔNIBUS'), urbanIndex('sidewalk', 'SIM'), urbanIndex('ramp', 'SIM'), urbanIndex('trees', 'SALTADO')], [1, 21, 27, 34]);
  assert.throws(() => urbanIndex('sidewalk', 'SALTADO')); assert.throws(() => urbanIndex('trees', 'SIM'));
  const coherent = new Array<number>(35).fill(0); coherent[0] = 10; for (const offset of [1, 6, 9, 12, 15, 18, 21, 24, 27, 30]) coherent[offset] = 10;
  assert.deepEqual(urbanIdentityErrors(coherent), []);
  const broken = [...coherent]; broken[28] = 1;
  assert.deepEqual(urbanIdentityErrors(broken), ['ramp']);
  assert.equal(urbanSurroundingsSchema.safeParse({ tracts: 1, suppressedTracts: 0, counts: broken }).success, false);
  assert.equal(urbanSurroundingsSchema.safeParse({ tracts: 1, suppressedTracts: 0, counts: coherent.slice(1) }).success, false);
  assert.deepEqual(urbanIndicatorCounts(coherent, 'urban-trees'), { numerator: 0, denominator: 10 }, 'Sem árvores fica fora do numerador');
  for (const key of Object.keys(URBAN_INDICATORS)) { assert.equal(MAP_INDICATORS[key as keyof typeof MAP_INDICATORS].kind, 'entorno', key); assert.ok(CENSUS_MAP_INDICATORS.includes(key as never), key); }
});

test('buscas em texto livre recusam caracteres de controle, mas não espaços, tabulações nem quebras de linha', () => {
  for (const value of ['abc\u0000', 'a\u0001b', 'a\u001Fb', 'a\u007Fb', 'a\u0085b']) assert.equal(hasControlCharacters(value), true, JSON.stringify(value));
  for (const value of ['São Paulo', 'a\tb', 'a\nb', 'a\r\nb', 'proteção-social', 'a\u00A0b']) assert.equal(hasControlCharacters(value), false, JSON.stringify(value));
  assert.equal(municipalityQuerySchema.safeParse({ search: 'São\u0000' }).success, false);
  assert.equal(placesQuerySchema.safeParse({ search: 'Col\u0001égio' }).success, false);
  assert.equal(exteriorQuerySchema.safeParse({ search: 'Lisboa\u0000' }).success, false);
  assert.equal(suggestQuerySchema.safeParse({ q: 'sa\u0000o' }).success, false);
  assert.equal(proposalsQuerySchema.safeParse({ q: 'saude\u0000' }).success, false);
  assert.equal(proposalsQuerySchema.safeParse({ q: 'saúde\tpública' }).success, true);
  assert.equal(municipalityQuerySchema.parse({ search: '  São Paulo  ' }).search, 'São Paulo');
});
