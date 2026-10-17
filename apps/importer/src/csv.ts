import { spawn, spawnSync } from 'node:child_process';
import { parse } from 'csv-parse';

export type Row = Record<string, string>;
export async function* rows(archive: string, entry: string, select?: (row: Row) => boolean): AsyncGenerator<Row> {
  const child = spawn('unzip', ['-p', archive, entry], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  const completed = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ZIP inválido ou entrada ausente: ${entry}: ${stderr}`)));
  });
  // A rejeição é repropagada ao terminar a leitura, sem unhandled rejection.
  void completed.catch(() => {});
  const parser = child.stdout.pipe(parse({ delimiter: ';', columns: true, encoding: 'latin1', bom: true, skip_empty_lines: true, on_record: (row: Row) => select && !select(row) ? null : row }));
  try {
    for await (const row of parser) yield row as Row;
    await completed;
  } finally { if (child.exitCode === null) child.kill(); }
}

export function count(row: Row, field: string): number {
  const value = row[field];
  if (value === undefined || !/^\d+$/.test(value)) throw new Error(`Contagem ausente/inválida em ${field}: ${value ?? 'ausente'}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`Contagem fora da precisão em ${field}`);
  return number;
}

export function pilot(row: Row): boolean {
  return row.ANO_ELEICAO === '2022' && row.CD_MUNICIPIO === '71072' && row.CD_CARGO === '1' && row.SG_UF === 'SP';
}

/** Entradas de um ZIP, na ordem do arquivo. */
export function entries(archive: string): string[] {
  const listing = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
  if (listing.status !== 0) throw new Error(`ZIP inválido: ${archive}: ${listing.stderr}`);
  return listing.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

