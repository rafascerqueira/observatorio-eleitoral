import { ServiceUnavailableException } from '@nestjs/common';
import { publicationInputsSchema } from '@observatorio/contracts';
import type { DatabaseService } from '../database/database.service';

/** Versões antigas sem inputs continuam legíveis; ausência não é interpretada como uma lista vazia verificada. */
export async function checkDependencies(database: DatabaseService, metadata: { inputs?: unknown } | undefined) {
  if (metadata?.inputs === undefined) return;
  const parse = (inputs: unknown) => {
    const result = publicationInputsSchema.safeParse(inputs);
    if (!result.success || new Set(result.data.map((item) => item.scope)).size !== result.data.length || new Set(result.data.map((item) => item.id)).size !== result.data.length) throw new ServiceUnavailableException('Dependências da publicação inconsistentes.');
    return result.data;
  };
  let pending = parse(metadata.inputs);
  const visited = new Set<string>();
  const key = (input: { id: string; scope: string }) => `${input.scope}/${input.id}`;
  while (pending.length) {
    const inputs = [...new Map(pending.filter((item) => !visited.has(key(item))).map((item) => [key(item), item])).values()];
    if (!inputs.length) return;
    const rows = await database.query<{ id: string; scope: string; metadata?: { inputs?: unknown } }>('SELECT id, scope, metadata FROM import_batches WHERE published AND scope=ANY($1::text[])', [inputs.map((item) => item.scope)]);
    if (rows.rows.length !== inputs.length || inputs.some((input) => !rows.rows.some((row) => row.id === input.id && row.scope === input.scope))) throw new ServiceUnavailableException('Dados derivados aguardam atualização de suas dependências publicadas.');
    inputs.forEach((item) => visited.add(key(item)));
    pending = rows.rows.flatMap((row) => row.metadata?.inputs === undefined ? [] : parse(row.metadata.inputs));
  }
}
