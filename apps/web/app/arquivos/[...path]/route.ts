// Proxy em fluxo: o navegador não precisa conhecer o endereço interno da API.
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const source = path.length === 3 && path[0] === 'sources' && /^[a-f0-9]{64}$/.test(path[1]!) && /^[a-zA-Z0-9_]+\.zip$/.test(path[2]!);
  const report = path.length === 3 && path[0] === 'imports' && /^[a-f0-9]{64}$/.test(path[1]!) && path[2] === 'report';
  if (!source && !report) return new Response('Arquivo não encontrado.', { status: 404 });
  try {
    const response = await fetch(new URL(`/elections/${path.join('/')}`, process.env.API_URL ?? 'http://127.0.0.1:3001'), { cache: 'no-store', signal: AbortSignal.timeout(600_000) });
    if (!response.ok) return new Response(response.status === 404 ? 'Arquivo ainda indisponível.' : 'Não foi possível verificar o arquivo.', { status: response.status === 404 ? 404 : 503 });
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const key of ['content-type', 'content-length', 'content-disposition']) { const value = response.headers.get(key); if (value) headers.set(key, value); }
    return new Response(response.body, { headers });
  } catch { return new Response('Serviço de arquivos indisponível.', { status: 503 }); }
}
