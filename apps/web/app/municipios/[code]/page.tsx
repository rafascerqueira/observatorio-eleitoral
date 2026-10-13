import Link from 'next/link';
import { notFound } from 'next/navigation';
import { placesQuerySchema } from '@observatorio/contracts';
import { getPlaces } from '../../../lib/results';
import { clearPlacesHref, placesHref } from '../../../lib/place-navigation';
import { QueryForm } from '../../../components/query-form';
import { ErrorSummary, FieldError, QuerySelect, TurnField } from '../../../components/query-fields';
import { queryErrors, rawValue, recoverQuery } from '../../../lib/query-ui';
import { brazilHref } from '../../../lib/query-navigation';

export const dynamic = 'force-dynamic';
export default async function Municipality({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { code } = await params;
  if (!/^\d+$/.test(code)) notFound();
  const query = { ...await searchParams };
  for (const field of ['zone', 'section', 'local', 'search']) {
    if (typeof query[field] === 'string' && query[field].trim() === '') delete query[field];
  }
  const parsed = placesQuerySchema.safeParse({ ...query, pageSize: query.pageSize ?? '10' });
  const filters = parsed.success ? parsed.data : placesQuerySchema.parse({ ...recoverQuery(query, 'places'), pageSize: recoverQuery(query, 'places').pageSize ?? '10' });
  const response = parsed.success ? await getPlaces(code, filters) : null;
  const errors = parsed.success ? [] : queryErrors(query, parsed.error.issues, 'places');
  const invalidFields = new Set(errors.map((error) => error.field));
  const value = (field: 'zone' | 'section' | 'local' | 'search') => rawValue(query, field, filters[field] ?? '');
  const describedBy = (field: string, hint?: string) => [hint, invalidFields.has(field) ? `places-${field}-error` : undefined].filter(Boolean).join(' ') || undefined;
  const number = (count: number) => count.toLocaleString('pt-BR');
  const data = response?.kind === 'ready' ? response.data : null;
  const municipality = data?.municipality;
  const exterior = filters.uf === 'ZZ';
  const filtered = Boolean(filters.zone || filters.section || filters.local || filters.search);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const firstItem = data?.items.length ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastItem = data?.items.length ? firstItem + data.items.length - 1 : 0;
  const clearHref = clearPlacesHref(code, filters);
  const pagination = (position: string) => data && data.total > 0 && filters.page <= pageCount && <nav className="pagination places-pagination" aria-label={`Paginação ${position} dos locais`}>
    {filters.page > 1 && <Link href={`${placesHref(code, filters, { page: filters.page - 1 })}#resultados`}>← Página anterior</Link>}
    <span>Página {number(filters.page)} de {number(pageCount)}</span>
    {filters.page < pageCount && <Link href={`${placesHref(code, filters, { page: filters.page + 1 })}#resultados`}>Próxima página →</Link>}
  </nav>;
  return <>
    <section className="hero places-hero"><p className="eyebrow">{exterior ? 'DETALHE DO EXTERIOR · ZZ' : 'DETALHE MUNICIPAL'}</p><h1>{municipality ? `${municipality.name} / ${municipality.uf}` : !exterior && code === '71072' ? 'São Paulo / SP' : `${exterior ? 'Localidade' : 'Município'} TSE ${code}`}</h1><p className="hero-description">Presidência · {filters.year} · {filters.round}º turno · Locais de votação.</p><Link href={`${exterior ? '/exterior' : '/'}?${new URLSearchParams({ year: filters.year, round: filters.round, ...(municipality ? exterior ? { search: municipality.name } : { uf: municipality.uf, search: municipality.name } : {}) })}`}>← Voltar à consulta {exterior ? 'do exterior' : 'municipal'}</Link></section>
    <section className="explorer place-search" aria-labelledby="localizar">
      <div className="section-heading"><div><p className="eyebrow">{exterior ? 'BUSCA NA LOCALIDADE DO EXTERIOR' : 'BUSCA NO MUNICÍPIO'}</p><h2 id="localizar">Localizar um local de votação</h2></div></div>
      <p id="search-help" className="query-note">Combine zona e seção para localizar sua unidade. Também é possível buscar pelo código do local, nome ou endereço, com ou sem acentos.</p>
      <ErrorSummary errors={errors} targets={{ year: 'places-year', round: 'places-round-1', zone: 'places-zone', section: 'places-section', local: 'places-local', search: 'places-search', pageSize: 'places-pageSize' }} />
      <QueryForm key={JSON.stringify(query)} action={`/${exterior ? 'exterior' : 'municipios'}/${code}#resultados`} className="places-query" label="Busca de locais de votação" hintId="search-help" submitLabel="Buscar locais"
        secondary={<Link className="secondary-action" href={clearHref}>Limpar filtros</Link>} hasErrors={errors.length > 0}>
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="office" value="president" />
        {filters.uf && <input type="hidden" name="uf" value={filters.uf} />}
        <div className="places-primary">
          <div className="field"><label htmlFor="places-zone">Zona eleitoral <span className="optional-label">(opcional)</span></label><input id="places-zone" name="zone" inputMode="numeric" pattern="[0-9]+" maxLength={4} placeholder="Ex.: 0001" defaultValue={value('zone')} aria-invalid={invalidFields.has('zone') || undefined} aria-describedby={describedBy('zone', 'section-help')} /><FieldError field="zone" errors={errors} prefix="places-" /></div>
          <div className="field"><label htmlFor="places-section">Seção eleitoral <span className="optional-label">(opcional)</span></label><input id="places-section" name="section" inputMode="numeric" pattern="[0-9]+" maxLength={5} placeholder="Ex.: 0001" defaultValue={value('section')} aria-invalid={invalidFields.has('section') || undefined} aria-describedby={describedBy('section', 'section-help')} /><FieldError field="section" errors={errors} prefix="places-" /></div>
          <div className="field"><label htmlFor="places-search">Nome do local ou endereço <span className="optional-label">(opcional)</span></label><input id="places-search" type="search" name="search" maxLength={100} placeholder="Digite parte do nome, rua ou avenida" defaultValue={value('search')} aria-invalid={invalidFields.has('search') || undefined} aria-describedby={describedBy('search')} /><FieldError field="search" errors={errors} prefix="places-" /></div>
        </div>
        <details className="advanced-filters" open={Boolean(filters.local || filters.year !== '2022' || filters.pageSize !== 10 || errors.some((error) => ['year', 'round', 'local', 'pageSize'].includes(error.field)))}>
          <summary>Ajustar eleição e opções avançadas</summary><div className="places-advanced">
            <div className="field"><label htmlFor="places-year">Eleição</label><QuerySelect id="places-year" name="year" value={rawValue(query, 'year', filters.year)} errors={errors} choices={[{ value: '2022', label: '2022' }, { value: '2026', label: '2026 — ainda não publicado' }]} /></div>
            <TurnField prefix="places-" value={rawValue(query, 'round', filters.round)} errors={errors} />
            <div className="field"><label htmlFor="places-local">Código do local <span className="optional-label">(opcional)</span></label><input id="places-local" name="local" inputMode="numeric" pattern="[0-9]+" maxLength={5} placeholder="Ex.: 1015" defaultValue={value('local')} aria-invalid={invalidFields.has('local') || undefined} aria-describedby={describedBy('local')} /><FieldError field="local" errors={errors} prefix="places-" /></div>
            <div className="field"><label htmlFor="places-pageSize">Locais por página</label><QuerySelect id="places-pageSize" name="pageSize" value={rawValue(query, 'pageSize', filters.pageSize)} errors={errors} choices={[...new Set([10, 25, 50, filters.pageSize])].sort((a, b) => a - b).map((size) => ({ value: String(size), label: String(size) }))} /></div>
          </div>
        </details>
      </QueryForm>
      <p id="section-help" className="query-note">Números de seção podem se repetir em zonas diferentes. Zeros iniciais são aceitos. Uma nova busca sempre começa na primeira página.</p>
    </section>
    <p className="query-context applied-context">{parsed.success ? 'Consulta aplicada' : 'Filtros não aplicados'}: Presidência · {filters.year} · {filters.round}º turno{filters.zone ? ` · Zona ${filters.zone}` : ''}{filters.section ? ` · Seção ${filters.section}` : ''}. <Link className="secondary-action" href={brazilHref(filters.year, filters.round)}>Voltar ao Brasil</Link></p>
    <nav className="pagination round-navigation" aria-label="Selecionar turno">{(['1', '2'] as const).map((round) => <Link key={round} href={placesHref(code, filters, { round, page: 1 })} aria-current={filters.round === round ? 'page' : undefined}>{round}º turno de {filters.year}</Link>)}</nav>
    <details className="notice place-context"><summary>Como interpretar os locais e seus dados</summary><p>Local de votação é onde o eleitor vota, não onde mora. O código do local só é único junto com a zona eleitoral. Prédios compartilhados entre zonas não foram unificados.</p><p>Aptos, comparecimento e abstenção por local não estão disponíveis neste recorte. Não há associação socioeconômica validada.</p></details>
    <section id="resultados" className="places-results" aria-labelledby="resultados-titulo" tabIndex={-1}>
      <h2 id="resultados-titulo">Locais encontrados</h2>
      <p className="query-note places-scope">{filters.section ? <>A seção {filters.section}{filters.zone ? ` da zona ${filters.zone}` : ''} é usada para localizar o local. </> : null}Os resultados exibidos são do <strong>local inteiro</strong>. Percentuais de candidaturas usam os votos válidos do local.</p>
      {!parsed.success ? <p>Revise os filtros acima e busque novamente.</p> : response?.kind !== 'ready' ? <div className="place-status" role="status"><h3>{response?.kind === 'missing' ? 'Recorte sem publicação disponível' : 'Não foi possível consultar os locais'}</h3><p>Confira o ano e turno ou tente novamente em instantes.</p></div> : <>
      <p className="places-count" role="status">{number(response.data.total)} {response.data.total === 1 ? 'local encontrado' : 'locais encontrados'}{filtered ? ' com os filtros aplicados' : ''}{response.data.items.length > 0 ? ` · exibindo ${number(firstItem)}–${number(lastItem)}` : ''}.</p>
      {pagination('acima')}
      {response.data.items.length === 0 ? <div className="place-status"><h3>{response.data.total === 0 ? 'Nenhum local corresponde à busca' : 'Esta página não contém locais'}</h3><p>{response.data.total === 0 ? 'Confira zona, seção e código do local, ou tente um trecho menor do nome ou endereço.' : 'Os filtros têm resultados, mas a página solicitada está fora do intervalo disponível.'}</p><Link href={response.data.total === 0 ? clearHref : placesHref(code, filters, { page: 1 })}>{response.data.total === 0 ? 'Limpar filtros e ver os locais' : 'Ir para a primeira página da busca'}</Link></div> :
      <div className="place-grid">{response.data.items.map((place) => <article className="place-card" key={`${place.zone}/${place.code}`}>
        <p className="eyebrow">ZONA {place.zone} · LOCAL {place.code}</p><h3>{place.name ?? 'Nome indisponível'}</h3><p>{place.address ?? 'Endereço indisponível'} · {number(place.sections)} seção(ões).</p>
        {filters.section && <p className="section-match">Seção {filters.section} encontrada neste local.</p>}
        <details className="place-sections" open={filters.section !== undefined}><summary>Ver seções deste local ({place.sectionNumbers.length})</summary><ul aria-label={`Seções do local ${place.code}, zona ${place.zone}`}>{place.sectionNumbers.map((section) => <li key={section}><Link className={`section-tag${section === filters.section ? ' is-selected' : ''}`} href={placesHref(code, filters, { zone: place.zone, section, page: 1 })} aria-label={`Localizar zona ${place.zone}, seção ${section}`} aria-current={section === filters.section ? 'true' : undefined} data-section={section}>{section}</Link></li>)}</ul></details>
        {place.metadataConflict && <details><summary>Metadados divergentes na fonte</summary><p>O mesmo código eleitoral aparece com nomes ou endereços diferentes. Os campos divergentes permanecem indisponíveis.</p><ul>{place.metadataVariants.map((variant, index) => <li key={index}>{variant.name ?? 'Nome ausente'} · {variant.address ?? 'Endereço ausente'}</li>)}</ul></details>}
        <p>Válidos: {number(place.totals.valid)} · Brancos: {number(place.totals.blank)} · Nulos: {number(place.totals.null)}.</p>
        <table><caption className="sr-only">Candidaturas no local {place.code}, zona {place.zone}</caption><thead><tr><th scope="col">Candidatura</th><th scope="col">Votos</th><th scope="col">% válidos</th></tr></thead><tbody>{place.candidates.map((candidate) => <tr key={candidate.number}><th scope="row">{candidate.name} ({candidate.party})</th><td>{number(candidate.votes)}</td><td>{candidate.percentValid === null ? 'Indisponível' : `${candidate.percentValid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</td></tr>)}</tbody></table>
      </article>)}</div>}
      {pagination('abaixo')}
    </>}
    </section>
  </>;
}
