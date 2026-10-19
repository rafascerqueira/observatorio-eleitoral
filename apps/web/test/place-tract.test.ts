import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TRACT_STATUSES, type PlaceTract } from '@observatorio/contracts';
import { PlaceTractDetails, TractSummaryTable } from '../components/place-tract';
import { TRACT_STATUS_REASONS } from '../lib/tracts';

// Local e setor sintéticos (códigos de formato real, valores fictícios).
const associated: PlaceTract = { zone: 1, code: '1015', status: 'associated', latitude: -23.5651592, longitude: -46.6510618, sharedCoordinate: 0,
  tract: { code: '355030807000234', situation: 'Urbana', residents: 1234, incomeMedian: 1515.5, incomeBand: 2 } };
// A moeda em pt-BR usa espaço não separável depois de "R$".
const render = (item: PlaceTract | undefined) => renderToStaticMarkup(createElement(PlaceTractDetails, { item })).replaceAll(' ', ' ');

test('local associado mostra setor, situação, moradores e faixa da mediana, sempre como entorno do prédio', () => {
  const html = render(associated);
  for (const text of ['Setor censitário 355030807000234', 'Urbana', '1.234', 'R$ 1.515,50', 'Mais de 1 a 1,5 SM', 'latitude -23,5651592, longitude -46,6510618', 'não os eleitores que votam nele', 'href="/metodologia#perfis"']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /mesma coordenada/);
});

test('mediana omitida, situação ausente, ponto compartilhado e local sem associação não viram zero nem setor escolhido', () => {
  const omitted = render({ ...associated, sharedCoordinate: 2, tract: { ...associated.tract!, situation: null, residents: null, incomeMedian: null, incomeBand: null } });
  for (const text of ['Indisponível: omitido pelo IBGE ou não se aplica', 'Não informada na malha do IBGE', 'Outros 2 locais de nome diferente estão na mesma coordenada exata']) assert.ok(omitted.includes(text), text);
  assert.doesNotMatch(omitted, /R\$ 0/);
  for (const status of TRACT_STATUSES.filter((item) => item !== 'associated')) {
    const html = render({ ...associated, status, tract: null, latitude: null, longitude: null });
    assert.ok(html.includes(TRACT_STATUS_REASONS[status as keyof typeof TRACT_STATUS_REASONS]), status); assert.match(html, /não associado/); assert.doesNotMatch(html, /Coordenada do local/);
  }
  assert.match(render(undefined), /sem registro no cadastro de locais/);
});

test('resumo do município soma só situações com locais, com total', () => {
  const summary = Object.fromEntries(TRACT_STATUSES.map((status) => [status, { places: 0, electors: 0 }])) as Record<typeof TRACT_STATUSES[number], { places: number; electors: number }>;
  summary.associated = { places: 3, electors: 3000 }; summary['no-coordinate'] = { places: 1, electors: 250 };
  const html = renderToStaticMarkup(createElement(TractSummaryTable, { summary }));
  assert.equal((html.match(/<tr>/g) ?? []).length, 3, 'Cabeçalho e duas situações com locais'); assert.match(html, /Total<\/th><td>4<\/td><td>3.250<\/td>/); assert.doesNotMatch(html, /Fora dos setores/);
});
