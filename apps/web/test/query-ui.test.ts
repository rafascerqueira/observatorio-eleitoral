import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { municipalityQuerySchema, placesQuerySchema, STATES } from '@observatorio/contracts';
import { ErrorSummary, OfficeField, QuerySelect, TurnField } from '../components/query-fields';
import { availabilityFromCatalog, roundOptions } from '../lib/rounds';
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
  for (const action of ['https://example.com', '//example.com', 'javascript:alert(1)', '/\\example.com', '/?year=2022', '/mapa/outra']) assert.throws(() => queryHref(action, entries));
});

test('todas as páginas com formulário de consulta navegam no envio aprimorado', () => {
  // As ações reais das páginas: uma ação fora da lista fazia o envio falhar em silêncio (/participacao, 17/10/2026).
  for (const action of ['/', '/mapa', '/mapa/candidaturas', '/perfis', '/participacao', '/exterior', '/municipios/71072#resultados']) assert.ok(queryHref(action, [['rows', 'education'], ['cols', 'gender']]).startsWith(action.split('#')[0]!), action);
  assert.equal(queryHref('/participacao', [['uf', 'SP'], ['municipality', ''], ['rows', 'education']]), '/participacao?uf=SP&rows=education');
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

test('quadro de votos não válidos identifica a fonte do nome e não exibe percentual sobre válidos', async () => {
  const { NonValidVotesTable } = await import('../components/non-valid-votes');
  assert.equal(renderToStaticMarkup(createElement(NonValidVotesTable, { items: [], context: 'Teste' })), '');
  assert.equal(renderToStaticMarkup(createElement(NonValidVotesTable, { items: undefined, context: 'Teste' })), '');
  const html = renderToStaticMarkup(createElement(NonValidVotesTable, { context: 'UF sintética', items: [
    { number: '22', name: 'NOME SINTETICO', party: null, category: 'technical-null', nameSource: 'section', detail: null, votes: 5 },
    { number: '30', name: 'Anulada sintética', party: 'TESTE', category: 'annulled', nameSource: 'nominal', detail: 'INDEFERIDO', votes: 0 },
  ] }));
  assert.match(html, /Nulo técnico/); assert.match(html, /nome no arquivo de seções/); assert.match(html, /Não informado na fonte/);
  assert.doesNotMatch(html, /Anulada sintética/, 'Linha sem votos no recorte não é listada');
  assert.doesNotMatch(html, /%/);
});

test('turnos oferecidos seguem as publicações: 2º turno só onde existiu, turno único no Senado', () => {
  // Catálogo sintético: Presidência nacional com dois turnos; Governador com e sem 2º turno; Senador em turno único.
  const availability = availabilityFromCatalog([
    { office: 'president', level: 'national', rounds: ['1', '2'] },
    { office: 'governor', level: 'state', uf: 'SP', rounds: ['1', '2'] },
    { office: 'governor', level: 'state', uf: 'CE', rounds: ['1'] },
    { office: 'senator', level: 'state', uf: 'RJ', rounds: ['1'] },
    { office: 'president', level: 'municipality', uf: 'SP' },
  ]);
  assert.deepEqual(roundOptions(availability, 'president').rounds, ['1', '2']);
  assert.deepEqual(roundOptions(availability, 'governor', 'SP'), { rounds: ['1', '2'], note: null, decided: null });
  const ceara = roundOptions(availability, 'governor', 'CE');
  assert.deepEqual(ceara.rounds, ['1']); assert.equal(ceara.decided, 'first-round'); assert.match(ceara.note!, /Ceará/);
  for (const uf of ['RJ', 'SP', undefined]) assert.equal(roundOptions(availability, 'senator', uf).decided, 'single-round');
  assert.deepEqual(roundOptions(availability, 'governor').rounds, ['1'], 'Cargo estadual sem UF: o 2º turno depende da UF');
  assert.deepEqual(roundOptions(availability, 'governor', 'ZZ').rounds, ['1']);
  // UF sem publicação: nada é presumido além da regra do cargo.
  assert.deepEqual(roundOptions(availability, 'governor', 'BA'), { rounds: ['1', '2'], note: null, decided: null });
  // Publicação antiga sem `rounds` não vira turno único.
  assert.deepEqual(availabilityFromCatalog([{ office: 'president', level: 'national' }]).president?.BR, ['1', '2']);
  assert.deepEqual(roundOptions({}, 'president').rounds, ['1', '2']);

  const single = renderToStaticMarkup(createElement(TurnField, { value: '1', errors: [], rounds: ['1'], note: 'Turno único.' }));
  assert.equal((single.match(/type="radio"/g) ?? []).length, 1);
  assert.match(single, /aria-describedby="round-hint"/); assert.match(single, /id="round-hint"/);
});

test('cargo em opções visíveis: radios nativos, valor inválido preservado e dica associada', () => {
  const choices = [{ value: 'president', label: 'Presidência' }, { value: 'governor', label: 'Governador' }, { value: 'senator', label: 'Senador' }];
  const html = renderToStaticMarkup(createElement(OfficeField, { value: 'senator', errors: [], choices, hint: 'Cargo estadual.' }));
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  assert.match(html, /id="office-senator"[^>]*checked=""|checked=""[^>]*id="office-senator"/);
  assert.match(html, /aria-describedby="office-hint"/); assert.match(html, /<legend>Cargo<\/legend>/);
  const invalid = renderToStaticMarkup(createElement(OfficeField, { value: 'deputies', errors: [{ field: 'office', message: 'Escolha um cargo.' }], choices, hint: 'Cargo estadual.' }));
  assert.match(invalid, /Cargo informado: deputies/); assert.match(invalid, /id="office-error"/); assert.match(invalid, /data-count="4"/);
});

test('destaque das sugestões ignora acentos na comparação, mas preserva o nome original', async () => {
  const { highlightParts, normalizeSearch } = await import('../lib/suggest');
  assert.equal(normalizeSearch('  São   JOÃO '), ' sao joao ');
  assert.deepEqual(highlightParts('SÃO JOÃO DEL REI', 'joao'), [{ text: 'SÃO ', match: false }, { text: 'JOÃO', match: true }, { text: ' DEL REI', match: false }]);
  assert.deepEqual(highlightParts('JABOATÃO DOS GUARARAPES', 'jabo'), [{ text: 'JABO', match: true }, { text: 'ATÃO DOS GUARARAPES', match: false }]);
  // Grafia parecida (sem trecho exato): nada é marcado.
  assert.deepEqual(highlightParts('JABOATÃO DOS GUARARAPES', 'jaboatau'), [{ text: 'JABOATÃO DOS GUARARAPES', match: false }]);
  assert.deepEqual(highlightParts("SANTA BÁRBARA D'OESTE", "d'oeste"), [{ text: 'SANTA BÁRBARA ', match: false }, { text: "D'OESTE", match: true }]);
});
