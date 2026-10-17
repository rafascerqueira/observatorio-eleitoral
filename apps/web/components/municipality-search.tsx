'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { suggestResponseSchema, type SuggestResponse } from '@observatorio/contracts';
import { highlightParts } from '../lib/suggest';
import { UF_NAMES } from '../lib/query-ui';

type Suggestion = SuggestResponse['items'][number];
const MATCH_LABEL: Record<Suggestion['match'], string | null> = { prefix: null, word: null, contains: null, similar: 'grafia parecida' };

/**
 * Município com sugestões enquanto se digita (padrão WAI-ARIA combobox + listbox; o foco vai às opções, como no GOV.UK).
 * Sem JavaScript, é o campo de busca textual de sempre. Escolher uma sugestão preenche o nome e a UF; nada é enviado
 * até "Consultar".
 */
export function MunicipalitySearch({ defaultValue, invalid, describedBy }: { defaultValue: string; invalid: boolean; describedBy: string }) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const options = useRef<Array<HTMLLIElement | null>>([]);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(defaultValue);
  const [status, setStatus] = useState('');
  useEffect(() => { setEnhanced(true); return () => { request.current?.abort(); if (timer.current) clearTimeout(timer.current); }; }, []);

  function scope() {
    const form = input.current?.form;
    const value = (name: string) => (form?.elements.namedItem(name) as RadioNodeList | HTMLSelectElement | null)?.value ?? '';
    return { office: value('office') || 'president', uf: value('uf'), year: value('year') || '2022' };
  }
  function search(value: string) {
    setTerm(value);
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    if (value.trim().length < 2) { setItems([]); setOpen(false); setStatus(''); return; }
    const { office, uf, year } = scope();
    if (office !== 'president' && !uf) { setItems([]); setOpen(false); setStatus('Escolha a UF para ver sugestões de municípios.'); return; }
    // Espera curta entre teclas; a requisição anterior é cancelada.
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const params = new URLSearchParams({ q: value.trim(), office, year, ...(uf && uf !== 'ZZ' ? { uf } : {}) });
        const response = await fetch(`/sugestoes?${params}`, { signal: controller.signal });
        const data = suggestResponseSchema.safeParse(await response.json());
        if (!response.ok || !data.success) { setItems([]); setOpen(false); setStatus('Sugestões indisponíveis agora; a busca pelo nome continua funcionando.'); return; }
        setItems(data.data.items); setOpen(data.data.items.length > 0);
        setStatus(data.data.items.length ? `${data.data.items.length} ${data.data.items.length === 1 ? 'sugestão' : 'sugestões'}. Use as setas para escolher.` : 'Nenhum município sugerido; a busca pelo nome continua disponível.');
      } catch (error) { if ((error as Error).name !== 'AbortError') { setItems([]); setOpen(false); } }
    }, 150);
  }
  function choose(item: Suggestion) {
    const field = input.current!;
    field.value = item.name; setTerm(item.name);
    const uf = field.form?.elements.namedItem('uf') as HTMLSelectElement | null;
    // A UF da sugestão desfaz a ambiguidade de homônimos; o evento atualiza turnos e dicas do formulário.
    if (uf && uf.value !== item.uf) { uf.value = item.uf; uf.dispatchEvent(new Event('change', { bubbles: true })); }
    field.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false); setItems([]);
    setStatus(`Selecionado: ${item.name} / ${item.uf}. Envie a consulta para aplicar.`);
    field.focus();
  }
  function focusOption(index: number) {
    if (index < 0) { input.current?.focus(); return; }
    options.current[Math.min(index, items.length - 1)]?.focus();
  }
  function onInputKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && open) { event.preventDefault(); focusOption(0); }
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); }
  }
  function onOptionKey(event: KeyboardEvent<HTMLLIElement>, index: number) {
    if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(index + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(index - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(items[index]!); }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); input.current?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); focusOption(0); }
    else if (event.key === 'End') { event.preventDefault(); focusOption(items.length - 1); }
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Continuar digitando a partir de uma opção volta ao campo, sem perder a tecla.
      event.preventDefault(); const field = input.current!; field.value += event.key; field.focus(); search(field.value);
    }
  }

  return <div className="combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <input ref={input} type="search" id="search" name="search" placeholder="Buscar por nome" maxLength={100} defaultValue={defaultValue}
      autoComplete="off" spellCheck={false} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      {...(enhanced ? { role: 'combobox', 'aria-autocomplete': 'list' as const, 'aria-expanded': open, 'aria-controls': listId } : {})}
      onChange={(event) => search(event.currentTarget.value)} onKeyDown={onInputKey} />
    {enhanced && <ul id={listId} role="listbox" aria-label="Municípios sugeridos" className="suggestions" hidden={!open}>
      {items.map((item, index) => <li key={`${item.uf}/${item.code}`} ref={(element) => { options.current[index] = element; }} id={`${listId}-${index}`} role="option" tabIndex={-1} aria-selected={false}
        onKeyDown={(event) => onOptionKey(event, index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}
        onFocus={(event) => event.currentTarget.setAttribute('aria-selected', 'true')} onBlur={(event) => event.currentTarget.setAttribute('aria-selected', 'false')}>
        <span className="suggestion-name">{highlightParts(item.name, term).map((part, key) => part.match ? <mark key={key}>{part.text}</mark> : <span key={key}>{part.text}</span>)}</span>
        <span className="suggestion-uf">{UF_NAMES[item.uf]} · {item.uf}</span>
        {MATCH_LABEL[item.match] && <span className="suggestion-match">{MATCH_LABEL[item.match]}</span>}
      </li>)}
    </ul>}
    {enhanced && <p className="sr-only" role="status" aria-live="polite">{status}</p>}
  </div>;
}
