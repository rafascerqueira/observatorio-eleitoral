import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placesQuerySchema } from '@observatorio/contracts';
import { clearPlacesHref, placesHref } from '../lib/place-navigation';

test('paginação e troca de turno preservam todos os filtros da busca', () => {
  const filters = placesQuerySchema.parse({ year: '2022', round: '1', zone: '0001', section: '2', local: '1015', search: 'Rua São João', page: '3', pageSize: '10' });
  const url = new URL(placesHref('71072', filters, { page: 4 }), 'http://localhost');
  assert.equal(url.searchParams.get('page'), '4');
  assert.equal(url.searchParams.get('zone'), '1');
  assert.equal(url.searchParams.get('section'), '2');
  assert.equal(url.searchParams.get('local'), '1015');
  assert.equal(url.searchParams.get('search'), 'Rua São João');
  const turn = new URL(placesHref('71072', filters, { round: '2', page: 1 }), 'http://localhost');
  assert.equal(turn.searchParams.get('round'), '2');
  assert.equal(turn.searchParams.get('page'), '1');
  assert.equal(turn.searchParams.get('section'), '2');
});
test('limpar busca mantém contexto da eleição e remove os filtros e a página antiga', () => {
  const filters = placesQuerySchema.parse({ year: '2022', round: '2', zone: '1', section: '2', local: '1015', search: 'Escola', page: '3', pageSize: '50' });
  const url = new URL(clearPlacesHref('71072', filters), 'http://localhost');
  for (const key of ['zone', 'section', 'local', 'search']) assert.equal(url.searchParams.has(key), false);
  assert.equal(url.searchParams.get('round'), '2');
  assert.equal(url.searchParams.get('pageSize'), '50');
  assert.equal(url.searchParams.get('page'), '1');
});
test('locais de ZZ preservam identidade e navegam na rota própria do exterior', () => {
  const filters = placesQuerySchema.parse({ uf: 'ZZ', year: '2022', round: '2', zone: '1', section: '123', page: '3' });
  const url = new URL(placesHref('29955', filters, { page: 2 }), 'http://localhost');
  assert.equal(url.pathname, '/exterior/29955'); assert.equal(url.searchParams.get('uf'), 'ZZ');
  assert.equal(url.searchParams.get('section'), '123');
  const clean = new URL(clearPlacesHref('29955', filters), 'http://localhost');
  assert.equal(clean.pathname, '/exterior/29955'); assert.equal(clean.searchParams.get('round'), '2'); assert.equal(clean.searchParams.has('section'), false);
});
