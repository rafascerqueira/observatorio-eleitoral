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
    // Categorias ausentes em alguma parcela (versões anteriores) ficam nulas, não zero.
    annulled: sum((item) => item.totals.annulled), annulledSubJudice: sum((item) => item.totals.annulledSubJudice), technicalNull: sum((item) => item.totals.technicalNull),
  };
  const nonValid = new Map<string, NonNullable<MunicipalityResult['nonValidVotes']>[number]>();
  const nonValidComplete = items.every((item) => item.nonValidVotes !== undefined);
  for (const item of nonValidComplete ? items : []) for (const entry of item.nonValidVotes!) {
    const key = `${entry.category}/${entry.number}`;
    const existing = nonValid.get(key);
    if (existing && (existing.name !== entry.name || existing.party !== entry.party || existing.detail !== entry.detail)) throw new Error('Identidade de votável não válido divergente.');
    nonValid.set(key, { ...entry, votes: (existing?.votes ?? 0) + entry.votes });
  }
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
    || totals.valid + totals.blank + totals.null + (totals.annulled ?? 0) + (totals.annulledSubJudice ?? 0) !== totals.totalVotes
    || (nonValidComplete && [...nonValid.values()].filter((entry) => entry.category === 'annulled').reduce((total, entry) => total + entry.votes, 0) !== (totals.annulled ?? 0))
    || (totals.eligible !== null && totals.turnout !== null && totals.abstentions !== null && totals.nonInstalledEligible !== null
      && totals.eligible !== totals.turnout + totals.abstentions + totals.nonInstalledEligible)) throw new Error('Totais nacionais divergentes.');
  return nationalSummarySchema.parse({
    municipalities: items.filter((item) => item.uf !== 'ZZ').length, exteriorCities: items.filter((item) => item.uf === 'ZZ').length,
    nonInstalledCases: items.filter((item) => (item.totals.nonInstalledEligible ?? 0) > 0).map((item) => ({ uf: item.uf, code: item.code, name: item.name, electors: item.totals.nonInstalledEligible!, sections: item.nonInstalledSections ?? null })),
    sections: sum((item) => item.sections), pollingPlaces: sum((item) => item.pollingPlaces),
    ...(nonValidComplete ? { nonValidVotes: [...nonValid.values()].sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number)) } : {}),
    nonInstalledSections, totals,
    candidates: [...candidates.values()].map((candidate) => ({ ...candidate, percentValid: percent(candidate.votes, totals.valid) }))
      .sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number)),
  });
}
