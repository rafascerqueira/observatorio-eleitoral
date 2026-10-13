// Dados exclusivamente sintéticos para verificar invariantes; não são publicados.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { count, type Row } from '../src/csv';
import { reconcile, reconcileExterior, sectionVote } from '../src/model';
import { percent } from '@observatorio/contracts';

function fixture() {
  const details: Row[] = [], nominal: Row[] = [], sections = [];
  for (const round of ['1', '2']) {
    const base = { NR_TURNO: round, CD_ELEICAO: round === '1' ? '544' : '545', CD_TIPO_ELEICAO: '2', NR_ZONA: '1', ST_VOTO_EM_TRANSITO: 'N' };
    details.push({ ...base, QT_APTOS: '20', QT_COMPARECIMENTO: '13', QT_ABSTENCOES: '7', QT_TOTAL_VOTOS_VALIDOS: '10', QT_VOTOS_BRANCOS: '1', QT_TOTAL_VOTOS_NULOS: '2', QT_VOTOS: '13', QT_SECOES_PRINCIPAIS: '2', QT_TOTAL_VOTOS_ANULADOS: '0', QT_TOTAL_VOTOS_ANUL_SUBJUD: '0', QT_VOTOS_ANULADOS_APU_SEP: '0', QT_VOTOS_NULOS_TECNICOS: '0', QT_TOTAL_VOTOS_LEG_VALIDOS: '0', QT_SECOES_NAO_INSTALADAS: '0', QT_ELEITORES_SECOES_NAO_INSTALADAS: '0' });
    for (const [number, votes] of [['10', '6'], ['20', '4']]) nominal.push({ ...base, NR_CANDIDATO: number!, NM_URNA_CANDIDATO: `Candidatura teste ${number}`, SG_PARTIDO: 'TESTE', QT_VOTOS_NOMINAIS: votes!, QT_VOTOS_NOMINAIS_VALIDOS: votes!, NM_TIPO_DESTINACAO_VOTOS: 'Válido' });
    for (const section of ['1', '2']) for (const [number, votes] of [['10', '3'], ['20', '2'], ['95', section === '1' ? '1' : '0'], ['96', '1']]) sections.push(sectionVote({ ...base, NR_SECAO: section, NR_LOCAL_VOTACAO: '100', NR_VOTAVEL: number!, QT_VOTOS: votes!, NM_LOCAL_VOTACAO: 'Local de teste', DS_LOCAL_VOTACAO_ENDERECO: '#NULO' }));
  }
  return { details, nominal, sections };
}
test('exterior sem seções instaladas publica somente zeros confirmados, sem inventar linhas de seção', () => {
  const f = fixture();
  for (const row of f.details) {
    Object.assign(row, { SG_UF: 'ZZ', CD_MUNICIPIO: '39187', QT_APTOS: '3', QT_COMPARECIMENTO: '0', QT_ABSTENCOES: '0', QT_TOTAL_VOTOS_VALIDOS: '0', QT_VOTOS_BRANCOS: '0', QT_TOTAL_VOTOS_NULOS: '0', QT_VOTOS: '0', QT_SECOES_PRINCIPAIS: '3', QT_SECOES_NAO_INSTALADAS: '3', QT_ELEITORES_SECOES_NAO_INSTALADAS: '3' });
  }
  for (const row of f.nominal) Object.assign(row, { SG_UF: 'ZZ', CD_MUNICIPIO: '39187', QT_VOTOS_NOMINAIS: '0', QT_VOTOS_NOMINAIS_VALIDOS: '0' });
  const result = reconcileExterior(f.details, f.nominal, [], { code: '39187', name: 'Localidade sintética' });
  assert.equal(result.summaries.length, 2); assert.equal(result.places.length, 0);
  assert.equal(result.summaries[0]!.uf, 'ZZ'); assert.equal(result.summaries[0]!.sections, 0);
  assert.equal(result.summaries[0]!.totals.nonInstalledEligible, 3);
  assert.equal(result.summaries[0]!.totals.abstentions, 0);
  assert.ok(result.summaries[0]!.candidates.every((candidate) => candidate.percentValid === null));
  assert.throws(() => reconcileExterior(f.details, [], [], { code: '39187', name: 'Teste' }), /incompleto/);
  f.details[0]!.QT_SECOES_NAO_INSTALADAS = '2';
  assert.throws(() => reconcileExterior(f.details, f.nominal, [], { code: '39187', name: 'Teste' }), /sem votos/);
  f.details[0]!.NR_ZONA = '2';
  assert.throws(() => reconcileExterior(f.details, f.nominal, [], { code: '39187', name: 'Teste' }), /Zona do exterior/);
});
test('agregação preserva denominadores e não fabrica participação por local', () => {
  const f = fixture();
  const result = reconcile(f.details, f.nominal, f.sections);
  assert.equal(result.summaries[0]?.totals.eligible, 20);
  assert.equal(result.summaries[0]?.candidates[0]?.percentValid, 60);
  assert.equal(result.places[0]?.totals.eligible, null);
  assert.equal(result.places[0]?.totals.turnout, null);
  assert.equal(result.places[0]?.address, null);
  assert.equal(result.summaries[0]?.sections, 2);
  assert.equal(percent(0, 0), null);
});
test('contagens ausentes e sentinelas são rejeitadas, sem virar zero', () => {
  for (const value of ['-1', '-3', '#NULO', '', '1.1', 'texto']) assert.throws(() => count({ QT_VOTOS: value }, 'QT_VOTOS'));
  assert.throws(() => count({}, 'QT_VOTOS'));
});
test('divergências de nome não escolhem um valor arbitrário nem alteram votos', () => {
  const f = fixture(); f.sections[0]!.name = 'Outro nome de teste';
  const result = reconcile(f.details, f.nominal, f.sections);
  assert.equal(result.places[0]?.name, null);
  assert.equal(result.places[0]?.metadataConflict, true);
  assert.equal(result.places[0]?.metadataVariants.length, 2);
  assert.equal(result.places[0]?.totals.valid, 10);
});
test('duplicatas e diferença contra total oficial impedem publicação', () => {
  let f = fixture();
  f.sections.push({ ...f.sections[0]! });
  assert.throws(() => reconcile(f.details, f.nominal, f.sections), /duplicado/);
  f = fixture(); f.sections[0]!.votes++;
  assert.throws(() => reconcile(f.details, f.nominal, f.sections), /Publicação bloqueada/);
  f = fixture(); f.details[0]!.QT_APTOS = '21';
  assert.throws(() => reconcile(f.details, f.nominal, f.sections), /aptos/);
});
test('zonas e seções iguais em municípios distintos são reconciliadas separadamente', () => {
  const a = fixture(), b = fixture();
  for (const row of [...b.details, ...b.nominal]) { row.SG_UF = 'RJ'; row.CD_MUNICIPIO = '60011'; row.CD_CARGO = '1'; }
  for (const vote of b.sections) { vote.uf = 'RJ'; vote.municipalityCode = '60011'; }
  const resultA = reconcile(a.details, a.nominal, a.sections);
  const resultB = reconcile(b.details, b.nominal, b.sections, { code: '60011', name: 'Município teste', uf: 'RJ' });
  assert.equal(resultA.summaries[0]?.uf, 'SP');
  assert.equal(resultB.summaries[0]?.code, '60011');
  assert.deepEqual(resultA.summaries[0]?.totals, resultB.summaries[0]?.totals);
  assert.throws(() => reconcile(b.details, b.nominal, b.sections), /Mistura de territórios/);
  assert.throws(() => reconcile(a.details, a.nominal, [...a.sections, ...b.sections]), /Mistura de territórios/);
});
test('trânsito e seções não instaladas não são ignorados para forçar publicação', () => {
  let f = fixture(); f.details[0]!.ST_VOTO_EM_TRANSITO = 'S';
  assert.throws(() => reconcile(f.details, f.nominal, f.sections), /trânsito/);
  f = fixture(); f.details[0]!.QT_SECOES_NAO_INSTALADAS = '1';
  assert.throws(() => reconcile(f.details, f.nominal, f.sections), /QT_SECOES_NAO_INSTALADAS/);
});
test('regra nacional preserva eleitores de seções não instaladas, sem convertê-los em abstenção', () => {
  const f = fixture();
  for (const row of f.details) { row.QT_APTOS = '104'; row.QT_SECOES_PRINCIPAIS = '3'; row.QT_SECOES_NAO_INSTALADAS = '1'; row.QT_ELEITORES_SECOES_NAO_INSTALADAS = '84'; }
  const result = reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: true });
  assert.equal(result.summaries[0]?.totals.eligible, 104);
  assert.equal(result.summaries[0]?.totals.abstentions, 7);
  assert.equal(result.summaries[0]?.totals.nonInstalledEligible, 84);
  assert.equal(result.summaries[0]?.sections, 2);
  assert.equal(result.summaries[0]?.nonInstalledSections, 1);
  assert.equal(result.places[0]?.totals.nonInstalledEligible, null);
  f.details[0]!.QT_ELEITORES_SECOES_NAO_INSTALADAS = '83';
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: true }), /aptos/);
});
