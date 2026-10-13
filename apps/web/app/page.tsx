import Link from 'next/link';
import { redirect } from 'next/navigation';
import { municipalityQuerySchema, percent, STATES } from '@observatorio/contracts';
import { getMunicipalities, getNational } from '../lib/results';
import { QueryForm } from '../components/query-form';
import { ErrorSummary, FieldError, QuerySelect, TurnField } from '../components/query-fields';
import { UF_NAMES, queryErrors, rawValue, recoverQuery } from '../lib/query-ui';
import { brazilHref } from '../lib/query-navigation';

export const dynamic = 'force-dynamic';
type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = { ...await searchParams };
  if (raw.uf === '') delete raw.uf;
  if (raw.search === '') delete raw.search;
  if (raw.uf === 'ZZ') {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) if (key !== 'uf' && value !== undefined) for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
    redirect(`/exterior${params.size ? `?${params}` : ''}`);
  }
  const parsed = municipalityQuerySchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : municipalityQuerySchema.parse(recoverQuery(raw, 'municipalities'));
  const errors = parsed.success ? [] : queryErrors(raw, parsed.error.issues);
  const invalid = (field: string) => errors.some((error) => error.field === field);
  const ufChoices = [...STATES].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR'))
    .map((uf) => ({ value: uf as string, label: `${UF_NAMES[uf]} — ${uf}` }));
  ufChoices.push({ value: 'ZZ', label: 'Exterior — ZZ' });
  const national = !filters.uf && !filters.search;
  const state = parsed.success ? national
    ? await getNational({ year: filters.year, round: filters.round, office: filters.office })
    : await getMunicipalities(filters) : null;
  const data = state?.kind === 'ready' ? state.data : null;
  const municipalData = data?.status === 'published' && 'items' in data ? data : null;
  const nationalData = data?.status === 'published' && 'summary' in data ? data : null;
  const items = nationalData ? [{ ...nationalData.summary, code: 'BR', name: 'Todo o Brasil', uf: null, zones: null }]
    : municipalData?.items ?? [];
  const published = data?.status === 'published';
  const number = (value: number | null) => value === null ? 'Indisponível' : new Intl.NumberFormat('pt-BR').format(value);
  const rate = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  function pageHref(page: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page })) if (value !== undefined && value !== '') params.set(key, String(value));
    return `/?${params}`;
  }

  return (
    <>
      <section className="hero" aria-labelledby="titulo">
        <div className="eyebrow"><span aria-hidden="true" /> DADOS PÚBLICOS · BRASIL</div>
        <h1 id="titulo">Um olhar sobre as eleições.<br /><span>Com contexto e transparência.</span></h1>
        <p className="hero-description">Explore o resultado presidencial do Brasil, consulte seus municípios e conheça o contexto dos territórios. Fontes oficiais, critérios explícitos e espaço para suas próprias perguntas.</p>
        <div className="project-note"><span className="badge">{published ? data.dataset.level === 'national' ? 'Cobertura nacional' : 'Piloto municipal' : 'Cobertura e fontes'}</span><p>{published ? data.dataset.level === 'national' ? `Presidência · 2022 · ${data.dataset.coverage?.reconciled.toLocaleString('pt-BR')} municípios reconciliados nas 27 UFs. ${nationalData?.includesExterior ? 'Exterior incluído no consolidado Brasil.' : 'Exterior consultável à parte; confira a cobertura nas fontes.'}` : 'São Paulo · Presidência · 2022. A expansão nacional só aparece após a reconciliação.' : 'A disponibilidade depende do recorte consultado. Veja as versões publicadas e o andamento das importações na transparência.'}</p></div>
      </section>

      <section className="explorer" aria-labelledby="explorar">
        <div className="section-heading"><div><p className="eyebrow">CONSULTA ELEITORAL</p><h2 id="explorar">{national ? 'Resultado presidencial — Brasil' : 'Resultados por município'}</h2></div><Link className="text-link" href="/metodologia">Como ler os dados <span aria-hidden="true">↗</span></Link></div>
        <p className="query-context" id="office" tabIndex={-1}><span className="badge">Cargo: Presidência</span> Outros cargos serão disponibilizados após importação e conferência.</p>
        <ErrorSummary errors={errors} targets={{ year: 'year', round: 'round-1', uf: 'uf', search: 'search', office: 'office' }} />
        <QueryForm key={JSON.stringify(raw)} action="/" className="municipality-filters" label="Filtros da consulta" hintId="municipality-help" submitLabel="Consultar"
          secondary={!national && <Link className="secondary-action" href={brazilHref(filters.year, filters.round)}>Voltar ao Brasil</Link>} hasErrors={errors.length > 0}>
          <input type="hidden" name="office" value="president" />
          <div className="field"><label htmlFor="year">Eleição</label><QuerySelect id="year" name="year" value={rawValue(raw, 'year', filters.year)} errors={errors}
            choices={[{ value: '2022', label: '2022' }, { value: '2026', label: '2026 — ainda não publicado' }]} /></div>
          <TurnField value={rawValue(raw, 'round', filters.round)} errors={errors} />
          <div className="field"><label htmlFor="uf">Unidade da Federação</label><QuerySelect id="uf" name="uf" value={rawValue(raw, 'uf', filters.uf ?? '')} errors={errors}
            choices={[{ value: '', label: 'Todo o Brasil' }, ...ufChoices]} /></div>
          <div className="field search-field"><label htmlFor="search">Município <span className="optional-label">(opcional)</span></label><input type="search" id="search" name="search" placeholder="Buscar por nome" maxLength={100} defaultValue={rawValue(raw, 'search', filters.search ?? '')}
            aria-invalid={invalid('search') || undefined} aria-describedby={invalid('search') ? 'search-error municipality-help' : 'municipality-help'} /><FieldError field="search" errors={errors} /></div>
        </QueryForm>
        <p className="query-note" id="municipality-help">Sem UF e sem busca, a consulta mostra o consolidado do Brasil. Selecione uma UF ou busque um município, com ou sem acentos, para explorar resultados municipais.</p>
        <div className="table-toolbar"><span>{parsed.success ? 'Consulta aplicada: ' : 'Filtros não aplicados · '}Presidência · {filters.year} · {filters.round}º turno{filters.uf ? ` · ${filters.uf}` : national ? ' · Todo o Brasil' : ' · Busca em todas as UFs'}</span><span>{published ? 'Recorte reconciliado · TSE' : 'Recorte sem publicação disponível'}</span></div>
        {nationalData && <p className="notice scope-notice">{nationalData.includesExterior ? <>O quadro Brasil inclui os 5.570 municípios das 27 UFs e {number(nationalData.summary.exteriorCities)} localidades eleitorais do exterior (ZZ). <Link href={`/exterior?round=${filters.round}`}>Consultar somente o exterior</Link>. </> : <>O quadro Brasil reúne os municípios das 27 UFs. Não inclui os votos no exterior (ZZ), ainda separados na transparência; portanto, não representa o total oficial com exterior. </>}<Link href="/fontes">Ver cobertura e fontes</Link>.</p>}
        {items.map((item) => <section className="municipality-summary" key={item.code} aria-label={`Participação em ${item.name}`}>
          <div className="section-heading"><h3>{item.name}{item.uf ? ` / ${item.uf}` : ''}</h3>{item.uf && <Link prefetch={false} href={`/municipios/${item.code}?year=${filters.year}&round=${filters.round}&uf=${item.uf}`} className="text-link">Abrir locais de votação ↗</Link>}</div>
          <dl className="totals-grid">{[
            ['Eleitores aptos', number(item.totals.eligible)],
            ['Comparecimento', number(item.totals.turnout)],
            ['Abstenção', `${number(item.totals.abstentions)} (${rate(item.totals.eligible !== null && item.totals.abstentions !== null ? percent(item.totals.abstentions, item.totals.eligible) : null)})`],
            ['Votos válidos', number(item.totals.valid)],
            ['Brancos', `${number(item.totals.blank)} (${rate(percent(item.totals.blank, item.totals.totalVotes))})`],
            ['Nulos', `${number(item.totals.null)} (${rate(percent(item.totals.null, item.totals.totalVotes))})`],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {item.totals.nonInstalledEligible != null && item.totals.nonInstalledEligible > 0 && <details className="notice installation-note"><summary>A fonte registra {number(item.totals.nonInstalledEligible)} eleitores aptos em {item.nonInstalledSections} seção(ões) não instalada(s). O que significa?</summary>
            <p>São eleitores aptos associados a seções que o TSE classificou como não instaladas — não uma quantidade de votos. Permanecem separados da abstenção: aptos = comparecimento + abstenção + eleitores de seções não instaladas. A fonte de apuração não informa aqui o motivo da não instalação.</p>
            {nationalData ? <><p>Origem do total neste turno:</p><ul>{nationalData.summary.nonInstalledCases.map((entry) => <li key={`${entry.uf}/${entry.code}`}><Link href={entry.uf === 'ZZ' ? `/exterior?round=${filters.round}&search=${encodeURIComponent(entry.name)}` : `/?year=${filters.year}&round=${filters.round}&uf=${entry.uf}&search=${encodeURIComponent(entry.name)}`}>{entry.name} / {entry.uf}</Link>: {number(entry.electors)} eleitores aptos · {number(entry.sections)} seção(ões) não instalada(s).</li>)}</ul></> : <p>Este quantitativo pertence a {item.name} / {item.uf}, no {filters.round}º turno. Não some os mesmos eleitores entre os turnos.</p>}
          </details>}
          <p className="query-note">{nationalData ? `${number(nationalData.summary.municipalities)} municípios · 27 UFs${nationalData.includesExterior ? ` · ${number(nationalData.summary.exteriorCities)} localidades no exterior` : ''}` : `${item.zones} zonas`} · {number(item.sections)} seções principais · {number(item.pollingPlaces)} locais identificados por {national ? 'UF, município ou localidade, ' : ''}zona e número. Abstenção ÷ aptos; brancos e nulos ÷ total de votos no cargo.</p>
        </section>)}
        <div className="table-scroll" role="region" aria-label={national ? 'Tabela do resultado presidencial no Brasil' : 'Tabela de resultados por município'} tabIndex={0}>
          <table className={national ? 'national-table' : undefined}>
            <caption className="sr-only">{national ? `Votos por candidatura no Brasil, ${nationalData?.includesExterior ? 'incluindo' : 'sem'} exterior.` : 'Votos por candidatura no recorte municipal selecionado.'} Percentuais sobre os votos válidos.</caption>
            <thead><tr>{[...(national ? [] : ['Município / UF']), 'Candidatura', 'Partido', 'Votos', '% dos válidos'].map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
            <tbody>{items.length > 0 ? items.flatMap((item) => item.candidates.map((candidate) => <tr key={`${item.uf ?? 'BR'}/${item.code}/${candidate.number}`}>{!national && <td>{item.name} / {item.uf}</td>}<th scope="row">{candidate.name} <span className="candidate-number">{candidate.number}</span></th><td>{candidate.party}</td><td>{number(candidate.votes)}</td><td>{rate(candidate.percentValid)}</td></tr>)) : <tr><td colSpan={national ? 4 : 5}>
              <div className="empty-state" role="status">
                <span className="empty-symbol" aria-hidden="true">≡</span>
                {!parsed.success ? <><h3>Confira os filtros da consulta</h3><p>Há um parâmetro inválido no endereço. Escolha os filtros acima e consulte novamente.</p></> : state?.kind === 'unavailable' ? <><h3>Não foi possível consultar os dados</h3><p>O serviço está indisponível no momento. Tente consultar novamente em instantes.</p></> : published ? <><h3>Nenhum município nesta página da consulta</h3><p>Confira o nome pesquisado e a página. A cobertura está discriminada na transparência.</p><Link className="text-link" href={`/?year=2022&round=${filters.round}`}>Voltar à primeira página</Link></> : <><h3>Nenhuma base publicada para este recorte</h3><p>Os resultados aparecerão aqui após a importação e a conferência dos dados oficiais do TSE.</p><Link href="/fontes" className="text-link">Conheça a cobertura <span aria-hidden="true">↗</span></Link></>}
              </div>
            </td></tr>}</tbody>
          </table>
        </div>
        <div className="table-footer"><span role="status" aria-live="polite" aria-atomic="true">{nationalData ? `Consolidado de ${number(nationalData.summary.municipalities)} municípios · sem paginação` : municipalData ? `${municipalData.pagination.total} município(s) encontrado(s) · página ${filters.page}` : 'Consulta sem resultados publicados'}</span><span>% da candidatura = votos ÷ votos válidos × 100. Totais de participação aparecem uma única vez.</span></div>
        {municipalData && (filters.page > 1 || filters.page * filters.pageSize < municipalData.pagination.total) && <nav className="pagination" aria-label="Paginação de municípios">{filters.page > 1 && <Link href={pageHref(filters.page - 1)}>Página anterior</Link>}{filters.page * filters.pageSize < municipalData.pagination.total && <Link href={pageHref(filters.page + 1)}>Próxima página</Link>}</nav>}
        {published && <p className="dataset-note">Fonte: TSE · Versão doméstica {data.dataset.id.slice(0, 12)}{nationalData?.exteriorDataset ? ` · Versão exterior ${nationalData.exteriorDataset.id.slice(0, 12)}` : ''} · Seções de 2022 reconciliadas com arquivos de apuração gerados em 2026. <Link href="/fontes">Arquivos, datas e checksums</Link>.</p>}
      </section>

      <section className="principles" aria-label="Princípios de leitura">
        <article><span className="card-number">01</span><h2>Resultados, sem rótulos</h2><p>Os mesmos filtros e critérios para todas as candidaturas. A interpretação começa com você.</p></article>
        <article><span className="card-number">02</span><h2>O território tem contexto</h2><p>Indicadores do IBGE serão apresentados na escala disponível, com definição e ano de referência.</p></article>
        <article><span className="card-number">03</span><h2>Cada número, uma fonte</h2><p>Origem, cobertura e método de cálculo acompanharão cada conjunto publicado.</p></article>
      </section>
    </>
  );
}
