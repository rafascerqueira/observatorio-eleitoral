// Esqueleto sem números nem barras fictícias: só a forma do conteúdo que está chegando.
export default function Loading() {
  return <div className="page-message loading-skeleton" role="status">
    <h1>Consultando o painel…</h1><p>Aguarde enquanto verificamos a disponibilidade dos dados.</p>
    <div className="skeleton" aria-hidden="true"><span className="skeleton-line wide" /><span className="skeleton-grid"><i /><i /><i /><i /><i /><i /></span><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line short" /></div>
  </div>;
}
