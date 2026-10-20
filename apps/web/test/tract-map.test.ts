import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tractMapSchema } from '@observatorio/contracts';
import { BAND_COLORS, NO_BAND, childViews, parentView, tractMapSvg, viewTrail } from '../lib/tract-map';

// Vistas e setores sintéticos (códigos de formato real, desenho fictício).
const view = (id: string, level: 'municipality' | 'district' | 'subdistrict', split = false) => ({ id, level, name: level === 'municipality' ? null : `Parte ${id}`, tracts: 2, split, oversize: split });
const data = tractMapSchema.parse({ status: 'published', displayBatchId: 'a'.repeat(64), incomeBatchId: 'b'.repeat(64), associationBatchId: 'c'.repeat(64),
  views: [view('3550308', 'municipality')], view: { ...view('3550308', 'municipality'), width: 600, height: 400 },
  legend: { bands: [1, 2, 3, 4, 5].map((index) => ({ index, tracts: index === 2 ? 1 : 0, residents: index === 2 ? 50 : 0 })), noData: { tracts: 0, residents: 0 }, undisclosed: { tracts: 1 }, missing: { tracts: 0 } },
  tracts: [{ code: '355030807000234', status: 'band', band: 2, simplified: true, path: 'M 1 1 l 2 0 0 2 z' }, { code: '355030807000235', status: 'undisclosed', band: null, simplified: true, path: 'M 5 5 l 1 0 0 1 z' }],
  places: [{ zone: 1, code: '1015', name: 'Escola <A&B>', status: 'associated', tract: '355030807000234', band: 2, electors: 10, x: 2, y: 2 },
    { zone: 1, code: '1023', name: null, status: 'outside-tracts', tract: null, band: null, electors: 10, x: 9, y: 9 },
    { zone: 1, code: '1031', name: null, status: 'no-coordinate', tract: null, band: null, electors: 10, x: null, y: null }] });

test('imagem do mapa: setores pela faixa (sem faixa em tom neutro), pontos cheios/vazados e texto escapado', () => {
  if (data.status !== 'published') throw new Error('fixture');
  const svg = tractMapSvg(data, 'Mapa <teste> & "aspas"');
  assert.match(svg, new RegExp(`<path fill="${BAND_COLORS[1]}" d="M 1 1 l 2 0 0 2 z"/>`));
  assert.match(svg, new RegExp(`<path fill="${NO_BAND}" d="M 5 5 l 1 0 0 1 z"/>`), 'Setor omitido não recebe cor de faixa');
  assert.equal((svg.match(/<circle /g) ?? []).length, 2, 'Local sem coordenada fica só na tabela');
  assert.match(svg, /cx="2" cy="2" r="3.2" class="associated"/); assert.match(svg, /cx="9" cy="9" r="3.2" class="unassociated"/);
  assert.match(svg, /aria-label="Mapa &lt;teste&gt; &amp; &quot;aspas&quot;"/);
  assert.doesNotMatch(svg, /Escola/, 'Nomes dos locais ficam na tabela da página');
});

test('navegação entre vistas: pai mais próximo, filhos imediatos e trilha do município até a vista', () => {
  const views = [view('3304557', 'municipality', true), view('330455705', 'district', true), view('33045570506', 'subdistrict'), view('33045570507', 'subdistrict')];
  assert.equal(parentView(views, views[2]!)?.id, '330455705');
  assert.equal(parentView(views, views[0]!), null);
  assert.deepEqual(childViews(views, views[0]!).map((item) => item.id), ['330455705']);
  assert.deepEqual(childViews(views, views[1]!).map((item) => item.id), ['33045570506', '33045570507']);
  assert.deepEqual(viewTrail(views, views[3]!).map((item) => item.id), ['3304557', '330455705', '33045570507']);
  // Município com um só distrito dividido direto em subdistritos (como Rio e Brasília).
  const direct = [view('5300108', 'municipality', true), view('53001080501', 'subdistrict'), view('53001080502', 'subdistrict')];
  assert.deepEqual(childViews(direct, direct[0]!).map((item) => item.id), ['53001080501', '53001080502']);
});
