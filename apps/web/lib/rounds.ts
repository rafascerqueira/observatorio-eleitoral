import { SINGLE_ROUND_OFFICES, isStateOffice, type Office } from '@observatorio/contracts';
import { UF_NAMES } from './query-ui';

type Round = '1' | '2';
type CatalogDataset = { office: Office; level?: string; uf?: string | undefined; rounds?: Round[] | undefined };
/** Turnos realizados por cargo e território, lidos das publicações (`BR` = publicação nacional da Presidência). */
export type RoundAvailability = Partial<Record<Office, Record<string, Round[]>>>;
export type RoundOptions = { rounds: Round[]; note: string | null; decided: 'single-round' | 'first-round' | null };

const BOTH: Round[] = ['1', '2'];

export function availabilityFromCatalog(datasets: readonly CatalogDataset[]): RoundAvailability {
  const availability: RoundAvailability = {};
  for (const dataset of datasets) {
    const territory = dataset.level === 'national' ? 'BR' : dataset.level === 'state' ? dataset.uf : undefined;
    if (!territory) continue;
    // Sem `rounds` (versões antigas), não se presume turno único.
    (availability[dataset.office] ??= {})[territory] = dataset.rounds ?? BOTH;
  }
  return availability;
}

/** Turnos que o formulário oferece para o recorte. Sem publicação, nada é presumido além da regra do cargo. */
export function roundOptions(availability: RoundAvailability, office: Office, uf?: string): RoundOptions {
  if (SINGLE_ROUND_OFFICES.includes(office)) return { rounds: ['1'], note: 'Eleito por maioria simples, em turno único: não há 2º turno.', decided: 'single-round' };
  if (!isStateOffice(office)) return { rounds: availability[office]?.BR ?? BOTH, note: null, decided: null };
  if (!uf || uf === 'ZZ') return { rounds: ['1'], note: 'O 2º turno depende da UF escolhida.', decided: null };
  const rounds = availability[office]?.[uf];
  if (!rounds) return { rounds: BOTH, note: null, decided: null };
  if (rounds.length === 1) return { rounds, note: `Decidida no 1º turno em ${UF_NAMES[uf as keyof typeof UF_NAMES] ?? uf}, segundo a apuração do TSE.`, decided: 'first-round' };
  return { rounds, note: null, decided: null };
}
