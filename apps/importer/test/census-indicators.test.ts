// Dados exclusivamente sintéticos para verificar invariantes; não são publicados.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CENSUS_THEMES, censusIndicatorsSchema, contextDistributionSchema, MAP_INDICATORS } from '@observatorio/contracts';
import { buildDistribution, categoryKey, DISTRIBUTIONS, FAVELA_DIVERGENCES, favelaStatus, sliceCount, sliceValue, specCoverageErrors, ufTolerance } from '../src/census-indicators-model';

test('cada tema e recorte dos contratos tem exatamente uma especificação no importador', () => {
  assert.deepEqual(specCoverageErrors(), []);
  assert.equal(new Set(DISTRIBUTIONS.map((spec) => spec.theme)).size, Object.keys(CENSUS_THEMES).length);
});

test('recortes de idade: soma menos subtração, indisponível propaga e negativo bloqueia', () => {
  const ages: Record<string, number | null> = { Total: 100, '0 a 4 anos': 10, '5 a 9 anos': 10, '10 a 14 anos': 10, '15 anos': 2, '16 anos': 2, '17 anos': 2 };
  const cell = (age: string | null) => ages[age ?? 'Total']!;
  assert.equal(sliceValue({ plus: ['Total'], minus: ['0 a 4 anos', '5 a 9 anos', '10 a 14 anos', '15 anos'] }, cell), 68);
  assert.equal(sliceValue({ plus: ['16 anos', '17 anos'] }, cell), 4);
  assert.equal(sliceValue({ plus: [] }, cell), 100, 'tabela sem idade lê a célula direta');
  assert.equal(sliceValue({ plus: ['Total'], minus: ['15 anos'] }, (age) => age === '15 anos' ? null : 100), null, 'nunca vira zero');
  assert.throws(() => sliceValue({ plus: ['15 anos'], minus: ['Total'] }, cell), /negativo/);
  assert.equal(sliceCount({ plus: ['Total'], minus: ['a', 'b', 'c'] }), 4);
  assert.equal(sliceCount({ plus: [] }), 1);
});

test('distribuições: universo exato, cor ou raça com diferença não discriminada, amostra com limite proporcional aos recortes', () => {
  const universe = { kind: 'universo', mode: 'exact', source: 'sintético' } as const;
  assert.throws(() => buildDistribution(universe, 10, [{ label: 'A', value: 4 }, { label: 'B', value: 5 }], 1, 'x'), /somam 9/);
  const partial = buildDistribution({ ...universe, mode: 'partial' }, 10, [{ label: 'A', value: 4 }, { label: 'B', value: 5 }], 1, 'x');
  assert.equal(partial.undistributed, 1);
  assert.throws(() => buildDistribution({ ...universe, mode: 'partial' }, 8, [{ label: 'A', value: 4 }, { label: 'B', value: 5 }], 1, 'x'), /acima do total/);
  const sample = { kind: 'amostra', mode: 'rounding', source: 'sintético' } as const;
  // Duas categorias: limite 2 por recorte; com 4 recortes combinados, até 8.
  assert.throws(() => buildDistribution(sample, 100, [{ label: 'A', value: 50 }, { label: 'B', value: 55 }], 1, 'x'), /arredondamento/);
  const derived = buildDistribution(sample, 100, [{ label: 'A', value: 50 }, { label: 'B', value: 55 }], 4, 'x');
  assert.equal(derived.roundingDifference, 5); assert.equal(derived.slices, 4);
  assert.ok(contextDistributionSchema.safeParse(derived).success, 'o contrato aceita o limite proporcional aos recortes');
  assert.ok(!contextDistributionSchema.safeParse({ ...derived, slices: undefined }).success, 'sem `slices`, o limite volta a ser o de um recorte');
  const missing = buildDistribution(sample, 100, [{ label: 'A', value: null }, { label: 'B', value: 55 }], 4, 'x');
  assert.equal(missing.roundingDifference, undefined, 'célula indisponível não permite deduzir diferença');
  assert.equal(categoryKey('Umbanda e Candomblé'), 'umbanda-e-candomble');
  assert.equal(categoryKey('Mais de 1/4 a 1/2 salário mínimo'), 'mais-de-1-4-a-1-2-salario-minimo');
});

test('favelas: duas fontes concordam ou a divergência precisa estar declarada e confirmada', () => {
  assert.equal(favelaStatus('3550308', true, true), 'present');
  assert.equal(favelaStatus('1100015', false, false), 'not-delimited');
  assert.throws(() => favelaStatus('1100015', false, true), /setor de favela ausente da SIDRA/);
  assert.throws(() => favelaStatus('1100015', true, false), /na SIDRA sem setor/);
  const [declared] = Object.keys(FAVELA_DIVERGENCES);
  assert.equal(favelaStatus(declared!, false, true), 'divergent');
  assert.throws(() => favelaStatus(declared!, true, true), /não se confirma/);
});

test('soma dos municípios × UF: exata no universo, meio por município na amostra', () => {
  assert.equal(ufTolerance('universo', 853), 0);
  assert.equal(ufTolerance('amostra', 853), 427);
});

test('o contrato do município exige todos os recortes e favelas coerentes com a situação', () => {
  const distribution = { kind: 'universo', source: 's', total: 1, categories: [{ key: 'a', label: 'A', value: 1 }] };
  const share = { kind: 'amostra', source: 's', numerator: 1, denominator: 2 };
  const item = { ibgeCode: '1100015', code: '00310', uf: 'RO', name: 'Sintético', age15: { age15: 1, age15plus: 10 },
    distributions: Object.fromEntries(Object.entries(CENSUS_THEMES).map(([theme, slices]) => [theme, Object.fromEntries(slices.map((slice) => [slice, distribution]))])),
    disability: { '15+': share, '70+': share, types: [] }, migration: { '15+': share, '70+': share },
    favela: { status: 'not-delimited', favelas: 0, '15+': { ...share, kind: 'universo', numerator: 0 } } };
  assert.ok(censusIndicatorsSchema.safeParse(item).success);
  assert.ok(!censusIndicatorsSchema.safeParse({ ...item, distributions: { ...item.distributions, race: { '16+': distribution } } }).success, 'recorte faltando');
  assert.ok(!censusIndicatorsSchema.safeParse({ ...item, favela: { status: 'not-delimited', favelas: null, '15+': null } }).success, 'ausência não é zero sem conferência');
  assert.ok(!censusIndicatorsSchema.safeParse({ ...item, favela: { status: 'divergent', favelas: null, '15+': null } }).success, 'divergência exige nota');
  assert.ok(!censusIndicatorsSchema.safeParse({ ...item, migration: { '15+': { ...share, numerator: 3 }, '70+': share } }).success, 'numerador acima do denominador');
});

test('cada categoria pedida pelo mapa existe na especificação da tabela que a publica', () => {
  for (const [key, item] of Object.entries(MAP_INDICATORS)) {
    const census = (item as { census?: { theme: string; keys?: readonly string[] } }).census;
    if (!census?.keys || census.keys[0] === 'numerator') continue;
    const spec = DISTRIBUTIONS.find((entry) => entry.theme === census.theme)!;
    for (const category of census.keys) assert.ok(spec.categories.map(categoryKey).includes(category), `${key}: ${category}`);
  }
});
