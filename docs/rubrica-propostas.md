# Rubrica das propostas de governo: acessibilidade e mobilidade urbana

Livro de códigos da versão `rubrica-acessibilidade-mobilidade-v1` (fase D3 do [plano de melhorias](plano-postgis-propostas.md)). Proposto em 20/10/2026 para aprovação de Rafael: nenhum documento foi codificado e nada foi publicado. Critérios, valores e termos estão no código em `apps/importer/src/rubric-core.ts`; mudar qualquer um deles exige nova versão.

## 1. Finalidade e limites

A rubrica registra, com página e trecho, o que cada plano de governo da Presidência de 2022 **declara** sobre acessibilidade e mobilidade urbana: diagnóstico, medidas, público, território, metas, prazos, responsáveis, custos, fontes de recursos e acompanhamento.

- São atributos do documento. Não avaliam mérito, viabilidade, coerência nem efeito das propostas.
- Não há nota, peso, soma de critérios, índice ou ordenação. Um plano com mais atributos declarados não é melhor que outro, e nenhuma comparação entre candidaturas é calculada.
- "Não localizado" quer dizer não encontrado no texto revisado pelo protocolo. Não significa que a candidatura não proponha: o tema pode estar escrito de outra forma, em outro documento ou numa página com OCR falho.
- Os 12 documentos registrados no TSE são codificados com o mesmo procedimento:
  - o nº 14 tem um documento para duas candidaturas, codificado uma vez;
  - o nº 90, inapto e sem votos, entra na codificação e é listado à parte, como em `/propostas`.
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

**Menção em lista conta.** Por exemplo, "ampliar o acesso a saneamento, transporte e moradia" conta como trecho do tema, desde que o termo se refira ao deslocamento de pessoas ou à acessibilidade; nesse caso, a medida é genérica. Em caso de dúvida, registre-a na observação, sem decidir pela outra pessoa.

## 3. Critérios e valores

A unidade é o documento: um valor vale se aparece em **qualquer** trecho do tema, e a evidência é o trecho que o mostra. Se o tema não foi localizado, todos os demais critérios recebem `nao-se-aplica`. Se foi localizado, nenhum recebe.

| Critério | Pergunta | Valores |
| --- | --- | --- |
| `tema` | O documento trata de acessibilidade ou de mobilidade urbana? | `trata`, `nao-localizado` |
| `diagnostico` | Descreve um problema ou a situação do tema? | `com-dado` (cita número, estatística ou fonte), `sem-dado`, `nao-localizado`, `nao-se-aplica` |
| `intervencao` | Propõe medida sobre o tema? | `especifica` (diz o que será feito: programa, obra, norma, serviço, compra, mudança de regra), `generica` (só intenção, como "melhorar a mobilidade"), `nao-localizado`, `nao-se-aplica` |
| `publico` | Declara o público da medida? | `declarado` (ex.: pessoas com deficiência, estudantes, trabalhadores), `nao-localizado`, `nao-se-aplica` |
| `territorio` | Declara o território da medida? | `declarado` (ex.: regiões metropolitanas, capitais, uma região; "o país" não conta), `nao-localizado`, `nao-se-aplica` |
| `meta-quantidade` | Declara meta em quantidade? | `declarada` (valor e unidade: "500 ônibus", "30% da frota"), `nao-localizado`, `nao-se-aplica` |
| `meta-prazo` | Declara prazo? | `declarado` ("até 2026", "no primeiro ano"), `nao-localizado`, `nao-se-aplica` |
| `responsabilidade` | Menciona órgão, ente federativo, programa ou norma responsável? | `mencionada`, `nao-localizado`, `nao-se-aplica` |
| `custo` | Declara custo? | `declarado` (valor em dinheiro), `nao-localizado`, `nao-se-aplica` |
| `fonte-recursos` | Declara a fonte dos recursos? | `declarada` (orçamento, fundo, financiamento, parceria), `nao-localizado`, `nao-se-aplica` |
| `acompanhamento` | Declara indicador de acompanhamento ou critério de entrega? | `declarado`, `nao-localizado`, `nao-se-aplica` |

**Regras de decisão:**
- **Valor mais completo:** havendo mais de um trecho, vale o mais completo (`com-dado` sobre `sem-dado`; `especifica` sobre `generica`).
- **Negações:** compromisso de manter, não fazer ou revogar algo também é medida — específica se diz o quê. Registre a negação na observação.
- **Sem inferência:** não se completa o que o texto não diz (custo, prazo, órgão), nem com conhecimento externo.
- **Leitura completa:** registre na observação o que ajudar a outra pessoa a entender a leitura (seção, contexto), sem pedir acordo.

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

Os trechos candidatos são ponto de partida, não codificação. Antes de registrar `tema` como `nao-localizado`, cada pessoa revisa:
1. todos os trechos candidatos do documento;
2. o sumário ou os títulos das seções;
3. as seções sobre cidades, transporte, infraestrutura, pessoas com deficiência ou direitos.

Trechos achados na leitura valem como os da busca. No pacote gerado em 20/10/2026, os nº 14 e nº 27 não têm nenhum trecho candidato; neles, a decisão depende dessa leitura.

## 6. Procedimento

1. **Pacote** (`npm run rubric:packet`): o mesmo material para as duas pessoas, em `data/rubric/<versão>/pacote-<data>/`:
   - PDFs conferidos pelo SHA-256 e texto publicado por página;
   - `trechos-candidatos.csv` e `codificacao-modelo.csv` (132 linhas: 12 documentos × 11 critérios);
   - `manifest.json`, com a versão da rubrica, os termos e a publicação do texto, e `LEIA-ME.txt`.
2. **Codificação independente:** cada pessoa copia o modelo, preenche todas as linhas e salva como CSV UTF-8 com ";". As duas não conversam sobre a codificação nem veem a planilha da outra até terminarem.
3. **Validação e concordância** (`npm run rubric:agreement -- --pacote=<dir> --a=<planilha> --autoria-a=<pessoa|modelo:id> --b=<planilha> --autoria-b=<pessoa|modelo:id>`):
   - a autoria de cada planilha é declarada e gravada em `concordancia.json` (`pessoa`, sem nome, ou `modelo:<identificador>`); as duas como modelo são recusadas. As planilhas preenchidas ficam fora do diretório do pacote;
   - as duas planilhas são conferidas: linhas completas, valores permitidos, coerência com o tema, páginas e trechos;
   - com elas válidas, gera `concordancia.json` e `adjudicacao-modelo.csv`, só com as divergências e o que cada pessoa registrou;
   - grava o SHA-256 de cada planilha.
4. **Adjudicação:** cada divergência recebe valor final, páginas, trecho e justificativa, pela forma de revisão que Rafael definir. Com `--adjudicacao=<planilha>`, o programa consolida a `codificacao-final.csv`, com a origem de cada valor (`concordancia` ou `adjudicacao`). A decisão passa pela mesma validação; divergência sem decisão e justificativa bloqueia.
5. **Publicação:** a decidir (seção 9). As planilhas originais das duas pessoas e a adjudicação ficam preservadas, para que a publicação mostre a origem de cada valor.

## 7. Concordância

Por critério: itens, concordâncias, proporção observada e kappa de Cohen; também no conjunto, com as categorias separadas por critério.
- O kappa fica nulo quando a concordância esperada é total, isto é, quando as duas pessoas usaram uma só categoria, a mesma, em todos os documentos. Nesse caso, publica-se a proporção.
- Com 12 documentos por critério, o kappa é instável: as contagens são publicadas junto.
- Divergência no tema se propaga para os demais critérios do documento; a adjudicação começa pelo tema.

## 8. Versionamento

- Mudar a definição do tema, os critérios, os valores ou os termos cria uma nova versão, com novo pacote. Codificações de versões diferentes não se misturam.
- O pacote registra a versão e a publicação do texto. Uma nova publicação das propostas exige um novo pacote.

## 9. Decisões pendentes de Rafael

1. Quem codifica (duas pessoas independentes) e como as divergências são adjudicadas.
2. Aprovação desta versão: definição do tema, critérios, regras e termos.
3. Concordância mínima para publicar cada critério: um limite, ou publicar sempre com os números e rever na versão seguinte o critério de concordância baixa.
4. Publicação e canal de contestação, que podem ser e-mail do projeto, formulário ou issue no repositório. A codificação final sempre vai com as planilhas, a concordância e a versão.
