'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="page-message" role="alert"><h1>Não foi possível abrir o painel</h1><p>Tente carregar a página novamente.</p><button onClick={reset}>Tentar novamente</button></div>;
}
