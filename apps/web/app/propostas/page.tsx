import Link from 'next/link';
import { hasControlCharacters } from '@observatorio/contracts';
import { getProposals } from '../../lib/results';
import { QueryForm } from '../../components/query-form';
import { CandidacyEntry } from '../../components/proposal-entry';

export const dynamic = 'force-dynamic';
/**
 * Busca literal nas propostas de governo da Presidência (fase D2). Todas as candidaturas aparecem sempre, pela ordem do número;
 * nada é ordenado, pontuado ou resumido pelo conteúdo. Ausência de ocorrência não é ausência de proposta.
 */
export default async function Proposals({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const raw = typeof query.q === 'string' ? query.q : '';
  const result = await getProposals(raw.trim() || undefined);
  const data = result.kind === 'ready' && result.data.status === 'published' ? result.data : null;
  const listed = data?.candidacies.filter((item) => item.listing === 'candidate') ?? [];
  const withoutVotes = data?.candidacies.filter((item) => item.listing === 'no-votes') ?? [];
  return <>
    <section className="hero places-hero"><p className="eyebrow">PROPOSTAS DE GOVERNO · PRESIDÊNCIA 2022</p><h1>Busca nas propostas de governo</h1>
      <p className="hero-description">Procure uma palavra ou expressão nos documentos que as candidaturas à Presidência registraram no TSE em 2022. A busca é literal: mostra onde o texto aparece, sem interpretar, pontuar ou comparar propostas.</p></section>
    <section className="explorer" aria-labelledby="busca">
      <div className="section-heading"><div><p className="eyebrow">BUSCA LITERAL</p><h2 id="busca">Palavra ou expressão</h2></div><Link className="text-link" href="/metodologia#propostas">Como ler <span aria-hidden="true">↗</span></Link></div>
      <QueryForm key={raw} action="/propostas#busca" className="proposal-query" label="Busca nas propostas de governo" hintId="busca-ajuda" submitLabel="Buscar" resultsId="propostas-resultados" hasErrors={result.kind === 'invalid'}>
        <div className="field"><label htmlFor="q">Palavra ou expressão</label><input id="q" type="search" name="q" maxLength={80} defaultValue={raw} placeholder="Ex.: acessibilidade" aria-describedby="busca-ajuda" aria-invalid={result.kind === 'invalid' || undefined} /></div>
      </QueryForm>
      <p id="busca-ajuda" className="query-note">De 3 a 80 caracteres. Maiúsculas e acentos não importam; a expressão precisa aparecer exatamente nessa sequência.</p>
      <div id="propostas-resultados" className="query-results">
        {result.kind === 'invalid' ? <p className="notice" role="alert" id="query-errors" tabIndex={-1}>{hasControlCharacters(raw) ? 'A busca não aceita caracteres de controle. Digite a palavra ou expressão no campo acima.' : 'A busca precisa ter de 3 a 80 caracteres, sem contar acentos e espaços repetidos.'}</p>
          : result.kind === 'unavailable' ? <p className="notice" role="status">Não foi possível consultar ou validar as propostas. Isso é uma indisponibilidade técnica, não ausência de documentos. Tente novamente.</p>
          : !data ? <p className="notice" role="status">Propostas de governo ainda sem publicação.</p>
          : <>
            <p className="query-note">{data.query ? <>Resultados para “{data.query}”, em todas as candidaturas, pela ordem do número.</> : 'Candidaturas pela ordem do número, com a cobertura do texto de cada documento.'} O texto vem do próprio PDF; nas páginas em imagem, de OCR ({data.method.tesseract}), que pode errar letras e palavras.</p>
            {listed.map((item) => <CandidacyEntry key={`${item.number}-${item.listing}`} item={item} query={data.query} />)}
            {withoutVotes.length > 0 && <><h3 className="proposal-group">Candidaturas sem votos</h3><p className="query-note">Registraram documento, mas a candidatura foi considerada inapta e não recebeu votos.</p>
              {withoutVotes.map((item) => <CandidacyEntry key={`${item.number}-${item.listing}`} item={item} query={data.query} />)}</>}
            <p className="source-note">Fonte: Tribunal Superior Eleitoral, Portal de Dados Abertos, licença Creative Commons Atribuição. <a href={`/arquivos/sources/${data.source.sha256}/${data.source.file}`}>Baixar o arquivo original preservado ({data.source.file})</a> · <Link href="/fontes#propostas">Fontes</Link>. Publicação {data.batchId.slice(0, 12)}….</p>
          </>}
      </div>
    </section>
  </>;
}
