import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import './atlas.css';
import './forms.css';

export const metadata: Metadata = {
  title: { default: 'Observatório eleitoral brasileiro', template: '%s · Observatório eleitoral' },
  description: 'Explore resultados eleitorais e contexto territorial com fontes oficiais e metodologia transparente. Projeto em construção.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
        <header className="site-header">
          <div className="container header-inner">
            <Link className="brand" href="/" aria-label="Observatório eleitoral — início">
              <span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span>
              <span>Observatório <strong>eleitoral</strong></span>
            </Link>
            <nav aria-label="Navegação principal">
              <Link href="/">Explorar</Link>
              <Link href="/mapa">Mapa</Link>
              <Link href="/perfis">Perfis</Link>
              <Link href="/participacao">Participação</Link>
              <Link href="/fontes">Fontes</Link>
              <Link href="/metodologia">Metodologia</Link>
            </nav>
          </div>
        </header>
        <main id="conteudo" className="container" tabIndex={-1}>{children}</main>
        <footer className="container site-footer">
          <p>Uma iniciativa independente, gratuita e sem fins lucrativos.</p>
          <p>Nome provisório · Projeto em construção</p>
        </footer>
      </body>
    </html>
  );
}
