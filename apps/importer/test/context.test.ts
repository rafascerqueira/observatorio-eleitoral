// Dados exclusivamente sintéticos para verificar invariantes; não são publicados.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distribution, populationByAge, TSE_AGE_BANDS, tseCategory, tseOrder } from '../src/context-model';
import { sidraValue } from '../src/sidra';
import { AGE_GROUPS, ageGroupOf, optionalVoter, TSE_PROFILE_LABELS } from '@observatorio/contracts';

test('valores da SIDRA seguem as convenções do IBGE: "-" é zero; X, .. e ... nunca viram zero', () => {
  assert.equal(sidraValue('1234'), 1234); assert.equal(sidraValue('2713.36'), 2713.36); assert.equal(sidraValue('-'), 0);
  for (const value of ['X', '.', '..', '...']) assert.equal(sidraValue(value), null, value);
  for (const value of ['1,5', 'abc', '', '-1']) assert.throws(() => sidraValue(value), value);
  assert.throws(() => sidraValue(undefined));
});

function ages(overrides: Record<string, number | null> = {}) {
  // Município sintético: 10 pessoas por grupo/idade, partição completa somando o total.
  const values = new Map<string, number | null>();
  const partition = ['0 a 4 anos', '5 a 9 anos', '10 a 14 anos', '15 anos', '16 anos', '17 anos', '18 anos', '19 anos', '20 a 24 anos',
    ...Array.from({ length: 15 }, (_, index) => `${25 + index * 5} a ${29 + index * 5} anos`), '100 anos ou mais'];
  for (const name of partition) values.set(name, 10);
  values.set('20 anos', 4); values.set('Total', partition.length * 10);
  for (const [name, value] of Object.entries(overrides)) values.set(name, value);
  return values;
}
test('população por faixas do TSE: 21–24 é 20–24 menos 20 anos, e a partição precisa somar o total', () => {
  const result = populationByAge(ages(), 'sintético');
  assert.equal(result.populationByAge.categories.find((item) => item.key === 'a20')?.value, 4);
  assert.equal(result.populationByAge.categories.find((item) => item.key === 'a21-24')?.value, 6);
  assert.equal(result.population.total, 250);
  // 16+ = 16,17,18,19 (40) + 20–24 (10) + 25–99 (15 grupos, 150) + 100+ (10) = 210.
  assert.equal(result.population.age16plus, 210); assert.equal(result.populationByAge.total, 210);
  assert.equal(result.population.age16to17, 20);
  assert.equal(result.population.age70plus, 70, '70–74 … 95–99 (6 grupos) + 100+');
  assert.equal(result.population.age18to69, 210 - 20 - 70);
  assert.deepEqual(result.populationByAge.categories.map((item) => item.key), TSE_AGE_BANDS.map((item) => item.key));
  assert.throws(() => populationByAge(ages({ Total: 251 }), 'sintético'), /idades somam o total/);
  assert.throws(() => populationByAge(ages({ '20 anos': 11 }), 'sintético'), /20 anos maior/);
  const suppressed = populationByAge(ages({ '35 a 39 anos': null }), 'sintético');
  assert.equal(suppressed.population.age16plus, null, 'Supressão não vira zero nem é omitida da soma');
  assert.equal(suppressed.population.age18to69, null); assert.equal(suppressed.population.age16to17, 20);
  const missing = ages(); missing.delete('15 anos');
  assert.throws(() => populationByAge(missing, 'sintético'), /ausente/);
});

test('categorias do TSE: rótulos auditados, "não informado" e "inválido" explícitos, desconhecidos bloqueiam', () => {
  assert.equal(tseCategory('education', 'LÊ E ESCREVE').key, 'reads-writes');
  assert.equal(tseCategory('maritalStatus', 'VIÚVO').key, 'widowed');
  assert.equal(tseCategory('age', '25 a 29 anos                  ').key, 'a25-29');
  assert.equal(tseCategory('age', 'Inválido').key, 'invalid'); assert.equal(tseCategory('age', 'Inválida').key, 'invalid');
  assert.equal(tseCategory('gender', 'NÃO INFORMADO').key, 'not-informed');
  assert.throws(() => tseCategory('gender', 'OUTRO'), /não auditada/);
  assert.throws(() => tseCategory('age', '15 anos'), /não auditada/, 'Idade abaixo de 16 não existe no eleitorado');
  assert.deepEqual(tseOrder('gender').map((item) => item.key), ['female', 'male', 'not-informed']);
});

test('distribuição confere a soma das categorias, salvo quando há supressão', () => {
  const ok = distribution('universo', 'teste', 10, [{ key: 'a', label: 'A', value: 4 }, { key: 'b', label: 'B', value: 6 }], 'sintético');
  assert.equal(ok.total, 10);
  assert.throws(() => distribution('universo', 'teste', 11, [{ key: 'a', label: 'A', value: 4 }, { key: 'b', label: 'B', value: 6 }], 'sintético'), /soma das categorias/);
  assert.equal(distribution('amostra', 'teste', 11, [{ key: 'a', label: 'A', value: null }, { key: 'b', label: 'B', value: 6 }], 'sintético').categories[0]?.value, null);
  const two = [{ key: 'a', label: 'A', value: 4 }, { key: 'b', label: 'B', value: 6 }];
  assert.equal(distribution('amostra', 'teste', 12, two, 'sintético', 'rounding').roundingDifference, -2, 'Arredondamento registrado, não ajustado');
  assert.throws(() => distribution('amostra', 'teste', 13, two, 'sintético', 'rounding'), /arredondamento/);
  assert.equal(distribution('universo', 'teste', 15, two, 'sintético', 'partial').undistributed, 5);
  assert.throws(() => distribution('universo', 'teste', 9, two, 'sintético', 'partial'), /acima do total/);
  assert.equal(distribution('universo', 'teste', 10, two, 'sintético', 'partial').undistributed, undefined);
});

test('rótulos dos cruzamentos nos contratos = ordem do importador; faixas agregadas cobrem todas as faixas do TSE uma vez', () => {
  for (const dimension of ['gender', 'education'] as const) assert.deepEqual(TSE_PROFILE_LABELS[dimension], tseOrder(dimension));
  const bands = AGE_GROUPS.flatMap((group) => group.bands as readonly string[]);
  assert.deepEqual([...bands].sort(), tseOrder('age').map((item) => item.key).sort());
  assert.equal(ageGroupOf('a17'), '16-17'); assert.equal(ageGroupOf('a70-74'), '70+'); assert.equal(ageGroupOf('a18'), '18-24');
  assert.ok(optionalVoter('a17', 'college-complete') && optionalVoter('a40-44', 'illiterate') && optionalVoter('a100+', 'reads-writes'));
  assert.ok(!optionalVoter('a18', 'reads-writes') && !optionalVoter('a65-69', 'not-informed') && !optionalVoter('invalid', 'college-complete'));
});
