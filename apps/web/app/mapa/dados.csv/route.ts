import { MAP_INDICATORS, mapPageQuerySchema, type MapValues } from '@observatorio/contracts';
import { getCandidateMap, getMapValues } from '../../../lib/results';
import { joinSeries, mapCsv, mapCsvName, resolveSeries } from '../../../lib/map-series';
import { UF_NAMES, officeScopeError } from '../../../lib/query-ui';

// Exportação da visão de `/mapa`, com os mesmos filtros e validações da página; nada é calculado além dos percentuais.
export const dynamic = 'force-dynamic';
const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // Filtro repetido é ambíguo: a página o recusa, e a exportação também.
  if (new Set(params.keys()).size !== [...params.keys()].length) return text('Filtro repetido no endereço; escolha um único valor para cada filtro.', 400);
  const raw = Object.fromEntries(params);
  if (raw.uf === '') delete raw.uf;
  const parsed = mapPageQuerySchema.safeParse(raw);
  if (!parsed.success || officeScopeError(parsed.data.office, parsed.data.uf)) return text('Filtros inválidos para a exportação; confira-os em /mapa.', 400);
  const filters = parsed.data;
  const recorte = { year: filters.year, round: filters.round, uf: filters.uf };
  const [census, candidates, abstention] = await Promise.all([getMapValues({ ...recorte, indicator: filters.indicator }),
    filters.series === 'abstention' ? null : getCandidateMap({ ...recorte, office: filters.office }),
    filters.series === 'abstention' ? getMapValues({ ...recorte, indicator: 'abstention', office: filters.office }) : null]);
  const state = resolveSeries(filters, candidates, abstention);
  if (state.status === 'unknown-candidate') return text(`A candidatura nº ${filters.series} não está no recorte escolhido.`, 400);
  if (state.status === 'round-not-held') return text('Turno não realizado para este cargo e território.', 404);
  if (state.status === 'awaiting-import' || census?.status === 'awaiting-import') return text('Recorte sem publicação.', 404);
  if (state.status !== 'ready' || census?.status !== 'published') return text('Não foi possível consultar ou validar os dados; tente novamente.', 503);
  const named = (items: MapValues['items']) => filters.uf ? items : items.map((item) => ({ ...item, name: UF_NAMES[item.uf] }));
  const contextId = census.publications?.find((item) => item.role === 'context')?.id ?? null;
  return new Response(mapCsv(joinSeries(named(census.items), state.series.items), MAP_INDICATORS[filters.indicator].label, state.series, contextId), { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${mapCsvName(filters)}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
