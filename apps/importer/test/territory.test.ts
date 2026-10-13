import { test } from 'node:test';
import assert from 'node:assert/strict';
import { municipalityCode, territoryKey, normalizeTerritoryKey, assertNationalTerritories } from '../src/territory';
import { STATES } from '@observatorio/contracts';
test('zeros iniciais de códigos TSE não criam municípios falsos e UFs permanecem separadas', () => {
  assert.equal(municipalityCode('2550'), '02550');
  assert.equal(municipalityCode('02550'), '02550');
  assert.equal(territoryKey('AM', '2550'), territoryKey('AM', '02550'));
  assert.equal(normalizeTerritoryKey('AC-1007'), 'AC-01007');
  assert.notEqual(territoryKey('AM', '2550'), territoryKey('AC', '2550'));
  for (const input of ['0', '', '#NULO', '25.50', '../2550', '123456']) assert.throws(() => municipalityCode(input));
});
test('uma fonte vazia ou sem uma UF não pode virar publicação nacional reconciliada', () => {
  assert.throws(() => assertNationalTerritories([]), /Cobertura nacional incompleta/);
  assert.throws(() => assertNationalTerritories(STATES.filter((uf) => uf !== 'AC').map((uf) => ({ uf }))), /AC/);
  assert.doesNotThrow(() => assertNationalTerritories(STATES.map((uf) => ({ uf }))));
});
