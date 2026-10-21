import { joinsAtLineEnd, SEARCH_HYPHEN_MARKER as HYPHEN_MARKER, searchText } from '@observatorio/contracts';

/**
 * Texto das propostas: leitura e remontagem do `pdftotext -bbox-layout` e sinais de texto ilegível, usados pelo importador desde a
 * `proposals-2022-v2`; para a auditoria (plano de melhorias, seção 19), a normalização da v1 congelada e medidas por página.
 */

/**
 * Página do `-bbox-layout` remontada como o modo padrão do Poppler (ordem de leitura) a escreve: palavras vizinhas separadas por
 * espaço só quando a distância entre elas chega a `WORD_SPACE` da altura da linha, cada linha seguida de "\n" e cada fluxo de
 * mais um "\n". A diferença é o hífen de fim de linha, que o modo padrão descarta e aqui fica; `defaultModeText` refaz o descarte,
 * para conferir a remontagem contra o próprio modo padrão.
 */
export type BboxPage = { text: string; flowLines: string[][]; flows: number; blocks: number; lines: number; words: number; gaps: WordGaps };
/** Distâncias entre palavras vizinhas, em altura da linha: quantas viraram espaço, quantas foram juntadas e as mais próximas do limiar. */
export type WordGaps = { joined: number; spaced: number; maxJoined: number | null; minSpaced: number | null };
/**
 * Distância mínima entre palavras, em fração da altura da linha, para haver espaço. O Poppler parte palavras em ligaduras e no
 * kerning sem espaço visível (nº 22: "ﬁ" | "m", com a segunda começando antes do fim da primeira), e o modo padrão as junta;
 * nas páginas de 2022 nenhuma distância cai entre 0,03 e 0,05 da altura (auditoria de 20/10/2026).
 */
export const WORD_SPACE = 0.04;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
  if (name.startsWith('#')) return String.fromCodePoint(/^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  const value = ENTITIES[name];
  if (value === undefined) throw new Error(`Entidade XML desconhecida no -bbox-layout: ${entity}.`);
  return value;
});
const LEVELS = ['page', 'flow', 'block', 'line', 'word'] as const;
type Level = typeof LEVELS[number];
type Box = { xMin: number; yMin: number; xMax: number; yMax: number };
type Line = { box: Box; words: Array<{ box: Box; text: string }> };
function box(name: Level, attributes: string): Box {
  const [xMin, yMin, xMax, yMax] = (['xMin', 'yMin', 'xMax', 'yMax'] as const).map((key) => Number(new RegExp(`\\b${key}="(-?\\d+(?:\\.\\d+)?)"`).exec(attributes)?.[1] ?? Number.NaN));
  if (![xMin, yMin, xMax, yMax].every(Number.isFinite)) throw new Error(`-bbox-layout com <${name}> sem coordenadas.`);
  return { xMin: xMin!, yMin: yMin!, xMax: xMax!, yMax: yMax! };
}

/** Leitor restrito: só page/flow/block/line/word, nessa hierarquia, linhas e palavras com coordenadas; texto fora de palavra dentro de uma página bloqueia. */
export function bboxPages(xhtml: string): BboxPage[] {
  const pages: Line[][][][] = [];
  const stack: Level[] = [];
  const tag = /<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>|([^<]+)/g;
  for (const match of xhtml.matchAll(tag)) {
    const [, closing, rawName, attributes, selfClosing, text] = match;
    if (text !== undefined) {
      if (stack.at(-1) === 'word') { const words = pages.at(-1)!.at(-1)!.at(-1)!.at(-1)!.words; words[words.length - 1]!.text += decode(text); }
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
    else if (name === 'line') pages.at(-1)!.at(-1)!.at(-1)!.push({ box: box(name, attributes!), words: [] });
    else pages.at(-1)!.at(-1)!.at(-1)!.at(-1)!.words.push({ box: box(name, attributes!), text: '' });
    if (!selfClosing) stack.push(name);
  }
  if (stack.length) throw new Error('-bbox-layout incompleto.');
  return pages.map((flows) => {
    const gaps: WordGaps = { joined: 0, spaced: 0, maxJoined: null, minSpaced: null };
    const lineText = ({ box: line, words }: Line) => words.map((word, index) => {
      if (!index) return word.text;
      const gap = word.box.xMin - words[index - 1]!.box.xMax, height = line.yMax - line.yMin;
      const ratio = height > 0 ? gap / height : gap > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      if (ratio >= WORD_SPACE) { gaps.spaced++; gaps.minSpaced = Math.min(gaps.minSpaced ?? ratio, ratio); return ` ${word.text}`; }
      gaps.joined++; gaps.maxJoined = Math.max(gaps.maxJoined ?? ratio, ratio); return word.text;
    }).join('');
    const flowLines = flows.map((blocks) => blocks.flatMap((lines) => lines.map(lineText)));
    return {
      text: flowLines.map((lines) => `${lines.map((line) => `${line}\n`).join('')}\n`).join(''), flowLines, gaps,
      flows: flows.length, blocks: flows.reduce((sum, blocks) => sum + blocks.length, 0),
      lines: flows.reduce((sum, blocks) => sum + blocks.reduce((total, lines) => total + lines.length, 0), 0),
      words: flows.reduce((sum, blocks) => sum + blocks.reduce((total, lines) => total + lines.reduce((count, line) => count + line.words.length, 0), 0), 0),
    };
  });
}

/** O que o modo padrão do Poppler escreve das mesmas linhas: linha terminada em "-" seguida de outra no mesmo fluxo perde o hífen e a quebra. */
export const defaultModeText = (page: Pick<BboxPage, 'flowLines'>) => page.flowLines.map((lines) =>
  `${lines.map((line, index) => line.endsWith('-') && index < lines.length - 1 ? line.slice(0, -1) : `${line}\n`).join('')}\n`).join('');

/**
 * Normalização da v1 (`proposals-2022-v1`), congelada só para a auditoria comparar as versões: minúsculas sem acentos, espaços
 * colapsados e hífen de fim de linha entre letras sempre descartado. A busca usa `searchText` dos contratos.
 */
export function v1SearchText(text: string): string {
  const out: string[] = [];
  const lineBreakHyphen = /-[ \t]*\r?\n\s*/y, space = /\s+/y;
  for (let index = 0; index < text.length;) {
    lineBreakHyphen.lastIndex = index;
    if (index > 0 && /\p{L}/u.test(text[index - 1]!) && lineBreakHyphen.test(text) && /\p{L}/u.test(text[lineBreakHyphen.lastIndex] ?? '')) { index = lineBreakHyphen.lastIndex; continue; }
    space.lastIndex = index;
    if (space.test(text)) { if (out.length && out[out.length - 1] !== ' ') out.push(' '); index = space.lastIndex; continue; }
    out.push(...text[index]!.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase());
    index++;
  }
  if (out[out.length - 1] === ' ') out.pop();
  return out.join('');
}

/** Palavras de um texto normalizado, sem pontuação nas pontas (aproximação do que uma busca encontra). */
export const tokens = (normalized: string) => normalized.split(' ').map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
/** Grafias que a busca encontra para uma palavra com marcador: sem o hífen e com ele (combinações mistas não contadas). */
export const findableForms = (token: string) => token.includes(HYPHEN_MARKER) ? [token.replaceAll(HYPHEN_MARKER, ''), token.replaceAll(HYPHEN_MARKER, '-')] : [token];
export const bigrams = (words: readonly string[]) => words.slice(1).map((word, index) => `${words[index]} ${word}`);

/** Hífen + quebra de linha que a normalização da busca reúne (`joinsAtLineEnd`, nos contratos). */
const LINE_BREAK_JOIN = /([\p{L}\p{N}]+)[-­‐‑][ \t]*(\r?\n\s*)([\p{L}\p{N}]+)/gu;
export type HyphenJoin = { left: string; right: string; digits: boolean; blankLine: boolean };
export function hyphenJoins(text: string): HyphenJoin[] {
  return [...text.matchAll(LINE_BREAK_JOIN)].filter(([, left, gap, right]) => joinsAtLineEnd(left!.at(-1)!, gap!, right![0]!)).map(([, left, gap, right]) => ({
    left: searchText(left!), right: searchText(right!), digits: /\p{N}/u.test(left!.at(-1)!) || /\p{N}/u.test(right![0]!), blankLine: (gap!.match(/\n/g) ?? []).length > 1,
  }));
}
/** Palavras escritas no meio da linha (sem as reunidas por hífen de fim de linha), para saber se uma junção é palavra composta ou partida. */
export const midLineTokens = (text: string) => tokens(searchText(text.replace(LINE_BREAK_JOIN, '$1 $3')));
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
export type QualityLimits = { maxBadRatio: number; maxVowellessRatio: number };
/** Se a página passa de algum limiar de texto ilegível; medida sem base (`null`) não passa de nada. */
export const exceedsQuality = (quality: ReturnType<typeof pageQuality>, limits: QualityLimits) =>
  (quality.badRatio !== null && quality.badRatio >= limits.maxBadRatio) || (quality.vowellessRatio !== null && quality.vowellessRatio >= limits.maxVowellessRatio);
