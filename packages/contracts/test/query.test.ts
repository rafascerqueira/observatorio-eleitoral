import assert from 'node:assert/strict';
import { test } from 'node:test';
import { municipalityQuerySchema, placesQuerySchema, exteriorQuerySchema, exteriorResponseSchema, nationalQuerySchema, stateQuerySchema, datasetSchema, isStateOffice } from '../src';

test('aplica defaults e limita a paginação sem coerção de entradas vazias', () => {
  const defaults = municipalityQuerySchema.parse({});
  assert.equal(defaults.year, '2022');
  assert.equal(defaults.pageSize, 25);
  assert.equal(municipalityQuerySchema.parse({ page: '2', pageSize: '100' }).page, 2);
  for (const input of [{ page: '0' }, { page: '' }, { page: '1.5' }, { pageSize: '101' }, { uf: 'XX' }, { year: '2024' }, { round: '3' }, { office: 'senator' }, { unknown: 'field' }, { year: ['2022', '2026'] }]) {
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
});
