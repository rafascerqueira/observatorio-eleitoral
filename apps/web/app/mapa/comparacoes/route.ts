import { candidateMapQuerySchema, isStateOffice } from '@observatorio/contracts';
import { getCandidateMap } from '../../../lib/results';
import { seriesChoices } from '../../../lib/map-series';

/**
 * Opções de “Comparar com” de um recorte (ano, cargo, UF, turno), para o campo do formulário de `/mapa` atualizar a lista quando o
 * recorte muda antes do envio. Só leitura; a página continua validando tudo no envio.
 */
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const raw = Object.fromEntries(new URL(request.url).searchParams);
  if (raw.uf === '') delete raw.uf;
  const parsed = candidateMapQuerySchema.safeParse(raw);
  if (!parsed.success) return json({ status: 'invalid', choices: [] }, 400);
  const { office, uf } = parsed.data;
  // Cargo estadual sem UF: a página pede a UF; só a abstenção, sem consultar candidaturas.
  if (isStateOffice(office) && !uf) return json({ status: 'needs-uf', choices: seriesChoices(office, null) });
  const candidates = await getCandidateMap(parsed.data);
  if (!candidates) return json({ status: 'unavailable', choices: [] }, 503);
  return json({ status: candidates.status, choices: seriesChoices(office, candidates) });
}
