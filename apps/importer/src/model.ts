import { percent, type MunicipalityResult } from '@observatorio/contracts';
import { count, type Row } from './csv';

export const IMPORTER_VERSION = 'sao-paulo-2022-v1';
export type SectionVote = { electionCode: string; round: string; zone: number; section: number; local: string; number: string; votes: number; name: string | null; address: string | null; uf?: string; municipalityCode?: string };
type Candidate = { number: string; name: string; party: string; votes: number };
type Totals = MunicipalityResult['totals'];
export type Place = { zone: number; code: string; name: string | null; address: string | null; sections: number; totals: Totals; candidates: ReturnType<typeof candidatesWithPercent>; metadataConflict: boolean; metadataVariants: Array<{ name: string | null; address: string | null }> };
export type Zone = { zone: number; totals: Totals; candidates: ReturnType<typeof candidatesWithPercent> };
const required = (row: Row, key: string): string => {
  const value = row[key];
  if (!value || ['#NULO', '#NE', '-1', '-3'].includes(value)) throw new Error(`Campo necessário ausente: ${key}`);
  return value;
};
const nullable = (value: string | undefined) => value === undefined || ['#NULO', '#NE', '-1', '-3', ''].includes(value) ? null : value;
export function identity(row: Row): { round: string; electionCode: string; zone: number } {
  const round = required(row, 'NR_TURNO');
  const electionCode = required(row, 'CD_ELEICAO');
  if (!['1', '2'].includes(round) || electionCode !== (round === '1' ? '544' : '545') || row.CD_TIPO_ELEICAO !== '2') throw new Error('Eleição fora do escopo auditado.');
  return { round, electionCode, zone: count(row, 'NR_ZONA') };
}
export function sectionVote(row: Row): SectionVote {
  const id = identity(row);
  return { ...id, ...(row.SG_UF ? { uf: row.SG_UF } : {}), ...(row.CD_MUNICIPIO ? { municipalityCode: row.CD_MUNICIPIO } : {}), section: count(row, 'NR_SECAO'), local: required(row, 'NR_LOCAL_VOTACAO'), number: required(row, 'NR_VOTAVEL'), votes: count(row, 'QT_VOTOS'), name: nullable(row.NM_LOCAL_VOTACAO), address: nullable(row.DS_LOCAL_VOTACAO_ENDERECO) };
}
export function assertEqual(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label}: calculado ${actual}, oficial ${expected}. Publicação bloqueada.`);
}
export function candidatesWithPercent(candidates: Candidate[], valid: number) {
  return candidates.map((candidate) => ({ ...candidate, percentValid: percent(candidate.votes, valid) })).sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number));
}
const emptyTotals = (): Totals => ({ eligible: null, turnout: null, abstentions: null, valid: 0, blank: 0, null: 0, totalVotes: 0, nonInstalledEligible: null });
function addVote(totals: Totals, vote: SectionVote, candidateNumbers: Set<string>) {
  if (vote.number === '95') totals.blank += vote.votes;
  else if (vote.number === '96') totals.null += vote.votes;
  else if (candidateNumbers.has(vote.number)) totals.valid += vote.votes;
  else throw new Error(`Tipo de voto não auditado: ${vote.number}.`);
  totals.totalVotes += vote.votes;
}

export function reconcile(details: Row[], nominal: Row[], sections: SectionVote[], municipality = { code: '71072', name: 'São Paulo', uf: 'SP' as MunicipalityResult['uf'] }, options = { allowNonInstalled: false }) {
  return reconcileTerritory(details, nominal, sections, municipality, options);
}
export function reconcileExterior(details: Row[], nominal: Row[], sections: SectionVote[], city: { code: string; name: string }) {
  if ([...details, ...nominal].some((row) => row.NR_ZONA !== '1') || sections.some((vote) => vote.zone !== 1)) throw new Error('Zona do exterior fora do escopo auditado de 2022.');
  return reconcileTerritory(details, nominal, sections, { ...city, uf: 'ZZ' }, { allowNonInstalled: true, allowEmptyNonInstalled: true });
}
function reconcileTerritory<U extends MunicipalityResult['uf'] | 'ZZ'>(details: Row[], nominal: Row[], sections: SectionVote[], municipality: { code: string; name: string; uf: U }, options: { allowNonInstalled: boolean; allowEmptyNonInstalled?: boolean }) {
  for (const row of [...details, ...nominal]) {
    if ((row.CD_MUNICIPIO && row.CD_MUNICIPIO !== municipality.code) || (row.SG_UF && row.SG_UF !== municipality.uf) || (row.CD_CARGO && row.CD_CARGO !== '1')) throw new Error('Mistura de territórios/cargos na reconciliação.');
  }
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
  for (const round of ['1', '2'] as const) {
    const detailRows = details.filter((row) => row.NR_TURNO === round);
    const candidateRows = nominal.filter((row) => row.NR_TURNO === round);
    const votes = sections.filter((row) => row.round === round);
    if (!detailRows.length || !candidateRows.length || (!votes.length && !options.allowEmptyNonInstalled)) throw new Error(`Turno ${round} incompleto.`);
    const candidateInfo = new Map<string, Candidate>();
    const nominalByZone = new Map<string, number>();
    for (const row of candidateRows) {
      const id = identity(row);
      if (row.ST_VOTO_EM_TRANSITO !== 'N' || row.NM_TIPO_DESTINACAO_VOTOS !== 'Válido') throw new Error('Destinação/trânsito fora do escopo do piloto.');
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
    const detailByZone = new Map<number, Row>();
    const zoneVotes = new Map<number, SectionVote[]>();
    for (const row of detailRows) {
      const id = identity(row);
      if (row.ST_VOTO_EM_TRANSITO !== 'N') throw new Error('Apuração em trânsito fora do escopo.');
      if (row.ST_PENDENTE_TOT_FINAL && row.ST_PENDENTE_TOT_FINAL !== 'N') throw new Error('Totalização final pendente.');
      if (detailByZone.has(id.zone)) throw new Error('Apuração/zona duplicada.');
      for (const field of ['QT_TOTAL_VOTOS_ANULADOS', 'QT_TOTAL_VOTOS_ANUL_SUBJUD', 'QT_VOTOS_ANULADOS_APU_SEP', 'QT_VOTOS_NULOS_TECNICOS', 'QT_TOTAL_VOTOS_LEG_VALIDOS']) assertEqual(count(row, field), 0, field);
      if (!options.allowNonInstalled) for (const field of ['QT_SECOES_NAO_INSTALADAS', 'QT_ELEITORES_SECOES_NAO_INSTALADAS']) assertEqual(count(row, field), 0, field);
      detailByZone.set(id.zone, row);
    }
    for (const vote of votes) {
      if (!detailByZone.has(vote.zone)) throw new Error(`Seção sem apuração correspondente: ${vote.zone}`);
      const group = zoneVotes.get(vote.zone) ?? [];
      group.push(vote); zoneVotes.set(vote.zone, group);
    }
    const totals = { eligible: 0, turnout: 0, abstentions: 0, valid: 0, blank: 0, null: 0, totalVotes: 0, nonInstalledEligible: 0 };
    const placeGroups = new Map<string, SectionVote[]>();
    let sectionCount = 0;
    let nonInstalledSections = 0;
    for (const [zone, row] of detailByZone) {
      const group = zoneVotes.get(zone) ?? [];
      if (!group.length && !(municipality.uf === 'ZZ' && options.allowEmptyNonInstalled
        && count(row, 'QT_VOTOS') === 0 && count(row, 'QT_COMPARECIMENTO') === 0
        && count(row, 'QT_SECOES_PRINCIPAIS') === count(row, 'QT_SECOES_NAO_INSTALADAS'))) throw new Error(`Zona sem votos de seções: ${zone}`);
      const calculated = emptyTotals();
      const candidateVotes = new Map<string, number>();
      const uniqueSections = new Set<number>();
      const localPerSection = new Map<number, string>();
      for (const vote of group) {
        addVote(calculated, vote, numbers);
        uniqueSections.add(vote.section);
        const previousLocal = localPerSection.get(vote.section);
        if (previousLocal !== undefined && previousLocal !== vote.local) throw new Error('Seção associada a múltiplos locais.');
        localPerSection.set(vote.section, vote.local);
        if (numbers.has(vote.number)) candidateVotes.set(vote.number, (candidateVotes.get(vote.number) ?? 0) + vote.votes);
        const key = `${zone}/${vote.local}`;
        const place = placeGroups.get(key) ?? []; place.push(vote); placeGroups.set(key, place);
      }
      const official = { eligible: count(row, 'QT_APTOS'), turnout: count(row, 'QT_COMPARECIMENTO'), abstentions: count(row, 'QT_ABSTENCOES'), valid: count(row, 'QT_TOTAL_VOTOS_VALIDOS'), blank: count(row, 'QT_VOTOS_BRANCOS'), null: count(row, 'QT_TOTAL_VOTOS_NULOS'), totalVotes: count(row, 'QT_VOTOS'), nonInstalledEligible: count(row, 'QT_ELEITORES_SECOES_NAO_INSTALADAS') };
      const missingSections = count(row, 'QT_SECOES_NAO_INSTALADAS');
      assertEqual(official.eligible, official.turnout + official.abstentions + official.nonInstalledEligible, `Zona ${zone}: aptos`);
      assertEqual(official.turnout, official.totalVotes, `Zona ${zone}: comparecimento`);
      assertEqual(official.totalVotes, official.valid + official.blank + official.null, `Zona ${zone}: composição dos votos`);
      for (const field of ['valid', 'blank', 'null', 'totalVotes'] as const) assertEqual(calculated[field], official[field], `Turno ${round}, zona ${zone}, ${field}`);
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
      for (const field of Object.keys(totals) as Array<keyof typeof totals>) totals[field] += official[field];
      allZones.push({ round, zone, totals: official, candidates: candidatesWithPercent(candidates, official.valid) });
    }
    for (const [key, group] of placeGroups) {
      const first = group[0]!;
      const placeTotals = emptyTotals();
      const counts = new Map<string, number>();
      for (const vote of group) {
        addVote(placeTotals, vote, numbers);
        if (numbers.has(vote.number)) counts.set(vote.number, (counts.get(vote.number) ?? 0) + vote.votes);
      }
      const variants = [...new Map(group.map((vote) => { const pair = { name: vote.name, address: vote.address }; return [JSON.stringify(pair), pair] as const; })).values()];
      const names = new Set(variants.map((variant) => variant.name));
      const addresses = new Set(variants.map((variant) => variant.address));
      allPlaces.push({ round, zone: first.zone, code: first.local, name: names.size === 1 ? first.name : null, address: addresses.size === 1 ? first.address : null, metadataConflict: variants.length > 1, metadataVariants: variants, sections: new Set(group.map((vote) => vote.section)).size, totals: placeTotals, candidates: candidatesWithPercent([...candidateInfo.values()].map((candidate) => ({ ...candidate, votes: counts.get(candidate.number) ?? 0 })), placeTotals.valid) });
    }
    summaries.push({ ...municipality, electionCode: round === '1' ? '544' : '545', round, totals, candidates: candidatesWithPercent([...candidateInfo.values()], totals.valid), zones: detailByZone.size, sections: sectionCount, pollingPlaces: placeGroups.size, nonInstalledSections });
  }
  return { summaries, zones: allZones, places: allPlaces };
}
