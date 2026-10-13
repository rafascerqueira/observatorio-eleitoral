'use client';
import { useEffect, useRef, useState, useTransition, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formFingerprint, queryHref } from '../lib/query-navigation';

export function QueryForm({ action, children, label, hintId, className, submitLabel, secondary, hasErrors = false }: {
  action: string; children: ReactNode; label: string; hintId?: string; className: string; submitLabel: string; secondary?: ReactNode; hasErrors?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const initial = useRef('');
  useEffect(() => {
    if (form.current) initial.current = formFingerprint(new FormData(form.current));
    if (hasErrors) document.getElementById('query-errors')?.focus();
  }, [hasErrors]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const href = queryHref(action, new FormData(event.currentTarget));
    startTransition(() => router.push(href, { scroll: false }));
  }
  return <form ref={form} action={action} method="get" noValidate onSubmit={submit}
    onChange={() => { if (form.current) setDirty(formFingerprint(new FormData(form.current)) !== initial.current); }}
    className="query-form" aria-label={label} aria-describedby={hintId} data-pending={pending || undefined}>
    <fieldset disabled={pending} className={`query-controls ${className}`}><legend className="sr-only">{label}</legend>
      {children}
      <div className="query-actions"><button id="submit-query" type="submit" disabled={pending}>{pending ? 'Consultando…' : submitLabel}<span aria-hidden="true"> →</span></button>{secondary}</div>
    </fieldset>
    <p className="query-feedback" role="status" aria-live="polite" aria-atomic="true">
      {pending ? 'Consultando os dados. Aguarde a atualização dos resultados.' : dirty ? 'Filtros alterados. Envie a consulta para atualizar os resultados.' : 'Os filtros só são aplicados ao enviar a consulta.'}
    </p>
  </form>;
}
