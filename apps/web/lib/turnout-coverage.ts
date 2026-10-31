import type { TurnoutProfilesDataset } from '@observatorio/contracts';

type Round = '1' | '2';
/** Cobertura da fonte do comparecimento por perfil em cada ano: turnos presentes, UFs ausentes e data de geração dos arquivos. */
export type TurnoutCoverage = Record<string, { rounds: Round[]; missingUfs: string[]; generated: string | null }>;

/**
 * Lê a cobertura do catálogo, pela publicação mais recente de cada ano. Sem `rounds` (versões de 2022), a fonte traz os dois
 * turnos. A data de geração vem dos cabeçalhos preservados (`generatedAt`, "dd/mm/aaaa hh:mm:ss (fuso)"), só a parte da data.
 */
export function turnoutCoverage(datasets: readonly Pick<TurnoutProfilesDataset, 'year' | 'importedAt' | 'rounds' | 'missingUfs' | 'sources'>[]): TurnoutCoverage {
  const coverage: TurnoutCoverage = {};
  const latest = [...datasets].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  for (const dataset of latest) {
    const year = String(dataset.year);
    if (coverage[year]) continue;
    const dates = [...new Set(dataset.sources.flatMap((source) => source.generatedAt ?? []).map((value) => /^\d{2}\/\d{2}\/\d{4}/.exec(value)?.[0]).filter((value): value is string => Boolean(value)))];
    coverage[year] = { rounds: dataset.rounds ?? ['1', '2'], missingUfs: [...dataset.missingUfs], generated: dates.length ? dates.join(', ') : null };
  }
  return coverage;
}

/** Turnos da fonte que faltam no ano escolhido (aviso do campo; o turno continua selecionável e aparece como não disponível). */
export function roundNote(coverage: TurnoutCoverage, year: string): string | null {
  const item = coverage[year];
  if (!item || item.rounds.length !== 1) return null;
  return `O arquivo do TSE de ${year} traz só o ${item.rounds[0]}º turno${item.generated ? ` (gerado em ${item.generated})` : ''}: o outro turno aparece como não disponível, nunca como zero.`;
}
