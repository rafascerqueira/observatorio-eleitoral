import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { ROOT } from './sources';

export type PublicationInput = { id: string; scope: string };
export function canonicalInputs(inputs: readonly PublicationInput[]) {
  const sorted = inputs.map(({ id, scope }) => ({ id, scope })).sort((a, b) => a.scope.localeCompare(b.scope));
  if (sorted.some((item) => !/^[a-f0-9]{64}$/.test(item.id) || !item.scope) || new Set(sorted.map((item) => item.scope)).size !== sorted.length || new Set(sorted.map((item) => item.id)).size !== sorted.length) throw new Error('Dependências de publicação inválidas ou duplicadas.');
  return sorted;
}
export function publicationId(version: string, hashes: readonly string[], inputs: readonly PublicationInput[], configuration: unknown = null) {
  return createHash('sha256').update(JSON.stringify({ version, hashes: [...hashes].sort(), inputs: canonicalInputs(inputs), configuration })).digest('hex');
}
export async function publishedInputs(client: PoolClient, scopes: string[]): Promise<PublicationInput[]> {
  const rows = (await client.query<PublicationInput>('SELECT id, scope FROM import_batches WHERE published AND scope=ANY($1::text[]) ORDER BY scope', [scopes])).rows;
  const result = canonicalInputs(rows);
  if (result.length !== scopes.length || scopes.some((scope) => !result.some((item) => item.scope === scope))) throw new Error('Dependência necessária sem publicação; importação bloqueada.');
  return result;
}
/** Dentro da transação, bloqueia mudanças das entradas até a troca da publicação terminar. */
export async function checkInputs(client: PoolClient, inputs: readonly PublicationInput[]) {
  const current = (await client.query<PublicationInput>('SELECT id, scope FROM import_batches WHERE published AND scope=ANY($1::text[]) ORDER BY scope FOR SHARE', [inputs.map((item) => item.scope)])).rows;
  if (JSON.stringify(canonicalInputs(current)) !== JSON.stringify(canonicalInputs(inputs))) throw new Error('Uma dependência mudou durante a importação; publicação bloqueada.');
}

/** O relatório é preparado antes de publicar; falha de disco impede o COMMIT. Originais nunca são tocados. */
export async function writeAuditReport(id: string, report: { dataset: { id: string }; [key: string]: unknown }, directory = resolve(ROOT, 'data/audit')) {
  if (!/^[a-f0-9]{64}$/.test(id) || report.dataset.id !== id) throw new Error('Identidade do relatório divergente.');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${id}.json`), temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(report, null, 2), { flag: 'wx' }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
export async function checkAuditReport(id: string, expectedDataset: { id: string; [key: string]: unknown }, directory = resolve(ROOT, 'data/audit')) {
  const report = JSON.parse(await readFile(resolve(directory, `${id}.json`), 'utf8')) as { dataset?: { id?: string } };
  if (expectedDataset.id !== id || report.dataset?.id !== id || !isDeepStrictEqual(report.dataset, expectedDataset)) throw new Error('Relatório publicado ausente ou com metadados divergentes; não declarar reexecução concluída.');
}

/** Antes de iniciar a transação de carga: confirma o lote e mantém entradas bloqueadas durante a leitura do relatório. */
export async function reusePublished(client: PoolClient, options: { id: string; scope: string; inputs: readonly PublicationInput[]; directory?: string }) {
  await client.query('BEGIN');
  try {
    const existing = (await client.query<{ scope: string; published: boolean; metadata: { id: string; [key: string]: unknown } }>('SELECT scope, published, metadata FROM import_batches WHERE id=$1 FOR SHARE', [options.id])).rows[0];
    if (!existing) { await client.query('COMMIT'); return false; }
    if (existing.scope !== options.scope || !existing.published) throw new Error('Identidade já gravada em outro estado; preservar o lote anterior e conferir a publicação antes de reexecutar.');
    await checkInputs(client, options.inputs);
    await checkAuditReport(options.id, existing.metadata, options.directory);
    await client.query('COMMIT');
    return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

/** Chamado dentro da transação: nenhuma troca pública ocorre antes de conferir entradas e preparar o artefato. */
export async function preparePublication(client: PoolClient, options: { id: string; scope: string; inputs: readonly PublicationInput[]; report: { dataset: { id: string }; [key: string]: unknown }; directory?: string }) {
  await checkInputs(client, options.inputs);
  await writeAuditReport(options.id, options.report, options.directory);
  await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [options.scope]);
  await client.query('UPDATE import_batches SET published=true WHERE id=$1', [options.id]);
}
