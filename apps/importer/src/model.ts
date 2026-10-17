import { percent, type MunicipalityResult, type Office, type nonValidVoteSchema } from '@observatorio/contracts';
import type { z } from 'zod';
import { count, type Row } from './csv';

export const IMPORTER_VERSION = 'sao-paulo-2022-v1';
type Round = '1' | '2';
/** Recorte auditado de uma eleição: cargo, códigos de eleição por turno e turnos esperados. */
export type ElectionScope = { year: 2022; office: Office; cargo: string; electionCodes: Partial<Record<Round, string>>; rounds: readonly Round[];
  /** Aceita votos Anulado / Anulado sub judice (nominal) e nulos técnicos (seções), reconciliados por zona. */
  nonValidVotes?: boolean };
export const PRESIDENT_2022: ElectionScope = { year: 2022, office: 'president', cargo: '1', electionCodes: { '1': '544', '2': '545' }, rounds: ['1', '2'] };
// Eleições estaduais de 2022 (546/547), auditadas nos originais das 27 UFs.
export const GOVERNOR_2022: ElectionScope = { year: 2022, office: 'governor', cargo: '3', electionCodes: { '1': '546', '2': '547' }, rounds: ['1', '2'], nonValidVotes: true };
// Senado 2022: uma vaga por UF, um voto por eleitor, maioria simples em turno único (eleição 546 apenas).
export const SENATOR_2022: ElectionScope = { year: 2022, office: 'senator', cargo: '5', electionCodes: { '1': '546' }, rounds: ['1'], nonValidVotes: true };
export type SectionVote = { electionCode: string; round: string; zone: number; section: number; local: string; number: string; votes: number; name: string | null; address: string | null; uf?: string; municipalityCode?: string; votableName?: string | null };
type NonValid = z.infer<typeof nonValidVoteSchema>;
type Classifier = (number: string) => 'blank' | 'null' | 'valid' | NonValid['category'];
type Candidate = { number: string; name: string; party: string; votes: number };
type Totals = MunicipalityResult['totals'];
export type Place = { zone: number; code: string; name: string | null; address: string | null; sections: number; totals: Totals; candidates: ReturnType<typeof candidatesWithPercent>; metadataConflict: boolean; metadataVariants: Array<{ name: string | null; address: string | null }>; nonValidVotes?: NonValid[] };
export type Zone = { zone: number; totals: Totals; candidates: ReturnType<typeof candidatesWithPercent>; nonValidVotes?: NonValid[] };
const required = (row: Row, key: string): string => {
  const value = row[key];
  if (!value || ['#NULO', '#NE', '-1', '-3'].includes(value)) throw new Error(`Campo necessário ausente: ${key}`);
  return value;
};
const nullable = (value: string | undefined) => value === undefined || ['#NULO', '#NE', '-1', '-3', ''].includes(value) ? null : value;
export function identity(row: Row, scope = PRESIDENT_2022): { round: string; electionCode: string; zone: number } {
  const round = required(row, 'NR_TURNO');
  const electionCode = required(row, 'CD_ELEICAO');
  if (!scope.rounds.includes(round as Round) || electionCode !== scope.electionCodes[round as Round] || row.CD_TIPO_ELEICAO !== '2') throw new Error('Eleição fora do escopo auditado.');
  if (row.CD_CARGO !== undefined && row.CD_CARGO !== scope.cargo) throw new Error('Cargo fora do escopo auditado.');
  return { round, electionCode, zone: count(row, 'NR_ZONA') };
}
export function sectionVote(row: Row, scope = PRESIDENT_2022): SectionVote {
  const id = identity(row, scope);
  const number = required(row, 'NR_VOTAVEL');
  // O nome do votável só é guardado onde pode identificar um nulo técnico (sem linha no nominal).
  const votableName = scope.nonValidVotes && !['95', '96'].includes(number) ? { votableName: nullable(row.NM_VOTAVEL) } : {};
  return { ...id, ...(row.SG_UF ? { uf: row.SG_UF } : {}), ...(row.CD_MUNICIPIO ? { municipalityCode: row.CD_MUNICIPIO } : {}), section: count(row, 'NR_SECAO'), local: required(row, 'NR_LOCAL_VOTACAO'), number, votes: count(row, 'QT_VOTOS'), name: nullable(row.NM_LOCAL_VOTACAO), address: nullable(row.DS_LOCAL_VOTACAO_ENDERECO), ...votableName };
}
export function assertEqual(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label}: calculado ${actual}, oficial ${expected}. Publicação bloqueada.`);
}
export function candidatesWithPercent(candidates: Candidate[], valid: number) {
  return candidates.map((candidate) => ({ ...candidate, percentValid: percent(candidate.votes, valid) })).sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number));
}
const nonValidZeros = () => ({ annulled: 0, annulledSubJudice: 0, technicalNull: 0 });
const emptyTotals = (nonValid = false): Totals => ({ eligible: null, turnout: null, abstentions: null, valid: 0, blank: 0, null: 0, totalVotes: 0, nonInstalledEligible: null, ...(nonValid ? nonValidZeros() : {}) });
const NON_VALID_FIELD = { annulled: 'annulled', 'annulled-sub-judice': 'annulledSubJudice', 'technical-null': 'technicalNull' } as const;
function addVote(totals: Totals, vote: SectionVote, classify: Classifier) {
  const kind = classify(vote.number);
  if (kind === 'blank') totals.blank += vote.votes;
  else if (kind === 'null') totals.null += vote.votes;
  else if (kind === 'valid') totals.valid += vote.votes;
  else {
    const field = NON_VALID_FIELD[kind];
    totals[field] = (totals[field] ?? 0) + vote.votes;
    // Nulo técnico integra o total de nulos do TSE; anulados ficam fora de válidos e nulos.
    if (kind === 'technical-null') totals.null += vote.votes;
  }
  totals.totalVotes += vote.votes;
}
function sortNonValid(items: NonValid[]) { return items.sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number)); }

export function reconcile(details: Row[], nominal: Row[], sections: SectionVote[], municipality = { code: '71072', name: 'São Paulo', uf: 'SP' as MunicipalityResult['uf'] }, options: { allowNonInstalled: boolean; scope?: ElectionScope } = { allowNonInstalled: false }) {
  return reconcileTerritory(details, nominal, sections, municipality, options);
}
export function reconcileExterior(details: Row[], nominal: Row[], sections: SectionVote[], city: { code: string; name: string }) {
  if ([...details, ...nominal].some((row) => row.NR_ZONA !== '1') || sections.some((vote) => vote.zone !== 1)) throw new Error('Zona do exterior fora do escopo auditado de 2022.');
  return reconcileTerritory(details, nominal, sections, { ...city, uf: 'ZZ' }, { allowNonInstalled: true, allowEmptyNonInstalled: true });
}
function reconcileTerritory<U extends MunicipalityResult['uf'] | 'ZZ'>(details: Row[], nominal: Row[], sections: SectionVote[], municipality: { code: string; name: string; uf: U }, options: { allowNonInstalled: boolean; allowEmptyNonInstalled?: boolean; scope?: ElectionScope }) {
  const scope = options.scope ?? PRESIDENT_2022;
  for (const row of [...details, ...nominal]) {
    if ((row.CD_MUNICIPIO && row.CD_MUNICIPIO !== municipality.code) || (row.SG_UF && row.SG_UF !== municipality.uf) || (row.CD_CARGO && row.CD_CARGO !== scope.cargo)) throw new Error('Mistura de territórios/cargos na reconciliação.');
  }
  // Um turno fora do recorte esperado não é descartado: bloqueia a reconciliação.
  for (const row of [...details, ...nominal]) identity(row, scope);
  for (const vote of sections) if (!scope.rounds.includes(vote.round as Round) || vote.electionCode !== scope.electionCodes[vote.round as Round]) throw new Error('Seção fora do escopo auditado.');
  const summaries: Array<Omit<MunicipalityResult, 'uf'> & { uf: U }> = [];
  const allZones: Array<Zone & { round: string }> = [];
  const allPlaces: Array<Place & { round: string }> = [];
  const duplicateSections = new Set<string>();
  for (const vote of sections) {
    if ((vote.uf && vote.uf !== municipality.uf) || (vote.municipalityCode && vote.municipalityCode !== municipality.code)) throw new Error('Mistura de territórios nas seções.');
    const key = `${vote.electionCode}/${vote.round}/${vote.zone}/${vote.section}/${vote.number}`;
    if (duplicateSections.has(key)) throw new Error(`Seção/votável duplicado: ${key}`);
    duplicateSections.add(key);
  }
  for (const round of scope.rounds) {
    const detailRows = details.filter((row) => row.NR_TURNO === round);
    const candidateRows = nominal.filter((row) => row.NR_TURNO === round);
    const votes = sections.filter((row) => row.round === round);
    if (!detailRows.length || !candidateRows.length || (!votes.length && !options.allowEmptyNonInstalled)) throw new Error(`Turno ${round} incompleto.`);
    const candidateInfo = new Map<string, Candidate>();
    const nominalByZone = new Map<string, number>();
    const nonValidInfo = new Map<string, NonValid>();
    const nonValidByZone = new Map<string, number>();
    for (const row of candidateRows) {
      const id = identity(row, scope);
      const destination = row.NM_TIPO_DESTINACAO_VOTOS;
      if (row.ST_VOTO_EM_TRANSITO !== 'N') throw new Error('Destinação/trânsito fora do escopo do piloto.');
      if (destination !== 'Válido') {
        const category = destination === 'Anulado' ? 'annulled' as const : destination === 'Anulado sub judice' ? 'annulled-sub-judice' as const : null;
        if (!scope.nonValidVotes || !category) throw new Error(`Destinação/trânsito fora do escopo do piloto: ${destination ?? 'ausente'}.`);
        const number = required(row, 'NR_CANDIDATO');
        assertEqual(count(row, 'QT_VOTOS_NOMINAIS_VALIDOS'), 0, `Votos válidos de candidatura ${destination}`);
        const item: NonValid = { number, name: required(row, 'NM_URNA_CANDIDATO'), party: required(row, 'SG_PARTIDO'), category, nameSource: 'nominal', detail: nullable(row.DS_DETALHE_SITUACAO_CAND), votes: count(row, 'QT_VOTOS_NOMINAIS') };
        const previous = nonValidInfo.get(number);
        if (previous && (previous.name !== item.name || previous.party !== item.party || previous.category !== item.category || previous.detail !== item.detail)) throw new Error('Conflito de candidatura não válida.');
        nonValidInfo.set(number, { ...item, votes: (previous?.votes ?? 0) + item.votes });
        const key = `${id.zone}/${number}`;
        if (nonValidByZone.has(key)) throw new Error(`Candidatura/zona duplicada: ${key}`);
        nonValidByZone.set(key, item.votes);
        continue;
      }
      const number = required(row, 'NR_CANDIDATO');
      const candidate = { number, name: required(row, 'NM_URNA_CANDIDATO'), party: required(row, 'SG_PARTIDO'), votes: count(row, 'QT_VOTOS_NOMINAIS_VALIDOS') };
      assertEqual(candidate.votes, count(row, 'QT_VOTOS_NOMINAIS'), 'Votos nominais versus válidos');
      const previous = candidateInfo.get(number);
      if (previous && (previous.name !== candidate.name || previous.party !== candidate.party)) throw new Error('Conflito de candidatura.');
      candidateInfo.set(number, { ...candidate, votes: (previous?.votes ?? 0) + candidate.votes });
      const key = `${id.zone}/${number}`;
      if (nominalByZone.has(key)) throw new Error(`Candidatura/zona duplicada: ${key}`);
      nominalByZone.set(key, candidate.votes);
    }
    const numbers = new Set(candidateInfo.keys());
    for (const number of nonValidInfo.keys()) if (numbers.has(number)) throw new Error(`Candidatura ${number} válida e não válida no mesmo turno.`);
    // Fora da regra de votos não válidos, número desconhecido continua bloqueando (Presidência).
    const classify: Classifier = (number) => number === '95' ? 'blank' : number === '96' ? 'null' : numbers.has(number) ? 'valid'
      : nonValidInfo.get(number)?.category ?? (scope.nonValidVotes ? 'technical-null' : (() => { throw new Error(`Tipo de voto não auditado: ${number}.`); })());
    const technicalNames = new Map<string, string>();
    const detailByZone = new Map<number, Row>();
    const zoneVotes = new Map<number, SectionVote[]>();
    for (const row of detailRows) {
      const id = identity(row, scope);
      if (row.ST_VOTO_EM_TRANSITO !== 'N') throw new Error('Apuração em trânsito fora do escopo.');
      if (row.ST_PENDENTE_TOT_FINAL && row.ST_PENDENTE_TOT_FINAL !== 'N') throw new Error('Totalização final pendente.');
      if (detailByZone.has(id.zone)) throw new Error('Apuração/zona duplicada.');
      const zeroFields = scope.nonValidVotes ? ['QT_VOTOS_ANULADOS_APU_SEP', 'QT_TOTAL_VOTOS_LEG_VALIDOS', 'QT_VOTOS_LEGENDA_ANULADOS', 'QT_VOTOS_LEGENDA_ANUL_SUBJUD']
        : ['QT_TOTAL_VOTOS_ANULADOS', 'QT_TOTAL_VOTOS_ANUL_SUBJUD', 'QT_VOTOS_ANULADOS_APU_SEP', 'QT_VOTOS_NULOS_TECNICOS', 'QT_TOTAL_VOTOS_LEG_VALIDOS'];
      for (const field of zeroFields) assertEqual(count(row, field), 0, field);
      if (!options.allowNonInstalled) for (const field of ['QT_SECOES_NAO_INSTALADAS', 'QT_ELEITORES_SECOES_NAO_INSTALADAS']) assertEqual(count(row, field), 0, field);
      detailByZone.set(id.zone, row);
    }
    for (const vote of votes) {
      if (!detailByZone.has(vote.zone)) throw new Error(`Seção sem apuração correspondente: ${vote.zone}`);
      const group = zoneVotes.get(vote.zone) ?? [];
      group.push(vote); zoneVotes.set(vote.zone, group);
    }
    const totals: Record<string, number> = { eligible: 0, turnout: 0, abstentions: 0, valid: 0, blank: 0, null: 0, totalVotes: 0, nonInstalledEligible: 0, ...(scope.nonValidVotes ? nonValidZeros() : {}) };
    const technicalTotals = new Map<string, number>();
    const placeGroups = new Map<string, SectionVote[]>();
    let sectionCount = 0;
    let nonInstalledSections = 0;
    for (const [zone, row] of detailByZone) {
      const group = zoneVotes.get(zone) ?? [];
      if (!group.length && !(municipality.uf === 'ZZ' && options.allowEmptyNonInstalled
        && count(row, 'QT_VOTOS') === 0 && count(row, 'QT_COMPARECIMENTO') === 0
        && count(row, 'QT_SECOES_PRINCIPAIS') === count(row, 'QT_SECOES_NAO_INSTALADAS'))) throw new Error(`Zona sem votos de seções: ${zone}`);
      const calculated = emptyTotals(scope.nonValidVotes);
      const candidateVotes = new Map<string, number>();
      const plainNull = { votes: 0 };
      const uniqueSections = new Set<number>();
      const localPerSection = new Map<number, string>();
      for (const vote of group) {
        addVote(calculated, vote, classify);
        if (vote.number === '96') plainNull.votes += vote.votes;
        if (classify(vote.number) === 'technical-null') {
          const name = vote.votableName;
          if (!name) throw new Error(`Nulo técnico sem nome do votável na fonte: ${vote.number}.`);
          if ((technicalNames.get(vote.number) ?? name) !== name) throw new Error(`Nome divergente para o votável ${vote.number}.`);
          technicalNames.set(vote.number, name);
        }
        uniqueSections.add(vote.section);
        const previousLocal = localPerSection.get(vote.section);
        if (previousLocal !== undefined && previousLocal !== vote.local) throw new Error('Seção associada a múltiplos locais.');
        localPerSection.set(vote.section, vote.local);
        if (!['95', '96'].includes(vote.number)) candidateVotes.set(vote.number, (candidateVotes.get(vote.number) ?? 0) + vote.votes);
        const key = `${zone}/${vote.local}`;
        const place = placeGroups.get(key) ?? []; place.push(vote); placeGroups.set(key, place);
      }
      const official = { eligible: count(row, 'QT_APTOS'), turnout: count(row, 'QT_COMPARECIMENTO'), abstentions: count(row, 'QT_ABSTENCOES'), valid: count(row, 'QT_TOTAL_VOTOS_VALIDOS'), blank: count(row, 'QT_VOTOS_BRANCOS'), null: count(row, 'QT_TOTAL_VOTOS_NULOS'), totalVotes: count(row, 'QT_VOTOS'), nonInstalledEligible: count(row, 'QT_ELEITORES_SECOES_NAO_INSTALADAS'),
        ...(scope.nonValidVotes ? { annulled: count(row, 'QT_TOTAL_VOTOS_ANULADOS'), annulledSubJudice: count(row, 'QT_TOTAL_VOTOS_ANUL_SUBJUD'), technicalNull: count(row, 'QT_VOTOS_NULOS_TECNICOS') } : {}) };
      const missingSections = count(row, 'QT_SECOES_NAO_INSTALADAS');
      assertEqual(official.eligible, official.turnout + official.abstentions + official.nonInstalledEligible, `Zona ${zone}: aptos`);
      assertEqual(official.turnout, official.totalVotes, `Zona ${zone}: comparecimento`);
      assertEqual(official.totalVotes, official.valid + official.blank + official.null + (official.annulled ?? 0) + (official.annulledSubJudice ?? 0), `Zona ${zone}: composição dos votos`);
      const reconciledFields = scope.nonValidVotes ? ['valid', 'blank', 'null', 'totalVotes', 'annulled', 'annulledSubJudice', 'technicalNull'] as const : ['valid', 'blank', 'null', 'totalVotes'] as const;
      for (const field of reconciledFields) assertEqual(calculated[field] ?? 0, official[field] ?? 0, `Turno ${round}, zona ${zone}, ${field}`);
      if (scope.nonValidVotes) {
        assertEqual(official.null, count(row, 'QT_VOTOS_NULOS') + count(row, 'QT_VOTOS_NULOS_TECNICOS'), `Zona ${zone}: nulos + nulos técnicos`);
        assertEqual(plainNull.votes, count(row, 'QT_VOTOS_NULOS'), `Turno ${round}, zona ${zone}, nulos (96)`);
        assertEqual(official.annulled ?? 0, count(row, 'QT_VOTOS_NOMINAIS_ANULADOS'), `Zona ${zone}: anulados nominais`);
        assertEqual(official.annulledSubJudice ?? 0, count(row, 'QT_VOTOS_NOMINAIS_ANUL_SUBJUD'), `Zona ${zone}: anulados sub judice nominais`);
      }
      assertEqual(uniqueSections.size + missingSections, count(row, 'QT_SECOES_PRINCIPAIS'), `Zona ${zone}: seções principais (com votos + não instaladas)`);
      if (row.QT_TOTAL_SECOES !== undefined && row.QT_SECOES_AGREGADAS !== undefined) assertEqual(count(row, 'QT_TOTAL_SECOES'), count(row, 'QT_SECOES_PRINCIPAIS') + count(row, 'QT_SECOES_AGREGADAS'), `Zona ${zone}: total de seções`);
      sectionCount += uniqueSections.size;
      nonInstalledSections += missingSections;
      const candidates: Candidate[] = [];
      for (const candidate of candidateInfo.values()) {
        const expected = nominalByZone.get(`${zone}/${candidate.number}`);
        if (expected === undefined) throw new Error(`Candidatura sem zona correspondente: ${zone}/${candidate.number}`);
        assertEqual(candidateVotes.get(candidate.number) ?? 0, expected, `Turno ${round}, zona ${zone}, candidatura ${candidate.number}`);
        candidates.push({ ...candidate, votes: expected });
      }
      const zoneNonValid: NonValid[] = [];
      for (const item of nonValidInfo.values()) {
        const expected = nonValidByZone.get(`${zone}/${item.number}`);
        if (expected === undefined) throw new Error(`Candidatura sem zona correspondente: ${zone}/${item.number}`);
        assertEqual(candidateVotes.get(item.number) ?? 0, expected, `Turno ${round}, zona ${zone}, candidatura ${item.number} (${item.category})`);
        zoneNonValid.push({ ...item, votes: expected });
      }
      for (const [number, name] of technicalNames) {
        const votes = group.filter((vote) => vote.number === number).reduce((sum, vote) => sum + vote.votes, 0);
        if (!votes) continue;
        technicalTotals.set(number, (technicalTotals.get(number) ?? 0) + votes);
        zoneNonValid.push({ number, name, party: null, category: 'technical-null', nameSource: 'section', detail: null, votes });
      }
      for (const field of Object.keys(totals)) totals[field]! += (official as Record<string, number>)[field]!;
      allZones.push({ round, zone, totals: official, candidates: candidatesWithPercent(candidates, official.valid), ...(scope.nonValidVotes ? { nonValidVotes: sortNonValid(zoneNonValid) } : {}) });
    }
    // Identidade estável das candidaturas não válidas do turno, para locais e para o total do município.
    const nonValidList = (counts: Map<string, number>, includeZero: boolean) => sortNonValid([
      ...[...nonValidInfo.values()].map((item) => ({ ...item, votes: counts.get(item.number) ?? 0 })),
      ...[...technicalNames].map(([number, name]) => ({ number, name, party: null, category: 'technical-null' as const, nameSource: 'section' as const, detail: null, votes: counts.get(number) ?? 0 })),
    ].filter((item) => includeZero || item.votes > 0));
    for (const [key, group] of placeGroups) {
      const first = group[0]!;
      const placeTotals = emptyTotals(scope.nonValidVotes);
      const counts = new Map<string, number>();
      for (const vote of group) {
        addVote(placeTotals, vote, classify);
        if (!['95', '96'].includes(vote.number)) counts.set(vote.number, (counts.get(vote.number) ?? 0) + vote.votes);
      }
      const variants = [...new Map(group.map((vote) => { const pair = { name: vote.name, address: vote.address }; return [JSON.stringify(pair), pair] as const; })).values()];
      const names = new Set(variants.map((variant) => variant.name));
      const addresses = new Set(variants.map((variant) => variant.address));
      allPlaces.push({ round, zone: first.zone, code: first.local, name: names.size === 1 ? first.name : null, address: addresses.size === 1 ? first.address : null, metadataConflict: variants.length > 1, metadataVariants: variants, sections: new Set(group.map((vote) => vote.section)).size, totals: placeTotals, candidates: candidatesWithPercent([...candidateInfo.values()].map((candidate) => ({ ...candidate, votes: counts.get(candidate.number) ?? 0 })), placeTotals.valid), ...(scope.nonValidVotes ? { nonValidVotes: nonValidList(counts, false) } : {}) });
    }
    const municipalNonValid = new Map<string, number>([...[...nonValidInfo.values()].map((item) => [item.number, item.votes] as const), ...technicalTotals]);
    summaries.push({ ...municipality, electionCode: scope.electionCodes[round]!, round, totals: totals as Totals, candidates: candidatesWithPercent([...candidateInfo.values()], totals.valid!), zones: detailByZone.size, sections: sectionCount, pollingPlaces: placeGroups.size, nonInstalledSections, ...(scope.nonValidVotes ? { nonValidVotes: nonValidList(municipalNonValid, true) } : {}) });
  }
  return { summaries, zones: allZones, places: allPlaces };
}
