import { percent, placeGroupsSchema, REGION_STATES, type PlaceGroups, type Region } from '@observatorio/contracts';

/** Soma faixas fixas/categorias das UFs da região; falta, duplicata ou identidade divergente bloqueia a resposta. */
export function regionalPlaceGroups(region: Region, values: unknown[]): PlaceGroups {
  const states = REGION_STATES[region];
  const items = values.map((value) => placeGroupsSchema.parse(value));
  const first = items[0];
  if (!first || items.length !== states.length || new Set(items.map((item) => item.uf)).size !== states.length
    || states.some((uf) => !items.some((item) => item.uf === uf))) throw new Error('Cobertura regional incompleta.');
  if (first.method !== 'bands' && first.method !== 'categories') throw new Error('Grupos sem faixas fixas ou categorias não podem ser somados entre UFs.');
  const coverage = { places: 0, placesInGroups: 0, totalVotes: 0, votesInGroups: 0 };
  const groups = new Map<number, PlaceGroups['groups'][number]>();
  const identities = new Map<string, { name: string; party: string }>();
  const association = first.association ? structuredClone(first.association) : undefined;
  if (association) for (const count of Object.values(association.agreement)) { count.places = 0; count.eligible = 0; }
  for (const item of items) {
    if (item.status !== 'published' || item.office !== 'president' || item.round !== first.round || item.indicator !== first.indicator
      || item.method !== first.method || item.association?.radius !== first.association?.radius) throw new Error('Recortes regionais incompatíveis.');
    if (new Set(item.groups.map((group) => group.index)).size !== item.groups.length
      || item.groups.reduce((sum, group) => sum + group.places, 0) !== item.coverage.placesInGroups
      || item.groups.reduce((sum, group) => sum + group.totalVotes, 0) !== item.coverage.votesInGroups
      || item.coverage.placesInGroups > item.coverage.places || item.coverage.votesInGroups > item.coverage.totalVotes) throw new Error('Cobertura dos grupos inconsistente.');
    for (const key of Object.keys(coverage) as Array<keyof typeof coverage>) coverage[key] += item.coverage[key];
    if (association && item.association) for (const key of Object.keys(association.agreement) as Array<keyof typeof association.agreement>) {
      association.agreement[key].places += item.association.agreement[key].places;
      association.agreement[key].eligible += item.association.agreement[key].eligible;
    }
    for (const source of item.groups) {
      if (new Set(source.candidates.map((candidate) => candidate.number)).size !== source.candidates.length
        || source.candidates.reduce((sum, candidate) => sum + candidate.votes, 0) !== source.valid) throw new Error('Votos de candidaturas não conferem com os válidos do grupo.');
      let group = groups.get(source.index);
      if (!group) {
        group = { ...source, places: 0, eligible: 0, valid: 0, blank: 0, null: 0, totalVotes: 0, candidates: [] };
        groups.set(source.index, group);
      }
      if (group.lower !== source.lower || group.upper !== source.upper) throw new Error('Limites dos grupos divergem entre UFs.');
      group.from = group.from === null || source.from === null ? null : Math.min(group.from, source.from);
      group.to = group.to === null || source.to === null ? null : Math.max(group.to, source.to);
      for (const key of ['places', 'eligible', 'valid', 'blank', 'null', 'totalVotes'] as const) group[key] += source[key];
      for (const candidate of source.candidates) {
        const identity = identities.get(candidate.number);
        if (identity && (identity.name !== candidate.name || identity.party !== candidate.party)) throw new Error('Identidade de candidatura divergente entre UFs.');
        identities.set(candidate.number, candidate);
        const total = group.candidates.find((other) => other.number === candidate.number);
        if (total) total.votes += candidate.votes;
        else group.candidates.push({ ...candidate });
      }
    }
  }
  for (const group of groups.values()) {
    for (const candidate of group.candidates) candidate.percentValid = percent(candidate.votes, group.valid);
    group.candidates.sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number));
  }
  return placeGroupsSchema.parse({ status: 'published', office: 'president', round: first.round, indicator: first.indicator,
    uf: null, region, method: first.method, coverage, groups: [...groups.values()].sort((a, b) => a.index - b.index), ...(association ? { association } : {}) });
}
