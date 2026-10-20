import Link from 'next/link';
import { notFound } from 'next/navigation';
import { tractMapQuerySchema, TRACT_STATUSES } from '@observatorio/contracts';
import { getContext, getTractMap } from '../../../../lib/results';
import { bandName, bandRange } from '../../../../lib/income-bands';
import { TRACT_STATUS_LABELS } from '../../../../lib/tracts';
import { BAND_COLORS, NO_BAND, LEVEL_LABELS, childViews, tractMapHref, viewName, viewTrail } from '../../../../lib/tract-map';

export const dynamic = 'force-dynamic';
const number = (value: number) => value.toLocaleString('pt-BR');

/**
 * Mapa local → setor (fase B3): setores do Censo 2022 coloridos só pela faixa de renda mediana do responsável e locais de votação
 * como pontos neutros. Nenhum setor recebe votos; a tabela dos locais é o equivalente do desenho.
 */
export default async function TractMapPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { code } = await params;
  const query = await searchParams;
  const parsed = tractMapQuerySchema.omit({ paths: true }).safeParse(query);
  if (!/^\d+$/.test(code) || !parsed.success) notFound();
  const { uf, year, view } = parsed.data;
  const [result, context] = await Promise.all([getTractMap(code, uf, year, view), getContext(code, uf, year)]);
  if (result.kind === 'missing') notFound();
  const name = context?.kind === 'ready' && context.data.status === 'published' ? context.data.item.name : `Município TSE ${code}`;
  const backHref = `/municipios/${code}?${new URLSearchParams({ uf, year })}`;
  const hero = <section className="hero places-hero"><p className="eyebrow">SETORES CENSITÁRIOS E LOCAIS DE VOTAÇÃO</p><h1>{name} / {uf}</h1>
    <p className="hero-description">Censo 2022 (IBGE) e cadastro de locais do TSE (1º turno de 2022).</p><Link className="text-link" href={backHref}>← Voltar ao município</Link></section>;
  if (result.kind === 'unavailable') return <>{hero}<p className="notice" role="status">Não foi possível consultar ou validar o mapa dos setores. Isso é uma indisponibilidade técnica ou inconsistência da resposta, não ausência de dados. Tente novamente.</p></>;
  if (result.data.status !== 'published') return <>{hero}<p className="notice" role="status">Mapa dos setores ainda sem publicação para esta eleição.</p></>;
  const data = result.data;
  const trail = viewTrail(data.views, data.view);
  const children = childViews(data.views, data.view);
  const here = viewName(data.view, name);
  const legend = data.legend;
  const associated = data.places.filter((place) => place.tract !== null).length;
  const drawn = data.places.filter((place) => place.x !== null).length;
  const statusCount = TRACT_STATUSES.map((status) => ({ status, places: data.places.filter((place) => place.status === status).length })).filter((item) => item.places > 0);
  return <>
    {hero}
    <section className="explorer tract-map" aria-labelledby="mapa-setores">
      <div className="section-heading"><div><p className="eyebrow">{LEVEL_LABELS[data.view.level].toUpperCase()}</p><h2 id="mapa-setores">{here}</h2></div>
        <Link className="text-link" href="/metodologia#mapa-setores">Como ler <span aria-hidden="true">↗</span></Link></div>
      {trail.length > 1 && <nav aria-label="Vistas do mapa"><ol className="tract-trail">{trail.map((item) => <li key={item.id}>{item.id === data.view.id ? <span aria-current="page">{viewName(item, name)}</span> : <Link href={tractMapHref(code, uf, item.level === 'municipality' ? undefined : item.id)}>{viewName(item, name)}</Link>}</li>)}</ol></nav>}
      <p className="query-note">Cada setor censitário aparece com a faixa da renda mediana do responsável com rendimento no setor (Censo 2022, universo), a mesma escala de “Perfis”. Os pontos são os locais de votação na coordenada do cadastro do TSE. O setor descreve o entorno do prédio, não quem vota nele: o endereço do local não é a residência dos eleitores, e nenhum voto é atribuído a setores.</p>
      {data.view.split ? <>
        <p className="notice" role="status">Esta vista tem {number(data.view.tracts)} setores, desenho grande demais para uma página. Escolha uma parte:</p>
        <ul className="tract-views">{children.map((item) => <li key={item.id}><Link href={tractMapHref(code, uf, item.id)}>{viewName(item, name)}</Link> <span className="source-note">{number(item.tracts)} setores</span></li>)}</ul>
      </> : legend && <>
        <figure className="tract-figure">
          {/* Imagem complementar: a tabela abaixo traz os mesmos locais, setores e faixas. */}
          <img src={tractMapHref(code, uf, data.view.level === 'municipality' ? undefined : data.view.id, '/mapa.svg')} width={data.view.width} height={data.view.height} alt="" loading="lazy" decoding="async" />
          <figcaption className="source-note">Desenho simplificado na escala da página (tolerância de cerca de 1 pixel); {number(data.view.tracts)} setores. Pontos: {number(drawn)} de {number(data.places.length)} locais com coordenada dentro do quadro.</figcaption>
        </figure>
        <ul className="choropleth-legend" aria-label="Legenda do mapa dos setores">
          {legend.bands.map((band) => <li key={band.index}><span className="swatch" style={{ background: BAND_COLORS[band.index - 1] }} aria-hidden="true" />{bandName(band.index)} ({number(band.tracts)} setores, {number(band.residents)} moradores)</li>)}
          {legend.noData.tracts + legend.undisclosed.tracts + legend.missing.tracts > 0 && <li><span className="swatch" style={{ background: NO_BAND }} aria-hidden="true" />Sem faixa ({[legend.noData.tracts && `${number(legend.noData.tracts)} com mediana que não se aplica`, legend.undisclosed.tracts && `${number(legend.undisclosed.tracts)} omitidos pelo IBGE`, legend.missing.tracts && `${number(legend.missing.tracts)} sem linha no arquivo de renda`].filter(Boolean).join('; ')})</li>}
          <li><span className="point-key point-associated" aria-hidden="true" />Local associado a um setor</li>
          <li><span className="point-key point-unassociated" aria-hidden="true" />Local com coordenada, sem setor associado</li>
        </ul>
        <p className="query-note">Moradores em domicílios particulares permanentes ocupados. Faixas em salários mínimos de 2022 (R$ 1.212,00): {[1, 2, 3, 4, 5].map((index) => `${bandName(index)} = ${bandRange(index)}`).join('; ')}. Setores omitidos pelo IBGE não são estimados.</p>
        <div className="table-scroll context-table" role="region" aria-label="Locais de votação desta vista" tabIndex={0}><table>
          <caption><span className="context-caption">Locais de votação {data.view.level === 'municipality' ? 'do município' : 'desta parte'}</span> <span className="source-note">{number(data.places.length)} locais, {number(associated)} associados a setores{data.view.level === 'municipality' ? '' : ' desta parte (os sem setor entram quando a coordenada fica no quadro)'}.</span></caption>
          <thead><tr><th scope="col">Zona</th><th scope="col">Local</th><th scope="col">Situação</th><th scope="col">Setor</th><th scope="col">Faixa de renda do setor</th><th scope="col">Eleitores</th></tr></thead>
          <tbody>{data.places.map((place) => <tr key={`${place.zone}/${place.code}`}><td>{place.zone}</td><th scope="row">{place.name ?? `Local ${place.code}`} <span className="source-note">({place.code})</span></th><td>{TRACT_STATUS_LABELS[place.status]}</td><td>{place.tract ?? '—'}</td><td>{place.tract === null ? '—' : place.band === null ? 'Sem faixa' : bandName(place.band)}</td><td>{number(place.electors)}</td></tr>)}</tbody>
        </table></div>
        {statusCount.length > 1 && <p className="query-note">Por situação: {statusCount.map((item) => `${TRACT_STATUS_LABELS[item.status]} ${number(item.places)}`).join('; ')}. Locais sem setor não recebem faixa.</p>}
      </>}
      <p className="source-note">Publicações: desenho {data.displayBatchId.slice(0, 12)}…, faixas de renda {data.incomeBatchId.slice(0, 12)}…, associação {data.associationBatchId.slice(0, 12)}…. <Link href="/fontes#malha-setores">Fontes</Link>.</p>
    </section>
  </>;
}
