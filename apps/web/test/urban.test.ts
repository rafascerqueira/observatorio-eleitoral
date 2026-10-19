import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { URBAN_COUNTS, urbanIndex } from '@observatorio/contracts';
import { urbanRows } from '../lib/urban';
import { TractUrban, UrbanSurroundingsTable } from '../components/urban-surroundings';

// Vetor sintético coerente (valores fictícios): base 100 em cada característica, com calçada 80/15/5 e árvores 10/20/30/35/5.
function counts() {
  const vector = new Array<number>(URBAN_COUNTS).fill(0); vector[0] = 100; let offset = 1;
  for (const size of [5, 3, 3, 3, 3, 3, 3, 3, 3, 5]) { vector[offset] = 100; offset += size; }
  vector[urbanIndex('sidewalk', 'SIM')] = 80; vector[urbanIndex('sidewalk', 'NÃO')] = 15; vector[urbanIndex('sidewalk', 'NÃO DECLARADO')] = 5;
  for (const [category, value] of [['SEM ÁRVORES', 10], ['DE 1 A 2 ÁRVORES', 20], ['DE 3 A 4 ÁRVORES', 30], ['5 OU MAIS ÁRVORES', 35], ['SALTADO', 5]] as const) vector[urbanIndex('trees', category)] = value;
  return vector;
}
const text = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element).replaceAll('<!-- -->', '');

test('cada indicador lê categorias publicadas: com, sem e não declarado ou não avaliado somam a base', () => {
  const rows = urbanRows(counts());
  assert.equal(rows.length, 8);
  for (const row of rows) assert.equal(row.present + row.absent + row.other, row.base, row.indicator);
  assert.deepEqual(rows.find((row) => row.indicator === 'urban-sidewalk'), { indicator: 'urban-sidewalk', label: 'Calçada', present: 80, absent: 15, other: 5, base: 100 });
  assert.deepEqual(rows.find((row) => row.indicator === 'urban-trees'), { indicator: 'urban-trees', label: 'Ao menos uma árvore', present: 85, absent: 10, other: 5, base: 100 });
});

test('município: base, cobertura frente à população, setores omitidos e leitura sem atribuir desejo aos moradores', () => {
  const html = text(createElement(UrbanSurroundingsTable, { data: { tracts: 12, suppressedTracts: 2, counts: counts() }, population: 400 }));
  for (const value of ['Base: 100 moradores', 'de 12 setor(es)', '25,0% da população residente', '2 setor(es) têm dados omitidos', 'não indica ausência da infraestrutura', 'não a opinião ou as prioridades', '80,0%', '15,0%', '5,0%', '85,0%']) assert.ok(html.includes(value), value);
  const unknown = text(createElement(UrbanSurroundingsTable, { data: { tracts: 12, suppressedTracts: 0, counts: counts() }, population: null }));
  assert.doesNotMatch(unknown, /população residente/); assert.doesNotMatch(unknown, /omitidos/);
});

test('setor do local: pesquisado com contagens; omitido e fora da pesquisa nunca viram zero', () => {
  const surveyed = text(createElement(TractUrban, { urban: { status: 'surveyed', counts: counts() } }));
  assert.doesNotMatch(surveyed, /role="region"/, 'Tabela pequena, sem região rolável repetida em cada cartão'); assert.match(surveyed, /de 100 pesquisados/); assert.match(surveyed, /Calçada<\/th><td>80,0% <span class="source-note">\(80\)/); assert.match(surveyed, /href="\/metodologia#entorno"/);
  assert.match(text(createElement(TractUrban, { urban: { status: 'suppressed', counts: null } })), /omitidos pelo IBGE/);
  const outside = text(createElement(TractUrban, { urban: { status: 'outside', counts: null } }));
  assert.match(outside, /fora dos setores escolhidos/); assert.doesNotMatch(outside, /0,0%/);
});
