import { createHash } from 'node:crypto';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { chmod, copyFile, link, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT } from './sources';

export type SidraRow = Record<string, string>;
export type PreservedSource = { file: string; entry: string; url: string; sha256: string; downloadedAt: string; downloadedAtBasis: 'download-response';
  lastModified: string | null; sizeBytes: number; generatedAt: string[]; rowsRead: number; rowsSelected: number; originalUrl: string };

/** Consulta à API SIDRA (`apisidra.ibge.gov.br`), preservada como original (ver `preservedDownload`). */
export async function sidraQuery(name: string, path: string, generatedAt: string[] = []): Promise<{ rows: SidraRow[]; source: PreservedSource }> {
  const { read, source } = await preservedDownload(name, `https://apisidra.ibge.gov.br/values${path}`, 'sidra', path, generatedAt);
  const parsed = JSON.parse((await read()).toString('utf8')) as SidraRow[];
  if (!Array.isArray(parsed) || parsed.length < 2) throw new Error(`SIDRA ${name}: resposta vazia ou sem cabeçalho.`);
  const rows = parsed.slice(1);
  return { rows, source: { ...source, rowsRead: rows.length, rowsSelected: rows.length } };
}

/**
 * Resposta HTTP do IBGE preservada como original (`data/raw/ibge/2022/<pasta>` e `data/originals/<sha256>/`, somente
 * leitura). Uma resposta já baixada é reaproveitada pelos mesmos bytes; uma revisão do IBGE exige apagar o arquivo bruto
 * de propósito (nunca o original).
 */
export async function preservedDownload(name: string, url: string, folder: 'sidra' | 'malhas' | 'setores', entry: string, generatedAt: string[] = [], extension = 'json') {
  if (!/^[a-z0-9_]+$/.test(name) || !/^[a-z]+$/.test(extension)) throw new Error(`Nome de consulta inválido: ${name}.${extension}`);
  const directory = resolve(ROOT, 'data/raw/ibge/2022', folder);
  const file = `${name}.${extension}`;
  const raw = resolve(directory, file);
  const recordPath = `${raw}.download.json`;
  await mkdir(directory, { recursive: true });
  let exists = await stat(raw).then(() => true, (error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return false; });
  let record = exists ? JSON.parse(await readFile(recordPath, 'utf8')) as { url: string; downloadedAt: string; lastModified: string | null; sha256: string } : null;
  if (exists && record?.url !== url) throw new Error(`Consulta ${name} preservada com outra URL; não reaproveitar.`);
  if (!exists) {
    // Gravado em fluxo (arquivos de GB não passam pela memória) e renomeado só quando completo. Uma queda de conexão
    // retoma do ponto em que parou (HTTP Range), conferindo o tamanho total informado pelo servidor.
    const temporary = `${raw}.part`;
    let total: number | null = null; let lastModified: string | null = null;
    for (let attempt = 0; ; attempt++) {
      const offset = await stat(temporary).then((info) => info.size, () => 0);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1_800_000), headers: offset ? { Range: `bytes=${offset}-` } : {} });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        const resumed = response.status === 206;
        const range = response.headers.get('content-range');
        total = resumed && range ? Number(range.split('/')[1]) : Number(response.headers.get('content-length')) || null;
        lastModified = response.headers.get('last-modified') ?? lastModified;
        await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), createWriteStream(temporary, { flags: resumed ? 'a' : 'w' }));
        break;
      } catch (error) {
        if (attempt >= 8) throw new Error(`IBGE ${name}: download falhou (${error instanceof Error ? error.message : 'erro'}). Importação bloqueada.`);
        console.log(`IBGE ${name}: conexão interrompida; retomando (tentativa ${attempt + 2}).`);
        await new Promise((done) => setTimeout(done, 3000 * (attempt + 1)));
      }
    }
    if (total && (await stat(temporary)).size !== total) throw new Error(`Download incompleto de ${name}; importação bloqueada.`);
    record = { url, downloadedAt: new Date().toISOString(), lastModified, sha256: '' };
    await rename(temporary, raw); exists = true;
  }
  const sha256 = await hashFile(raw);
  if (record!.sha256 && record!.sha256 !== sha256) throw new Error(`Consulta ${name} alterada desde o download.`);
  await writeFile(recordPath, JSON.stringify({ ...record, sha256 }));
  const originalDirectory = resolve(ROOT, 'data/originals', sha256);
  await mkdir(originalDirectory, { recursive: true });
  const original = resolve(originalDirectory, file);
  // Hard link: o original preservado não duplica os bytes do download; somente leitura, como os demais.
  try { await link(raw, original); } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EXDEV') await copyFile(raw, original, constants.COPYFILE_EXCL); else if (code !== 'EEXIST') throw error;
  }
  if (await hashFile(original) !== sha256) throw new Error('Original do IBGE preservado com checksum divergente.');
  await chmod(original, 0o444);
  const sizeBytes = (await stat(raw)).size;
  const source: PreservedSource = { file, entry, url, sha256, downloadedAt: record!.downloadedAt, downloadedAtBasis: 'download-response', lastModified: record!.lastModified, sizeBytes, generatedAt, rowsRead: 0, rowsSelected: 0, originalUrl: `/elections/sources/${sha256}/${file}` };
  return { path: raw, source, read: () => readFile(raw) };
}
async function hashFile(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Metadados da tabela (API de agregados v3): resolvem nomes de categorias em códigos; as respostas preservadas trazem os dois. */
export async function sidraMetadata(table: number) {
  const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${table}/metadados`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Metadados SIDRA ${table}: HTTP ${response.status}.`);
  return await response.json() as { id: number; nome: string; classificacoes: Array<{ id: number; nome: string; categorias: Array<{ id: number; nome: string }> }> };
}

/**
 * Valor da SIDRA e dos agregados por setor. Convenções do IBGE: "-" é zero que não resulta de arredondamento; "X" é dado
 * omitido para evitar identificação; "." e ".." não se aplicam; "..." não disponível. Os quatro últimos são `null`, nunca zero.
 */
export function sidraValue(value: string | undefined): number | null {
  if (value === undefined) throw new Error('Valor SIDRA ausente.');
  if (value === '-') return 0;
  // Nos agregados por setor, "." aparece na média/mediana do rendimento quando a medida não se aplica (sem responsáveis com rendimento).
  if (['X', '.', '..', '...'].includes(value)) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error(`Valor SIDRA não reconhecido: ${value}`);
  return Number(value);
}
