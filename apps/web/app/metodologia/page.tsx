import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Metodologia' };

export default function Methodology() {
  return <article className="prose">
    <p className="eyebrow">COMO LER</p><h1>Critérios claros.<br />Perguntas abertas.</h1>
    <p className="lead">Este observatório propõe explorar eleições e territórios sem conclusões editoriais automáticas. As escolhas metodológicas são explícitas e poderão ser revisadas.</p>
    <h2>Votos e participação</h2>
    <p>Nas eleições para Presidência e Governador, o percentual de uma candidatura é calculado sobre os votos válidos do mesmo recorte: votos da candidatura ÷ votos válidos × 100. Brancos e nulos não integram esse denominador.</p>
    <p>A taxa de abstenção usa eleitores aptos como denominador. As taxas de brancos e nulos usarão o total de votos apurados para o cargo no recorte, com a definição confirmada no dicionário do TSE. Totais de participação não serão somados repetidamente entre candidaturas ou cargos.</p>
    <p>Denominador zero gera percentual indisponível. Valores ausentes não se tornam zeros. Totais regionais usam a soma dos votos e dos denominadores correspondentes, evitando médias simples de percentuais municipais.</p>
    <p>Na consulta inicial, “Todo o Brasil” apresenta um único quadro presidencial por turno, somando todos os municípios reconciliados das 27 UFs, sem paginação. Quando a publicação do exterior (ZZ) está reconciliada e usa os mesmos originais, suas localidades também integram o consolidado; as duas versões são identificadas. Percentuais são recalculados sobre os totais, nunca por média municipal. Selecionar uma UF mostra o resultado da UF, somado a partir dos seus municípios reconciliados, e a lista de municípios; pesquisar um município abre a consulta municipal; Exterior — ZZ abre a consulta própria do exterior.</p>
    <p>O maior percentual não implica maioria absoluta. Diferenças entre candidaturas serão expressas em pontos percentuais, identificando o par comparado. Turnos permanecem separados.</p>
    <h2>Municípios e locais de votação</h2>
    <p>Municípios são o ponto inicial de associação entre TSE e IBGE. Seus códigos precisam de correspondência validada; nomes iguais não são suficientes.</p>
    <p>Seção é um agrupamento eleitoral, local é o prédio onde ocorre a votação e zona é uma unidade administrativa. Nenhum deles equivale automaticamente a bairro ou setor censitário.</p>
    <p>O endereço do local informa onde o eleitor vota, não onde mora. Uma futura associação com setores censitários descreverá o contexto do entorno, sem atribuir a renda desse entorno aos eleitores. O método geográfico ainda não foi definido.</p>
    <h2>Renda com definição e referência</h2>
    <p>Rendimento do responsável, renda domiciliar total e renda domiciliar per capita são medidas diferentes. Cada indicador usará o nome e a escala confirmados pela fonte.</p>
    <p>Faixas de renda só serão apresentadas onde houver distribuição confirmada nos arquivos. Médias e medianas não permitem fabricar proporções por faixa. A expressão em salários mínimos exige valor, vigência e período de referência explícitos.</p>
    <h2>Limites de interpretação</h2>
    <p>Associação territorial não demonstra causa, motivação individual, ideologia ou transferência individual de votos entre eleições. Abstenção, brancos e nulos não identificam pessoas como apolíticas.</p>
    <p>Não classificamos automaticamente lugares ou pessoas por ideologia ou condição socioeconômica. Escolhas de apresentação também podem influenciar a leitura; por isso, fontes, fórmulas e critérios estarão disponíveis para consulta.</p>
    <h2>Antes de publicar</h2>
    <p>Cada importação deverá verificar duplicatas, campos ausentes, cardinalidade das junções, denominadores e reconciliação com totais oficiais. Comparações temporais exigem auditoria das mudanças de seções e locais.</p>
    <h2>Recorte piloto de São Paulo</h2>
    <p>O piloto usa o código municipal TSE 71072 e o cargo 1 (Presidente) nas eleições 544 e 545 de 2022. Os registros por seção são preservados e agregados por zona e código de local, sem presumir que códigos iguais de zonas distintas sejam o mesmo prédio.</p>
    <p>Votos nominais válidos são conferidos por candidatura e zona. Brancos (votável 95) e nulos (96) são reconciliados com a apuração municipal por zona. Quantidades de aptos, comparecimento e abstenção vêm desse arquivo de apuração, uma única vez por zona, e não da repetição de linhas de candidaturas.</p>
    <p>Nos locais, esses indicadores de participação permanecem indisponíveis porque a fonte de votos por seção não fornece seus denominadores. Endereços vêm do TSE e ainda não foram geocodificados nem relacionados ao IBGE.</p>
    <h2>Expansão nacional da Presidência de 2022</h2>
    <p>A importação nacional usa as entradas BR de apuração, candidaturas e votos por seção. Os registros são particionados por UF e código TSE de município; cada município precisa passar nas mesmas verificações dos dois turnos antes da publicação nacional. A versão anterior fica disponível durante o processamento.</p>
    <p>As chaves das tabelas nacionais incluem eleição, ano, turno, cargo, UF, município, zona e seção, conforme a unidade. Cada município concluído tem checkpoint transacional. Se um recorte falha, o motivo aparece na cobertura e impede a troca da publicação nacional.</p>
    <p>Códigos municipais numéricos do TSE são apresentados com cinco dígitos: por exemplo, 2550 e 02550 representam a mesma identidade eleitoral dentro da mesma UF. Essa normalização não usa nomes, não altera os códigos nos originais e não cria correspondência com códigos IBGE. Duplicatas após a normalização continuam bloqueando a publicação.</p>
    <p>ZZ representa o exterior, não uma UF brasileira. A publicação própria do exterior valida suas localidades nos dois turnos, incluindo unidades sem seções instaladas: zero votos exige confirmação da apuração e do nominal, sem inventar linhas de seção. País não é zona eleitoral: em 2022, os registros usam a zona 1. As localidades recebem seus códigos TSE, sem correspondência IBGE ou agrupamento por país inferido dos nomes. Trânsito não é inferido da localização: a marcação da fonte é verificada.</p>
    <p>Na cobertura doméstica, eleitores de seções não instaladas permanecem em categoria própria. Conferimos aptos = comparecimento + abstenção + eleitores de seções não instaladas, sem alterar nenhuma dessas quantidades da fonte. As seções principais oficiais são conferidas como seções com registros de votação + seções não instaladas. A abstenção continua usando seu valor oficial e os aptos como denominador; não absorve a categoria separada.</p>
    <h2>Governador de 2022</h2>
    <p>Governador é um cargo estadual: cada UF tem suas candidaturas. Por isso, a consulta exige uma UF, não há consolidado Brasil e os resultados de UFs diferentes não são somados nem comparados como se fossem a mesma disputa. Eleitores no exterior não votam para esse cargo.</p>
    <p>A importação usa o cargo 3 (Governador) nas eleições 546 (1º turno) e 547 (2º turno) de 2022, a partir das entradas da UF nos arquivos de apuração e votação nominal e do arquivo de votos por seção da UF. Esse arquivo também traz senador e deputados; somente o cargo 3 é selecionado, e qualquer linha de outra UF ou de eleição não auditada bloqueia a importação em vez de ser descartada.</p>
    <p>Cada município passa pelas mesmas verificações da Presidência, turno a turno: candidaturas, brancos (95) e nulos (96) conferidos por zona; aptos = comparecimento + abstenção + eleitores de seções não instaladas; seções principais conferidas. Antes da publicação, os votos gravados no banco são somados novamente por turno e votável e comparados aos agregados. A publicação da UF só ocorre com todos os seus municípios reconciliados. O resultado da UF é a soma dos municípios; percentuais são recalculados sobre essa soma.</p>
    <p>Os turnos realizados são lidos da apuração da UF. Uma UF sem 2º turno ainda não é publicada: a consulta precisa distinguir “turno não realizado” de “dado não importado”, e essa distinção ainda não foi implementada. Os aptos informados pela fonte podem variar entre os turnos; cada turno usa os próprios valores, sem somar eleitores entre turnos.</p>
  </article>;
}
