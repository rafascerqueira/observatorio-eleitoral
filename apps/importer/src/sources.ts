import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, rename, copyFile, chmod, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const ROOT = resolve(__dirname, '../../..');
/** `year` escolhe a pasta de download (`data/raw/tse/<ano>`); ausente = 2022, como nas publicações existentes. */
export type SourceSpec = { file: string; entry: string; directory: string; year?: number };
/** Presidência: entradas BR (UFs e exterior) da apuração, do nominal e das seções do ano. */
export function nationalSources(year = 2022): SourceSpec[] {
  return [
    { file: `detalhe_votacao_munzona_${year}.zip`, entry: `detalhe_votacao_munzona_${year}_BR.csv`, directory: 'detalhe_votacao_munzona', year },
    { file: `votacao_candidato_munzona_${year}.zip`, entry: `votacao_candidato_munzona_${year}_BR.csv`, directory: 'votacao_candidato_munzona', year },
    { file: `votacao_secao_${year}_BR.zip`, entry: `votacao_secao_${year}_BR.csv`, directory: 'votacao_secao', year },
  ];
}
export const SOURCES = nationalSources(2022);
/** Cargos estaduais: entradas por UF nos mesmos ZIPs de apuração/nominal; seções em ZIP próprio da UF. */
export function stateSources(uf: string, year = 2022): SourceSpec[] {
  if (!/^[A-Z]{2}$/.test(uf) || uf === 'ZZ' || uf === 'BR') throw new Error('UF inválida para fontes estaduais.');
  return [
    { file: `detalhe_votacao_munzona_${year}.zip`, entry: `detalhe_votacao_munzona_${year}_${uf}.csv`, directory: 'detalhe_votacao_munzona', year },
    { file: `votacao_candidato_munzona_${year}.zip`, entry: `votacao_candidato_munzona_${year}_${uf}.csv`, directory: 'votacao_candidato_munzona', year },
    { file: `votacao_secao_${year}_${uf}.zip`, entry: `votacao_secao_${year}_${uf}.csv`, directory: 'votacao_secao', year },
  ];
}
type DownloadRecord = { downloadedAt: string; lastModified: string | null; url: string; sha256: string };

export async function sourceFile(source: SourceSpec) {
  const url = `https://cdn.tse.jus.br/estatistica/sead/odsele/${source.directory}/${source.file}`;
  const directory = resolve(ROOT, 'data/raw/tse', String(source.year ?? 2022));
  const path = resolve(directory, source.file);
  await mkdir(directory, { recursive: true });
  // Registro da resposta HTTP, gravado no download e válido só para os mesmos bytes.
  const recordPath = `${path}.download.json`;
  let info = await stat(path).catch(() => null);
  let lastModified: string | null = null;
  let downloaded: DownloadRecord | null = null;
  if (!info) {
    console.log(`Baixando ${source.file}…`);
    const response = await fetch(url, { signal: AbortSignal.timeout(1_800_000) });
    if (!response.ok || !response.body) throw new Error(`Download da fonte falhou: ${source.file}, HTTP ${response.status}`);
    lastModified = response.headers.get('last-modified');
    const temporary = `${path}.${process.pid}.part`;
    const reader = response.body.getReader();
    async function* chunks() {
      try {
        while (true) { const chunk = await reader.read(); if (chunk.done) break; yield chunk.value; }
      } finally { reader.releaseLock(); }
    }
    await pipeline(Readable.from(chunks()), createWriteStream(temporary, { flags: 'wx' }));
    const size = Number(response.headers.get('content-length'));
    if (size && (await stat(temporary)).size !== size) throw new Error('Download truncado; publicação bloqueada.');
    downloaded = { downloadedAt: new Date().toISOString(), lastModified, url, sha256: '' };
    await rename(temporary, path);
    info = await stat(path);
  }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  if (downloaded) await writeFile(recordPath, JSON.stringify({ ...downloaded, sha256 }));
  else {
    const bytes = await readFile(recordPath, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; return null; });
    const record = bytes ? JSON.parse(bytes) as DownloadRecord : null;
    if (record?.sha256 === sha256) { downloaded = record; lastModified = record.lastModified; }
  }
  const downloadedAtBasis = downloaded ? 'download-response' as const : 'filesystem-mtime' as const;
  const originalDirectory = resolve(ROOT, 'data/originals', sha256);
  await mkdir(originalDirectory, { recursive: true });
  const original = resolve(originalDirectory, source.file);
  try { await copyFile(path, original, constants.COPYFILE_EXCL); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  // Um original preexistente também é verificado; não confiar apenas no nome.
  const originalHash = createHash('sha256');
  for await (const chunk of createReadStream(original)) originalHash.update(chunk);
  if (originalHash.digest('hex') !== sha256) throw new Error('Original preservado com checksum divergente.');
  await chmod(original, 0o444);
  return { path: original, file: source.file, entry: source.entry, url, sha256, downloadedAt: downloaded?.downloadedAt ?? info.mtime.toISOString(), downloadedAtBasis, lastModified, sizeBytes: info.size, originalUrl: `/elections/sources/${sha256}/${source.file}` };
}
