import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchText } from '@observatorio/contracts';
import { bboxPages, characterCounts, defaultModeText, findableForms, hyphenJoins, joinClass, midLineTokens, pageQuality, proposedNormalize, proposedSearchPattern, tokens, HYPHEN_MARKER as M } from '../src/proposals-text';
import { auditDocuments } from '../src/proposals-text-audit';
import { syntheticPdf } from './synthetic-pdf';

const available = (command: string) => spawnSync(command, ['-v']).error === undefined;

test('-bbox-layout: estrutura do modo padrão, espaço só entre palavras distantes, entidades decodificadas e estrutura inesperada bloqueada', () => {
  // Linhas de altura 10: "ção" e "," a 0,03 da altura e "ﬁ" e "m" sobrepostas (ligadura) ficam juntas; "a" e "ﬁ", a 0,2, separadas.
  const word = (xMin: number, xMax: number, y: number, text: string) => `<word xMin="${xMin}" yMin="${y}" xMax="${xMax}" yMax="${y + 10}">${text}</word>`;
  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Documento</title><meta name="Producer" content="x"/></head><body><doc>
  <page width="612" height="792"><flow><block xMin="10" yMin="0" xMax="60" yMax="22">
      <line xMin="10" yMin="0" xMax="60" yMax="10">${word(10, 30, 0, 'P&amp;D')}${word(33, 60, 0, 'prote-')}</line>
      <line xMin="10" yMin="12" xMax="45" yMax="22">${word(10, 25, 12, '&#231;&#xE3;o')}${word(25.3, 26, 12, ',')}${word(28.5, 33, 12, 'a')}${word(35, 40, 12, '&#xFB01;')}${word(39.85, 45, 12, 'm')}</line></block>
    <block xMin="10" yMin="30" xMax="20" yMax="40"><line xMin="10" yMin="30" xMax="20" yMax="40">${word(10, 20, 30, '&lt;b&gt;')}</line></block></flow>
    <flow><block xMin="300" yMin="0" xMax="330" yMax="10"><line xMin="300" yMin="0" xMax="330" yMax="10">${word(300, 330, 0, 'direita')}</line></block></flow></page>
  <page width="612" height="792">
  </page>
</doc></body></html>`;
  const [first, second] = bboxPages(xhtml);
  const { gaps, ...page } = first!;
  assert.deepEqual(page, { text: 'P&D prote-\nção, a ﬁm\n<b>\n\ndireita\n\n', flowLines: [['P&D prote-', 'ção, a ﬁm', '<b>'], ['direita']], flows: 2, blocks: 3, lines: 4, words: 9 });
  assert.deepEqual([gaps.joined, gaps.spaced], [2, 3]);
  assert.ok(Math.abs(gaps.maxJoined! - 0.03) < 1e-9 && Math.abs(gaps.minSpaced! - 0.2) < 1e-9);
  // O modo padrão descarta o hífen da linha seguida de outra no mesmo fluxo; no último do fluxo, não.
  assert.equal(defaultModeText(first!), 'P&D proteção, a ﬁm\n<b>\n\ndireita\n\n');
  assert.equal(defaultModeText({ flowLines: [['fim-'], ['outro']] }), 'fim-\n\noutro\n\n');
  assert.deepEqual(second, { text: '', flowLines: [], flows: 0, blocks: 0, lines: 0, words: 0, gaps: { joined: 0, spaced: 0, maxJoined: null, minSpaced: null } });
  const at = 'xMin="0" yMin="0" xMax="1" yMax="1"';
  for (const broken of [`<page><flow><block><line ${at}>solto</line></block></flow></page>`, '<page><block></block></page>', '<page><flow>', `<page><flow><block><line ${at}><word ${at}>&nbsp;</word></line></block></flow></page>`,
    '<page></flow></page>', `<page><flow><block><line ${at}><word xMin="0" yMin="0" xMax="1">x</word></line></block></flow></page>`, '<page><flow><block><line xMin="a" yMin="0" xMax="1" yMax="1"></line></block></flow></page>']) {
    assert.throws(() => bboxPages(broken), Error, broken);
  }
});

test('normalização proposta: hífen de fim de linha vira marcador; ligaduras, invisíveis, hífens e aspas Unicode normalizados', () => {
  const cases: Array<[string, string]> = [
    ['Prote-\nção social', `prote${M}cao social`], ['pré-\nsal', `pre${M}sal`], ['2022-\n2026', `2022${M}2026`], ['educa­\nção', `educa${M}cao`],
    ['texto-\n\nseguinte', `texto${M}seguinte`], ['aprimora-\n\n18\n', 'aprimora- 18'], ['educa­ção', 'educacao'], ['ﬁnanciamento e ﬂuxo', 'financiamento e fluxo'],
    ['zero​width', 'zerowidth'], ['a﻿b', 'ab'], ['pré‐sal', 'pre-sal'], ['pré-sal', 'pre-sal'], ['d’Avila', "d'avila"],
    ['“Saúde”', '"saude"'], ['fim -\nlinha', 'fim - linha'], ['nº 12', 'nº 12'], ['  Várias   linhas\n\n ', 'varias linhas'],
  ];
  for (const [input, expected] of cases) assert.equal(proposedNormalize(input), expected, JSON.stringify(input));
  // Diferenças que motivam a v2, na normalização publicada.
  assert.equal(searchText('pré-\nsal'), 'presal');
  assert.equal(searchText('a﻿b'), 'a b');
  assert.equal(searchText('ﬁnanciamento'), 'ﬁnanciamento');
});

test('palavras sem pontuação nas pontas; com marcador, grafias sem e com hífen', () => {
  assert.deepEqual(tokens(proposedNormalize('(Saúde), educação. — pré-sal!')), ['saude', 'educacao', 'pre-sal']);
  assert.deepEqual(findableForms(`pre${M}sal`), ['presal', 'pre-sal']);
  assert.deepEqual(findableForms('saude'), ['saude']);
});

test('busca proposta: marcador opcional entre caracteres, "-" do termo casa "-" ou marcador, caracteres especiais literais', () => {
  const text = `a prote${M}cao social, o pre${M}sal, o pre-sal e o (ver) item 1.5`;
  assert.ok(proposedSearchPattern('protecao').test(text) && proposedSearchPattern('prote-cao').test(text));
  assert.equal(text.match(proposedSearchPattern('pre-sal', 'gu'))?.length, 2);
  assert.equal(text.match(proposedSearchPattern('presal', 'gu'))?.length, 1, 'hífen no meio da linha continua literal');
  assert.ok(proposedSearchPattern('(ver)').test(text) && proposedSearchPattern('1.5').test(text) && !proposedSearchPattern('1x5').test(text));
});

test('junções de fim de linha classificadas pelo que aparece escrito no meio da linha', () => {
  const text = 'O pré-sal no meio.\nO pré-\nsal no fim.\nA proteção aqui e a prote-\nção ali.\nUma pala-\n\nvra.\nAno 2022-\n2026.';
  const joins = hyphenJoins(text);
  assert.deepEqual(joins.map((join) => `${join.left}-${join.right}`), ['pre-sal', 'prote-cao', 'pala-vra', '2022-2026']);
  assert.deepEqual(joins.map((join) => [join.digits, join.blankLine]), [[false, false], [false, false], [false, true], [true, false]]);
  const midLine = new Set(midLineTokens(text));
  assert.ok(midLine.has('pre-sal') && midLine.has('protecao') && !midLine.has('presal'));
  assert.deepEqual(joins.map((join) => joinClass(join, midLine)), ['compound', 'split', 'unknown', 'unknown']);
  assert.equal(joinClass({ left: 'pre', right: 'sal', digits: false, blankLine: false }, new Set(['pre-sal', 'presal'])), 'both');
  // Depois de linha em branco, só entre letras: o que segue um hífen no fim da página costuma ser o número dela.
  assert.deepEqual(hyphenJoins('devem ser aprimora-\n\n18\n'), []);
});

test('contagem de caracteres a decidir e sinais de texto ilegível, com null quando não há base', () => {
  const counts = characterCounts('a�bc\u0001d x­\ny x­y ‐ – a–b ﬁ ​ ’ “   Ωmega');
  assert.deepEqual(counts, { replacement: 1, privateUse: 1, control: 1, nonLatinLetter: 1, softHyphenLineEnd: 1, softHyphenInside: 1, unicodeHyphen: 1, enDash: 2,
    enDashBetweenLetters: 1, ligature: 1, invisible: 1, typographicApostrophe: 1, typographicQuote: 1, unicodeSpace: 1 });
  assert.deepEqual(pageQuality(' \n '), { visible: 0, bad: 0, letters: 0, words: 0, vowelless: 0, badRatio: null, letterRatio: null, vowellessRatio: null });
  const quality = pageQuality('abc � xyz bcd');
  assert.deepEqual([quality.visible, quality.bad, quality.letters, quality.words, quality.vowelless], [11, 2, 9, 3, 1]);
  assert.equal(quality.vowellessRatio, 1 / 3);
});

test('auditoria com PDF sintético: colunas misturadas no -layout, hífens preservados no -bbox-layout e página abaixo do limiar à parte', { skip: !available('pdftotext') && 'pdftotext ausente' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'propostas-auditoria-'));
  try {
    const path = join(directory, 'sintetico.pdf');
    await writeFile(path, syntheticPdf([
      [{ x: 72, y: 720, text: 'A proteção começa aqui e a prote-' }, { x: 72, y: 706, text: 'ção social continua.' }, { x: 72, y: 680, text: 'O pré-sal aparece inteiro aqui.' },
        { x: 72, y: 654, text: 'O petróleo do pré-' }, { x: 72, y: 640, text: 'sal é estratégico.' }, { x: 72, y: 614, text: 'Ano 2022-' }, { x: 72, y: 600, text: '2026 de governo.' }],
      [{ x: 72, y: 720, text: 'Coluna esquerda linha um' }, { x: 320, y: 720, text: 'Coluna direita linha um' }, { x: 72, y: 706, text: 'esquerda fala de prote-' },
        { x: 320, y: 706, text: 'direita fala de saude' }, { x: 72, y: 692, text: 'ção social na sequência' }, { x: 320, y: 692, text: 'pública na sequência' }],
      [{ x: 72, y: 720, text: 'Só imagem' }],
    ]));
    const images = available('pdftoppm') ? join(directory, 'paginas') : null;
    const audit = await auditDocuments([{ sha256: 'f'.repeat(64), file: 'BR/2022BR000000000001.pdf', path, candidacies: [{ number: '99', ballotName: 'Teste', situation: 'APTO' }] }], { images, terms: ['proteção', 'pré-sal', 'ab'] });
    assert.deepEqual(audit.summary.errors, []);
    assert.deepEqual([audit.summary.pages, audit.summary.nativePages, audit.summary.belowThreshold], [3, 2, 1]);
    const [document] = audit.documents;
    assert.deepEqual(document!.belowThreshold, [3]);
    assert.deepEqual(document!.visibleDifference, []);
    // A remontagem, com o hífen descartado, é o texto do modo padrão em todas as páginas.
    assert.equal(audit.summary.pagesDifferentFromDefaultMode, 0);
    assert.deepEqual(document!.defaultMode, { identical: 3, different: [] });
    // -layout põe "prote-" ao lado da coluna direita; o -bbox-layout reúne "prote-\nção" na coluna esquerda.
    assert.ok(document!.extraction.pairsOnlyLayout.examples.some((item) => item.text === 'prote direita'));
    assert.ok(document!.extraction.pairsOnlyBbox.examples.some((item) => item.text === 'de protecao'));
    assert.ok(document!.extraction.tokensOnlyLayout.examples.some((item) => item.text === 'cao'));
    assert.ok(document!.layout.hyphenBeforeGap >= 1);
    // Total: o pedaço solto da coluna sai; o par da coluna recuperado entra; com o marcador, "2022-\n2026" passa a ser "2022-2026".
    assert.ok(document!.total.tokensOnlyV1.examples.some((item) => item.text === 'cao'));
    assert.ok(document!.total.pairsOnlyV2.examples.some((item) => item.text === 'de protecao'));
    assert.ok(document!.total.hyphenatedOnlyV2.examples.some((item) => item.text === '2022-2026'));
    assert.ok(!document!.total.tokensOnlyV2.examples.some((item) => item.text.includes('-')), 'Grafias do marcador com hífen ficam à parte');
    assert.deepEqual(document!.hyphens.classes, { compound: 1, split: 2, both: 0, unknown: 1 });
    assert.deepEqual([document!.hyphens.lineEndJoins, document!.hyphens.withDigits], [4, 1]);
    assert.equal(audit.review.columns[0]!.page, 2);
    // Busca: na p. 2 só a proposta acha "proteção" (o -layout põe "prote-" ao lado da outra coluna); contagens por termo.
    assert.ok(document!.search.onlyV2.examples.some((item) => item.text === 'protecao' && item.pages.includes(2)));
    assert.deepEqual(audit.terms.map((item) => [item.term, item.documents[0]!.v1, item.documents[0]!.v2]), [['proteção', 2, 3], ['pré-sal', 1, 2], ['ab', null, null]]);
    assert.equal(audit.layoutTexts.size, 3);
    if (images) assert.ok((await readdir(images)).includes(audit.review.columns[0]!.image!));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
