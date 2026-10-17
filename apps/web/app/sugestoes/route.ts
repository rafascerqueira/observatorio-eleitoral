import { suggestQuerySchema, suggestResponseSchema } from '@observatorio/contracts';

// Proxy das sugestões: o navegador não conhece o endereço interno da API; a resposta é revalidada pelo contrato.
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const parsed = suggestQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ status: 'invalid', items: [] }, { status: 400 });
  try {
    const url = new URL('/elections/municipalities/suggest', process.env.API_URL ?? 'http://127.0.0.1:3001');
    for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!response.ok) return Response.json({ status: 'unavailable', items: [] }, { status: response.status === 400 ? 400 : 503 });
    return Response.json(suggestResponseSchema.parse(await response.json()), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ status: 'unavailable', items: [] }, { status: 503 }); }
}
