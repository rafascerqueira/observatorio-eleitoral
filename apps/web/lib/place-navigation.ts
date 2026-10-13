import type { PlacesQuery } from '@observatorio/contracts';

export function placesHref(code: string, filters: PlacesQuery, overrides: Partial<PlacesQuery> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...overrides })) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return `/${filters.uf === 'ZZ' ? 'exterior' : 'municipios'}/${encodeURIComponent(code)}?${params}`;
}

export function clearPlacesHref(code: string, filters: PlacesQuery) {
  return placesHref(code, filters, { zone: undefined, section: undefined, local: undefined, search: undefined, page: 1 });
}
