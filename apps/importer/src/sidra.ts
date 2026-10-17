import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT } from './sources';

export type SidraRow = Record<string, string>;
export type PreservedSource = { file: string; entry: string; url: string; sha256: string; downloadedAt: string; downloadedAtBasis: 'download-response';
  lastModified: string | null; sizeBytes: number; generatedAt: string[]; rowsRead: number; rowsSelected: number; originalUrl: string };

/** Consulta à API SIDRA (`apisidra.ibge.gov.br`), preservada como original (ver `preservedDownload`). */
export async function sidraQuery(name: string, path: string, generatedAt: string[] = []): Promise<{ rows: SidraRow[]; source: PreservedSource }> {
  const { bytes, source } = await preservedDownload(name, `https://apisidra.ibge.gov.br/values${path}`, 'sidra', path, generatedAt);
  const parsed = JSON.parse(bytes.toString('utf8')) as SidraRow[];
  if (!Array.isArray(parsed) || parsed.length < 2) throw new Error(`SIDRA ${name}: resposta vazia ou sem cabeçalho.`);
  const rows = parsed.slice(1);
  return { rows, source: { ...source, rowsRead: rows.length, rowsSelected: rows.length } };
}

/**
 * Resposta HTTP do IBGE preservada como original (`data/raw/ibge/2022/<pasta>` e `data/originals/<sha256>/`, somente
 * leitura). Uma resposta já baixada é reaproveitada pelos mesmos bytes; uma revisão do IBGE exige apagar o arquivo bruto
 * de propósito (nunca o original).
 */
export async function preservedDownload(name: string, url: string, folder: 'sidra' | 'malhas', entry: string, generatedAt: string[] = []) {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Nome de consulta inválido: ${name}`);
  const directory = resolve(ROOT, 'data/raw/ibge/2022', folder);
  const file = `${name}.json`;
  const raw = resolve(directory, file);
  const recordPath = `${raw}.download.json`;
  await mkdir(directory, { recursive: true });
  let bytes = await readFile(raw).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return null; });
  let record = bytes ? JSON.parse(await readFile(recordPath, 'utf8')) as { url: string; downloadedAt: string; lastModified: string | null; sha256: string } : null;
  if (bytes && record?.url !== url) throw new Error(`Consulta ${name} preservada com outra URL; não reaproveitar.`);
  if (!bytes) {
    let response: Response | null = null;
    // A API pública às vezes recusa por excesso de requisições: poucas tentativas, com espera crescente.
    for (let attempt = 0; attempt < 4; attempt++) {
      response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (response.ok) break;
      await new Promise((done) => setTimeout(done, 2000 * (attempt + 1)));
    }
    if (!response?.ok) throw new Error(`IBGE ${name}: HTTP ${response?.status ?? 'sem resposta'}. Importação bloqueada.`);
    bytes = Buffer.from(await response.arrayBuffer());
    record = { url, downloadedAt: new Date().toISOString(), lastModified: response.headers.get('last-modified'), sha256: '' };
    await writeFile(raw, bytes, { flag: 'wx' });
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (record!.sha256 && record!.sha256 !== sha256) throw new Error(`Consulta ${name} alterada desde o download.`);
  await writeFile(recordPath, JSON.stringify({ ...record, sha256 }));
  const originalDirectory = resolve(ROOT, 'data/originals', sha256);
  await mkdir(originalDirectory, { recursive: true });
  const original = resolve(originalDirectory, file);
  try { await copyFile(raw, original, constants.COPYFILE_EXCL); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  if (createHash('sha256').update(await readFile(original)).digest('hex') !== sha256) throw new Error('Original do IBGE preservado com checksum divergente.');
  await chmod(original, 0o444);
  const source: PreservedSource = { file, entry, url, sha256, downloadedAt: record!.downloadedAt, downloadedAtBasis: 'download-response', lastModified: record!.lastModified, sizeBytes: bytes.length, generatedAt, rowsRead: 0, rowsSelected: 0, originalUrl: `/elections/sources/${sha256}/${file}` };
  return { bytes, source };
}

/** Metadados da tabela (API de agregados v3): resolvem nomes de categorias em códigos; as respostas preservadas trazem os dois. */
export async function sidraMetadata(table: number) {
  const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${table}/metadados`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Metadados SIDRA ${table}: HTTP ${response.status}.`);
  return await response.json() as { id: number; nome: string; classificacoes: Array<{ id: number; nome: string; categorias: Array<{ id: number; nome: string }> }> };
}

/**
 * Valor da SIDRA. Convenções do IBGE: "-" é zero que não resulta de arredondamento; "X" é dado omitido para evitar
 * identificação; ".." não se aplica; "..." não disponível. Os três últimos são `null`, nunca zero.
 */
export function sidraValue(value: string | undefined): number | null {
  if (value === undefined) throw new Error('Valor SIDRA ausente.');
  if (value === '-') return 0;
  if (['X', '..', '...'].includes(value)) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`Valor SIDRA não reconhecido: ${value}`);
  return Number(value);
}
