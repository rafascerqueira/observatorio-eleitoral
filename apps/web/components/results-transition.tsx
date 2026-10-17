import { ViewTransition, type ReactNode } from 'react';

/** Região de resultados: crossfade curto a cada consulta; troca de turno ganha direção. Sem suporte do navegador, troca direto. */
export function ResultsTransition({ id, transitionKey, children }: { id: string; transitionKey: string; children: ReactNode }) {
  return <ViewTransition key={transitionKey} name={`${id}-transition`} default="none" enter="results-fade"
    share={{ 'round-next': 'round-next', 'round-prev': 'round-prev', default: 'results-fade' }}>
    <div id={id} className="query-results">{children}</div>
  </ViewTransition>;
}
