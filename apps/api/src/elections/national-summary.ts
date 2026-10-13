import { municipalitySchema, exteriorCitySchema, nationalSummarySchema, percent, type MunicipalityResult } from '@observatorio/contracts';

// Somente agregados reconciliados da versão publicada; nunca uma página da listagem.
export function nationalSummary(records: unknown[], round: string, includeExterior = false) {
  const items = records.map((record) => includeExterior && (record as { uf?: string })?.uf === 'ZZ' ? exteriorCitySchema.parse(record) : municipalitySchema.parse(record));
  const identities = new Set(items.map((item) => `${item.uf}/${item.code}`));
  if (!items.length || identities.size !== items.length || items.some((item) => item.round !== round)) throw new Error('Cobertura nacional inconsistente.');
  const sum = (value: (item: typeof items[number]) => number | null | undefined) => {
    const values = items.map(value);
    return values.some((number) => number == null) ? null : (values as number[]).reduce((total, number) => total + number, 0);
  };
  const totals = {
    eligible: sum((item) => item.totals.eligible), turnout: sum((item) => item.totals.turnout),
    abstentions: sum((item) => item.totals.abstentions), nonInstalledEligible: sum((item) => item.totals.nonInstalledEligible),
    valid: sum((item) => item.totals.valid)!, blank: sum((item) => item.totals.blank)!,
    null: sum((item) => item.totals.null)!, totalVotes: sum((item) => item.totals.totalVotes)!,
  };
  const candidates = new Map<string, MunicipalityResult['candidates'][number]>();
  for (const item of items) {
    const numbers = new Set<string>();
    for (const candidate of item.candidates) {
      if (numbers.has(candidate.number)) throw new Error('Candidatura municipal duplicada.');
      numbers.add(candidate.number);
      const existing = candidates.get(candidate.number);
      if (existing && (existing.name !== candidate.name || existing.party !== candidate.party)) throw new Error('Identidade de candidatura divergente.');
      candidates.set(candidate.number, { ...candidate, votes: (existing?.votes ?? 0) + candidate.votes });
    }
  }
  const nonInstalledSections = sum((item) => item.nonInstalledSections);
  if ([...candidates.values()].reduce((total, candidate) => total + candidate.votes, 0) !== totals.valid
    || totals.valid + totals.blank + totals.null !== totals.totalVotes
    || (totals.eligible !== null && totals.turnout !== null && totals.abstentions !== null && totals.nonInstalledEligible !== null
      && totals.eligible !== totals.turnout + totals.abstentions + totals.nonInstalledEligible)) throw new Error('Totais nacionais divergentes.');
  return nationalSummarySchema.parse({
    municipalities: items.filter((item) => item.uf !== 'ZZ').length, exteriorCities: items.filter((item) => item.uf === 'ZZ').length,
    nonInstalledCases: items.filter((item) => (item.totals.nonInstalledEligible ?? 0) > 0).map((item) => ({ uf: item.uf, code: item.code, name: item.name, electors: item.totals.nonInstalledEligible!, sections: item.nonInstalledSections ?? null })),
    sections: sum((item) => item.sections), pollingPlaces: sum((item) => item.pollingPlaces),
    nonInstalledSections, totals,
    candidates: [...candidates.values()].map((candidate) => ({ ...candidate, percentValid: percent(candidate.votes, totals.valid) }))
      .sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number)),
  });
}
