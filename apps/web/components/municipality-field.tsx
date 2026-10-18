'use client';
import { useRef } from 'react';
import type { QueryError } from '../lib/query-ui';
import { QuerySelect } from './query-fields';
import { useFormSelection } from './use-form-selection';

/**
 * Município da UF carregada pelo servidor. Se a UF muda no navegador antes do envio, a lista antiga fica desativada (e não é
 * enviada): os municípios da nova UF aparecem depois de "Ver participação". Sem JavaScript, vale o mesmo fluxo em dois envios.
 */
export function MunicipalityField({ loadedUf, ufName, value, errors, choices }: { loadedUf: string; ufName: string | null; value: string; errors: QueryError[]; choices: Array<{ value: string; label: string }> }) {
  const anchor = useRef<HTMLDivElement>(null);
  const selection = useFormSelection(anchor, { office: '', uf: loadedUf, round: '' });
  const stale = selection.uf !== loadedUf;
  const enabled = Boolean(loadedUf) && !stale && choices.length > 0;
  const hint = !selection.uf ? 'Escolha uma UF para listar os seus municípios.' : stale ? 'Envie para listar os municípios da UF escolhida.' : `Todos os municípios de ${ufName ?? loadedUf} na fonte; “Toda a UF” soma todos eles.`;
  return <div ref={anchor} className="field">
    <label htmlFor="municipality">Município <span className="optional-label">(opcional)</span></label>
    {enabled ? <QuerySelect id="municipality" name="municipality" value={value} errors={errors} hintId="municipality-hint" choices={[{ value: '', label: 'Toda a UF' }, ...choices]} />
      : <select id="municipality" disabled aria-describedby="municipality-hint"><option>Toda a UF</option></select>}
    <p className="field-hint" id="municipality-hint">{hint}</p>
  </div>;
}
