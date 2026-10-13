import type { QueryError } from '../lib/query-ui';

export function FieldError({ field, errors, prefix = '' }: { field: string; errors: QueryError[]; prefix?: string }) {
  const error = errors.find((item) => item.field === field);
  return error ? <p className="field-error" id={`${prefix}${field}-error`}>{error.message}</p> : null;
}

export function QuerySelect({ id, name, value, choices, errors, hintId }: {
  id: string; name: string; value: string; choices: Array<{ value: string; label: string }>; errors: QueryError[]; hintId?: string;
}) {
  const invalid = errors.some((error) => error.field === name);
  const prefix = id.slice(0, id.length - name.length);
  return <><select id={id} name={name} defaultValue={value} aria-invalid={invalid || undefined}
    aria-describedby={[hintId, invalid ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined}>
    {!choices.some((choice) => choice.value === value) && <option value={value}>Valor informado: {value}</option>}
    {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
  </select><FieldError field={name} errors={errors} prefix={prefix} /></>;
}

export function TurnField({ value, errors, prefix = '' }: { value: string; errors: QueryError[]; prefix?: string }) {
  const invalid = errors.some((error) => error.field === 'round');
  return <fieldset className="field turn-field" id={`${prefix}round`} aria-invalid={invalid || undefined}
    aria-describedby={invalid ? `${prefix}round-error` : undefined}>
    <legend>Turno</legend><div className="turn-options">{['1', '2'].map((round) => <label className="turn-choice" key={round}>
      <input id={`${prefix}round-${round}`} type="radio" name="round" value={round} defaultChecked={value === round} required aria-invalid={invalid || undefined} aria-describedby={invalid ? `${prefix}round-error` : undefined} /><span>{round}º turno</span>
    </label>)}{!['1', '2'].includes(value) && <label className="turn-choice invalid-choice"><input type="radio" name="round" value={value} defaultChecked /><span>Turno informado: {value}</span></label>}</div>
    <FieldError field="round" errors={errors} prefix={prefix} />
  </fieldset>;
}

export function ErrorSummary({ errors, targets }: { errors: QueryError[]; targets: Record<string, string> }) {
  return errors.length > 0 ? <div className="query-errors" role="alert" tabIndex={-1} id="query-errors">
    <h3>Confira os filtros da consulta</h3><ul>{errors.map((error) => <li key={error.field}>
      <a href={`#${targets[error.field] ?? 'submit-query'}`}>{error.message}</a>
    </li>)}</ul>
  </div> : null;
}
