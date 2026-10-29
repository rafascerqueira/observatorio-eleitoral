import type { Metadata } from 'next';
import Link from 'next/link';
import { CANDIDATE_MAP_CUTS, candidateMapQuerySchema, OFFICES, OFFICE_LABELS, percent, STATES, type CandidateMap, type MapValues } from '@observatorio/contracts';
import { candidateSeries } from '../../../lib/map-series';
import { getCandidateMap, getCatalog, getMapGeometry } from '../../../lib/results';
import { QueryForm } from '../../../components/query-form';
import { ErrorSummary, QuerySelect } from '../../../components/query-fields';
import { RoundField, UfField } from '../../../components/round-field';
import { Choropleth, legendEntries, MapShapeDefs, projectShapes, type Topology } from '../../../components/choropleth';
import { MapHover } from '../../../components/map-hover';
import { MapTabs } from '../../../components/map-tabs';
import { UF_NAMES, officeScopeError, queryErrors, rawValue, type RawQuery } from '../../../lib/query-ui';
import { availabilityFromCatalog, yearChoices } from '../../../lib/rounds';

export const metadata: Metadata = { title: 'Mapa por candidatura' };
export const dynamic = 'force-dynamic';
const number = (value: number) => value.toLocaleString('pt-BR');
// Abaixo de 1%, duas casas: dezenas de milhares de votos não aparecem como "0,0%".
const pct = (value: number | null) => { if (value === null) return 'Indisponível'; const digits = value > 0 && value < 1 ? 2 : 1; return `${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`; };

export default async function CandidateMaps({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const raw = { ...await searchParams };
  if (raw.uf === '') delete raw.uf;
  const parsed = candidateMapQuerySchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : candidateMapQuerySchema.parse({});
  const scopeError = officeScopeError(filters.office, filters.uf);
  const errors = [...(parsed.success ? [] : queryErrors(raw, parsed.error.issues)), ...(scopeError ? [scopeError] : [])];
  const valid = parsed.success && !scopeError;
  const [catalog, geometry, data] = await Promise.all([getCatalog(), valid ? getMapGeometry(filters.uf) : null, valid ? getCandidateMap(filters) : null]);
  const availability = availabilityFromCatalog(catalog?.datasets ?? []);
  const years = yearChoices(catalog?.datasets ?? null, rawValue(raw, 'year', filters.year));
  const yearParam: Record<string, string> = filters.year === '2022' ? {} : { year: filters.year };
  const topology = geometry?.status === 'published' ? geometry.topology : null;
  const published = data?.status === 'published' && data.items.length > 0 ? data : null;
  const level = filters.uf ? 'municipality' : 'uf';
  const unit = level === 'uf' ? 'UF' : 'município';
  const place = filters.uf ? UF_NAMES[filters.uf] : 'Brasil';
  const map = topology ? projectShapes(topology as Topology) : { shapes: [], height: 0, insets: [] };
  const name = (item: CandidateMap['items'][number]) => level === 'uf' ? UF_NAMES[item.uf] : item.name;
  const href = (item: { code: string; uf: string }) => level === 'uf' ? `/mapa/candidaturas?${new URLSearchParams({ ...yearParam, office: filters.office, round: filters.round, uf: item.uf })}`
    : `/municipios/${item.code}?${new URLSearchParams({ ...yearParam, uf: item.uf, round: filters.round, office: filters.office })}`;
  // Cada candidatura vira uma série de valores no formato do mapa (% dos válidos da unidade; sem válidos, sem dado).
  const series = (data: CandidateMap, index: number): MapValues['items'] => candidateSeries(data, index).map((item) => ({ ...item, name: level === 'uf' ? UF_NAMES[item.uf] : item.name }));
  const ufChoices = [{ value: '', label: 'Brasil, por UF' }, ...[...STATES].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR')).map((uf) => ({ value: uf as string, label: `${UF_NAMES[uf]}, por município` }))];
  return <>
    <section className="hero places-hero"><p className="eyebrow">MAPA · ELEIÇÕES {filters.year}</p><h1>Votação por candidatura — {place}</h1>
      <p className="hero-description">Um mapa para cada candidatura, todos na mesma escala: a cor diz que parcela dos votos válidos da {unit === 'UF' ? 'UF' : 'cidade'} a candidatura recebeu. A cor não indica partido nem quem venceu; a área desenhada não é o número de eleitores.</p></section>
    <section className="explorer" aria-labelledby="candidaturas-filtros">
      <MapTabs current="candidates" />
      <div className="section-heading"><div><p className="eyebrow">ESCOLHA O RECORTE</p><h2 id="candidaturas-filtros">Cargo, território e turno</h2></div><Link className="text-link" href="/metodologia#mapas">Como ler <span aria-hidden="true">↗</span></Link></div>
      <ErrorSummary errors={errors} targets={{ year: 'year', office: 'office', uf: 'uf', round: 'round-1' }} />
      <QueryForm key={JSON.stringify(raw)} action="/mapa/candidaturas" className="municipality-filters" label="Filtros do mapa por candidatura" submitLabel="Ver mapas" resultsId="mapas" hasErrors={errors.length > 0}>
        <div className="field"><label htmlFor="year">Eleição</label><QuerySelect id="year" name="year" value={rawValue(raw, 'year', filters.year)} errors={errors} choices={years.choices} disabledValues={years.disabledValues} /></div>
        <div className="field"><label htmlFor="office">Cargo</label><QuerySelect id="office" name="office" value={rawValue(raw, 'office', filters.office)} errors={errors} choices={OFFICES.map((office) => ({ value: office, label: OFFICE_LABELS[office] }))} /></div>
        <UfField office={rawValue(raw, 'office', filters.office)} value={rawValue(raw, 'uf', filters.uf ?? '')} errors={errors} choices={ufChoices} />
        <RoundField year={rawValue(raw, 'year', filters.year)} availability={availability} office={rawValue(raw, 'office', filters.office)} uf={rawValue(raw, 'uf', filters.uf ?? '')} value={rawValue(raw, 'round', filters.round)} errors={errors} />
      </QueryForm>
      <div id="mapas" className="query-results">
        {!valid ? <p className="notice scope-notice">Corrija os filtros acima para ver os mapas.</p>
          : data?.status === 'round-not-held' ? <p className="notice scope-notice">Não houve {filters.round}º turno para {OFFICE_LABELS[filters.office]}{filters.uf ? ` em ${UF_NAMES[filters.uf]}` : ''}.</p>
          : !topology || !published ? <p className="notice scope-notice" role="status">Mapas indisponíveis: as malhas do IBGE, o contexto municipal ou os resultados ainda não foram publicados, ou o serviço não respondeu.</p> : <>
          <p className="query-note context-intro">{OFFICE_LABELS[filters.office]}, {filters.round}º turno, por {unit}: {published.candidates.length} candidaturas, em ordem de votos no recorte. Percentual = votos da candidatura ÷ votos válidos da unidade (sem brancos e nulos), somando contagens.{filters.office === 'president' && !filters.uf ? ' O exterior não tem área no mapa e fica fora.' : ''}</p>
          <div className="shared-legend"><p className="choropleth-title">% dos votos válidos da {unit === 'UF' ? 'UF' : 'cidade'} — mesma escala em todos os mapas</p>
            <ul className="choropleth-legend" aria-label="Legenda dos mapas por candidatura">{legendEntries(CANDIDATE_MAP_CUTS, 'teal', true).map((entry) => <li key={entry.label}><span className="swatch" style={{ background: entry.color }} aria-hidden="true" />{entry.label}</li>)}</ul>
            <p className="query-note choropleth-note">Escala fixa, igual para todas as candidaturas, cargos e territórios; limite superior incluído. Acima de 50%: maioria absoluta dos votos válidos na unidade. Liderar uma unidade não exige maioria.</p></div>
          <MapShapeDefs shapes={map.shapes} />
          <MapHover className="candidate-maps">
            {published.candidates.map((candidate, index) => <Choropleth key={candidate.number} id={`candidatura-${candidate.number}`} map={map} items={series(published, index)} ramp="teal" cuts={CANDIDATE_MAP_CUTS} legend={false} titles={false} href={href}
              title={`${candidate.name} (${candidate.number})`} description={`${candidate.party} · ${pct(candidate.percentValid)} dos válidos no recorte · ${number(candidate.votes)} votos`}
              detail={(item) => `${candidate.name}: ${pct(item.value)} (${number(item.numerator!)} de ${number(item.denominator!)} válidos)`} />)}
          </MapHover>
          <div className="notice scope-notice map-caveats"><p><strong>Como ler.</strong> Os mapas mostram onde cada candidatura teve mais ou menos votos válidos, sempre com os mesmos limites de cor — um tom mais escuro significa a mesma parcela em qualquer mapa. A cor é a mesma para todas as candidaturas e não representa partido. Unidades extensas e pouco populosas ocupam mais área do que seu peso em eleitores; veja os votos na tabela. Resultados por {unit} não dizem como votou cada grupo de pessoas.</p></div>
          <details className="context-section map-table"><summary>Tabela dos mapas ({number(published.items.length)} {level === 'uf' ? 'UFs' : 'municípios'} × {published.candidates.length} candidaturas)</summary>
            <div className="table-scroll context-table" role="region" aria-label="Tabela dos mapas por candidatura" tabIndex={0}><table>
              <caption className="sr-only">Percentual dos votos válidos de cada candidatura por {unit}, com votos e votos válidos.</caption>
              <thead><tr><th scope="col">{level === 'uf' ? 'UF' : 'Município'}</th><th scope="col">Votos válidos</th>{published.candidates.map((candidate) => <th scope="col" key={candidate.number}>{candidate.name} <span className="candidate-number">{candidate.number}</span></th>)}</tr></thead>
              <tbody>{published.items.map((item) => <tr key={`${item.uf}-${item.code}`}><th scope="row"><Link href={href(item)}>{name(item)}</Link></th><td>{number(item.valid)}</td>
                {item.votes.map((votes, index) => <td key={published.candidates[index]!.number}>{pct(percent(votes, item.valid))}<span className="source-note cell-count">{number(votes)}</span></td>)}</tr>)}</tbody>
            </table></div>
          </details>
          {filters.uf && filters.office === 'president' && <p className="query-note"><Link href={`/mapa/candidaturas?${new URLSearchParams({ ...yearParam, office: filters.office, round: filters.round })}`}>← Voltar ao Brasil por UF</Link></p>}
        </>}
      </div>
    </section>
  </>;
}
