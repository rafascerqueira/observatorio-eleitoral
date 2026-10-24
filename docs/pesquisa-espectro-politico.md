# Pesquisa: diagrama de Nolan e outros mapas de espectro político — 22/10/2026

Pedido de Rafael: pesquisar o diagrama de Nolan e gráficos parecidos, para ver como encaixar candidaturas num espectro político. Se for complexo demais, não aplicar; se der para fazer algo construtivo, elaborar um plano. Pesquisa só documental, sem código nem dados novos.

> **Revisão de 22/10/2026:** Rafael decidiu que classificar em esquerda e direita não fere o `plan.md` quando não há indução, que o problema são rótulos pejorativos (como "autoritário") e que a Res. TSE 23.755/2026 não se aplica ao projeto, que não recomenda candidaturas. Com isso, as avaliações das seções 3 e 4 ficam superadas onde dizem o contrário. Outros modelos estão na seção 6, e o plano em [plano da bússola política](plano-bussola-politica.md).

## 1. Os gráficos

| Modelo | Eixos | Origem e limites |
| --- | --- | --- |
| **Diagrama de Nolan** (David Nolan, anos 1970) | Liberdade econômica × liberdade pessoal | Criado por um fundador do Partido Libertário dos EUA, para mostrar o libertarianismo como uma posição distinta da esquerda e da direita. O enquadramento já traz uma tese: as perguntas medem "liberdade" na definição libertária. Não achei estudo de validade psicométrica. |
| **Political Compass** (site, 2001) | Econômico (esquerda–direita) × social (autoritário–libertário) | Questionário com método não publicado em detalhe. Críticas: falta de base teórica, itens com redação que empurra para um quadrante, média que apaga posições extremas, e posições de candidaturas estimadas pelos autores do site, sem método reprodutível. ([Wikipedia](https://en.wikipedia.org/wiki/The_Political_Compass); [Röttger et al., arXiv 2402.16786](https://arxiv.org/pdf/2402.16786)) |
| **Pournelle, Eysenck, 8values e afins** | Dois a quatro eixos, com nomes diferentes | Mesma família: questionário do visitante projetado em eixos escolhidos pelo autor. |
| **Aplicativos de aconselhamento de voto (VAAs)**: Wahl-O-Mat, StemWijzer, Kieskompas, smartvote (com o "smartspider") | Concordância por tema; alguns projetam em 2D | As candidaturas respondem ao próprio questionário (no smartvote, o questionário é travado antes da publicação), e o visitante recebe uma "afinidade". |

### O que a literatura diz sobre o cálculo da afinidade

- Louwerse e Rosema (2014, *Acta Politica* 49(3)) recalcularam o StemWijzer com outros modelos espaciais: **a maioria dos usuários teria recebido outra recomendação**. Com o método do Kieskompas, a recomendação mudaria para cerca de 75% das mesmas respostas. ([página do artigo](https://www.tomlouwerse.nl/publications/2014-louwerse-rosema-actapolitica/))
- Rosema e Louwerse (2016, *Policy & Internet*): a escala de resposta também muda bastante a recomendação. Os autores sugerem mostrar uma lista de preferências, em vez de "o melhor resultado". ([página](https://www.tomlouwerse.nl/publications/2016-rosema-louwerse-pi/))
- Um trabalho da ETH Zurich compara smartvote (4, 5 ou 7 opções, pesos {0; 0,5; 1; 2}, distância L2) e Wahl-O-Mat (3 opções, pesos {0, 1, 2}, distância L1): trocar o método de cálculo muda em até 105% a frequência com que um partido é recomendado. ([arXiv 2505.13329](https://arxiv.org/pdf/2505.13329))
- Os VAAs influenciam o voto, sobretudo o de quem ainda está indeciso ([ECPR, Louwerse e Rosema](https://ecpr.eu/Events/Event/PaperDetails/7237)).

Conclusão: **a posição de uma candidatura num gráfico desses depende muito de escolhas do autor do gráfico** (perguntas, eixos, pesos, distância), e essas escolhas mudam o resultado para a maioria das pessoas.

## 2. Como a ciência política mede ideologia no Brasil

| Fonte | O que mede | Unidade | Observações |
| --- | --- | --- | --- |
| Bolognesi, Ribeiro e Codato, "Uma nova classificação ideológica dos partidos políticos brasileiros" (*Dados* 66(2), 2023, DOI 10.1590/dados.2023.66.2.303), atualizado em *Opinião Pública* com rodadas de 2018 e 2022 | Escala de 0 (extrema esquerda) a 10 (extrema direita) atribuída por cientistas políticos (477 respostas, segundo o autor) | **Partido**, não candidatura | Principal achado da atualização: desaparecimento do centro ideológico. Base de dados citada, mas não localizei o link direto. ([SciELO](https://scielo.br/j/dados/a/zzyM3gzHD4P45WWdytXjZWg/?format=pdf); [Codato](https://adrianocodato.substack.com/p/o-banquete-de-macbeth-conversando)) |
| Brazilian Legislative Surveys (Power e Zucco, desde 1990, a cada legislatura); Zucco e Power (2024), *Latin American Politics and Society* | Posições de partidos e de presidentes estimadas a partir das avaliações de parlamentares | Partido e presidente | Estimativas no Dataverse (DOI 10.7910/DVN/6KVTUV), não conferidas aqui. ([suplemento](https://static.cambridge.org/content/id/urn:cambridge.org:id:article:S1531426X23000249/resource/name/S1531426X23000249sup001.pdf)) |
| Lauderdale e Zucco: pontos ideais dos deputados (1989–2010/2011) | Votações nominais combinadas com surveys | Deputado | Deputados estão fora do escopo do projeto. ([LSE](https://researchonline.lse.ac.uk/id/eprint/135920)) |
| Manifesto Project (MARPOR), extensão à América Latina | Codificação manual de programas, frase a frase; índice RILE | Partido e candidatura presidencial | Séries do Brasil anunciadas; codificação adaptada a sistemas presidenciais (Ares e Volkens, 2017). Cobertura de 2022 não conferida. ([Pitt](https://www.ucis.pitt.edu/events/node/7201)) |
| Um artigo da *Brazilian Political Science Review* | Compara as medidas | — | Conclui que a posição dos partidos na dimensão esquerda–direita é uniforme o bastante entre as medidas para ser considerada válida. |

Pontos comuns: todas medem **partidos** (ou presidentes já eleitos), não candidaturas de uma eleição corrente. Todas são **uma dimensão** (esquerda–direita), não os dois eixos de Nolan. Todas dependem de julgamento humano declarado (especialistas, parlamentares, codificadores) e publicam incerteza.

## 3. Restrições do projeto e da lei

- **Princípios do `plan.md` (§2):** "não classificar pessoas ou lugares automaticamente como de direita, de esquerda"; sem conclusões editoriais automáticas; mesmos critérios para todas as candidaturas. Colocar candidaturas num diagrama de Nolan, ou calcular uma "afinidade", é exatamente essa classificação, e o resultado depende de escolhas do autor (seção 1).
- **Resolução TSE nº 23.755, de 2/3/2026:** incluiu o § 1º-C no art. 28 da Res. 23.610/2019, que proíbe provedores de aplicação que ofertem sistemas de IA de **ranquear, recomendar, sugerir ou priorizar** candidaturas, partidos, federações ou coligações, mesmo a pedido do usuário. Segundo análises publicadas, explicar propostas e comparar posições documentadas continua permitido. Uma plataforma de afinidade (Tem Meu Voto) saiu do ar em 2026. Não consegui ler o texto compilado no site do TSE (HTTP 403); as informações vêm de fontes secundárias, e a aplicação a um site que não usa IA não está clara. **Qualquer recurso de afinidade ou de classificação de candidaturas precisa de leitura jurídica antes.** ([TSE](https://www.tse.jus.br/legislacao/compilada/res/2026/resolucao-no-23-755-de-2-de-marco-de-2026); [ConJur](https://www.conjur.com.br/2026-mar-27/proibir-o-uso-da-ia-nas-eleicoes-de-2026-viola-a-constituicao/); [Poder360](https://www.poder360.com.br/poder-eleicoes-2026/tse-cobra-plataformas-de-ia-apos-ferramentas-recomendarem-candidatos/); [Fast Company Brasil](https://fastcompanybrasil.com/news/tem-meu-voto-huck-sai-do-ar-comparar-candidatos/))
- **Não usar modelos de linguagem para classificar candidaturas:** além da resolução, a classificação não seria reprodutível nem contestável.

## 4. Avaliação

| Opção | Viável? | Por quê |
| --- | --- | --- |
| A. Diagrama de Nolan ou bússola com candidaturas posicionadas pelo projeto | **Não** | Contraria o §2 do `plan.md`; os eixos de Nolan carregam uma tese; o resultado depende de escolhas do autor; risco regulatório em 2026. |
| B. Questionário do visitante com "afinidade" com candidaturas (VAA) | **Não, por ora** | O resultado muda com o método para a maioria dos usuários; exige respostas das próprias candidaturas ou codificação extensa; orienta o voto; risco regulatório. |
| C. Posições de partidos estimadas por pesquisas acadêmicas (seção 2), exibidas como dado de terceiros, com autoria, método, data, incerteza e escala original | **Possível, com decisão de Rafael** | É classificação, mas feita por terceiros, de forma declarada e reprodutível. Mede partidos, não candidaturas, e não deve ser cruzada com resultados como explicação. Depende de licença e de acesso às bases. |
| D. **Quadro de posições documentadas por tema**: para cada tema, o que cada plano de governo diz, com trecho e página, sem eixo, nota, soma ou afinidade | **Sim: é a opção construtiva** | Continuação direta da fase D3 (rubrica, duas codificações independentes, adjudicação). Mesmos critérios para todas; "não menciona" ≠ "é contra"; a interpretação fica com quem lê. |

## 5. Plano proposto (para aprovação; nada implementado)

Depende da D3, cuja codificação cabe aos contribuidores do projeto (decisão de 24/10/2026).

1. **D3 concluída no tema piloto** (acessibilidade e mobilidade): duas codificações, concordância, adjudicação, publicação e canal de contestação, como já planejado.
2. **Quadro por tema** (`/propostas/temas/<tema>`): tabela candidaturas × critérios do livro de códigos, na ordem do número, com o trecho codificado, link para a página do PDF e o rótulo "não menciona" explícito. Equivalente em tabela, sem gráfico de posição. Sem resumo automático.
3. **Novos temas** só com novo livro de códigos versionado, termos medidos no corpus e as mesmas duas codificações. A escolha dos temas é decisão de Rafael e deve ser publicada com o motivo.
4. **Opcional (opção C)**, decisão separada: página "como a ciência política classifica os partidos", com as estimativas de terceiros citadas, intervalo ou dispersão e data, sem ligar aos mapas de resultados.
5. **Fora do plano:** diagrama de Nolan, bússola, afinidade, ranking, classificação por modelo de linguagem e qualquer rótulo atribuído pelo projeto.

Complexidade: o passo 2 é pequeno, porque reaproveita a busca e a rubrica. O custo real é humano (codificação em dupla por tema). Para 2026, os planos de governo de 2026 precisariam do mesmo inventário e auditoria da D1/D2, ainda não feitos.

Decisões de Rafael: seguir com a opção D (depois da D3); fazer ou não a opção C; temas; leitura jurídica da Res. 23.755/2026 antes de qualquer publicação durante o período eleitoral.

## 6. Outros modelos além de Nolan (revisão de 22/10/2026)

| Modelo | Eixos e rótulos | Como as posições são obtidas | Rótulos pejorativos? |
| --- | --- | --- | --- |
| **Escala esquerda–direita** (0 a 10) | Um eixo | Pesquisas com especialistas (Bolognesi, Ribeiro e Codato; CHES) ou com parlamentares (Power e Zucco) | Não |
| **Kieskompas** (Países Baixos) | Economia esquerda ↔ direita × costumes progressista ↔ conservador | Julgamento de especialistas sobre textos, codificação dos programas e autoposicionamento dos partidos combinados ([Krouwel e Elfrinkhof, 2014](https://ideas.repec.org/a/spr/qualqt/v48y2014i3p1455-1472.html)) | Não |
| **Vote Compass** (Vox Pop Labs; Canadá, Austrália etc.) | Economia esquerda ↔ direita × social liberal ↔ conservador | Revisão de declarações públicas, com os partidos convidados a revisar ([método](https://files.voxpoplabs.com/votecompass/methodology.pdf)). Crítica: um partido "andou" de lugar entre edições porque os itens mudaram ([análise](https://www.patrickjohnstone.ca/?p=10496)) | Não |
| **Electoral Compass** (Sérvia, Fundação Heinrich Böll) | Econômico esquerda ↔ direita × sociocultural progressista ↔ conservador | No modelo do Kieskompas ([Böll](https://rs.boell.org/en/2021/03/08/electoral-compass-2020)) | Não |
| **smartspider** (smartvote, Suíça) | Radar de 8 eixos temáticos, de 0 a 100 (política externa aberta, economia liberal, política fiscal restritiva, lei e ordem, migração restritiva, proteção ambiental, Estado de bem-estar ampliado, sociedade liberal; nomes aproximados) | Respostas das próprias candidaturas a um questionário. Os eixos mudam a cada eleição, então os radares de eleições diferentes não se comparam ([smartvote](https://backend.smartvote.ch/en/smartspider)) | Não; mostra direções por tema em vez de um ponto só |
| **CHES** (Europa; América Latina em 2020, 12 países, 112 partidos e presidentes) | Esquerda–direita geral e econômica; GAL–TAN | Pesquisa com especialistas ([CHES-LA](https://cipr.tulane.edu/?p=970)) | Sim: o polo TAN inclui "autoritário" |
| **PREPPS-LatAm** (2018–2019, 18 países) | Posições de partidos e de presidentes | Pesquisa com especialistas ([GIGA](https://www.giga-hamburg.de/en/publications/research-data/political-representation-executives-political-parties-survey-data-expert-surveys-18-latin-american-countries-2018-2019-prepps-latam-v1)) | Não conferido |
| **Mapa cultural de Inglehart–Welzel** | Tradicional ↔ secular × sobrevivência ↔ autoexpressão | World Values Survey; posiciona **países e populações**, não candidaturas | Não, mas não se aplica a candidaturas |
| **Political Compass, Nolan, 8values** | Incluem autoritário ↔ libertário ou equivalente | Questionário do visitante | Sim |

Leitura: os modelos de dois eixos sem termos pejorativos (Kieskompas, Vote Compass, Electoral Compass) e o radar temático (smartspider) atendem ao que Rafael pediu. O ponto decisivo não é o gráfico, mas **de onde vêm as posições**. Para candidaturas brasileiras já encerradas, a fonte disponível e verificável são os planos de governo, codificados por pessoas com método publicado.
