import Link from 'next/link';
import { contextDistributionSchema, percent, type IncomeBandPopulation, type MunicipalityContext, type UrbanSurroundings } from '@observatorio/contracts';
import { bandName, bandRange, residentsShare } from '../lib/income-bands';
import { UrbanSurroundingsTable } from './urban-surroundings';

type Distribution = MunicipalityContext['race'];
const MINIMUM_WAGE = 1212;
const number = (value: number | null) => value === null ? 'Indisponível' : value.toLocaleString('pt-BR');
const rate = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const share = (value: number | null, total: number | null) => value === null || total === null ? null : percent(value, total);
const money = (value: number | null) => value === null ? 'Indisponível' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const KIND_LABEL = { universo: 'Universo do Censo', amostra: 'Estimativa da amostra', cadastro: 'Cadastro do TSE' } as const;

function Kind({ kind }: { kind: Distribution['kind'] }) {
  return <span className={`badge kind-badge kind-${kind}`}>{KIND_LABEL[kind]}</span>;
}

/** Distribuição de uma fonte: contagem e percentual sobre o total da própria fonte. */
export function DistributionTable({ title, data, unit }: { title: string; data: Distribution; unit: string }) {
  if (!contextDistributionSchema.safeParse(data).success) return <p className="notice" role="status">{title}: não foi possível validar as contagens. Falha técnica ou inconsistência nos dados; esta distribuição não será exibida. Tente novamente ou consulte as fontes.</p>;
  const unavailable = data.total === null || data.categories.some((item) => item.value === null);
  return <div className="table-scroll context-table" role="region" aria-label={title} tabIndex={0}>
    <table>
      <caption><span className="context-caption">{title}</span> <Kind kind={data.kind} /> <span className="source-note">{data.source}</span></caption>
      <thead><tr><th scope="col">Categoria</th><th scope="col">{unit}</th><th scope="col">% do total</th></tr></thead>
      <tbody>{data.categories.map((item) => <tr key={item.key}><th scope="row">{item.label}</th><td>{number(item.value)}</td><td>{rate(share(item.value, data.total))}</td></tr>)}
        {data.undistributed !== undefined && data.undistributed > 0 && <tr><th scope="row">Diferença não discriminada nas categorias da fonte</th><td>{number(data.undistributed)}</td><td>{rate(share(data.undistributed, data.total))}</td></tr>}
        <tr className="total-row"><th scope="row">Total</th><td>{number(data.total)}</td><td>{rate(share(data.total, data.total))}</td></tr></tbody>
    </table>
    {data.undistributed !== undefined && data.undistributed > 0 && <p className="query-note">O total divulgado pela fonte supera a soma das categorias em {number(data.undistributed)} pessoas. Essa diferença foi preservada e não foi redistribuída. A causa não está informada nos dados consultados; não se presume omissão, falta de resposta ou erro da fonte.</p>}
    {data.roundingDifference !== undefined && data.roundingDifference !== 0 && <p className="query-note">Estimativas da amostra arredondadas por célula: a soma das categorias {data.roundingDifference > 0 ? 'supera' : 'fica abaixo de'} o total em {number(Math.abs(data.roundingDifference))} pessoa(s), dentro do limite de arredondamento conferido. As contagens e os percentuais não foram ajustados.</p>}
    {unavailable && <p className="query-note">Há contagens indisponíveis no arquivo consultado. Sem informação adicional da fonte, não distinguimos supressão de ausência; nenhum valor foi convertido em zero ou deduzido por diferença.</p>}
  </div>;
}

/**
 * Moradores pelas faixas fixas de renda do setor (as mesmas de "Perfis"): cada setor entra inteiro na faixa da sua mediana.
 * Medida diferente das classes per capita acima, que classificam pessoas pelo rendimento do próprio domicílio (amostra).
 */
function IncomeBandsTable({ data }: { data: IncomeBandPopulation }) {
  const base = data.total - data.noData.residents;
  return <>
    <p className="query-note">Outra medida, a mesma das faixas de “Perfis”: moradores em domicílios particulares permanentes ocupados conforme a renda mediana do responsável (com rendimento) no setor censitário onde moram. Cada setor entra inteiro na faixa da sua mediana; não é a renda de cada morador.{data.noData.tracts > 0 ? ` ${number(data.noData.residents)} moradores de ${number(data.noData.tracts)} setor(es) sem mediana (não se aplica) ficaram fora dos percentuais.` : ''}{data.undisclosed.tracts > 0 ? ` ${number(data.undisclosed.tracts)} setor(es) com dados omitidos pelo IBGE: moradores não divulgados nem estimados.` : ''}</p>
    <div className="table-scroll context-table" role="region" aria-label="Moradores por faixa de renda do setor" tabIndex={0}>
      <table>
        <caption><span className="context-caption">Moradores por faixa de renda mediana do setor</span> <Kind kind="universo" /> <span className="source-note">IBGE, Censo 2022 — agregados por setor (rendimento do responsável)</span></caption>
        <thead><tr><th scope="col">Faixa</th><th scope="col">Renda mediana do responsável no setor</th><th scope="col">Setores</th><th scope="col">Moradores</th><th scope="col">% dos moradores</th></tr></thead>
        <tbody>{data.bands.map((band) => <tr key={band.index}><th scope="row">{bandName(band.index)}</th><td>{bandRange(band.index)}</td><td>{number(band.tracts)}</td><td>{number(band.residents)}</td><td>{rate(residentsShare(data, band.index))}</td></tr>)}
          <tr className="total-row"><th scope="row">Total</th><td>Setores com mediana</td><td>{number(data.bands.reduce((sum, band) => sum + band.tracts, 0))}</td><td>{number(base)}</td><td>{base === 0 ? 'Indisponível' : '100,0%'}</td></tr></tbody>
      </table>
    </div>
  </>;
}

const DIMENSION_LABEL = { age: 'Idade', education: 'Escolaridade declarada', gender: 'Gênero', maritalStatus: 'Estado civil' } as const;

/** Contexto do município: o que descreve o território (IBGE) separado do que descreve o eleitorado (TSE). Nada é atribuído a eleitores individualmente. */
export function MunicipalityContextPanel({ item, round, sourcesHref, incomeBands, urbanSurroundings }: { item: MunicipalityContext; round: '1' | '2'; sourcesHref: string; incomeBands?: IncomeBandPopulation | null; urbanSurroundings?: UrbanSurroundings | null }) {
  const turnout = item.turnout[round];
  const resultsEligible = item.resultsEligible[round];
  const difference = resultsEligible === null ? null : item.electorate.eligible - resultsEligible;
  const ages = item.populationByAge.categories;
  return <section className="explorer context-panel" aria-labelledby="contexto-titulo">
    <div className="section-heading"><div><p className="eyebrow">TERRITÓRIO E ELEITORADO</p><h2 id="contexto-titulo">Contexto de {item.name} / {item.uf}</h2></div>
      <Link className="text-link" href="/metodologia#contexto">Como ler <span aria-hidden="true">↗</span></Link></div>
    <p className="query-note context-intro">Dados do Censo 2022 (IBGE) descrevem quem mora no município; o cadastro e o comparecimento do TSE descrevem o eleitorado. Nenhuma fonte informa como votou cada grupo: o voto é secreto. Código IBGE {item.ibgeCode}{item.ibgeName.localeCompare(item.name, 'pt-BR', { sensitivity: 'base' }) !== 0 ? ` (nome no IBGE: ${item.ibgeName})` : ''}.</p>
    <dl className="totals-grid">
      {([
        ['População residente', number(item.population.total), 'Censo 2022, universo'],
        ['População de 16 anos ou mais', number(item.population.age16plus), 'idade mínima para votar'],
        ['Eleitores aptos no cadastro', number(item.electorate.eligible), 'perfil do eleitorado, TSE'],
        ['Cadastro ÷ população de 16+', rate(share(item.electorate.eligible, item.population.age16plus)), 'fontes e datas diferentes'],
        ['Rendimento domiciliar per capita mediano', money(item.incomePerCapita.median), item.incomePerCapita.median === null ? 'estimativa da amostra' : `${(item.incomePerCapita.median / MINIMUM_WAGE).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} salário mínimo (R$ 1.212,00) · amostra`],
        ['Alfabetização (15 anos ou mais)', rate(share(item.literacy15.categories.find((entry) => entry.key === 'literate')?.value ?? null, item.literacy15.total)), 'Censo 2022, universo'],
      ] as const).map(([label, value, detail]) => <div key={label}><dt>{label}</dt><dd>{value}<span className="totals-detail">{detail}</span></dd></div>)}
    </dl>
    <p className="notice scope-notice">O cadastro do TSE é uma base própria: soma {number(item.electorate.eligible)} eleitores aptos, enquanto os resultados do {round}º turno registram {number(resultsEligible)}{difference ? ` (diferença de ${number(Math.abs(difference))})` : ''}. Domicílio eleitoral não é residência: a razão entre cadastro e população pode passar de 100% sem indicar irregularidade. <Link href={sourcesHref}>Fontes e cobertura</Link>.</p>

    <details className="context-section" open><summary>Eleitorado e população por idade</summary>
      <div className="table-scroll context-table" role="region" aria-label="Eleitorado e população por idade" tabIndex={0}><table>
        <caption><span className="context-caption">Por faixa etária</span> <Kind kind="universo" /> <Kind kind="cadastro" /> <span className="source-note">População: SIDRA 9514; eleitores: perfil do eleitorado 2022</span></caption>
        <thead><tr><th scope="col">Faixa</th><th scope="col">População (IBGE)</th><th scope="col">Eleitores aptos (TSE)</th><th scope="col">Cadastro ÷ população</th></tr></thead>
        <tbody>{ages.map((band) => { const electors = item.electorate.age.categories.find((entry) => entry.key === band.key)?.value ?? null; return <tr key={band.key}><th scope="row">{band.label}{['a16', 'a17'].includes(band.key) || ['a70-74', 'a75-79', 'a80-84', 'a85-89', 'a90-94', 'a95-99', 'a100+'].includes(band.key) ? <span className="source-note"> · voto facultativo</span> : null}</th><td>{number(band.value)}</td><td>{number(electors)}</td><td>{rate(share(electors, band.value))}</td></tr>; })}
          {item.electorate.age.categories.filter((entry) => ['invalid', 'not-informed'].includes(entry.key) && entry.value).map((entry) => <tr key={entry.key}><th scope="row">{entry.label}</th><td>—</td><td>{number(entry.value)}</td><td>—</td></tr>)}</tbody>
      </table></div>
      <p className="query-note">Por faixa, o cadastro pode superar a população sem indicar erro de cálculo: o eleitor vota onde mantém o domicílio eleitoral (por exemplo, o município de origem), não necessariamente onde mora, e o cadastro pode manter registros de pessoas que o Censo já não conta no município. As idades também têm referências diferentes: o Censo as conta em 31/07/2022 e o arquivo do TSE não informa a data, o que pesa mais nas faixas de um ano (16 a 20).</p>
    </details>

    <details className="context-section" open><summary>Comparecimento e abstenção por perfil — {round}º turno</summary>
      {turnout === null ? <p className="notice">O arquivo de comparecimento por perfil do TSE de 2022 não traz esta UF. Não disponível — não é zero.</p> : <>
        <p className="query-note">Base própria do TSE: {number(turnout.eligible)} aptos, {number(turnout.turnout)} comparecimentos. Abstenção do grupo ÷ aptos do grupo, no próprio arquivo; abstenção não indica motivação. <Link href={`/participacao?uf=${item.uf}&municipality=${item.code}&round=${round}#participacao`}>Cruzar dois perfis deste município (por exemplo, faixa etária × gênero)</Link>.</p>
        {turnout.dimensions.map((dimension) => <div key={dimension.dimension} className="table-scroll context-table" role="region" aria-label={`Comparecimento por ${DIMENSION_LABEL[dimension.dimension].toLowerCase()}`} tabIndex={0}><table>
          <caption><span className="context-caption">{DIMENSION_LABEL[dimension.dimension]}</span> <Kind kind="cadastro" /> <span className="source-note">TSE, comparecimento e abstenção por perfil 2022</span></caption>
          <thead><tr><th scope="col">Grupo</th><th scope="col">Aptos</th><th scope="col">Comparecimento</th><th scope="col">Abstenção</th><th scope="col">% de abstenção</th></tr></thead>
          <tbody>{dimension.categories.map((entry) => <tr key={entry.key}><th scope="row">{entry.label}</th><td>{number(entry.eligible)}</td><td>{number(entry.turnout)}</td><td>{number(entry.abstentions)}</td><td>{rate(percent(entry.abstentions, entry.eligible))}</td></tr>)}</tbody>
        </table></div>)}
      </>}
    </details>

    <details className="context-section"><summary>Eleitorado por gênero e estado civil (TSE)</summary>
      <p className="query-note">Cadastro eleitoral: gênero e estado civil declarados ao TSE; o estado civil é o do alistamento ou da última atualização e pode estar desatualizado. Esta página não traz um dado do Censo equivalente para comparar.</p>
      <DistributionTable title="Gênero dos eleitores aptos" data={item.electorate.gender} unit="Eleitores" />
      <DistributionTable title="Estado civil dos eleitores aptos" data={item.electorate.maritalStatus} unit="Eleitores" />
    </details>

    <details className="context-section"><summary>Escolaridade: eleitorado (TSE) e população de 18+ (IBGE)</summary>
      <p className="query-note">As duas fontes usam classificações diferentes e não são comparáveis linha a linha: a do TSE é a escolaridade declarada no alistamento, que pode estar desatualizada; a do IBGE é o nível de instrução estimado pela amostra do Censo.</p>
      <DistributionTable title="Escolaridade declarada dos eleitores aptos" data={item.electorate.education} unit="Eleitores" />
      <DistributionTable title="Nível de instrução da população de 18 anos ou mais" data={item.education18} unit="Pessoas" />
    </details>

    <details className="context-section"><summary>Rendimento domiciliar per capita (IBGE)</summary>
      <p className="query-note">Moradores de domicílios particulares permanentes por classes de rendimento domiciliar per capita, em salários mínimos de R$ 1.212,00 (vigente em julho de 2022). Média {money(item.incomePerCapita.mean)} · mediana {money(item.incomePerCapita.median)}. É o rendimento de quem mora no município, não dos eleitores.</p>
      <DistributionTable title="Classes de rendimento domiciliar per capita" data={item.incomeClasses} unit="Moradores" />
      {incomeBands && <IncomeBandsTable data={incomeBands} />}
    </details>

    {urbanSurroundings && <details className="context-section"><summary>Entorno dos domicílios (IBGE)</summary>
      <UrbanSurroundingsTable data={urbanSurroundings} population={item.population.total} />
    </details>}

    <details className="context-section"><summary>Cor ou raça e alfabetização (IBGE)</summary>
      <p className="query-note">O cadastro do TSE de 2022 não informa cor ou raça dos eleitores; estes dados descrevem a população do município.</p>
      <DistributionTable title="População por cor ou raça" data={item.race} unit="Pessoas" />
      <DistributionTable title="Pessoas de 15 anos ou mais por alfabetização" data={item.literacy15} unit="Pessoas" />
    </details>
  </section>;
}
