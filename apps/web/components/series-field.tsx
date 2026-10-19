'use client';
import { useRef } from 'react';
import type { QueryError } from '../lib/query-ui';
import { QuerySelect } from './query-fields';
import { useFormSelection, type FormSelection } from './use-form-selection';

/**
 * Série comparada de `/mapa`: as candidaturas listadas são as do recorte carregado pelo servidor (cargo, UF e turno). Se o recorte
 * muda no navegador antes do envio, a lista fica desativada (e não é enviada): a comparação volta à abstenção. Sem JavaScript, uma
 * candidatura de outro recorte volta como erro do campo, já com a lista do recorte novo.
 */
export function SeriesField({ loaded, value, choices, errors }: { loaded: FormSelection; value: string; choices: Array<{ value: string; label: string }>; errors: QueryError[] }) {
  const anchor = useRef<HTMLDivElement>(null);
  const selection = useFormSelection(anchor, loaded);
  const stale = selection.office !== loaded.office || selection.uf !== loaded.uf || selection.round !== loaded.round;
  return <div ref={anchor} className="field">
    <label htmlFor="series">Comparar com</label>
    {stale ? <select id="series" disabled aria-describedby="series-hint"><option>Abstenção</option></select>
      : <QuerySelect id="series" name="series" value={value} errors={errors} hintId="series-hint" choices={choices} />}
    <p className="field-hint" id="series-hint">{stale ? 'Envie para listar as candidaturas do recorte escolhido; até lá, a comparação é a abstenção.' : 'Abstenção do cargo ou percentual dos votos válidos de uma candidatura do recorte, em ordem de votos.'}</p>
  </div>;
}
