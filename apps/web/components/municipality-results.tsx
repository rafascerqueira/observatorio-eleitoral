import Link from 'next/link';
import { percent, type MunicipalityResult } from '@observatorio/contracts';
import { NonValidVotesTable } from './non-valid-votes';

const number = (value: number | null) => value === null ? 'Indisponível' : value.toLocaleString('pt-BR');
const rate = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Uma linha por município para comparar participação; todas as candidaturas têm o mesmo acesso ao detalhe nativo. */
export function MunicipalityResults({ items, href }: { items: MunicipalityResult[]; href: (code: string, uf: string) => string }) {
  return <div className="table-scroll municipality-overview" role="region" aria-label="Tabela de resultados por município" tabIndex={0}>
    <table>
      <caption>Resultados por município <span className="source-note">Compare a participação; abra “Ver votos e detalhes” para todas as candidaturas, brancos, nulos e demais categorias. Em telas menores, deslize a tabela na horizontal para ver as demais colunas.</span></caption>
      <thead><tr>{['Município / UF', 'Eleitores aptos', 'Comparecimento', 'Abstenção', 'Votos válidos', 'Votação e detalhes'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{items.map((item) => <tr key={`${item.uf}/${item.code}`}>
        <th scope="row"><Link prefetch={false} href={href(item.code, item.uf)}>{item.name} / {item.uf}</Link><span className="source-note cell-count">{number(item.pollingPlaces)} locais · {number(item.sections)} seções</span>
          {(item.totals.nonInstalledEligible ?? 0) > 0 && <span className="source-note cell-count">Aviso: seção não instalada; veja os detalhes.</span>}
          {item.nonValidVotes?.some((entry) => entry.votes > 0) && <span className="source-note cell-count">Votos não computados como válidos: veja os detalhes.</span>}
        </th>
        <td>{number(item.totals.eligible)}</td><td>{number(item.totals.turnout)}</td>
        <td>{number(item.totals.abstentions)}<span className="source-note cell-count">{rate(item.totals.abstentions === null || item.totals.eligible === null ? null : percent(item.totals.abstentions, item.totals.eligible))} dos aptos</span></td>
        <td>{number(item.totals.valid)}</td>
        <td><details className="municipality-votes"><summary>Ver votos e detalhes<span className="sr-only"> de {item.name} / {item.uf}</span></summary>
          <table><caption>Votos por candidatura — {item.name} / {item.uf}. Percentual sobre os votos válidos.</caption>
            <thead><tr><th scope="col">Candidatura / partido</th><th scope="col">Votos</th><th scope="col">% dos válidos</th></tr></thead>
            <tbody>{item.candidates.map((candidate) => <tr key={candidate.number}><th scope="row">{candidate.name} <span className="candidate-number">{candidate.number}</span><span className="source-note cell-count">{candidate.party}</span></th><td>{number(candidate.votes)}</td><td>{rate(candidate.percentValid)}</td></tr>)}</tbody>
          </table>
          <dl className="municipality-vote-totals">{([
            ['Brancos', item.totals.blank], ['Nulos', item.totals.null], ['Total de votos no cargo', item.totals.totalVotes],
            ...(item.totals.technicalNull === undefined ? [] : [['Nulos técnicos (contidos nos nulos)', item.totals.technicalNull]]),
            ...(item.totals.annulled === undefined ? [] : [['Anulados', item.totals.annulled]]),
            ...(item.totals.annulledSubJudice === undefined ? [] : [['Anulados sub judice', item.totals.annulledSubJudice]]),
          ] as Array<[string, number | null]>).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number(value)}{['Brancos', 'Nulos', 'Anulados', 'Anulados sub judice'].includes(label) && <span className="source-note cell-count">{rate(value === null ? null : percent(value, item.totals.totalVotes))} do total de votos</span>}</dd></div>)}</dl>
          <NonValidVotesTable items={item.nonValidVotes} context={`${item.name} / ${item.uf}`} />
          {item.totals.nonInstalledEligible != null && item.totals.nonInstalledEligible > 0 && <p className="notice">A fonte registra {number(item.totals.nonInstalledEligible)} eleitores em {number(item.nonInstalledSections ?? null)} seção(ões) não instalada(s). Permanecem separados da abstenção: aptos = comparecimento + abstenção + eleitores de seções não instaladas. A fonte não informa aqui o motivo. Não some os mesmos eleitores entre os turnos.</p>}
          <p className="query-note">{number(item.zones)} zona(s). Abstenção ÷ aptos; brancos e nulos usam o total de votos no cargo: {number(item.totals.totalVotes)}.</p>
          <Link prefetch={false} href={href(item.code, item.uf)}>Contexto e locais de votação de {item.name} ↗</Link>
        </details></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
