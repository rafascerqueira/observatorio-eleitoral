'use client';
import { useRef } from 'react';
import { UF_NAMES, type QueryError } from '../lib/query-ui';
import type { TurnoutCoverage } from '../lib/turnout-coverage';
import { QuerySelect } from './query-fields';
import { useFormSelection } from './use-form-selection';
import { useRemoteChoices, type Choice } from './use-remote-choices';

const parse = (body: unknown, ok: boolean): Choice[] | null => {
  const choices = (body as { choices?: Choice[] } | null)?.choices;
  return ok && Array.isArray(choices) && choices.length > 0 ? choices : null;
};
const ufName = (uf: string) => UF_NAMES[uf as keyof typeof UF_NAMES] ?? uf;
const disabled = (label: string) => <select id="municipality" disabled aria-describedby="municipality-hint"><option>{label}</option></select>;

/**
 * Município de `/participacao`, da UF e do ano carregados pelo servidor. Se UF ou ano mudam no navegador antes do envio, o campo
 * busca os municípios do recorte novo (`/participacao/municipios`) e continua utilizável, mantendo a escolha se o município
 * existir no recorte novo. Desativado (e, por isso, não enviado: vale a UF inteira) sem UF, com a UF fora da fonte do ano,
 * durante a busca ou se ela falhar. Sem JavaScript, vale o fluxo em dois envios: UF primeiro, município depois.
 */
export function MunicipalityField({ loaded, value, errors, choices, coverage }: {
  loaded: { uf: string; year: string }; value: string; errors: QueryError[]; choices: Choice[]; coverage: TurnoutCoverage;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const selection = useFormSelection(anchor, { office: '', uf: loaded.uf, round: '', year: loaded.year });
  const year = selection.year ?? loaded.year;
  const current = useRef(value);
  const missing = Boolean(selection.uf) && (coverage[year]?.missingUfs ?? []).includes(selection.uf);
  const stale = selection.uf !== loaded.uf || year !== loaded.year;
  const remote = useRemoteChoices(stale && selection.uf && !missing ? `/participacao/municipios?${new URLSearchParams({ year, uf: selection.uf })}` : null, parse);
  const all = (uf: string) => `Todos os municípios de ${ufName(uf)} na fonte de ${year}; “Toda a UF” soma todos eles.`;
  let field, hint;
  if (!selection.uf) [field, hint] = [disabled('Toda a UF'), 'Escolha uma UF para listar os seus municípios.'];
  else if (missing) [field, hint] = [disabled('Toda a UF'), `O arquivo de comparecimento por perfil de ${year} não traz ${ufName(selection.uf)}: não há municípios a listar.`];
  else if (!stale) [field, hint] = choices.length
    ? [<QuerySelect key="loaded" id="municipality" name="municipality" value={value} errors={errors} hintId="municipality-hint" choices={[{ value: '', label: 'Toda a UF' }, ...choices]} />, all(selection.uf)]
    : [disabled('Toda a UF'), 'Lista de municípios indisponível para este recorte; a consulta vale para a UF inteira.'];
  else if (remote?.status === 'ready') {
    const kept = remote.body!.some((choice) => choice.value === current.current) ? current.current : '';
    [field, hint] = [<select key={remote.url} id="municipality" name="municipality" defaultValue={kept} aria-describedby="municipality-hint">
      {[{ value: '', label: 'Toda a UF' }, ...remote.body!].map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>, `${all(selection.uf)} Envie para ver a participação.`];
  } else if (remote?.status === 'failed') [field, hint] = [disabled('Toda a UF'), 'Não foi possível listar os municípios da UF escolhida; envie para atualizar a lista. Até lá, a consulta vale para a UF inteira.'];
  else [field, hint] = [disabled('Carregando os municípios…'), 'Listando os municípios da UF escolhida…'];
  return <div ref={anchor} className="field" onChange={(event) => { const target = event.target; if (target instanceof HTMLSelectElement && target.id === 'municipality') current.current = target.value; }}>
    <label htmlFor="municipality">Município <span className="optional-label">(opcional)</span></label>
    {field}
    <p className="field-hint" id="municipality-hint" aria-live="polite">{hint}</p>
  </div>;
}
