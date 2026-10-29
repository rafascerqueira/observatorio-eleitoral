// Dados exclusivamente sintéticos para verificar invariantes; não são publicados.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { count, type Row } from '../src/csv';
import { GOVERNOR_2022, GOVERNOR_2026, PRESIDENT_2026, SENATOR_2022, SENATOR_2026, SCOPES, reconcile, reconcileExterior, sectionVote, type ElectionScope } from '../src/model';
import { nationalSources, SOURCES, stateSources } from '../src/sources';
import { percent } from '@observatorio/contracts';

function fixture(scope?: ElectionScope) {
  const details: Row[] = [], nominal: Row[] = [], sections = [];
  for (const round of ['1', '2'] as const) {
    const base = { NR_TURNO: round, CD_ELEICAO: scope ? scope.electionCodes[round]! : round === '1' ? '544' : '545', CD_TIPO_ELEICAO: '2', NR_ZONA: '1', ST_VOTO_EM_TRANSITO: 'N', ...(scope ? { CD_CARGO: scope.cargo } : {}) };
    details.push({ ...base, QT_APTOS: '20', QT_COMPARECIMENTO: '13', QT_ABSTENCOES: '7', QT_TOTAL_VOTOS_VALIDOS: '10', QT_VOTOS_BRANCOS: '1', QT_TOTAL_VOTOS_NULOS: '2', QT_VOTOS: '13', QT_SECOES_PRINCIPAIS: '2', QT_TOTAL_VOTOS_ANULADOS: '0', QT_TOTAL_VOTOS_ANUL_SUBJUD: '0', QT_VOTOS_ANULADOS_APU_SEP: '0', QT_VOTOS_NULOS_TECNICOS: '0', QT_TOTAL_VOTOS_LEG_VALIDOS: '0', QT_SECOES_NAO_INSTALADAS: '0', QT_ELEITORES_SECOES_NAO_INSTALADAS: '0', QT_VOTOS_NULOS: '2', QT_VOTOS_NOMINAIS_ANULADOS: '0', QT_VOTOS_NOMINAIS_ANUL_SUBJUD: '0', QT_VOTOS_LEGENDA_ANULADOS: '0', QT_VOTOS_LEGENDA_ANUL_SUBJUD: '0' });
    for (const [number, votes] of [['10', '6'], ['20', '4']]) nominal.push({ ...base, NR_CANDIDATO: number!, NM_URNA_CANDIDATO: `Candidatura teste ${number}`, SG_PARTIDO: 'TESTE', QT_VOTOS_NOMINAIS: votes!, QT_VOTOS_NOMINAIS_VALIDOS: votes!, NM_TIPO_DESTINACAO_VOTOS: 'Válido' });
    for (const section of ['1', '2']) for (const [number, votes] of [['10', '3'], ['20', '2'], ['95', section === '1' ? '1' : '0'], ['96', '1']]) sections.push(sectionVote({ ...base, NR_SECAO: section, NR_LOCAL_VOTACAO: '100', NR_VOTAVEL: number!, QT_VOTOS: votes!, NM_LOCAL_VOTACAO: 'Local de teste', DS_LOCAL_VOTACAO_ENDERECO: '#NULO' }, scope));
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
test('governador usa eleições e cargo próprios, sem aceitar linhas da Presidência', () => {
  const f = fixture(GOVERNOR_2022);
  const result = reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: GOVERNOR_2022 });
  assert.deepEqual(result.summaries.map((summary) => [summary.round, summary.electionCode]), [['1', '546'], ['2', '547']]);
  assert.equal(result.summaries[0]?.totals.valid, 10);
  // Mesmos números com cargo/eleição da Presidência não podem ser publicados como governador.
  const president = fixture();
  assert.throws(() => reconcile(president.details, president.nominal, president.sections, undefined, { allowNonInstalled: false, scope: GOVERNOR_2022 }), /escopo auditado/);
  assert.throws(() => reconcile(f.details, f.nominal, f.sections), /Mistura de territórios\/cargos/);
  assert.throws(() => sectionVote({ ...f.details[0]!, CD_CARGO: '1', NR_SECAO: '1', NR_LOCAL_VOTACAO: '1', NR_VOTAVEL: '10', QT_VOTOS: '1' }, GOVERNOR_2022), /Cargo fora/);
});
test('turno não previsto no recorte bloqueia em vez de ser descartado', () => {
  const f = fixture(GOVERNOR_2022);
  const oneRound = { ...GOVERNOR_2022, rounds: ['1'] as const };
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: oneRound }), /escopo auditado/);
  const first = (rows: Row[]) => rows.filter((row) => row.NR_TURNO === '1');
  const result = reconcile(first(f.details), first(f.nominal), f.sections.filter((vote) => vote.round === '1'), undefined, { allowNonInstalled: false, scope: oneRound });
  assert.deepEqual(result.summaries.map((summary) => summary.round), ['1']);
});
test('senador usa cargo 5 e eleição 546 em turno único; 2º turno e linhas do governador bloqueiam', () => {
  const f = fixture(GOVERNOR_2022);
  const senate = (rows: Row[]) => rows.map((row) => ({ ...row, CD_CARGO: '5' }));
  const first = (rows: Row[]) => rows.filter((row) => row.NR_TURNO === '1');
  const options = { allowNonInstalled: false, scope: SENATOR_2022 };
  const result = reconcile(senate(first(f.details)), senate(first(f.nominal)), f.sections.filter((vote) => vote.round === '1'), undefined, options);
  assert.deepEqual(result.summaries.map((summary) => [summary.round, summary.electionCode]), [['1', '546']]);
  assert.equal(result.summaries[0]?.totals.valid, 10);
  assert.throws(() => reconcile(senate(f.details), senate(f.nominal), f.sections, undefined, options), /escopo auditado/);
  assert.throws(() => reconcile(first(f.details), first(f.nominal), f.sections.filter((vote) => vote.round === '1'), undefined, options), /Mistura de territórios\/cargos/);
});

function withNonValid() {
  // Zona sintética: candidatura 30 anulada (nominal) e votável 22 nulo técnico (só nas seções).
  const f = fixture(GOVERNOR_2022);
  for (const row of f.details) Object.assign(row, { QT_COMPARECIMENTO: '17', QT_ABSTENCOES: '3', QT_VOTOS: '17', QT_TOTAL_VOTOS_NULOS: '4', QT_VOTOS_NULOS: '2', QT_VOTOS_NULOS_TECNICOS: '2', QT_TOTAL_VOTOS_ANULADOS: '2', QT_VOTOS_NOMINAIS_ANULADOS: '2', QT_VOTOS_NOMINAIS_ANUL_SUBJUD: '0', QT_VOTOS_LEGENDA_ANULADOS: '0', QT_VOTOS_LEGENDA_ANUL_SUBJUD: '0' });
  for (const round of ['1', '2'] as const) {
    const base = { NR_TURNO: round, CD_ELEICAO: GOVERNOR_2022.electionCodes[round]!, CD_TIPO_ELEICAO: '2', NR_ZONA: '1', ST_VOTO_EM_TRANSITO: 'N', CD_CARGO: '3' };
    f.nominal.push({ ...base, NR_CANDIDATO: '30', NM_URNA_CANDIDATO: 'Candidatura anulada teste', SG_PARTIDO: 'TESTE', QT_VOTOS_NOMINAIS: '2', QT_VOTOS_NOMINAIS_VALIDOS: '0', NM_TIPO_DESTINACAO_VOTOS: 'Anulado', DS_DETALHE_SITUACAO_CAND: 'INDEFERIDO' });
    for (const [number, name] of [['30', 'NOME COMPLETO ANULADO'], ['22', 'NOME COMPLETO TECNICO']]) f.sections.push(sectionVote({ ...base, NR_SECAO: '1', NR_LOCAL_VOTACAO: '100', NR_VOTAVEL: number!, NM_VOTAVEL: name!, QT_VOTOS: '1', NM_LOCAL_VOTACAO: 'Local de teste', DS_LOCAL_VOTACAO_ENDERECO: '#NULO' }, GOVERNOR_2022), sectionVote({ ...base, NR_SECAO: '2', NR_LOCAL_VOTACAO: '100', NR_VOTAVEL: number!, NM_VOTAVEL: name!, QT_VOTOS: '1', NM_LOCAL_VOTACAO: 'Local de teste', DS_LOCAL_VOTACAO_ENDERECO: '#NULO' }, GOVERNOR_2022));
  }
  return f;
}
test('anulados e nulos técnicos ficam fora dos válidos, reconciliados por zona e identificados', () => {
  const f = withNonValid();
  const result = reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: GOVERNOR_2022 });
  const summary = result.summaries[0]!;
  assert.deepEqual([summary.totals.valid, summary.totals.blank, summary.totals.null, summary.totals.annulled, summary.totals.technicalNull, summary.totals.totalVotes], [10, 1, 4, 2, 2, 17]);
  assert.equal(summary.candidates[0]?.percentValid, 60, 'Denominador continua sendo os válidos');
  assert.deepEqual(summary.nonValidVotes?.map((item) => [item.number, item.category, item.nameSource, item.votes]), [['22', 'technical-null', 'section', 2], ['30', 'annulled', 'nominal', 2]]);
  assert.equal(summary.nonValidVotes?.find((item) => item.number === '30')?.detail, 'INDEFERIDO');
  assert.ok(summary.candidates.every((candidate) => !['22', '30'].includes(candidate.number)));
  assert.equal(result.places[0]?.nonValidVotes?.length, 2);
  // Presidência não aceita a mesma regra: número desconhecido continua bloqueando.
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: { ...GOVERNOR_2022, nonValidVotes: false } }));
});
test('divergência em anulados ou nulos técnicos bloqueia em vez de reclassificar', () => {
  let f = withNonValid(); f.details[0]!.QT_VOTOS_NULOS_TECNICOS = '1'; f.details[0]!.QT_VOTOS_NULOS = '3';
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: GOVERNOR_2022 }), /technicalNull|nulos \(96\)/);
  f = withNonValid(); f.nominal.find((row) => row.NR_CANDIDATO === '30')!.QT_VOTOS_NOMINAIS_VALIDOS = '2';
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: GOVERNOR_2022 }), /Votos válidos de candidatura Anulado/);
  f = withNonValid(); f.nominal.find((row) => row.NR_CANDIDATO === '30')!.NM_TIPO_DESTINACAO_VOTOS = 'Válido (legenda)';
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: GOVERNOR_2022 }), /Destinação/);
  f = withNonValid(); f.details[0]!.QT_VOTOS_ANULADOS_APU_SEP = '1';
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: GOVERNOR_2022 }), /APU_SEP/);
  f = withNonValid(); f.sections.find((vote) => vote.number === '22')!.votableName = null;
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: false, scope: GOVERNOR_2022 }), /sem nome/);
});

test('Senado 2026: duas vagas, votos = 2 × comparecimento por zona; a regra de uma vaga bloqueia', () => {
  const f = fixture(GOVERNOR_2026);
  const first = (rows: Row[]): Row[] => rows.filter((row) => row.NR_TURNO === '1').map((row) => ({ ...row, CD_CARGO: '5' }));
  // Cada eleitor dá dois votos: o comparecimento (13) fica; votos, válidos, brancos e nulos dobram.
  const details = first(f.details).map((row) => ({ ...row, QT_VOTOS: '26', QT_TOTAL_VOTOS_VALIDOS: '20', QT_VOTOS_BRANCOS: '2', QT_TOTAL_VOTOS_NULOS: '4', QT_VOTOS_NULOS: '4' }));
  const nominal = first(f.nominal).map((row) => ({ ...row, QT_VOTOS_NOMINAIS: String(2 * Number(row.QT_VOTOS_NOMINAIS)), QT_VOTOS_NOMINAIS_VALIDOS: String(2 * Number(row.QT_VOTOS_NOMINAIS_VALIDOS)) }));
  const sections = f.sections.filter((vote) => vote.round === '1').map((vote) => ({ ...vote, votes: 2 * vote.votes }));
  const options = { allowNonInstalled: false, scope: SENATOR_2026 };
  const result = reconcile(details, nominal, sections, undefined, options);
  assert.deepEqual(result.summaries.map((summary) => [summary.round, summary.electionCode]), [['1', '6259']]);
  assert.deepEqual([result.summaries[0]!.totals.turnout, result.summaries[0]!.totals.totalVotes], [13, 26]);
  assert.equal(result.summaries[0]!.candidates[0]!.percentValid, 60, 'Percentual sobre os votos válidos, não sobre eleitores');
  assert.throws(() => reconcile(details, nominal, sections, undefined, { ...options, scope: { ...SENATOR_2026, seats: undefined } }), /comparecimento/);
  // Votos iguais ao comparecimento não fecham com duas vagas.
  assert.throws(() => reconcile(first(f.details), first(f.nominal), f.sections.filter((vote) => vote.round === '1'), undefined, options), /comparecimento/);
});
test('Presidência 2026: nulos técnicos reconciliados por zona; a regra de 2022 bloqueia', () => {
  const f = fixture(PRESIDENT_2026);
  for (const row of f.details) Object.assign(row, { QT_COMPARECIMENTO: '15', QT_ABSTENCOES: '5', QT_VOTOS: '15', QT_TOTAL_VOTOS_NULOS: '4', QT_VOTOS_NULOS: '2', QT_VOTOS_NULOS_TECNICOS: '2' });
  for (const round of ['1', '2'] as const) for (const section of ['1', '2']) {
    f.sections.push(sectionVote({ NR_TURNO: round, CD_ELEICAO: PRESIDENT_2026.electionCodes[round]!, CD_TIPO_ELEICAO: '2', CD_CARGO: '1', NR_ZONA: '1', NR_SECAO: section, NR_LOCAL_VOTACAO: '100', NR_VOTAVEL: '22', NM_VOTAVEL: 'NOME COMPLETO TECNICO', QT_VOTOS: '1', NM_LOCAL_VOTACAO: 'Local de teste', DS_LOCAL_VOTACAO_ENDERECO: '#NULO' }, PRESIDENT_2026));
  }
  const result = reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: true, scope: PRESIDENT_2026 });
  assert.deepEqual(result.summaries.map((summary) => [summary.round, summary.electionCode, summary.totals.technicalNull, summary.totals.null]), [['1', '6257', 2, 4], ['2', '6258', 2, 4]]);
  assert.deepEqual(result.summaries[0]!.nonValidVotes?.map((item) => [item.number, item.category, item.votes]), [['22', 'technical-null', 2]]);
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: true, scope: { ...PRESIDENT_2026, nonValidVotes: false } }), /NULOS_TECNICOS|não auditado/);
  // Linhas de 2026 não passam pelo recorte de 2022, nem o contrário.
  assert.throws(() => reconcile(f.details, f.nominal, f.sections, undefined, { allowNonInstalled: true }), /escopo auditado/);
});
test('fontes por ano: 2022 mantém os nomes das publicações existentes; 2026 usa os arquivos e a pasta do ano', () => {
  assert.deepEqual(SOURCES.map((source) => [source.file, source.entry]), [['detalhe_votacao_munzona_2022.zip', 'detalhe_votacao_munzona_2022_BR.csv'], ['votacao_candidato_munzona_2022.zip', 'votacao_candidato_munzona_2022_BR.csv'], ['votacao_secao_2022_BR.zip', 'votacao_secao_2022_BR.csv']]);
  assert.deepEqual(nationalSources(2026).map((source) => [source.file, source.year]), [['detalhe_votacao_munzona_2026.zip', 2026], ['votacao_candidato_munzona_2026.zip', 2026], ['votacao_secao_2026_BR.zip', 2026]]);
  assert.deepEqual(stateSources('SP', 2026).map((source) => source.entry), ['detalhe_votacao_munzona_2026_SP.csv', 'votacao_candidato_munzona_2026_SP.csv', 'votacao_secao_2026_SP.csv']);
  assert.deepEqual(stateSources('SP').map((source) => source.file), ['detalhe_votacao_munzona_2022.zip', 'votacao_candidato_munzona_2022.zip', 'votacao_secao_2022_SP.zip']);
  assert.deepEqual([SCOPES[2026].senator.seats, SCOPES[2022].senator.seats], [2, undefined]);
  assert.equal(SENATOR_2022.electionCodes['1'], '546');
});

test('exterior: seção instalada sem nenhum comparecimento conta pela apuração, sem linha de seção inventada', () => {
  const f = fixture(PRESIDENT_2026);
  for (const row of f.details) Object.assign(row, { SG_UF: 'ZZ', CD_MUNICIPIO: '29564', QT_APTOS: '72', QT_COMPARECIMENTO: '0', QT_ABSTENCOES: '72', QT_TOTAL_VOTOS_VALIDOS: '0', QT_VOTOS_BRANCOS: '0', QT_TOTAL_VOTOS_NULOS: '0', QT_VOTOS_NULOS: '0', QT_VOTOS: '0', QT_SECOES_PRINCIPAIS: '1', QT_SECOES_NAO_INSTALADAS: '0', QT_ELEITORES_SECOES_NAO_INSTALADAS: '0' });
  for (const row of f.nominal) Object.assign(row, { SG_UF: 'ZZ', CD_MUNICIPIO: '29564', QT_VOTOS_NOMINAIS: '0', QT_VOTOS_NOMINAIS_VALIDOS: '0' });
  const result = reconcileExterior(f.details, f.nominal, [], { code: '29564', name: 'Localidade sintética' }, PRESIDENT_2026);
  assert.deepEqual(result.summaries.map((summary) => [summary.sections, summary.pollingPlaces, summary.totals.abstentions, summary.totals.turnout]), [[1, 0, 72, 0], [1, 0, 72, 0]]);
  assert.equal(result.places.length, 0);
  // Com comparecimento, a falta de linhas continua bloqueando.
  f.details[0]!.QT_COMPARECIMENTO = '1'; f.details[0]!.QT_ABSTENCOES = '71';
  assert.throws(() => reconcileExterior(f.details, f.nominal, [], { code: '29564', name: 'Teste' }, PRESIDENT_2026), /sem votos/);
});
