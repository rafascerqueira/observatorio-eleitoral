'use client';
import { useEffect, useRef } from 'react';
import { isStateOffice, OFFICES, REGION_LABELS, REGIONS, REGION_STATES, STATES, type Office, type Region } from '@observatorio/contracts';
import { UF_NAMES, type QueryError } from '../lib/query-ui';
import { QuerySelect } from './query-fields';
import { useFormSelection } from './use-form-selection';

/** Região refina as opções de UF; sem JavaScript, o GET valida a combinação escolhida. */
export function ProfileTerritoryFields({ region, uf, office, errors }: { region: string; uf: string; office: string; errors: QueryError[] }) {
  const anchor = useRef<HTMLDivElement>(null);
  const selection = useFormSelection(anchor, { region, uf, office, round: '' });
  const previousRegion = useRef(region);
  const chosen = REGIONS.includes(selection.region as Region) ? selection.region as Region : undefined;
  const states = chosen ? REGION_STATES[chosen] : STATES;
  const stateOffice = isStateOffice((OFFICES as readonly string[]).includes(selection.office) ? selection.office as Office : 'president');
  useEffect(() => {
    if (previousRegion.current === selection.region) return;
    previousRegion.current = selection.region ?? '';
    const field = anchor.current?.closest('form')?.elements.namedItem('uf') as HTMLSelectElement | null;
    if (field?.value && chosen && !REGION_STATES[chosen].includes(field.value as typeof STATES[number])) {
      field.value = '';
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, [selection.region, chosen]);
  return <>
    <div className="field" ref={anchor}><label htmlFor="region">Região</label>
      <QuerySelect id="region" name="region" value={selection.region ?? region} errors={errors} choices={[{ value: '', label: 'Todas as regiões' }, ...REGIONS.map((value) => ({ value, label: REGION_LABELS[value] }))]} />
    </div>
    <div className="field"><label htmlFor="uf">Unidade da Federação</label>
      <QuerySelect id="uf" name="uf" value={selection.uf} errors={errors} hintId="uf-hint" disabledValues={stateOffice ? [''] : []}
        choices={[{ value: '', label: chosen ? `Toda a região ${REGION_LABELS[chosen]}` : 'Todo o Brasil' }, ...[...states].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR')).map((value) => ({ value, label: `${UF_NAMES[value]} — ${value}` }))]} />
      <p className="field-hint" id="uf-hint">{stateOffice ? 'Cargo estadual: escolha uma UF. As candidaturas diferem entre estados.' : 'Sem UF selecionada, os votos são somados para a região escolhida ou para todo o Brasil.'}</p>
    </div>
  </>;
}
