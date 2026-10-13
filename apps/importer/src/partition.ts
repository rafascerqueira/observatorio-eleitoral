import { createReadStream, createWriteStream, type WriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

/** RAM e descritores limitados, independentemente do tamanho nacional. */
export class PartitionWriter {
  private streams = new Map<string, WriteStream>();
  private hashes = new Map<string, ReturnType<typeof createHash>>();
  private counts = new Map<string, number>();
  private failure: Error | null = null;
  constructor(private directory: string, private limit = 128) {}
  async write(key: string, value: unknown) {
    if (!/^[A-Z]{2}-\d+$/.test(key)) throw new Error('Chave territorial inválida.');
    if (this.failure) throw this.failure;
    let stream = this.streams.get(key);
    if (!stream) {
      if (this.streams.size >= this.limit) {
        const [oldKey, oldStream] = this.streams.entries().next().value!;
        const done = once(oldStream, 'finish'); oldStream.end(); await done;
        this.streams.delete(oldKey);
      }
      await mkdir(this.directory, { recursive: true });
      stream = createWriteStream(resolve(this.directory, `${key}.ndjson`), { flags: 'a' });
      stream.on('error', (error) => { this.failure = error; });
      this.streams.set(key, stream);
    } else { this.streams.delete(key); this.streams.set(key, stream); }
    const line = `${JSON.stringify(value)}\n`;
    const hash = this.hashes.get(key) ?? createHash('sha256');
    hash.update(line); this.hashes.set(key, hash);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    if (!stream.write(line)) await once(stream, 'drain');
  }
  async close() {
    await Promise.all([...this.streams.values()].map(async (stream) => { const done = once(stream, 'finish'); stream.end(); await done; }));
    this.streams.clear();
    if (this.failure) throw this.failure;
    return Object.fromEntries([...this.hashes].map(([key, hash]) => [key, { sha256: hash.digest('hex'), rows: this.counts.get(key)! }]));
  }
  abort() { for (const stream of this.streams.values()) stream.destroy(); }
}
export async function readPartition<T>(path: string, expected: { sha256: string; rows: number }): Promise<T[]> {
  const hash = createHash('sha256');
  // Conferir bytes antes de ler o checkpoint; nunca confiar apenas no manifesto.
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest('hex') !== expected.sha256) throw new Error('Partição alterada ou truncada; publicação bloqueada.');
  const records: T[] = [];
  for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) records.push(JSON.parse(line) as T);
  if (records.length !== expected.rows) throw new Error('Contagem da partição divergente.');
  return records;
}
