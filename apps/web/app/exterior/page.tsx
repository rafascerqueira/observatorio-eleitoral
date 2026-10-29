import Link from 'next/link';
import { exteriorQuerySchema, percent, STATES } from '@observatorio/contracts';
import { getCatalog, getExterior } from '../../lib/results';
import { yearChoices } from '../../lib/rounds';
import { QueryForm } from '../../components/query-form';
import { ErrorSummary, FieldError, QuerySelect, TurnField } from '../../components/query-fields';
import { UF_NAMES, rawValue, recoverQuery, queryErrors, type RawQuery } from '../../lib/query-ui';
import { brazilHref } from '../../lib/query-navigation';

export const dynamic = 'force-dynamic';
export default async function Exterior({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const raw = { ...await searchParams };
  if (raw.search === '') delete raw.search;
  const parsed = exteriorQuerySchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : exteriorQuerySchema.parse(recoverQuery(raw, 'exterior'));
  const errors = parsed.success ? [] : queryErrors(raw, parsed.error.issues);
  const [state, catalog] = await Promise.all([parsed.success ? getExterior(filters) : null, getCatalog()]);
  const years = yearChoices(catalog?.datasets ?? null, rawValue(raw, 'year', filters.year));
  const data = state?.kind === 'ready' && state.data.status === 'published' ? state.data : null;
  const number = (value: number | null) => value === null ? 'Indisponível' : value.toLocaleString('pt-BR');
  const rate = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const invalidSearch = errors.some((error) => error.field === 'search');
  const choices = [...STATES].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR')).map((uf) => ({ value: uf as string, label: `${UF_NAMES[uf]} — ${uf}` }));
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page })) if (value !== undefined && value !== '') params.set(key, String(value));
    return `/exterior?${params}#localidades`;
  };
  return <>
    <section className="hero"><p className="eyebrow">ABRANGÊNCIA ELEITORAL · ZZ</p><h1>Presidência no exterior</h1><p className="hero-description">Votos e participação nas localidades eleitorais do exterior. Os turnos e as fontes permanecem separados e identificados.</p><Link href={brazilHref(filters.year, filters.round)}>← Voltar ao Brasil completo</Link></section>
    <section className="explorer" aria-labelledby="exterior-titulo">
      <div className="section-heading"><h2 id="exterior-titulo">Consolidado de todo o exterior</h2><Link className="text-link" href="/fontes">Cobertura e arquivos ↗</Link></div>
      <p className="query-context">Cargo: Presidência · Exterior é uma abrangência eleitoral, não um estado brasileiro.</p>
      <ErrorSummary errors={errors} targets={{ year: 'year', round: 'round-1', search: 'search' }} />
      <QueryForm key={JSON.stringify(raw)} action="/" label="Filtros do exterior" className="municipality-filters" submitLabel="Consultar" hintId="exterior-help" hasErrors={errors.length > 0}
        secondary={<Link className="secondary-action" href={brazilHref(filters.year, filters.round)}>Voltar ao Brasil</Link>}>
        <input type="hidden" name="office" value="president" />
        <div className="field"><label htmlFor="year">Eleição</label><QuerySelect id="year" name="year" value={rawValue(raw, 'year', filters.year)} errors={errors} choices={years.choices} disabledValues={years.disabledValues} /></div>
        <TurnField value={rawValue(raw, 'round', filters.round)} errors={errors} />
        <div className="field"><label htmlFor="uf">Abrangência</label><QuerySelect id="uf" name="uf" value="ZZ" errors={errors} choices={[{ value: '', label: 'Todo o Brasil' }, ...choices, { value: 'ZZ', label: 'Exterior — ZZ' }]} /></div>
        <div className="field"><label htmlFor="search">Cidade no exterior <span className="optional-label">(opcional)</span></label><input id="search" type="search" name="search" maxLength={100} defaultValue={rawValue(raw, 'search', filters.search ?? '')} placeholder="Ex.: Lisboa, Boston ou Tóquio" aria-invalid={invalidSearch || undefined} aria-describedby={invalidSearch ? 'search-error exterior-help' : 'exterior-help'} /><FieldError field="search" errors={errors} /></div>
      </QueryForm>
      <p className="query-note" id="exterior-help">A busca localiza cidades; o quadro geral continua mostrando todo o exterior, sem reduzir seus totais à página ou ao nome pesquisado.</p>
      <div className="table-toolbar"><span>{parsed.success ? 'Consulta aplicada' : 'Filtros não aplicados'}: Exterior · Presidência · {filters.year} · {filters.round}º turno</span><span>{data ? 'Recorte reconciliado · TSE' : 'Sem publicação disponível'}</span></div>
      <p className="notice scope-notice">O TSE usa ZZ para o exterior. Em 2022, as localidades pertencem à zona eleitoral 1: país não é zona eleitoral. Os códigos de cidade são identidades eleitorais TSE, não códigos de municípios brasileiros ou IBGE. <a href="https://www.tre-df.jus.br/servicos-eleitorais/eleitor-no-exterior/eleitor-no-exterior">Como o TRE-DF organiza o exterior</a>.</p>
      {!data ? <div className="empty-state" role="status"><h3>{!parsed.success ? 'Confira os filtros da consulta' : state?.kind === 'unavailable' ? 'Não foi possível consultar o exterior' : 'Nenhuma base publicada para este recorte'}</h3><p>Confira a eleição e o turno ou consulte a cobertura na transparência.</p></div> : <>
        <section className="municipality-summary" aria-label="Participação no exterior"><div className="section-heading"><h3>Todo o exterior — ZZ</h3></div><dl className="totals-grid">{[
          ['Eleitores aptos', number(data.summary.totals.eligible)], ['Comparecimento', number(data.summary.totals.turnout)],
          ['Abstenção', `${number(data.summary.totals.abstentions)} (${rate(data.summary.totals.eligible !== null && data.summary.totals.abstentions !== null ? percent(data.summary.totals.abstentions, data.summary.totals.eligible) : null)})`],
          ['Votos válidos', number(data.summary.totals.valid)], ['Brancos', `${number(data.summary.totals.blank)} (${rate(percent(data.summary.totals.blank, data.summary.totals.totalVotes))})`],
          ['Nulos', `${number(data.summary.totals.null)} (${rate(percent(data.summary.totals.null, data.summary.totals.totalVotes))})`],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="query-note">{number(data.summary.exteriorCities)} localidades eleitorais · zona 1 · {number(data.summary.sections)} seções com registros de votos. {number(data.summary.totals.nonInstalledEligible ?? null)} eleitores de {number(data.summary.nonInstalledSections)} seções não instaladas permanecem separados da abstenção.</p></section>
        <div className="table-scroll" role="region" tabIndex={0} aria-label="Candidaturas no exterior"><table className="national-table"><caption className="sr-only">Votos por candidatura em todo o exterior. Percentuais sobre os votos válidos do exterior.</caption><thead><tr>{['Candidatura', 'Partido', 'Votos', '% dos válidos'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.summary.candidates.map((candidate) => <tr key={candidate.number}><th scope="row">{candidate.name} <span className="candidate-number">{candidate.number}</span></th><td>{candidate.party}</td><td>{number(candidate.votes)}</td><td>{rate(candidate.percentValid)}</td></tr>)}</tbody></table></div>
        <div className="table-footer"><span role="status" aria-live="polite" aria-atomic="true">{number(data.summary.exteriorCities)} localidades reconciliadas · exterior completo</span><span>% da candidatura = votos ÷ votos válidos do exterior × 100.</span></div>
        <details className="exterior-cities" id="localidades" open={Boolean(filters.search || filters.page > 1)}><summary>Explorar cidades e locais de votação ({data.pagination.total})</summary>
          <p className="query-note">Localidades sem seções instaladas permanecem na cobertura. Zero votos só aparece quando confirmado pela apuração oficial; nenhuma seção é inventada.</p>
          <div className="table-scroll" role="region" tabIndex={0} aria-label="Localidades eleitorais do exterior"><table><thead><tr><th scope="col">Cidade / localidade</th><th scope="col">Código TSE</th><th scope="col">Votos válidos</th><th scope="col">Seções não instaladas</th></tr></thead><tbody>{data.items.length ? data.items.map((city) => <tr key={city.code}><th scope="row"><Link href={`/exterior/${city.code}?year=${filters.year}&round=${filters.round}&uf=ZZ`} prefetch={false}>{city.name}</Link></th><td>{city.code}</td><td>{number(city.totals.valid)}</td><td>{number(city.nonInstalledSections ?? null)}</td></tr>) : <tr><td colSpan={4}><p className="query-context">Nenhuma localidade nesta página. Confira o nome pesquisado ou volte à primeira página.</p></td></tr>}</tbody></table></div>
          <div className="table-footer"><span>{data.pagination.total} localidade(s) encontrada(s) · página {filters.page}</span></div>
          <nav className="pagination" aria-label="Paginação de localidades">{filters.page > 1 && <Link href={pageHref(filters.page - 1)}>Página anterior</Link>}{filters.page * filters.pageSize < data.pagination.total && <Link href={pageHref(filters.page + 1)}>Próxima página</Link>}</nav>
        </details>
        <p className="dataset-note">Fonte: TSE · Versão exterior {data.dataset.id.slice(0, 12)} · <Link href="/fontes">Arquivos, datas e checksums</Link>.</p>
      </>}
    </section>
  </>;
}
