import type { Metadata } from 'next';
import Link from 'next/link';
import { MINIMUM_WAGE_2022, OFFICES, OFFICE_LABELS, PLACE_GROUP_CUTS, PLACE_GROUP_INDICATORS, STATES, TRACT_DEMOGRAPHY_INDICATORS, TRACT_SENSITIVITY_RADII, placeGroupLimits, placeGroupsQuerySchema, type PlaceGroupIndicator, type PlaceGroups, type TractAgreement, type TractSensitivityRadius } from '@observatorio/contracts';
import { getCatalog, getPlaceGroups } from '../../lib/results';
import { QueryForm } from '../../components/query-form';
import { ErrorSummary, QuerySelect } from '../../components/query-fields';
import { RoundField, UfField } from '../../components/round-field';
import { RAMPS } from '../../components/choropleth';
import { bandName, bandRange, residentsShare } from '../../lib/income-bands';
import { UF_NAMES, officeScopeError, queryErrors, rawValue, type RawQuery } from '../../lib/query-ui';
import { availabilityFromCatalog } from '../../lib/rounds';

export const metadata: Metadata = { title: 'Perfil dos locais' };
export const dynamic = 'force-dynamic';
const pct = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const number = (value: number) => value.toLocaleString('pt-BR');
const reais = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const wages = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
type Group = PlaceGroups['groups'][number];
const RADIUS_LABELS: Record<TractSensitivityRadius, string> = { '250': '250 m', '500': '500 m', '1000': '1 km' };
const points = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })} p.p.`;
const limit = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
/** Nome curto da faixa fixa (renda em salários mínimos; demais em % dos eleitores aptos do local) ou do quinto (versões com quintis). */
const groupName = (data: PlaceGroups, index: number) => {
  if (data.method !== 'bands') return `${index}º quinto`;
  if (data.indicator === 'income-median') return bandName(index);
  const { lower, upper } = placeGroupLimits(data.indicator, index);
  return lower === null ? `Até ${limit(upper!)}` : upper === null ? `Acima de ${limit(lower)}` : `Mais de ${limit(lower)} a ${limit(upper)}`;
};
/** Definição por extenso: o critério que põe um local no grupo, sem rótulos de classe. */
const definition = (data: PlaceGroups, index: number, group: Group | undefined) => {
  const short = PLACE_GROUP_INDICATORS[data.indicator].short;
  if (data.method !== 'bands') return group ? `${index}º quinto dos eleitores aptos, em locais com ${pct(group.from)} a ${pct(group.to)} de ${short}` : '';
  if (data.indicator === 'income-median') return data.association
    ? `Locais cujos setores a até ${RADIUS_LABELS[data.association.radius]} (mesmo município) têm mais moradores na renda mediana do responsável ${bandRange(index)}`
    : `Locais em setores com renda mediana do responsável ${bandRange(index)}`;
  const { lower, upper } = placeGroupLimits(data.indicator, index);
  return `Locais com ${lower === null ? `até ${limit(upper!)}` : upper === null ? `mais de ${limit(lower)}` : `mais de ${limit(lower)} até ${limit(upper)}`} de ${short} entre os eleitores aptos`;
};
/**
 * Menor valor observado sem colidir com o limite inferior (excluído) da faixa: 10,03% numa faixa "mais de 10%" não vira "10,0%".
 * Acrescenta casas decimais até o número se distinguir do limite (no máximo três).
 */
const above = (value: number, lower: number | null | undefined, digits: number, format: (value: number, digits: number) => string) => {
  if (lower === null || lower === undefined || value <= lower) return format(value, digits);
  for (let extra = digits; extra <= 3; extra++) if (Number(value.toFixed(extra)) !== lower) return format(value, extra);
  return `mais de ${format(lower, digits)}`;
};
const fixedPct = (value: number, digits: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const fixedWages = (value: number, digits: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const fixedReais = (value: number, digits: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits });
const observed = (indicator: PlaceGroupIndicator, group: Group) => group.from === null || group.to === null ? 'Faixa predominante no entorno (sem valor único)'
  : indicator !== 'income-median' ? `${above(group.from, group.lower, 1, fixedPct)} a ${pct(group.to)}`
  : `${above(group.from, group.lower, 0, fixedReais)} a ${reais(group.to)} (${above(group.from / MINIMUM_WAGE_2022, group.lower == null ? null : group.lower / MINIMUM_WAGE_2022, 1, fixedWages)} a ${wages(group.to / MINIMUM_WAGE_2022)} SM)`;
/** Maior diferença, em pontos percentuais dos válidos, de uma candidatura num mesmo grupo entre a associação por raio e a publicada. */
function largestDifference(alternative: PlaceGroups, reference: PlaceGroups) {
  let best: { value: number; name: string; index: number; places: number } | null = null;
  for (const group of alternative.groups) {
    const base = reference.groups.find((item) => item.index === group.index);
    if (!base) continue;
    for (const candidate of group.candidates) {
      const other = base.candidates.find((item) => item.number === candidate.number);
      if (candidate.percentValid === null || other?.percentValid == null) continue;
      const value = candidate.percentValid - other.percentValid;
      if (!best || Math.abs(value) > Math.abs(best.value)) best = { value, name: candidate.name, index: group.index, places: group.places };
    }
  }
  return best;
}
/** Concordância com o setor do local, em % dos eleitores aptos dos locais associados do território. */
function SensitivityTable({ reference, variants, current, href }: { reference: PlaceGroups; variants: Array<{ radius: TractSensitivityRadius; data: PlaceGroups | null }>; current: TractSensitivityRadius | undefined; href: (radius?: TractSensitivityRadius) => string }) {
  const total = (agreement: TractAgreement) => Object.values(agreement).reduce((sum, item) => sum + item.eligible, 0);
  const share = (data: PlaceGroups | null, key: keyof TractAgreement) => data?.association ? pct(data.association.agreement[key].eligible / total(data.association.agreement) * 100) : '—';
  const inGroups = (data: PlaceGroups | null) => data ? <>{number(data.coverage.placesInGroups)} <span className="source-note">· {number(data.groups.reduce((sum, group) => sum + group.eligible, 0))} aptos</span></> : 'Indisponível';
  const rows: Array<[string, keyof TractAgreement]> = [['Mesma faixa do setor do local', 'same'], ['Faixa vizinha', 'adjacent'], ['Duas faixas ou mais de distância', 'distant'], ['Sem faixa pelo raio (empate entre faixas)', 'tie'], ['Só com o raio (setor do local sem mediana)', 'radiusOnly'], ['Sem faixa em nenhuma', 'none']];
  return <div className="table-scroll context-table" role="region" aria-label="Sensibilidade à associação local → setor" tabIndex={0}><table>
    <caption><span className="context-caption">Sensibilidade à associação local → setor</span> <span className="source-note">Mesmos locais e votos; muda só a faixa atribuída a cada local</span></caption>
    <thead><tr><th scope="col">Medida</th><th scope="col">Setor que contém o local (publicada)</th>{variants.map(({ radius }) => <th scope="col" key={radius}>Setores a até {RADIUS_LABELS[radius]}</th>)}</tr></thead>
    <tbody>
      <tr><th scope="row">Locais nos grupos</th><td>{inGroups(reference)}</td>{variants.map(({ radius, data }) => <td key={radius}>{inGroups(data)}</td>)}</tr>
      {rows.map(([label, key]) => <tr key={key}><th scope="row">{label} <span className="source-note">% dos aptos dos locais associados</span></th><td>—</td>{variants.map(({ radius, data }) => <td key={radius}>{share(data, key)}</td>)}</tr>)}
      <tr><th scope="row">Maior diferença de uma candidatura num grupo <span className="source-note">% dos válidos, raio − publicada</span></th><td>—</td>{variants.map(({ radius, data }) => { const best = data ? largestDifference(data, reference) : null;
        return <td key={radius}>{best ? <>{points(best.value)} <span className="source-note">· {best.name}, {bandName(best.index)} ({number(best.places)} locais)</span></> : '—'}</td>; })}</tr>
      <tr><th scope="row">Ver os grupos</th><td>{current ? <Link href={href()}>Associação publicada</Link> : <span aria-current="true">Em exibição</span>}</td>{variants.map(({ radius, data }) => <td key={radius}>{!data ? '—' : current === radius ? <span aria-current="true">Em exibição</span> : <Link href={href(radius)}>Com raio de {RADIUS_LABELS[radius]}</Link>}</td>)}</tr>
    </tbody>
  </table></div>;
}

/** Pontos por candidatura, um por grupo, na mesma escala para todas (HTML: texto legível em qualquer largura). A matriz abaixo é o acesso por teclado e leitor de tela. */
function DotStrip({ data, order }: { data: PlaceGroups; order: Array<{ candidate: string; info: { name: string } }> }) {
  const max = Math.max(10, Math.ceil(Math.max(...data.groups.flatMap((group) => group.candidates.map((item) => item.percentValid ?? 0))) / 10) * 10);
  const position = (value: number) => `${value / max * 100}%`;
  return <div className="dot-strip" aria-hidden="true">
    <ul className="dot-legend">{data.groups.map((group) => <li key={group.index}><span className="swatch" style={{ background: RAMPS.teal[group.index - 1] }} />{groupName(data, group.index)}</li>)}</ul>
    {order.map(({ candidate, info }) => <div className="dot-row" key={candidate}>
      <span className="dot-name">{info.name}</span>
      <span className="dot-track">{data.groups.map((group) => { const value = group.candidates.find((item) => item.number === candidate)?.percentValid ?? null; return value === null ? null
        : <span key={group.index} className="dot" style={{ left: position(value), background: RAMPS.teal[group.index - 1] }} title={`${groupName(data, group.index)}: ${pct(value)}`} />; })}</span>
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
  const radiusError = filters.radius && filters.indicator !== 'income-median' ? { field: 'indicator', message: 'O raio da associação local → setor só se aplica à renda do setor; escolha esse indicador ou envie os filtros de novo.' } : null;
  const errors = [...(parsed.success ? [] : queryErrors(raw, parsed.error.issues)), ...(scopeError ? [scopeError] : []), ...(radiusError ? [radiusError] : [])];
  const valid = parsed.success && !scopeError && !radiusError;
  // Renda: a associação publicada e as três variantes por raio, para a tabela de sensibilidade (a escolhida vira a principal).
  const income = valid && filters.indicator === 'income-median';
  const { radius, ...base } = filters;
  const [catalog, reference, ...variantData] = await Promise.all([getCatalog(), valid ? getPlaceGroups(base) : null, ...TRACT_SENSITIVITY_RADII.map((item) => income ? getPlaceGroups({ ...base, radius: item }) : null)]);
  const variants = TRACT_SENSITIVITY_RADII.map((item, index) => ({ radius: item, data: variantData[index]?.status === 'published' && variantData[index]!.groups.length > 0 ? variantData[index]! : null }));
  const data = radius ? variantData[TRACT_SENSITIVITY_RADII.indexOf(radius)] ?? null : reference;
  const sensitivityHref = (item?: TractSensitivityRadius) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...base, radius: item })) if (value) query.set(key, String(value));
    return `/perfis?${query}#grupos`;
  };
  const availability = availabilityFromCatalog(catalog?.datasets ?? []);
  const meta = PLACE_GROUP_INDICATORS[filters.indicator];
  const place = filters.uf ? UF_NAMES[filters.uf] : 'Brasil';
  const published = data?.status === 'published' && data.groups.length > 0 ? data : null;
  // Moradores do território nas mesmas faixas: renda (domicílios particulares permanentes ocupados) ou demografia do setor (15+).
  const demography = filters.indicator in TRACT_DEMOGRAPHY_INDICATORS ? TRACT_DEMOGRAPHY_INDICATORS[filters.indicator as keyof typeof TRACT_DEMOGRAPHY_INDICATORS] : null;
  const withPopulation = filters.indicator === 'income-median' || demography !== null;
  const population = published?.method === 'bands' && withPopulation ? published.population ?? null : null;
  const residents = (index: number) => <td>{population ? <>{number(population.bands[index - 1]!.residents)} <span className="source-note">· {pct(residentsShare(population, index))}</span></> : '—'}</td>;
  const order = published ? [...new Set(published.groups.flatMap((group) => group.candidates.map((item) => item.number)))]
    .map((candidate) => ({ candidate, info: published.groups.flatMap((group) => group.candidates).find((item) => item.number === candidate)!, votes: published.groups.reduce((sum, group) => sum + (group.candidates.find((item) => item.number === candidate)?.votes ?? 0), 0) }))
    .sort((a, b) => b.votes - a.votes) : [];
  const ufChoices = [{ value: '', label: 'Todo o Brasil' }, ...[...STATES].sort((a, b) => UF_NAMES[a].localeCompare(UF_NAMES[b], 'pt-BR')).map((uf) => ({ value: uf as string, label: `${UF_NAMES[uf]} — ${uf}` }))];
  return <>
    <section className="hero places-hero"><p className="eyebrow">LOCAIS DE VOTAÇÃO · PERFIL E ENTORNO</p><h1>Resultados por perfil dos locais — {place}</h1>
      <p className="hero-description">Locais de votação agrupados pela escolaridade declarada dos seus eleitores (cadastro do TSE) ou pela renda do setor censitário onde ficam (Censo 2022), com os votos somados em cada grupo. Os grupos descrevem locais, não pessoas: o voto é secreto e ninguém votou “como grupo”.</p></section>
    <section className="explorer" aria-labelledby="perfis-filtros">
      <div className="section-heading"><div><p className="eyebrow">ESCOLHA O RECORTE</p><h2 id="perfis-filtros">Indicador, cargo e território</h2></div><Link className="text-link" href="/metodologia#perfis">Como ler <span aria-hidden="true">↗</span></Link></div>
      <ErrorSummary errors={errors} targets={{ indicator: 'indicator', office: 'office', uf: 'uf', round: 'round-1', radius: 'indicator' }} />
      <QueryForm key={JSON.stringify(raw)} action="/perfis" className="municipality-filters" label="Filtros dos grupos de locais" submitLabel="Ver grupos" resultsId="grupos" hasErrors={errors.length > 0}>
        <div className="field"><label htmlFor="indicator">Agrupar locais por</label><QuerySelect id="indicator" name="indicator" value={rawValue(raw, 'indicator', filters.indicator)} errors={errors}
          choices={(Object.keys(PLACE_GROUP_INDICATORS) as PlaceGroupIndicator[]).map((key) => ({ value: key, label: PLACE_GROUP_INDICATORS[key].label }))} /></div>
        <div className="field"><label htmlFor="office">Cargo</label><QuerySelect id="office" name="office" value={rawValue(raw, 'office', filters.office)} errors={errors} choices={OFFICES.map((office) => ({ value: office, label: OFFICE_LABELS[office] }))} /></div>
        <UfField office={rawValue(raw, 'office', filters.office)} value={rawValue(raw, 'uf', filters.uf ?? '')} errors={errors} choices={ufChoices} />
        <RoundField year={filters.year} availability={availability} office={rawValue(raw, 'office', filters.office)} uf={rawValue(raw, 'uf', filters.uf ?? '')} value={rawValue(raw, 'round', filters.round)} errors={errors} />
      </QueryForm>
      <div id="grupos" className="query-results">
        {!valid ? <p className="notice scope-notice">Corrija os filtros acima para ver os grupos.</p>
          : data?.status === 'round-not-held' ? <p className="notice scope-notice">Não houve {filters.round}º turno para {OFFICE_LABELS[filters.office]}{filters.uf ? ` em ${UF_NAMES[filters.uf]}` : ''}.</p>
          : !published ? <p className="notice scope-notice" role="status">Grupos indisponíveis: {radius ? 'a análise de sensibilidade da associação local → setor (import:tract-sensitivity) não foi publicada, ou o serviço não respondeu.' : 'o perfil dos locais, a associação aos setores ou os resultados ainda não foram publicados, ou o serviço não respondeu.'}</p> : <>
          {published.association && <div className="notice scope-notice" role="status"><p><strong>Associação alternativa: setores a até {RADIUS_LABELS[published.association.radius]} do local.</strong> Análise de sensibilidade, não a métrica publicada: cada local entra na faixa com mais moradores entre os setores do mesmo município a essa distância do ponto do TSE. <Link href={sensitivityHref()}>Voltar à associação publicada</Link> (setor que contém o local). Os filtros acima também voltam a ela.</p></div>}
          <p className="query-note context-intro">{published.method === 'bands'
            ? `Faixas fixas, iguais no Brasil, em cada UF e em cada cargo${filters.indicator === 'income-median' ? `, em salários mínimos de 2022 (${reais(MINIMUM_WAGE_2022)} na data de referência do Censo, 31/07/2022)` : ''}: o tamanho de cada grupo varia com o território — veja a parcela dos eleitores aptos.`
            : 'Cada grupo reúne cerca de um quinto dos eleitores aptos dos locais com o indicador; locais com o mesmo valor ficam no mesmo grupo. Os limites são do recorte escolhido e mudam com ele.'} {number(published.coverage.placesInGroups)} de {number(published.coverage.places)} locais com votos entraram nos grupos, com {pct(published.coverage.votesInGroups / published.coverage.totalVotes * 100)} dos votos do recorte; os demais ficaram de fora por não terem o indicador{filters.indicator === 'income-median' ? ` (sem coordenada confiável, fora de setor do próprio município ou com ponto compartilhado por locais diferentes${published.association ? '; com o raio, também os locais com empate entre faixas ou sem setores com mediana no entorno' : ''})` : ''}. Fonte do indicador: {meta.source}.</p>
          <div className="table-scroll context-table" role="region" aria-label="Grupos de locais" tabIndex={0}><table>
            <caption><span className="context-caption">Grupos de locais</span> <span className={`badge kind-badge kind-${meta.kind}`}>{meta.kind === 'cadastro' ? 'Cadastro do TSE' : 'Universo do Censo'}</span> <span className="source-note">{meta.label}</span></caption>
            <thead><tr><th scope="col">Grupo</th><th scope="col">Definição</th><th scope="col">Valores observados</th><th scope="col">Locais</th><th scope="col">Eleitores aptos (cadastro) · % do recorte</th>{population && <th scope="col">{demography ? 'Moradores de 15+ em setores da faixa (Censo)' : 'Moradores do território em setores da faixa'}</th>}<th scope="col">Votos válidos</th></tr></thead>
            <tbody>{(published.method === 'bands' ? Array.from({ length: PLACE_GROUP_CUTS[published.indicator].length + 1 }, (_, index) => index + 1) : published.groups.map((group) => group.index)).map((index) => {
              const group = published.groups.find((item) => item.index === index);
              const eligible = published.groups.reduce((sum, item) => sum + item.eligible, 0);
              return <tr key={index}><th scope="row"><span className="swatch" style={{ background: RAMPS.teal[index - 1] }} aria-hidden="true" /> {groupName(published, index)}</th><td className="definition-cell">{definition(published, index, group)}</td>
                {group ? <><td>{observed(filters.indicator, group)}</td><td>{number(group.places)}</td><td>{number(group.eligible)} <span className="source-note">· {pct(group.eligible / eligible * 100)}</span></td>{population && residents(index)}<td>{number(group.valid)}</td></>
                  : <><td colSpan={3}>Nenhum local nesta faixa</td>{population && residents(index)}<td>—</td></>}</tr>;
            })}</tbody>
          </table></div>
          {population && demography && <p className="query-note">Moradores ({place}): pessoas de 15 anos ou mais (Censo 2022, universo, agregados de demografia por setor), somadas pelos setores em que a parcela de {demography.definition} cai em cada faixa — todos os {number(population.bands.reduce((sum, band) => sum + band.tracts, 0) + population.noData.tracts)} setores do território com moradores divulgados, com ou sem local de votação; percentual sobre os {number(population.total)} moradores de 15+ desses setores. O agregado por setor agrupa 15 a 19 anos: a base é 15+, não 16+ (idade mínima para votar){filters.indicator === 'age-16-24' ? ', e a faixa jovem é 15 a 24 anos' : ''}. Compare com a parcela dos eleitores aptos dos locais; o cadastro descreve o eleitorado, o Censo descreve quem mora no setor.{population.coverage ? ` O IBGE omite células com poucas pessoas ("X"): ${number(population.undisclosed.tracts)} setores com alguma célula omitida neste indicador ficam fora, sem estimativa — a comparação cobre ${pct(population.coverage.total ? population.coverage.residents / population.coverage.total * 100 : null)} dos moradores do território.` : ''}</p>}
          {population && !demography && <p className="query-note">Moradores ({place}): pessoas em domicílios particulares permanentes ocupados (Censo 2022, universo), somadas pelos setores de cada faixa — todos os {number(population.bands.reduce((sum, band) => sum + band.tracts, 0) + population.noData.tracts)} setores do território com moradores divulgados, com ou sem local de votação; percentual sobre os {number(population.total - population.noData.residents)} moradores desses setores. Compare com a parcela dos eleitores aptos dos locais em cada faixa. Cada setor entra inteiro na faixa da sua mediana: não é a renda de cada morador.{population.noData.tracts > 0 ? ` ${number(population.noData.residents)} moradores de ${number(population.noData.tracts)} setores sem mediana (não se aplica) ficaram fora.` : ''}{population.undisclosed.tracts > 0 ? ` ${number(population.undisclosed.tracts)} setores têm dados omitidos pelo IBGE: seus moradores não são divulgados nem estimados.` : ''}</p>}
          {withPopulation && !population && <p className="query-note">Moradores por faixa indisponíveis: a publicação {demography ? 'da demografia dos setores (import:tract-demography)' : 'das faixas de renda dos setores (import:income-bands)'} não foi encontrada.</p>}
          <figure className="dot-figure"><figcaption><span className="choropleth-title">% dos votos válidos de cada candidatura, por grupo</span><span className="source-note">Mesma escala para todas as candidaturas; do grupo de {filters.indicator === 'income-median' ? 'menor renda' : 'menor percentual'} (mais claro) ao de maior (mais escuro). Valores na tabela abaixo.</span></figcaption><DotStrip data={published} order={order} /></figure>
          <div className="table-scroll context-table" role="region" aria-label="Votos por candidatura em cada grupo" tabIndex={0}><table>
            <caption><span className="context-caption">{OFFICE_LABELS[filters.office]} — {filters.round}º turno: % dos votos válidos do grupo</span> <span className="source-note">TSE, resultados reconciliados por local</span></caption>
            <thead><tr><th scope="col">Candidatura</th>{published.groups.map((group) => <th scope="col" key={group.index}>{groupName(published, group.index)}</th>)}</tr></thead>
            <tbody>{order.map(({ candidate, info }) => <tr key={candidate}><th scope="row">{info.name} <span className="candidate-number">{candidate}</span> <span className="source-note">{info.party}</span></th>
              {published.groups.map((group) => { const item = group.candidates.find((entry) => entry.number === candidate);
                const before = published.association ? reference?.groups.find((entry) => entry.index === group.index)?.candidates.find((entry) => entry.number === candidate)?.percentValid ?? null : null;
                return <td key={group.index}>{pct(item?.percentValid ?? null)}{item && <span className="source-note"> · {number(item.votes)}</span>}{before !== null && item?.percentValid != null && <span className="source-note cell-count">{points(item.percentValid - before)} vs. publicada</span>}</td>; })}</tr>)}</tbody>
          </table></div>
          {filters.indicator === 'income-median' && reference?.status === 'published' && <>
            <h3 className="sensitivity-heading" id="sensibilidade">Quanto os grupos dependem da associação local → setor</h3>
            <p className="query-note">O local de votação é ligado a um único setor, o que contém o seu ponto no cadastro do TSE. Para testar essa escolha, os mesmos locais são reagrupados pela faixa com mais moradores entre os setores vizinhos do mesmo município. Faixas que mudam pouco indicam que o resultado não depende do setor exato; mudanças grandes pedem cautela. Nenhuma das duas mede a renda dos eleitores.</p>
            {variants.some((item) => item.data) ? <SensitivityTable reference={reference} variants={variants} current={radius} href={sensitivityHref} />
              : <p className="notice scope-notice" role="status">Sensibilidade indisponível: a análise <code>import:tract-sensitivity</code> não foi publicada, ou o serviço não respondeu.</p>}
          </>}
          <div className="notice scope-notice map-caveats"><p><strong>Como ler.</strong> Diferenças entre grupos descrevem locais de votação com características diferentes, não o voto de pessoas com essas características: um local com mais {PLACE_GROUP_INDICATORS[filters.indicator].short} não diz como votaram essas pessoas. O endereço do local não é a residência dos eleitores. {filters.indicator === 'college' || filters.indicator === 'education-low' ? 'A escolaridade é a declarada no alistamento e pode estar desatualizada.' : filters.indicator !== 'income-median' ? 'Gênero e idade são os do cadastro eleitoral; cada indicador é olhado isoladamente, e os grupos também diferem em outras características que não são controladas.' : 'A renda é a mediana do rendimento nominal mensal do responsável pelos domicílios do setor que contém o local, no Censo 2022 — contexto do entorno, não dos eleitores. Faixas com poucos locais reúnem poucos eleitores e variam mais; veja as colunas de locais e eleitores.'} Nenhuma relação de causa é sugerida.</p></div>
        </>}
      </div>
    </section>
  </>;
}
