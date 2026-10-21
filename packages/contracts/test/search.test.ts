import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROPOSALS_NORMALIZATION, proposalsDatasetSchema, SEARCH_HYPHEN_MARKER as M, searchNormalize, searchPattern, searchText } from '../src';

test('normalização v2: hífen de fim de linha vira marcador; ligaduras, invisíveis, hífens e aspas Unicode normalizados', () => {
  assert.equal(PROPOSALS_NORMALIZATION, 'proposals-search-v2');
  const cases: Array<[string, string]> = [
    ['Prote-\nção social', `prote${M}cao social`], ['pré-\nsal', `pre${M}sal`], ['2022-\n2026', `2022${M}2026`], ['educa­\nção', `educa${M}cao`],
    ['pré‐\nsal', `pre${M}sal`], ['texto-\n\nseguinte', `texto${M}seguinte`], ['aprimora-\n\n18\n', 'aprimora- 18'], ['educa­ção', 'educacao'],
    ['ﬁnanciamento e ﬂuxo', 'financiamento e fluxo'], ['zero​width', 'zerowidth'], ['a﻿b', 'ab'], ['pré‐sal', 'pre-sal'],
    ['pré-sal', 'pre-sal'], ['d’Avila', "d'avila"], ['“Saúde”', '"saude"'], ['fim -\nlinha', 'fim - linha'], ['nº 12 e m²', 'nº 12 e m²'],
    ['ano – 2022', 'ano – 2022'], ['  Várias   linhas\n\n ', 'varias linhas'],
  ];
  for (const [input, expected] of cases) assert.equal(searchText(input), expected, JSON.stringify(input));
});

test('mapa de posições: cada caractere normalizado aponta para o original, inclusive o marcador e as ligaduras', () => {
  const text = 'A prote-\n  ção e o ﬁm';
  const { normalized, map } = searchNormalize(text);
  assert.equal(normalized, `a prote${M}cao e o fim`);
  assert.equal(map.length, normalized.length);
  assert.equal(text[map[normalized.indexOf(M)]!], '-', 'Marcador aponta para o hífen do original');
  const at = normalized.indexOf('fim');
  assert.deepEqual([map[at], map[at + 1], map[at + 2]], [text.indexOf('ﬁ'), text.indexOf('ﬁ'), text.indexOf('m', text.indexOf('ﬁ'))]);
  assert.equal(text.slice(map[normalized.indexOf('prote')]!, map[normalized.indexOf('cao') + 2]! + 1), 'prote-\n  ção');
});

test('expressão da busca: marcador opcional, "-" do termo casa "-" ou marcador, caracteres especiais literais', () => {
  const text = `a prote${M}cao social, o pre${M}sal, o pre-sal, o bem-estar e o (ver) item 1.5`;
  const find = (term: string) => text.match(new RegExp(searchPattern(searchText(term)), 'gu'))?.length ?? 0;
  assert.deepEqual(['proteção', 'prote-ção', 'pré-sal', 'presal', 'bemestar', '(ver)', '1.5', '1x5'].map(find), [1, 1, 2, 1, 0, 1, 1, 0], 'Hífen no meio da linha continua literal');
  assert.equal(searchPattern(`pre${M}sal`), searchPattern('presal'), 'Marcador no próprio termo é ignorado');
  assert.equal(searchPattern('a.b'), `a${M}?\\.${M}?b`);
});

test('publicação: campos da v2 opcionais, para a v1 continuar legível, e nunca presumidos', () => {
  const source = { file: 'f.zip', entry: 'x', url: 'https://exemplo.org/f.zip', sha256: 'a'.repeat(64), downloadedAt: '2026-10-20T00:00:00Z', generatedAt: [], lastModified: null, rowsRead: 1, rowsSelected: 1 };
  const v1 = { id: 'b'.repeat(64), kind: 'proposals', year: 2022, importedAt: '2026-10-20T00:00:00Z', importerVersion: 'proposals-2022-v1', sources: [source], scope: 'Teste', notes: [],
    method: { textPageMinChars: 50, pdftotext: 'pdftotext 24.02.0', tesseract: 'tesseract 5.3.4', ocrLanguage: 'por', ocrDpi: 300 }, totals: { candidacies: 1, documents: 1, pages: 1, nativePages: 1, ocrPages: 0, emptyPages: 0 } };
  assert.equal(proposalsDatasetSchema.parse(v1).method.normalization, undefined);
  const v2 = { ...v1, method: { ...v1.method, extraction: 'bbox-layout', wordSpace: 0.04, normalization: PROPOSALS_NORMALIZATION, quality: { maxBadRatio: 0.01, maxVowellessRatio: 0.2 } } };
  assert.equal(proposalsDatasetSchema.parse(v2).method.normalization, PROPOSALS_NORMALIZATION);
  assert.equal(proposalsDatasetSchema.safeParse({ ...v2, method: { ...v2.method, extraction: 'layout' } }).success, false);
});
