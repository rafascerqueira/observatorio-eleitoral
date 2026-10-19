import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { contextDistributionSchema } from '@observatorio/contracts';
import { DistributionTable } from '../components/municipality-context';

const base = { kind: 'universo' as const, source: 'Fonte sintética para teste', total: 10, categories: [{ key: 'a', label: 'A', value: 7 }] };
test('diferença conferida na fonte aparece sem atribuir causa, sem redistribuir as categorias', () => {
  const html = renderToStaticMarkup(createElement(DistributionTable, { title: 'Teste', unit: 'Pessoas', data: { ...base, undistributed: 3 } }));
  assert.match(html, /Diferença não discriminada/); assert.match(html, /30,0%/); assert.match(html, /70,0%/); assert.match(html, /causa não está informada/);
});
test('arredondamento da amostra, indisponibilidade, inconsistência e zero têm estados diferentes', () => {
  const render = (data: Parameters<typeof DistributionTable>[0]['data']) => renderToStaticMarkup(createElement(DistributionTable, { title: 'Teste', unit: 'Pessoas', data }));
  assert.match(render({ ...base, kind: 'amostra', total: 8, roundingDifference: -1 }), /arredondadas por célula/);
  const missing = render({ ...base, categories: [{ key: 'a', label: 'A', value: null }] }); assert.match(missing, /indisponíveis no arquivo/); assert.doesNotMatch(missing, /<td>0,0%/);
  const invalid = render(base); assert.match(invalid, /Falha técnica ou inconsistência/); assert.doesNotMatch(invalid, /<table/);
  const zero = render({ ...base, total: 0, categories: [{ key: 'a', label: 'A', value: 0 }] }); assert.match(zero, /Indisponível/); assert.doesNotMatch(zero, /100,0%/);
});
test('contrato bloqueia categorias duplicadas, diferença sem explicação, supressão deduzida e arredondamento inválido', () => {
  const invalid = [base, { ...base, undistributed: 2 }, { ...base, categories: [...base.categories, ...base.categories] }, { ...base, roundingDifference: -3 },
    { ...base, kind: 'amostra', roundingDifference: -3 }, { ...base, undistributed: 3, roundingDifference: -3 }, { ...base, categories: [{ key: 'a', label: 'A', value: null }], undistributed: 10 }];
  for (const item of invalid) assert.equal(contextDistributionSchema.safeParse(item).success, false);
});
