# Plano — IBGE (Censo 2022) e composição do eleitorado

Registro de 17/10/2026. Pesquisa e plano pedidos por Rafael: incorporar dados públicos do Censo 2022 e elaborar métricas sobre os eleitores conforme a composição da sociedade. **Nada importado ainda.** As verificações abaixo foram feitas por leitura direta dos arquivos oficiais (scripts descartáveis), sem gravar no banco.

## O que é possível afirmar e o que não é

O voto é secreto: nenhuma fonte informa como votou uma pessoa, um grupo de idade, de renda ou de cor/raça. Há três tipos de dado, e cada métrica precisa dizer de qual vem:

| Tipo | Fonte | O que descreve | Exemplo de leitura correta |
| --- | --- | --- | --- |
| **Cadastro do eleitorado** | TSE, perfil do eleitorado | Quem está apto a votar, por características declaradas no alistamento | "52,6% dos eleitores aptos do município são mulheres" |
| **Participação por perfil** | TSE, comparecimento e abstenção | Quem compareceu ou se absteve, por características do cadastro — dado observado, não estimado | "A abstenção entre eleitores de 70 anos ou mais foi X%" |
| **Contexto do território** | IBGE, Censo 2022 | A população residente do território (município, setor) | "No município, Y% dos moradores vivem com até ½ salário mínimo per capita" |

O que **não** se publica: percentual de votos de um grupo social em uma candidatura; correlação apresentada como explicação; rótulo de território ("município pobre", "reduto de…"); renda ou cor/raça do entorno atribuída aos eleitores do local de votação. Comparações entre territórios agrupados por contexto (fase 4) só com rótulo ecológico explícito ("municípios em que…", nunca "eleitores que…") e decisão de Rafael.

## Fontes auditadas

### TSE

| Arquivo | Conteúdo | Verificado |
| --- | --- | --- |
| `municipio_tse_ibge.zip` (dataset "Códigos oficiais de UF e municípios segundo o TSE e o IBGE", gerado em 11/10/2026) | Código TSE ↔ código IBGE de 7 dígitos, nomes nas duas fontes | 5.571 linhas: cobre os **5.570 municípios publicados**, sem código IBGE repetido, UF igual à da API de localidades do IBGE; a linha extra é Boa Esperança do Norte/MT, criada depois da eleição e do Censo de 2022. **22 municípios têm nomes diferentes nas duas fontes** — alguns completamente (RN: "Campo Grande" no TSE = "Augusto Severo" no IBGE; PB: "Tacima" = "Campo de Santana"; SP: "Embu das Artes" = "Embu"). Confirma: cruzar por nome erraria. |
| `perfil_eleitorado_2022.zip` (77 MB, gerado em 25/08/2025) | Eleitores aptos por município/zona × gênero, estado civil, faixa etária, escolaridade, cor/raça, identidade de gênero, quilombola, intérprete de Libras; biometria, deficiência, nome social | Soma **156.454.011** = aptos oficiais. Gênero, idade, escolaridade e estado civil têm menos de 0,05% "não informado". **Cor/raça, identidade de gênero e quilombola: 100% "não informado" em 2022** (coleta posterior). |
| `perfil_eleitor_secao_2022_<UF>.zip` (SP: 180 MB) | O mesmo perfil por **seção** (com local de votação), sem cor/raça (`#NE`), mais obrigatoriedade do voto | Cabeçalho conferido. Volume grande: decisão de armazenamento abaixo. |
| `perfil_comparecimento_abstencao_2022.zip` (201 MB) | Aptos, comparecimento e abstenção por turno, município/zona × gênero, estado civil, **idade simples nos jovens**, escolaridade, cor/raça…, inclusive facultativo/obrigatório | Cabeçalho conferido; cobertura de cor/raça a medir (provavelmente igual à do cadastro). |
| `eleitorado_local_votacao_2022.zip` (24 MB) | Seção → local, endereço, bairro, CEP, **latitude/longitude**, situação | 92.178 locais (UF/município/zona/local, sem ZZ). **7,1% dos locais (5,3% dos eleitores) sem coordenada válida, muito desigual entre UFs: SE 31%, ES 31%, BA 30%, AP 17%, MG 12%; RJ 0%.** Há locais diferentes com coordenada idêntica (até 29 escolas no mesmo ponto em MG), indício de ponto padrão, não de geocodificação. |

### IBGE — Censo 2022 (data de referência: 31/07/2022)

| Fonte | Escala | Conteúdo útil |
| --- | --- | --- |
| Agregados por setores — universo (FTP, atualizado em 20/05/2026) | setor, bairro, distrito, município | 13 conjuntos, 3.417 variáveis: demografia (sexo × faixas de 5/10 anos a partir de 15–19), cor ou raça, alfabetização (15+ por idade e cor/raça), domicílios, parentesco, indígenas, quilombolas, óbitos |
| Rendimento do responsável por setor (08/05/2026) | setor…município | **Só média, mediana e variância** do rendimento do responsável. Não há distribuição por faixas nesta escala |
| SIDRA 9514 | município | População por sexo e **idade simples** — permite população de 16+, 18–69, 70+ (idades de voto facultativo e obrigatório) |
| SIDRA 10296 | município | Moradores por **classes de rendimento domiciliar per capita em salários mínimos**, por sexo e cor/raça (amostra) |
| SIDRA 10295 | município | Rendimento domiciliar per capita médio e mediano (amostra) |
| SIDRA 10061 | município | Pessoas de 18+ por nível de instrução, idade, sexo e cor/raça (amostra) |
| SIDRA 10301 | até UF | Índice de Gini do rendimento per capita (não há municipal) |
| Malha de setores com atributos | setor | GeoPackage nacional de 1,5 GB; CSV de atributos com bairro, favela/comunidade urbana, regiões |
| Microdados da amostra (31/08/2026) | **UF** no acesso público; área de ponderação só no acesso controlado (cadastro e termo) | Rendimento domiciliar per capita, instrução, religião etc. Idade em grupos quinquenais; subamostra e supressões para confidencialidade |

Salário mínimo das classes do IBGE: **R$ 1.212,00**, vigente no mês de referência (nota metodológica 05/2026). É unidade de expressão da renda, não outra renda (`plan.md` §6).

Dados da amostra (rendimento, instrução) são estimativas com erro amostral, maior em municípios pequenos; o IBGE publica coeficientes de variação por área de ponderação. Exibir sempre "estimativa da amostra" e um indicador de precisão quando disponível.

## Métricas propostas

Todas por turno quando houver turno, com numerador e denominador visíveis, soma de numeradores e denominadores na agregação (nunca média de percentuais) e `null` quando o denominador for zero ou o dado for suprimido.

### A. Composição do eleitorado (TSE)

- Distribuição dos aptos por gênero, faixa etária, escolaridade declarada e estado civil — município, zona, UF, Brasil; depois seção/local.
- Parcela de voto facultativo: 16–17 anos e 70+ ÷ aptos.
- Limite declarado: a escolaridade é a informada no alistamento e pode estar desatualizada; não é comparável diretamente ao nível de instrução do Censo.

### B. Participação por perfil (TSE) — o eixo principal

- Taxa de comparecimento e de abstenção por grupo = comparecimento (abstenção) do grupo ÷ aptos do grupo, por turno.
- Diferença em pontos percentuais entre grupos, com o par comparado explícito.
- É comportamento observado (ir ou não votar), não escolha de voto. Abstenção não indica motivação (`plan.md` §2).

### C. Cadastro e população (TSE ÷ IBGE, município)

- Razão eleitorado apto ÷ população residente de 16+ anos (total e por sexo e faixa etária compatível, com idade simples da SIDRA 9514).
- A razão pode passar de 100%: domicílio eleitoral não é residência, há transferências, e o cadastro e o Censo têm datas diferentes (julho e agosto de 2022). Exibir como diferença entre duas fontes, sem sugerir irregularidade.

### D. Contexto do território (IBGE)

- Município: população e estrutura etária; cor ou raça (universo); alfabetização 15+; nível de instrução 18+; distribuição do rendimento domiciliar per capita em classes de salário mínimo e mediana (amostra); características dos domicílios.
- Setor censitário próximo ao local de votação (fase 3): só variáveis do universo e média/mediana do rendimento do responsável, com método de associação versionado e cobertura informada; sem atribuir o entorno aos eleitores (`plan.md` §5).

### E. Resultados por contexto territorial (fase 4, a decidir)

- Somar votos e denominadores de municípios agrupados por uma característica do Censo (ex.: faixas da mediana de rendimento per capita), mesmos cortes para todas as candidaturas, rótulo ecológico explícito. Sem regressão ou correlação apresentada como causa.

## Fases

1. **Correspondência e fontes.** Importar a tabela oficial TSE–IBGE com checksum e versão; verificar cobertura (5.570/5.570), unicidade e UF; registrar os 22 nomes divergentes como informação, não como erro. Depois, conferência geográfica independente: pontos dos locais dentro do polígono do município IBGE correspondente.
2. **Município, sem geografia.** IBGE (SIDRA 9514, 10061, 10295, 10296; agregados municipais de cor ou raça, alfabetização e demografia) e TSE (perfil do eleitorado e comparecimento/abstenção, guardados como marginais por dimensão: gênero, idade, escolaridade, estado civil). Métricas A, B, C e D municipais na página do município e da UF. Volume pequeno: dezenas de MB.
3. **Locais e setores.** Auditoria das coordenadas (dentro do município, pontos repetidos, precisão), associação local → setor por método versionado (setor que contém o ponto; sensibilidade com raio), cobertura por UF publicada; perfil do eleitorado por local (agregado das seções). Exige ferramenta espacial (decisão 2).
4. **Comparações por contexto** (métrica E), se Rafael aprovar.

Antes da fase 2, auditar: supressões e sinais especiais dos agregados (`X`, `.`), totais municipais do IBGE contra a soma dos setores, faixas etárias equivalentes entre TSE e IBGE, cobertura de cor/raça no comparecimento.

## Armazenamento (estimativa)

| Item | Volume aproximado |
| --- | --- |
| Tabela TSE–IBGE, tabelas SIDRA municipais selecionadas, marginais TSE por município/zona | < 100 MB no banco |
| Agregados por setor (temas selecionados, ~450 mil setores) | 0,2–0,5 GB |
| Perfil por seção agregado em marginais por local (~92 mil locais) | ~0,1 GB; o cruzamento completo por seção seria muito maior e não é necessário agora |
| Originais preservados (FTP IBGE + TSE eleitorado) | ~0,6 GB sem a malha; +1,5 GB com a malha nacional de setores |
| Associação local → setor | desprezível (uma linha por local e método) |

Bem abaixo dos ~20 GB que os deputados exigiriam.

## Decisões para Rafael

1. **Ordem:** começar pela fase 1 e 2 (município), deixando setores para depois. Recomendação: sim — entrega o cruzamento TSE–IBGE com o menor risco metodológico.
2. **Ferramenta espacial (fase 3):** adotar PostGIS (trocar a imagem `postgres:18.6-alpine` por uma com PostGIS) ou fazer a associação ponto → setor fora do banco, no importador. Recomendação: PostGIS, que também servirá a mapas.
3. **Microdados de acesso controlado** (área de ponderação: distribuição de renda abaixo do município em cidades grandes): exigem cadastro e termo de uso do IBGE. Recomendação: não por ora; os municipais da SIDRA bastam para a fase 2.
4. **Perfil por seção:** guardar só marginais por local (gênero, idade, escolaridade). Recomendação: sim, na fase 3.
5. **Métrica E** (resultados por contexto): incluir ou não, e com quais cortes.

## Referências

- TSE, dados abertos: [Eleitorado 2022](https://dadosabertos.tse.jus.br/dataset/eleitorado-2022), [Comparecimento e abstenção 2022](https://dadosabertos.tse.jus.br/dataset/comparecimento-e-abstencao-2022), [Códigos TSE–IBGE](https://dadosabertos.tse.jus.br/dataset/codigos-oficiais-de-uf-e-municipios-segundo-o-tse-e-o-ibge), [nota sobre o perfil do eleitorado](https://www.tse.jus.br/comunicacao/noticias/2022/Agosto/portal-de-dados-abertos-do-tse-disponibiliza-perfil-do-eleitorado-brasileiro-423754).
- IBGE: [FTP do Censo 2022](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/), [Agregados por setores — resultados do universo](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102136.pdf), [API de agregados (SIDRA)](https://servicodados.ibge.gov.br/api/docs/agregados?versao=3), [API de localidades](https://servicodados.ibge.gov.br/api/docs/localidades), notas metodológicas 03/2026 (confidencialidade) e 05/2026 (microdados da amostra) no FTP.
- Mapeamento de terceiros (não usado como fonte): [betafcc/Municipios-Brasileiros-TSE](https://github.com/betafcc/Municipios-Brasileiros-TSE).
