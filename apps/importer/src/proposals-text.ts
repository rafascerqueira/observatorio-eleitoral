import { searchText } from '@observatorio/contracts';

/**
 * Texto das propostas para a auditoria da v2 (plano de melhorias, seção 19): leitura do `pdftotext -bbox-layout`, protótipo da
 * normalização proposta e medidas por página. Nada daqui entra numa publicação; a busca publicada continua com `searchText`.
 */

/** Página do `-bbox-layout` na ordem de leitura do Poppler: palavras com espaço, linhas com "\n", blocos e fluxos com linha em branco. */
export type BboxPage = { text: string; flows: number; blocks: number; lines: number; words: number };
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
  if (name.startsWith('#')) return String.fromCodePoint(/^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  const value = ENTITIES[name];
  if (value === undefined) throw new Error(`Entidade XML desconhecida no -bbox-layout: ${entity}.`);
  return value;
});
const LEVELS = ['page', 'flow', 'block', 'line', 'word'] as const;
type Level = typeof LEVELS[number];

/** Leitor restrito: só page/flow/block/line/word, nessa hierarquia; texto fora de palavra dentro de uma página bloqueia. */
export function bboxPages(xhtml: string): BboxPage[] {
  const pages: string[][][][][] = [];
  const stack: Level[] = [];
  const tag = /<(\/?)([a-zA-Z]+)\b[^>]*?(\/?)>|([^<]+)/g;
  for (const match of xhtml.matchAll(tag)) {
    const [, closing, rawName, selfClosing, text] = match;
    if (text !== undefined) {
      if (stack.at(-1) === 'word') { const line = pages.at(-1)!.at(-1)!.at(-1)!.at(-1)!; line[line.length - 1] += decode(text); }
      else if (stack.length && text.trim()) throw new Error('-bbox-layout com texto fora de palavra.');
      continue;
    }
    const name = rawName!.toLowerCase() as Level;
    const depth = LEVELS.indexOf(name);
    if (depth < 0) continue;
    if (closing) {
      if (stack.at(-1) !== name) throw new Error(`-bbox-layout com </${name}> fora de ordem.`);
      stack.pop(); continue;
    }
    if (stack.length !== depth) throw new Error(`-bbox-layout com <${name}> fora da hierarquia.`);
    if (name === 'page') pages.push([]);
    else if (name === 'flow') pages.at(-1)!.push([]);
    else if (name === 'block') pages.at(-1)!.at(-1)!.push([]);
    else if (name === 'line') pages.at(-1)!.at(-1)!.at(-1)!.push([]);
    else pages.at(-1)!.at(-1)!.at(-1)!.at(-1)!.push('');
    if (!selfClosing) stack.push(name);
  }
  if (stack.length) throw new Error('-bbox-layout incompleto.');
  return pages.map((flows) => ({
    text: flows.map((blocks) => blocks.map((lines) => lines.map((words) => words.join(' ')).join('\n')).join('\n\n')).join('\n\n'),
    flows: flows.length, blocks: flows.reduce((sum, blocks) => sum + blocks.length, 0),
    lines: flows.reduce((sum, blocks) => sum + blocks.reduce((total, lines) => total + lines.length, 0), 0),
    words: flows.reduce((sum, blocks) => sum + blocks.reduce((total, lines) => total + lines.reduce((count, words) => count + words.length, 0), 0), 0),
  }));
}

/** Marcador do hífen de fim de linha na normalização proposta: hífen que pode ou não pertencer à palavra. */
export const HYPHEN_MARKER = '­';
const REPLACEMENTS: Record<string, string> = {
  'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st',
  '‐': '-', '‑': '-', '‘': "'", '’': "'", '‛': "'", 'ʼ': "'", '“': '"', '”': '"', '„': '"', '‟': '"',
};
const INVISIBLE = /[­​-‍⁠﻿]/;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Normalização proposta para a v2 (protótipo, só para a auditoria): a de `searchNormalize` mais ligaduras em letras, invisíveis
 * removidos sem virar espaço, hífens e aspas Unicode nos equivalentes ASCII e hífen de fim de linha (entre letras ou dígitos)
 * guardado como `HYPHEN_MARKER` em vez de descartado.
 */
export function proposedNormalize(text: string): string {
  const out: string[] = [];
  const lineBreakHyphen = /[-­‐‑][ \t]*\r?\n\s*/y, space = /\s+/y;
  for (let index = 0; index < text.length;) {
    lineBreakHyphen.lastIndex = index;
    if (index > 0 && LETTER_OR_DIGIT.test(text[index - 1]!) && lineBreakHyphen.test(text) && LETTER_OR_DIGIT.test(text[lineBreakHyphen.lastIndex] ?? '')) {
      out.push(HYPHEN_MARKER); index = lineBreakHyphen.lastIndex; continue;
    }
    if (INVISIBLE.test(text[index]!)) { index++; continue; }
    space.lastIndex = index;
    if (space.test(text)) { if (out.length && out[out.length - 1] !== ' ') out.push(' '); index = space.lastIndex; continue; }
    out.push(...(REPLACEMENTS[text[index]!] ?? text[index]!).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase());
    index++;
  }
  if (out[out.length - 1] === ' ') out.pop();
  return out.join('');
}

/** Palavras de um texto normalizado, sem pontuação nas pontas (aproximação do que uma busca encontra). */
export const tokens = (normalized: string) => normalized.split(' ').map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
/** Grafias que a busca proposta encontra para uma palavra com marcador: sem o hífen e com ele (combinações mistas não contadas). */
export const findableForms = (token: string) => token.includes(HYPHEN_MARKER) ? [token.replaceAll(HYPHEN_MARKER, ''), token.replaceAll(HYPHEN_MARKER, '-')] : [token];
export const bigrams = (words: readonly string[]) => words.slice(1).map((word, index) => `${words[index]} ${word}`);

/** Hífen + quebra de linha entre letras ou dígitos, como a normalização proposta os reúne. */
const LINE_BREAK_JOIN = /([\p{L}\p{N}]+)[-­‐‑][ \t]*(\r?\n\s*)([\p{L}\p{N}]+)/gu;
export type HyphenJoin = { left: string; right: string; digits: boolean; blankLine: boolean };
export function hyphenJoins(text: string): HyphenJoin[] {
  return [...text.matchAll(LINE_BREAK_JOIN)].map(([, left, gap, right]) => ({
    left: searchText(left!), right: searchText(right!), digits: /\p{N}/u.test(left!.at(-1)!) || /\p{N}/u.test(right![0]!), blankLine: (gap!.match(/\n/g) ?? []).length > 1,
  }));
}
/** Palavras escritas no meio da linha (sem as reunidas por hífen de fim de linha), para saber se uma junção é palavra composta ou partida. */
export const midLineTokens = (text: string) => tokens(proposedNormalize(text.replace(LINE_BREAK_JOIN, '$1 $3')));
export const JOIN_CLASSES = ['compound', 'split', 'both', 'unknown'] as const;
/** `compound`: só a forma com hífen aparece no meio da linha; `split`: só a forma reunida; `both`; `unknown`: nenhuma das duas. */
export function joinClass(join: HyphenJoin, midLine: ReadonlySet<string>): typeof JOIN_CLASSES[number] {
  const hyphenated = midLine.has(`${join.left}-${join.right}`), joined = midLine.has(`${join.left}${join.right}`);
  return hyphenated && joined ? 'both' : hyphenated ? 'compound' : joined ? 'split' : 'unknown';
}

/** Caracteres a decidir na normalização (contagens; o 0xAD no fim da linha costuma chegar do Poppler já como "-"). */
export const CHARACTER_CLASSES = {
  replacement: /�/gu, privateUse: /\p{Co}/gu, control: /(?!\s)\p{Cc}/gu, nonLatinLetter: /(?=\p{L})\P{Script=Latin}/gu,
  softHyphenLineEnd: /­(?=[ \t]*\r?\n)/gu, softHyphenInside: /­(?![ \t]*\r?\n)/gu, unicodeHyphen: /[‐‑]/gu,
  enDash: /–/gu, enDashBetweenLetters: /(?<=\p{L})–(?=\p{L})/gu, ligature: /[ﬀ-ﬆ]/gu, invisible: /[​-‍⁠﻿]/gu,
  typographicApostrophe: /[‘’‛ʼ]/gu, typographicQuote: /[“-‟]/gu, unicodeSpace: /[  -   　]/gu,
} as const;
export type CharacterCounts = Record<keyof typeof CHARACTER_CLASSES, number>;
export const characterCounts = (text: string) => Object.fromEntries(Object.entries(CHARACTER_CLASSES).map(([name, pattern]) => [name, (text.match(pattern) ?? []).length])) as CharacterCounts;
/** Demais caracteres fora do ASCII que não são letras nem espaços (símbolos, marcadores, sinais), para achar casos não previstos. */
export const otherCharacters = (text: string) => [...text].filter((char) => char > '\u007F' && !/[\p{L}\p{M}\s]/u.test(char));

/**
 * Sinais de texto nativo ilegível: U+FFFD, uso privado e controles sobre os caracteres visíveis; letras sobre os visíveis; palavras
 * de 3+ letras sem vogal. Denominador zero dá `null`, não zero.
 */
export function pageQuality(text: string) {
  const visible = [...text].filter((char) => !/\s/u.test(char));
  const bad = visible.filter((char) => char === '�' || /\p{Co}|\p{Cc}/u.test(char)).length;
  const letters = visible.filter((char) => /\p{L}/u.test(char)).length;
  const words = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/\p{L}{3,}/gu) ?? [];
  const vowelless = words.filter((word) => !/[aeiouy]/.test(word)).length;
  return { visible: visible.length, bad, letters, words: words.length, vowelless,
    badRatio: visible.length ? bad / visible.length : null, letterRatio: visible.length ? letters / visible.length : null, vowellessRatio: words.length ? vowelless / words.length : null };
}
