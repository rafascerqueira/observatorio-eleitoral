import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getContext } from '../lib/results';

test('falha técnica ou contrato inválido do contexto nunca viram ausência da fonte ou dados zerados', async () => {
  const before = globalThis.fetch;
  try {
    for (const response of [new Response(null, { status: 503 }), new Response(null, { status: 500 }), Response.json({ status: 'published', dataset: {}, item: {} }), new Response('HTML inválido')]) {
      globalThis.fetch = async (input) => {
        const url = new URL(String(input)); assert.equal(url.pathname, '/elections/municipalities/02550/context'); assert.equal(url.searchParams.get('uf'), 'AM'); return response;
      };
      assert.deepEqual(await getContext('02550', 'AM', '2022'), { kind: 'unavailable' });
    }
    globalThis.fetch = async () => Response.json({ status: 'awaiting-import', dataset: null, item: null });
    assert.deepEqual(await getContext('02550', 'AM', '2026'), { kind: 'ready', data: { status: 'awaiting-import', dataset: null, item: null } });
    globalThis.fetch = async () => new Response(null, { status: 404 });
    assert.deepEqual(await getContext('02550', 'AM', '2022'), { kind: 'missing' });
    globalThis.fetch = async () => { throw new Error('conexão interrompida'); };
    assert.deepEqual(await getContext('02550', 'AM', '2022'), { kind: 'unavailable' });
  } finally { globalThis.fetch = before; }
});
