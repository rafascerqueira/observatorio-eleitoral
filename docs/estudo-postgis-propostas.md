# PostGIS, contexto territorial e propostas de governo

Pesquisa em **19/10/2026**, a pedido de Rafael, sobre o código do commit `2eef361` e fontes primárias consultadas na mesma data. Este documento registra alternativas para discussão; não autoriza novas cargas, contratação, implantação, escolha de UF piloto ou mudança das regras metodológicas do projeto. Não houve importação, consulta ao banco nem execução da aplicação nesta pesquisa.

## 1. Direção recomendada

Há uma oportunidade de conectar quatro dimensões, preservando o significado de cada uma:

| Dimensão | Evidência disponível ou pesquisada | Pergunta que pode responder |
| --- | --- | --- |
| Condições do território | Censo, infraestrutura, equipamentos e acessibilidade | Que condições foram medidas, onde e em qual período? |
| Escolha eleitoral | Resultados auditados do TSE | Como os votos se distribuíram entre as candidaturas? |
| Oferta programática | Planos oficiais, com página e versão | Que intervenções cada candidatura declarou propor? |
| Prioridades e confiança declaradas | Pesquisas de opinião e processos participativos | O que os entrevistados/participantes disseram considerar importante? |

O PostGIS organiza a dimensão territorial e permite cruzamentos auditáveis. Um catálogo documental organiza as propostas. Pesquisas de opinião oferecem evidência para investigar desejos e confiança. O encontro dessas dimensões permite formular hipóteses e comparar agendas; não demonstra que uma proposta motivou os votos de uma localidade.

Recomendação de sequência: aproveitar os dados atuais em novas explorações; medir uma base espacial persistente; auditar infraestrutura urbana de 2022; preparar um corpus pequeno e completo de planos; incorporar escuta conforme a representatividade efetiva. A disponibilidade de fontes de 2026 não altera o recorte eleitoral implementado de 2022.

## 2. O que o código realmente faz hoje

| Componente | Uso observado | Consequência |
| --- | --- | --- |
| [sectors.ts](../apps/importer/src/sectors.ts), `loadTracts` | Abre GeoPackage somente leitura, confere seu SRID 4674, reúne partes por setor e cria tabelas temporárias com `geometry(MultiPolygon,4674)`, GiST e `ANALYZE`. Associação por `ST_Intersects`, recusando múltiplos setores e município divergente. | A geometria precisa ser carregada novamente em outra sessão. |
| [migration 009](../apps/importer/src/migrations/009-polling-place-tracts.sql) | Persiste latitude/longitude, códigos, status de associação e atributos; não persiste os polígonos. | Temos material para uma visualização de cobertura, mas não para consultar todos os setores espacialmente pela API. |
| [tract-sensitivity.ts](../apps/importer/src/tract-sensitivity.ts) | Recarrega a malha; usa pré-filtro espacial e `ST_DWithin`/`ST_Distance` em `geography` para 250/500/1.000 m. Persiste agregados. | O entorno e a concordância já são calculados, mas os pares e polígonos de cada local não ficam disponíveis para exploração. |
| [maps.ts](../apps/importer/src/maps.ts) e [migration 007](../apps/importer/src/migrations/007-map-geometries.sql) | Guardam 28 TopoJSONs simplificados em JSONB. | Os mapas municipais atuais não dependem de consultas PostGIS. |
| [choropleth.tsx](../apps/web/components/choropleth.tsx), [mapa](../apps/web/app/mapa/page.tsx) e [candidaturas](../apps/web/app/mapa/candidaturas/page.tsx) | SVG no servidor, projeção equivalente, tabelas; indicador censitário × abstenção já aparece lado a lado; mapas de todas as candidaturas já compartilham escala fixa. | Essas funcionalidades estão prontas. Novas comparações devem ampliar a escolha das variáveis e a interação, sem serem apresentadas como trabalho ainda não feito. |
| [DatabaseService](../apps/api/src/database/database.service.ts) | Pool de cinco conexões e limite SQL de dois segundos. | Interseções nacionais arbitrárias e muitos tiles calculados simultaneamente exigem um desenho e medições próprios. |

O arquivo GeoPackage existente mede 1.503.952.896 bytes, conferido no filesystem. Esse tamanho não estima armazenamento de geometrias, índices, representações, WAL e backup no PostgreSQL. Não foi medido ganho de desempenho nesta pesquisa.

O SRID verificado pertence à malha do IBGE. As coordenadas TSE são tratadas como SIRGAS 2000 por premissa já declarada pelo importador; não foi feita verificação independente do datum da fonte TSE. Essa premissa também acompanha uma futura base persistente.

Detalhe metodológico essencial: a sensibilidade inclui **o setor inteiro quando ele toca o raio**, com os moradores daquele setor, dentro do mesmo município. Não mede quantos moradores residem dentro do círculo. Distribuir população pela proporção de área recortada criaria uma estimativa nova, incompatível com apresentar apenas contagens observadas.

## 3. Oportunidades de mapas e consultas

### 3.1. Aproveitar o que já está importado

| Proposta nova | Ganho em relação à interface atual | Papel do PostGIS |
| --- | --- | --- |
| Comparação livre entre indicador e candidatura, acompanhada de dispersão | Hoje a comparação censitária é com abstenção; permitir escolher candidatura, manter o mesmo território selecionado no mapa/gráfico/tabela e conferir contagens. | Não exige PostGIS adicional na escala municipal. |
| Peso em pessoas/votos | Círculos proporcionais a contagens, ao lado do mapa de percentuais, tornam visível o peso populacional/eleitoral que a área territorial não representa. | Pode reutilizar geometrias atuais; ponto representativo deve ser documentado. |
| Camada de qualidade geográfica | Mostrar coordenadas ausentes/conflitantes, realocação, associação ambígua, município divergente e pontos compartilhados, com cobertura por território. Locais sem ponto entram no painel/tabela, sem coordenada inventada. | Pontos já persistidos permitem um começo; polígonos persistentes melhoram a inspeção. |
| Explicação visual da sensibilidade | No detalhe de um local, desenhar o ponto, setor do ponto, raios e setores incluídos; explicar por que uma faixa muda. | Requer reter geometrias e calcular/publicar o detalhe versionado; os agregados atuais não bastam para reconstituir tudo pela API. |
| Seleção de um conjunto de territórios completos | Comparar grupos escolhidos pelo visitante e exportar códigos, contagens e denominadores. | Município pode ser selecionado por código; seleção espacial de setores se beneficia da base permanente. |

Para comparações, manter limites de classe iguais quando a pergunta exige comparação de cores. Os quintis atuais dependem do recorte e não são uma escala universal. Uma versão bivariada com legenda 3×3 é possível, mas requer mais esforço de interpretação e validação visual; mapa + dispersão + tabela deve vir primeiro. Não calcular média simples de percentuais nem escolher apenas uma candidatura para caracterizar um território.

### 3.2. Exploração intramunicipal

Um mapa com **setores censitários e pontos dos locais de votação** é a expansão espacial mais relevante. A cor do setor representa exclusivamente o indicador censitário; o ponto mostra os resultados do local. A associação entre ambos e sua cobertura ficam consultáveis. Pintar o setor com os votos de um local daria a impressão incorreta de que se conhece a votação dos moradores daquele setor.

Visões de infraestrutura e serviços podem acrescentar estabelecimentos e áreas atendidas/mapeadas. Distância em linha reta, tempo de viagem, capacidade e atendimento efetivo são variáveis diferentes. Um raio a partir do local de votação não mede o deslocamento da casa dos eleitores até um serviço.

### 3.3. Casos reais e o que aproveitar

- O [ONS Census Maps e seu código](https://github.com/ONSdigital/dp-census-atlas) demonstram navegação por tema e escala, com separação de geometria e valores e carregamento de blocos. O [perfil de área personalizado do ONS](https://digitalblog.ons.gov.uk/2023/01/17/custom-profiles/) agrega unidades selecionadas; o desenho por polígono/raio usa centroides populacionais para decidir quais unidades inteiras entram. A lição aplicável é tornar a seleção reproduzível e explicar sua regra, preservando as contagens das unidades.
- O [Ipea Acesso a Oportunidades](https://ipea.github.io/aopdata/articles/aopdata.html) e seus [mapas de acessibilidade](https://ipeagit.github.io/aopdata/articles/access_maps.html) permitem explorar oportunidades alcançáveis por modo de transporte. A experiência inspira uma futura camada de acesso a serviços, respeitando os anos e a cobertura da fonte.
- A [nota técnica MapBiomas/Alana sobre vegetação nas escolas](https://brasil.mapbiomas.org/wp-content/uploads/sites/4/2024/11/Nota_Tecnica_Vegetacao_Escolas-25-11-2024.pdf) é um exemplo brasileiro de equipamentos relacionados ao contexto espacial. O retrato de 2024 não deve ser apresentado como observação de 2022.
- O [repositório eleitoral do New York Times](https://github.com/nytimes/presidential-precinct-map-2024) documenta cobertura e origem das fronteiras, inclusive fronteiras produzidas por estimativa. Podemos aproveitar a transparência do inventário; não transpor essa reconstrução para o Brasil, onde a seção eleitoral não delimita residência dos eleitores.

Esses casos orientam o desenho; não demonstram, por si, necessidade de migrar todos os mapas atuais para tiles ou PostGIS.

## 4. Como ampliar PostGIS sem aumentar a complexidade sem medida

Proposta de arquitetura, ainda não implementada:

1. **Catálogo espacial imutável por fonte e versão.** Guardar malha uma vez por hash do original, SRID, ano territorial e código IBGE; derivados referenciam essa versão. Evitar duplicar toda a geometria em cada publicação de renda, demografia ou sensibilidade. Os originais continuam preservados.
2. **Separar cálculo e desenho.** Geometria exata para associação/distância; representações simplificadas para cada escala de exibição. Os valores continuam ligados por chave, independentemente da simplificação visual.
3. **Índices e partes somente com benefício medido.** GiST e filtros por município/UF; avaliar [ST_Subdivide](https://postgis.net/docs/manual-3.6/ST_Subdivide.html) para polígonos complexos. Partes de um mesmo setor não podem multiplicar votos ou moradores na junção. A documentação também alerta para diferenças ao converter uma geometria subdividida em `geography`.
4. **Auditar validade.** Acrescentar [ST_IsValid](https://postgis.net/docs/manual-3.6/ST_IsValid.html) e testes pertinentes à cobertura. Não localizamos essa validação no carregador atual; isso não prova que a fonte contenha polígonos inválidos. Geometria inválida/ambígua exige registro e bloqueio do uso afetado, sem reparo silencioso.
5. **Simplificação conjunta de fronteiras.** [ST_CoverageSimplify](https://postgis.net/docs/manual-3.6/ST_CoverageSimplify.html) preserva uma cobertura válida, ao contrário de simplificar cada polígono isoladamente. Requer GEOS ≥3.12 e auditoria prévia da cobertura; conferir o runtime instalado antes de escolher a função.
6. **Consultar somente a janela visível.** Limitar bbox, zoom, número de feições e campos retornados. Se a escala setorial demonstrar necessidade, [ST_AsMVT](https://postgis.net/docs/manual-3.6/ST_AsMVT.html), `ST_AsMVTGeom` e `ST_TileEnvelope` produzem tiles vetoriais. A API Nest existente pode ser a primeira candidata; não introduzir outro serviço antes de medir. Manter tabela e visão simples em SVG.
7. **Pré-calcular o que for pesado.** Chaves de cache incluem versões da malha e dos resultados, ano, turno, cargo, UF e parâmetros. Tiles limitados/geometria estável podem ser preparados antecipadamente. Não fazer a navegação competir com importações e consultas de leitura no pool pequeno sem ensaio de concorrência.

Distâncias em metros devem respeitar o modelo geodésico ou projeção adequada. SIRGAS 2000/4674 tem coordenadas angulares; não aplicar um buffer numérico em graus como se fossem metros. Web Mercator serve ao desenho dos tiles, sem se tornar automaticamente o modelo para medições territoriais.

O ensaio inicial deve medir tempo de carga/reuso, tamanho de tabela+índice, espaço transitório/WAL, backup e restauração, tempo das consultas frias/quentes e concorrência. Um município ou UF de teste deve ser acordado com Rafael antes da carga. Não há estimativa de armazenamento ou promessa de aceleração nacional sem esse ensaio.

## 5. Novas fontes socioeconômicas: prioridades e limites

| Prioridade | Fonte e informação | Escala/tempo e cobertura | Lacuna antes de incorporar |
| --- | --- | --- | --- |
| Alta | [IBGE — características urbanísticas do entorno](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/tipologias-do-territorio/24702-caracteristicas-urbanisticas-do-entorno-dos-domicilios.html): calçadas, rampas, obstáculos, pavimentação, drenagem, arborização, iluminação, ônibus e infraestrutura cicloviária | Referência Censo 2022, setores selecionados com características urbanas; existem [arquivos percentuais CSV/GPKG](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Dados_percentuais_das_Caracteristicas_urbanisticas_do_entorno_dos_domicilios/). | Auditar dicionário, contagens, denominadores, cobertura e correspondência com a malha preservada. Fora da pesquisa não significa ausência da infraestrutura. Preferir atributos com a geometria existente a importar outra cópia integral. |
| Média | [CNES — base por competência](https://wiki.saude.gov.br/cnes/index.php/Categoria%3AConsumo_de_informa%C3%A7%C3%B5es_da_Base_Nacional_do_CNES_via_webservice_e_Download_da_Base_de_Dados): estabelecimentos, serviços e estrutura registrada | Download histórico documentado desde junho de 2017; escolher competência compatível com a pergunta de 2022. | Conferir [georreferenciamento](https://wiki.datasus.gov.br/cnes/index.php/Como_informar_a_localiza%C3%A7%C3%A3o_geogr%C3%A1fica_do_estabelecimento), pontos repetidos/padrão, validade temporal e duplicatas. Cadastro não mede atendimento, fila ou qualidade. |
| Média | [Inep — Censo Escolar](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar) e [Catálogo de Escolas](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/inep-data/catalogo-de-escolas) | Microdados de 2022 existem; catálogo exportável atualizado anualmente. | Não confirmado arquivo de coordenadas históricas de 2022. Não usar ponto atual como localização histórica sem auditoria de fechamento/mudança. Indicadores municipais podem preceder o mapa pontual. |
| Posterior | [Ipea Acesso a Oportunidades](https://ipea.github.io/aopdata/articles/aopdata.html): empregos, saúde, educação e outros destinos alcançáveis | Dados 2017–2019 nas vinte maiores cidades, grade H3 e população de referência 2010; cobertura de transporte coletivo mais restrita. | Exibir como camada histórica própria. Não chamar de acesso em 2022. Recalcular rede/transporte nacionalmente seria uma frente de custo muito maior. |
| Posterior | [IBGE/Cemaden — população em áreas de risco](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/tipologias-do-territorio/21538-populacao-em-areas-de-risco-no-brasil) e [produtos SGB](https://www.sgb.gov.br/web/guest/nossos-produtos) | IBGE/Cemaden usa população de 2010 e 872 municípios; cartas SGB variam em escala/data/cobertura. | Distinguir suscetibilidade, perigo, risco e ocorrência. Interseção parcial não fornece população exposta observada. Começar por áreas mapeadas e equipamentos nelas contidos. |

A escolha mais coerente como próxima fonte é **entorno urbano de 2022**: acrescenta dimensões concretas da vida cotidiana, próximas do ano eleitoral, sem exigir uma infraestrutura nacional de roteamento. A existência dos arquivos foi verificada; seus dados e dicionários não foram importados nem auditados integralmente.

## 6. Propostas de governo: obtenção e comparação

### 6.1. Disponibilidade verificada

O [catálogo Candidatos 2022 do TSE](https://dadosabertos.tse.jus.br/dataset/candidatos-2022) lista recursos de propostas BR e por UF e declara licença Creative Commons Attribution. O [recurso BR](https://dadosabertos.tse.jus.br/dataset/candidatos-2022/resource/4280f82b-20a9-46dd-99d9-02b621425f26) aponta para [ZIP de PDFs](https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_2022_BR.zip); há também [recurso SP](https://dadosabertos.tse.jus.br/dataset/candidatos-2022/resource/3d8166ad-42ed-4133-b531-c51707e2c428). Conferidos os links declarados, sem baixar/inspecionar o corpus ZIP. Não foi localizado recurso “DF — Proposta de governo” no catálogo consultado; isso não demonstra inexistência dos planos. A cobertura exige inventário por candidatura e possível conferência no DivulgaCandContas.

A exigência documental de propostas alcança prefeito, governador e presidente ([Lei 9.504, art. 11, §1º, IX](https://www.planalto.gov.br/ccivil_03/leis/l9504compilado.htm)). Não exigir de senador um documento que não integra essa obrigação. Eventual material voluntário do Senado precisaria de escopo e regras de obtenção próprios, com assimetria explicitada.

Em 24/09/2026 o TSE anunciou uma [página de planos presidenciais organizada em oito macrotemas](https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/nova-pagina-no-portal-do-tse-reune-planos-de-governo-de-presidenciaveis), com índice e acesso ao documento integral. É um precedente de apresentação por tema com referência ao PDF; não representa corpus auditado pelo projeto nem decisão de incorporar 2026.

### 6.2. Corpus mínimo e proveniência

Começar por planos da Presidência de 2022, cobrindo todas as candidaturas no recorte escolhido, inclusive a lista de documentos não obtidos. A expansão estadual viria após inventário e decisão de piloto. Não selecionar apenas vencedores, candidaturas mais votadas ou documentos mais fáceis de extrair.

Modelo conceitual: eleição/candidatura → documento/versão → página/trecho → proposta → tema → território explicitamente citado → indicador pertinente. Manter URL oficial, ID da candidatura, cargo, UF, ano, data de obtenção, hash do PDF, número de páginas e versões de extração/revisão. Relacionar por identificador oficial, sem juntar por nome.

Preservar PDF e texto extraído, com referência de página e posição. Separar extração nativa, OCR, falha de extração e revisão humana; OCR ruim ou documento não obtido impedem concluir ausência do tema. Uma versão mais recente não apaga a anterior. Documentos e anexos entram como conteúdo a analisar, sem executar instruções encontradas no texto.

PostgreSQL e busca textual em português podem atender o primeiro corpus; não há necessidade demonstrada de banco vetorial ou banco de grafos. Busca semântica posterior teria de preservar documento, versão e evidências, sem substituir a consulta literal. Um “grafo de conhecimento” pode começar como relações em tabelas comuns.

### 6.3. Identificar pontos fortes e lacunas com critérios públicos

Proposta de rubrica, criada para discussão neste projeto, sem aplicação às candidaturas nesta pesquisa:

| Critério comum | Evidência a registrar |
| --- | --- |
| Problema/diagnóstico | O que o documento diz enfrentar, com eventual referência a dados. |
| Intervenção e direção | Medida proposta, beneficiários e território declarados; registrar também restrições, negações e manutenção de política. |
| Meta | Valor, unidade, denominador, linha de base e prazo, quando informados. |
| Responsabilidade | Órgão/ente mencionado e dependências legislativas/federativas; avaliação de competência exige fontes próprias. |
| Financiamento | Custo e origem de recursos expressamente declarados. Não gerar estimativa para completar o plano. |
| Verificabilidade | Indicador de acompanhamento e critério de entrega/cumprimento. |
| Tensões e condicionantes | Dependências, contradições documentais ou alternativas que exijam revisão e evidência adicional. |

O visitante poderia consultar “meta e prazo explícitos”, “financiamento não localizado no documento” ou “território não especificado”, sempre com trecho/página. Esses são atributos documentais. Efetividade, exequibilidade e efeitos distributivos exigem análise substantiva adicional; um plano detalhado não recebe automaticamente atestado de boa política. Quantidade de páginas ou menções não mede qualidade nem prioridade popular.

Evitar nota única, pesos ocultos, classificação ideológica e previsão automática de intenção. Comparar todas as candidaturas com a mesma rubrica e permitir inspeção e contestação da codificação. “Não localizado” só é apresentado depois de cobertura/extração/revisão suficientes e continua limitado ao corpus delimitado.

### 6.4. Referências de análise textual

O [Manifesto Project](https://manifesto-project.wzb.eu/information/documents/handbooks) documenta a decomposição de programas em unidades de afirmação e codificação. Isso inspira unidade verificável, treinamento e versionamento de regras. Não implica adotar seus índices ideológicos nem presumir que já contenha nosso corpus brasileiro.

O [VCGE oficial](https://www.gov.br/governodigital/pt-br/infraestrutura-nacional-de-dados/registros-de-referencia/vocabulario-controlado-do-governo-eletronico), versão 2.1.0, oferece vocabulário temático em português e exportações estruturadas. Pode servir de ponto de partida, com extensões transparentes para a realidade brasileira e temas ausentes/ambíguos, sem forçar todo trecho a uma classificação.

Há pesquisa diretamente relacionada ao Brasil: [Ferreira et al., Semantic Clustering of Civic Proposals, versão de 06/10/2025](https://arxiv.org/html/2509.21292v2), aplica BERTopic, sementes do VCGE e modelos de linguagem a propostas do Brasil Participativo. É uma referência técnica para organizar contribuições. O estudo usa rótulos produzidos por modelo como referência de avaliação; isso limita a independência dessa avaliação. Para o Observatório, um conjunto revisado por humanos deve testar extração, tema, negação, meta e evidência de página antes de publicar análises automáticas. O estudo não demonstra desejos de toda a população nem causalidade eleitoral.

IA pode ajudar a localizar trechos, sugerir temas e normalizar campos. Respostas precisam citar evidência recuperada e admitir falta de evidência. Uma segunda IA concordar com a primeira não substitui avaliação independente.

## 7. O que permite estudar anseios e confiança

O [ESEB 2022, CESOP/Unicamp](https://www.cesop.unicamp.br/democracia/survey/detalhes/id/304/titulo/Estudo%20Eleitoral%20Brasileiro%20-%20ESEB%202022/) reúne avaliação da democracia, escolha do voto, atitudes e outros temas. A [metodologia](https://www.cesop.unicamp.br/vw/1I8T2Sa4wNQ_MDA_72c84_/Met_04810.pdf) declara 2.001 entrevistas entre novembro/dezembro, representatividade nacional e das cinco regiões e uso de pesos; a seleção final usa cotas. Não é uma pesquisa representativa de cada município ou setor. O [catálogo de microdados](https://www.cesop.unicamp.br/por/banco_de_dados/v/4680) exige cadastro para acesso.

**Inconsistência externa identificada:** a [ficha técnica ligada ao catálogo](https://www.cesop.unicamp.br/vw/1JcLyRq4wNQ_MDA_518ae_) informa 1.806 entrevistas e outubro de 2022, divergindo da apresentação/metodologia da onda. Antes de incorporar, confirmar a identidade e a versão dos arquivos, sem escolher silenciosamente uma contagem ou presumir a causa. Nenhum microdado foi obtido nesta pesquisa.

O [AmericasBarometer/LAPOP](https://www.vanderbilt.edu/cgd/americasbarometer/) é outra fonte para prioridades e confiança. O [catálogo](https://www.vanderbilt.edu/center-for-global-democracy/data/directory/) tem Brasil 2023 e [questionário](https://www.vanderbilt.edu/center-for-global-democracy/data/?lp_download=2441), incluindo pergunta sobre o problema mais grave do país. Conferir desenho amostral, pesos, módulos, licença e acesso por variável. Não espacializar respostas nacionais como opiniões municipais. Indicadores produzidos com amostras serão identificados como estimativas da pesquisa, com incerteza e domínio apropriados, nunca como números do TSE/Censo.

O [Brasil Participativo/PPA](https://www.gov.br/pt-br/servicos/fazer-propostas-ao-governo-ppa) e seu [relatório de participação de 2023](https://www.gov.br/planejamento/pt-br/assuntos/planejamento/plano-plurianual/arquivos/relatorio-ppa-participativo/1_relatorio-de-participacao_2023_10_23-completo_web-1.pdf) registram prioridades expressas por participantes. É evidência de participação efetiva daquele processo, com seleção dos participantes e mobilização próprias; seus apoios não estimam automaticamente a opinião de todo o país. Questionário próprio aberto teria a mesma limitação, além de exigir desenho de consentimento e proteção dos participantes.

Dados de 2023 ajudam a estudar aquele período; não reconstituem automaticamente o que se desejava antes do voto de 2022. A ligação entre voto declarado e opinião deve vir de uma pesquisa que tenha feito ambas as perguntas ao mesmo respondente, respeitando confidencialidade e amostragem; isso ainda não prova que a opinião causou a escolha.

## 8. Exemplo de experiência integrada, sem números inventados

O visitante escolhe **acessibilidade urbana** e uma UF/município. A interface apresenta:

1. Indicadores observados de calçada/rampa/obstáculos no universo efetivamente pesquisado, com data, cobertura, numerador e denominador.
2. Distribuição dos votos da eleição selecionada, na escala eleitoral válida; pontos dos locais ficam identificados como locais de votação.
3. Propostas de todas as candidaturas do recorte sobre o tema, com trechos, páginas, metas/prazos declarados e informações não localizadas.
4. Prioridades expressas em pesquisa/participação, apenas no domínio e período disponíveis; se não houver evidência local, mostrar essa ausência.

Uma pergunta respondível é “quais candidaturas apresentaram medidas verificáveis para uma condição documentada neste território?”. Outra é “o que a pesquisa representativa disponível registra como prioridade?”. A interface não converterá votos da candidatura em apoios a cada proposta nem chamará déficit de infraestrutura de desejo manifestado.

A pertinência temática e o território prometido são campos distintos: uma proposta nacional pode interessar ao município sem prometer uma intervenção específica ali. Só vincular como alvo territorial o que estiver expresso no documento; uma correspondência sugerida pelo tema precisa ser identificada como interpretação revisável.

Uma etapa futura pode acompanhar compromissos após a eleição, ligando proposta → instrumento/ação → entrega → indicador. PPA, orçamento e relatório de gestão são evidências possíveis; correspondência de tema, autorização de gasto ou melhora de indicador não comprovam isoladamente cumprimento nem efeito causal. Isso exige regras e pesquisa próprias.

## 9. Marcos propostos, critérios de aceite e efeitos a controlar

Não são tarefas já autorizadas de implementação; a sequência serve à próxima decisão com Rafael.

| Marco | Entrega revisável | Verificações principais e efeitos colaterais |
| --- | --- | --- |
| A. Exploração dos dados atuais | Escolha de candidatura × indicador, dispersão/tabela e cobertura geográfica, distinguindo o que já existe | Conferir totais contra publicações; mesma seleção entre visões; nulo/denominador; todas as candidaturas; zero alteração nas publicações; custo de renderização e acessibilidade. |
| B. Base espacial em piloto acordado | Geometrias exatas versionadas, representação visual e mapa local → setor | SRID, validade, fronteiras/ilhas, pontos na borda, ambiguidades, deduplicação de partes; comparação por chave do local, status e setor associado com a publicação atual; concorrência/timeouts; tabela+índices+WAL+backup/restore. Não alterar versões históricas. |
| C. Entorno urbano 2022 | Poucos indicadores escolhidos, dicionário, relatório de cobertura e comparação com fonte | Universo urbano, chaves setoriais, denominadores e agregações; fora da cobertura ≠ zero; compatibilidade da malha; disco e aumento do tempo de carga. |
| D. Planos da Presidência 2022 | Inventário completo do recorte, PDFs/textos versionados, comparação por tema/rubrica | Candidatura correta; ausência versus erro de acesso/OCR; páginas e números; negação; anexos/versões/duplicatas; revisão igual entre candidaturas; nenhuma afirmação sem evidência. Avaliar trabalho humano e custo de extração. |
| E. Prioridades declaradas | Uma pesquisa documentada, com acesso autorizado e método esclarecido | Resolver divergência ESEB antes de uso; pesos/amostragem, não resposta e domínio publicável; período; ausência de reidentificação; não apresentar consulta aberta como pesquisa representativa. |

Antes de aumentar o recorte, revisar o resultado do piloto, os custos de armazenamento e o trabalho de revisão documental. Nenhuma biblioteca nova foi selecionada nem serviço foi contratado. Hospedagem continua sendo uma decisão separada e posterior; esta pesquisa não realizou implantação.

## 10. Reflexão sobre o “cérebro político brasileiro”

A ideia pode ganhar substância como uma memória pública pesquisável de **condições territoriais, escolhas eleitorais, prioridades declaradas e compromissos políticos**. Seu valor estaria em tornar explícitas as relações e as lacunas de evidência, permitindo perguntas novas e revisão das respostas.

Há três conceitos a preservar: condição observada por indicador, prioridade declarada por pessoas e solução proposta por candidatura. Eles podem convergir ou divergir. Uma condição material não determina qual solução seus moradores preferem; o voto em uma candidatura não significa adesão a cada item de seu programa. Confiança também precisa ser medida pela pergunta e instituição correspondentes, sem ser calculada a partir da votação.

Uma formulação de produto para discussão: **“Compreender como as condições de vida, as prioridades expressas e as propostas políticas se encontram nos territórios brasileiros.”** Isso amplia o projeto por evidências rastreáveis e admite diferentes interpretações, conforme os princípios de neutralidade já acordados.
