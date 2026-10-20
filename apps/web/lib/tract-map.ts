import type { TractMap } from '@observatorio/contracts';
import { RAMPS } from '../components/choropleth';

type Published = Extract<TractMap, { status: 'published' }>;
type View = Published['views'][number];

/** Faixas fixas de renda (1 = menor): mesma escala sequencial dos mapas; setores sem faixa em tom neutro. */
export const BAND_COLORS = RAMPS.teal;
export const NO_BAND = '#dedcd3';
const POINT = '#1b1b1b';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Imagem SVG da vista: setores pela faixa de renda mediana do responsável e locais de votação como pontos neutros (cheio: associado;
 * vazado: com coordenada, mas sem setor). Servida à parte, como imagem, para não repetir o desenho no HTML da página.
 */
export function tractMapSvg(data: Published, title: string) {
  const { width, height } = data.view;
  const tracts = data.tracts ?? [];
  // Um caminho por cor: a imagem só precisa do preenchimento, e agrupar reduz o tamanho.
  const groups = new Map<string, string[]>();
  for (const tract of tracts) {
    const fill = tract.band === null ? NO_BAND : BAND_COLORS[tract.band - 1]!;
    (groups.get(fill) ?? groups.set(fill, []).get(fill)!).push(tract.path);
  }
  const areas = [...groups].map(([fill, paths]) => `<path fill="${fill}" d="${paths.join(' ')}"/>`).join('');
  const points = data.places.filter((place) => place.x !== null && place.y !== null)
    .sort((a, b) => Number(a.tract !== null) - Number(b.tract !== null))
    .map((place) => place.tract !== null ? `<circle cx="${place.x}" cy="${place.y}" r="3.2" class="associated"/>` : `<circle cx="${place.x}" cy="${place.y}" r="3.2" class="unassociated"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(title)}">`
    + `<style>.areas{stroke:#fbfaf6;stroke-width:.35;stroke-linejoin:round}.associated{fill:${POINT};stroke:#fff;stroke-width:1}.unassociated{fill:#fff;stroke:${POINT};stroke-width:1.4}`
    + '@media (prefers-color-scheme:dark){.areas{stroke:#20262a}}</style>'
    + `<title>${escape(title)}</title><g class="areas" fill-rule="evenodd">${areas}</g><g>${points}</g></svg>`;
}

/** Vista que contém esta (a menor entre as que são prefixo dela); a do município não tem. */
export function parentView(views: View[], view: View) {
  return views.filter((item) => item.id !== view.id && view.id.startsWith(item.id)).sort((a, b) => b.id.length - a.id.length)[0] ?? null;
}
/** Vistas imediatamente abaixo desta (as que a têm como `parentView`). */
export function childViews(views: View[], view: View) {
  return views.filter((item) => item.id !== view.id && parentView(views, item)?.id === view.id);
}
/** Caminho de vistas do município até esta, para a navegação. */
export function viewTrail(views: View[], view: View) {
  const trail: View[] = [];
  for (let current: View | null = view; current; current = parentView(views, current)) trail.unshift(current);
  return trail;
}
export const LEVEL_LABELS: Record<View['level'], string> = { municipality: 'Município', district: 'Distrito', subdistrict: 'Subdistrito' };
export const viewName = (view: View, municipality: string) => view.level === 'municipality' ? municipality : `${LEVEL_LABELS[view.level]} ${view.name || view.id}`;

export function tractMapHref(code: string, uf: string, view?: string, suffix = '') {
  const params = new URLSearchParams({ uf });
  if (view) params.set('view', view);
  return `/municipios/${code}/setores${suffix}?${params}`;
}
