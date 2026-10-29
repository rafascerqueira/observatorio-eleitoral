import { useEffect, useState, type RefObject } from 'react';

export type FormSelection = { office: string; uf: string; round: string; year?: string };

function read(form: HTMLFormElement, fallback: FormSelection): FormSelection {
  const value = (name: string, current: string) => {
    const field = form.elements.namedItem(name) as RadioNodeList | HTMLInputElement | HTMLSelectElement | null;
    return field ? field.value : current;
  };
  return { office: value('office', fallback.office), uf: value('uf', fallback.uf), round: value('round', fallback.round), ...(fallback.year === undefined ? {} : { year: value('year', fallback.year) }) };
}

/** Acompanha cargo, UF e turno do formulário que contém `anchor`, sem enviá-lo. O servidor continua decidindo no envio. */
export function useFormSelection(anchor: RefObject<HTMLElement | null>, initial: FormSelection) {
  const [selection, setSelection] = useState(initial);
  useEffect(() => {
    const form = anchor.current?.closest('form');
    if (!form) return;
    const update = () => setSelection((current) => {
      const next = read(form, current);
      return next.office === current.office && next.uf === current.uf && next.round === current.round && next.year === current.year ? current : next;
    });
    form.addEventListener('change', update);
    return () => form.removeEventListener('change', update);
  }, [anchor]);
  return selection;
}
