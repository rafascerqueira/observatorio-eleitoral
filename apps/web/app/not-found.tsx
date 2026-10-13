import Link from 'next/link';
export default function NotFound() {
  return <div className="page-message"><h1>Página não encontrada</h1><p>O endereço solicitado não está disponível.</p><Link href="/">Voltar à consulta</Link></div>;
}
