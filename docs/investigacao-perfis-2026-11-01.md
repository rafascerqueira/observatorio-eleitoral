# Investigação de partidos, cobertura e comparação em Perfis

Registro de **01/11/2026**, a pedido de Rafael. Investigação sobre as publicações locais vigentes, com consultas em transações `READ ONLY ISOLATION LEVEL REPEATABLE READ`, leitura dos originais preservados e reprodução na aplicação compilada existente. Nenhuma importação, correção de dados ou mudança de comportamento da aplicação nesta etapa.

**Atualização posterior, no mesmo dia:** Rafael aceitou a conferência dos partidos e da cobertura, solicitou a correção do filtro regional e esclareceu que mudanças de locais entre anos e turnos são esperadas. O filtro foi implementado; as seções 1–5 preservam o diagnóstico anterior à correção. A comparação continua usando os locais de cada recorte, sem exigir continuidade física nem fixar uma coorte nesta etapa. Detalhes da entrega em `plan.md`, §67.

## 1. Os partidos citados estão preenchidos

Não foi reproduzida a ausência de partido nos casos indicados:

| Partido no original, no banco e na API | Candidatura de 2022 | Candidatura de 2026 |
| --- | --- | --- |
| PT | Lula, 13 | Lula, 13 |
| PL | Jair Bolsonaro, 22 | Flávio Bolsonaro, 22 |
| UP | Léo Péricles, 80 | Samara, 80 |
| DC | Constituinte Eymael, 27 | Clariana Barão, 27 |

Conferência feita sem um dicionário manual de partidos:

1. Leitura integral das entradas `votacao_candidato_munzona_<ano>_BR.csv` dos dois ZIPs preservados: **81.679 linhas em 2022 e 88.088 em 2026**, incluindo os dois turnos e o exterior. Número, nome e `SG_PARTIDO` coincidem com as identidades dos resultados municipais; somando só as linhas domésticas, os votos também coincidem integralmente por candidatura e turno.
2. Verificação dos agregados presidenciais de Perfis nos nove indicadores, nos dois turnos, no Brasil e nas regiões derivadas das 27 UFs: **6.318 identidades de candidatura nos grupos**, todas com o mesmo nome e partido dos resultados conferidos com o original.
3. API e página `/perfis`, em 2022 e 2026, com `college`, `income-median`, `tract-situation` e `tract-favela`: as siglas estão presentes e visíveis tanto no **Chrome 151.0.7922.71** quanto no **Firefox 158.0.1**. Foram oito consultas por navegador; capturas das tabelas de escolaridade em 1280 e 375 px.

O fluxo usa diretamente `SG_PARTIDO` do nominal: [modelo eleitoral](../apps/importer/src/model.ts), [agregação dos grupos](../apps/importer/src/place-groups.ts) e [página Perfis](../apps/web/app/perfis/page.tsx). Não há um mapeamento de siglas por nome da candidatura nesse caminho. O importador rejeita partido ausente no nominal. A exceção declarada são os nulos técnicos identificados só no arquivo de seções, que não é o caso das candidaturas válidas citadas.

Os oito casos relatados correspondem às quatro siglas de duas letras. Isso é uma pista para investigar a leitura, extração ou apresentação específica em que ocorreu a ausência, mas **não identifica a causa**. Foi solicitada a página/navegador ou eventual exportação em que o problema apareceu. Não há base para substituir ou reimportar partidos que já estão corretos.

## 2. A diferença de cobertura é real e muda entre os anos

A página já mostra locais incluídos e percentual dos votos cobertos, mas no meio de um parágrafo extenso. O contrato já oferece `places`, `placesInGroups`, `totalVotes` e `votesInGroups`; a API devolve os agregados publicados. Os excluídos não são redistribuídos.

Cobertura da **Presidência, 1º turno, Brasil sem exterior**:

| Indicador | Locais incluídos em 2022 | Votos incluídos em 2022 | Locais incluídos em 2026 | Votos incluídos em 2026 |
| --- | ---: | ---: | ---: | ---: |
| Perfis do TSE: escolaridade, gênero e idade | 92.099 de 92.361 | 123.330.949 — **99,96%** | 94.233 de 94.539 | 124.878.015 — **99,96%** |
| Renda do setor | 80.667 de 92.361 | 112.011.515 — **90,79%** | 89.455 de 94.539 | 120.032.408 — **96,08%** |
| Situação urbana/rural do setor | 81.159 de 92.361 | 113.155.082 — **91,71%** | 90.023 de 94.539 | 121.290.319 — **97,08%** |
| Setor de favela/comunidade urbana | 81.163 de 92.361 | 113.157.358 — **91,72%** | 90.026 de 94.539 | 121.291.585 — **97,08%** |

Denominador dos percentuais: **123.378.340 votos em 2022** e **124.934.069 em 2026**, incluindo válidos, brancos e nulos. O percentual eleitoral de cada candidatura continua tendo como denominador os **válidos do seu grupo**. Os dois percentuais medem coisas diferentes.

Na renda ficaram fora **11.366.825 votos em 2022** e **4.901.661 em 2026**. A junção independente dos locais, perfis e setores reproduziu exatamente os incluídos e os totais de cobertura. Motivos mutuamente exclusivos, classificados nesta ordem para não contar um local duas vezes:

| Motivo de exclusão da renda | Locais em 2022 | Votos em 2022 | Locais em 2026 | Votos em 2026 |
| --- | ---: | ---: | ---: | ---: |
| Sem perfil por local | 262 | 47.391 | 306 | 56.054 |
| Sem coordenada | 5.872 | 5.839.332 | 175 | 80.096 |
| Cadastro aponta outro local para alguma seção (`relocated`) | 1.738 | 2.079.545 | 1.878 | 2.172.020 |
| Ponto em outro município | 1.135 | 522.070 | 1.015 | 451.146 |
| Ponto fora da malha | 4 | 690 | 5 | 853 |
| Coordenada compartilhada por locais de nomes diferentes | 2.187 | 1.731.954 | 1.134 | 882.315 |
| Setor sem mediana de renda | 496 | 1.145.843 | 571 | 1.259.177 |

Uma parte importante da diferença está nos locais sem coordenada utilizável. Esta contagem não permite concluir se houve mudança física, melhoria cadastral ou correção de coordenadas em cada caso.

**A seleção altera o resultado agregado.** No 2º turno de 2022, Lula tem 50,90% dos válidos domésticos, mas 50,18% nos locais que entram nos grupos de renda; Jair Bolsonaro tem 49,10% e 49,82%, respectivamente. Em 2026, Lula tem 51,78% no total doméstico e 51,60% nos grupos de renda; Flávio Bolsonaro tem 48,22% e 48,40%. Os votos de fora possuem distribuição diferente: o recorte coberto não deve ser apresentado como se fosse o total eleitoral.

**Ajuste proposto:** quadro de cobertura antes das tabelas e do gráfico, com votos e locais incluídos, total e excluídos, identificando ano, turno, cargo, território e ausência do exterior. Conservar a explicação dos motivos e apresentar, para cada candidatura, o agregado dos locais incluídos ao lado do total do território. Não chamar `totalVotes` de votos válidos; mostrar também o denominador válido quando a comparação for de candidaturas.

A coluna de moradores exige outra distinção: ela agrega **todos os setores do território**, inclusive os que não têm local de votação. Sua cobertura não é a dos locais nem a dos votos. Nos indicadores demográficos por setor, a base é 15+; o eleitorado tem outra base e outra data. O Censo continua sendo o de 2022 nos dois pleitos.

## 3. O filtro regional é viável e resolve uma limitação de exploração

Hoje o formulário e o [contrato](../packages/contracts/src/index.ts) oferecem Brasil ou UF. `region=NE` não é aceito: a API responde **400**, sem aplicar filtro. Não há opção regional escondida.

Os grupos atuais usam faixas fixas ou categorias, iguais nas UFs. Portanto, a Presidência por macrorregião pode ser calculada **somando os grupos das UFs correspondentes**, somando candidatos e denominadores e recalculando os percentuais. Não requer baixar uma fonte eleitoral nova. A auditoria fez essa agregação para os nove indicadores nos dois turnos de cada ano; em **36 recortes**, a soma das cinco regiões reproduziu o Brasil por grupo, candidatura e cobertura. Foi exigida a presença de todas as UFs de cada região.

A composição regional muda a leitura. Exemplo: **Presidência de 2022, 2º turno**, locais com até 5% versus acima de 15% de eleitores de 70 anos ou mais:

| Território | Lula nos locais com até 5% de 70+ | Lula nos locais acima de 15% de 70+ | Diferença, última faixa − primeira |
| --- | ---: | ---: | ---: |
| Brasil sem exterior | 50,35% | 47,01% | −3,34 p.p. |
| Norte | 44,33% | 57,74% | +13,40 p.p. |
| Nordeste | 65,13% | 70,70% | +5,57 p.p. |
| Centro-Oeste | 40,19% | 40,68% | +0,48 p.p. |
| Sudeste | 49,06% | 44,13% | −4,93 p.p. |
| Sul | 38,57% | 39,88% | +1,31 p.p. |

É uma comparação descritiva entre extremos das faixas, sem estimar tendência linear ou efeito individual. A direção nacional difere da observada em quatro das cinco regiões. Isso justifica estratificar o território, mas **não demonstra que região é o principal confundidor em todos os indicadores**, nem que o filtro elimina os demais fatores.

**Ajuste proposto:** seletor de região e opção de comparar as cinco regiões para o mesmo indicador, com cobertura própria em cada uma. A UF pode permanecer como refinamento, validando sua compatibilidade com a região. Agregar também os moradores pelas UFs da região quando essa coluna existir. Conservar as verificações de publicação e dependências, rejeitar agregação de quintis antigos com limites diferentes e nunca calcular média de percentuais. Para Governador e Senador, continuar exigindo UF: números de candidaturas de estados diferentes não identificam a mesma candidatura.

## 4. “Mesmos locais” exige correspondência além dos códigos

O conjunto com votos da Presidência tem 92.361 chaves de local em 2022 e 94.539 em 2026. Cruzamento no 1º turno, com chave completa **UF + município TSE + zona + código do local**:

| Resultado do cruzamento | Locais |
| --- | ---: |
| Chaves presentes nos dois anos | **87.773** |
| Apenas em 2022 | 4.588 |
| Apenas em 2026 | 6.766 |
| Chaves comuns com nome e endereço exatamente iguais e informados | **63.599** |
| Chaves comuns com coordenadas exatamente iguais e informadas | 45.536 |
| Chaves comuns com mesmo setor associado e informado | 73.760 |
| Chaves comuns com perfil e aptos positivos nos dois anos | 87.616 |
| Chaves comuns elegíveis para renda nos dois anos | 75.456 |

Essas contagens são diagnósticos, **não uma coorte validada**. Uma diferença de nome/endereço ou coordenada pode representar atualização de grafia ou do cadastro; igualdade também não prova permanência de prédio, seções ou eleitorado. A auditoria encontrou casos com a mesma chave e alterações simultâneas de nome, endereço, coordenada e setor. Exemplo: **AC, município TSE `01040`, zona 4, local `1155`**, de “ESCOLA LAURA SALES DE MELO”, Comunidade Remanso, para “ESCOLA JOSEFA LOPES DA CUNHA”, Comunidade Cocal, com setor diferente. Não basta fazer uma interseção de códigos e rotulá-la como continuidade física comprovada.

Como teste conservador, exigir simultaneamente nome, endereço e coordenadas exatamente iguais, associação válida e coordenada não compartilhada nos dois anos deixa 34.178 candidatos a correspondência. Esse número também **não é recomendação de corte**: a igualdade estrita exclui correções de cadastro e grafia, e ainda não examina as transferências das seções.

**Ajuste proposto:** preparar uma correspondência auditada entre os locais de 2022 e 2026, com situações distintas para correspondência confirmada, alteração e ambiguidade, e oferecer “todos os locais de cada eleição” ou “locais comuns conferidos”. A correspondência deve registrar as publicações de entrada dos dois anos; se persistida, precisa de identidade e relatório próprios, sem reescrever os resultados existentes. Publicar contagens e votos incluídos/excluídos em cada ano, cargo, turno e indicador. Só comparar turnos efetivamente realizados nos dois recortes.

Fixar os locais também não fixa os grupos: a escolaridade, gênero e idade do perfil cadastral podem mudar e fazer o mesmo local trocar de faixa. Para medir mudança de votos **dentro de grupos constantes**, é necessário fixar e declarar a classificação de referência, por exemplo a de 2022; usar a classificação de cada eleição responde a outra pergunta. Na renda e nas categorias do Censo, conservar a mesma referência de 2022 e verificar se o local continua associado ao mesmo setor. Nenhuma dessas opções acompanha pessoas nem permite inferir transferência individual de votos.

## 5. Verificação, artefatos e encaminhamento

Artefatos locais em `data/analysis/perfis-2026-11-01/` (fora do Git, como as outras auditorias):

- `banco-partidos-cobertura.json`: publicações, identidades e cobertura por indicador/turno.
- `originais-partidos.json` e `checksums.json`: leitura dos CSVs e SHA-256 dos dois ZIPs, recalculados e iguais aos registrados.
- `territorio.json`: exclusões da renda, agregações regionais, interseções e exemplos das alterações nos locais.
- `efeito-cobertura.json`: comparação do total com os locais incluídos, para todas as candidaturas e indicadores, com os denominadores.
- `ui.json` (Chrome) e `ui-firefox.json`, capturas em 1280/375 px e logs dos serviços temporários.
- `observatorio-investigar-perfis.mjs`, `observatorio-perfis-territorio.mjs` e `observatorio-perfis-ui.mjs`: consultas e roteiro de reprodução; executar com Node na raiz do repositório. O último aceita `firefox` como argumento; sem argumento, usa Chrome.

Publicações principais conferidas:

| Escopo | Versão | Início do ID |
| --- | --- | --- |
| `2022/president/BR` | `president-2022-national-v2` | `0a095fc5e2bb` |
| `2026/president/BR` | `president-2026-national-v1` | `fcafbe028c60` |
| `2022/places/groups` | `place-groups-2022-v6` | `a77a28136648` |
| `2026/places/groups` | `place-groups-2026-v1` | `2bf05769c735` |
| `2022/places/tracts` | `polling-place-tracts-2022-v3` | `419c7a552aac` |
| `2026/places/tracts` | `polling-place-tracts-2026-v2` | `24ba62ebdd26` |
| `2022/places/profiles` | `place-profiles-2022-v2` | `b1a30fc0b337` |
| `2026/places/profiles` | `place-profiles-2026-v1` | `3051ebbab721` |

Os ZIPs nominais são os originais do TSE: [2022](https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip) e [2026](https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2026.zip). A leitura usou os bytes preservados pelo projeto, identificados pelos hashes nos artefatos; não baixou nem presumiu que os arquivos atuais do portal sejam idênticos.

Prioridade sugerida: tornar a cobertura explícita e disponibilizar o recorte regional, que podem usar os agregados vigentes; depois preparar a correspondência dos locais e definir a referência dos grupos antes da opção de comparação temporal. Para os partidos, falta identificar o contexto específico da ausência relatada, porque os dados e as duas reproduções estão preenchidos.

Limites: esta auditoria não comparou novamente todos os votos por seção com os ZIPs, não auditou a continuidade das seções entre os anos nem certificou acessibilidade. Não rodou nova compilação ou a suíte geral de testes, pois a entrega altera apenas documentação e reutiliza a compilação existente. API e web temporárias foram encerradas; o banco existente e as publicações ficaram preservados. A alteração preexistente em `apps/web/next-env.d.ts` foi mantida.
