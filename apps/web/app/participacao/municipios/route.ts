import { ELECTION_YEARS, STATES } from '@observatorio/contracts';
import { getTurnoutProfiles } from '../../../lib/results';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const isYear = (value: string | null): value is (typeof ELECTION_YEARS)[number] => (ELECTION_YEARS as readonly (string | null)[]).includes(value);
const isUf = (value: string | null): value is (typeof STATES)[number] => (STATES as readonly (string | null)[]).includes(value);

/**
 * Municípios de uma UF na publicação do comparecimento por perfil do ano, para o campo "Município" de `/participacao` acompanhar
 * ano e UF antes do envio. A lista é a mesma em todos os turnos da publicação; consulta-se o 1º, presente em todas as fontes.
 * UF fora da fonte (DF em 2022) responde `not-in-source` sem municípios; nada é estimado.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams, year = params.get('year'), uf = params.get('uf');
  if (!isYear(year) || !isUf(uf) || [...params.keys()].some((key) => key !== 'year' && key !== 'uf')) return json({ status: 'invalid', choices: [] }, 400);
  const data = await getTurnoutProfiles({ year, round: '1', uf });
  if (!data) return json({ status: 'unavailable', choices: [] }, 503);
  return json({ status: data.status, choices: (data.municipalities ?? []).map((item) => ({ value: item.code, label: item.name })) });
}
