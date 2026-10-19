// Dados exclusivamente sintéticos para verificar as regras do entorno; não são publicados.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { URBAN_COUNTS, urbanIndex } from '@observatorio/contracts';
import { municipalMatches, URBAN_LABELS, urbanCounts } from '../src/urban-surroundings';

const variables = Array.from({ length: URBAN_COUNTS }, (_, index) => `V${String(5200 + index).padStart(5, '0')}`);
/** Linha coerente: base 10 em todas as características, na primeira categoria de cada uma. */
const coherent = () => { const counts = new Array<number>(URBAN_COUNTS).fill(0); counts[0] = 10; let offset = 1; for (const size of [5, 3, 3, 3, 3, 3, 3, 3, 3, 5]) { counts[offset] = 10; offset += size; } return counts; };
const row = (values: Array<string | number>) => Object.fromEntries(variables.map((variable, index) => [variable, String(values[index])]));

test('rótulos auditados seguem o dicionário de pessoas, na ordem das 35 variáveis', () => {
  assert.equal(URBAN_LABELS.length, 35);
  assert.equal(URBAN_LABELS[0], '[QUANTIDADE DE MORADORES][Domicílios particulares permanentes ocupados][DOMICÍLIO EM SETOR ESCOLHIDO PARA APLICAÇÃO DO ENTORNO]');
  assert.equal(URBAN_LABELS[urbanIndex('sidewalk', 'SIM')], `${URBAN_LABELS[0]}[DOMICÍLIOS EM FACE COM CALÇADA - SIM]`);
  assert.equal(URBAN_LABELS[34], `${URBAN_LABELS[0]}[DOMICÍLIOS EM FACE COM ARBORIZAÇÃO - SALTADO]`);
  assert.equal(urbanIndex('sidewalk', 'SIM'), 21); assert.equal(urbanIndex('ramp', 'SIM'), 27); assert.equal(urbanIndex('trees', '5 OU MAIS ÁRVORES'), 33);
});

test('linha coerente vira contagens; omitida por inteiro vira null; mistura, outro símbolo ou soma errada bloqueiam', () => {
  assert.deepEqual(urbanCounts(row(coherent()), 'teste'), coherent());
  assert.equal(urbanCounts(row(new Array(URBAN_COUNTS).fill('X')), 'teste'), null, 'Setor omitido pelo IBGE não vira zero');
  const mixed = coherent().map(String); mixed[5] = 'X';
  assert.throws(() => urbanCounts(row(mixed), 'teste'), /valores não previstos/);
  const dot = coherent().map(String); dot[3] = '.';
  assert.throws(() => urbanCounts(row(dot), 'teste'), /valores não previstos/);
  const broken = coherent(); broken[urbanIndex('ramp', 'NÃO')] = 1;
  assert.throws(() => urbanCounts(row(broken), 'teste'), /ramp/);
  assert.throws(() => urbanCounts({ V05200: '1' }, 'teste'), /ausente/);
});

test('município confere com setores: exato sem omitido; com omitido, nunca abaixo da soma divulgada', () => {
  const tracts = coherent();
  assert.equal(municipalMatches(coherent(), tracts, 0), true);
  assert.equal(municipalMatches(coherent().map((value) => value * 2), tracts, 0), false, 'Sem omitido, a soma é exata');
  assert.equal(municipalMatches(coherent().map((value) => value * 2), tracts, 1), true, 'Arquivo municipal inclui o setor omitido');
  assert.equal(municipalMatches(coherent().map((value) => Math.max(0, value - 1)), tracts, 1), false, 'Abaixo da soma divulgada é divergência');
});
