import type { Metadata } from 'next';
import Link from 'next/link';
import { OFFICES, OFFICE_LABELS, PLACE_GROUP_INDICATORS, STATES, placeGroupsQuerySchema, type PlaceGroupIndicator, type PlaceGroups } from '@observatorio/contracts';
import { getCatalog, getPlaceGroups } from '../../lib/results';
import { QueryForm } from '../../components/query-form';
import { ErrorSummary, QuerySelect } from '../../components/query-fields';
import { RoundField, UfField } from '../../components/round-field';
import { RAMPS } from '../../components/choropleth';
import { UF_NAMES, officeScopeError, queryErrors, rawValue, type RawQuery } from '../../lib/query-ui';
import { availabilityFromCatalog } from '../../lib/rounds';

export const metadata: Metadata = { title: 'Perfil dos locais' };
export const dynamic = 'force-dynamic';
const MINIMUM_WAGE = 1212;
const pct = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const number = (value: number) => value.toLocaleString('pt-BR');
const range = (indicator: PlaceGroupIndicator, from: number, to: number) => indicator === 'college'
  ? `${pct(from)} a ${pct(to)}`
  : `${from.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} a ${to.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} (${(from / MINIMUM_WAGE).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} a ${(to / MINIMUM_WAGE).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} SM)`;

/** Pontos por candidatura, um por grupo, na mesma escala para todas (HTML: texto legível em qualquer largura). A matriz abaixo é o acesso por teclado e leitor de tela. */
function DotStrip({ data, order }: { data: PlaceGroups; order: Array<{ candidate: string; info: { name: string } }> }) {
  const max = Math.max(10, Math.ceil(Math.max(...data.groups.flatMap((group) => group.candidates.map((item) => item.percentValid ?? 0))) / 10) * 10);
  const position = (value: number) => `${value / max * 100}%`;
  return <div className="dot-strip" aria-hidden="true">
    <ul className="dot-legend">{data.groups.map((group) => <li key={group.index}><span className="swatch" style={{ background: RAMPS.teal[group.index - 1] }} />Grupo {group.index}</li>)}</ul>
    {order.map(({ candidate, info }) => <div className="dot-row" key={candidate}>
      <span className="dot-name">{info.name}</span>
      <span className="dot-track">{data.groups.map((group) => { const value = group.candidates.find((item) => item.number === candidate)?.percentValid ?? null; return value === null ? null
        : <span key={group.index} className="dot" style={{ left: position(value), background: RAMPS.teal[group.index - 1] }} title={`Grupo ${group.index}: ${pct(value)}`} />; })}</span>
    </div>)}
    <div className="dot-row dot-axis-row"><span className="dot-name" /><span className="dot-axis">{[0, max / 2, max].map((tick) => <span key={tick} style={{ left: position(tick) }}>{tick.toLocaleString('pt-BR')}%</span>)}</span></div>
  </div>;
}

export default async function Profiles({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const raw = { ...await searchParams };
  if (raw.uf === '') delete raw.uf;
  const parsed = placeGroupsQuerySchema.safeParse({ indicator: 'college', ...raw });
  const filters = parsed.success ? parsed.data : placeGroupsQuerySchema.parse({ indicator: 'college' });
  const scopeError = officeScopeError(filters.office, filters.uf);
  const errors = [...(parsed.success ? [] : queryErrors(raw, parsed.error.issues)), ...(scopeError ? [scopeError] : [])];
  const [catalog, data] = await Promise.all([getCatalog(), parsed.success && !scopeError ? getPlaceGroups(filters) : null]);
  const availability = availabilityFromCatalog(catalog?.datasets ?? []);
  const meta = PLACE_GROUP_INDICATORS[filters.indicator];
  const place = filters.uf ? UF_NAMES[filters.uf] : 'Brasil';
  const published = data?.status === 'published' && data.groups.length > 0 ? data : null;
  const order = published ? [...new Set(published.groups.flatMap((group) => group.candidates.map((item) => item.number)))]
    .map((candidate) => ({ candidate, info: published.groups.flatMap((group) => group.candidates).find((item) => item.number === candidate)!, votes: published.groups.reduce((sum, group) => sum + (group.candidates.find((item) => item.number === candidate)?.votes ?? 0), 0) }))
    .sort((a, b) => b.votes - a.votes) : [];
  const ufChoices = [{ value: '', label: 'Todo o Brasil' }, ...[...STATES].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR')).map((uf) => ({ value: uf as string, label: `${UF_NAMES[uf]} — ${uf}` }))];
  return <>
    <section className="hero places-hero"><p className="eyebrow">LOCAIS DE VOTAÇÃO · PERFIL E ENTORNO</p><h1>Resultados por perfil dos locais — {place}</h1>
      <p className="hero-description">Locais de votação agrupados pela escolaridade declarada dos seus eleitores (cadastro do TSE) ou pela renda do setor censitário onde ficam (Censo 2022), com os votos somados em cada grupo. Os grupos descrevem locais, não pessoas: o voto é secreto e ninguém votou “como grupo”.</p></section>
    <section className="explorer" aria-labelledby="perfis-filtros">
      <div className="section-heading"><div><p className="eyebrow">ESCOLHA O RECORTE</p><h2 id="perfis-filtros">Indicador, cargo e território</h2></div><Link className="text-link" href="/metodologia#perfis">Como ler <span aria-hidden="true">↗</span></Link></div>
      <ErrorSummary errors={errors} targets={{ indicator: 'indicator', office: 'office', uf: 'uf', round: 'round-1' }} />
      <QueryForm key={JSON.stringify(raw)} action="/perfis" className="municipality-filters" label="Filtros dos grupos de locais" submitLabel="Ver grupos" resultsId="grupos" hasErrors={errors.length > 0}>
        <div className="field"><label htmlFor="indicator">Agrupar locais por</label><QuerySelect id="indicator" name="indicator" value={rawValue(raw, 'indicator', filters.indicator)} errors={errors}
          choices={(Object.keys(PLACE_GROUP_INDICATORS) as PlaceGroupIndicator[]).map((key) => ({ value: key, label: PLACE_GROUP_INDICATORS[key].label }))} /></div>
        <div className="field"><label htmlFor="office">Cargo</label><QuerySelect id="office" name="office" value={rawValue(raw, 'office', filters.office)} errors={errors} choices={OFFICES.map((office) => ({ value: office, label: OFFICE_LABELS[office] }))} /></div>
        <UfField office={rawValue(raw, 'office', filters.office)} value={rawValue(raw, 'uf', filters.uf ?? '')} errors={errors} choices={ufChoices} />
        <RoundField availability={availability} office={rawValue(raw, 'office', filters.office)} uf={rawValue(raw, 'uf', filters.uf ?? '')} value={rawValue(raw, 'round', filters.round)} errors={errors} />
      </QueryForm>
      <div id="grupos" className="query-results">
        {!parsed.success || scopeError ? <p className="notice scope-notice">Corrija os filtros acima para ver os grupos.</p>
          : data?.status === 'round-not-held' ? <p className="notice scope-notice">Não houve {filters.round}º turno para {OFFICE_LABELS[filters.office]}{filters.uf ? ` em ${UF_NAMES[filters.uf]}` : ''}.</p>
          : !published ? <p className="notice scope-notice" role="status">Grupos indisponíveis: o perfil dos locais, a associação aos setores ou os resultados ainda não foram publicados, ou o serviço não respondeu.</p> : <>
          <p className="query-note context-intro">Cada grupo reúne cerca de um quinto dos eleitores aptos dos locais com o indicador. {number(published.coverage.placesInGroups)} de {number(published.coverage.places)} locais com votos entraram nos grupos, com {pct(published.coverage.votesInGroups / published.coverage.totalVotes * 100)} dos votos do recorte; os demais ficaram de fora por não terem o indicador{filters.indicator === 'income-median' ? ' (sem coordenada confiável, fora de setor do próprio município ou com ponto compartilhado por locais diferentes)' : ''}. Fonte do indicador: {meta.source}.</p>
          <div className="table-scroll context-table" role="region" aria-label="Grupos de locais" tabIndex={0}><table>
            <caption><span className="context-caption">Grupos de locais</span> <span className={`badge kind-badge kind-${meta.kind}`}>{meta.kind === 'cadastro' ? 'Cadastro do TSE' : 'Universo do Censo'}</span> <span className="source-note">{meta.label}</span></caption>
            <thead><tr><th scope="col">Grupo</th><th scope="col">Faixa do indicador</th><th scope="col">Locais</th><th scope="col">Eleitores aptos (cadastro)</th><th scope="col">Votos válidos</th></tr></thead>
            <tbody>{published.groups.map((group) => <tr key={group.index}><th scope="row"><span className="swatch" style={{ background: RAMPS.teal[group.index - 1] }} aria-hidden="true" /> {group.index}</th><td>{range(filters.indicator, group.from, group.to)}</td><td>{number(group.places)}</td><td>{number(group.eligible)}</td><td>{number(group.valid)}</td></tr>)}</tbody>
          </table></div>
          <figure className="dot-figure"><figcaption><span className="choropleth-title">% dos votos válidos de cada candidatura, por grupo</span><span className="source-note">Mesma escala para todas as candidaturas; grupo 1 (mais claro) a 5 (mais escuro). Valores na tabela abaixo.</span></figcaption><DotStrip data={published} order={order} /></figure>
          <div className="table-scroll context-table" role="region" aria-label="Votos por candidatura em cada grupo" tabIndex={0}><table>
            <caption><span className="context-caption">{OFFICE_LABELS[filters.office]} — {filters.round}º turno: % dos votos válidos do grupo</span> <span className="source-note">TSE, resultados reconciliados por local</span></caption>
            <thead><tr><th scope="col">Candidatura</th>{published.groups.map((group) => <th scope="col" key={group.index}>Grupo {group.index}</th>)}</tr></thead>
            <tbody>{order.map(({ candidate, info }) => <tr key={candidate}><th scope="row">{info.name} <span className="candidate-number">{candidate}</span> <span className="source-note">{info.party}</span></th>
              {published.groups.map((group) => { const item = group.candidates.find((entry) => entry.number === candidate); return <td key={group.index}>{pct(item?.percentValid ?? null)}{item && <span className="source-note"> · {number(item.votes)}</span>}</td>; })}</tr>)}</tbody>
          </table></div>
          <div className="notice scope-notice map-caveats"><p><strong>Como ler.</strong> Diferenças entre grupos descrevem locais de votação com características diferentes, não o voto de pessoas com essas características: um local com mais eleitores de nível superior não diz como votaram esses eleitores. O endereço do local não é a residência dos eleitores. {filters.indicator === 'college' ? 'A escolaridade é a declarada no alistamento e pode estar desatualizada.' : 'A renda é a do responsável pelos domicílios do setor que contém o local, no Censo 2022 — contexto do entorno, não dos eleitores.'} Nenhuma relação de causa é sugerida.</p></div>
        </>}
      </div>
    </section>
  </>;
}
