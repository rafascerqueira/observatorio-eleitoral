import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CandidacyEntry, type Candidacy } from '../components/proposal-entry';

// Candidatura e trechos sintéticos.
const base: Candidacy = { number: '14', ballotName: 'CANDIDATURA C', party: 'P2', situation: 'APTO', listing: 'candidate',
  document: { sha256: 'b'.repeat(64), file: 'BR/x.pdf', pages: 3, nativePages: 2, ocrPages: 1, emptyPages: 0 },
  sameDocumentAs: [{ number: '14', ballotName: 'CANDIDATURA B', situation: 'INAPTO' }], matches: null };
const render = (item: Candidacy, query: string | null) => renderToStaticMarkup(createElement(CandidacyEntry, { item, query }));

test('propostas: ausência de ocorrência não vira ausência de proposta, e o documento compartilhado é declarado', () => {
  const html = render({ ...base, matches: { pages: [], excerpts: [] } }, 'saude');
  assert.match(html, /Nenhuma ocorrência literal de “saude” no texto extraído/); assert.match(html, /não indica que a proposta não trate do tema/);
  assert.match(html, /3 páginas: 2 com o texto do próprio PDF, 1 por OCR/); assert.match(html, /registrado também pela candidatura 14 · CANDIDATURA B/);
  assert.doesNotMatch(render(base, null), /Nenhuma ocorrência/, 'Sem busca, só a cobertura');
  assert.match(html, /o OCR pode ter errado palavras/);
  const native = render({ ...base, document: { ...base.document!, nativePages: 3, ocrPages: 0 }, matches: { pages: [], excerpts: [] } }, 'saude');
  assert.doesNotMatch(native, /OCR pode ter errado/, 'Aviso do OCR só para documento com páginas por OCR');
  assert.match(render({ ...base, matches: { pages: [4], excerpts: [] } }, 'saude'), /Ocorrência literal na página 4\./);
});

test('propostas: trecho do PDF é texto, não marcação; OCR identificado e páginas listadas em ordem', () => {
  const html = render({ ...base, matches: { pages: [2, 7, 9], excerpts: [{ page: 2, method: 'ocr', before: '<script>x</script> antes ', match: 'Saúde', after: ' depois' }] } }, 'saude');
  assert.match(html, /páginas 2, 7, 9/); assert.match(html, /Trechos das 1 primeiras/); assert.match(html, /p\. 2 \(OCR\)/);
  assert.match(html, /<mark>Saúde<\/mark>/); assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
});

test('propostas: candidatura sem votos com a própria situação e cabeçalho sob o título do grupo', () => {
  const noVotes: Candidacy = { ...base, number: '90', ballotName: 'CANDIDATURA D', situation: 'INAPTO', listing: 'no-votes', sameDocumentAs: [] };
  const html = renderToStaticMarkup(createElement(CandidacyEntry, { item: noVotes, query: null, level: 4 }));
  assert.match(html, /<h4 id="candidatura-90-no-votes">90 · CANDIDATURA D \(P2\)<\/h4>/);
  assert.match(html, /Situação no cadastro do TSE: inapto; sem votos nos resultados publicados\./);
  assert.match(render(base, null), /<h3 id="candidatura-14-candidate">/); assert.doesNotMatch(render(base, null), /Situação no cadastro/);
});
