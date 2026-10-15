# API de consultas — Presidência e Governador 2022

As rotas são públicas e de leitura. A consulta prioriza a versão nacional publicada; durante sua preparação, preserva o piloto São Paulo (71072). Turnos permanecem separados. O catálogo informa a cobertura real. Governador é consultável apenas nas UFs com publicação própria (piloto: SP); senador e deputados ainda não são cargos consultáveis.

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
| `GET /elections/catalog` | Publicações, importações em andamento, cobertura por UF/situação e cargos ainda não importados. |
| `GET /elections/imports/:id/coverage` | Cobertura por município: `page`, `pageSize`; status, motivo, registros e conflitos. |
| `GET /elections/imports/:id/report` | Relatório JSON concluído; `404` enquanto não existir ou versão desconhecida. |
| `GET /elections/sources/:sha256/:file` | ZIP original preservado, com integridade verificada, em fluxo. `404` para arquivo desconhecido; `503` para ausência/corrupção de original registrado. |

## Filtros da consulta

| Parâmetro | Valores | Padrão |
| --- | --- | --- |
| `year` | `2022`, `2026` | `2022` |
| `round` | `1`, `2` | `1` |
| `office` | `president`, `governor` | `president` |
| `uf` | Sigla oficial de UF, em maiúsculas | Sem restrição |
| `search` | Nome municipal, até 100 caracteres | Sem restrição |
| `page` | Inteiro de 1 a 1.000.000 | `1` |
| `pageSize` | Inteiro de 1 a 100 | `25` |
| `sort` | `municipality`, `uf` | `municipality` |
| `direction` | `asc`, `desc` | `asc` |

Parâmetros desconhecidos, repetidos ou fora do domínio são rejeitados. `uf` sem filtro deve ser omitido. Com `office=governor`, `uf` é obrigatória (`400` com `fields: ["uf"]`): cargo estadual não tem consulta nacional, e cada UF tem publicação própria. Uma UF sem publicação para o cargo retorna `awaiting-import`. Nenhum ano ou turno nos filtros confirma disponibilidade ou totalização.

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

`dataset.level` diferencia `municipality`, `national`, `exterior` e `state` (publicação de um cargo estadual em uma UF, com `uf` e `rounds`). `rounds` lista os turnos realizados segundo a apuração; ausente nas versões anteriores, não indica turno único. Identidade municipal/UF no dataset fica ausente na publicação nacional; cada item contém sua identidade. A publicação exterior tem `uf: ZZ`, sem identidade municipal. `coverage` informa municípios domésticos esperados/reconciliados/bloqueados e unidades do exterior separadas. As fontes nacionais informam o total lido, incluindo `ZZ`, não apenas as linhas publicadas no banco. `originalUrl` é a rota da API para os bytes que correspondem ao SHA-256; `url` é o endereço do TSE, sujeito a atualização. `sizeBytes` é o tamanho do ZIP. `downloadedAtBasis` explicita data da resposta HTTP ou data recuperada do arquivo local.

`importedAt` registra o cadastro da versão no início da carga reconciliada, não a hora exata da troca pública. O relatório registra também a data da verificação posterior da persistência (`persistedVerification.at`).

`totals` inclui `eligible`, `turnout`, `abstentions`, `valid`, `blank`, `null` e `totalVotes`. Cada candidatura inclui número, nome de urna, partido, votos e `percentValid`. Percentuais usam o denominador do mesmo turno e recorte; denominador zero produz `null`.

Municípios com seções não instaladas expõem `totals.nonInstalledEligible` e `nonInstalledSections`. Aptos = comparecimento + abstenção + eleitores de seções não instaladas. Esses eleitores não são somados à abstenção. `sections` conta seções principais com registros; o total oficial de principais é `sections + nonInstalledSections`. Campos novos são opcionais para preservar versões anteriores; não interpretar ausência como zero. Nos locais, `nonInstalledEligible` é `null`, sem correspondência por seção inventada.

Buscas municipais são por trecho literal, sem diferenciar maiúsculas e acentos. Campos de ordenação são escolhidos por mapa fixo, filtros usam parâmetros SQL e há ordem estável por código municipal.

Quando um conjunto está publicado, mas o texto ou a página não encontram municípios, o status permanece `published` com `items: []`, metadados do conjunto e o total correspondente. Uma UF ou ano sem publicação retorna `awaiting-import`.

## Consolidado Brasil

`GET /elections/national` aceita somente `year`, `round` e `office` (`president`; cargos estaduais são rejeitados). Não aceita `uf`, `search` nem parâmetros de paginação: esses filtros nunca podem transformar uma página ou um subconjunto em total nacional.

A resposta tem `status`, `filters`, `dataset`, `exteriorDataset`, `includesExterior` e `summary`. Quando publicado, `summary` contém `municipalities`, `exteriorCities`, `sections`, `pollingPlaces`, `nonInstalledSections`, `nonInstalledCases`, `totals` e `candidates`. `municipalities` conta somente unidades domésticas; `exteriorCities` conta localidades de ZZ. `nonInstalledCases` identifica UF, código, nome, eleitores e seções das unidades com registros de não instalação. Todas as somas usam ano, cargo e turno iguais. Percentuais são recalculados sobre o total de votos válidos, nunca pela média dos percentuais locais. Zonas não são somadas como se fossem distintas entre municípios; identificadores de locais são contados com UF/localidade/zona/número, não como prédios únicos.

O número de municípios precisa coincidir com a cobertura integral reconciliada da publicação; inconsistências geram `503`, não um consolidado parcial. Se houver apenas piloto municipal ou o ano ainda não estiver publicado, a resposta é `awaiting-import`, com `summary: null` e `dataset: null`. Ausência de indicadores em qualquer parcela produz indicador agregado nulo, não zero.

Quando ZZ está publicado integralmente, a API exige os mesmos arquivos, entradas e SHA-256 nas duas publicações antes de combiná-las. A procedência doméstica permanece em `dataset`; a exterior aparece em `exteriorDataset`, com `includesExterior: true`. Sem publicação exterior, expõe `includesExterior: false` e a interface avisa sua exclusão; uma publicação exterior incompatível gera `503`, não exclusão silenciosa. Não altera votos nem os arquivos originais. A página inicial usa este endpoint quando não há UF nem busca municipal; trocar o turno mantém o consolidado, enquanto uma UF ou nome pesquisado abre a listagem municipal paginada. Parâmetros de página antigos na URL não afetam o quadro Brasil.

## Consolidado da UF

`GET /elections/state` aceita somente `year`, `round`, `office` e `uf` (obrigatória, uma das 27 UFs; `ZZ` é rejeitada). Para Presidência usa a publicação nacional; para Governador, a publicação da UF (`scope` `2022/governor/<UF>`). O piloto municipal da Presidência não é tratado como UF inteira e retorna `awaiting-import`.

A resposta segue o formato do consolidado Brasil (`status`, `filters`, `dataset`, `summary`), com `exteriorCities: 0`. A soma exige que todos os municípios da UF na cobertura da publicação estejam reconciliados e presentes no turno; caso contrário, `503`. Percentuais são recalculados sobre os totais da UF. Resultados de Governador de UFs diferentes não são comparáveis: as candidaturas diferem.

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
| `search` | Trecho literal do nome ou endereço, até 100 caracteres, sem diferenciar caixa ou acentos. Inclui todas as variantes de metadados. |

Os filtros são combinados com `AND` e aceitam zeros iniciais nos identificadores. `year`, `round`, `office`, `uf`, `page` e `pageSize` seguem a validação compartilhada. `sort` e `direction` não são aceitos nesta rota. Strings vazias de identificadores devem ser omitidas; o formulário web faz essa normalização.

A busca textual usa normalização Unicode do PostgreSQL, remoção de marcas combinantes e comparação literal. `%` e `_` não são curingas. Referência: [funções de texto do PostgreSQL 18](https://www.postgresql.org/docs/18/functions-string.html). A busca por seção usa `EXISTS`, evitando multiplicar locais pelas linhas de votos ou candidaturas.

Exemplo: `/elections/municipalities/71072/places?year=2022&round=1&zone=0001&section=0001`. O filtro de seção **localiza o local**; a resposta continua contendo os votos agregados do local inteiro. Não constitui um endpoint de resultados isolados da seção.

`eligible`, `turnout` e `abstentions` são `null` nos locais. `totalVotes` é a soma dos votos no cargo consultado, não uma estimativa de eleitores inscritos no prédio. `metadataConflict` indica múltiplos nomes/endereços; `metadataVariants` preserva todas as variantes. O campo divergente fica `null`.

As consultas nacionais e estaduais de locais e seções usam UF, localidade, ano, turno e cargo em todas as junções. Para `office=governor`, `uf` é obrigatória e a publicação usada é a da UF. Se um código vier a existir em mais de uma UF, a rota exige `uf` para desambiguar. A lista municipal não aceita `ZZ`; seus locais são consultados exclusivamente na rota própria do exterior, com publicação e identidade territorial separadas.

Os códigos retornados são strings numéricas de cinco dígitos (`02550`, por exemplo); preserve os zeros ao construir URLs. O catálogo inclui `failureReason` em tentativas interrompidas/rejeitadas. Seus diagnósticos não devem ser confundidos com a cobertura da versão publicada.

O frontend oferece proxy em fluxo em `/arquivos/sources/:sha256/:file` e `/arquivos/imports/:id/report`, evitando expor endereços internos de contêineres. Não permite URLs externas arbitrárias nem caminhos locais fornecidos pelo visitante. Os arquivos servidos são registrados no banco e montados somente para leitura.
