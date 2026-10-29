'use client';
import { useEffect, useRef, useState } from 'react';
import { isStateOffice, OFFICES, type Office } from '@observatorio/contracts';
import { roundOptions, type RoundAvailability } from '../lib/rounds';
import type { QueryError } from '../lib/query-ui';
import { QuerySelect, TurnField } from './query-fields';
import { useFormSelection } from './use-form-selection';

const asOffice = (value: string): Office => (OFFICES as readonly string[]).includes(value) ? value as Office : 'president';

/** Mostra só os turnos realizados no recorte; ao mudar cargo ou UF no navegador, recompõe o campo e avisa a troca. */
export function RoundField({ availability, office, uf, value, errors, prefix = '', year = '2022' }: {
  availability: RoundAvailability; office: string; uf: string; value: string; errors: QueryError[]; prefix?: string; year?: string;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const selection = useFormSelection(anchor, { office, uf, round: value, year });
  const options = roundOptions(availability, asOffice(selection.office), selection.uf || undefined, selection.year);
  const unavailable = ['1', '2'].includes(selection.round) && !options.rounds.includes(selection.round as '1' | '2');
  const [announcement, setAnnouncement] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // O aviso só descreve a troca automática atual; some quando o recorte volta a ter os dois turnos.
    setAnnouncement(unavailable ? 'Este recorte não tem 2º turno; o 1º turno foi selecionado.' : '');
  }, [unavailable, options.rounds.length]);
  // Turno indisponível (inclusive em endereço antigo com round=2) passa ao 1º; valor inválido continua visível como erro.
  const current = unavailable ? '1' : selection.round;
  return <div ref={anchor} className="round-slot">
    <TurnField key={options.rounds.join(',')} value={current} errors={errors} prefix={prefix} rounds={options.rounds} note={options.note} />
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </div>;
}

/** UF: para cargo estadual, "Todo o Brasil" e exterior ficam indisponíveis antes do envio. */
export function UfField({ office, value, errors, choices }: { office: string; value: string; errors: QueryError[]; choices: Array<{ value: string; label: string }> }) {
  const anchor = useRef<HTMLDivElement>(null);
  const selection = useFormSelection(anchor, { office, uf: value, round: '' });
  const state = isStateOffice(asOffice(selection.office));
  return <div ref={anchor} className="field">
    <label htmlFor="uf">Unidade da Federação</label>
    <QuerySelect id="uf" name="uf" value={value} errors={errors} hintId="uf-hint" choices={choices} disabledValues={state ? ['', 'ZZ'] : []} />
    <p className="field-hint" id="uf-hint">{state ? 'Cargo estadual: escolha uma das 27 UFs. Não há consolidado Brasil nem votação no exterior.' : '“Todo o Brasil” mostra o consolidado nacional; uma UF mostra o resultado estadual e seus municípios.'}</p>
  </div>;
}
