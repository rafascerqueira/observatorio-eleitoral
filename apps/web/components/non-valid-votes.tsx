import { NON_VALID_LABELS, type MunicipalityResult } from '@observatorio/contracts';

type NonValidVotes = NonNullable<MunicipalityResult['nonValidVotes']>;
const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

/** Votos em candidaturas que o TSE não computa como válidos: sem percentual sobre válidos. */
export function NonValidVotesTable({ items, context }: { items: NonValidVotes | undefined; context: string }) {
  const listed = (items ?? []).filter((item) => item.votes > 0);
  if (!listed.length) return null;
  return <div className="table-scroll non-valid-votes" role="region" aria-label={`Votos não computados como válidos — ${context}`} tabIndex={0}>
    <table>
      <caption>Votos não computados como válidos — {context}. Classificação do TSE; fora do denominador dos votos válidos.</caption>
      <thead><tr><th scope="col">Votável</th><th scope="col">Partido</th><th scope="col">Classificação TSE</th><th scope="col">Votos</th></tr></thead>
      <tbody>{listed.map((item) => <tr key={`${item.category}/${item.number}`}>
        <th scope="row">{item.name} <span className="candidate-number">{item.number}</span>{item.nameSource === 'section' && <span className="source-note"> (nome no arquivo de seções)</span>}</th>
        <td>{item.party ?? 'Não informado na fonte'}</td>
        <td>{NON_VALID_LABELS[item.category]}{item.detail ? ` — registro: ${item.detail.toLowerCase()}` : ''}</td>
        <td>{number(item.votes)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
