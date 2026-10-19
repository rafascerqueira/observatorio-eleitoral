import type { Metadata } from 'next';
import Link from 'next/link';
import { CENSUS_MAP_INDICATORS, MAP_INDICATORS, mapPageQuerySchema, OFFICES, OFFICE_LABELS, STATES, type MapValues } from '@observatorio/contracts';
import { getCandidateMap, getCatalog, getMapGeometry, getMapValues } from '../../lib/results';
import { QueryForm } from '../../components/query-form';
import { ErrorSummary, QuerySelect } from '../../components/query-fields';
import { RoundField, UfField } from '../../components/round-field';
import { SeriesField } from '../../components/series-field';
import { Choropleth, MapShapeDefs, projectShapes, type Topology } from '../../components/choropleth';
import { MapHover } from '../../components/map-hover';
import { MapTabs } from '../../components/map-tabs';
import { Scatter } from '../../components/scatter';
import { joinSeries, resolveSeries } from '../../lib/map-series';
import { UF_NAMES, officeScopeError, queryErrors, rawValue, type QueryError, type RawQuery } from '../../lib/query-ui';
import { availabilityFromCatalog } from '../../lib/rounds';

export const metadata: Metadata = { title: 'Mapa' };
export const dynamic = 'force-dynamic';
const KIND = { universo: 'universo do Censo', amostra: 'estimativa da amostra do Censo', resultados: 'resultados reconciliados', entorno: 'universo do Censo nos setores com a pesquisa do entorno' } as const;
const pct = (value: number | null) => value === null ? 'Sem dado' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const number = (value: number) => value.toLocaleString('pt-BR');

export default async function MapPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const raw = { ...await searchParams };
  if (raw.uf === '') delete raw.uf;
  const parsed = mapPageQuerySchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : mapPageQuerySchema.parse({});
  const scopeError = officeScopeError(filters.office, filters.uf);
  const valid = parsed.success && !scopeError;
  const recorte = { year: filters.year, round: filters.round, uf: filters.uf };
  // As candidaturas do recorte sempre são lidas: listam as opções de comparação, na ordem de votos de “Votação por candidatura”.
  const [catalog, geometry, census, candidates, abstention] = await Promise.all([getCatalog(), valid ? getMapGeometry(filters.uf) : null,
    valid ? getMapValues({ ...recorte, indicator: filters.indicator }) : null, valid ? getCandidateMap({ ...recorte, office: filters.office }) : null,
    valid && filters.series === 'abstention' ? getMapValues({ ...recorte, indicator: 'abstention', office: filters.office }) : null]);
  const state = valid ? resolveSeries(filters, candidates, abstention) : null;
  const seriesError: QueryError | null = state?.status === 'unknown-candidate' ? { field: 'series', message: `A candidatura nº ${filters.series} não está em ${OFFICE_LABELS[filters.office]}${filters.uf ? ` em ${UF_NAMES[filters.uf]}` : ''} no ${filters.round}º turno. Escolha outra comparação.` } : null;
  const errors = [...(parsed.success ? [] : queryErrors(raw, parsed.error.issues)), ...(scopeError ? [scopeError] : []), ...(seriesError ? [seriesError] : [])];
  const availability = availabilityFromCatalog(catalog?.datasets ?? []);
  const topology = geometry?.status === 'published' ? geometry.topology : null;
  const left = census?.status === 'published' ? census : null;
  const series = state?.status === 'ready' ? state.series : null;
  const level = filters.uf ? 'municipality' : 'uf';
  const place = filters.uf ? UF_NAMES[filters.uf] : 'Brasil';
  const unit = level === 'uf' ? 'UF' : 'município';
  const meta = MAP_INDICATORS[filters.indicator];
  // Na visão por UF, a API traz a sigla como nome: dica, dispersão e tabela mostram o nome por extenso.
  const named = (items: MapValues['items']) => level === 'uf' ? items.map((item) => ({ ...item, name: UF_NAMES[item.uf] })) : items;
  const href = (item: { code: string; uf: string }) => level === 'uf' ? `/mapa?${new URLSearchParams({ indicator: filters.indicator, round: filters.round, office: filters.office, series: filters.series, uf: item.uf })}`
    : `/municipios/${item.code}?${new URLSearchParams({ uf: item.uf, round: filters.round, ...(filters.office === 'president' ? {} : { office: filters.office }) })}`;
  const map = topology ? projectShapes(topology as Topology) : { shapes: [], height: 0, insets: [] };
  const rows = left && series ? joinSeries(named(left.items), series.items) : [];
  // Dica curta (o título e os eixos já nomeiam as duas medidas): o texto se repete em cada ponto, no HTML e no payload do servidor.
  const plotted = rows.flatMap((row) => row.census.value === null || row.series?.value == null ? [] : [{ id: row.id, name: row.name, x: row.census.value, y: row.series.value, weight: row.series.denominator ?? 0,
    detail: `Censo: ${pct(row.census.value)} · ${series!.kind === 'abstention' ? 'Abstenção' : 'Candidatura'}: ${pct(row.series.value)} (${number(row.series.numerator!)} de ${number(row.series.denominator!)} ${series!.kind === 'abstention' ? 'aptos' : 'válidos'})` }]);
  const seriesChoices = [{ value: 'abstention', label: `Abstenção (${OFFICE_LABELS[filters.office]})` },
    ...(candidates?.status === 'published' ? candidates.candidates.map((candidate) => ({ value: candidate.number, label: `${candidate.name} (${candidate.number}, ${candidate.party})` })) : [])];
  const ufChoices = [{ value: '', label: 'Brasil, por UF' }, ...[...STATES].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR')).map((uf) => ({ value: uf as string, label: `${UF_NAMES[uf]}, por município` }))];
  const exportHref = `/mapa/dados.csv?${new URLSearchParams({ year: filters.year, indicator: filters.indicator, office: filters.office, round: filters.round, series: filters.series, ...(filters.uf ? { uf: filters.uf } : {}) })}`;
  return <>
    <section className="hero places-hero"><p className="eyebrow">MAPA · CENSO 2022 E ELEIÇÕES 2022</p><h1>Território e participação — {place}</h1>
      <p className="hero-description">Um indicador do Censo 2022 sobre quem mora no território, ao lado da abstenção de um cargo ou da votação de uma candidatura, à sua escolha, e os dois juntos num gráfico de dispersão. Nada aqui demonstra relação de causa ou diz como votou cada grupo. Todas as candidaturas lado a lado estão em <Link href="/mapa/candidaturas">Votação por candidatura</Link>.</p></section>
    <section className="explorer" aria-labelledby="mapa-filtros">
      <MapTabs current="territory" />
      <div className="section-heading"><div><p className="eyebrow">ESCOLHA O RECORTE</p><h2 id="mapa-filtros">Indicadores e território</h2></div><Link className="text-link" href="/metodologia#mapas">Como ler <span aria-hidden="true">↗</span></Link></div>
      <ErrorSummary errors={errors} targets={{ indicator: 'indicator', office: 'office', uf: 'uf', round: 'round-1', series: 'series' }} />
      <QueryForm key={JSON.stringify(raw)} action="/mapa" className="municipality-filters" label="Filtros do mapa" submitLabel="Ver mapas" resultsId="mapas" hasErrors={errors.length > 0}>
        <div className="field"><label htmlFor="indicator">Indicador do Censo 2022</label><QuerySelect id="indicator" name="indicator" value={rawValue(raw, 'indicator', filters.indicator)} errors={errors}
          choices={CENSUS_MAP_INDICATORS.map((key) => ({ value: key, label: MAP_INDICATORS[key].label }))} /></div>
        <div className="field"><label htmlFor="office">Cargo</label><QuerySelect id="office" name="office" value={rawValue(raw, 'office', filters.office)} errors={errors} choices={OFFICES.map((office) => ({ value: office, label: OFFICE_LABELS[office] }))} /></div>
        <UfField office={rawValue(raw, 'office', filters.office)} value={rawValue(raw, 'uf', filters.uf ?? '')} errors={errors} choices={ufChoices} />
        <RoundField availability={availability} office={rawValue(raw, 'office', filters.office)} uf={rawValue(raw, 'uf', filters.uf ?? '')} value={rawValue(raw, 'round', filters.round)} errors={errors} />
        <SeriesField loaded={{ office: filters.office, uf: filters.uf ?? '', round: filters.round }} value={rawValue(raw, 'series', filters.series)} choices={seriesChoices} errors={errors} />
      </QueryForm>
      <div id="mapas" className="query-results">
        {!valid || seriesError ? <p className="notice scope-notice">Corrija os filtros acima para ver os mapas.</p>
          : state?.status === 'round-not-held' ? <p className="notice scope-notice">Não houve {filters.round}º turno para {OFFICE_LABELS[filters.office]}{filters.uf ? ` em ${UF_NAMES[filters.uf]}` : ''}.</p>
          : !topology || !left || !series ? <p className="notice scope-notice" role="status">Mapas indisponíveis: as malhas do IBGE, o contexto municipal ou os resultados ainda não foram publicados, ou o serviço não respondeu.</p> : <>
          <MapShapeDefs shapes={map.shapes} />
          <MapHover className="choropleth-pair">
            <Choropleth map={map} items={named(left.items)} ramp="teal" href={href} title={meta.label}
              description={`${meta.source} · ${KIND[meta.kind]} · por ${unit}${level === 'uf' ? ' (soma dos municípios)' : ''}`} />
            <Choropleth map={map} items={named(series.items)} ramp="copper" href={href} title={series.title} cuts={series.cuts}
              description={`${series.source} · por ${unit}${level === 'uf' ? ' (soma dos municípios)' : ''}`} />
          </MapHover>
          <MapHover><Scatter points={plotted} excluded={rows.length - plotted.length} unit={unit} title={`Cada ${unit}: ${meta.label.toLowerCase()} × ${series.kind === 'abstention' ? 'abstenção' : 'votação da candidatura'}`}
            description={`Um ponto por ${unit}; a área do ponto é proporcional aos ${series.weight} (mínimo de 8 px). Os eixos começam em zero.`}
            xLabel={`${meta.label} (%)`} yLabel={series.kind === 'abstention' ? `Abstenção — ${OFFICE_LABELS[filters.office]} (%)` : series.title} /></MapHover>
          <div className="notice scope-notice map-caveats"><p><strong>Como ler.</strong> {series.kind === 'abstention' ? 'Cada mapa tem sua própria escala, em quintis.' : 'O mapa do Censo usa quintis do recorte; o da candidatura usa a escala fixa de “Votação por candidatura”.'} Cores parecidas nos dois mapas, ou pontos alinhados na dispersão, não significam relação de causa, e nada aqui indica o voto de grupos: o Censo descreve quem mora no território; a abstenção e a votação descrevem o eleitorado inscrito ali. A dispersão não traça tendência nem calcula correlação. Municípios extensos e pouco populosos ocupam mais área no mapa do que seu peso em pessoas; na dispersão, o tamanho do ponto mostra esse peso.{meta.kind === 'entorno' ? ' No entorno dos domicílios, o denominador são os moradores dos setores com a pesquisa do entorno: setores fora dela não entram, e isso não indica ausência da infraestrutura. Descreve o território, não a opinião dos moradores.' : ''}</p></div>
          <details className="context-section map-table"><summary>Tabela dos mapas ({number(rows.length)} {level === 'uf' ? 'UFs' : 'municípios'})</summary>
            <p className="query-note"><a href={exportHref}>Baixar estes dados (CSV)</a>: códigos do TSE e do IBGE, numeradores, denominadores e versões das publicações usadas.</p>
            <div className="table-scroll context-table" role="region" aria-label="Tabela dos mapas" tabIndex={0}><table>
              <caption className="sr-only">Indicador do Censo e {series.kind === 'abstention' ? 'abstenção' : 'votação da candidatura'} por {unit}, com numerador e denominador.</caption>
              <thead><tr><th scope="col">{level === 'uf' ? 'UF' : 'Município'}</th><th scope="col">{meta.label}</th><th scope="col">{series.title}</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id}><th scope="row"><Link href={href(row)}>{row.name}</Link></th>
                <td>{pct(row.census.value)}{row.census.value !== null && <span className="source-note"> · {number(row.census.numerator!)} de {number(row.census.denominator!)}</span>}</td>
                <td>{pct(row.series?.value ?? null)}{row.series?.value != null && <span className="source-note"> · {number(row.series.numerator!)} de {number(row.series.denominator!)}</span>}</td></tr>)}</tbody>
            </table></div>
          </details>
          {filters.uf && filters.office === 'president' && <p className="query-note"><Link href={`/mapa?${new URLSearchParams({ indicator: filters.indicator, round: filters.round, series: filters.series })}`}>← Voltar ao Brasil por UF</Link></p>}
        </>}
      </div>
    </section>
  </>;
}
