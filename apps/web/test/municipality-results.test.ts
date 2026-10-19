import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MunicipalityResult } from '@observatorio/contracts';
import { MunicipalityResults } from '../components/municipality-results';
// Apenas fixture sintética; verifica candidaturas empatadas, não válidos, campos opcionais ausentes e denominador zero.
test('visão compacta mantém todas as candidaturas, inclusive empate e zero; detalhes são nativos sem JavaScript', () => {
  const item: MunicipalityResult = { code: '02550', uf: 'AM', name: 'Município sintético', electionCode: '544', round: '1', zones: 1, sections: 1, pollingPlaces: 1,
    totals: { eligible: 0, turnout: 0, abstentions: 0, valid: 0, blank: 0, null: 0, totalVotes: 0 },
    candidates: [{ number: '10', name: 'Teste A', party: 'A', votes: 0, percentValid: null }, { number: '20', name: 'Teste B', party: 'B', votes: 0, percentValid: null }] };
  const html = renderToStaticMarkup(createElement(MunicipalityResults, { items: [item], href: (code, uf) => `/municipios/${code}?uf=${uf}` }));
  assert.match(html, /municipios\/02550\?uf=AM/); assert.match(html, /Teste A/); assert.match(html, /Teste B/); assert.match(html, /<details/); assert.match(html, /<summary/); assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /Indisponível/); assert.doesNotMatch(html, /100,00%/); assert.doesNotMatch(html, /Nulos técnicos/);
  const older = renderToStaticMarkup(createElement(MunicipalityResults, { items: [{ ...item, totals: { ...item.totals, totalVotes: 10, annulled: null } }], href: () => '#' }));
  assert.match(older, /<dt>Anulados<\/dt><dd>Indisponível<span class="source-note cell-count">Indisponível do total/);
});
