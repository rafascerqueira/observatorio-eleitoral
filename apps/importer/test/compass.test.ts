import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'csv-parse/sync';
import { searchText } from '@observatorio/contracts';
import { AXES, COMPASS_CRITERIA, COMPASS_EXCLUDED_TERMS, COMPASS_TERMS, compassAgreement, MIN_ITEMS, NO_POSITION, polarity, positions, STATEMENTS, validateCompass, weightedKappa } from '../src/compass-core';
import { codingTemplate, documentId, type CodingRow } from '../src/rubric-core';

// Documentos, páginas e posições sintéticos; nenhum dado real.
const documents = [{ id: documentId('c'.repeat(64)), sha256: 'c'.repeat(64), pages: 2, candidacies: '11 · CANDIDATURA C' },
  { id: documentId('d'.repeat(64)), sha256: 'd'.repeat(64), pages: 1, candidacies: '12 · CANDIDATURA D' }];
const pages: Record<string, string> = { [`${'c'.repeat(64)}/1`]: 'Vamos privatizar a empresa estatal de correios e reduzir a carga tributária.' };
const pageText = (sha256: string, page: number) => pages[`${sha256}/${page}`] === undefined ? null : searchText(pages[`${sha256}/${page}`]!);
const row = (documento: string, criterio: string, valor: string, paginas: number[] = [], trecho = ''): CodingRow => ({ documento, criterio, valor, paginas, trecho, observacao: '' });
/** Tudo sem posição, menos o que for passado em `values` (afirmação → valor, com evidência na página 1 do documento C). */
const coding = (documento: string, values: Record<string, string> = {}) => STATEMENTS.map((statement) => values[statement.code]
  ? row(documento, statement.code, values[statement.code]!, [1], 'privatizar a empresa estatal') : row(documento, statement.code, NO_POSITION));

test('bússola: seis afirmações por polo em cada eixo, códigos e termos únicos, exclusões declaradas', () => {
  for (const axis of Object.keys(AXES) as Array<keyof typeof AXES>) for (const sign of [1, -1])
    assert.equal(STATEMENTS.filter((statement) => statement.axis === axis && polarity(statement) === sign).length, 6, `${axis} ${sign}`);
  assert.equal(new Set(STATEMENTS.map((statement) => statement.code)).size, STATEMENTS.length);
  assert.ok(STATEMENTS.every((statement) => (statement.axis === 'economia' ? 'e' : statement.pole === 'progressista' ? 'c' : 'k') === statement.code[0]));
  assert.equal(new Set(COMPASS_TERMS.map((item) => searchText(item.term))).size, COMPASS_TERMS.length);
  assert.ok(COMPASS_TERMS.every((item) => searchText(item.term).length >= 3), 'Todos buscáveis em /propostas (3 a 80 caracteres)');
  assert.deepEqual(COMPASS_TERMS.find((item) => item.term === 'liberdade religiosa')!.criteria, ['c05-laicidade', 'k05-familia-e-fe']);
  assert.ok(COMPASS_EXCLUDED_TERMS.every((item) => !COMPASS_TERMS.some((term) => searchText(term.term) === searchText(item.term))));
  const template = parse(codingTemplate(documents, COMPASS_CRITERIA), { delimiter: ';', columns: true, bom: true }) as Array<Record<string, string>>;
  assert.equal(template.length, documents.length * STATEMENTS.length);
  assert.equal(template[0]!.valores_permitidos, 'concorda-totalmente | tende-a-concordar | neutra | tende-a-discordar | discorda-totalmente | sem-posicao');
});

test('validação: posição exige página e trecho conferido; "sem-posicao" dispensa', () => {
  const valid = [...coding(documents[0]!.id, { 'e02-privatizacao': 'concorda-totalmente' }), ...coding(documents[1]!.id)];
  assert.deepEqual(validateCompass(valid, documents, pageText), []);
  const broken = valid.map((item) => item.criterio === 'e02-privatizacao' && item.documento === documents[0]!.id ? { ...item, trecho: 'estatizar os correios' } : item);
  broken.push(row(documents[1]!.id, 'e01-estatais-bancos-publicos', 'concorda'));
  const problems = validateCompass(broken, documents, pageText);
  assert.ok(problems.some((problem) => /e02-privatizacao: trecho não encontrado na página 1/.test(problem)));
  assert.ok(problems.some((problem) => /e01-estatais-bancos-publicos: linha repetida/.test(problem)));
});

test('kappa ponderado: perto conta mais que longe; nulo sem pares com posição', () => {
  const near = weightedKappa([['concorda-totalmente', 'tende-a-concordar'], ['discorda-totalmente', 'discorda-totalmente'], ['neutra', 'neutra']]);
  const far = weightedKappa([['concorda-totalmente', 'discorda-totalmente'], ['discorda-totalmente', 'discorda-totalmente'], ['neutra', 'neutra']]);
  assert.ok(near.kappa! > far.kappa!);
  assert.equal(weightedKappa([['concorda-totalmente', 'concorda-totalmente'], ['tende-a-discordar', 'tende-a-discordar']]).kappa, 1);
  assert.deepEqual(weightedKappa([[NO_POSITION, 'neutra']]), { items: 0, observed: null, expected: null, kappa: null });
  // Observada igual à esperada (0,95 nas duas, com arredondamento na soma): kappa exatamente zero.
  assert.equal(weightedKappa([...Array(4).fill(['tende-a-concordar', 'tende-a-concordar']), ['tende-a-concordar', 'concorda-totalmente']]).kappa, 0);
  const a = coding(documents[0]!.id, { 'e02-privatizacao': 'concorda-totalmente', 'k01-armas': 'neutra' }), b = coding(documents[0]!.id, { 'e02-privatizacao': 'tende-a-concordar' });
  const result = compassAgreement(a, b);
  assert.deepEqual([result.located.items, result.located.agreements, result.scale.items], [STATEMENTS.length, STATEMENTS.length - 1, 1]);
  assert.equal(result.byAxis.costumes!.scale.items, 0);
  assert.deepEqual([result.byAxis.economia!.publishable, result.byAxis.costumes!.publishable], [false, false], 'Um par só, com kappa nulo, e eixo sem pares não atingem o mínimo');
  const agreed = coding(documents[0]!.id, { 'e01-estatais-bancos-publicos': 'concorda-totalmente', 'e02-privatizacao': 'discorda-totalmente', 'e03-tributacao-progressiva': 'neutra' });
  assert.equal(compassAgreement(agreed, agreed).byAxis.economia!.publishable, true);
});

test('posições: média com polaridade, "sem posição" fora da média, mínimo de afirmações, intervalo determinístico', () => {
  const economy = STATEMENTS.filter((statement) => statement.axis === 'economia');
  // Concorda totalmente com as quatro primeiras afirmações de economia: duas da esquerda (−1) e duas da direita (+1).
  const values = Object.fromEntries(economy.slice(0, 4).map((statement) => [statement.code, 'concorda-totalmente']));
  const first = positions(coding(documents[0]!.id, values), documents);
  const position = first[0]!.axes.economia;
  assert.deepEqual([position.status, position.items, position.score], ['situada', 4, 0]);
  assert.ok(position.interval![0] < 0 && position.interval![1] > 0 && position.interval![0] >= -1 && position.interval![1] <= 1);
  assert.deepEqual(position.leaveOneOut!.map((value) => Number(value.toFixed(3))), [-0.333, 0.333]);
  assert.deepEqual(positions(coding(documents[0]!.id, values), documents)[0]!.axes.economia.interval, position.interval, 'Mesma codificação, mesmo intervalo');
  assert.deepEqual([first[0]!.axes.costumes.status, first[0]!.axes.costumes.score, first[0]!.axes.costumes.items], ['insuficiente', null, 0], 'Sem posição não vira neutro');
  assert.equal(first[1]!.axes.economia.status, 'insuficiente');
  // Discorda totalmente das seis afirmações da direita: −1 (esquerda), com intervalo degenerado.
  const left = Object.fromEntries(economy.filter((statement) => statement.pole === 'direita').map((statement) => [statement.code, 'discorda-totalmente']));
  const leftPosition = positions(coding(documents[0]!.id, left), documents)[0]!.axes.economia;
  assert.deepEqual([leftPosition.score, leftPosition.interval], [-1, [-1, -1]]);
  // Neutra conta como zero e entra no mínimo; abaixo do mínimo não há coordenada.
  const neutral = Object.fromEntries(economy.slice(0, MIN_ITEMS - 1).map((statement) => [statement.code, 'neutra']));
  assert.deepEqual([positions(coding(documents[0]!.id, neutral), documents)[0]!.axes.economia.status], ['insuficiente']);
});
