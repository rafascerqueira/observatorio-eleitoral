'use client';
import { useRef } from 'react';
import type { QueryError } from '../lib/query-ui';
import { QuerySelect } from './query-fields';
import { useFormSelection, type FormSelection } from './use-form-selection';
import { useRemoteChoices, type Choice } from './use-remote-choices';

type Series = { status: string; choices: Choice[] };
const keyOf = (selection: FormSelection) => `${selection.year ?? ''}/${selection.office}/${selection.uf}/${selection.round}`;
const parse = (body: unknown, ok: boolean): Series | null => {
  const series = body as Series;
  return ok && Array.isArray(series?.choices) && series.choices.length > 0 ? series : null;
};
const NOTES: Record<string, string> = {
  'round-not-held': 'Este turno não foi realizado para o cargo e o território escolhidos; envie para ver o aviso.',
  'needs-uf': 'Cargo estadual: escolha uma UF para listar as candidaturas.',
  'awaiting-import': 'Recorte ainda sem publicação de resultados.',
};

/**
 * Série comparada de `/mapa`: abstenção do cargo ou uma candidatura do recorte. A lista do servidor é a do recorte carregado; se
 * ano, cargo, UF ou turno mudam no navegador antes do envio, o campo busca as opções do recorte novo (`/mapa/comparacoes`) e
 * continua utilizável, mantendo a escolha se ela existir no recorte novo. Durante a busca, ou se ela falhar, o campo fica
 * desativado e o envio usa a abstenção. Sem JavaScript, nada muda: o envio recarrega a página com a lista do recorte escolhido.
 */
export function SeriesField({ loaded, value, choices, errors }: { loaded: FormSelection; value: string; choices: Choice[]; errors: QueryError[] }) {
  const anchor = useRef<HTMLDivElement>(null);
  const selection = useFormSelection(anchor, loaded);
  // Última escolha feita no campo (ex.: uma candidatura que também está no 2º turno), lida antes de cada troca do recorte.
  const current = useRef(value);
  const stale = keyOf(selection) !== keyOf(loaded);
  const params = new URLSearchParams({ office: selection.office, round: selection.round, ...(selection.year ? { year: selection.year } : {}), ...(selection.uf ? { uf: selection.uf } : {}) });
  const remote = useRemoteChoices(stale ? `/mapa/comparacoes?${params}` : null, parse);
  const ready = remote?.status === 'ready' ? remote.body! : null;
  const kept = ready?.choices.some((choice) => choice.value === current.current) ? current.current : 'abstention';
  return <div ref={anchor} className="field" onChange={(event) => { const target = event.target; if (target instanceof HTMLSelectElement && target.id === 'series') current.current = target.value; }}>
    <label htmlFor="series">Comparar com</label>
    {!stale ? <QuerySelect id="series" name="series" value={value} errors={errors} hintId="series-hint" choices={choices} />
      : ready ? <select key={remote!.url} id="series" name="series" defaultValue={kept} aria-describedby="series-hint">
          {ready.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
      : <select id="series" disabled aria-describedby="series-hint"><option>{remote?.status === 'failed' ? 'Abstenção' : 'Carregando as opções…'}</option></select>}
    <p className="field-hint" id="series-hint" aria-live="polite">{!stale ? 'Abstenção do cargo ou percentual dos votos válidos de uma candidatura do recorte, em ordem de votos.'
      : ready ? (NOTES[ready.status] ?? 'Opções do recorte escolhido, em ordem de votos. Envie para ver os mapas.')
      : remote?.status === 'failed' ? 'Não foi possível listar as candidaturas do recorte escolhido; envie para atualizar a lista. Até lá, a comparação é a abstenção.'
      : 'Listando as candidaturas do recorte escolhido…'}</p>
  </div>;
}
