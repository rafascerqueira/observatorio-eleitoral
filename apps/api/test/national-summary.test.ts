import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nationalSummary } from '../src/elections/national-summary';

const municipality = (code: string, votes: number, otherVotes: number) => ({
  code, uf: 'SP', name: `Município ${code}`, electionCode: '544', round: '1', zones: 1, sections: 2, pollingPlaces: 1,
  nonInstalledSections: 0,
  totals: { eligible: votes + otherVotes + 10, turnout: votes + otherVotes, abstentions: 10, nonInstalledEligible: 0,
    valid: votes + otherVotes, blank: 0, null: 0, totalVotes: votes + otherVotes },
  candidates: [{ number: '13', name: 'Candidato A', party: 'A', votes, percentValid: 99 },
    { number: '22', name: 'Candidato B', party: 'B', votes: otherVotes, percentValid: 1 }],
});
test('Brasil soma todos os municípios e recalcula percentuais ponderados pelos votos', () => {
  const result = nationalSummary([municipality('00001', 90, 10), municipality('00002', 1, 9)], '1');
  assert.equal(result.municipalities, 2);
  assert.equal(result.totals.valid, 110);
  assert.equal(result.totals.eligible, 130);
  assert.equal(result.candidates[0].votes, 91);
  assert.equal(result.candidates[0].percentValid, 91 / 110 * 100);
  assert.equal(result.sections, 4);
});
test('dados ausentes não viram zero e denominador zero permanece nulo', () => {
  const missing = municipality('00001', 0, 0);
  const result = nationalSummary([{ ...missing, nonInstalledSections: undefined,
    totals: { ...missing.totals, eligible: null, nonInstalledEligible: undefined } }], '1');
  assert.equal(result.totals.eligible, null);
  assert.equal(result.totals.nonInstalledEligible, null);
  assert.equal(result.nonInstalledSections, null);
  assert.ok(result.candidates.every((candidate) => candidate.percentValid === null));
});
test('seções não instaladas continuam separadas da abstenção no consolidado', () => {
  const item = municipality('02550', 100, 20);
  const result = nationalSummary([{ ...item, nonInstalledSections: 1,
    totals: { ...item.totals, eligible: item.totals.eligible + 84, nonInstalledEligible: 84 } }], '1');
  assert.equal(result.totals.nonInstalledEligible, 84);
  assert.equal(result.totals.abstentions, 10);
  assert.equal(result.nonInstalledSections, 1);
});
test('agregação rejeita duplicatas, turno errado, identidade conflitante e totais divergentes', () => {
  const item = municipality('00001', 1, 1);
  assert.throws(() => nationalSummary([], '1'));
  assert.throws(() => nationalSummary([item, item], '1'));
  assert.throws(() => nationalSummary([item], '2'));
  assert.throws(() => nationalSummary([{ ...item, candidates: [...item.candidates, item.candidates[0]] }], '1'));
  const conflict = municipality('00002', 1, 1);
  conflict.candidates[0].name = 'Outra identidade';
  assert.throws(() => nationalSummary([item, conflict], '1'));
  assert.throws(() => nationalSummary([{ ...item, totals: { ...item.totals, valid: 3 } }], '1'));
});
test('exterior só entra explicitamente; Brasil conserva 5570 como contagem doméstica e expõe a origem das seções não instaladas', () => {
  const domestic = municipality('02550', 100, 20);
  const exterior = { ...municipality('02550', 10, 5), uf: 'ZZ' };
  assert.throws(() => nationalSummary([domestic, exterior], '1'));
  const result = nationalSummary([domestic, { ...exterior, nonInstalledSections: 1, totals: { ...exterior.totals, eligible: exterior.totals.eligible + 3, nonInstalledEligible: 3 } }], '1', true);
  assert.equal(result.municipalities, 1); assert.equal(result.exteriorCities, 1); assert.equal(result.totals.valid, 135);
  assert.deepEqual(result.nonInstalledCases, [{ uf: 'ZZ', code: '02550', name: 'Município 02550', electors: 3, sections: 1 }]);
  assert.equal(result.candidates[0]!.percentValid, 110 / 135 * 100);
});
test('votos não válidos somam por categoria fora dos válidos; versão sem a categoria gera nulo, não zero', () => {
  const withNonValid = (code: string) => {
    const base = municipality(code, 6, 4);
    return { ...base, totals: { ...base.totals, turnout: 15, totalVotes: 15, eligible: 25, null: 3, annulled: 2, annulledSubJudice: 0, technicalNull: 1 },
      nonValidVotes: [{ number: '30', name: 'Anulada', party: 'X', category: 'annulled', nameSource: 'nominal', detail: 'INDEFERIDO', votes: 2 },
        { number: '22', name: 'TECNICO', party: null, category: 'technical-null', nameSource: 'section', detail: null, votes: 1 }] };
  };
  const result = nationalSummary([withNonValid('00001'), withNonValid('00002')], '1');
  assert.equal(result.totals.annulled, 4); assert.equal(result.totals.technicalNull, 2); assert.equal(result.totals.totalVotes, 30);
  assert.equal(result.candidates.reduce((sum, item) => sum + item.votes, 0), result.totals.valid);
  assert.deepEqual(result.nonValidVotes?.map((item) => [item.number, item.votes]), [['30', 4], ['22', 2]]);
  const mixed = nationalSummary([municipality('00001', 9, 1), municipality('00002', 1, 9)], '1');
  assert.equal(mixed.totals.annulled, null); assert.equal(mixed.nonValidVotes, undefined);
  const broken = withNonValid('00003'); broken.totals.annulled = 1;
  assert.throws(() => nationalSummary([broken], '1'));
});
