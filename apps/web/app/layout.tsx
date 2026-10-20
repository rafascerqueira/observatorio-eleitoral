import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandIcon } from '../components/brand-icon';
import './globals.css';
import './atlas.css';
import './forms.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Mente Eleitoral — votação e população', template: '%s · Mente Eleitoral' },
  applicationName: 'Mente Eleitoral',
  description: 'Um olhar único sobre votação e população. Explore resultados eleitorais e contexto territorial com dados oficiais do TSE e do IBGE e metodologia transparente.',
  openGraph: {
    title: 'Mente Eleitoral',
    siteName: 'Mente Eleitoral',
    description: 'Um olhar único sobre votação e população. Resultados eleitorais e contexto territorial com fontes oficiais.',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Mente Eleitoral', description: 'Um olhar único sobre votação e população.' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
        <header className="site-header">
          <div className="container header-inner">
            <Link className="brand" href="/" aria-label="Mente Eleitoral — início">
              <img src="/brand/logo.svg" width="254" height="79" alt="Mente Eleitoral" />
            </Link>
            <nav aria-label="Navegação principal">
              <Link href="/"><BrandIcon name="results" />Explorar</Link>
              <Link href="/mapa"><BrandIcon name="territory" />Mapa</Link>
              <Link href="/perfis"><BrandIcon name="population" />Perfis</Link>
              <Link href="/participacao"><BrandIcon name="participation" />Participação</Link>
              <Link href="/propostas"><BrandIcon name="proposals" />Propostas</Link>
              <Link href="/fontes"><BrandIcon name="sources" />Fontes</Link>
              <Link href="/metodologia"><BrandIcon name="methodology" />Metodologia</Link>
            </nav>
          </div>
        </header>
        <main id="conteudo" className="container" tabIndex={-1}>{children}</main>
        <footer className="container site-footer">
          <p>Uma iniciativa independente, gratuita e sem fins lucrativos.</p>
          <p>Mente Eleitoral · Um olhar único sobre votação e população.</p>
        </footer>
      </body>
    </html>
  );
}
