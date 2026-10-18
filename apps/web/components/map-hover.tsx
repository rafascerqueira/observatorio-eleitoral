'use client';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

type Tip = { name: string; value: string; x: number; y: number; flip: boolean };

/**
 * Dica ao passar o mouse sobre as áreas dos mapas (`data-label`/`data-value` de `Choropleth`). Com JavaScript, substitui o
 * `<title>` nativo, que demora a aparecer e não pode ser estilizado; sem JavaScript, o `<title>` continua. Só complementa:
 * teclado e leitor de tela usam a tabela dos mapas, com os mesmos valores.
 */
export function MapHover({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    // As áreas são estáticas (renderizadas no servidor): remover o `<title>` uma vez evita duas dicas sobrepostas.
    for (const title of root.current?.querySelectorAll('[data-label] > title') ?? []) title.remove();
  }, []);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return;
    const target = (event.target as Element).closest?.('[data-label]');
    const box = root.current?.getBoundingClientRect();
    if (!target || !box) { setTip(null); return; }
    const x = event.clientX - box.left, y = event.clientY - box.top;
    // Perto da borda direita, a dica abre para a esquerda do cursor, sem sair do contêiner.
    setTip({ name: target.getAttribute('data-label') ?? '', value: target.getAttribute('data-value') ?? '', x, y, flip: x > box.width - 220 });
  }
  return <div ref={root} className={`map-hover${className ? ` ${className}` : ''}`} onPointerMove={move} onPointerLeave={() => setTip(null)}>
    {children}
    {tip && <div className={`map-tooltip${tip.flip ? ' is-flipped' : ''}`} style={{ left: tip.x, top: tip.y }} aria-hidden="true"><strong>{tip.name}</strong><span>{tip.value}</span></div>}
  </div>;
}
