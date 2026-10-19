import Link from 'next/link';
import { percent, type PlaceTract, type UrbanSurroundings } from '@observatorio/contracts';
import { urbanRows } from '../lib/urban';

const number = (value: number) => value.toLocaleString('pt-BR');
const rate = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/**
 * Entorno dos domicílios no município (arquivo municipal do IBGE): moradores dos setores com a pesquisa por característica da face
 * de quadra. A base exclui setores fora da pesquisa; a razão com a população residente compara duas medidas do mesmo Censo.
 */
export function UrbanSurroundingsTable({ data, population }: { data: UrbanSurroundings; population: number | null }) {
  const base = data.counts[0]!;
  return <>
    <p className="query-note">Pesquisa do entorno do Censo 2022: características da face de quadra onde ficam os domicílios, levantadas nos setores escolhidos pelo IBGE para essa pesquisa. Base: {number(base)} moradores em domicílios particulares permanentes ocupados de {number(data.tracts)} setor(es){population ? `, o equivalente a ${rate(percent(base, population))} da população residente` : ''}.{data.suppressedTracts > 0 ? ` ${number(data.suppressedTracts)} setor(es) têm dados omitidos pelo IBGE: entram no total do município, sem detalhe por setor.` : ''} Estar fora da pesquisa não indica ausência da infraestrutura. “Não declarado ou não avaliado” inclui faces sem calçada (para rampa e obstáculo) e faces não percorridas. Descreve o território, não a opinião ou as prioridades dos moradores.</p>
    <div className="table-scroll context-table" role="region" aria-label="Entorno dos domicílios" tabIndex={0}><table>
      <caption><span className="context-caption">Moradores por característica da face de quadra</span> <span className="badge kind-badge kind-universo">Universo do Censo</span> <span className="source-note">IBGE, Censo 2022 — características urbanísticas do entorno dos domicílios, setores com a pesquisa</span></caption>
      <thead><tr><th scope="col">Característica</th><th scope="col">Com o item</th><th scope="col">Sem o item</th><th scope="col">Não declarado ou não avaliado</th></tr></thead>
      <tbody>{urbanRows(data.counts).map((row) => <tr key={row.indicator}><th scope="row">{row.label}</th>
        {[row.present, row.absent, row.other].map((value, index) => <td key={index}>{rate(percent(value, base))}<span className="source-note cell-count">{number(value)}</span></td>)}</tr>)}</tbody>
    </table></div>
  </>;
}

/**
 * Entorno do setor do local: pesquisado (com as contagens), omitido pelo IBGE ou fora da pesquisa — nunca zero nem estimado.
 * Tabela de duas colunas, sem região rolável (como a das candidaturas no cartão): cabe na largura do cartão no celular.
 */
export function TractUrban({ urban }: { urban: NonNullable<NonNullable<PlaceTract['tract']>['urban']> }) {
  if (urban.status === 'suppressed') return <p>Entorno do setor: dados omitidos pelo IBGE (sigilo); não estimados.</p>;
  if (urban.status === 'outside' || !urban.counts) return <p>Entorno do setor: fora dos setores escolhidos pelo IBGE para a pesquisa do entorno; isso não indica ausência da infraestrutura.</p>;
  const base = urban.counts[0]!;
  return <table className="tract-urban">
    <caption>Entorno do setor: moradores em face de quadra com cada item, de {number(base)} pesquisados. <Link href="/metodologia#entorno">Como ler</Link></caption>
    <thead><tr><th scope="col">Característica</th><th scope="col">Com o item</th></tr></thead>
    <tbody>{urbanRows(urban.counts).map((row) => <tr key={row.indicator}><th scope="row">{row.label}</th><td>{rate(percent(row.present, base))} <span className="source-note">({number(row.present)})</span></td></tr>)}</tbody>
  </table>;
}
