import { gzipSync } from 'node:zlib';
import { tractMapQuerySchema } from '@observatorio/contracts';
import { getTractMap } from '../../../../../lib/results';
import { tractMapSvg } from '../../../../../lib/tract-map';

// Imagem do mapa local → setor: mesma consulta da página, com os caminhos dos setores. A tabela da página é o equivalente acessível.
export const dynamic = 'force-dynamic';
const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = tractMapQuerySchema.omit({ paths: true }).safeParse(query);
  if (!/^\d+$/.test(code) || !parsed.success) return text('Endereço do mapa inválido.', 400);
  const result = await getTractMap(code, parsed.data.uf, parsed.data.year, parsed.data.view, true);
  if (result.kind === 'missing') return text('Município ou vista inexistente.', 404);
  if (result.kind !== 'ready') return text('Não foi possível consultar ou validar o mapa; tente novamente.', 503);
  if (result.data.status !== 'published') return text('Mapa sem publicação.', 404);
  if (result.data.view.split) return text('Vista dividida: escolha uma das menores.', 404);
  const svg = tractMapSvg(result.data, 'Setores censitários pela faixa de renda mediana do responsável e locais de votação');
  const headers = { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' };
  // O servidor do Next não comprime esta resposta; sem gzip, o desenho de uma capital passaria de 900 KB.
  if (/\bgzip\b/.test(request.headers.get('accept-encoding') ?? '')) return new Response(gzipSync(svg), { headers: { ...headers, 'Content-Encoding': 'gzip' } });
  return new Response(svg, { headers });
}
