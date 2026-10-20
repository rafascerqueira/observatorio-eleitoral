import type { ProposalsResponse } from '@observatorio/contracts';

const number = (value: number) => value.toLocaleString('pt-BR');
export type Candidacy = Extract<ProposalsResponse, { status: 'published' }>['candidacies'][number];

/** Como o texto de um documento foi obtido, página a página. */
function coverage(document: NonNullable<Candidacy['document']>) {
  const parts = [`${number(document.nativePages)} com o texto do próprio PDF`, document.ocrPages ? `${number(document.ocrPages)} por OCR` : null, document.emptyPages ? `${number(document.emptyPages)} sem texto` : null].filter(Boolean);
  return `${number(document.pages)} páginas: ${parts.join(', ')}.`;
}

/** Uma candidatura: cobertura do documento e, com busca, páginas e trechos (texto do PDF tratado como texto, nunca como marcação). */
export function CandidacyEntry({ item, query }: { item: Candidacy; query: string | null }) {
  const title = `${item.number} · ${item.ballotName} (${item.party})`;
  return <article className="proposal-entry" aria-labelledby={`candidatura-${item.number}-${item.listing}`}>
    <h3 id={`candidatura-${item.number}-${item.listing}`}>{title}</h3>
    {item.document ? <p className="source-note">{coverage(item.document)}</p> : <p className="source-note">Sem documento no arquivo do TSE.</p>}
    {item.sameDocumentAs.map((other) => <p key={other.ballotName} className="source-note">O mesmo arquivo foi registrado também pela candidatura {other.number} · {other.ballotName} (situação no cadastro: {other.situation.toLowerCase()}); ele aparece uma vez, aqui.</p>)}
    {query && item.matches && (item.matches.pages.length === 0
      ? <p>Nenhuma ocorrência literal de “{query}” no texto extraído. Isso não indica que a proposta não trate do tema: ele pode estar escrito de outra forma{item.document?.ocrPages ? ', e o OCR pode ter errado palavras' : ''}.</p>
      : <>
        <p>Ocorrência literal {item.matches.pages.length === 1 ? 'na página' : 'nas páginas'} {item.matches.pages.join(', ')}.{item.matches.pages.length > item.matches.excerpts.length ? ` Trechos das ${item.matches.excerpts.length} primeiras:` : ''}</p>
        <ul className="proposal-excerpts">{item.matches.excerpts.map((excerpt) => <li key={excerpt.page}><span className="source-note">p. {excerpt.page}{excerpt.method === 'ocr' ? ' (OCR)' : ''}</span> …{excerpt.before}<mark>{excerpt.match}</mark>{excerpt.after}…</li>)}</ul>
      </>)}
  </article>;
}
