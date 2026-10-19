import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CANDIDATE_MAP_CUTS, mapPageQuerySchema, type CandidateMap, type MapValues } from '@observatorio/contracts';
import { candidateSeries, csvPercent, csvText, joinSeries, MAP_CSV_COLUMNS, mapCsv, mapCsvName, resolveSeries } from '../lib/map-series';
import { axisMax, axisTicks, diameter, Scatter } from '../components/scatter';

// Recortes sintéticos (valores fictícios), só para as regras de série, junção e exportação.
const ids = { results: 'a'.repeat(64), context: 'b'.repeat(64) };
const publications = [{ role: 'results' as const, id: ids.results }, { role: 'context' as const, id: ids.context }];
const candidates: CandidateMap = { status: 'published', office: 'governor', round: '1', level: 'municipality', uf: 'SP', publications,
  candidates: [{ number: '10', name: 'Candidatura A', party: 'P1', votes: 30, percentValid: 60 }, { number: '13', name: 'Candidatura B', party: 'P2', votes: 20, percentValid: 40 }],
  items: [{ id: '3550308', code: '71072', uf: 'SP', name: 'São Paulo', valid: 50, votes: [30, 20] }, { id: '3500105', code: '61018', uf: 'SP', name: 'Sem válidos', valid: 0, votes: [0, 0] }] };
const abstention: MapValues = { status: 'published', indicator: 'abstention', level: 'municipality', round: '1', office: 'governor', publications,
  items: [{ id: '3550308', code: '71072', uf: 'SP', name: 'São Paulo', numerator: 20, denominator: 100, value: 20 }] };
const filters = mapPageQuerySchema.parse({ office: 'governor', uf: 'SP' });

test('candidatura vira série com os válidos da unidade; sem válidos não vira zero', () => {
  const series = candidateSeries(candidates, 1);
  assert.deepEqual(series[0], { id: '3550308', code: '71072', uf: 'SP', name: 'São Paulo', numerator: 20, denominator: 50, value: 40 });
  assert.equal(series[1]!.value, null); assert.equal(series[1]!.numerator, 0);
});

test('série padrão é a abstenção; candidatura fora do recorte, turno não realizado e falha técnica têm estados próprios', () => {
  const ready = resolveSeries(filters, candidates, abstention);
  assert.equal(ready.status, 'ready');
  if (ready.status === 'ready') { assert.equal(ready.series.kind, 'abstention'); assert.equal(ready.series.cuts, undefined, 'Abstenção em quintis'); assert.equal(ready.series.resultsId, ids.results); assert.match(ready.series.title, /Governador, 1º turno/); }
  const candidate = resolveSeries({ ...filters, series: '13' }, candidates, null);
  assert.equal(candidate.status, 'ready');
  if (candidate.status === 'ready') { assert.equal(candidate.series.cuts, CANDIDATE_MAP_CUTS, 'Mesma escala fixa de “Votação por candidatura”'); assert.equal(candidate.series.weight, 'votos válidos'); assert.equal(candidate.series.items[0]!.value, 40); }
  assert.equal(resolveSeries({ ...filters, series: '99' }, candidates, null).status, 'unknown-candidate');
  assert.equal(resolveSeries({ ...filters, series: '13' }, { ...candidates, status: 'round-not-held', candidates: [], items: [] }, null).status, 'round-not-held');
  assert.equal(resolveSeries(filters, null, { ...abstention, status: 'round-not-held', items: [] }).status, 'round-not-held');
  assert.equal(resolveSeries(filters, candidates, null).status, 'unavailable');
  assert.equal(resolveSeries({ ...filters, series: '13' }, null, abstention).status, 'unavailable');
});

test('junção pelo código IBGE mantém as unidades do Censo e deixa sem valor a que falta na série', () => {
  const census = [abstention.items[0]!, { id: '3500105', code: '61018', uf: 'SP' as const, name: 'Outro', numerator: 1, denominator: 2, value: 50 }];
  const rows = joinSeries(census, abstention.items);
  assert.equal(rows.length, 2); assert.equal(rows[0]!.series?.value, 20); assert.equal(rows[1]!.series, null);
});

test('CSV: BOM, separador ponto e vírgula, vírgula decimal, contagens como publicadas, versões e texto sem fórmula', () => {
  assert.equal(csvText('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`); assert.equal(csvText('São Paulo'), 'São Paulo'); assert.equal(csvText('A; B'), '"A; B"');
  assert.equal(csvPercent(12.345678), '12,3457'); assert.equal(csvPercent(null), ''); assert.equal(csvPercent(1234.5), '1234,5000');
  const ready = resolveSeries(filters, candidates, abstention);
  assert.equal(ready.status, 'ready'); if (ready.status !== 'ready') return;
  const census = [{ ...abstention.items[0]!, numerator: 9, denominator: 10, value: 90 }, { id: '3500105', code: '61018', uf: 'SP' as const, name: 'Sem dado', numerator: null, denominator: 5, value: null }];
  const csv = mapCsv(joinSeries(census, ready.series.items), 'Indicador sintético', ready.series, ids.context);
  assert.ok(csv.startsWith('﻿')); assert.ok(csv.endsWith('\r\n'));
  const [header, first, second] = csv.slice(1).trimEnd().split('\r\n');
  assert.deepEqual(header!.split(';'), [...MAP_CSV_COLUMNS]);
  assert.deepEqual(first!.split(';'), ['SP', '71072', '3550308', 'São Paulo', 'Indicador sintético', '9', '10', '90,0000', 'Abstenção — Governador, 1º turno', '20', '100', '20,0000', ids.context, ids.results]);
  assert.deepEqual(second!.split(';').slice(5, 12), ['', '5', '', 'Abstenção — Governador, 1º turno', '', '', ''], 'Nulo e unidade ausente da série ficam vazios, nunca zero');
  assert.equal(mapCsvName({ ...filters, series: '13' }), 'mapa-2022-1turno-SP-income-upto-half-mw-candidatura-13-governor.csv');
});

test('dispersão: eixos a partir de zero com limites redondos, área proporcional ao peso e pontos fora do gráfico declarados', () => {
  assert.equal(axisMax([]), 10); assert.equal(axisMax([3]), 10); assert.equal(axisMax([45]), 50); assert.equal(axisMax([55]), 60); assert.equal(axisMax([100]), 100);
  assert.deepEqual(axisTicks(60), [0, 20, 40, 60]); assert.deepEqual(axisTicks(30), [0, 10, 20, 30]);
  assert.equal(diameter(400, 400), 28); assert.equal(diameter(100, 400), 14, 'Um quarto do peso, metade do diâmetro'); assert.equal(diameter(1, 400), 8); assert.equal(diameter(0, 0), 8);
  const html = renderToStaticMarkup(createElement(Scatter, { points: [{ id: '1', name: 'A', x: 10, y: 20, weight: 1, detail: 'A' }, { id: '2', name: 'B', x: 40, y: 30, weight: 9, detail: 'B' }],
    excluded: 2, title: 'Teste', description: 'Descrição', xLabel: 'X', yLabel: 'Y', unit: 'município' }));
  assert.equal((html.match(/class="scatter-dot"/g) ?? []).length, 2); assert.match(html, /class="scatter" aria-hidden="true"/); assert.match(html, /tabela dos mapas/);
  assert.ok(html.indexOf('data-label="B"') < html.indexOf('data-label="A"'), 'Ponto maior desenhado antes do menor');
  assert.match(html, /2 unidades sem um dos dois valores ficam fora do gráfico/);
  assert.doesNotMatch(html, /tendência|correla/i);
});
