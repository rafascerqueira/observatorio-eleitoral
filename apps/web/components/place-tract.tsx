import Link from 'next/link';
import { TRACT_STATUSES, type PlaceTract, type PlaceTracts } from '@observatorio/contracts';
import { bandName } from '../lib/income-bands';
import { TRACT_STATUS_LABELS, TRACT_STATUS_REASONS } from '../lib/tracts';
import { TractUrban } from './urban-surroundings';

const number = (value: number) => value.toLocaleString('pt-BR');
const reais = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const degrees = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 7 });

/**
 * Setor censitário do local (associação local → setor, Censo 2022): descreve o entorno do prédio, nunca os eleitores.
 * `item` ausente: local com votos sem linha no cadastro de locais usado na associação — nenhum setor é atribuído.
 */
export function PlaceTractDetails({ item }: { item: PlaceTract | undefined }) {
  const tract = item?.tract ?? null;
  const summary = tract ? `Setor censitário ${tract.code}` : item ? `Setor censitário: não associado (${TRACT_STATUS_LABELS[item.status].toLowerCase()})` : 'Setor censitário: local sem registro no cadastro de locais';
  return <details className="place-tract"><summary>{summary}</summary>
    {!item ? <p>Este local não aparece no cadastro de locais do TSE usado na associação; nenhum setor foi atribuído.</p>
      : tract ? <dl className="tract-facts">
        <div><dt>Situação do setor</dt><dd>{tract.situation ?? 'Não informada na malha do IBGE'}</dd></div>
        <div><dt>Pessoas residentes no setor</dt><dd>{tract.residents === null ? 'Indisponível' : number(tract.residents)}</dd></div>
        <div><dt>Rendimento mediano do responsável pelo domicílio (com rendimento)</dt><dd>{tract.incomeMedian === null || tract.incomeBand === null ? 'Indisponível: omitido pelo IBGE ou não se aplica' : `${reais(tract.incomeMedian)} · ${bandName(tract.incomeBand)}`}</dd></div>
      </dl>
      : <p>{TRACT_STATUS_REASONS[item.status as keyof typeof TRACT_STATUS_REASONS]}</p>}
    {tract?.urban && <TractUrban urban={tract.urban} />}
    {item && item.latitude !== null && item.longitude !== null && <p>Coordenada do local no cadastro do TSE: latitude {degrees(item.latitude)}, longitude {degrees(item.longitude)}.</p>}
    {item && item.sharedCoordinate > 0 && <p>{item.sharedCoordinate === 1 ? 'Outro local' : `Outros ${number(item.sharedCoordinate)} locais`} de nome diferente {item.sharedCoordinate === 1 ? 'está' : 'estão'} na mesma coordenada exata: indício de ponto padrão, não de localização precisa.</p>}
    <p>O setor descreve o entorno do prédio de votação, não os eleitores que votam nele. <Link href="/metodologia#perfis">Como a associação é feita</Link>.</p>
  </details>;
}

/** Locais e eleitores do cadastro de locais do município em cada situação da associação (situações sem locais ficam de fora). */
export function TractSummaryTable({ summary }: { summary: NonNullable<PlaceTracts['summary']> }) {
  const rows = TRACT_STATUSES.filter((status) => summary[status].places > 0);
  const total = rows.reduce((sum, status) => ({ places: sum.places + summary[status].places, electors: sum.electors + summary[status].electors }), { places: 0, electors: 0 });
  return <div className="table-scroll context-table" role="region" aria-label="Associação dos locais a setores censitários" tabIndex={0}><table>
    <caption><span className="context-caption">Locais deste município por situação da associação a setores censitários</span> <span className="source-note">Cadastro de locais do TSE (1º turno de 2022) e malha de setores do Censo 2022; eleitores do cadastro de locais.</span></caption>
    <thead><tr><th scope="col">Situação</th><th scope="col">Locais</th><th scope="col">Eleitores no cadastro</th></tr></thead>
    <tbody>{rows.map((status) => <tr key={status}><th scope="row">{TRACT_STATUS_LABELS[status]}</th><td>{number(summary[status].places)}</td><td>{number(summary[status].electors)}</td></tr>)}
      <tr className="total-row"><th scope="row">Total</th><td>{number(total.places)}</td><td>{number(total.electors)}</td></tr></tbody>
  </table></div>;
}
