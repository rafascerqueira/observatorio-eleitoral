import type { ReactNode } from 'react';
import type { RoundOptions } from '../lib/rounds';

export const roundBadge = (decided: NonNullable<RoundOptions['decided']>) => <span className="badge badge-round">{decided === 'single-round' ? 'Turno único' : 'Decidida no 1º turno'}</span>;

/** Explicação do turno único ou da eleição decidida no 1º turno, exibida já no 1º turno. */
export function RoundNote({ decided, office, place, children, seats = 1 }: { decided: RoundOptions['decided']; office: string; place: string; children?: ReactNode; seats?: number }) {
  if (!decided) return null;
  // Duas vagas (Senado em 2026): dois votos por eleitor; o percentual de cada candidatura é sobre os votos válidos, não sobre eleitores.
  const single = seats === 2 ? `${office}: duas vagas por UF. Cada eleitor votou duas vezes, e são eleitas as duas candidaturas mais votadas, em turno único; não há 2º turno. Os votos somam o dobro do comparecimento, e cada percentual é sobre os votos válidos, não sobre os eleitores.`
    : `${office} é eleito por maioria simples, em turno único: não há 2º turno.`;
  return <p className="round-note">{roundBadge(decided)} {decided === 'single-round' ? single : `Segundo a apuração do TSE, não houve 2º turno para ${office} ${place}.`}{children}</p>;
}
