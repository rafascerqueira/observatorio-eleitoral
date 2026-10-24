# Rubrica das propostas de governo: acessibilidade e mobilidade urbana

Livro de códigos da versão `rubrica-acessibilidade-mobilidade-v1` (fase D3 do [plano de melhorias](plano-postgis-propostas.md)). Proposto em 20/10/2026 e ajustado em 24/10/2026 (autoria, leitura integral, limitação e território genérico da seção 3, exemplos, contestação da seção 6, critério de publicação da seção 7 e aprovação da seção 8). Aguarda a aprovação da comunidade de contribuidores (seção 8): nenhum documento foi codificado e nada foi publicado. Critérios, valores e termos estão no código em `apps/importer/src/rubric-core.ts`; mudar qualquer um deles exige nova versão.

## 1. Finalidade e limites

A rubrica registra, com página e trecho, o que cada plano de governo da Presidência de 2022 **declara** sobre acessibilidade e mobilidade urbana: diagnóstico, medidas, público, território, metas, prazos, responsáveis, custos, fontes de recursos e acompanhamento.

- São atributos do documento. Não avaliam mérito, viabilidade, coerência nem efeito das propostas.
- Não há nota, peso, soma de critérios, índice ou ordenação. Um plano com mais atributos declarados não é melhor que outro, e nenhuma comparação entre candidaturas é calculada.
- "Não localizado" quer dizer não encontrado no texto revisado pelo protocolo. Não significa que a candidatura não proponha: o tema pode estar escrito de outra forma, em outro documento ou numa página com OCR falho.
- Os 12 documentos registrados no TSE são codificados com o mesmo procedimento:
  - o nº 14 tem um documento para duas candidaturas, codificado uma vez;
  - o nº 90, inapto e sem votos, entra na codificação e é listado à parte, como em `/propostas`.
- **Quem codifica e quem adjudica (decisões de Rafael, 24/10/2026):** duas codificações independentes. Primeiro, a de uma pessoa entre os contribuidores do projeto, feita em público; depois, a de um modelo de linguagem, numa execução isolada que não vê a da pessoa (seção 6). Assim todo o trabalho humano é visível desde o início, e a independência que precisa ser garantida, a do modelo, é controlada e declarada. A adjudicação das divergências é humana, por contribuidores do projeto (regra da seção 6 para quem adjudica tendo codificado). A autoria de cada codificação e a forma de isolamento do modelo são declaradas na concordância e informadas na publicação.
- O texto é o da publicação `proposals-2022-v2` (`e2c6e07e…`), e os PDFs do pacote são conferidos pelo SHA-256 publicado.

## 2. Tema

**Acessibilidade:** condições para pessoas com deficiência ou com mobilidade reduzida usarem o espaço urbano, as edificações de uso público e os transportes. Exemplos: rampas, calçadas e transporte adaptados, desenho universal e normas como a Lei Brasileira de Inclusão aplicadas a esses espaços.

**Mobilidade urbana:** deslocamento de pessoas nas cidades e regiões metropolitanas. Inclui:
- transporte público coletivo (ônibus, trens urbanos, metrô, VLT, BRT);
- tarifa e gratuidade;
- deslocamento a pé e de bicicleta;
- trânsito e segurança viária urbana;
- infraestrutura das vias urbanas (calçadas, pavimentação e iluminação).

**Fora do tema nesta versão:**
- transporte de cargas e logística; rodovias, ferrovias e hidrovias de longa distância; portos e aeroportos — salvo quando o trecho tratar do deslocamento urbano de pessoas;
- "acessibilidade" no sentido de acesso a serviços ou de preço acessível;
- acessibilidade na comunicação, digital ou educacional (Libras, inclusão escolar), que pode ser tema de outra versão.

**Menção em lista conta.** Por exemplo, "ampliar o acesso a saneamento, transporte e moradia" conta como trecho do tema, desde que o termo se refira ao deslocamento de pessoas ou à acessibilidade; nesse caso, a medida é genérica. Em caso de dúvida, registre-a na observação, sem tentar adivinhar o que a outra codificação fará.

## 3. Critérios e valores

A unidade é o documento: um valor vale se aparece em **qualquer** trecho do tema, e a evidência é o trecho que o mostra. Se o tema não foi localizado, todos os demais critérios recebem `nao-se-aplica`. Se foi localizado, nenhum recebe.

**Limitação declarada (decisão de Rafael, 24/10/2026):** os critérios descrevem o documento, não cada medida. Público, território, metas, prazo, responsável, custo, fonte e acompanhamento podem vir de trechos e de medidas diferentes. Um documento com `meta-quantidade` e `meta-prazo` declarados não tem, necessariamente, uma medida com meta e prazo. A publicação mostra o trecho de cada valor e repete esta limitação junto dos resultados.

| Critério | Pergunta | Valores |
| --- | --- | --- |
| `tema` | O documento trata de acessibilidade ou de mobilidade urbana? | `trata`, `nao-localizado` |
| `diagnostico` | Descreve um problema ou a situação do tema? | `com-dado` (cita número, estatística ou fonte), `sem-dado`, `nao-localizado`, `nao-se-aplica` |
| `intervencao` | Propõe medida sobre o tema? | `especifica` (diz o que será feito: programa, obra, norma, serviço, compra, mudança de regra), `generica` (só intenção, como "melhorar a mobilidade"), `nao-localizado`, `nao-se-aplica` |
| `publico` | Declara o público da medida? | `declarado` (ex.: pessoas com deficiência, estudantes, trabalhadores), `nao-localizado`, `nao-se-aplica` |
| `territorio` | Declara o território da medida? | `declarado` (qualquer recorte menor que o país, mesmo genérico: "nas cidades", "nos municípios", áreas urbanas, periferias, regiões metropolitanas, capitais, uma região; "o país", "o Brasil" e "todo o território nacional" não contam), `nao-localizado`, `nao-se-aplica` |
| `meta-quantidade` | Declara meta em quantidade? | `declarada` (valor e unidade: "500 ônibus", "30% da frota"), `nao-localizado`, `nao-se-aplica` |
| `meta-prazo` | Declara prazo? | `declarado` ("até 2026", "no primeiro ano"), `nao-localizado`, `nao-se-aplica` |
| `responsabilidade` | Menciona órgão, ente federativo, programa ou norma responsável? | `mencionada`, `nao-localizado`, `nao-se-aplica` |
| `custo` | Declara custo? | `declarado` (valor em dinheiro), `nao-localizado`, `nao-se-aplica` |
| `fonte-recursos` | Declara a fonte dos recursos? | `declarada` (orçamento, fundo, financiamento, parceria), `nao-localizado`, `nao-se-aplica` |
| `acompanhamento` | Declara indicador de acompanhamento ou critério de entrega? | `declarado`, `nao-localizado`, `nao-se-aplica` |

**Regras de decisão:**
- **Valor mais completo:** havendo mais de um trecho, vale o mais completo (`com-dado` sobre `sem-dado`; `especifica` sobre `generica`).
- **Negações:** compromisso de manter, não fazer ou revogar algo também é medida — específica se diz o quê. Registre a negação na observação.
- **Território genérico (decisão de Rafael, 24/10/2026):** recorte genérico como "nas cidades" conta como `declarado` quando o trecho o liga à medida. "O país" não conta porque é o alcance de todo plano da Presidência; "nas cidades" já é um recorte dele. Como a seção 2 define mobilidade urbana pelo deslocamento nas cidades, este critério tende a ficar `declarado` na maioria dos documentos que tratam do tema, e a publicação diz isso junto dos resultados.
- **Sem inferência:** não se completa o que o texto não diz (custo, prazo, órgão), nem com conhecimento externo.
- **Observação útil:** registre na observação o que ajudar a adjudicação a entender a leitura (seção, contexto), sem pedir acordo.

**Exemplos.** As frases abaixo foram inventadas para ilustrar as regras; nenhuma vem dos planos de 2022.

| Frase fictícia | Valores |
| --- | --- |
| "A mobilidade urbana precisa melhorar." | `diagnostico` `sem-dado`; nenhuma medida |
| "Metade das calçadas das capitais não tem rampa, segundo o órgão X." | `diagnostico` `com-dado` |
| "Vamos melhorar o transporte público." | `intervencao` `generica` |
| "Vamos melhorar o transporte público nas cidades." | `intervencao` `generica`; `territorio` `declarado` (recorte genérico) |
| "O Ministério X criará o programa Ônibus Acessível, de compra de ônibus adaptados para as regiões metropolitanas." | `intervencao` `especifica`; `responsabilidade` `mencionada` (ministério e programa nomeados); `territorio` `declarado` (regiões metropolitanas); a frase não declara público ("adaptados" descreve o veículo) |
| "…com 2.000 ônibus até 2025, financiados por um fundo nacional de mobilidade." | `meta-quantidade` `declarada`; `meta-prazo` `declarado`; `fonte-recursos` `declarada`; `custo` não declarado |
| "…ao custo de R$ 3 bilhões, com um painel público do número de ônibus entregues por ano." | `custo` `declarado`; `acompanhamento` `declarado` |
| "Vamos manter a gratuidade para pessoas idosas no transporte coletivo." | `intervencao` `especifica` (negação ou manutenção também é medida); `publico` `declarado` |
| "Investir em saúde, educação e transporte." | tema `trata` só se "transporte" se referir ao deslocamento de pessoas; `intervencao` `generica` |

## 4. Evidência

- Todo valor que afirma algo (todos, menos `nao-localizado` e `nao-se-aplica`) exige páginas e um trecho literal, copiado do texto publicado em `textos/` do pacote, sem resumir nem corrigir.
- O programa confere o trecho na página citada com a mesma normalização da busca: maiúsculas, acentos, ligaduras e hífen de fim de linha não importam. Trecho que não confere bloqueia o cálculo, com a linha apontada.
- Nas páginas por OCR, o trecho vem do texto do OCR, mesmo com erros. A leitura correta vai na observação.
- `paginas` aceita números separados por vírgula ("12, 15").

## 5. Trechos candidatos e leitura

O pacote traz os trechos que a busca literal encontra para a lista de termos abaixo, a mesma de `/propostas` e reproduzível lá. Os termos saem da definição do tema, não do número de ocorrências; ficam também os que não aparecem em nenhum plano.

**Acessibilidade:** acessibilidade, acessível, acessíveis, deficiência, deficientes, cadeirante, cadeira de rodas, piso tátil, rampa, desenho universal, lei brasileira de inclusão.

**Mobilidade:** mobilidade, transporte, trânsito, ônibus, trens, metroviário, metroviária, VLT, BRT, tarifa, passe livre, bilhete único, ciclovia, ciclofaixa, bicicleta, pedestre, calçada, segurança viária, iluminação pública, pavimentação, infraestrutura urbana, deslocamento, frota.

Ficam fora da lista os termos que a busca por trecho não separa de outras palavras, ou que são amplos demais (medido no corpus de 2022):

| Termo | Motivo |
| --- | --- |
| trem | casa com "extrema" e "extremamente"; o plural "trens" fica na lista |
| metrô | casa com "metros", "parâmetros", "metrópoles" e "quilômetros"; "metroviário" e "metroviária" ficam |
| PcD | casa com "PCdoB" |
| cidades | casa com "capacidades" e é amplo demais |
| urbana, urbano | amplos demais (população urbana, violência urbana) |

Os trechos candidatos são ponto de partida, não codificação. **Cada codificação lê os 12 documentos inteiros** (decisão de Rafael, 24/10/2026), e não só os trechos candidatos, o sumário ou as seções do tema, antes de registrar qualquer valor, e em especial `nao-localizado`. Assim todas as candidaturas passam pelo mesmo procedimento, e a extensão do plano não muda o que pode ser encontrado nele.

Trechos achados na leitura valem como os da busca. No pacote gerado em 20/10/2026, os nº 14 e nº 27 não têm nenhum trecho candidato; neles, a decisão depende dessa leitura.

## 6. Procedimento

1. **Pacote** (`npm run rubric:packet`): o mesmo material para as duas codificações, em `data/rubric/<versão>/pacote-<data>/`, publicado como `.zip` num release do repositório, com o SHA-256, para quem codifica sem o banco (decisão de Rafael, 24/10/2026). O pacote de 21/10/2026 está no release [`pacote-rubrica-v1-2026-10-21`](https://github.com/rafascerqueira/observatorio-eleitoral/releases/tag/pacote-rubrica-v1-2026-10-21), em `pacote-rubrica-acessibilidade-mobilidade-v1-2026-10-21.zip` (SHA-256 `e1bfd0e169b8e092d57c2d15a5afc75bf17ba7c630e759ebce625ec9cd52ffb0`). O diretório do pacote só tem material comum; as planilhas preenchidas e as notas de cada codificação ficam fora dele:
   - PDFs conferidos pelo SHA-256 e texto publicado por página;
   - `trechos-candidatos.csv` e `codificacao-modelo.csv` (132 linhas: 12 documentos × 11 critérios);
   - `manifest.json`, com a versão da rubrica, os termos e a publicação do texto, e `LEIA-ME.txt`.
2. **Codificação da pessoa, em público:** um contribuidor copia `codificacao-modelo.csv`, lê os documentos inteiros e preenche todas as linhas num pull request, em `codificacoes/<versão>/pessoa.csv` (CSV UTF-8 com ";"), visível durante todo o trabalho. Antes de enviar, confere a planilha com `npm run rubric:validate -- --pacote=<dir> --planilha=<planilha>`, que usa só o texto do pacote, sem o banco. No pull request, declara que leu os documentos inteiros. Rafael avalia o pull request.
3. **Codificação do modelo, depois e isolada** (decisões de Rafael, 24/10/2026): começa só depois do merge da planilha da pessoa.
   - **Entrada:** só o pacote e este livro, copiados para um diretório vazio, sem acesso ao repositório, à internet nem à planilha da pessoa.
   - **Registro:** as instruções dadas ao modelo são publicadas antes da execução, em `codificacoes/<versão>/modelo-instrucoes.md`; a saída é publicada sem edição, com o SHA-256.
   - **Correção:** trecho ou valor que a validação recusa volta ao modelo, na mesma execução, com as mensagens do programa, e a troca fica registrada. Ninguém corrige a planilha do modelo à mão.
   - **Modelo:** identificador exato, com conhecimento que vai até uma data anterior à publicação da planilha da pessoa, para que ela não esteja no treino.
   - **Isolamento:** `api` (programa que chama a API do fornecedor e grava a requisição e a resposta exatas) ou `sessao` (sessão de um assistente aberta só no diretório do pacote). As duas são aceitas e a `api` é opcional (decisão de Rafael, 24/10/2026); a `sessao` é menos verificável, porque o isolamento depende da configuração da sessão, e a publicação declara essa limitação.
   - **Leitura:** as instruções exigem a leitura integral dos documentos, como para a pessoa.
4. **Validação e concordância** (`npm run rubric:agreement -- --pacote=<dir> --a=<planilha da pessoa> --autoria-a=pessoa --b=<planilha do modelo> --autoria-b=modelo:<id> --isolamento-b=<api|sessao>`):
   - a autoria de cada planilha é declarada e gravada em `concordancia.json`: `pessoa`, sem nome, ou `modelo:<identificador>`, com o isolamento; o programa exige uma pessoa e um modelo;
   - as duas planilhas são conferidas: linhas completas, valores permitidos, coerência com o tema, páginas e trechos;
   - com elas válidas, gera `concordancia.json` e `adjudicacao-modelo.csv`, só com as divergências e o que cada codificação registrou;
   - grava o SHA-256 de cada planilha.
5. **Consistência do modelo:** o modelo codifica duas vezes, em execuções isoladas, sem ver a primeira. A primeira entra na concordância; a segunda só mede a consistência, com `npm run rubric:agreement -- --pacote=<dir> --a=<execução 1> --autoria-a=modelo:<id> --isolamento-a=<api|sessao> --b=<execução 2> --autoria-b=modelo:<id> --isolamento-b=<api|sessao> --consistencia`, que usa as mesmas estatísticas e não gera planilha de adjudicação. A consistência não muda nenhum valor: é publicada na página de método, e critério com consistência baixa orienta a revisão das regras.
6. **Adjudicação, em público:** cada divergência recebe valor final, páginas, trecho e justificativa, num pull request que Rafael avalia. Com `--adjudicacao=<planilha>`, o programa consolida a `codificacao-final.csv`, com a origem de cada valor (`concordancia` ou `adjudicacao`). A decisão passa pela mesma validação; divergência sem decisão e justificativa bloqueia. **Quem adjudica** (24/10/2026): de preferência uma pessoa que não fez nenhuma das codificações. Se quem adjudica fez uma delas, isso é declarado na publicação, e cada decisão cita as páginas, o trecho e a regra deste livro que a sustentam; preferir a própria leitura, sem essa base, não é justificativa. Modelo de linguagem nunca adjudica.
7. **Publicação:** a decidir (seção 9), só para os critérios que atingem o mínimo da seção 7. As planilhas originais das duas codificações e a adjudicação ficam preservadas, para que a publicação mostre a origem de cada valor.
8. **Contestação** (decisão de Rafael, 24/10/2026): pelo formulário de issue do repositório (`.github/ISSUE_TEMPLATE/contestacao.yml`), comum à rubrica e à bússola. Quem contesta indica versão, documento, critério, valor, páginas, trecho e a justificativa pela regra deste livro. A contestação e a resposta são públicas. Contribuidores do projeto respondem com decisão e justificativa, pela mesma regra de quem adjudica (passo 6), sem prazo fixo. A correção vem num pull request, que Rafael avalia. Contestação aceita não reescreve a publicação: a correção entra numa nova publicação, e a anterior continua disponível, com a indicação da mudança. Contestação que mostra uma regra ambígua orienta a próxima versão.

## 7. Concordância e critério de publicação

Fixados antes de qualquer codificação, em 24/10/2026, por decisão de Rafael. Não mudam depois de ver o resultado: mudar a estatística ou o mínimo cria uma nova versão.

- **Medidas por critério** (`reliability` em `concordancia.json`): itens, concordância observada, kappa de Cohen e **AC1 de Gwet**, com intervalo de 95% por reamostragem dos documentos (2.000 reamostras, semente fixa por critério, para o mesmo resultado a cada execução). O relatório traz também o kappa por critério e no conjunto, calculado sobre todas as linhas.
- **Por que o AC1:** com 12 documentos e muitos `nao-localizado`, o kappa pode ficar perto de zero mesmo com quase tudo concordando. Exemplo: 11 de 12 documentos `nao-localizado` nas duas codificações e um divergente dão 92% de concordância, kappa zero e AC1 de 0,91. O AC1 sofre menos com essa concentração; o número de categorias é o de valores do critério.
- **Critérios dependentes do tema:** os pares em que alguma codificação marcou `nao-se-aplica` ficam fora do cálculo. Esse valor decorre do tema, e a divergência no tema já aparece no critério `tema`. Critério sem nenhum par válido fica sem medida.
- **Publicação:** critério com AC1 de pelo menos **0,70** é publicado. Abaixo disso, ou sem medida, o critério não é publicado e volta para revisão das regras numa nova versão, com os números na página de método. Concordância observada, kappa, AC1, contagens e intervalo são publicados sempre, também para os critérios publicados. Com 12 documentos, o intervalo é largo: não serve de regra, mas mostra a incerteza.
- **Divergência no tema** se propaga para os demais critérios do documento; a adjudicação começa pelo tema.

## 8. Versionamento

- Mudar a definição do tema, os critérios, os valores ou os termos cria uma nova versão, com novo pacote. Codificações de versões diferentes não se misturam.
- O pacote registra a versão e a publicação do texto. Uma nova publicação das propostas exige um novo pacote.
- Os ajustes de 24/10/2026 (autoria, leitura integral, limitação e território genérico da seção 3, exemplos, contestação, critério de publicação da seção 7 e aprovação) entraram antes de qualquer codificação e não mudam tema, critérios, valores nem termos: a versão continua `v1`, e o pacote de 21/10 continua válido. Depois que a codificação começar, mudar a estatística ou o mínimo da seção 7 cria uma nova versão.
- **Aprovação** (decisão de Rafael, 24/10/2026): cada versão é aprovada pela comunidade de contribuidores, num pull request com o texto final deste livro. A versão está aprovada quando o pull request tem pelo menos uma aprovação de um contribuidor que não o abriu e, passados 7 dias corridos da abertura, nenhuma objeção sem resposta. Mudança nas regras durante a revisão reinicia o prazo. Rafael avalia cada pull request antes do merge. Este livro registra a data e o link da aprovação. A codificação só começa depois dela.

## 9. Decisões e pendências

1. ~~Codificação por modelo, quem codifica e quem adjudica~~: decididos em 24/10/2026. A primeira codificação é de uma pessoa entre os contribuidores, em público; a segunda, de um modelo isolado; a adjudicação é de contribuidores (seções 1 e 6).
2. Aprovação desta versão (tema, critérios, regras e termos): pela comunidade de contribuidores, pela regra da seção 8. O pull request ainda não foi aberto.
3. ~~Concordância mínima~~: decidida em 24/10/2026, com AC1 de Gwet de pelo menos 0,70 por critério, números publicados sempre e consistência do modelo (seções 6 e 7).
4. Publicação: página e forma ainda a decidir. ~~Canal de contestação~~: formulário de issue do repositório (seção 6, passo 8), decidido em 24/10/2026. A codificação final sempre vai com as planilhas, a concordância e a versão.
5. ~~Território genérico~~: decidido em 24/10/2026; "nas cidades" e outros recortes genéricos contam como `declarado` (seção 3).
