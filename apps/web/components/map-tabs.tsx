import Link from 'next/link';

/** Navegação entre os dois mapas; a página atual fica marcada. */
export function MapTabs({ current }: { current: 'territory' | 'candidates' }) {
  return <nav className="map-tabs" aria-label="Mapas">
    <Link href="/mapa" aria-current={current === 'territory' ? 'page' : undefined}>Território e participação</Link>
    <Link href="/mapa/candidaturas" aria-current={current === 'candidates' ? 'page' : undefined}>Votação por candidatura</Link>
  </nav>;
}
