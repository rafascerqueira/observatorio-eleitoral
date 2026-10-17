import type { Metadata } from 'next';
import Link from 'next/link';
import { MAP_INDICATORS, mapQuerySchema, STATES, type MapIndicator, type MapValues } from '@observatorio/contracts';
import { getMapGeometry, getMapValues } from '../../lib/results';
import { QueryForm } from '../../components/query-form';
import { ErrorSummary, QuerySelect, TurnField } from '../../components/query-fields';
import { Choropleth, MapShapeDefs, projectShapes, type Topology } from '../../components/choropleth';
import { UF_NAMES, queryErrors, rawValue, type RawQuery } from '../../lib/query-ui';

export const metadata: Metadata = { title: 'Mapa' };
export const dynamic = 'force-dynamic';
const IBGE_INDICATORS = (Object.keys(MAP_INDICATORS) as MapIndicator[]).filter((key) => MAP_INDICATORS[key].family === 'ibge');
const KIND = { universo: 'universo do Censo', amostra: 'estimativa da amostra do Censo', resultados: 'resultados reconciliados' } as const;
const pct = (value: number | null) => value === null ? 'Sem dado' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export default async function MapPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const raw = { ...await searchParams };
  if (raw.uf === '') delete raw.uf;
  const parsed = mapQuerySchema.safeParse({ indicator: 'income-upto-half-mw', ...raw });
  const filters = parsed.success ? parsed.data : mapQuerySchema.parse({ indicator: 'income-upto-half-mw' });
  const errors = parsed.success ? [] : queryErrors(raw, parsed.error.issues);
  const level = filters.uf ? 'municipality' : 'uf';
  const [geometry, ibge, tse] = parsed.success ? await Promise.all([
    getMapGeometry(filters.uf), getMapValues({ ...filters, indicator: filters.indicator }), getMapValues({ ...filters, indicator: 'abstention' }),
  ]) : [null, null, null];
  const topology = geometry?.status === 'published' ? geometry.topology : null;
  const left = ibge?.status === 'published' ? ibge : null;
  const right = tse?.status === 'published' ? tse : null;
  const place = filters.uf ? UF_NAMES[filters.uf] : 'Brasil';
  const unit = level === 'uf' ? 'UF' : 'município';
  const meta = MAP_INDICATORS[filters.indicator];
  const name = (item: MapValues['items'][number]) => level === 'uf' ? UF_NAMES[item.uf] : item.name;
  const href = (item: MapValues['items'][number]) => level === 'uf' ? `/mapa?${new URLSearchParams({ indicator: filters.indicator, round: filters.round, uf: item.uf })}` : `/municipios/${item.code}?${new URLSearchParams({ uf: item.uf, round: filters.round })}`;
  const tseById = new Map(right?.items.map((item) => [item.id, item]) ?? []);
  const map = topology ? projectShapes(topology as Topology) : { shapes: [], height: 0, insets: [] };
  return <>
    <section className="hero places-hero"><p className="eyebrow">MAPA · CENSO 2022 E ELEIÇÕES 2022</p><h1>Território e participação — {place}</h1>
      <p className="hero-description">Dois mapas lado a lado: um indicador do Censo 2022 sobre quem mora no território e a abstenção nos resultados da Presidência. Mapas lado a lado não demonstram relação de causa, nem dizem como votou cada grupo.</p></section>
    <section className="explorer" aria-labelledby="mapa-filtros">
      <div className="section-heading"><div><p className="eyebrow">ESCOLHA O RECORTE</p><h2 id="mapa-filtros">Indicadores e território</h2></div><Link className="text-link" href="/metodologia#mapas">Como ler <span aria-hidden="true">↗</span></Link></div>
      <ErrorSummary errors={errors} targets={{ indicator: 'indicator', uf: 'uf', round: 'round-1' }} />
      <QueryForm key={JSON.stringify(raw)} action="/mapa" className="municipality-filters" label="Filtros do mapa" submitLabel="Ver mapas" resultsId="mapas" hasErrors={errors.length > 0}>
        <div className="field"><label htmlFor="indicator">Indicador do Censo 2022</label><QuerySelect id="indicator" name="indicator" value={rawValue(raw, 'indicator', filters.indicator)} errors={errors} hintId="indicator-hint"
          choices={IBGE_INDICATORS.map((key) => ({ value: key, label: MAP_INDICATORS[key].label }))} /><p className="field-hint" id="indicator-hint">Comparado com a abstenção da Presidência no turno escolhido.</p></div>
        <TurnField value={rawValue(raw, 'round', filters.round)} errors={errors} />
        <div className="field"><label htmlFor="uf">Território</label><QuerySelect id="uf" name="uf" value={rawValue(raw, 'uf', filters.uf ?? '')} errors={errors} hintId="uf-map-hint"
          choices={[{ value: '', label: 'Brasil, por UF' }, ...[...STATES].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR')).map((uf) => ({ value: uf, label: `${UF_NAMES[uf]}, por município` }))]} /><p className="field-hint" id="uf-map-hint">Clique numa UF do mapa para ver seus municípios.</p></div>
      </QueryForm>
      <div id="mapas" className="query-results">
        {!parsed.success ? <p className="notice scope-notice">Corrija os filtros acima para ver os mapas.</p> : !topology || !left || !right ? <p className="notice scope-notice" role="status">Mapas indisponíveis: as malhas do IBGE, o contexto municipal ou os resultados ainda não foram publicados, ou o serviço não respondeu.</p> : <>
          <MapShapeDefs shapes={map.shapes} />
          <div className="choropleth-pair">
            <Choropleth map={map} items={left.items} ramp="teal" href={href} title={meta.label}
              description={`${meta.source} · ${KIND[meta.kind]} · por ${unit}${level === 'uf' ? ' (soma dos municípios)' : ''}`} />
            <Choropleth map={map} items={right.items} ramp="copper" href={href} title={`Abstenção na Presidência — ${filters.round}º turno`}
              description={`${MAP_INDICATORS.abstention.source} · abstenções ÷ eleitores aptos · por ${unit}`} />
          </div>
          <div className="notice scope-notice map-caveats"><p><strong>Como ler.</strong> Cada mapa tem sua própria escala, em quintis. Cores parecidas nos dois mapas não significam relação, e nenhum dos dois indica o voto de grupos: o Censo descreve quem mora no território; a abstenção descreve o eleitorado inscrito ali. Municípios extensos e pouco populosos ocupam mais área no mapa do que seu peso em pessoas.</p></div>
          <details className="context-section map-table"><summary>Tabela dos mapas ({left.items.length.toLocaleString('pt-BR')} {level === 'uf' ? 'UFs' : 'municípios'})</summary>
            <div className="table-scroll context-table" role="region" aria-label="Tabela dos mapas" tabIndex={0}><table>
              <caption className="sr-only">Indicador do Censo e abstenção por {unit}, com numerador e denominador.</caption>
              <thead><tr><th scope="col">{level === 'uf' ? 'UF' : 'Município'}</th><th scope="col">{meta.label}</th><th scope="col">Abstenção ({filters.round}º turno)</th></tr></thead>
              <tbody>{left.items.map((item) => { const other = tseById.get(item.id); return <tr key={item.id}><th scope="row"><Link href={href(item)}>{name(item)}</Link></th>
                <td>{pct(item.value)}{item.value !== null && <span className="source-note"> · {item.numerator!.toLocaleString('pt-BR')} de {item.denominator!.toLocaleString('pt-BR')}</span>}</td>
                <td>{pct(other?.value ?? null)}{other?.value != null && <span className="source-note"> · {other.numerator!.toLocaleString('pt-BR')} de {other.denominator!.toLocaleString('pt-BR')}</span>}</td></tr>; })}</tbody>
            </table></div>
          </details>
          {filters.uf && <p className="query-note"><Link href={`/mapa?${new URLSearchParams({ indicator: filters.indicator, round: filters.round })}`}>← Voltar ao Brasil por UF</Link></p>}
        </>}
      </div>
    </section>
  </>;
}
