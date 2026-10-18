import type { Metadata } from 'next';
import Link from 'next/link';
import { percent, STATES, TURNOUT_CROSS_DIMENSIONS, turnoutProfilesQuerySchema, type TurnoutCrossDimension, type TurnoutProfiles } from '@observatorio/contracts';
import { getTurnoutProfiles } from '../../lib/results';
import { QueryForm } from '../../components/query-form';
import { ErrorSummary, QuerySelect, TurnField } from '../../components/query-fields';
import { MunicipalityField } from '../../components/municipality-field';
import { UF_NAMES, queryErrors, rawValue, type QueryError, type RawQuery } from '../../lib/query-ui';

export const metadata: Metadata = { title: 'Participação por perfil' };
export const dynamic = 'force-dynamic';
const DIMENSION_LABELS: Record<TurnoutCrossDimension, string> = { gender: 'Gênero', age: 'Faixa etária', education: 'Escolaridade declarada', maritalStatus: 'Estado civil', obligation: 'Obrigatoriedade do voto' };
// Duas cores categóricas validadas (claridade, croma, separação para daltonismo e contraste ≥ 3:1 sobre a superfície).
const PAIR = ['#1478a8', '#c0612b'] as const;
const number = (value: number) => value.toLocaleString('pt-BR');
const pct = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
type Cell = TurnoutProfiles['cells'][number];
type Tally = { eligible: number; turnout: number; abstentions: number };

/** Categorias de uma dimensão, na ordem da fonte; obrigatoriedade deriva da idade e da escolaridade (regra conferida na importação). */
function categories(data: TurnoutProfiles, dimension: TurnoutCrossDimension) {
  // Estado civil só existe a partir da v2 da publicação; na v1 a dimensão fica vazia (indisponível, não zero).
  return dimension === 'obligation' ? [{ key: 'mandatory', label: 'Obrigatório' }, { key: 'optional', label: 'Facultativo (16–17, 70+ ou analfabeto)' }] : data.categories[dimension] ?? [];
}
const keyOf = (cell: Cell, dimension: TurnoutCrossDimension) => dimension === 'obligation' ? (cell.optional ? 'optional' : 'mandatory') : cell[dimension] ?? null;
/** Soma contagens (nunca média de taxas) das células que satisfazem os filtros. */
function tally(cells: Cell[]): Tally {
  return cells.reduce((sum, cell) => ({ eligible: sum.eligible + cell.eligible, turnout: sum.turnout + cell.turnout, abstentions: sum.abstentions + cell.abstentions }), { eligible: 0, turnout: 0, abstentions: 0 });
}
const rate = (item: Tally) => percent(item.abstentions, item.eligible);

/** Pontos da taxa de abstenção por categoria das linhas; com duas colunas, um ponto por coluna (legenda sempre presente). */
function DotChart({ rows, series, cross, total }: { rows: Array<{ key: string; label: string }>; series: Array<{ key: string; label: string }> | null; cross: (row: string, col: string | null) => Tally; total: Tally }) {
  const values = rows.flatMap((row) => (series ? series.map((col) => rate(cross(row.key, col.key))) : [rate(cross(row.key, null))]).filter((value): value is number => value !== null));
  const max = Math.max(10, Math.ceil(Math.max(...values, rate(total) ?? 0) / 10) * 10);
  const position = (value: number) => `${value / max * 100}%`;
  return <div className="dot-strip" aria-hidden="true">
    {series && <ul className="dot-legend">{series.map((col, index) => <li key={col.key}><span className="swatch" style={{ background: PAIR[index] }} />{col.label}</li>)}</ul>}
    {rows.map((row) => <div className="dot-row" key={row.key}>
      <span className="dot-name">{row.label}</span>
      <span className="dot-track">{(series ?? [null]).map((col, index) => { const value = rate(cross(row.key, col?.key ?? null)); return value === null ? null
        : <span key={col?.key ?? 'total'} className="dot" style={{ left: position(value), background: series ? PAIR[index] : 'var(--teal)' }} title={`${row.label}${col ? ` · ${col.label}` : ''}: ${pct(value)}`} />; })}</span>
    </div>)}
    <div className="dot-row dot-axis-row"><span className="dot-name" /><span className="dot-axis">{[0, max / 2, max].map((tick) => <span key={tick} style={{ left: position(tick) }}>{tick.toLocaleString('pt-BR')}%</span>)}</span></div>
  </div>;
}

export default async function Participation({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const raw = { ...await searchParams };
  // Sem JavaScript, o formulário envia campos vazios: "Todo o Brasil" e "Toda a UF" são a ausência do filtro.
  if (raw.uf === '') delete raw.uf;
  if (raw.municipality === '') delete raw.municipality;
  const parsed = turnoutProfilesQuerySchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : turnoutProfilesQuerySchema.parse({});
  const sameAxes: QueryError | null = parsed.success && filters.rows === filters.cols ? { field: 'cols', message: 'Escolha dimensões diferentes para linhas e colunas.' } : null;
  const noUf: QueryError | null = parsed.success && filters.municipality && !filters.uf ? { field: 'municipality', message: 'Escolha a UF do município.' } : null;
  const formErrors = [...(parsed.success ? [] : queryErrors(raw, parsed.error.issues)), ...(sameAxes ? [sameAxes] : []), ...(noUf ? [noUf] : [])];
  // Com município, a UF inteira também é consultada: traz a lista de municípios e permite conferir o código pedido.
  const query = { year: filters.year, round: filters.round, uf: filters.uf };
  const [ufData, municipalityData] = formErrors.length ? [null, null] : await Promise.all([getTurnoutProfiles(query), filters.municipality ? getTurnoutProfiles({ ...query, municipality: filters.municipality }) : null]);
  const municipalities = ufData?.municipalities ?? [];
  const unknown: QueryError | null = filters.municipality && ufData?.status === 'published' && municipalities.length > 0 && !municipalities.some((item) => item.code === filters.municipality)
    ? { field: 'municipality', message: `O código ${filters.municipality} não é de um município de ${UF_NAMES[filters.uf!]} na fonte; escolha um da lista.` } : null;
  const errors = [...formErrors, ...(unknown ? [unknown] : [])];
  const data = errors.length ? null : filters.municipality ? municipalityData : ufData;
  const municipalityName = data?.municipality?.name ?? null;
  const place = municipalityName ? `${municipalityName} / ${filters.uf}` : filters.uf ? UF_NAMES[filters.uf] : 'Brasil';
  const published = data?.status === 'published' && data.cells.length > 0 ? data : null;
  const dimensionUnavailable = published && [filters.rows, filters.cols].some((dimension) => categories(published, dimension).length === 0);
  const ufChoices = [{ value: '', label: 'Todo o Brasil (UFs da fonte)' }, ...[...STATES].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR')).map((uf) => ({ value: uf as string, label: `${UF_NAMES[uf]} — ${uf}` }))];
  const dimensionChoices = TURNOUT_CROSS_DIMENSIONS.map((dimension) => ({ value: dimension, label: DIMENSION_LABELS[dimension] }));
  const total = published ? tally(published.cells) : null;
  // Categorias sem nenhum apto no recorte não aparecem (nada a exibir); as demais seguem a ordem da fonte.
  const present = (dimension: TurnoutCrossDimension) => published ? categories(published, dimension).filter((item) => tally(published.cells.filter((cell) => keyOf(cell, dimension) === item.key)).eligible > 0) : [];
  const rows = present(filters.rows), cols = present(filters.cols);
  const cross = (row: string, col: string | null) => tally(published!.cells.filter((cell) => keyOf(cell, filters.rows) === row && (col === null || keyOf(cell, filters.cols) === col)));
  // Gráfico com dois grupos quando as colunas são gênero (feminino × masculino; não informado só na tabela) ou obrigatoriedade.
  const series = filters.cols === 'obligation' ? cols : filters.cols === 'gender' ? cols.filter((col) => col.key !== 'not-informed') : null;
  const hiddenGender = filters.cols === 'gender' && published ? tally(published.cells.filter((cell) => cell.gender === 'not-informed')).eligible : 0;
  const colTotal = (col: string) => tally(published!.cells.filter((cell) => keyOf(cell, filters.cols) === col));
  return <>
    <section className="hero places-hero"><p className="eyebrow">ELEITORADO · COMPARECIMENTO E ABSTENÇÃO</p><h1>Participação por perfil — {place}</h1>
      <p className="hero-description">Quantos eleitores aptos compareceram ou se abstiveram, por gênero, faixa etária, escolaridade e estado civil declarados ao TSE, no Brasil, numa UF ou num município. São contagens da própria Justiça Eleitoral, não estimativas; não há voto por candidatura, porque o voto é secreto. Abstenção não indica motivação.</p></section>
    <section className="explorer" aria-labelledby="participacao-filtros">
      <div className="section-heading"><div><p className="eyebrow">ESCOLHA O RECORTE</p><h2 id="participacao-filtros">Território, turno e cruzamento</h2></div><Link className="text-link" href="/metodologia#participacao">Como ler <span aria-hidden="true">↗</span></Link></div>
      <ErrorSummary errors={errors} targets={{ uf: 'uf', municipality: 'municipality', round: 'round-1', rows: 'rows', cols: 'cols' }} />
      <QueryForm key={JSON.stringify(raw)} action="/participacao" className="municipality-filters" label="Filtros da participação por perfil" submitLabel="Ver participação" resultsId="participacao" hasErrors={errors.length > 0}>
        <div className="field"><label htmlFor="uf">Território</label><QuerySelect id="uf" name="uf" value={rawValue(raw, 'uf', filters.uf ?? '')} errors={errors} choices={ufChoices} /></div>
        <MunicipalityField loadedUf={filters.uf ?? ''} ufName={filters.uf ? UF_NAMES[filters.uf] : null} value={rawValue(raw, 'municipality', filters.municipality ?? '')} errors={errors} choices={municipalities.map((item) => ({ value: item.code, label: item.name }))} />
        <TurnField value={rawValue(raw, 'round', filters.round)} errors={errors} />
        <div className="field"><label htmlFor="rows">Linhas</label><QuerySelect id="rows" name="rows" value={rawValue(raw, 'rows', filters.rows)} errors={errors} choices={dimensionChoices} /></div>
        <div className="field"><label htmlFor="cols">Colunas</label><QuerySelect id="cols" name="cols" value={rawValue(raw, 'cols', filters.cols)} errors={errors} choices={dimensionChoices} /></div>
      </QueryForm>
      <div id="participacao" className="query-results">
        {errors.length ? <p className="notice scope-notice">Corrija os filtros acima para ver a participação.</p>
          : data?.status === 'not-in-source' ? <p className="notice scope-notice">O arquivo de comparecimento por perfil do TSE de 2022 não traz o {UF_NAMES[filters.uf!]}. Os resultados da eleição no DF estão nas outras páginas; aqui não há o que exibir, e nada é estimado.</p>
          : !published || !total ? <p className="notice scope-notice" role="status">Participação por perfil indisponível: {filters.municipality ? 'a publicação por município (import:turnout-profiles, v2) não foi encontrada' : <>a publicação (<code>import:turnout-profiles</code>) não foi encontrada</>}, ou o serviço não respondeu.</p>
          : dimensionUnavailable ? <p className="notice scope-notice" role="status">Estado civil indisponível nesta publicação do comparecimento por perfil (versão anterior à v2). Não é zero: a dimensão não foi importada.</p> : <>
          <dl className="totals-grid">
            <div><dt>Eleitores aptos (perfil)</dt><dd>{number(total.eligible)}</dd></div>
            <div><dt>Comparecimento</dt><dd>{number(total.turnout)} <span className="source-note">· {pct(percent(total.turnout, total.eligible))}</span></dd></div>
            <div><dt>Abstenção</dt><dd>{number(total.abstentions)} <span className="source-note">· {pct(rate(total))}</span></dd></div>
          </dl>
          <p className="query-note context-intro">{filters.round}º turno. {municipalityName ? `Município pelo código do TSE (${filters.municipality}). ` : ''}{filters.uf ? '' : `Brasil = soma das ${published.ufs.length} UFs presentes na fonte; ${published.missingUfs.map((uf) => UF_NAMES[uf]).join(', ')} e exterior não constam do arquivo. `}Os aptos do perfil ({number(total.eligible)}) diferem dos aptos nos resultados {municipalityName ? 'do município' : 'das mesmas UFs'} ({published.resultsEligible === null ? 'indisponível' : number(published.resultsEligible)}): são bases próprias do TSE e a diferença não é ajustada.</p>
          <figure className="dot-figure"><figcaption><span className="choropleth-title">Taxa de abstenção por {DIMENSION_LABELS[filters.rows].toLowerCase()}{series ? ` e ${DIMENSION_LABELS[filters.cols].toLowerCase()}` : ''}</span><span className="source-note">Abstenções ÷ aptos de cada grupo. {series ? 'Um ponto por grupo da legenda; ' : 'Total de cada linha (escolha gênero ou obrigatoriedade nas colunas para comparar dois grupos); '}{hiddenGender > 0 ? `gênero não informado (${number(hiddenGender)} aptos) só na tabela; ` : ''}valores na tabela abaixo.</span></figcaption>
            <DotChart rows={rows} series={series} cross={cross} total={total} /></figure>
          <div className="table-scroll context-table participation-table" role="region" aria-label="Abstenção por perfil" tabIndex={0}><table>
            <caption><span className="context-caption">Taxa de abstenção: {DIMENSION_LABELS[filters.rows]} × {DIMENSION_LABELS[filters.cols]}</span> <span className="badge kind-badge kind-cadastro">Cadastro do TSE</span> <span className="source-note">TSE, perfil do comparecimento e abstenção 2022 · abstenções de aptos em cada célula</span></caption>
            <thead><tr><th scope="col">{DIMENSION_LABELS[filters.rows]}</th>{cols.map((col) => <th scope="col" key={col.key}>{col.label}</th>)}<th scope="col">Total</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th>
              {cols.map((col) => { const item = cross(row.key, col.key); return <td key={col.key}>{item.eligible ? <>{pct(rate(item))}<span className="source-note cell-count">{number(item.abstentions)} de {number(item.eligible)}</span></> : '—'}</td>; })}
              {(() => { const item = cross(row.key, null); return <td>{pct(rate(item))}<span className="source-note cell-count">{number(item.abstentions)} de {number(item.eligible)}</span></td>; })()}</tr>)}
              <tr className="total-row"><th scope="row">Total</th>{cols.map((col) => { const item = colTotal(col.key); return <td key={col.key}>{pct(rate(item))}<span className="source-note cell-count">{number(item.abstentions)} de {number(item.eligible)}</span></td>; })}
                <td>{pct(rate(total))}<span className="source-note cell-count">{number(total.abstentions)} de {number(total.eligible)}</span></td></tr></tbody>
          </table></div>
          <div className="notice scope-notice map-caveats"><p><strong>Como ler.</strong> Cada célula é a abstenção do grupo sobre os aptos do próprio grupo, somando contagens de todos os municípios do recorte. Gênero, idade, escolaridade e estado civil são os do cadastro eleitoral; escolaridade e estado civil são declarados no alistamento e podem estar desatualizados.{municipalityName ? ' Em municípios pequenos, células com poucos aptos variam muito: confira as contagens.' : ''} O voto é facultativo para quem tem 16 ou 17 anos, 70 anos ou mais e para analfabetos — diferenças entre faixas refletem também essa regra. A abstenção pode incluir eleitores falecidos ou que mudaram de domicílio sem atualizar o cadastro, e não indica motivação. Nenhuma relação de causa é sugerida.</p></div>
        </>}
      </div>
    </section>
  </>;
}
