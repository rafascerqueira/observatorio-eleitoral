import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PartitionWriter, readPartition } from '../src/partition';

test('partições isolam municípios, reabrem arquivos com limite de descritores e detectam alterações', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'observatorio-partition-test-'));
  const writer = new PartitionWriter(directory, 1);
  await writer.write('SP-71072', { zone: 1, section: 1, votes: 10 });
  await writer.write('RJ-60011', { zone: 1, section: 1, votes: 20 });
  await writer.write('SP-71072', { zone: 1, section: 2, votes: 30 });
  await assert.rejects(() => writer.write('../invalid', {}), /Chave territorial/);
  const manifest = await writer.close();
  const sp = await readPartition<{ votes: number }>(resolve(directory, 'SP-71072.ndjson'), manifest['SP-71072']!);
  assert.deepEqual(sp.map((record) => record.votes), [10, 30]);
  const rj = await readPartition<{ votes: number }>(resolve(directory, 'RJ-60011.ndjson'), manifest['RJ-60011']!);
  assert.deepEqual(rj.map((record) => record.votes), [20]);
  await appendFile(resolve(directory, 'SP-71072.ndjson'), '{}\n');
  await assert.rejects(() => readPartition(resolve(directory, 'SP-71072.ndjson'), manifest['SP-71072']!), /alterada ou truncada/);
});
