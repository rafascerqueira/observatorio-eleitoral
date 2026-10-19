import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DatabaseService } from '../src/database/database.service';
import { checkDependencies } from '../src/elections/dependencies';
test('derivados recusam dependências substituídas; legado ausente não recebe dependências fictícias', async () => {
  const input = { id: 'a'.repeat(64), scope: '2022/places/groups' }; let rows: Array<{ id: string; scope: string; metadata?: unknown }> = [input], calls = 0;
  const database = { query: async (_sql: string, params: [string[]]) => { calls++; return { rows: rows.filter((row) => params[0].includes(row.scope)) }; } } as unknown as DatabaseService;
  await checkDependencies(database, {}); assert.equal(calls, 0);
  await checkDependencies(database, { inputs: [input] });
  rows = [{ ...input, id: 'b'.repeat(64) }]; await assert.rejects(checkDependencies(database, { inputs: [input] }), /aguardam atualização/);
  await assert.rejects(checkDependencies(database, { inputs: [input, input] }), /inconsistentes/);
  await assert.rejects(checkDependencies(database, { inputs: [input, { ...input, scope: 'outro-escopo' }] }), /inconsistentes/);
  await assert.rejects(checkDependencies(database, { inputs: [{ id: 'invalido', scope: input.scope }] }), /inconsistentes/);
  const ancestor = { id: 'c'.repeat(64), scope: '2022/places/profiles' };
  rows = [{ ...input, metadata: { inputs: [ancestor] } }, { ...ancestor, id: 'd'.repeat(64) }];
  await assert.rejects(checkDependencies(database, { inputs: [input] }), /aguardam atualização/, 'Ancestral substituído não fica escondido atrás de uma publicação intermediária ainda ativa');
});
