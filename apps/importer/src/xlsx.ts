import { execFileSync } from 'node:child_process';
import { entries } from './csv';

/** Pares código → descrição das planilhas de um XLSX (strings compartilhadas e valores inline), sem dependência externa. */
export function xlsxPairs(path: string) {
  const read = (entry: string) => execFileSync('unzip', ['-p', path, entry], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
  const decode = (text: string) => text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => decode(match[1]!));
  const pairs = new Map<string, string>();
  for (const sheet of entries(path).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))) {
    for (const row of read(sheet).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const values = [...row[1]!.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].flatMap((cell) => {
        const value = /<v>([\s\S]*?)<\/v>/.exec(cell[2] ?? '')?.[1];
        return value === undefined ? [] : [/t="s"/.test(cell[1]!) ? shared[Number(value)]! : decode(value)];
      });
      for (let index = 0; index < values.length - 1; index++) if (/^V\d{5}$/.test(values[index]!)) pairs.set(values[index]!, values[index + 1]!.trim());
    }
  }
  return pairs;
}
