import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importWithoutCoverage, scopeLabel } from '../lib/import-scopes';

test('cargos pelo nome e território; publicações sem cobertura por cargo pelo nome da própria seção', () => {
  assert.equal(scopeLabel('2022/president/BR'), 'Presidência 2022 — municípios das 27 UFs');
  assert.equal(scopeLabel('2022/president/ZZ'), 'Presidência 2022 — exterior');
  assert.equal(scopeLabel('2022/governor/SP'), 'Governador 2022 — SP');
  assert.equal(scopeLabel('2022/context/municipal'), 'Contexto municipal 2022 — Censo 2022 (IBGE) e perfis do TSE');
  assert.equal(scopeLabel('2022/context/income-bands'), 'Moradores por faixa de renda do setor 2022 (IBGE)');
  assert.equal(scopeLabel('2022/proposals/president'), 'Propostas de governo da Presidência 2022 (TSE)');
});

test('só o piloto publicado declara São Paulo reconciliado; as demais publicações sem cobertura remetem à seção própria', () => {
  assert.deepEqual(importWithoutCoverage('2022/president/SP/71072', true), { kind: 'pilot' });
  assert.deepEqual(importWithoutCoverage('2022/president/SP/71072', false), { kind: 'none' }, 'Piloto não publicado não é declarado reconciliado');
  assert.deepEqual(importWithoutCoverage('2022/proposals/president', true), { kind: 'section', label: 'Propostas de governo da Presidência 2022 (TSE)', href: '#propostas' });
  assert.deepEqual(importWithoutCoverage('2022/places/groups', true), { kind: 'section', label: 'Grupos de locais de votação 2022 (métrica E)', href: '/metodologia#perfis' });
  assert.deepEqual(importWithoutCoverage('2022/proposals/president', false), { kind: 'none' }, 'Seção só existe para a versão publicada');
  for (const scope of ['2022/president/BR', '2022/governor/SP', '2022/context/novo']) assert.deepEqual(importWithoutCoverage(scope, true), { kind: 'none' }, scope);
});
