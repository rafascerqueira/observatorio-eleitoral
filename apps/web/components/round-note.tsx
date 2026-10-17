import type { ReactNode } from 'react';
import type { RoundOptions } from '../lib/rounds';

export const roundBadge = (decided: NonNullable<RoundOptions['decided']>) => <span className="badge badge-round">{decided === 'single-round' ? 'Turno único' : 'Decidida no 1º turno'}</span>;

/** Explicação do turno único ou da eleição decidida no 1º turno, exibida já no 1º turno. */
export function RoundNote({ decided, office, place, children }: { decided: RoundOptions['decided']; office: string; place: string; children?: ReactNode }) {
  if (!decided) return null;
  return <p className="round-note">{roundBadge(decided)} {decided === 'single-round' ? `${office} é eleito por maioria simples, em turno único: não há 2º turno.` : `Segundo a apuração do TSE, não houve 2º turno para ${office} ${place}.`}{children}</p>;
}
