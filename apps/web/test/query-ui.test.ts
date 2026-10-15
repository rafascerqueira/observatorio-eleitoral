import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { municipalityQuerySchema, placesQuerySchema, STATES } from '@observatorio/contracts';
import { ErrorSummary, QuerySelect, TurnField } from '../components/query-fields';
import { UF_NAMES, officeScopeError, queryErrors, rawValue, recoverQuery } from '../lib/query-ui';
import { brazilHref, formFingerprint, overviewHref, queryHref } from '../lib/query-navigation';

test('erro em um campo não apaga o contexto nem os valores que precisam de correção', () => {
  const raw = { year: '2026', round: '2', uf: 'RJ', search: 'Rio', page: '0' };
  const parsed = municipalityQuerySchema.safeParse(raw);
  assert.equal(parsed.success, false);
  const recovered = municipalityQuerySchema.parse(recoverQuery(raw, 'municipalities'));
  assert.equal(recovered.year, '2026'); assert.equal(recovered.round, '2'); assert.equal(recovered.uf, 'RJ'); assert.equal(recovered.search, 'Rio');
  assert.equal(recovered.page, 1);
  const places = { year: '2026', round: '2', uf: 'SP', zone: '-1', section: '0002', search: 'Rua São João', pageSize: '50' };
  const context = placesQuerySchema.parse(recoverQuery(places, 'places'));
  assert.equal(context.zone, undefined); assert.equal(context.section, 2); assert.equal(context.round, '2'); assert.equal(context.pageSize, 50);
  assert.equal(rawValue(places, 'zone'), '-1'); assert.equal(rawValue(places, 'section'), '0002');
  assert.equal(rawValue({ year: ['2026', '2022'] }, 'year'), '2026');
});

test('mensagens distinguem limites, duplicação, parâmetros desconhecidos e UF de locais', () => {
  const raw = { zone: '0', section: ['1', '2'], local: 'abc', search: 'x'.repeat(101), unknown: 'foo' };
  const parsed = placesQuerySchema.safeParse(raw);
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  const errors = queryErrors(raw, parsed.error.issues, 'places');
  assert.match(errors.find((error) => error.field === 'zone')!.message, /1 a 9999/);
  assert.match(errors.find((error) => error.field === 'section')!.message, /mais de uma vez/);
  assert.match(errors.find((error) => error.field === 'local')!.message, /1 a 99999/);
  assert.match(errors.find((error) => error.field === 'search')!.message, /100 caracteres/);
  assert.match(errors.find((error) => error.field === 'query')!.message, /unknown/);
  const badUf = placesQuerySchema.safeParse({ uf: 'XX' });
  assert.equal(badUf.success, false);
  if (!badUf.success) assert.match(queryErrors({ uf: 'XX' }, badUf.error.issues, 'places')[0]!.message, /volte à consulta municipal/);
  assert.equal(placesQuerySchema.parse({ uf: 'ZZ' }).uf, 'ZZ');
});

test('GET aprimorado preserva zeros, texto e âncora sem transformar entrada em URL externa', () => {
  const entries: Array<[string, string]> = [['year', '2022'], ['round', '2'], ['uf', 'SP'], ['zone', '0001'], ['section', '0002'], ['search', ' São João & filhos '], ['local', ''], ['page', '1']];
  const url = new URL(queryHref('/municipios/71072#resultados', entries), 'http://localhost');
  assert.equal(url.pathname, '/municipios/71072'); assert.equal(url.hash, '#resultados');
  assert.equal(url.searchParams.get('zone'), '0001'); assert.equal(url.searchParams.get('section'), '0002');
  assert.equal(url.searchParams.get('search'), 'São João & filhos'); assert.equal(url.searchParams.has('local'), false);
  assert.equal(queryHref('/', [['uf', ''], ['search', ' ']]), '/');
  for (const action of ['https://example.com', '//example.com', 'javascript:alert(1)', '/\\example.com', '/?year=2022']) assert.throws(() => queryHref(action, entries));
});

test('voltar ao Brasil remove recorte e paginação, mantendo eleição e turno', () => {
  const url = new URL(brazilHref('2026', '2'), 'http://localhost');
  assert.deepEqual([...url.searchParams], [['year', '2026'], ['round', '2']]);
  assert.equal(formFingerprint([['year', '2022'], ['search', ' Recife ']]), formFingerprint([['search', 'Recife'], ['year', '2022']]));
  assert.notEqual(formFingerprint([['round', '1']]), formFingerprint([['round', '2']]));
});

test('seletor preserva valor inválido e associa erro ao campo; resumo aponta para o controle', () => {
  const errors = [{ field: 'year', message: 'Escolha 2022 ou 2026.' }];
  const html = renderToStaticMarkup(createElement(QuerySelect, { id: 'places-year', name: 'year', value: '2024', choices: [{ value: '2022', label: '2022' }], errors }));
  assert.match(html, /value="2024" selected=""/); assert.match(html, /Valor informado: 2024/);
  assert.match(html, /aria-invalid="true"/); assert.match(html, /aria-describedby="places-year-error"/);
  assert.match(html, /id="places-year-error"/);
  const summary = renderToStaticMarkup(createElement(ErrorSummary, { errors, targets: { year: 'places-year' } }));
  assert.match(summary, /href="#places-year"/);
  assert.match(summary, /role="alert"/);
});

test('turnos continuam radios nativos e um turno inválido não vira o padrão silenciosamente', () => {
  const html = renderToStaticMarkup(createElement(TurnField, { value: '2', errors: [] }));
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.match(html, /checked="" value="2"|value="2" checked=""/);
  assert.doesNotMatch(html, /role="tab"/);
  const invalid = renderToStaticMarkup(createElement(TurnField, { value: '3', errors: [{ field: 'round', message: 'Escolha o turno.' }] }));
  assert.match(invalid, /checked="" value="3"|value="3" checked=""/);
  assert.match(invalid, /Turno informado: 3/);
  assert.match(invalid, /aria-describedby="round-error"/);
});

test('nomes de UFs cobrem somente as 27 UFs do contrato, sem incluir o exterior', () => {
  assert.deepEqual(Object.keys(UF_NAMES).sort(), [...STATES].sort());
  assert.equal(UF_NAMES.SP, 'São Paulo');
});

test('governador exige UF, rejeita o exterior e os links de volta preservam cargo e UF', () => {
  assert.equal(officeScopeError('president', undefined), null);
  assert.equal(officeScopeError('governor', 'SP'), null);
  assert.match(officeScopeError('governor', undefined)!.message, /cargo estadual/);
  assert.match(officeScopeError('governor', 'ZZ')!.message, /exterior/);
  assert.equal(officeScopeError('governor', undefined)!.field, 'uf');
  assert.equal(municipalityQuerySchema.parse({ office: 'governor', uf: 'SP' }).office, 'governor');
  assert.deepEqual([...new URL(overviewHref('2022', '2', 'governor', 'SP'), 'http://localhost').searchParams], [['year', '2022'], ['round', '2'], ['office', 'governor'], ['uf', 'SP']]);
  assert.equal(overviewHref('2022', '1', 'president', 'SP'), brazilHref('2022', '1'));
});
