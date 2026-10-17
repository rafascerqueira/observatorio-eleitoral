import type { QueryError } from '../lib/query-ui';

export function FieldError({ field, errors, prefix = '' }: { field: string; errors: QueryError[]; prefix?: string }) {
  const error = errors.find((item) => item.field === field);
  return error ? <p className="field-error" id={`${prefix}${field}-error`}>{error.message}</p> : null;
}

export function QuerySelect({ id, name, value, choices, errors, hintId, disabledValues = [] }: {
  id: string; name: string; value: string; choices: Array<{ value: string; label: string }>; errors: QueryError[]; hintId?: string; disabledValues?: readonly string[];
}) {
  const invalid = errors.some((error) => error.field === name);
  const prefix = id.slice(0, id.length - name.length);
  return <><select id={id} name={name} defaultValue={value} aria-invalid={invalid || undefined}
    aria-describedby={[hintId, invalid ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined}>
    {!choices.some((choice) => choice.value === value) && <option value={value}>Valor informado: {value}</option>}
    {choices.map((choice) => <option key={choice.value} value={choice.value} disabled={disabledValues.includes(choice.value) || undefined}>{choice.label}</option>)}
  </select><FieldError field={name} errors={errors} prefix={prefix} /></>;
}

/** Grupo de opções visíveis (radios nativos com aparência segmentada); aplica somente ao enviar o formulário. */
function ChoiceGroup({ name, legend, value, choices, errors, prefix = '', hint, hintId, invalidLabel, className = '' }: {
  name: string; legend: string; value: string; choices: Array<{ value: string; label: string }>; errors: QueryError[]; prefix?: string;
  hint?: string | null; hintId?: string; invalidLabel: string; className?: string;
}) {
  const invalid = errors.some((error) => error.field === name);
  const known = choices.some((choice) => choice.value === value);
  const describedBy = [hint ? hintId : undefined, invalid ? `${prefix}${name}-error` : undefined].filter(Boolean).join(' ') || undefined;
  return <fieldset className={`field choice-field ${className}`} id={`${prefix}${name}`} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
    <legend>{legend}</legend>
    <div className="segmented" data-count={choices.length + (known ? 0 : 1)}>{choices.map((choice) => <label className="segmented-choice" key={choice.value}>
      <input id={`${prefix}${name}-${choice.value}`} type="radio" name={name} value={choice.value} defaultChecked={value === choice.value} required aria-invalid={invalid || undefined} aria-describedby={describedBy} /><span>{choice.label}</span>
    </label>)}{!known && <label className="segmented-choice invalid-choice"><input type="radio" name={name} value={value} defaultChecked /><span>{`${invalidLabel}: ${value}`}</span></label>}</div>
    {hint && <p className="field-hint" id={hintId}>{hint}</p>}
    <FieldError field={name} errors={errors} prefix={prefix} />
  </fieldset>;
}

export function OfficeField({ value, errors, choices, hint }: { value: string; errors: QueryError[]; choices: Array<{ value: string; label: string }>; hint: string }) {
  return <ChoiceGroup name="office" legend="Cargo" value={value} choices={choices} errors={errors} hint={hint} hintId="office-hint" invalidLabel="Cargo informado" className="office-field" />;
}

/** Turnos oferecidos conforme os dados; valor fora de 1/2 é preservado como inválido, nunca trocado em silêncio. */
export function TurnField({ value, errors, prefix = '', rounds = ['1', '2'], note }: { value: string; errors: QueryError[]; prefix?: string; rounds?: readonly string[]; note?: string | null }) {
  return <ChoiceGroup name="round" legend="Turno" value={value} errors={errors} prefix={prefix} hint={note} hintId={`${prefix}round-hint`} invalidLabel="Turno informado" className="turn-field"
    choices={rounds.map((round) => ({ value: round, label: `${round}º turno` }))} />;
}

export function ErrorSummary({ errors, targets }: { errors: QueryError[]; targets: Record<string, string> }) {
  return errors.length > 0 ? <div className="query-errors" role="alert" tabIndex={-1} id="query-errors">
    <h3>Confira os filtros da consulta</h3><ul>{errors.map((error) => <li key={error.field}>
      <a href={`#${targets[error.field] ?? 'submit-query'}`}>{error.message}</a>
    </li>)}</ul>
  </div> : null;
}
