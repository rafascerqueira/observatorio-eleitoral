import Link from 'next/link';

export type AppliedFilter = { label: string; value: string; removeHref?: string };

/** Filtros efetivamente aplicados na consulta; remover é um link GET, que funciona sem JavaScript. */
export function AppliedFilters({ items }: { items: AppliedFilter[] }) {
  return <ul className="applied-filters" aria-label="Filtros aplicados">{items.map((item) => <li key={item.label} className="filter-chip">
    <span className="chip-label">{item.label}:</span> {item.value}
    {item.removeHref && <Link className="chip-remove" href={item.removeHref} aria-label={`Remover filtro ${item.label}: ${item.value}`}><span aria-hidden="true">×</span></Link>}
  </li>)}</ul>;
}
