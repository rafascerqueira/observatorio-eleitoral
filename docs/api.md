# API de consultas — Presidência, Governador e Senador 2022

As rotas são públicas e de leitura. A consulta prioriza a versão nacional publicada; durante sua preparação, preserva o piloto São Paulo (71072). Turnos permanecem separados. O catálogo informa a cobertura real. Governador e Senador são consultáveis por UF, com uma publicação por UF e cargo; deputados ainda não são cargos consultáveis.

| Rota | Resposta |
| --- | --- |
| `GET /health/live` | `200 { "status": "ok" }`; processo vivo, independente do banco. |
| `GET /health/ready` | `200 { "status": "ok", "database": "ok" }` após `SELECT 1`; `503` se indisponível. |
| `GET /elections/municipalities` | `200` com estado `published` ou `awaiting-import`; `400` para filtro inválido; `503` se banco indisponível. |
| `GET /elections/national` | Consolidado presidencial das 27 UFs e do exterior quando publicado com originais compatíveis, sem paginação. `400` para filtro inválido; `503` para cobertura incompleta, fontes incompatíveis ou totais inconsistentes. |
| `GET /elections/state` | Consolidado de uma UF para o cargo pedido, somado a partir dos municípios reconciliados da publicação. `400` para filtro inválido; `503` para cobertura incompleta ou totais inconsistentes. |
| `GET /elections/exterior` | Consolidado de ZZ e localidades paginadas; `published` ou `awaiting-import`; filtros não reduzem o consolidado de todo o exterior. |
| `GET /elections/exterior/cities/:code/places` | Locais de uma localidade de ZZ; `uf` omitida ou `ZZ`. Outra UF retorna `400`; localidade/ano não publicado retorna `404`. |
| `GET /elections/municipalities/:code/places` | Locais paginados por zona e código; `404` para município/ano/UF não publicado. Inclui identidade `municipality` na resposta. |
| `GET /elections/municipalities/suggest` | Até 8 municípios publicados no recorte (`q` com 2–60 caracteres, sem caracteres de controle, `year`, `office`, `uf`), para sugestões enquanto se digita. Trigramas (`pg_trgm`) sobre o nome normalizado: início do nome, início de palavra, trecho e grafia parecida (`match`). Cargo estadual exige `uf`; sem o índice de trigramas, `503` (nunca varredura). |
| `GET /elections/municipalities/:code/context` | Contexto do município (`uf` obrigatória): Censo 2022 por código IBGE e perfis do TSE como base própria; distribuições com `kind` (universo, amostra, cadastro), `null` para suprimido, `undistributed`/`roundingDifference` quando a fonte não fecha a soma; `turnout` `null` no DF. Com a publicação `2022/context/urban-surroundings`, `urbanSurroundings` traz o entorno dos domicílios do arquivo municipal do IBGE: setores com a pesquisa, setores omitidos e as 35 contagens de moradores na ordem de `URBAN_CHARACTERISTICS` (cada característica soma a base); ausente sem publicação, nunca zero. |
| `GET /elections/municipalities/:code/place-tracts` | Associação local → setor dos locais do município (`uf` obrigatória, uma das 27; `year`), da publicação `2022/places/tracts`; independe de cargo e turno (mesmo prédio). Por local (`zone`, `code` original do dia da eleição): `status` (`TRACT_STATUSES`), coordenada do cadastro do TSE quando única, `sharedCoordinate` (outros locais de nome diferente no mesmo ponto) e, só para `associated`, `tract` com código do setor, situação urbana/rural, pessoas residentes (`V0001`) e mediana do rendimento do responsável com rendimento (`V06006`) com a faixa de `INCOME_BANDS`; omissão do IBGE é `null`. `summary` traz locais e eleitores do cadastro de locais por situação, somando todos os itens. `awaiting-import` sem publicação ou para outro ano; `404` para município fora da associação; `503` quando setor e contexto gravados não conferem. Com a publicação do entorno, cada `tract` traz `urban` (`surveyed` com as 35 contagens, `suppressed` para setor omitido pelo IBGE ou `outside` para setor fora da pesquisa) e a resposta traz `urbanBatchId`; sem ela, `urban` fica ausente. |
| `GET /elections/map/geometry` | Malha do IBGE em TopoJSON: Brasil por UF (sem parâmetro) ou `uf` por município; polígonos com `codarea` (código IBGE). |
| `GET /elections/map/values` | `indicator` (`income-upto-half-mw`, `college-18`, `literacy-15`, os oito `urban-*` do entorno dos domicílios e `abstention`), `round`, `uf`, `office` (só na abstenção; padrão `president`; cargo estadual exige `uf`): numerador, denominador e percentual por município ou UF (soma de numeradores e denominadores). A abstenção usa aptos e abstenções do próprio cargo; turno não realizado responde `round-not-held`. `publications` identifica as publicações lidas (`results`, `context`); `office` aparece na resposta da abstenção. Na abstenção, município sem correspondência no Censo 2022 vem com `id: null` (nas somas da UF e na tabela, sem polígono). Indicadores do Censo valem para qualquer `year`; a abstenção usa os resultados do ano. No entorno (`URBAN_INDICATORS`), numerador = moradores em face com o item e denominador = moradores dos setores com a pesquisa (`V05200`), do arquivo municipal do IBGE. |
| `GET /elections/map/candidates` | Mapa por candidatura: `office`, `round`, `uf` (obrigatória para cargo estadual; sem UF = Brasil por UF). `candidates` em ordem de votos no recorte e, por unidade (`id` = código IBGE do polígono), `valid` e `votes` na mesma ordem. Toda unidade traz todas as candidaturas (zero explícito na fonte) e a soma das candidaturas é o total de válidos; falta ou divergência responde 503. Exterior fora (sem polígono). Escala fixa da interface: `CANDIDATE_MAP_CUTS`. `publications` identifica as publicações lidas. Município sem correspondência no Censo 2022 (criado depois, como Boa Esperança do Norte, MT, em 2026) vem com `id: null`: entra nas somas da UF e na tabela, fora do desenho. |
| `GET /elections/places/groups` | Métrica E pré-calculada: `indicator` (`college`, `education-low`, `women`, `age-16-24`, `age-60-plus`, `income-median`), `office`, `round`, `uf` (obrigatória para cargo estadual). Cinco faixas fixas de locais, iguais em todos os recortes (`method: "bands"`, `lower`/`upper` na unidade do indicador — % dos eleitores aptos do local ou reais; `PLACE_GROUP_CUTS`), com valores observados (`from`/`to`), locais, eleitores, válidos e votos por candidatura; `coverage` informa os votos fora dos grupos. Na renda, `population` (opcional) traz os moradores do Brasil ou da UF nos setores de cada faixa (`income-bands-2022-v1`). `GET /elections/municipalities/:code/context` traz o mesmo bloco do município em `incomeBands`. Em `women`, `age-16-24` e `age-60-plus`, `population` traz os moradores de 15+ por faixa do setor na demografia do Censo (`tract-demography-2022-v1`, mesmo formato). `radius` (`250`, `500`, `1000`; só com `income-median`, senão 400): sensibilidade da associação local → setor (`tract-sensitivity-2022-v1`), com a faixa predominante entre os moradores dos setores do mesmo município a essa distância; `from`/`to` nulos e `association.agreement` (mesma faixa, vizinha, duas ou mais, empate, só pelo raio, nenhuma) em locais e eleitores do território. Grupos de locais, não de pessoas. |
| `GET /elections/turnout/profiles` | Comparecimento e abstenção por perfil (TSE, base própria): `round`, `uf` opcional (sem UF = 26 UFs da fonte), `municipality` (código TSE de 5 dígitos; exige `uf`, 404 se ausente na fonte). Células gênero × faixa etária agregada × escolaridade × estado civil (`maritalStatus`, a partir de `turnout-profiles-2022-v2`) com aptos, comparecimento, abstenção e `optional` (voto facultativo); com UF, `municipalities` lista os municípios da UF; `resultsEligible` para a diferença declarada; `status: "not-in-source"` para o DF. Sem voto por candidatura. |
| `GET /elections/catalog` | Publicações, importações em andamento, cobertura por UF/situação e cargos ainda não importados; derivados em listas próprias (contexto, malhas, setores, perfis, grupos, faixas de renda, demografia, participação, `urbanSurroundingsDatasets`, `tractGeometriesDatasets`, a malha de setores com totais de validade e da conferência com a associação, `tractDisplayDatasets`, o desenho dos setores, e `proposalsDatasets`, as propostas de governo). |
| `GET /elections/proposals` | Busca literal nas propostas de governo da Presidência (`q`, de 3 a 80 caracteres normalizados, sem caracteres de controle; sem `q`, só a cobertura). Normalização `proposals-search-v2`: maiúsculas, acentos, ligaduras e aspas tipográficas ignorados; palavra partida por hífen no fim da linha encontrada inteira ou com o hífen; no meio da linha, o hífen conta. Todas as candidaturas pela ordem do número, com páginas por método (texto do PDF, OCR, sem texto); com `q`, todas as páginas com ocorrência e trechos das cinco primeiras de cada documento, recortados do texto original. Documento repetido aparece só na candidatura com votos (`sameDocumentAs`); inaptas sem votos têm `listing: no-votes`. Busca numa publicação com outra normalização (como a `proposals-2022-v1`) responde 503 até a reimportação; a cobertura continua. |
| `GET /elections/municipalities/:code/tract-map` | Mapa local → setor (`uf` obrigatória; `view` opcional: código IBGE do município, distrito ou subdistrito; `paths=1` inclui os caminhos SVG). Vistas do município, legenda por faixa de renda mediana do setor (com setores omitidos, sem mediana ou sem linha no arquivo de renda contados à parte) e locais na escala do desenho. Vista dividida não tem desenho nem locais: escolhe-se uma das menores. Nenhum voto é atribuído a setores. |
| `GET /elections/imports/:id/coverage` | Cobertura por município: `page`, `pageSize`; status, motivo, registros e conflitos. |
| `GET /elections/imports/:id/report` | Relatório JSON concluído; `404` enquanto não existir ou versão desconhecida. |
| `GET /elections/sources/:sha256/:file` | Original ZIP, JSON, XLSX ou GeoPackage (`.gpkg`), com registro, tamanho e SHA-256 verificados, em fluxo. `404` para arquivo desconhecido; `503` para ausência/corrupção de original registrado. |

## Filtros da consulta

| Parâmetro | Valores | Padrão |
| --- | --- | --- |
| `year` | `2022`, `2026` | `2022` |
| `round` | `1`, `2` | `1` |
| `office` | `president`, `governor`, `senator` | `president` |
| `uf` | Sigla oficial de UF, em maiúsculas | Sem restrição |
| `search` | Nome municipal, até 100 caracteres, sem caracteres de controle | Sem restrição |
| `page` | Inteiro de 1 a 1.000.000 | `1` |
| `pageSize` | Inteiro de 1 a 100 | `25` |
| `sort` | `municipality`, `uf` | `municipality` |
| `direction` | `asc`, `desc` | `asc` |

Parâmetros desconhecidos, repetidos ou fora do domínio são rejeitados. `uf` sem filtro deve ser omitido. Com `office=governor` ou `office=senator`, `uf` é obrigatória (`400` com `fields: ["uf"]`): cargo estadual não tem consulta nacional, e cada UF tem publicação própria. Uma UF sem publicação para o cargo retorna `awaiting-import`. Um turno que não ocorreu na UF (eleição decidida no 1º turno, segundo a apuração, ou cargo de turno único, como Senador) retorna `status: "round-not-held"`, com `items: []`, `total: 0` e o `dataset` da publicação — não é ausência de dados. Nenhum ano ou turno nos filtros confirma disponibilidade ou totalização.

Exemplo sem publicação (como 2026):

```json
{
  "status": "awaiting-import",
  "items": [],
  "pagination": { "page": 1, "pageSize": 25, "total": 0 },
  "filters": {
    "year": "2026",
    "round": "1",
    "office": "president",
    "sort": "municipality",
    "direction": "asc"
  },
  "dataset": null
}
```

`total: 0` descreve apenas itens que correspondem à consulta entre os recortes publicados. Não representa municípios brasileiros, votos ou cobertura nacional. Nenhum resultado deve ser inferido de `dataset: null`.

## Resposta publicada

`status: published` inclui `dataset` com versão, fontes, datas, checksums e escopo. `items` contém municípios, com `totals`, `candidates`, eleição, turno e quantidades de zonas, seções principais e identificadores de local. A paginação é de municípios; candidaturas não são paginadas separadamente.

`dataset.level` diferencia `municipality`, `national`, `exterior` e `state` (publicação de um cargo estadual em uma UF, com `uf` e `rounds`). `rounds` lista os turnos realizados segundo a apuração; ausente nas versões anteriores, não indica turno único. `exclusions`, quando presente, registra outra eleição encontrada nas entradas e excluída de forma declarada (código, descrição, motivo e linhas por entrada), como a suplementar de 2026 em RR. Identidade municipal/UF no dataset fica ausente na publicação nacional; cada item contém sua identidade. A publicação exterior tem `uf: ZZ`, sem identidade municipal. `coverage` informa municípios domésticos esperados/reconciliados/bloqueados e unidades do exterior separadas. As fontes nacionais informam o total lido, incluindo `ZZ`, não apenas as linhas publicadas no banco. `originalUrl` é a rota da API para os bytes que correspondem ao SHA-256; `url` é o endereço do TSE, sujeito a atualização. `sizeBytes` é o tamanho do ZIP. `downloadedAtBasis` explicita data da resposta HTTP ou data recuperada do arquivo local.

`importedAt` registra o cadastro da versão no início da carga reconciliada, não a hora exata da troca pública. O relatório registra também a data da verificação posterior da persistência (`persistedVerification.at`).

`totals` inclui `eligible`, `turnout`, `abstentions`, `valid`, `blank`, `null` e `totalVotes`. Publicações de Governador v2/v3 e de Senador incluem também `annulled`, `annulledSubJudice` e `technicalNull` (este contido em `null`): `totalVotes = valid + blank + null + annulled + annulledSubJudice`. Em versões anteriores esses campos são ausentes ou, em somas que misturam versões, `null` — nunca zero presumido. Itens, locais e consolidados dessas versões trazem `nonValidVotes` (nos locais e zonas, só a partir de Governador v3 e Senador v1; na v2 o campo ficou ausente nos locais, sem significar zero): número, nome, partido (ou `null`), `category` (`annulled`, `annulled-sub-judice`, `technical-null`), `nameSource` (`nominal` ou `section`, este para nulo técnico, sem linha no nominal), `detail` (situação do registro na fonte) e votos, sem percentual sobre válidos. Cada candidatura inclui número, nome de urna, partido, votos e `percentValid`. Percentuais usam o denominador do mesmo turno e recorte; denominador zero produz `null`.

Municípios com seções não instaladas expõem `totals.nonInstalledEligible` e `nonInstalledSections`. Aptos = comparecimento + abstenção + eleitores de seções não instaladas. Esses eleitores não são somados à abstenção. `sections` conta seções principais com registros; o total oficial de principais é `sections + nonInstalledSections`. Campos novos são opcionais para preservar versões anteriores; não interpretar ausência como zero. Nos locais, `nonInstalledEligible` é `null`, sem correspondência por seção inventada.

Buscas municipais são por trecho literal, sem diferenciar maiúsculas e acentos. Campos de ordenação são escolhidos por mapa fixo, filtros usam parâmetros SQL e há ordem estável por código municipal.

Quando um conjunto está publicado, mas o texto ou a página não encontram municípios, o status permanece `published` com `items: []`, metadados do conjunto e o total correspondente. Uma UF ou ano sem publicação retorna `awaiting-import`.

## Consolidado Brasil

`GET /elections/national` aceita somente `year`, `round` e `office` (`president`; cargos estaduais são rejeitados). Não aceita `uf`, `search` nem parâmetros de paginação: esses filtros nunca podem transformar uma página ou um subconjunto em total nacional.

A resposta tem `status`, `filters`, `dataset`, `exteriorDataset`, `includesExterior` e `summary`. Quando publicado, `summary` contém `municipalities`, `exteriorCities`, `sections`, `pollingPlaces`, `nonInstalledSections`, `nonInstalledCases`, `totals` e `candidates`. `municipalities` conta somente unidades domésticas; `exteriorCities` conta localidades de ZZ. `nonInstalledCases` identifica UF, código, nome, eleitores e seções das unidades com registros de não instalação. Todas as somas usam ano, cargo e turno iguais. Percentuais são recalculados sobre o total de votos válidos, nunca pela média dos percentuais locais. Zonas não são somadas como se fossem distintas entre municípios; identificadores de locais são contados com UF/localidade/zona/número, não como prédios únicos.

O número de municípios precisa coincidir com a cobertura integral reconciliada da publicação; inconsistências geram `503`, não um consolidado parcial. Se houver apenas piloto municipal ou o ano ainda não estiver publicado, a resposta é `awaiting-import`, com `summary: null` e `dataset: null`. Ausência de indicadores em qualquer parcela produz indicador agregado nulo, não zero.

Quando ZZ está publicado integralmente, a API exige os mesmos arquivos, entradas e SHA-256 nas duas publicações antes de combiná-las. A procedência doméstica permanece em `dataset`; a exterior aparece em `exteriorDataset`, com `includesExterior: true`. Sem publicação exterior, expõe `includesExterior: false` e a interface avisa sua exclusão; uma publicação exterior incompatível gera `503`, não exclusão silenciosa. Não altera votos nem os arquivos originais. A página inicial usa este endpoint quando não há UF nem busca municipal; trocar o turno mantém o consolidado, enquanto uma UF ou nome pesquisado abre a listagem municipal paginada. Parâmetros de página antigos na URL não afetam o quadro Brasil.

## Consolidado da UF

`GET /elections/state` aceita somente `year`, `round`, `office` e `uf` (obrigatória, uma das 27 UFs; `ZZ` é rejeitada). Para Presidência usa a publicação nacional do ano (`<ano>/president/BR`; o piloto municipal só existe em 2022); para Governador e Senador, a publicação da UF e do cargo (`scope` `<ano>/governor/<UF>`, `<ano>/senator/<UF>`). Em 2026, o Senado tem duas vagas: `dataset.seats` = 2 e votos = 2 × comparecimento; os percentuais continuam sobre os votos válidos. O piloto municipal da Presidência não é tratado como UF inteira e retorna `awaiting-import`. Turno não realizado retorna `round-not-held` com `summary: null`.

A resposta segue o formato do consolidado Brasil (`status`, `filters`, `dataset`, `summary`), com `exteriorCities: 0`. A soma exige que todos os municípios da UF na cobertura da publicação estejam reconciliados e presentes no turno; caso contrário, `503`. Percentuais são recalculados sobre os totais da UF. Resultados de cargos estaduais de UFs diferentes não são comparáveis: as candidaturas diferem.

## Exterior

`GET /elections/exterior` aceita `year`, `round`, `office` (somente `president`), `search`, `page` e `pageSize`, com os mesmos limites gerais; rejeita `uf`, `sort` e `direction`. A busca usa o nome da localidade eleitoral, não país. A resposta contém `status`, `filters`, `dataset`, `summary`, `items` e `pagination`. O consolidado de `summary` considera todas as localidades publicadas de ZZ, independentemente da busca ou página; `items` contém somente as localidades encontradas, ordenadas por nome/código. Um ano sem publicação tem `summary: null`, `dataset: null` e lista vazia.

Os itens usam códigos TSE e `uf: ZZ`; não são municípios brasileiros. A zona é 1 para todo o exterior, não uma zona por país. Localidades sem votos preservam os totais oficiais zero e percentuais nulos, sem linhas de seção inventadas. `/exterior` e `/exterior/:code` são as páginas web; a seleção `uf=ZZ` na página inicial encaminha à consulta exterior.

## Locais de votação

O endpoint de locais retorna `items`, `total`, `page`, `pageSize` e `dataset`. Cada item inclui zona, código, nome/endereço quando consistentes, quantidade e lista de seções (`sectionNumbers`), votos, candidaturas e metadados divergentes. A ordem é fixa por zona e código. A página web de locais usa dez itens por padrão; a API usa 25.

| Filtro de locais | Comportamento |
| --- | --- |
| `zone` | Zona exata, inteiro positivo até 9999. |
| `section` | Seção exata, inteiro positivo até 99999. Pode encontrar locais em zonas diferentes quando `zone` é omitido. |
| `local` | Código exato do local, inteiro positivo até 99999; usar com `zone` para identificar uma unidade. |
| `search` | Trecho literal do nome ou endereço, até 100 caracteres (sem caracteres de controle), sem diferenciar caixa ou acentos. Inclui todas as variantes de metadados. |

Os filtros são combinados com `AND` e aceitam zeros iniciais nos identificadores. `year`, `round`, `office`, `uf`, `page` e `pageSize` seguem a validação compartilhada. `sort` e `direction` não são aceitos nesta rota. Strings vazias de identificadores devem ser omitidas; o formulário web faz essa normalização.

A busca textual usa normalização Unicode do PostgreSQL, remoção de marcas combinantes e comparação literal. `%` e `_` não são curingas. Referência: [funções de texto do PostgreSQL 18](https://www.postgresql.org/docs/18/functions-string.html). A busca por seção usa `EXISTS`, evitando multiplicar locais pelas linhas de votos ou candidaturas.

Exemplo: `/elections/municipalities/71072/places?year=2022&round=1&zone=0001&section=0001`. O filtro de seção **localiza o local**; a resposta continua contendo os votos agregados do local inteiro. Não constitui um endpoint de resultados isolados da seção.

`eligible`, `turnout` e `abstentions` são `null` nos locais. Turno não realizado retorna `404` com `reason: "round-not-held"`. `totalVotes` é a soma dos votos no cargo consultado, não uma estimativa de eleitores inscritos no prédio. `metadataConflict` indica múltiplos nomes/endereços; `metadataVariants` preserva todas as variantes. O campo divergente fica `null`.

As consultas nacionais e estaduais de locais e seções usam UF, localidade, ano, turno e cargo em todas as junções. Para cargos estaduais (`governor`, `senator`), `uf` é obrigatória e a publicação usada é a da UF e do cargo. Se um código vier a existir em mais de uma UF, a rota exige `uf` para desambiguar. A lista municipal não aceita `ZZ`; seus locais são consultados exclusivamente na rota própria do exterior, com publicação e identidade territorial separadas.

Os códigos retornados são strings numéricas de cinco dígitos (`02550`, por exemplo); preserve os zeros ao construir URLs. O catálogo inclui `failureReason` em tentativas interrompidas/rejeitadas. Seus diagnósticos não devem ser confundidos com a cobertura da versão publicada.

O frontend exporta a visão de `/mapa` em `/mapa/dados.csv`, com os mesmos filtros da página (`indicator`, `office`, `uf`, `round`, `series` = `abstention` ou número de urna): UTF-8 com BOM, `;` como separador, uma linha por unidade com códigos TSE e IBGE, numeradores, denominadores, percentuais com vírgula decimal e os IDs das publicações usadas. Filtro inválido ou repetido e candidatura fora do recorte respondem `400`; turno não realizado ou recorte sem publicação, `404`; falha da API, `503`.

O frontend oferece proxy em fluxo em `/arquivos/sources/:sha256/:file` e `/arquivos/imports/:id/report`, evitando expor endereços internos de contêineres. Não permite URLs externas arbitrárias nem caminhos locais fornecidos pelo visitante. Os arquivos servidos são registrados no banco e montados somente para leitura.

Revisão de 18/10/2026: ano/cargo da publicação precisam coincidir com o pedido, inclusive em grupos e mapas. Sem publicação do ano, não há retorno de números de outro ano. Contratos do contexto recusam somas incompatíveis ou diferenças declaradas incorretamente; isso é indisponibilidade técnica/inconsistência, não ausência na fonte. `undistributed` é uma diferença já conferida no original, sem presunção de causa; `roundingDifference` só explica arredondamento auditado da amostra. Novas versões derivadas registram `inputs` (pares de escopo/ID); a API verifica as dependências transitivas registradas e recusa versões desatualizadas com `503`. Ausência de `inputs` no legado não é interpretada como proveniência verificada.
