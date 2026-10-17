import { placeGroupsSchema, mapGeometrySchema, mapValuesSchema, contextResponseSchema, catalogSchema, municipalitiesSchema, placesResponseSchema, nationalResponseSchema, exteriorResponseSchema, stateResponseSchema, type ExteriorQuery, type NationalQuery, type NationalResponse, type MunicipalitiesResponse, type MunicipalityQuery, type PlacesQuery, type StateQuery, type StateResponse } from '@observatorio/contracts';

export async function getExterior(filters: ExteriorQuery) {
  try {
    const url = new URL('/elections/exterior', process.env.API_URL ?? 'http://127.0.0.1:3001');
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { kind: 'unavailable' as const };
    return { kind: 'ready' as const, data: exteriorResponseSchema.parse(await response.json()) };
  } catch { return { kind: 'unavailable' as const }; }
}

export async function getNational(filters: NationalQuery): Promise<{ kind: 'ready'; data: NationalResponse } | { kind: 'unavailable' }> {
  try {
    const url = new URL('/elections/national', process.env.API_URL ?? 'http://127.0.0.1:3001');
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { kind: 'unavailable' };
    return { kind: 'ready', data: nationalResponseSchema.parse(await response.json()) };
  } catch { return { kind: 'unavailable' }; }
}

export async function getState(filters: StateQuery): Promise<{ kind: 'ready'; data: StateResponse } | { kind: 'unavailable' }> {
  try {
    const url = new URL('/elections/state', process.env.API_URL ?? 'http://127.0.0.1:3001');
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { kind: 'unavailable' };
    return { kind: 'ready', data: stateResponseSchema.parse(await response.json()) };
  } catch { return { kind: 'unavailable' }; }
}

export async function getCatalog() {
  try {
    const response = await fetch(new URL('/elections/catalog', process.env.API_URL ?? 'http://127.0.0.1:3001'), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return catalogSchema.parse(await response.json());
  } catch { return null; }
}

export type ResultsState = { kind: 'ready'; data: MunicipalitiesResponse } | { kind: 'unavailable' };
export async function getMunicipalities(filters: MunicipalityQuery): Promise<ResultsState> {
  try {
    const url = new URL('/elections/municipalities', process.env.API_URL ?? 'http://127.0.0.1:3001');
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { kind: 'unavailable' };
    const result = municipalitiesSchema.safeParse(await response.json());
    if (!result.success) return { kind: 'unavailable' };
    return { kind: 'ready', data: result.data };
  } catch {
    return { kind: 'unavailable' };
  }
}

export async function getPlaces(code: string, filters: PlacesQuery) {
  try {
    const path = filters.uf === 'ZZ' ? `/elections/exterior/cities/${encodeURIComponent(code)}/places` : `/elections/municipalities/${encodeURIComponent(code)}/places`;
    const url = new URL(path, process.env.API_URL ?? 'http://127.0.0.1:3001');
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.status === 404) {
      const body = await response.json().catch(() => null) as { reason?: string } | null;
      return { kind: body?.reason === 'round-not-held' ? 'round-not-held' as const : 'missing' as const };
    }
    if (!response.ok) return { kind: 'unavailable' as const };
    return { kind: 'ready' as const, data: placesResponseSchema.parse(await response.json()) };
  } catch { return { kind: 'unavailable' as const }; }
}

export async function getContext(code: string, uf: string, year: string) {
  try {
    const url = new URL(`/elections/municipalities/${encodeURIComponent(code)}/context`, process.env.API_URL ?? 'http://127.0.0.1:3001');
    url.searchParams.set('uf', uf); url.searchParams.set('year', year);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.status === 404) return { kind: 'missing' as const };
    if (!response.ok) return { kind: 'unavailable' as const };
    return { kind: 'ready' as const, data: contextResponseSchema.parse(await response.json()) };
  } catch { return { kind: 'unavailable' as const }; }
}

async function mapRequest(path: 'geometry' | 'values', params: Record<string, string | undefined>): Promise<unknown> {
  try {
    const url = new URL(`/elections/map/${path}`, process.env.API_URL ?? 'http://127.0.0.1:3001');
    for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
export async function getMapGeometry(uf?: string) { const body = await mapRequest('geometry', { uf }); const parsed = mapGeometrySchema.safeParse(body); return parsed.success ? parsed.data : null; }
export async function getMapValues(params: Record<string, string | undefined>) { const body = await mapRequest('values', params); const parsed = mapValuesSchema.safeParse(body); return parsed.success ? parsed.data : null; }

export async function getPlaceGroups(params: Record<string, string | undefined>) {
  try {
    const url = new URL('/elections/places/groups', process.env.API_URL ?? 'http://127.0.0.1:3001');
    for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const parsed = placeGroupsSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

