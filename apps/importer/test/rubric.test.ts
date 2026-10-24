import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'csv-parse/sync';
import { searchText } from '@observatorio/contracts';
import { adjudicationTemplate, agreement, authorship, codingTemplate, cohenKappa, consolidate, criterionReliability, csv, gwetAC1, MIN_CRITERION_AC1, documentId, readCoding, RUBRIC_CRITERIA, RUBRIC_EXCLUDED_TERMS, RUBRIC_TERMS, validateCoding, type CodingRow } from '../src/rubric-core';

// Dois documentos e páginas sintéticos; nenhum dado real.
const documents = [{ id: documentId('a'.repeat(64)), sha256: 'a'.repeat(64), pages: 3, candidacies: '11 · CANDIDATURA A' },
  { id: documentId('b'.repeat(64)), sha256: 'b'.repeat(64), pages: 2, candidacies: '12 · CANDIDATURA B' }];
const pages: Record<string, string> = {
  [`${'a'.repeat(64)}/2`]: 'Vamos ampliar o transporte público acessível nas regiões metropolitanas até 2026, com 500 novos ônibus adaptados.',
  [`${'a'.repeat(64)}/3`]: 'O Ministério das Cidades coordenará o programa.',
};
const pageText = (sha256: string, page: number) => pages[`${sha256}/${page}`] === undefined ? null : searchText(pages[`${sha256}/${page}`]!);
/** Codificação completa e válida: o documento A trata do tema; no B, o tema não foi localizado. */
function coding(): CodingRow[] {
  const quote = 'transporte público acessível nas regiões metropolitanas';
  const positive: Record<string, [string, number[], string]> = {
    tema: ['trata', [2], quote], diagnostico: ['nao-localizado', [], ''], intervencao: ['especifica', [2], 'com 500 novos ônibus adaptados'], publico: ['nao-localizado', [], ''],
    territorio: ['declarado', [2], 'nas regiões metropolitanas'], 'meta-quantidade': ['declarada', [2], '500 novos ônibus'], 'meta-prazo': ['declarado', [2], 'até 2026'],
    responsabilidade: ['mencionada', [3], 'O Ministério das Cidades coordenará'], custo: ['nao-localizado', [], ''], 'fonte-recursos': ['nao-localizado', [], ''], acompanhamento: ['nao-localizado', [], ''],
  };
  return [...RUBRIC_CRITERIA.map((criterion) => { const [valor, paginas, trecho] = positive[criterion.code]!; return { documento: documents[0]!.id, criterio: criterion.code, valor, paginas, trecho, observacao: '' }; }),
    ...RUBRIC_CRITERIA.map((criterion) => ({ documento: documents[1]!.id, criterio: criterion.code, valor: criterion.code === 'tema' ? 'nao-localizado' : 'nao-se-aplica', paginas: [], trecho: '', observacao: '' }))];
}
const toCsv = (rows: readonly CodingRow[]) => csv([['documento', 'candidaturas', 'criterio', 'pergunta', 'valores_permitidos', 'valor', 'paginas', 'trecho', 'observacao'],
  ...rows.map((row) => [row.documento, '', row.criterio, '', '', row.valor, row.paginas.join(', '), row.trecho, row.observacao])]);

test('rubrica: termos únicos, exclusões declaradas e critérios com "não localizado"', () => {
  assert.equal(new Set(RUBRIC_TERMS.map(searchText)).size, RUBRIC_TERMS.length);
  assert.ok(RUBRIC_TERMS.every((term) => searchText(term).length >= 3), 'Todos buscáveis em /propostas (3 a 80 caracteres)');
  assert.ok(RUBRIC_EXCLUDED_TERMS.every((item) => !RUBRIC_TERMS.some((term) => searchText(term) === searchText(item.term))));
  assert.ok(RUBRIC_CRITERIA.every((criterion) => criterion.values.some((value) => value.code === 'nao-localizado')));
  assert.ok(RUBRIC_CRITERIA.slice(1).every((criterion) => criterion.values.some((value) => value.code === 'nao-se-aplica')));
});

test('planilha: modelo com uma linha por documento e critério, e CSV com ";", aspas e quebras de linha preservados', () => {
  const template = parse(codingTemplate(documents), { delimiter: ';', columns: true, bom: true }) as Array<Record<string, string>>;
  assert.equal(template.length, documents.length * RUBRIC_CRITERIA.length);
  assert.deepEqual([template[0]!.documento, template[0]!.criterio, template[0]!.valores_permitidos], [documents[0]!.id, 'tema', 'trata | nao-localizado']);
  const rows = coding(); rows[0] = { ...rows[0]!, observacao: 'Ver "quadro"; e\na tabela' };
  const back = readCoding(toCsv(rows));
  assert.deepEqual(back[0], rows[0]);
  assert.throws(() => readCoding('﻿documento;valor\r\n"x";"y"\r\n'), /sem as colunas/);
  assert.throws(() => readCoding(toCsv(rows).replace('trata', 'tr�ta')), /CSV UTF-8/);
});

test('validação: valor, coerência com o tema, evidência obrigatória, páginas e trecho conferido no texto publicado', () => {
  assert.deepEqual(validateCoding(coding(), documents, pageText), []);
  const broken = coding();
  const at = (documento: string, criterio: string) => broken.findIndex((row) => row.documento === documento && row.criterio === criterio);
  broken[at(documents[0]!.id, 'diagnostico')]!.valor = 'talvez';
  broken[at(documents[0]!.id, 'publico')]!.valor = 'nao-se-aplica';
  broken[at(documents[0]!.id, 'custo')]!.valor = 'declarado';
  broken[at(documents[0]!.id, 'meta-prazo')]!.paginas = [9];
  broken[at(documents[0]!.id, 'responsabilidade')]!.trecho = 'O Ministério da Fazenda coordenará';
  broken[at(documents[1]!.id, 'meta-prazo')]!.valor = 'nao-localizado';
  const problems = validateCoding([...broken.filter((row) => !(row.documento === documents[1]!.id && row.criterio === 'acompanhamento')), broken[0]!], documents, pageText);
  for (const expected of [/diagnostico: valor "talvez" fora dos permitidos/, /publico: "nao-se-aplica" só quando o tema não foi localizado/, /custo: valor "declarado" exige página e trecho/,
    /meta-prazo: página 9 fora do documento \(1 a 3\)/, /responsabilidade: trecho não encontrado na página 3/, new RegExp(`${documents[1]!.id}/meta-prazo: "nao-se-aplica" só quando`),
    new RegExp(`${documents[1]!.id}/acompanhamento: linha ausente`), /tema: linha repetida/]) assert.ok(problems.some((problem) => expected.test(problem)), String(expected));
  // Trecho copiado do PDF com ligadura, aspas tipográficas e quebra com hífen confere com o texto normalizado.
  const copied = coding(); copied[at(documents[0]!.id, 'intervencao')]!.trecho = 'com 500 no-\nvos ônibus adaptados';
  assert.deepEqual(validateCoding(copied, documents, pageText), []);
});

test('concordância: kappa de Cohen, nulo quando a esperada é total, e divergências na ordem da planilha', () => {
  const kappa = cohenKappa([['a', 'a'], ['a', 'a'], ['b', 'b'], ['a', 'b']]);
  assert.deepEqual([kappa.items, kappa.agreements, kappa.observed, kappa.expected, kappa.kappa], [4, 3, 0.75, 0.5, 0.5]);
  assert.equal(cohenKappa([['x', 'x'], ['x', 'x']]).kappa, null, 'Uma só categoria nas duas: kappa indefinido');
  assert.deepEqual(cohenKappa([]), { items: 0, agreements: 0, observed: null, expected: null, kappa: null });
  const a = coding(), b = coding();
  b.find((row) => row.documento === documents[0]!.id && row.criterio === 'intervencao')!.valor = 'generica';
  const result = agreement(a, b);
  assert.equal(result.divergences.length, 1); assert.equal(result.byCriterion.intervencao!.agreements, 1); assert.equal(result.byCriterion.tema!.observed, 1);
  const sheet = parse(adjudicationTemplate(result.divergences, documents), { delimiter: ';', columns: true, bom: true }) as Array<Record<string, string>>;
  assert.deepEqual([sheet.length, sheet[0]!.valor_a, sheet[0]!.valor_b, sheet[0]!.candidaturas], [1, 'especifica', 'generica', '11 · CANDIDATURA A']);
});

test('consolidação: valor comum quando concordam; decisão com justificativa quando divergem; origem registrada', () => {
  const a = coding(), b = coding();
  b.find((row) => row.documento === documents[0]!.id && row.criterio === 'intervencao')!.valor = 'generica';
  assert.match(consolidate(a, b, []).problems[0]!, /intervencao: divergência sem decisão e justificativa/);
  const decision = { documento: documents[0]!.id, criterio: 'intervencao', valor_final: 'especifica', paginas_final: '2', trecho_final: 'com 500 novos ônibus adaptados', justificativa: 'A frase diz o que será comprado.' };
  const { final, problems } = consolidate(a, b, [decision]);
  assert.deepEqual(problems, []);
  assert.deepEqual(validateCoding(final, documents, pageText), []);
  const decided = final.find((row) => row.documento === documents[0]!.id && row.criterio === 'intervencao')!;
  assert.deepEqual([decided.origem, decided.valor, decided.justificativa], ['adjudicacao', 'especifica', 'A frase diz o que será comprado.']);
  assert.equal(final.filter((row) => row.origem === 'concordancia').length, a.length - 1);
});

test('autoria: pessoa ou modelo com identificador, declarada nas duas codificações e nunca as duas de modelo', () => {
  assert.deepEqual(authorship('modelo:claude-opus-5-5', 'pessoa'), [{ kind: 'modelo', model: 'claude-opus-5-5' }, { kind: 'pessoa' }]);
  assert.deepEqual(authorship('pessoa', 'pessoa'), [{ kind: 'pessoa' }, { kind: 'pessoa' }]);
  assert.throws(() => authorship(null, 'pessoa'), /--autoria-a=pessoa/);
  assert.throws(() => authorship('pessoa', 'modelo:'), /codificação b ausente ou inválida/);
  assert.throws(() => authorship('Fulano', 'pessoa'), /codificação a ausente ou inválida/);
  assert.throws(() => authorship('modelo:x', 'modelo:y'), /ao menos uma tem de ser de uma pessoa/);
});

test('AC1 de Gwet: alto quando quase tudo concorda numa categoria, onde o kappa fica em zero', () => {
  const skewed = [...Array.from({ length: 11 }, () => ['nao-localizado', 'nao-localizado'] as const), ['nao-localizado', 'declarado'] as const];
  assert.equal(cohenKappa(skewed).kappa, 0, 'Paradoxo do kappa: 92% de concordância e kappa zero');
  assert.ok(Math.abs(gwetAC1(skewed, 2)! - 241 / 265) < 1e-12);
  assert.equal(gwetAC1([['a', 'a'], ['b', 'b']], 2), 1);
  assert.equal(gwetAC1([], 2), null);
  assert.equal(gwetAC1([['a', 'a']], 1), null, 'Menos de duas categorias possíveis');
});

test('confiabilidade por critério: sem pares de "nao-se-aplica", intervalo reproduzível e mínimo para publicar', () => {
  const a = coding(), b = coding();
  const same = criterionReliability(a, b);
  assert.deepEqual([same.tema!.items, same.intervencao!.items], [2, 1], 'O documento B (tema não localizado) sai dos critérios dependentes');
  assert.deepEqual([same.intervencao!.ac1, same.intervencao!.interval, same.intervencao!.publishable], [1, [1, 1], true]);
  assert.equal(same.intervencao!.categories, 3, 'Valores do critério menos "nao-se-aplica"');
  b.find((row) => row.documento === documents[0]!.id && row.criterio === 'intervencao')!.valor = 'generica';
  const diverging = criterionReliability(a, b);
  assert.ok(diverging.intervencao!.ac1! < MIN_CRITERION_AC1); assert.equal(diverging.intervencao!.publishable, false);
  assert.deepEqual(criterionReliability(a, b), diverging, 'Mesma codificação, mesmo resultado');
});

test('consistência do modelo: duas codificações do mesmo modelo, e só com --consistencia', () => {
  assert.deepEqual(authorship('modelo:claude-opus-5-5', 'modelo:claude-opus-5-5', true), [{ kind: 'modelo', model: 'claude-opus-5-5' }, { kind: 'modelo', model: 'claude-opus-5-5' }]);
  assert.throws(() => authorship('modelo:x', 'modelo:y', true), /mesmo identificador/);
  assert.throws(() => authorship('modelo:x', 'pessoa', true), /mesmo modelo/);
  assert.throws(() => authorship('modelo:x', 'modelo:x'), /ao menos uma tem de ser de uma pessoa/);
});
