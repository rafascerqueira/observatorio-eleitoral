# Estudo — faixas de idade do IBGE para adultos e idosos

Registro de **31/10/2026**, fase 5 do [plano dos indicadores do Censo](plano-indicadores-censo-2022.md), pedida por Rafael para rever o que foi construído. É um estudo para decisão: **nenhuma mudança foi feita** a partir dele. Fontes consultadas por busca na web em 31/10/2026 (lista ao final); as publicações do IBGE não foram lidas na íntegra, e o que não foi confirmado está marcado.

## 1. Cortes de idade de referência

| Corte | Para quê | Quem define | Confirmado em |
| --- | --- | --- | --- |
| **0–14, 15–64, 65+** (grandes grupos) | razão de dependência; índice de envelhecimento oficial do Censo 2022 (65+ ÷ 0–14 × 100 = **55,2**; 30,7 em 2010) | IBGE | publicação *População por idade e sexo* do Censo 2022 e metadados do índice municipal |
| **60+** (pessoa idosa) | população idosa (**32.113.490** em 2022); índice de envelhecimento alternativo com 60+ (**80,0**; 44,8 em 2010) | Estatuto da Pessoa Idosa (Lei 10.741/2003); o IBGE observa que 65+ **não** corresponde à definição do Estatuto | publicação e notícias do IBGE sobre o Censo 2022 |
| **0–14, 15–59, 60+** | séries antigas da razão de dependência | IBGE (séries históricas) | Séries Estatísticas do IBGE — comparações exigem cuidado |
| **15–29** (juventude), com 15–17, 18–24 e 25–29 | políticas de juventude; o IBGE usa a faixa nas estatísticas de jovens | Estatuto da Juventude (Lei 12.852/2013) | fontes secundárias; não lido no IBGE |
| **14+** (idade de trabalhar) | força de trabalho, ocupação, desocupação | IBGE (PNAD Contínua e Censo 2022) | já usado nas tabelas de trabalho do Censo (§5 do plano) |
| **16–17 e 70+ facultativo; 18–69 obrigatório** (e analfabetos facultativos) | voto | Constituição, art. 14 | — |

Não encontrei uma definição do IBGE para "adulto" como categoria; entre a juventude (até 29) e a pessoa idosa (60+), os textos usam grupos quinquenais ou decenais.

## 2. Confronto com o que foi construído

| Onde | Cortes | Relação com as referências |
| --- | --- | --- |
| Indicadores do Censo (`census-indicators-2022-v1`) | 16+, 16–17, 18–69, 70+; 18+ na instrução; 14+ no trabalho; 15+ onde a fonte agrupa 15–19 | Recortes do voto, decididos em 31/10. A alfabetização termina em **65+**, o limite dos grandes grupos do IBGE, porque a tabela só separa 65 anos ou mais. |
| Participação por perfil (`AGE_GROUPS`) | 16–17, 18–24, 25–34, 35–44, 45–59, 60–69, 70+ | Tem os cortes do voto (18, 70) e o da pessoa idosa (60): 60+ = 60–69 + 70+. 18–24 coincide com os "jovens-jovens" do Estatuto da Juventude; 25–29 e 15–29 não saem desses grupos. |
| Perfis por local (métrica E) | eleitores de 16 a 24 anos; **60 anos ou mais** (TSE) e equivalentes do Censo por setor (15–24 e 60+ entre 15+) | 60+ é a pessoa idosa do Estatuto, comparável às publicações do IBGE; não separa o voto facultativo (70+). |
| Painel do município (idade × cadastro) | faixas do TSE (16 a 20 simples, depois quinquenais) | Permite compor qualquer um dos cortes acima a partir de 16 anos. |

## 3. O que isso muda na fase 4

A fase 4 propunha **trocar** 60+ por 70+ nos perfis por local. O estudo indica que os dois cortes respondem a perguntas diferentes:
- **70+** é o voto facultativo por idade e se liga à abstenção;
- **60+** é a pessoa idosa, como o IBGE e o Estatuto a definem, e é o corte das publicações do Censo.

Trocar faria perder a comparação com o IBGE. Para decisão de Rafael: **acrescentar 70+ e manter 60+**, em vez de trocar. Os dados medidos para isso estão no §10 do plano.

Outras possibilidades registradas, sem recomendação de execução agora:
- **Pessoa idosa (60+) no mapa:** sai exata da 9606, já importada (idade simples), sem nova consulta. Exigiria só um novo recorte no importador, portanto nova versão.
- **Juventude (15–29):** só com base 15+ e o desvio declarado. Hoje não há corte em 29 nas tabelas usadas, exceto a 9606.

## 4. Fontes

- IBGE, *Censo Demográfico 2022 — População por idade e sexo* (definição do índice de envelhecimento, 65+ e variante 60+): https://biblioteca.ibge.gov.br/visualizacao/livros/liv102038.pdf e https://biblioteca.ibge.gov.br/visualizacao/periodicos/3102/cd_2022_populacao_idade_sexo_br.pdf
- IBGE, metadados do índice de envelhecimento por município (fórmula P65+ ÷ P0–14): https://metadadosgeo.ibge.gov.br/geonetwork_ibge/srv/api/records/00a2d862-145f-416f-8451-8a65c7f2f921
- IBGE, nota sobre a divulgação de 27/10/2023: https://www.ibge.gov.br/novo-portal-destaques/38254-sobre-a-divulgacao-do-censo-demografico-2022-populacao-por-idade-e-sexo-resultados-do-universo-realizada-em-27-de-outubro-de-2023.html
- IBGE, Séries Estatísticas (razão de dependência com 15–59 e 60+): https://seriesestatisticas.ibge.gov.br/series.aspx?vcodigo=CD95
- Estatuto da Pessoa Idosa (Lei 10.741/2003): https://www.gov.br/mdh/pt-br/centrais-de-conteudo/pessoa-idosa/estatuto-da-pessoa-idosa.pdf
- Estatuto da Juventude (Lei 12.852/2013), por fonte secundária: https://observatoriodejuventude.fortaleza.ce.gov.br/images/acervo/legislacao-voltada-a-juventude-do-brasil-nos-ultimos-30-anos.pdf
