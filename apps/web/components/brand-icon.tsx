type BrandIconName = 'results' | 'territory' | 'population' | 'participation' | 'proposals' | 'sources' | 'methodology';

const paths: Record<BrandIconName, React.ReactNode> = {
  results: <><path d="M4 20V12H8V20M10 20V8H14V20M16 20V4H20V20" /></>,
  territory: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15" /></>,
  population: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-2a7 7 0 0 1 14 0v2ZM17 4a3 3 0 0 1 0 6M18 14a6 6 0 0 1 4 5v2" /></>,
  participation: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  proposals: <><path d="M12 21H5V3h9l5 5v3M14 3v6h5" /><circle cx="16" cy="16" r="3.5" /><path d="m18.5 18.5 2.5 2.5" /></>,
  sources: <><path d="M5 3h9l5 5v13H5ZM14 3v6h5M9 13h6M9 17h6" /></>,
  methodology: <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 6h5a4 4 0 0 1 4 4v5M6 9v5a4 4 0 0 0 4 4h5" /></>,
};

export function BrandIcon({ name, className }: { name: BrandIconName; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
