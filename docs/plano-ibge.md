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

## Decisões de Rafael (17/10/2026)

1. Começar pela etapa municipal (fases 1 e 2); setores depois.
2. PostGIS para a associação local → setor (fase 3).
3. Microdados de acesso controlado: não por ora.
4. Perfil por seção guardado como marginais por local, na fase 3.
5. Métrica E: resultados agrupados por **escolaridade e renda conforme a aproximação do local de votação** — escolaridade dos eleitores do local (cadastro do TSE por seção, somado por local) e renda do entorno (setor do IBGE associado ao local), com rótulo ecológico ("locais em que…") e cobertura informada. Depende da fase 3.
6. Perfis do TSE (cadastro e comparecimento) como **base própria, declarada**: auditoria de 17/10/2026 mostrou que não fecham com os resultados por município (perfil do eleitorado: 5.569 de 5.751 municípios/localidades diferem; comparecimento: mediana de 15 eleitores, 0,2%, máximo 5,7%; taxa de abstenção: mediana 0,02 p.p., máximo 3,4 p.p.) e que o arquivo de comparecimento **não traz DF nem exterior** (153.553.888 aptos, mesmo total nos dois turnos, contra 156.454.011 nos resultados). Taxas calculadas só dentro do próprio arquivo; diferença em relação aos resultados exibida por município; DF e exterior "não disponível", nunca zero; faixa etária "Inválido" (1.976 aptos) mantida como categoria da fonte.

## Decisões propostas (registro original)

1. **Ordem:** começar pela fase 1 e 2 (município), deixando setores para depois. Recomendação: sim — entrega o cruzamento TSE–IBGE com o menor risco metodológico.
2. **Ferramenta espacial (fase 3):** adotar PostGIS (trocar a imagem `postgres:18.6-alpine` por uma com PostGIS) ou fazer a associação ponto → setor fora do banco, no importador. Recomendação: PostGIS, que também servirá a mapas.
3. **Microdados de acesso controlado** (área de ponderação: distribuição de renda abaixo do município em cidades grandes): exigem cadastro e termo de uso do IBGE. Recomendação: não por ora; os municipais da SIDRA bastam para a fase 2.
4. **Perfil por seção:** guardar só marginais por local (gênero, idade, escolaridade). Recomendação: sim, na fase 3.
5. **Métrica E** (resultados por contexto): incluir ou não, e com quais cortes.

## Referências

- TSE, dados abertos: [Eleitorado 2022](https://dadosabertos.tse.jus.br/dataset/eleitorado-2022), [Comparecimento e abstenção 2022](https://dadosabertos.tse.jus.br/dataset/comparecimento-e-abstencao-2022), [Códigos TSE–IBGE](https://dadosabertos.tse.jus.br/dataset/codigos-oficiais-de-uf-e-municipios-segundo-o-tse-e-o-ibge), [nota sobre o perfil do eleitorado](https://www.tse.jus.br/comunicacao/noticias/2022/Agosto/portal-de-dados-abertos-do-tse-disponibiliza-perfil-do-eleitorado-brasileiro-423754).
- IBGE: [FTP do Censo 2022](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/), [Agregados por setores — resultados do universo](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102136.pdf), [API de agregados (SIDRA)](https://servicodados.ibge.gov.br/api/docs/agregados?versao=3), [API de localidades](https://servicodados.ibge.gov.br/api/docs/localidades), notas metodológicas 03/2026 (confidencialidade) e 05/2026 (microdados da amostra) no FTP.
- Mapeamento de terceiros (não usado como fonte): [betafcc/Municipios-Brasileiros-TSE](https://github.com/betafcc/Municipios-Brasileiros-TSE).

## Andamento — 17/10/2026

### Fases 1 e 2 (município): publicadas

- `npm run import:context` (`municipal-context-2022-v1`, recorte `2022/context/municipal`): correspondência oficial TSE–IBGE, 163 consultas SIDRA (6 tabelas × 27 UFs + totais das UFs) e os dois perfis do TSE, todos preservados com SHA-256 (`data/raw/ibge/2022/sidra`, `data/originals`). **5.570 municípios**; cadastro de **155.756.933** eleitores (= 156.454.011 − 697.078 do exterior); comparecimento por perfil sem DF, declarado. Tabela `municipality_context` (35 MB) e `municipality_indicators` (derivada, migration 008).
- Regras de soma (decididas na importação, nunca ajuste): **exata** no universo e no TSE; **arredondamento** na amostra (diferença até metade do número de células, registrada em `roundingDifference` — observado: até 3 pessoas no rendimento, 2 na instrução); **parcial** em cor ou raça (SIDRA 9605: 1.277 municípios com total maior que a soma das cinco categorias, até 1.503 pessoas em Abreu e Lima/PE; a diferença aparece como não discriminada na fonte, `undistributed`). A origem dessa diferença não está nos metadados da tabela e não foi presumida.
- Duas travas acionadas e resolvidas por auditoria: faixa etária "Inválida" (perfil, 1.990 eleitores) = "Inválido" (comparecimento, 1.976), mesma categoria da fonte; arredondamento da amostra (Bujari/AC: 12.919 × 12.917).
- Conferências: população por idade soma o total em cada município; população por cor ou raça = população por idade; soma dos municípios = UF (SIDRA 9514, 27 UFs); identidade aptos = comparecimento + abstenção em todas as linhas do TSE; totais nacionais iguais aos divulgados (alfabetização 15+: 93,0%).
- API `GET /elections/municipalities/:code/context?uf=` e painel "Território e eleitorado" na página do município (universo, amostra e cadastro sempre identificados; diferença cadastro × resultados exibida; DF "não disponível").

### Mapas (protótipo)

- `npm run import:maps` (`maps-ibge-2022-v2`, recorte `2022/maps/ibge`): malhas da API do IBGE (2022) — Brasil por UF e 27 UFs por município, qualidade mínima (a v1, intermediária, ficou não publicada por pesar ~3× sem ganho visível); 28 topologias, códigos conferidos um a um contra a correspondência oficial (nenhum faltando, sobrando ou repetido). Tabela `map_geometries` (2,4 MB).
- API `GET /elections/map/geometry` e `GET /elections/map/values` (indicadores: até ½ salário mínimo per capita, superior completo 18+, alfabetização 15+ e abstenção da Presidência; UF = soma de numeradores e denominadores).
- Página `/mapa`: dois coropléticos lado a lado (SVG no servidor com d3-geo 3.1.1 e topojson-client 3.1.0; projeção cônica de áreas iguais), quintis com limites na legenda, escalas de uma só cor validadas pelo validador de paleta (verde-petróleo e cobre: claridade monotônica, saltos ≥ 0,06, classe clara ≥ 2:1), "sem dado" em cinza próprio, Fernando de Noronha em quadro destacado, contornos compartilhados entre os dois mapas (`<use>`), clique na UF abre seus municípios e clique no município abre a página dele, tabela com numerador e denominador como acesso por teclado e leitor de tela (o SVG fica oculto para tecnologias assistivas). Página de MG por município: 2,3 MB (382 KB com gzip); Brasil por UF: 57 KB com gzip.
- Verificação: `smoke:context` (20 requisições: valores de SP conferidos com a SIDRA, nomes divergentes ligados pelo código, DF sem comparecimento, alfabetização nacional, UF = soma dos municípios, abstenção do mapa = resultado publicado da UF, páginas), os 8 smokes anteriores, 58 testes, axe-core sem violações e sem rolagem horizontal a 375/320 px em 18 páginas. Não verificados: Chrome/Safari, leitor de tela real, modo escuro (o site não tem).

Pendente (mapas): tooltip próprio (hoje, rótulo nativo do SVG); mapa de candidaturas (mesma escala para todas).

### Fase 3 (locais → setores) e métrica E — 17/10/2026

- **PostGIS:** antes da troca, backup completo (`data/backups/observatorio-2026-10-17-antes-postgis.dump`, 246 MB, SHA-256 ao lado; 20.918.002 linhas de votos conferidas no dump). Imagem do banco trocada de `postgres:18.6-alpine` para `postgis/postgis:18-3.6-alpine` (mesmo PostgreSQL 18.6, Alpine 3.24, collation libc `en_US.utf8`); dados e publicações intactos; PostGIS 3.6.4.
- **Downloads grandes:** gravação em fluxo, retomada por HTTP Range após queda (o FTP do IBGE caiu durante o download da malha) e hard link entre o bruto e o original preservado (sem duplicar 1,5 GB).
- **`npm run import:sectors`** (`polling-place-tracts-2022-v2`, recorte `2022/places/tracts`): malha nacional de setores (GeoPackage, 472.780 linhas = 468.099 setores; 914 setores descontínuos com partes unidas e atributos conferidos) só em tabela temporária; associação local → setor que contém o ponto do TSE, aceita se única e no município esperado. Achados: o cadastro de locais foi regerado depois da eleição — o código **original** do local casa com 100% dos 92.361 locais com votos (o atual, com 91.298); 7.896 seções mudaram de local depois de 2022 e os locais afetados ficam **realocados**, sem associação (a coordenada pode ser do prédio novo); coordenadas entre −1 e 1 vêm sem zero inicial (".85") — a v1 as descartava (AP com 8% associado); a v2 corrigiu (AP 87,5%). Resultado v2: 93.561 locais, 155.756.933 eleitores (= cadastro doméstico); **93,0% dos eleitores em locais associados**; sem coordenada 4,8% (ES, BA e SE perto de 30%: falta na fonte); realocados 1,7%; setor de outro município 0,4%; ambíguos 0. Rendimento do responsável por setor: "X" (8.904 setores, omitido pelo IBGE) e "." (337, não se aplica) viram `null`.
- **`npm run import:place-profiles`** (`place-profiles-2022-v1`): perfil por seção do TSE (27 UFs, 773 MB) somado por local; 93.291 locais, **155.756.933** eleitores — igual ao perfil municipal; 262 locais com votos (0,3%) sem perfil por seção.
- **`npm run import:place-groups`** (`place-groups-2022-v1`): métrica E pré-calculada para os 244 recortes publicados (Presidência no Brasil e nas UFs, Governador e Senador por UF, turnos realizados, dois indicadores) em 72 s; a API lê o agregado (13–27 ms), em vez de afrouxar o limite de 2 s por consulta. Quintis ponderados por eleitores aptos; cada grupo confere candidaturas = válidos.
- **Página `/perfis`**: grupos com faixas do indicador, locais, eleitores e válidos; pontos por candidatura na mesma escala (HTML, legível em qualquer largura); matriz candidatura × grupo como acesso principal; cobertura dos votos sempre informada; aviso de leitura ecológica.
- **Verificação:** 61 testes; `smoke:context` (inclui associação v2, AP, soma do cadastro, grupos ordenados com ~1/5 do eleitorado, candidaturas = válidos, página); os 9 smokes; axe-core sem violações e sem rolagem horizontal em 21 páginas. Banco: +230 MB (associação 99 MB, perfil por local 80 MB, contexto de setores 43 MB, grupos 0,6 MB).

Pendente: sensibilidade do método de associação (raio em torno do ponto), revisão com leitor de tela real, Chrome/Safari.

### Métrica E v2: faixas fixas de renda — 17/10/2026

- **Defeito da v1:** muitos setores têm mediana do rendimento do responsável exatamente em 1 SM (R$ 1.212): 20,3% dos eleitores em locais associados no Brasil, 55,9% em AL, 54,2% na PB, 53,2% no PI. Os quintis desempatavam pela chave do local (UF, município, zona, código) e separavam valores iguais em grupos diferentes — no MA, os grupos 3 e 4 eram inteiros de setores com R$ 1.212 e só o código do município os distinguia. A v1 fica guardada, não publicada.
- **`place-groups-2022-v2`** (decisão de Rafael): renda em **faixas fixas**, iguais em todos os recortes, em salários mínimos de 2022 (R$ 1.212, vigente em 31/07/2022, data de referência do Censo): até 1 SM; acima de 1 até 1,5; acima de 1,5 até 2; acima de 2 até 3; acima de 3 SM (`INCOME_BANDS` nos contratos; limite superior incluído). Escolaridade segue em quintis ponderados por eleitores aptos, mas o grupo vem da posição do bloco de locais com o mesmo valor, então empates nunca se separam. Resposta com `method` (`quintiles`/`bands`) e, nas faixas, `lower`/`upper` em reais; ausentes na v1.
- **Efeito:** os tamanhos das faixas variam com o território (Presidência, 1º turno: até 1 SM reúne 30,1% dos eleitores dos grupos no Brasil, 82,0% no MA, 71,6% em AL e 3,5% em SP). Escolaridade: cinco grupos com 19,9–20,1% em todos os recortes conferidos. 244 recortes em 63 s.
- **Página `/perfis`:** cada grupo com nome (faixa de SM ou quinto), definição por extenso, valores observados e parcela dos eleitores; faixa vazia aparece como "Nenhum local nesta faixa"; aviso de que faixas com poucos locais variam mais.
- **Verificação:** testes unitários, os 10 smokes (`smoke:context` confere método, ordem estrita entre grupos sem empates divididos, ~1/5 na escolaridade e valores dentro dos limites de cada faixa); axe-core sem violações e sem rolagem horizontal em 23 páginas.
- Dicionário do rendimento do responsável preservado depois (ver a seção seguinte): V06006 é a mediana **das pessoas responsáveis com rendimentos** em domicílios particulares permanentes ocupados; V06001 é o total de responsáveis (com ou sem rendimento) — a coluna `responsible_with_income` de `census_tract_context` (migração 009) tem nome impreciso, sem uso na interface.

### Moradores por faixa de renda do setor — 17/10/2026

- Pedido de Rafael: informar quanto cada faixa representa da população do Brasil, da UF e do município. **`npm run import:income-bands`** (`income-bands-2022-v1`, recorte `2022/context/income-bands`): todos os 458.772 setores do arquivo de rendimento do responsável, com ou sem local de votação; os moradores em domicílios particulares permanentes ocupados (V06002, a população a que a mediana se refere) entram na faixa da mediana do setor (V06006), com as mesmas faixas fixas de `INCOME_BANDS`. Originais preservados: arquivo por setor, arquivo municipal e dicionário (`dicionario_de_dados_renda_responsavel_20260508.xlsx`).
- **Conferência que bloqueia:** soma dos setores = V06002 do arquivo municipal do IBGE nos 5.570 municípios (igual em todos). Os 8.904 setores "X" (dados omitidos) não têm moradores divulgados e também não entram no total municipal do IBGE: ficam contados à parte, sem estimativa. 337 setores "." (mediana não se aplica) têm 23.419 moradores, contados no total e fora das faixas. Total: 202.007.359 moradores (não inclui domicílios coletivos nem improvisados; a população residente do Censo é 203.080.756).
- **Brasil, % dos moradores em setores com mediana:** até 1 SM 38,1%; acima de 1 até 1,5: 21,8%; até 2: 18,2%; até 3: 12,5%; acima de 3: 9,5%. Eleitores aptos dos locais (Presidência, 1º turno): 30,1 / 20,3 / 22,2 / 17,0 / 10,5%. MA: moradores 84,9% até 1 SM (eleitores 82,0%); AL: 79,5% (71,6%); SP: 7,1% (3,5%).
- **Interface:** em `/perfis` (renda), coluna "Moradores do território em setores da faixa" com contagem e percentual do Brasil ou da UF, ao lado da parcela dos eleitores; na página do município, tabela "Moradores por faixa de renda mediana do setor" junto das classes per capita da amostra, com aviso de que são medidas diferentes (cada setor entra inteiro na faixa da sua mediana; não é a renda de cada morador); `/fontes` com versão, notas e originais (rota de originais aceita `.xlsx`).
- **Verificação:** teste unitário do limite das faixas; `smoke:context` (faixas + sem mediana = total, Brasil = total publicado, escolaridade sem moradores, município e páginas); os 9 smokes; axe-core sem violações e sem rolagem horizontal em 23 páginas. Banco: tabela de 5.570 linhas.

### Métricas por gênero, faixa etária e escolaridade — 17/10/2026

Decisões de Rafael: faixas etárias por obrigatoriedade do voto (16–17, 18–24, 25–34, 35–44, 45–59, 60–69, 70+; `AGE_GROUPS` nos contratos) e escopo com participação e novos agrupamentos de locais.

- **Participação por perfil** (`turnout-profiles-2022-v1`, `npm run import:turnout-profiles`, recorte `2022/context/turnout-profiles`): o arquivo de perfil do comparecimento e abstenção do TSE (por município, zona, gênero, estado civil, faixa etária e escolaridade) somado em cubos gênero × faixa do TSE × escolaridade por UF e turno. Contagens da fonte, não ecológicas; sem voto por candidatura. Conferências que bloqueiam, em cada linha: comparecimento + abstenção = aptos; divisões facultativo/obrigatório somam o comparecimento e a abstenção; aptos facultativos = regra constitucional aplicada aqui (16–17, 70+ ou analfabeto; `optionalVoter`). Por UF e turno: totais iguais à soma das marginais do contexto municipal (mesma fonte). Ausência auditada: DF (e exterior). Totais: 153.553.888 aptos nos dois turnos; abstenção 31.992.499 (1º) e 31.433.997 (2º); aptos nos resultados das mesmas UFs 153.551.660 e 153.550.805 (diferença exibida, não ajustada). Importação em 617 s.
- **Página `/participacao`**: Brasil (26 UFs da fonte) ou UF, turno, linhas × colunas entre gênero, faixa etária, escolaridade e obrigatoriedade; taxa = abstenções ÷ aptos somados do grupo; gráfico de pontos (feminino × masculino ou obrigatório × facultativo, paleta de duas cores validada; gênero não informado só na tabela) e tabela com contagens; DF com aviso de ausência na fonte. API `GET /elections/turnout/profiles` (31 ms).
- **Métrica E v3** (`place-groups-2022-v3`): novos indicadores do perfil por local em quintis — até fundamental incompleto, eleitoras, 16 a 24 anos e 60 anos ou mais (`PLACE_GROUP_NUMERATORS`) —, além de superior completo e renda; 732 recortes em 248 s, todos com cinco grupos de ~20% dos eleitores. Aviso de que cada indicador é olhado isoladamente.
- **Verificação:** testes unitários (rótulos dos contratos = ordem do importador; faixas agregadas cobrem cada faixa do TSE uma vez; regra do voto facultativo), os 9 smokes (`smoke:context` com aptos e abstenção = totais publicados, regra do facultativo por célula, DF fora da fonte, erros de filtro e página), axe-core sem violações e sem rolagem horizontal em 30 páginas.
- **Métrica E v4** (`place-groups-2022-v4`, mesma data): Rafael apontou que os indicadores percentuais em quintis voltavam ao problema da renda — cada grupo sempre com ~1/5 dos eleitores, limites mudando a cada recorte e sem definição estável. Decisão: **faixas fixas de números redondos**, iguais no Brasil, em cada UF e em cada cargo (`PLACE_GROUP_CUTS`, limite superior incluído): superior completo 5/10/20/30%; até fundamental incompleto 20/30/40/50%; eleitoras 50/52/54/56%; 16 a 24 anos 10/12,5/15/20%; 60 anos ou mais 15/20/25/30%; renda segue em salários mínimos. 732 recortes em 142 s, todos com as cinco faixas; os tamanhos agora variam (Presidência, 1º turno, superior completo até 5%: Brasil 35,5%, MA 61,9%, SP 18,4% dos eleitores). Página com nome e definição por extenso de cada faixa e a parcela dos eleitores do recorte. v2–v3 guardadas, não publicadas. Smoke confere os mesmos limites no Brasil e numa UF.


### Métodos e dados pendentes; mapas — 17/10/2026 (noite)

Ordem pedida por Rafael: primeiro melhorias de método e de dados, depois interface.

- **Sensibilidade da associação local → setor** (`tract-sensitivity-2022-v1`, `npm run import:tract-sensitivity`, recorte `2022/places/tract-sensitivity`): só o indicador de renda depende do setor. Para os mesmos locais da métrica E de renda (associados, sem ponto compartilhado), a faixa passa a ser a predominante entre os moradores (V06002) dos setores do mesmo município a até 250 m, 500 m e 1 km do ponto do TSE (PostGIS `geography`, distância geodésica; cada setor que toca o círculo entra inteiro, na faixa da sua mediana); empate entre faixas não escolhe. Recarrega a malha preservada (sem guardar geometria) e refaz os grupos de cada recorte com o mesmo cálculo da métrica E (`compute` de `place-groups.ts`, exportado com a opção `banded`). Conferências que bloqueiam: setores com renda presentes na malha; o setor do ponto aparece entre os vizinhos a ~0 m; local com faixa no setor do ponto sempre tem faixa (ou empate) no raio; concordância soma os locais de cada território; cobertura (locais e votos do recorte) igual à da métrica E publicada. A métrica publicada não muda. Página `/perfis` (renda): tabela de sensibilidade (mesma faixa, vizinha, duas ou mais, empate, só pelo raio; maior diferença de % válidos de uma candidatura num grupo) e links para ver os grupos por raio, com diferença em p.p. por célula. Primeira tentativa interrompida: tabelas temporárias sem índice levavam ~1,5 min por recorte; a versão final indexa e analisa a faixa por local antes dos recortes (366 recortes, 1.432 s no total, quase tudo na malha e nos 2.047.129 pares local–setor a até 1 km). **Resultado** (81.163 locais associados): na mesma faixa do setor do ponto ficam 70,9% dos eleitores a 250 m, 66,5% a 500 m e 61,6% a 1 km; numa faixa vizinha, 22,1 / 24,9 / 27,4%; a duas ou mais, 6,0 / 7,5 / 9,9%; empates 0,0%; 1,0% só ganha faixa com o raio (setor do ponto sem mediana). Com o raio, a faixa até 1 SM cresce (Presidência, 1º turno, Brasil: 30,1% dos eleitores na publicada; 33,4 / 35,2 / 37,1% pelos raios). Maior diferença de % válidos de uma candidatura num grupo: Brasil 1,3 / 2,1 / 2,8 p.p.; SP 1,5 / 2,4 / 3,2; MA 4,4 / 6,7 / 9,6 (faixas com 30 a 97 locais). Leitura: a direção das diferenças entre faixas se mantém no Brasil, mas faixas com poucos locais são sensíveis à associação.
- **Participação v2** (`turnout-profiles-2022-v2`): estado civil no cruzamento e cubo por município (faixas etárias já nos grupos por obrigatoriedade, que não misturam facultativo e obrigatório), em vetores `int4` (`turnout_profile_cells`, uma linha por UF e por município e turno). Cada município e turno confere com o contexto municipal nos totais e em cada categoria de gênero, faixa etária, escolaridade e estado civil — bloqueia se divergir. 5.569 municípios (DF fora da fonte); totais idênticos aos da v1 (153.553.888 aptos; abstenção 31.992.499 e 31.433.997). 1.012 s. `/participacao` ganhou município (lista da UF carregada pelo servidor; desativada se a UF mudar antes do envio) e estado civil nas linhas/colunas; a página do município liga para o cruzamento e mostra o cadastro por gênero e estado civil. A API confere a ordem das categorias guardada na publicação dimensão a dimensão (o JSONB não preserva a ordem das chaves).
- **Moradores por faixa de perfil do setor** (`tract-demography-2022-v1`, `npm run import:tract-demography`): agregado de demografia por setor do Censo (22,5 MB, preservado; rótulos de 36 variáveis conferidos no dicionário). Equivalente censitário de eleitoras, 16 a 24 e 60+ em `/perfis`: setores nos mesmos cortes pela parcela entre os moradores de **15+** (o agregado agrupa 15–19; a faixa jovem é 15–24). Achado: além de 8.684 setores inteiramente omitidos, o IBGE omite **células isoladas** ("X") em 123.835 setores (27%); o setor fica fora só do indicador que depende da célula omitida, nada é deduzido por diferença. Cobertura: 94,5% dos moradores divulgados (mulheres 15+), 98,4% (idade). Conferências: soma de V01006 = população do Censo nos 3.351 municípios sem setor omitido (abaixo nos demais); sexo e idade somam os moradores nos setores completos e não passam do total nos parciais.
- **Valores observados** em `/perfis`: o menor valor de uma faixa não colide mais com o limite excluído ("10,0%" numa faixa "mais de 10%" vira "10,03%"; até três casas, senão "mais de 10,0%").
- **Mapa por candidatura** (`/mapa/candidaturas`, API `GET /elections/map/candidates`): um mapa por candidatura, todas na mesma escala fixa de % dos válidos (até 10, 20, 35, 50 e acima de 50%; `CANDIDATE_MAP_CUTS`), uma só cor (não confundir com partido), legenda compartilhada; Brasil por UF (Presidência) ou município por UF (todos os cargos). A API exige que toda unidade traga todas as candidaturas (17.907 entradas com zero explícito na fonte) e que a soma seja o total de válidos. Exterior fora (sem polígono).
- **Defeito corrigido** (apontado por Rafael): os formulários de `/participacao` e `/mapa/candidaturas` não navegavam — a ação não estava na lista fechada de `queryHref`. Ver `plan.md` §25.
- **Verificação:** typecheck; 65 testes unitários (contratos: faixa de percentual por contagens, formatos de raio e município; web: todas as ações de consulta); todos os smokes (`smoke:context` com sensibilidade, participação v2 por município e estado civil, demografia, mapa por candidatura e envio sem JavaScript); envio dos formulários conferido no Firefox; axe-core sem violações e sem rolagem horizontal em 39 páginas × 1280/375/320 px. Banco: ver `plan.md` §25.
- **Dica dos mapas** (`MapHover`): nome e valor junto ao cursor, nos dois mapas de `/mapa` e nos mapas por candidatura; com JavaScript substitui o `<title>` nativo (lento e sem estilo), sem JavaScript o `<title>` continua (exceto nos pequenos múltiplos, em que a tabela substitui). Na visão por UF, a dica mostra o nome da UF por extenso.
