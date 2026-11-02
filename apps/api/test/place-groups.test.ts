import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INCOME_BANDS, REGION_STATES, percent, type PlaceGroups } from '@observatorio/contracts';
import { regionalPlaceGroups } from '../src/elections/place-groups';
import { ElectionsController } from '../src/elections/elections.controller';
import type { DatabaseService } from '../src/database/database.service';

// Todas as contagens e identidades são sintéticas; pesos distintos detectam média incorreta de percentuais.
function fixture(): PlaceGroups[] {
  return REGION_STATES.SE.map((uf, index) => {
    const valid = index === 3 ? 70 : 10, votes = index === 3 ? 0 : 10;
    return { status: 'published', office: 'president', round: '1', uf, indicator: 'college', method: 'bands',
      coverage: { places: 2, placesInGroups: 1, totalVotes: valid + 2, votesInGroups: valid },
      groups: [{ index: 1, from: index, to: index + 1, lower: null, upper: 5, places: 1, eligible: valid * 2, valid, blank: 0, null: 0, totalVotes: valid,
        candidates: [{ number: '10', name: 'A sintética', party: 'TESTE A', votes, percentValid: percent(votes, valid) },
          { number: '20', name: 'B sintética', party: 'TESTE B', votes: valid - votes, percentValid: percent(valid - votes, valid) }] }] };
  });
}

test('região soma votos e denominadores, preserva excluídos e não modifica os dados das UFs', () => {
  const values = fixture(), before = structuredClone(values);
  const result = regionalPlaceGroups('SE', values);
  assert.equal(result.region, 'SE'); assert.equal(result.uf, null);
  assert.deepEqual(result.coverage, { places: 8, placesInGroups: 4, totalVotes: 108, votesInGroups: 100 });
  assert.equal(result.groups[0]!.valid, 100); assert.equal(result.groups[0]!.eligible, 200);
  assert.equal(result.groups[0]!.candidates.find((item) => item.number === '10')!.percentValid, 30);
  assert.equal(result.groups[0]!.from, 0); assert.equal(result.groups[0]!.to, 4);
  assert.deepEqual(values, before);
});

test('região recusa cobertura parcial, duplicatas, quintis e divergências de candidatura, votos ou limites', () => {
  const reject = (change: (values: PlaceGroups[]) => void, pattern: RegExp) => {
    const values = fixture(); change(values); assert.throws(() => regionalPlaceGroups('SE', values), pattern);
  };
  reject((v) => { v.pop(); }, /Cobertura/);
  reject((v) => { v[0]!.uf = v[1]!.uf; }, /Cobertura/);
  reject((v) => { for (const x of v) x.method = 'quintiles'; }, /faixas fixas/);
  reject((v) => { v[0]!.groups[0]!.candidates[0]!.party = 'OUTRO'; }, /Identidade/);
  reject((v) => { v[0]!.groups[0]!.candidates[0]!.votes--; }, /válidos/);
  reject((v) => { v[0]!.groups[0]!.upper = 10; }, /Limites/);
  reject((v) => { v[0]!.groups.push(v[0]!.groups[0]!); }, /Cobertura/);
  reject((v) => { v[0]!.round = '2'; }, /incompatíveis/);
});

test('categorias e sensibilidade regional preservam valores nulos e somam concordância em contagens', () => {
  const values = fixture();
  for (const value of values) {
    value.indicator = 'income-median';
    value.association = { radius: '250', agreement: Object.fromEntries(['same', 'adjacent', 'distant', 'tie', 'radiusOnly', 'none'].map((key) => [key, { places: 1, eligible: 10 }])) as NonNullable<PlaceGroups['association']>['agreement'] };
    value.groups[0]!.from = null; value.groups[0]!.to = null;
  }
  const alternative = regionalPlaceGroups('SE', values);
  assert.equal(alternative.groups[0]!.from, null); assert.equal(alternative.groups[0]!.to, null);
  assert.deepEqual(alternative.association!.agreement.same, { places: 4, eligible: 40 });
  for (const value of values) {
    delete value.association; value.indicator = 'tract-situation'; value.method = 'categories';
    value.groups[0]!.upper = null;
  }
  assert.equal(regionalPlaceGroups('SE', values).method, 'categories');
  for (const value of values) {
    const group = value.groups[0]!; group.valid = 0; group.totalVotes = 0;
    for (const candidate of group.candidates) { candidate.votes = 0; candidate.percentValid = null; }
    value.coverage.votesInGroups = 0;
  }
  assert.equal(regionalPlaceGroups('SE', values).groups[0]!.candidates[0]!.percentValid, null);
});

test('API filtra resultados, moradores e raios pela mesma região e bloqueia UF faltante', async () => {
  const queries: Array<{ sql: string; parameters: unknown[] }> = [];
  let values = fixture();
  const dataset = { id: 'a'.repeat(64), year: 2022, office: 'president', level: 'national', importedAt: '2026-11-01', importerVersion: 'teste', sources: [], scope: 'teste', validation: 'reconciled' };
  const population = { total: 10, bands: INCOME_BANDS.map((band) => ({ index: band.index, residents: band.index === 1 ? 10 : 0, tracts: 1 })), noData: { residents: 0, tracts: 0 }, undisclosed: { tracts: 0 } };
  const database = { check: async () => {}, query: async (sql: string, parameters: unknown[] = []) => {
    queries.push({ sql, parameters });
    if (sql.includes('to_regclass')) return { rows: [{ registry: 'test' }] };
    if (sql.includes('SELECT metadata FROM import_batches')) return { rows: [{ metadata: dataset }] };
    if (sql.includes('SELECT id, metadata FROM import_batches')) return { rows: [{ id: 'b'.repeat(64), metadata: {} }] };
    if (sql.includes('FROM place_groups g') || sql.includes('FROM place_group_sensitivity g')) return { rows: values.map((result) => ({ batch_id: sql.includes('sensitivity') ? 'd'.repeat(64) : 'c'.repeat(64), result, metadata: {} })) };
    if (sql.includes('FROM municipality_income_bands')) return { rows: [{ result: population }] };
    if (sql.includes('FROM municipality_tract_demography')) return { rows: [{ result: { residents: 10, indicators: { women: population, 'age-16-24': population, 'age-60-plus': population } } }] };
    throw new Error(`Consulta inesperada: ${sql}`);
  } } as unknown as DatabaseService;
  const controller = new ElectionsController(database);
  const college = await controller.placeGroups({ region: 'SE', indicator: 'college' });
  assert.deepEqual(queries.find((x) => x.sql.includes('FROM place_groups g'))!.parameters, [dataset.id, 'president', [...REGION_STATES.SE], 1, 'college', '2022/places/groups']);
  assert.deepEqual(college.publications, [{ role: 'results', id: dataset.id }, { role: 'groups', id: 'c'.repeat(64) }], 'Resposta identifica as publicações consultadas');
  values.pop(); await assert.rejects(controller.placeGroups({ region: 'SE', indicator: 'college' }), /cobertura regional incompleta/);
  values = fixture().map((value) => ({ ...value, indicator: 'income-median' })); queries.length = 0;
  assert.equal((await controller.placeGroups({ region: 'SE', indicator: 'income-median' })).population!.total, 10);
  assert.deepEqual(queries.find((x) => x.sql.includes('FROM municipality_income_bands'))!.parameters[1], [...REGION_STATES.SE]);
  values = fixture().map((value) => ({ ...value, indicator: 'women' })); queries.length = 0;
  const women = await controller.placeGroups({ region: 'SE', indicator: 'women' });
  assert.equal(women.population!.coverage, undefined, 'Cobertura ausente em versão antiga não vira zero');
  assert.deepEqual(queries.find((x) => x.sql.includes('FROM municipality_tract_demography'))!.parameters[1], [...REGION_STATES.SE]);
  values = fixture().map((value) => ({ ...value, indicator: 'income-median', association: { radius: '250', agreement: Object.fromEntries(['same', 'adjacent', 'distant', 'tie', 'radiusOnly', 'none'].map((key) => [key, { places: 1, eligible: 10 }])) as NonNullable<PlaceGroups['association']>['agreement'] } })); queries.length = 0;
  assert.deepEqual((await controller.placeGroups({ region: 'SE', indicator: 'income-median', radius: '250' })).publications?.[1], { role: 'sensitivity', id: 'd'.repeat(64) });
  assert.deepEqual(queries.find((x) => x.sql.includes('FROM place_group_sensitivity g'))!.parameters.slice(2), [[...REGION_STATES.SE], 1, 250, '2022/places/tract-sensitivity']);
});
