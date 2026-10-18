import { geoBounds, geoConicEqualArea, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { MapValues } from '@observatorio/contracts';

// Escalas sequenciais de uma só tonalidade, validadas (claridade monotônica, saltos ≥ 0,06, classe clara ≥ 2:1 sobre a superfície).
export const RAMPS = { teal: ['#94bcbd', '#68999e', '#447a83', '#2a5a66', '#153b47'], copper: ['#dcab83', '#c6875c', '#a9653d', '#814628', '#592c17'] } as const;
const NO_DATA = '#dedcd3';
const WIDTH = 600, MAX_HEIGHT = 560, MARGIN = 8, INSET_WIDTH = 150, INSET_HEIGHT = 64;
type Item = MapValues['items'][number];
export type Topology = { type: 'Topology'; objects: Record<string, unknown> } & Parameters<typeof feature>[0];

/** Limites dos quintis (interpolação linear entre valores ordenados): cada classe reúne cerca de 1/5 das unidades com dado. */
export function quintileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return [];
  return [1, 2, 3, 4].map((step) => { const position = (sorted.length - 1) * step / 5; const low = Math.floor(position); return sorted[low]! + (sorted[Math.min(low + 1, sorted.length - 1)]! - sorted[low]!) * (position - low); });
}
export const classOf = (value: number, breaks: number[]) => breaks.filter((limit) => value > limit).length;
const pct = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export type MapShape = { id: string; d: string };
export type ProjectedMap = { shapes: MapShape[]; height: number; insets: Array<{ name: string; x: number; y: number; width: number; height: number }> };
/** Territórios distantes do continente desenhados em quadro destacado, para não esticar o mapa da UF (código IBGE → nome). */
const INSETS: Record<string, string> = { '2605459': 'Fernando de Noronha' };
/** Projeta a malha uma única vez (cônica de áreas iguais centrada no recorte); os dois mapas reutilizam os contornos. */
export function projectShapes(topology: Topology): ProjectedMap {
  const object = Object.values(topology.objects)[0] as Parameters<typeof feature>[1];
  const all = feature(topology, object) as unknown as { type: 'FeatureCollection'; features: Array<{ properties: { codarea: string } } & GeoPermissibleObjects> };
  // Um território em quadro destacado só faz sentido quando há outros municípios no recorte (mapa da UF, não do Brasil).
  const remote = all.features.length > 1 ? all.features.filter((shape) => INSETS[shape.properties.codarea]) : [];
  const collection = { ...all, features: all.features.filter((shape) => !remote.includes(shape)) };
  const [[west, south], [east, north]] = geoBounds(collection as GeoPermissibleObjects);
  const span = north - south;
  const projection = geoConicEqualArea().rotate([-(west + east) / 2, 0]).parallels([south + span / 6, north - span / 6]);
  // A altura acompanha a forma do recorte (UFs largas não deixam faixas vazias); a largura é sempre a mesma.
  projection.fitWidth(WIDTH - 2 * MARGIN, collection as GeoPermissibleObjects);
  const [[, top], [, bottom]] = geoPath(projection).bounds(collection as GeoPermissibleObjects);
  // Quadros destacados ocupam uma faixa própria acima do mapa, sem cobrir municípios.
  const band = remote.length ? INSET_HEIGHT + MARGIN : 0;
  const height = Math.min(MAX_HEIGHT, Math.ceil(bottom - top) + 2 * MARGIN + band);
  projection.fitExtent([[MARGIN, MARGIN + band], [WIDTH - MARGIN, height - MARGIN]], collection as GeoPermissibleObjects);
  // Uma casa decimal basta na escala do SVG e reduz muito o tamanho da página.
  const path = geoPath(projection).digits(1);
  const shapes = collection.features.map((shape) => ({ id: shape.properties.codarea, d: path(shape) ?? '' }));
  const insets: ProjectedMap['insets'] = [];
  for (const [index, shape] of remote.entries()) {
    const box = { name: INSETS[shape.properties.codarea]!, x: WIDTH - MARGIN - (index + 1) * (INSET_WIDTH + MARGIN) + MARGIN, y: MARGIN, width: INSET_WIDTH, height: INSET_HEIGHT };
    const inset = geoConicEqualArea().fitExtent([[box.x + 8, box.y + 8], [box.x + box.width - 8, box.y + box.height - 18]], shape);
    shapes.push({ id: shape.properties.codarea, d: geoPath(inset).digits(1)(shape) ?? '' });
    insets.push(box);
  }
  return { shapes, height, insets };
}
/** Contornos definidos uma vez no documento; cada mapa os referencia com `<use>`. */
export function MapShapeDefs({ shapes }: { shapes: MapShape[] }) {
  return <svg className="map-defs" aria-hidden="true" focusable="false" width="0" height="0"><defs>{shapes.map((shape) => <path key={shape.id} id={`area-${shape.id}`} d={shape.d} />)}</defs></svg>;
}

/** Legenda de cinco classes: quintis do recorte ou cortes fixos (limite superior incluído). */
export function legendEntries(breaks: readonly number[], ramp: keyof typeof RAMPS, fixed = false) {
  const colors = RAMPS[ramp];
  const limit = (value: number) => fixed ? `${value.toLocaleString('pt-BR')}%` : pct(value);
  return breaks.length ? [0, 1, 2, 3, 4].map((index) => ({ color: colors[index]!, label: index === 0 ? `até ${limit(breaks[0]!)}` : index === 4 ? `acima de ${limit(breaks[3]!)}` : `${fixed ? 'mais de ' : ''}${limit(breaks[index - 1]!)} a ${limit(breaks[index]!)}` })) : [];
}

/**
 * Mapa coroplético em SVG gerado no servidor (funciona sem JavaScript). Cada área tem rótulo com valor, numerador e
 * denominador (`<title>` nativo e `data-*` para a dica de `MapHover`); o mapa é um complemento da tabela, que dá acesso por
 * teclado e leitor de tela. `cuts`: escala fixa (cinco classes) em vez dos quintis do recorte; `legend={false}` quando vários
 * mapas compartilham uma legenda; `titles={false}` omite o `<title>` (páginas com muitos mapas: a tabela substitui).
 */
export function Choropleth({ map, items, title, description, ramp, href, id = ramp, cuts, legend: showLegend = true, titles = true, detail }: {
  map: ProjectedMap; items: Item[]; title: string; description: string; ramp: keyof typeof RAMPS; href?: (item: Item) => string;
  id?: string; cuts?: readonly number[]; legend?: boolean; titles?: boolean; detail?: (item: Item) => string;
}) {
  const { shapes, height, insets } = map;
  const byId = new Map(items.map((item) => [item.id, item]));
  const values = items.flatMap((item) => item.value === null ? [] : [item.value]);
  const breaks = cuts ? [...cuts] : quintileBreaks(values);
  const colors = RAMPS[ramp];
  const titleId = `${id}-titulo`, descriptionId = `${id}-descricao`;
  const legend = legendEntries(breaks, ramp, Boolean(cuts));
  const missing = shapes.filter((shape) => byId.get(shape.id)?.value == null).length;
  return <figure className="choropleth">
    <figcaption><span className="choropleth-title" id={titleId}>{title}</span><span className="source-note" id={descriptionId}>{description}</span></figcaption>
    {/* O desenho é complemento visual: leitores de tela e teclado usam a tabela com os mesmos valores. */}
    <p className="sr-only">Mapa de {title}: os valores de cada unidade estão na tabela dos mapas, abaixo.</p>
    <svg viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      {insets.map((box) => <g key={box.name} className="map-inset"><rect x={box.x} y={box.y} width={box.width} height={box.height} rx="4" /><text x={box.x + box.width / 2} y={box.y + box.height - 6} textAnchor="middle">{box.name}</text></g>)}
      {shapes.map((shape) => {
        const item = byId.get(shape.id);
        const fill = item?.value == null ? NO_DATA : colors[classOf(item.value, breaks)]!;
        const value = item?.value == null ? 'sem dado' : detail ? detail(item) : `${pct(item.value)} (${item.numerator!.toLocaleString('pt-BR')} de ${item.denominator!.toLocaleString('pt-BR')})`;
        const name = item?.name ?? shape.id;
        const area = <use href={`#area-${shape.id}`} fill={fill} className="choropleth-area" data-label={name} data-value={value}>{titles && <title>{`${name}: ${value}`}</title>}</use>;
        // Links só para o mouse: o acesso por teclado e leitor de tela é a tabela abaixo.
        return item && href ? <a key={shape.id} href={href(item)} tabIndex={-1}>{area}</a> : <g key={shape.id}>{area}</g>;
      })}
    </svg>
    {showLegend ? <><ul className="choropleth-legend" aria-label={`Legenda — ${title}`}>
      {legend.map((entry) => <li key={entry.label}><span className="swatch" style={{ background: entry.color }} aria-hidden="true" />{entry.label}</li>)}
      {missing > 0 && <li><span className="swatch swatch-missing" aria-hidden="true" />Sem dado ({missing})</li>}
    </ul>
    <p className="query-note choropleth-note">{cuts ? 'Escala fixa, igual em todos os recortes.' : `Quintis: cada cor reúne cerca de um quinto das ${values.length.toLocaleString('pt-BR')} unidades com dado; os limites mudam com o recorte.`}</p></>
      : missing > 0 && <p className="query-note choropleth-note">Sem dado: {missing}.</p>}
  </figure>;
}
