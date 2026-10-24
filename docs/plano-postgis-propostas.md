# Plano de melhorias — território, PostGIS e propostas de governo

Registro de **19/10/2026**, preparado por Claude Code a pedido de Rafael a partir do [estudo de PostGIS, contexto territorial e propostas](estudo-postgis-propostas.md). Base: commit `2eef361`; o estudo e o §31 do `plan.md` ainda estão sem commit. É uma proposta para decisão: **nada foi implementado, importado ou publicado**. Não autoriza novas cargas, contratação, implantação, piloto ou mudança metodológica; cada fase começa só com decisão de Rafael (seção 10).

## 1. Conferências feitas para este plano

Somente leitura, em 19/10/2026:

- **Código.** `sectors.ts`, `tract-sensitivity.ts`, `maps.ts`, `publication.ts`, migrations 007/009/014, `elections.controller.ts`, `dependencies.ts`, `database.service.ts`, contratos de mapas e setores, `choropleth.tsx`, `/mapa`, `/mapa/candidaturas`, `/municipios/[code]`, `/metodologia` e `/fontes`. Confirmados os pontos do estudo: nenhuma validação `ST_IsValid`; malha só em tabela temporária, recarregada pela associação e pela sensibilidade; mapas em TopoJSON JSONB desenhados em SVG; pool de cinco conexões com 2 s por consulta (`database.service.ts:11`).
- **Banco** (`default_transaction_read_only=on`). PostGIS 3.6.4, GEOS 3.14.1, PROJ 9.8.1 e protobuf. Disponíveis `ST_CoverageInvalidEdges`, `ST_CoverageSimplify`, `ST_CoverageUnion`, `ST_CoverageClean`, `ST_IsValidReason`, `ST_PointOnSurface`, `ST_Subdivide`, `ST_AsMVT`, `ST_AsMVTGeom` e `ST_TileEnvelope`: nenhuma troca de imagem é necessária. Banco com 10 GB (votos por seção: 8,4 GB; `polling_place_tracts`: 148 MB; `census_tract_context`: 68 MB) e 66 publicações ativas. Parâmetros padrão da imagem: `shared_buffers` 128 MB, `work_mem` 4 MB, `maintenance_work_mem` 64 MB, `max_wal_size` 1 GB. Disco com 66 GB livres. Extensão `unaccent` disponível e não instalada; configuração de busca `portuguese` presente.
- **Associação publicada** (`polling-place-tracts-2022-v3`). 93.561 locais: associados 83.453 (144.919.754 eleitores; 2.191 com coordenada compartilhada), sem coordenada 6.029, realocados 2.938, setor de outro município 1.137, fora dos setores 4, ambíguos e conflitantes 0.
- **Escala do desenho intramunicipal** (faixas de renda v2). 458.772 setores; mediana de 30 por município e percentil 99 de 834. Máximos: São Paulo 26.889, Rio de Janeiro 13.474, Brasília 5.342, Belo Horizonte 5.137, Salvador 4.504 e Fortaleza 4.306. Locais de votação: 2.049 em São Paulo e 1.402 no Rio.
- **IBGE (FTP).** Além da pasta percentual citada no estudo (`br_setores_entorno_cd2022(in).csv`, 69 MB, e `.gpkg`, 346 MB, de 12/12/2025), existe `Agregados_por_Setores_Censitarios_Caracteristicas_urbanisticas_do_entorno_dos_domicilios/` (17/04/2025), com **contagens** por setor (domicílios 11 MB, moradores 12 MB, faces 9,8 MB), por município (cerca de 0,4 MB cada) e por bairro, distrito e subdistrito. O dicionário (`dicionarios_de_dados_entorno.zip`, 27.093 bytes, SHA-256 `eda4e2c9968e753fa2c158380ae537c284ccbddde5b74a6d5fec0b3c2250d1b4`) foi lido em diretório temporário fora do repositório; não foi preservado nem importado.
- **TSE** (somente cabeçalhos HTTP, sem download). `proposta_governo_2022_BR.zip`: 15.771.758 bytes, `Last-Modified` 21/07/2024. `consulta_cand_2022.zip`: 4.390.989 bytes, `Last-Modified` 18/10/2026; foi regerado recentemente, e a data de geração precisa ser registrada na carga.
- **Ferramentas locais.** `pdftotext` e `pdfinfo` (poppler) instalados; `tesseract`, GDAL/`ogr2ogr`, `tippecanoe` e `mapshaper` ausentes.

Não houve escrita no banco, importação, início de API/web nem execução de testes.

## 2. Ajustes ao estudo

O estudo é a base deste plano. As conferências acima levaram aos ajustes a seguir.

1. **Há ganho sem nova carga.** Coordenadas, situação da associação, setor e contexto dos setores associados estão no banco, mas só a cobertura por UF chega à interface (metadados exibidos em `/fontes`); nenhuma rota expõe os dados por local: `polling_place_tracts` e `census_tract_context` não aparecem em `apps/api`, `apps/web` nem nos contratos. O cartão do local não mostra nada disso, e dois textos ficaram desatualizados: "Não há associação socioeconômica validada" (`apps/web/app/municipios/[code]/page.tsx:86`) e "O método geográfico ainda não foi definido" (`apps/web/app/metodologia/page.tsx:17`; a seção `#perfis` da mesma página já descreve o método).
2. **Entorno urbano pelas contagens, não pelos percentuais.** Percentuais por setor não podem ser somados para município, UF ou Brasil. Os agregados trazem numerador e denominador por setor: `V05000` (domicílios particulares permanentes ocupados em setor escolhido para o entorno) e `V05200` (seus moradores), com cada característica em SIM, NÃO e NÃO DECLARADO; circulação da via e arborização têm categorias próprias, com "saltado". O arquivo municipal permite conferência bloqueante, como nas faixas de renda. Evita também a cópia de 346 MB de geometria do GeoPackage percentual.
3. **O entorno não depende da base espacial.** Painel do município, mapa municipal e cartão do local usam só a chave `CD_SETOR`. Por isso a fase C pode vir antes da B.
4. **Medir a base espacial sem persistir.** A malha nacional já é carregada em tabela temporária a cada importação de setores ou de sensibilidade. O ensaio usa o mesmo carregador, mede tamanho, validade e simplificação, e não grava nada; por isso não exige escolher UF, só autorizar a execução. A escolha entre persistir o Brasil ou uma UF piloto fica para depois, com os números medidos.
5. **Não migrar agora os importadores publicados.** Ler a geometria de um catálogo exige nova versão de `sectors.ts`: a identidade muda e a API (`checkDependencies`) passa a recusar a métrica E e a sensibilidade até a republicação em cascata dos derivados. O catálogo, se aprovado, atende primeiro às funcionalidades novas e prova equivalência por comparação somente de leitura com a associação publicada. A migração dos importadores fica para quando houver outro motivo de nova versão.
6. **O desenho intramunicipal tem pior caso conhecido.** São Paulo tem 26.889 setores. O tamanho do SVG precisa ser medido em São Paulo, no Rio e num município mediano; se exceder o orçamento, recortar por distrito do IBGE (código contido no próprio `CD_SETOR`) antes de considerar tiles, que exigiriam JavaScript e biblioteca nova.
7. **Nas propostas, o gargalo é humano, não de armazenamento.** O ZIP da Presidência tem 15,8 MB. A primeira entrega publicável é a busca literal com página, igual para todas as candidaturas; a rubrica depende de revisão humana definida.

## 3. Sequência proposta

As letras seguem as do estudo; a ordem muda. A sequência entrega primeiro o que usa dados já auditados (condições do território e voto), depois a oferta programática; a escuta fica por último.

| Ordem | Fase | Entrega | Natureza do trabalho | Depende de |
| --- | --- | --- | --- | --- |
| 1 | A — Explorar o publicado | Textos corrigidos; setor e situação da associação por local e por município; série escolhível e dispersão em `/mapa` | Só código | — |
| 2 | C — Entorno urbano 2022 | Indicadores do entorno por município e setor, com cobertura da pesquisa | Fonte nova pequena (cerca de 34 MB) e código | A1, para o cartão do local |
| 3 | B — Base espacial medida | Ensaio sem persistência; depois catálogo, representação e mapa local → setor | Execução local pesada; depois migration | B2 só após B1; B3 usa C se publicada |
| Paralela | D — Propostas de governo | Inventário; busca literal com página; rubrica com adjudicação humana | Download pequeno (cerca de 20 MB), código e revisão humana | Codificação e adjudicação da D3 por contribuidores do projeto |
| Última | E — Prioridades declaradas | Pesquisa documental | Leitura | — |

## 4. Fase A — explorar o que já está publicado

Sem importação nem publicação nova.

### A0. Textos desatualizados

- `apps/web/app/municipios/[code]/page.tsx:86`: substituir "Não há associação socioeconômica validada" por referência à associação publicada e a seus limites (ou ao bloco da A1).
- `apps/web/app/metodologia/page.tsx:17`: retirar "Uma futura associação…" e "O método geográfico ainda não foi definido", remetendo a `#perfis`.
- Procurar outros textos superados ("ainda não", "futura", "será") nas páginas e no README.

### A1. Setor e associação de cada local

- **API:** rota própria (ex.: `GET /elections/municipalities/:code/place-tracts?uf=`), ligada à publicação `2022/places/tracts` e conferida por `checkDependencies`. A associação vem do cadastro do 1º turno e vale para todos os cargos (mesmo prédio); local de outro turno sem correspondência aparece como tal. Por local (zona e código original): situação, coordenada quando única, número de outros locais na mesma coordenada, setor, situação urbana/rural, moradores (`V0001`) e mediana do responsável com rendimento (`V06006`) com a faixa de `INCOME_BANDS`. `null` é preservado ("X" do IBGE é omissão, não zero). Inclui o resumo do município por situação, em locais e eleitores. A coluna `responsible_with_income`, de nome impreciso, fica fora da resposta.
- **Por que rota separada:** publicação, validação de dependências e exterior (sem setor) ficam isolados, e o contrato atual dos locais não muda.
- **Web:** no cartão do local, um `<details>` "Setor censitário do local" com a situação em linguagem simples (sem coordenada na fonte, seção realocada depois de 2022, setor de outro município, fora dos setores) e, se associado, código e indicadores do setor, com o aviso de que descrevem o entorno do prédio, não os eleitores. Local com votos sem linha no cadastro de locais aparece assim, nunca como zero. Na página do município, quadro de cobertura por situação, no formato do quadro por UF de `/fontes`.
- **Opcional (A1b):** perfil do eleitorado do local (`place-profiles-2022-v2`), identificado como cadastro do TSE, base própria que não fecha com os resultados.
- **Aceite:** locais com votos ligados à associação ou declarados sem cadastro; soma por situação igual às linhas publicadas do município; tempo da rota medido em São Paulo (2.049 locais) dentro do limite de 2 s; testes de contrato (situações = `TRACT_STATUSES`) e da API (sem publicação → `awaiting-import`); smoke com contagens conferidas no banco; `check:ui` com `/municipios/71072?uf=SP`.

### A2. Série comparada escolhível e dispersão em `/mapa`

- Hoje `/mapa` compara um de três indicadores do Censo com a abstenção da Presidência (`elections.controller.ts:311` fixa `office='president'`). Proposta: a série comparada passa a ser a abstenção do cargo escolhido (os aptos diferem entre cargos e turnos, `plan.md` §17) ou o percentual dos válidos de qualquer candidatura do recorte, reaproveitando `map/candidates`, que já confere candidaturas completas e soma igual aos válidos. Série padrão: abstenção, sem privilegiar candidatura.
- **Dispersão** em SVG no servidor, componente novo sem dependência nova: um ponto por UF ou por município da UF; eixo x com o indicador do Censo e eixo y com a série. Área do ponto proporcional aos aptos (abstenção) ou aos válidos (candidatura), o que atende à proposta de peso em pessoas e votos sem calcular ponto representativo de polígono. Sem linha de tendência nem coeficiente de correlação na primeira versão; aviso ecológico como nos mapas. Unidades sem dado ficam fora do gráfico, contadas e listadas na tabela.
- **Aceite:** valores idênticos aos de `map/values` e `map/candidates`; mesmas unidades no mapa, na dispersão e na tabela; denominador zero sem ponto; formulário GET sem JavaScript; tamanho da página medido (referência de 17/10: MG por município com 2,3 MB, ou 382 KB com gzip, em `plano-ibge.md`); `check:ui`.

### A3. Exportação (opcional)

CSV da visão atual por GET: códigos TSE e IBGE, nomes, numeradores, denominadores e versões das publicações usadas. Seleção livre de municípios para somar contagens fica para depois.

## 5. Fase C — entorno urbano do Censo 2022

Fonte nova pequena, com publicação própria (sugestão: escopo `2022/context/urban-surroundings`, versão `urban-surroundings-2022-v1`). Não usa geometria.

- **C0. Decisões:** autorizar download e preservação dos agregados por setor (domicílios, moradores e faces), dos três arquivos municipais e do dicionário. Escolher indicadores (sugestão: calçada, rampa para cadeirante, obstáculo na calçada, iluminação pública, via pavimentada, bueiro, ponto de ônibus e arborização com ao menos uma árvore). Unidade principal: moradores (`V052xx`), com domicílios para conferência. Onde exibir: painel do município, `/mapa` e cartão do local.
- **C1. Auditoria antes da carga** (sem banco; relatório em `data/analysis/`):
  - Conferir se, em cada setor, as categorias de cada característica (incluindo NÃO DECLARADO e "saltado") somam a base (`V05000`, `V05200`, `V05400`). Diferença é registrada e levada a Rafael, nunca redistribuída.
  - Soma dos setores igual ao arquivo municipal em cada município.
  - Setores omitidos ("X") e setores fora da pesquisa, contados separadamente.
  - `CD_SETOR` presente na malha preservada e nos agregados já usados; municípios ligados aos 5.570 pela correspondência oficial.
  - Amostra de percentuais conferida com o CSV percentual oficial, sem importá-lo.
  - O arquivo com acento no nome (`domicílios`) recebe nome preservado ASCII, como já faz `preservedDownload`.
- **C2. Importação:** tabela municipal com contagens por indicador e categoria, base e cobertura da pesquisa; tabela por setor, só com as variáveis escolhidas, se a A1 ou a B3 forem usá-la. As conferências da C1 bloqueiam a publicação.
- **C3. Interface:** no painel do município, "Entorno dos domicílios (setores pesquisados)" com SIM, NÃO e NÃO DECLARADO e a cobertura (moradores em setores pesquisados ÷ moradores em domicílios particulares permanentes ocupados do município). "Não declarado" nunca é redistribuído, e "fora da pesquisa" nunca é lido como ausência da infraestrutura. Novos indicadores em `/mapa`, com numerador e denominador. No cartão do local, o entorno do setor quando pesquisado.
- **Aceite:** identidades da C1 bloqueantes; município → UF → Brasil por soma de contagens; nulo preservado; testes, smoke e `check:ui`; tamanho das tabelas medido.

## 6. Fase B — base espacial medida e mapa local → setor

### B1. Ensaio sem persistência

Script de verificação (ex.: `scripts/check-geo.ts`, no padrão de `check:publication`) que carrega a malha preservada com `loadTracts` em tabelas temporárias, lê as tabelas públicas sem escrever e grava o relatório em `data/analysis/`. Exige autorização: é a mesma carga de malha das importações de setores e sensibilidade, executada sem importação concorrente; não escolhe UF nem publica.

Mede e registra:

1. Tempo de carga, memória do processo e tamanho da tabela e do índice GiST (`pg_total_relation_size`), com os parâmetros do PostgreSQL vigentes.
2. Validade das partes antes da união e dos setores depois dela: `ST_Collect` de partes adjacentes pode gerar MultiPolygon inválido mesmo com partes válidas (914 setores têm mais de uma parte). Cobertura por município com `ST_CoverageInvalidEdges` (sobreposições e lacunas). Tudo é registrado sem reparo; `ST_CoverageClean` e `ST_MakeValid` não entram em cálculo.
3. Equivalência: para cada local publicado com coordenada única e não realocado, recontar os setores que contêm o ponto e comparar situação e setor com `polling_place_tracts`. Qualquer diferença bloqueia a B2.
4. Representação: `ST_CoverageSimplify` por município, com tolerância derivada do tamanho de um pixel na largura do mapa (600 px) e registrada. Tamanho do SVG, bruto e com gzip, para São Paulo, Rio, Brasília, Belo Horizonte e um município mediano, e por distrito em São Paulo; comparação com o orçamento de página da A2.

A saída é um relatório com números medidos para a decisão da B2.

### B2. Catálogo e representação (se aprovada após a B1)

- Backup completo antes, no padrão de `data/backups/`, com SHA-256 e `pg_restore --list`; boa ocasião para o ensaio de restauração ainda pendente (`plan.md` §28).
- Migration nova com `tract_geometries` (lote, setor, município, situação, partes, geometria exata em SRID 4674, validade registrada, índice GiST) e `tract_display` (lote, município ou distrito, geometria simplificada, tolerância). Publicação própria (sugestão: `2022/geo/tracts`, versão `tract-geometries-2022-v1`), com identidade formada pelo SHA-256 do GeoPackage preservado, pela versão e pelos parâmetros de simplificação.
- Abrangência (Brasil ou UF piloto) decidida com os números da B1.
- `sectors.ts` e `tract-sensitivity.ts` continuam como estão (seção 2, item 5); a equivalência da B1 é repetida contra o catálogo persistido.
- **Aceite:** equivalência integral; validade registrada; tamanho de tabela, índice, WAL e dump medidos; `check:publication` e regressões sem mudança nas publicações existentes.

### B3. Mapa local → setor

- Rota própria por município (ex.: `/municipios/[code]/setores`), em SVG no servidor. Setores coloridos **somente** por indicador do Censo (renda em faixas fixas `INCOME_BANDS`, entorno da fase C, demografia); locais de votação como pontos identificados como locais. Nenhum setor é pintado com votos.
- Pontos neutros por padrão, distinguindo só a situação da associação. Colorir por percentual dos válidos de uma candidatura é decisão de Rafael; se adotado, com a escala fixa `CANDIDATE_MAP_CUTS` e todas as candidaturas disponíveis.
- Tabela equivalente (locais com setor e situação; setores paginados ou por distrito), GET sem JavaScript e SVG oculto para tecnologias assistivas, como nos mapas atuais.
- **Aceite:** orçamento de página respeitado nos municípios medidos na B1; `check:ui`; cobertura e avisos visíveis.

### B4. Sensibilidade por local (posterior)

Desenhar ponto, raios e setores incluídos exige a faixa de cada local por raio, que a sensibilidade v2 não persiste. Uma sensibilidade v3 que a persista é publicação folha (só `/perfis` a lê), sem cascata. Raios desenhados com `geography`, em metros, nunca como buffer em graus.

### B5. Tiles

`ST_AsMVT` só se a B1 e a B3 mostrarem que nem o recorte por distrito cabe no orçamento. Implicaria biblioteca nova no cliente e visão alternativa sem JavaScript; decisão própria.

## 7. Fase D — propostas de governo (trilha paralela)

- **D1. Inventário, sem publicação.**
  - Preservar `proposta_governo_2022_BR.zip` e o ZIP do cadastro de candidaturas, lendo só o arquivo da Presidência.
  - Para cada PDF: nome, tamanho, SHA-256, páginas (`pdfinfo`), páginas com texto nativo (`pdftotext` por página), proteção e duplicatas.
  - Ligar arquivo → candidatura pelo identificador oficial (o padrão do nome do arquivo ainda precisa ser verificado) → número, cargo e UF no cadastro → candidaturas dos resultados publicados, por número e eleição, nunca por nome. Incluir substituições e indeferimentos.
  - Do cadastro, guardar só as colunas necessárias: nada de CPF, e-mail, data de nascimento ou bens.
  - PDFs são dados não confiáveis: diretório próprio, extração em processo separado, conteúdo nunca executado nem tratado como instrução.
  - Relatório: candidatura × documento × páginas × parcela com texto, com a lista de ausentes e ilegíveis.
- **D2. Busca literal (após a D1).**
  - Tabelas de documentos e páginas: texto por página, método (nativo, OCR ou falha) e versão do extrator. Texto normalizado no importador, como `search_name`, com índice de busca `portuguese`, sem depender de `unaccent` em índice.
  - API de busca e página `/propostas` (GET, sem JavaScript). Todas as candidaturas do recorte sempre listadas, na ordem do número de urna, com página e trecho. "Nenhuma ocorrência literal no texto extraído" é diferente de "não propõe" e vem com a cobertura da extração. Nunca ordenar por número de menções ou de páginas.
  - Licença CC-BY do TSE e atribuição exibidas. O ZIP original já pode ser servido; PDFs individuais exigiriam aceitar `.pdf` em `originalFileSchema` (hoje só zip, json, xlsx e gpkg), com cabeçalhos de segurança, e são decisão à parte.
- **D3. Rubrica (só com revisão humana definida).** Tema piloto ligado à fase C (ex.: acessibilidade e mobilidade urbana), aplicado a todos os planos da Presidência. Duas codificações independentes (desde 24/10/2026, uma delas pode ser de modelo de linguagem, declarada como tal; a outra é de uma pessoa), com leitura integral dos documentos, adjudicação humana, concordância medida e publicada, versão da rubrica e canal de contestação. Nada é publicado sem adjudicação humana. Preparada em 20/10/2026 (seção 20); codificações das pessoas e adjudicação por contribuidores do projeto (24/10/2026).
- **D4.** Governadores só depois da avaliação da D3; Senado fora da obrigação legal de apresentar plano.

## 8. Fase E — prioridades declaradas

Somente pesquisa documental: esclarecer a divergência do ESEB 2022 (2.001 × 1.806 entrevistas; novembro–dezembro × outubro) pela documentação do CESOP e conferir licença e termos do LAPOP Brasil 2023. Cadastro em acervos, contato com instituições e download de microdados dependem de Rafael. Respostas de pesquisas nacionais não são espacializadas. Pesquisa feita em 20/10/2026 (seção 21).

## 9. Regras transversais

- Toda publicação nova tem versão e escopo próprios; nenhuma publicação existente é reescrita. `check:publication` e as regressões confirmam as publicações anteriores intactas.
- Verificação por fase: typecheck, testes, build, smokes afetados, `check:ui` com as páginas novas e `check:data` quando houver fonte nova. Atualizar `docs/api.md`, `/fontes`, `/metodologia`, README e a linha de escopo do `AGENTS.md`, com registro datado no `plan.md`.
- Consultas novas leem agregados por chave (município, setor, local) dentro do limite de 2 s; nenhum cálculo espacial por requisição antes da decisão da B2.
- Backup antes de migration que crie tabela grande (B2). Hospedagem continua decisão separada; os tamanhos medidos na B1 e na B2 entram nessa análise.

## 10. Decisões para Rafael

| # | Decisão | Recomendação |
| --- | --- | --- |
| 1 | Ordem das fases | A → C → B, com a D1 em paralelo quando autorizada; E só documental |
| 2 | Associação por local (A1) | Rota própria, sem alterar o contrato dos locais |
| 3 | Série padrão e dispersão (A2) | Abstenção como padrão; sem linha de tendência nem correlação |
| 4 | Exportação CSV (A3) | Sim, depois da A2 |
| 5 | Entorno urbano (C0) | Autorizar as contagens (cerca de 34 MB); escolher indicadores; moradores como unidade |
| 6 | Ensaio espacial (B1) | Autorizar a execução local sem persistência |
| 7 | Abrangência do catálogo (B2) | Decidir entre Brasil e UF piloto com os números da B1 |
| 8 | Pontos do mapa local → setor (B3) | Neutros por padrão |
| 9 | Inventário de propostas (D1) | Autorizar o download (cerca de 20 MB) e o inventário sem publicação |
| 10 | Codificação e adjudicação (D3) | Decidido em 24/10/2026: contribuidores do projeto codificam e adjudicam; uma das codificações pode ser de modelo |

## 11. Fora deste plano

Deputados, 2026 e a suplementar de RR; CNES, Censo Escolar, Acesso a Oportunidades e áreas de risco (estudo, §5), que ficam para depois de C e B com auditoria própria; tiles e bibliotecas de mapa no cliente sem medição; banco vetorial ou de grafos; notas únicas, índices ideológicos ou ranking de planos; votos atribuídos a setores ou pessoas; entorno atribuído aos eleitores; respostas de pesquisas nacionais espacializadas; implantação e contratação.

Registro da preparação deste plano: `plan.md` §32.

## 12. Andamento — fase A (19/10/2026)

Rafael aprovou a fase A em 19/10. Implementada com as recomendações das decisões 2 a 4; as decisões 1 e 5 a 10 seguem abertas, e nenhuma outra fase começou. Sem importação nem publicação nova: tudo lê as publicações existentes.

- **A0.** Corrigidos os dois textos previstos e mais três achados na varredura: `/metodologia` dizia que os endereços não estavam relacionados ao IBGE, e a página inicial falava no futuro de indicadores do IBGE e da origem dos dados, que já existem.
- **A1.** Rota `GET /elections/municipalities/:code/place-tracts?uf=` (contratos `placeTractsQuerySchema`/`placeTractsSchema`), com `checkDependencies`, setor só para local associado, faixa conferida contra a mediana e `503` quando setor e contexto gravados não conferem. No cartão do local, setor, situação, moradores, mediana do responsável com faixa, coordenada do TSE e aviso de ponto compartilhado, ou o motivo da não associação; na página do município, quadro de locais e eleitores por situação. Rótulos compartilhados com `/fontes` (`lib/tracts.ts`). O A1b (perfil do eleitorado por local) não foi feito: era opcional e não entrou nas decisões.
- **A2.** `map/values` aceita `office` na abstenção (aptos e turnos do próprio cargo; cargo estadual exige UF; `round-not-held`) e informa as publicações lidas, como `map/candidates`. `/mapa` ganhou cargo, turno conforme o recorte e “Comparar com” (abstenção, padrão, ou qualquer candidatura do recorte, em ordem de votos e com a escala fixa dos mapas por candidatura), dispersão em HTML posicionado com eixos a partir de zero, área proporcional ao denominador, sem tendência nem correlação, e tabela com a série escolhida.
- **A3.** `/mapa/dados.csv` com os mesmos filtros da página: UTF-8 com BOM, `;`, vírgula decimal, códigos TSE e IBGE, contagens como publicadas e IDs das publicações; texto protegido contra fórmula de planilha.

Medições locais (API e web compiladas): associação de São Paulo com 2.049 locais e 2.030 associados, iguais ao banco, em 60–220 ms; abstenção de Governador, Senador e Presidência em SP igual ao consolidado publicado da UF; `/mapa?uf=MG` com 2.641 KB (442 KB com gzip), dos quais a dispersão ocupa 156 KB (25 KB com gzip), contra a referência de 2,3 MB (382 KB) de 17/10, anterior às dicas dos mapas; renderização em 1,3–1,9 s.

Verificação: 98 testes unitários, typecheck e build; nove smokes e 31 regressões HTTP; `check:ui` em Chrome e Firefox com 8 cenários e 33 avaliações axe/refluxo por navegador, sem violações automáticas nem rolagem horizontal; revisão visual por capturas. Não verificados: leitor de tela humano, Safari e dispositivos reais. Detalhes, evidências e pendências: `plan.md` §33. Consolidado em commit local, sem push.

## 13. Andamento — fase C (19/10/2026)

Rafael aprovou a fase C com a condição de o acréscimo ser pequeno (“apenas 34 MB? se sim ok; se não, e for expressivo, vamos pensar”). Medido antes de importar, com download para diretório temporário fora do repositório: os seis ZIPs do entorno somam 36.456.187 bytes (34,8 MiB), e os CSVs por setor descompactados somam 185 MB, lidos em fluxo, sem extração para o disco. A apresentação usa só moradores, então foram preservados apenas o arquivo por setor (13,0 MB), o municipal (0,45 MB) e o dicionário (27 KB). Ocupação real depois da carga: 21 MB no banco (2,3 MB por município e 18,7 MB nos setores com local de votação) e 13,5 MB de originais, com ligação física entre `raw` e `originals`; cerca de 34 MB no total.

**Auditoria C1** (moradores, domicílios e faces, todos os setores e municípios): 340.965 setores com moradores e domicílios (344.841 com faces), sem código inválido nem duplicado; em todos os setores e municípios, as categorias de cada característica somam a base; a única omissão é “X” em todas as variáveis de 1.418 setores (632 municípios); a soma dos setores é idêntica ao arquivo municipal nos 4.938 municípios sem setor omitido e nunca o ultrapassa nos demais, cujo total municipal inclui os omitidos. Dos 71.287 setores associados a locais, 49.181 estão na pesquisa e 112 deles são omitidos. Nuance que muda a leitura: rampa e obstáculo só são avaliados onde há calçada, e o “não declarado” desses itens inclui faces sem calçada.

**Decisões aplicadas** (recomendações do plano, sem outra escolha de Rafael): unidade moradores; oito indicadores exibidos (calçada, rampa, obstáculo, iluminação, pavimentação, bueiro, ponto de ônibus e ao menos uma árvore), com as 35 contagens guardadas para que a escolha mude sem reimportar; exibição no painel do município, em `/mapa` e no cartão do local. Domicílios e faces foram auditados e não importados.

**Implementação:** contratos (`URBAN_CHARACTERISTICS`, `URBAN_INDICATORS`, identidade das categorias e esquemas), migration 017, importador `urban-surroundings-2022-v1` (`npm run import:urban-surroundings`; rótulos conferidos no dicionário, identidades por setor e município, soma contra o arquivo municipal, omissão só por inteiro; tudo bloqueante), publicação `960899b9899cf35438f8c3afd08ee0b7f1c6500303dfab8b4ca725e512150f1f` em 26 s, com totais iguais aos da auditoria. API: `urbanSurroundings` no contexto, oito indicadores `urban-*` em `map/values` e `urban` (pesquisado, omitido ou fora da pesquisa) em cada setor da rota dos locais; catálogo com a publicação. Interface: tabela do entorno no painel do município, com cobertura frente à população residente; entorno do setor no cartão do local; indicadores em `/mapa` com aviso do denominador; `/fontes` e `/metodologia`.

Verificação: 106 testes unitários, typecheck e build; nove smokes e 31 regressões HTTP, com o `smoke:context` conferindo valores lidos dos arquivos do IBGE (Brasil, São Paulo e o setor do Colégio Objetivo). `check:ui` completo nos dois navegadores, com um novo cenário de acessibilidade de detalhes abertos. Corrigidos na verificação: a rota do catálogo não listava a publicação (corrigido, com teste); regiões repetidas e transbordamento no celular na tabela do setor (tabela simples de duas colunas). Detalhes em `plan.md` §34. Consolidado em commit local, sem push. Próximas fases definidas por Rafael: B e depois D, cada uma só com novo aviso.

## 14. Andamento — fase B1 (19/10/2026)

Ensaio sem persistência executado com `npm run check:geo` (script `scripts/check-geo.ts`), dentro de uma transação desfeita: só tabelas temporárias, publicações iguais antes e depois (117 lotes, 67 publicadas), relatório em `data/analysis/geo-ensaio-2026-10-19T21-24-42.885Z/report.json`. GeoPackage conferido pelo SHA-256 (`7b961b05…`, o mesmo da associação `polling-place-tracts-2022-v3`). Parâmetros do PostgreSQL inalterados (padrões da imagem: `shared_buffers` 160 MB, `work_mem` 4 MB, `maintenance_work_mem` 64 MB, `max_wal_size` 1 GB). Rodou com o `npm run dev` de Rafael ativo.

| Medida | Resultado |
| --- | --- |
| Carga | 472.780 linhas → 468.099 setores (914 com partes unidas) em 266 s; pico de 574 MiB no processo |
| Tamanho em tabela | **1,4 GB** no total: 540 MB de tabela, 33 MB de índice GiST e o restante em TOAST (geometrias grandes); sem contar WAL da gravação nem crescimento do backup |
| Validade | 30 setores inválidos, todos por “Ring Self-intersection” no próprio polígono (não pela união de partes); 2 deles com várias partes. Registrados, sem reparo |
| Cobertura | Nos 468.069 setores válidos, nenhuma aresta inválida por município (`ST_CoverageInvalidEdges`, tolerância 0): sem sobreposições nem lacunas detectadas |
| Equivalência | 84.594 de 84.594 locais (associados, outro município, fora dos setores) com a mesma situação e o mesmo setor da publicação |

Desenho na largura dos mapas (600 px), com `ST_CoverageSimplify` na tolerância de ~1 px (o payload do servidor do Next repete o desenho; somar esse efeito ao orçamento):

| Recorte | Setores | SVG bruto | Simplificado | Com gzip |
| --- | --- | --- | --- | --- |
| Município mediano (1100080) | 33 | 40 KB | 17 KB | 6 KB |
| Brasília | 5.418 | 2,7 MB | 560 KB | 170 KB |
| Belo Horizonte | 5.166 | 1,8 MB | 642 KB | 213 KB |
| Rio de Janeiro | 13.782 | 6,5 MB | 1,2 MB | 383 KB |
| São Paulo | 27.301 | 11,3 MB | 2,6 MB | 847 KB (3 polígonos inválidos depois da simplificação) |
| Maior distrito de São Paulo | 1.107 | 879 KB | 260 KB | 88 KB |

Leitura: a associação publicada é reproduzida exatamente; a malha é coerente, com 30 exceções localizadas. O desenho por município cabe no orçamento da página (referência: 442 KB com gzip em `/mapa?uf=MG`) até o porte de Belo Horizonte e Brasília; Rio fica no limite e São Paulo o ultrapassa, mas o recorte por distrito resolve (88 KB no maior). O que pesa é guardar a geometria exata nacional: cerca de 1,4 GB, ordem de grandeza diferente das fases A e C.

Decisão pendente de Rafael (decisão 7 do plano), antes de qualquer gravação: (a) guardar a geometria exata nacional (~1,4 GB + WAL e backup); (b) guardar só a representação simplificada por município e distrito, calculada na importação a partir do GeoPackage preservado (tamanho a medir; os números acima indicam frações do bruto), sem consultas espaciais por requisição; ou (c) uma UF piloto. Recomendação: (b) — atende ao mapa local → setor (B3) sem o custo da geometria exata, que continua reconstituível a partir do original preservado.

## 15. Andamento — fase B2 (19/10/2026)

Rafael escolheu a opção (a): geometria exata nacional. Antes da gravação, backup completo (`data/backups/observatorio-2026-10-19-antes-geometria.dump`, 326.630.286 bytes, SHA-256 `bd15b8d2…`) e ensaio de restauração integral em banco temporário: 25 tabelas com contagens idênticas, 1.805 s.

Importador `apps/importer/src/tract-geometries.ts` (`npm run import:tract-geometries`, versão `tract-geometries-2022-v1`, escopo `2022/geo/tracts`), migração `018-tract-geometries.sql` (tabela `tract_geometries`: setor, município, situação, partes, `valid`, `invalid_reason`, `geometry(MultiPolygon, 4674)`, índice GiST). Lê o mesmo GeoPackage preservado (`7b961b05…`) pelo mesmo `loadTracts` da associação; não tem publicação de entrada (a associação não passa a ler esta malha, evitando republicações em cadeia), mas exige a associação publicada para a conferência, que bloqueia a publicação se qualquer local divergir.

| Medida | Resultado |
| --- | --- |
| Publicação | `90264219f250a36a…` (relatório em `data/audit/`) |
| Setores | 472.780 linhas → 468.099 setores, 914 com partes unidas |
| Validade | 30 inválidos (“Ring Self-intersection”), registrados sem reparo em `valid`/`invalid_reason` |
| Conferência | 84.594 de 84.594 locais com a mesma situação e o mesmo setor da associação `419c7a55…` |
| Tamanho | Tabela 1.397 MB (489 MB de linhas, 92 MB de índices, restante em TOAST); banco de 10,94 para 12,41 GB |
| Tempo | 4.353 s no total: 366 s de carga e ~66 min na transação. Repetida isoladamente depois da publicação, a conferência levou 46 s; a causa provável é a ausência de estatísticas das linhas ainda não confirmadas. Acrescentado `ANALYZE` depois da gravação (não muda resultado nem identidade; ainda não exercitado numa carga completa) |

API: `tractGeometriesDatasets` no catálogo (o lote `2022/geo/*` fica fora da lista de publicações eleitorais, que segue com 57); `/fontes` ganhou a seção “Malha de setores censitários”. Verificação: typecheck, 106 testes (28 + 34 + 33 + 11), build, nove smokes (incluindo Senador e contexto), `check:data`, `check:regressions` (31), `check:publication` e `check:ui` (9 casos em Chrome e Firefox, sem violações) contra API/web compiladas. Pendente: B3 (mapa local → setor), que passa a consultar esta tabela filtrando `valid`.

## 16. Andamento — fase B3 (19/10/2026)

Mapa local → setor por município em `/municipios/[code]/setores`, com a imagem em `/municipios/[code]/setores/mapa.svg` e a rota `GET /elections/municipalities/:code/tract-map` na API. Setores coloridos **somente** pela faixa fixa da renda mediana do responsável (`INCOME_BANDS`); locais como pontos neutros (cheio: associado; vazado: com coordenada e sem setor); nenhum voto nos setores. Tabela equivalente com zona, local, situação, setor, faixa e eleitores. Link na página do município (detalhes da associação), seções em `/metodologia#mapa-setores` e `/fontes#desenho-setores`.

Duas publicações novas, ambas sem cascata:

| Publicação | Conteúdo | Medidas |
| --- | --- | --- |
| `income-bands-2022-v3` (`f89bf867…`) | Mesmas contagens municipais da v2, mais `tract_income_bands`: situação (`band`, `no-data`, `undisclosed`), moradores, mediana e faixa de cada setor | 458.772 setores; somas por município e por situação iguais às da v2 (conferência bloqueante); 33 s; 116 MB (51 MB são o índice da chave, pelo ID do lote repetido) |
| `tract-display-2022-v1` (`8722a2bd…`, entrada: malha `2022/geo/tracts`) | `tract_display_views` (projeção, tamanho e divisão de cada vista) e `tract_display` (caminho SVG por setor, só nas vistas servidas) | 468.097 setores em 5.665 vistas; só São Paulo passou do limite de 250 KB comprimidos e foi dividido em 96 distritos; maior vista servida: Rio, 225 KB comprimidos; mediana 4,5 KB; 444 s; 209 MB |

Decisões de implementação:
- **Desenho pré-calculado**, não simplificado por requisição: na B1, simplificar o Rio levou 2,9 s, acima do limite de 2 s das consultas da API. Simplificação de cobertura com ~1 px; caminhos relativos com uma casa decimal (menores que os absolutos medidos na B1: o Rio caiu de 383 para 225 KB comprimidos).
- **Imagem servida à parte** (`<img>`), não SVG inline: no App Router, o SVG inline voltaria repetido no payload de hidratação. A rota comprime com gzip, porque o servidor do Next não comprimia essa resposta (Rio: 941 KB sem compressão, 235 KB com).
- **Divisão das vistas grandes:** distritos quando o município tem mais de um; senão, ou se um distrito ainda passar do limite, subdistritos. Nomes de `NM_DIST`/`NM_SUBDIST` do GeoPackage preservado.
- **Exclusões declaradas:** dois polígonos da malha sem município (`CD_MUN` "0", sem nome nem situação), na posição das lagoas dos Patos e Mirim (RS), contados na publicação e fora do desenho; nenhum local de votação cai neles. Os 30 setores inválidos na fonte são desenhados exatos, sem reparo. A nota publicada “30 desenhos inválidos depois da simplificação” conta esses 30 setores exatos; a simplificação não gerou nenhum desenho inválido (os 30 coincidem com os inválidos na fonte, conferido no banco). O importador passou a contar só os simplificados, para versões futuras.
- **Setores sem faixa** em tom neutro e contados à parte na legenda: mediana que não se aplica, omitidos pelo IBGE e sem linha no arquivo de renda (a malha tem 9.327 setores a mais que o arquivo de renda).

Verificação: typecheck; 109 testes (29 da API, com a rota nova cobrindo vistas, projeção, vista dividida, vista inexistente e inconsistências; 35 da web, com a imagem e a navegação entre vistas); build; `smoke:context` (107 requisições, com o bloco do mapa) e os demais oito smokes; `check:data`, `check:regressions`, `check:publication`; `check:ui` com as duas páginas novas em 1280, 375 e 320 px no Chrome e no Firefox, sem violações nem rolagem horizontal; capturas conferidas (Rio, Grajaú/SP e a lista de distritos de São Paulo). Banco de 12,41 para 12,75 GB.

## 17. Andamento — fase D1 (19–20/10/2026)

Inventário sem publicação e sem escrita no banco: `npm run inventory:proposals` (`apps/importer/src/proposals-inventory.ts`), relatório em `data/analysis/propostas-inventario-2026-10-20T01-32-13.578Z/report.json`. Originais preservados: `proposta_governo_2022_BR.zip` (15.771.758 bytes, SHA-256 `1c8853cc…`, `Last-Modified` 21/07/2024) e `consulta_cand_2022.zip` (4.390.989 bytes, `6f764839…`, `Last-Modified` 18/10/2026), lido só no arquivo `_BR` e só nas colunas da candidatura (sem CPF, e-mail, nascimento ou título). PDFs extraídos em `data/staging/proposta_governo_2022/<sha>/`, lidos por `pdfinfo` e `pdftotext` 24.02.0 em processo separado, sem shell e com tempo limite; o texto foi só contado (página com texto nativo: ao menos 50 caracteres visíveis).

| Nº | Candidatura (cadastro) | Situação | Páginas | Com texto | Vazias |
| --- | --- | --- | --- | --- | --- |
| 12 | Ciro Gomes (PDT) | Apto | 26 | **0** | 26 |
| 13 | Lula (PT) | Apto | 21 | 21 | 0 |
| 14 | Roberto Jefferson (PTB) | Inapto | 12 | 11 | 1 |
| 14 | Padre Kelmon (PTB) | Apto | 12 | 11 | 1 (documento idêntico ao de Roberto Jefferson, mesmo SHA-256) |
| 15 | Simone Tebet (MDB) | Apto | 48 | 37 | 1 |
| 16 | Vera (PSTU) | Apto | 26 | 26 | 0 |
| 21 | Sofia Manzano (PCB) | Apto | 19 | 19 | 0 |
| 22 | Jair Bolsonaro (PL) | Apto | 48 | 47 | 0 |
| 27 | Constituinte Eymael (DC) | Apto | 9 | 9 | 0 |
| 30 | Felipe d'Avila (Novo) | Apto | 36 | 34 | 0 |
| 44 | Soraya Thronicke (União) | Apto | 73 | 73 | 0 |
| 80 | Léo Péricles (UP) | Apto | 12 | 12 | 0 |
| 90 | Pablo Marçal (PROS) | Inapto, sem votos nos resultados | 108 | 76 | 0 |

Resumo: 13 candidaturas no 1º turno (11 aptas), 13 PDFs, um para cada candidatura pelo `SQ_CANDIDATO` do nome do arquivo; nenhum documento órfão, protegido ou ilegível; 450 páginas, 376 com texto nativo. Todos os números aptos estão nos resultados publicados, e nenhum número dos resultados fica sem candidatura no cadastro. O número 14 tem duas candidaturas (a indeferida e a substituta); nos resultados, o número é o da candidatura apta. Nenhum texto foi interpretado ou exibido.

Decisões de Rafael antes da D2:
1. **Documento só em imagem (nº 12, 26 páginas sem texto):** sem OCR, a busca literal responderia “nenhuma ocorrência” para essa candidatura por limitação da extração, não do conteúdo. Opções: (a) instalar OCR (`tesseract-ocr` com o idioma português, pacote de sistema) e registrar método e versão por página, com conferência por amostra; (b) publicar a busca com a candidatura marcada como “sem texto extraível”, nunca como “sem ocorrência”. Recomendação: (a), com a página indicando o método de cada trecho.
2. **Páginas parciais** (ex.: nº 15 com 10 páginas abaixo do limiar, nº 90 com 32): aplicar o mesmo OCR às páginas sem texto nativo, ou só declará-las na cobertura.
3. **Documento duplicado do nº 14:** exibir uma vez, ligado à candidatura apta, com a nota de que o arquivo é o mesmo da candidatura indeferida; e se a candidatura inapta do nº 90 entra na busca (sugestão: listada à parte, como candidatura sem votos).
4. Servir PDFs individuais (`originalFileSchema` aceita hoje só zip, json, xlsx e gpkg) ou só o ZIP preservado.

## 18. Andamento — fase D2 (20/10/2026)

Decisões de Rafael: (1) OCR com Tesseract em português; (2) OCR também nas páginas sem texto nativo dos demais documentos; (3) documento repetido do nº 14 exibido uma vez, na candidatura apta, com nota sobre a indeferida; nº 90 (inapta, sem votos) listada à parte; (4) só o ZIP original preservado é servido, sem PDFs individuais.

Publicado em 20/10/2026 depois que Rafael instalou o Tesseract 5.3.4 (`por`): `proposals-2022-v1` (`cce780ce…`), 410 s, 1,6 MB no banco. 13 candidaturas, 12 documentos únicos (o do nº 14 é o mesmo nas duas candidaturas), 438 páginas: 388 com o texto do PDF, 50 por OCR (26 do nº 12, 19 do nº 90, 2 do nº 15, 2 do nº 30, 1 do nº 14) e nenhuma sem texto. O importador recusa rodar sem OCR, para não publicar uma busca desigual.

Conferência do OCR por amostra (imagem da página × texto gravado): nº 12, p. 5 (página só de texto) — texto fiel, com o acento de “países” perdido (indiferente para a busca, que ignora acentos) e o cabeçalho em letras espaçadas omitido; nº 90, p. 89 (texto sobre fundo gráfico) — texto principal correto, mas “entendemos” lido como “entende” (cortado pelo desenho), um acento espúrio e uma linha de ruído vinda da imagem. Erros desse tipo são os que o aviso da página descreve.

- `apps/importer/src/proposals.ts` (`npm run import:proposals`, versão `proposals-2022-v1`, escopo `2022/proposals/president`, entradas: Presidência BR e ZZ) e migração `020-proposals.sql` (`proposal_documents`, `proposal_candidacies`, `proposal_pages`). Texto do PDF quando a página tem ao menos 50 caracteres visíveis; senão, OCR da página inteira a 300 dpi (`pdftoppm` + `tesseract -l por`), mantido só se render ao menos tanto texto quanto o PDF. Método e versões das ferramentas registrados. Bloqueios: PDF protegido, arquivo não previsto no ZIP, documento sem candidatura, número dos resultados sem exatamente uma candidatura apta, candidatura apta sem votos, documento repetido sem uma única candidatura com votos.
- Normalização única nos contratos (`searchNormalize`/`searchText`): minúsculas sem acentos, espaços colapsados, palavra partida por hífen no fim da linha reunida; o mapa de posições permite recortar o trecho do texto original. Busca por `strpos` no texto normalizado (450 páginas dispensam índice; sem dicionário `portuguese`, para continuar literal).
- `GET /elections/proposals` e página `/propostas` (GET, funciona sem JavaScript): todas as candidaturas na ordem do número, cobertura por método, páginas com ocorrência e trechos das cinco primeiras, OCR marcado; “nenhuma ocorrência literal no texto extraído” com o aviso de que não indica ausência do tema. Seções em `/metodologia#propostas` e `/fontes#propostas`; licença e link para o ZIP preservado.
- Falha encontrada na verificação e corrigida: com a publicação no banco, o catálogo respondia 500, porque o escopo `2022/proposals/` caía na lista de publicações eleitorais; agora fica em `proposalsDatasets`, com teste.
- Verificação: typecheck, testes (API com o catálogo e a busca; web com ausência ≠ não propõe, aviso do OCR só para documentos com OCR e trecho do PDF tratado como texto), build; `smoke:context` (113 requisições, com o bloco das propostas e o ZIP original), os demais oito smokes, `check:data`, `check:regressions`, `check:publication` e `check:ui` com `/propostas` (com e sem busca, 12 avaliações, sem violações) contra API/web compiladas nas portas 3100/3101. Link na navegação adicionado depois, no commit `443c0d1`, sem registro da verificação feita nele (plan.md §44).

## 19. Plano — `proposals-2022-v2` da busca nas propostas (proposto, auditado, decidido e publicado em 20/10/2026)

Origem: revisão de código de 20/10/2026 (plan.md §44). A v1 perde ocorrências que estão nos PDFs, e a perda varia com o PDF de cada candidatura:
1. `pdftotext -layout` põe as colunas lado a lado na mesma linha. Cria adjacências falsas entre colunas e impede reunir a palavra partida no fim da linha.
2. A normalização não trata ligaduras (ﬁ, ﬂ), caracteres invisíveis nem hífens Unicode.
3. A junção do hífen de fim de linha sempre descarta o hífen: "pré-\nsal" vira "presal", e a busca "pré-sal" não o encontra.
4. Página com texto nativo ilegível (fonte sem mapa Unicode) não passa por OCR.
5. A versão da normalização não fica na publicação: qualquer mudança nela sem reimportação faz a busca responder 503.

A v1 (`cce780ce…`) não é reescrita: a v2 é nova versão do importador, com validação própria, e a troca da publicação continua atômica (`preparePublication`).

### Evidência já obtida (PDF sintético, sem dados reais)

`pdftotext` 24.02.0, a mesma versão da v1, sobre um PDF de duas páginas gerado para o teste (Helvetica, WinAnsi). Página 1: uma coluna com "prote-/ção", "pré-/sal", "educa" + hífen invisível (0xAD)/"ção" e "2022-/2026" em fim de linha. Página 2: duas colunas com "prote-/ção" na da esquerda.

| Modo | Colunas | Hífen de fim de linha |
| --- | --- | --- |
| `-layout` (v1) | Lado a lado na mesma linha: "esquerda fala de prote-␣␣␣␣direita fala de saude" | Preservado, mas a continuação fica depois do texto da outra coluna |
| padrão (ordem de leitura) | Separadas | Removido pelo próprio Poppler, sem volta: "proteção", mas também "présal" e "20222026" |
| `-raw` | Ordem do conteúdo do PDF, que depende do programa que o gerou | Preservado |
| `-bbox-layout` (fluxos, blocos, linhas e palavras) | Separadas, na mesma ordem de leitura do modo padrão | Preservado: remontado, dá "prote-\nção", "pré-\nsal" e "2022-\n2026" |

O 0xAD no fim da linha foi tratado como hífen comum: sai como "-" no `-layout` e no `-raw` e é removido no modo padrão.

A auditoria nos PDFs reais rodou em 20/10/2026, na máquina de Rafael; o resultado está abaixo e mostrou uma falha da remontagem que o PDF sintético não tinha (ligaduras).

### Passo 1 — auditoria do texto, sem publicação (`npm run audit:proposals-text`)

Script só de leitura, como o inventário da D1. Lê o ZIP preservado (`1c8853cc…`), extrai os PDFs em `data/staging/proposta_governo_2022-auditoria/` (diretório próprio, para não apagar o de uma importação em andamento), roda `pdftotext -layout`, `-bbox-layout`, o modo padrão e `-raw` em cada documento e não escreve no banco. Relatório em `data/analysis/propostas-texto-<data>/report.json`, por documento e pelas candidaturas que o apresentaram, para que o efeito seja comparável entre candidaturas.

Implementado e executado em 20/10/2026:
- **Arquivos:** `apps/importer/src/proposals-text-audit.ts`; funções em `proposals-text.ts`: leitor restrito do `-bbox-layout` e remontagem (usados pelo importador desde a v2), normalização da v1 congelada para a comparação e medidas. A normalização e a expressão da busca da v2 estão nos contratos.
- **Execução:** `npm run audit:proposals-text`; `-- --sem-imagens` dispensa as imagens e `-- --termos=a,b` conta as ocorrências desses termos na v1 e na proposta, por documento.
- **Remontagem conferida:** o texto do `-bbox-layout`, com o descarte do hífen de fim de linha refeito como o Poppler faz, precisa ser o do modo padrão do `pdftotext`, página a página (`defaultMode` no relatório).
- **Imagens:** as páginas listadas para conferência são gravadas em `paginas/` (80 dpi, cinza): por colunas, as duas de maior diferença em cada documento; por qualidade, as 12 de pior medida.
- **Comparação com as publicações:** com `DATABASE_URL`, só por leitura (`default_transaction_read_only`), confere que as páginas nativas da v1 têm o texto do `-layout` e as da v2, o da remontagem; que o `search_text` da v2 é o `searchText` atual; e que o OCR da v2 é igual ao da v1. Também mede o efeito da normalização da v2 no texto do OCR da v1. Sem banco, registra o motivo.
- **Verificação:**
  - testes do leitor, da remontagem, das junções, das contagens, da extração do importador e uma auditoria de ponta a ponta com PDF sintético no `pdftotext` real; a normalização e a expressão da busca têm testes próprios nos contratos;
  - execução do script inteiro numa cópia do repositório, com ZIPs sintéticos no lugar dos do TSE (documento repetido em duas candidaturas, `leiame.pdf`, página abaixo do limiar);
  - execução contra um PostgreSQL 16 temporário com uma v1 simulada: mesmo ZIP, página idêntica e página alterada detectadas, ligadura do OCR recuperada.

O relatório traz:

1. **Caracteres:** U+FFFD, uso privado (U+E000–U+F8FF), controles, U+00AD (no meio e no fim da linha), hífens U+2010/U+2011, travessão U+2013 entre letras, ligaduras U+FB00–U+FB06, invisíveis (U+200B–U+200D, U+2060, U+FEFF), aspas e apóstrofos tipográficos. O relatório da D1 já tem `replacementChars` por documento: conferir primeiro.
2. **Colunas:** pares de palavras vizinhas (bigramas normalizados) que só existem no `-layout` (adjacências criadas entre colunas) e só no `-bbox-layout` (recuperadas). As páginas com mais diferenças vão para conferência visual com a imagem da página (`pdftoppm`), como foi feito com o OCR.
3. **Hífens:**
   - junções letra/dígito + hífen + quebra + letra/dígito em cada modo;
   - quantas atravessam linha em branco;
   - quantas formas reunidas ("pre-sal") também aparecem inteiras no meio de uma linha em algum documento, o que mede o caso "pré-sal".
4. **Qualidade do texto nativo, por página:**
   - fração de U+FFFD, uso privado e controles sobre os caracteres visíveis;
   - fração de letras;
   - fração de palavras de três ou mais letras sem vogal.

   As páginas com os maiores valores vão para conferência visual.
5. **Efeito na busca:** palavras e bigramas encontráveis com a v1 (texto `-layout` + normalização atual) e com a proposta (texto `-bbox-layout` + normalização nova), por candidatura, com ganhos, perdas e exemplos. Usa todos os tokens do corpus, sem lista de termos escolhida a dedo. As grafias com hífen que o marcador acrescenta (`hyphenatedOnlyV2`) ficam separadas das palavras recuperadas (`tokensOnlyV2`). O que só a v1 encontra (`tokensOnlyV1`, `pairsOnlyV1`) precisa de explicação antes da decisão.

### Resultado da auditoria (20/10/2026)

Executada com o banco no ar, em cerca de 1 min, sem escrita no banco. Relatório final em `data/analysis/propostas-texto-2026-10-20T23-03-39.700Z/` (`report.json` e 27 imagens), gerado com `-- --termos=inflação,eficiência,financiamento,profissional,educação,bem-estar`. Fontes: ZIPs `1c8853cc…` e `6f764839…`; ferramenta: `pdftotext` 24.02.0. As execuções anteriores do mesmo dia ficam como histórico.

**Correção da própria auditoria.** Na primeira execução, a remontagem punha espaço entre todas as palavras do `-bbox-layout`. Só que o Poppler parte palavras na ligadura: no nº 22, "ﬁm" sai como "ﬁ" e "m", com a segunda começando 0,15 pt antes do fim da primeira. Isso fabricava centenas de "fi" soltos e escondia o efeito real. O modo padrão do `pdftotext` junta essas partes. A remontagem passou a pôr espaço só quando a distância entre palavras chega a 0,04 da altura da linha (`WORD_SPACE`), com a estrutura do modo padrão. Conferência: em **438 de 438 páginas**, a remontagem, com o hífen descartado como o Poppler faz, é idêntica ao modo padrão. As 524 distâncias juntadas vão até 0,024 da altura da linha; as 96.585 separadas começam em 0,069; nenhuma cai entre as duas.

**V1.** O `-layout` reproduz as 388 páginas nativas publicadas na `cce780ce…`, com o mesmo ZIP.

**Colunas.**
- 120 das 365 páginas nativas têm pares de palavras diferentes entre o `-layout` e a remontagem. Pares só no `-layout`: nº 22 com 4.230, nº 30 com 1.398, nº 14 com 211; de 3 a 78 nos nº 16, 90, 80, 15 e 44; nenhum nos nº 13, 21 e 27.
- Os caracteres visíveis são os mesmos nos dois modos em todas as páginas: muda a ordem, não o texto.
- Mecanismo da perda (nº 30, p. 33): a linha física do `-layout` termina com "responsabiliza-", da coluna da direita, e a seguinte começa com "demais", da esquerda. A junção da v1 cria "responsabilizademais", e "responsabilização" deixa de ser encontrada.
- Conferência visual (nº 22, p. 40, três colunas; nº 14, p. 11, duas colunas): a remontagem segue a ordem de leitura da página.

**Hífens de fim de linha** (texto remontado das páginas nativas):
- 461 junções em 8 documentos. O `-layout` mostra 255, porque as colunas escondem o fim da linha.
- 365 são palavras partidas: a forma reunida aparece no meio da linha em algum documento.
- 23 são compostas: a forma com hífen aparece no meio da linha. Exemplos: "bem-estar" (7), "2023-2026" (4), "2019-2022" (2), "centro-oeste", "seguro-desemprego", "cívico-militares", "salários-mínimos", "deve-se", "trata-se", "defendê-lo", "preservá-lo".
- 73 não têm evidência no corpus. Há palavras partidas ("amar-rados"), compostas ("licença-maternidade", "passe-livre", "neo-estalinistas") e marcadores de lista do nº 80 ("A-", "B-", "D-", "E-"), que o próprio Poppler junta à palavra seguinte.
- 8 envolvem dígitos ("2003-2007", "2014-2024", "2023-2026").
- Uma atravessa linha em branco, isto é, fim de fluxo: "dispositi-" e "vos", no nº 14, palavra partida que o Poppler pôs em fluxos diferentes.
- No OCR da v1 (nº 12), "aprimora-" e "deter-" fecham a página e, depois de uma linha em branco, vem o número da página ("18", "20"). Por isso, depois de linha em branco, a junção proposta só vale entre letras.

**Caracteres** (páginas nativas):

| Classe | Ocorrências | Onde |
| --- | --- | --- |
| Ligaduras U+FB00–U+FB06 | 334 | Só no nº 22 |
| Aspas tipográficas | 219 | 10 documentos |
| Apóstrofos tipográficos | 21 | 8 documentos ("d’Avila", "ONG’s", "d’água", "IDH’s") |
| Travessão U+2013 | 94 | Nenhum entre letras |
| U+200B | 2 | Nº 15 |
| Uso privado U+F0B7 | 53 | Nº 16 (marcadores de lista da fonte Symbol) |
| Espaços Unicode | 3 | Nº 30 (já tratados como espaço) |
| U+FFFD, controles, U+00AD, U+2010, U+2011 | 0 | — |

As regras para hífen suave e hífens Unicode ficam só como defesa. Outros sinais: "•" (202), "●" (40), "—" (4), "²", "³" e "⅓", que continuam sem NFKD, como previsto.

**Qualidade.**
- Nenhuma página nativa passa dos limiares provisórios (1 % de U+FFFD, uso privado e controles, ou 20 % de palavras sem vogal).
- Maior fração de caracteres ruins: 0,4 %, no nº 16 (os marcadores U+F0B7). Maior fração de palavras sem vogal: 9,9 % (nº 30, p. 36).
- No OCR publicado (50 páginas), a maior fração de palavras sem vogal numa página com mais de 100 caracteres é 5 % (nº 90, p. 17). As frações acima de 10 % estão em páginas de 29 a 86 caracteres (capas e títulos).

**Efeito na busca** (`search` no relatório). Simulação sobre todas as palavras de 3 ou mais caracteres do corpus, na grafia em que seriam digitadas, nas páginas nativas: em que páginas a v1 (`strpos` no `searchText` do `-layout`) e a proposta (expressão com marcador sobre a remontagem) encontram cada uma.
- Só a v1 encontra 151 pares termo × página: 128 no nº 30, 15 no nº 14, 5 no nº 22 e 3 no nº 90; nenhum nos outros oito documentos. Todos são pedaços de palavras coladas entre colunas pela v1 ("responsabilizademais", "eleisimultaneamente", "comtransformadoras"), e nenhum existe no texto `-raw` da página.
- Só a proposta encontra:
  - nº 22: 528 pares (ligaduras e compostos);
  - nº 30: 660 pares, na maior parte grafias com hífen de palavras partidas ("pre-cisa"), sem efeito prático, além de palavras recuperadas;
  - nº 14: 82;
  - de 1 a 14 nos nº 80, 16, 21, 44, 13, 27 e 90;
  - nenhum no nº 15.
- No texto do OCR da v1 (50 páginas), a normalização proposta não muda nenhuma palavra.

Ocorrências nas páginas nativas, v1 → proposta (`terms` no relatório). Os termos foram escolhidos pelo mecanismo (ligadura "fi"/"fl", palavra partida, composto), não pelo tema; as contagens não indicam ênfase de nenhuma candidatura. O nº 12 só tem páginas por OCR, iguais nas duas versões.

| Nº | inflação | eficiência | financiamento | profissional | educação | bem-estar |
| --- | --- | --- | --- | --- | --- | --- |
| 13 | 5 | 6 | 7 | 2 | 16 | 2 → 3 |
| 14 | 0 | 1 | 0 | 2 | 7 → 8 | 0 |
| 15 | 5 | 22 | 10 | 8 | 24 | 2 |
| 16 | 3 | 2 | 6 | 0 | 17 | 0 |
| 21 | 5 | 8 | 5 | 0 | 20 | 2 |
| 22 | 0 → 8 | 12 → 39 | 4 → 10 | 1 → 10 | 51 | 22 → 28 |
| 27 | 0 | 1 | 1 | 2 | 8 | 0 |
| 30 | 1 | 7 | 10 → 11 | 4 → 7 | 26 → 29 | 2 |
| 44 | 1 | 5 | 8 | 14 | 23 | 8 |
| 80 | 1 | 5 | 1 | 2 | 19 | 1 |
| 90 | 1 | 10 | 2 | 8 | 15 | 0 |

A v1 trata as candidaturas de forma desigual: no documento do nº 22, palavras com "fi", "fl" ou "ff" quase não são encontradas, porque o PDF usa ligaduras; nos nº 30 e 14, as colunas partem e colam palavras.

### Proposta para a v2 (recomendação revista com a auditoria)

- **Extração:**
  - `pdftotext -bbox-layout`, com o texto da página remontado como o modo padrão do Poppler o escreve: espaço entre palavras só quando a distância chega a 0,04 da altura da linha (`WORD_SPACE`), cada linha com "\n" e uma linha em branco depois de cada fluxo. Diferente do modo padrão, o hífen de fim de linha fica.
  - A remontagem, com o descarte do hífen refeito, é conferida página a página contra o modo padrão do `pdftotext`; qualquer diferença bloqueia a publicação. Na auditoria, as 438 páginas conferiram.
  - Leitor restrito a `page`/`flow`/`block`/`line`/`word`, com coordenadas nas linhas e palavras, decodificando só as entidades XML. O número de `<page>` precisa conferir com o `pdfinfo`.
  - Perdem-se os espaços internos de tabelas, que a busca e os trechos já colapsam.
- **Normalização `proposals-search-v2`, nos contratos:**
  - Ligaduras U+FB00–U+FB06 viram letras.
  - Invisíveis (U+00AD no meio da linha, U+200B–U+200D, U+2060, U+FEFF) são removidos sem virar espaço; hoje o U+FEFF vira espaço e parte a palavra.
  - U+2010 e U+2011 viram "-". Apóstrofos e aspas tipográficos viram `'` e `"`.
  - Sem NFKD geral: ele também transformaria "nº" em "no" e "²" em "2", e a busca "no" passaria a casar com "nº".
  - O travessão U+2013 não muda, porque separa orações; a auditoria não achou nenhum entre letras.
- **Hífen de fim de linha:**
  - Vale para `-`, U+00AD, U+2010 e U+2011 entre letra ou dígito e letra ou dígito, seguidos de quebra.
  - Depois de linha em branco (fim de fluxo no PDF, de bloco no OCR), só entre letras: no fim da página do OCR, o que segue costuma ser o número dela.
  - Em vez de descartar o hífen, o texto normalizado guarda um marcador (U+00AD, depois de removidos os demais). O marcador significa "hífen que pode ou não pertencer à palavra" e casa com nada ou com "-".
  - Assim, "proteção" encontra "prote-\nção" e "pré-sal" encontra "pré-\nsal". "presal" também encontra, porque a quebra não diz qual grafia é a certa.
  - O hífen no meio da linha continua literal: "presal" não encontra "pré-sal".
- **Busca:**
  - O termo normalizado vira uma expressão regular: caracteres especiais escapados, marcador opcional entre caracteres e o "-" do termo casando "-" ou o marcador.
  - Ela é aplicada no PostgreSQL (`search_text ~ $2`) e, para localizar o trecho, na API. Divergência entre os dois continua respondendo 503.
  - As 438 páginas (1,6 MB) dispensam índice.
- **Páginas ilegíveis** (revisto com a auditoria, que não encontrou nenhuma):
  - Recomendado: medir cada página nativa e bloquear a publicação se alguma passar dos limiares, como as demais divergências. Os limiares são 1 % de U+FFFD, uso privado e controles, e 20 % de palavras sem vogal; os maiores valores de 2022 são 0,4 % e 9,9 %. Sem OCR extra, sem migração e sem mudança na interface.
  - Alternativa (a proposta anterior): a página nativa acima do limiar vai para o OCR e fica o texto de melhor qualidade. O que continuar suspeito é contado por documento (`suspectPages`) e aparece na cobertura de `/propostas` e nas notas. Exige a migração 021.
- **Publicação:**
  - `VERSION = 'proposals-2022-v2'`.
  - `method` ganha `extraction: 'bbox-layout'`, `wordSpace: 0.04`, `normalization: 'proposals-search-v2'` e os limiares de qualidade, que entram na identidade da publicação, como hoje.
  - Só na alternativa das páginas suspeitas: migração 021 idempotente com `suspect` por página e `suspect_pages` por documento. Nulo significa não medido e nunca é lido como zero.
- **API:**
  - Só busca numa publicação cuja `method.normalization` é a do código.
  - Qualquer outra, inclusive a v1, que não tem o campo, responde 503 explícito: "publicação das propostas com normalização anterior; reimportar".
  - A consulta devolve todas as páginas encontradas, mas o texto só das cinco primeiras por documento (`row_number() OVER (PARTITION BY sha256 ORDER BY page)`), em vez do texto de todas.
- **Web:**
  - Só na alternativa das páginas suspeitas: a cobertura as mostra.
  - `/metodologia#propostas` explica colunas, hífens e marcador, ligaduras e a regra de qualidade.
  - Entram junto os achados menores da revisão nessa página: título próprio, nível dos cabeçalhos do grupo e das candidaturas, e texto do grupo "Candidaturas sem votos" derivado de cada candidatura.
- **Importador:** a mensagem de ferramenta ausente indica o pacote certo (`poppler-utils` ou Tesseract), e há falha clara quando `--version` não imprime nada.

### Validação

- **Testes:**
  - normalização com cada classe de caractere e cada caso de hífen;
  - leitor e remontagem do `-bbox-layout` (espaço pela distância, ligadura sobreposta, estrutura do modo padrão) sobre XHTML e PDF sintéticos;
  - expressão da busca (escapes, marcador, termo com hífen) na API com o simulador do banco;
  - recusa da v1 pela API nova.
- **Remontagem × modo padrão:** em todas as páginas, como na auditoria.
- **Comparação v1 × v2 por candidatura, sobre todos os tokens:** cada ocorrência da v1 precisa existir na v2 ou estar explicada no relatório (adjacência falsa entre colunas removida). Diferenças por candidatura registradas.
- **Conferência visual:** amostra das páginas que mais mudaram, por colunas e por qualidade.
- **Verificações do projeto:** typecheck, testes, build, smokes (`smoke:context` com `proposals-2022-v2`), `check:data`, `check:regressions`, `check:publication` e `check:ui` com `/propostas`.

### Ordem e custo

1. Auditoria na máquina com `data/`: só leitura, cerca de 1 min. Feita em 20/10.
2. Decisões abaixo.
3. Implementação e testes. Não exige dados e pode ser feita em qualquer sessão.
4. Carga `import:proposals` com a API nova já no ar. A v1 levou cerca de 7 min. A extração de texto leva segundos; o resto deve ser o OCR das 73 páginas abaixo do limiar, que são as mesmas na v2 se a regra de qualidade recomendada for aceita. Entre a troca de código e a carga, a busca responde o 503 explícito, só no ambiente local.
5. Registros no plan.md, README, AGENTS (escopo `proposals-2022-v2`) e aqui.

### Decisões para Rafael

Decididas por Rafael em 20/10/2026: seguir as cinco recomendações.

1. **Extração:** `-bbox-layout` remontado, com espaço pela distância entre palavras e conferência contra o modo padrão (recomendado). A auditoria confirmou: 438/438 páginas conferem, e tudo o que só a v1 encontra é palavra colada entre colunas.
2. **Hífen de fim de linha:** marcador opcional, só entre letras depois de linha em branco (recomendado). A alternativa é manter a regra da v1 (descartar sempre) e declarar o limite em `/metodologia`. Na regra da v1, perdem a grafia com hífen as 23 compostas confirmadas e as compostas entre as 73 sem evidência ("licença-maternidade", "passe-livre").
3. **Caracteres:** lista de mapeamentos acima, com o travessão de fora (nenhum entre letras). As ligaduras são o caso mais grave: 334, todas no documento do nº 22.
4. **Páginas ilegíveis:** nenhuma em 2022. Recomendado: medir e bloquear a publicação se alguma passar dos limiares, sem migração nem mudança na interface. Alternativa: OCR e páginas suspeitas declaradas na cobertura (migração 021).
5. **Transição:**
   - Recomendado: 503 explícito enquanto a publicação ativa for de outra normalização. O ambiente é local e a carga leva minutos.
   - Alternativa: manter a normalização da v1 congelada no código, para continuar servindo a v1 até a carga.

### Andamento — implementação e carga da v2 (20/10/2026)

Implementada conforme as recomendações acima, com as decisões de Rafael (plan.md §48):
- **Contratos:** `searchNormalize`/`searchText` passam a ser a normalização `proposals-search-v2` (constante `PROPOSALS_NORMALIZATION`), com o marcador `SEARCH_HYPHEN_MARKER`, a regra `joinsAtLineEnd` e o mapa de posições também para o marcador e as ligaduras. `searchPattern` gera a expressão da busca. O `method` das propostas ganha `extraction`, `wordSpace`, `normalization` e `quality`, opcionais para a v1 continuar legível.
- **Importador** (`proposals-2022-v2`): texto do PDF pela remontagem do `-bbox-layout`, conferida página a página com o modo padrão do `pdftotext` (bloqueia na diferença); medidas de qualidade nas páginas com texto do PDF, com bloqueio acima dos limiares e máximos por documento no relatório da publicação; mensagens de ferramenta ausente com o pacote certo e falha clara sem versão.
- **API:** busca por `search_text ~ searchPattern(termo)` e trecho pela mesma expressão sobre `searchNormalize` do texto; texto só das cinco primeiras páginas de cada documento (`row_number()`); 503 explícito na busca em publicação de outra normalização, com a cobertura respondendo.
- **Web:** título próprio em `/propostas`; candidaturas sem votos com cabeçalho `h4` sob o título do grupo e a situação do cadastro em cada uma; `/metodologia#propostas` e `/fontes#propostas` atualizadas.
- **Auditoria:** passa a comparar a normalização da v1, congelada em `proposals-text.ts`, com o código de produção da v2, e confere as duas publicações no banco.

Carga em 20/10/2026: `proposals-2022-v2` publicada (`e2c6e07e…`), 357 s. Totais iguais aos da v1: 438 páginas, 388 com o texto do PDF e 50 por OCR (os mesmos por documento), nenhuma sem texto. A v1 (`cce780ce…`) ficou preservada, despublicada. As tabelas das propostas passaram de 1,6 MB para 3,0 MB. Qualidade medida em 365 páginas: maiores valores 0,4 % (nº 16) e 9,9 % (nº 30), abaixo dos limiares.

Validação depois da carga (auditoria em `data/analysis/propostas-texto-2026-10-21T00-14-24.792Z/`):
- v1: 388 de 388 páginas nativas iguais ao `-layout`; v2: 388 de 388 iguais à remontagem; as 50 páginas de OCR da v2 idênticas às da v1; nenhum `search_text` divergente do `searchText` atual;
- simulação da busca: os mesmos números do protótipo (151 pares só na v1, nenhum no `-raw`; 1.300 só na v2);
- API: "acessibilidade" encontra as mesmas páginas da v1 em todas as candidaturas; "inflação" passa a aparecer em 6 páginas do nº 22 e "responsabilização" na p. 33 do nº 30 (trecho "responsabiliza- ção"), que a v1 não encontrava; "bemestar" encontra a quebra "bem-/estar" (nº 13, p. 14 e sete páginas do nº 22); "presal" não encontra "pré-sal" escrito no meio da linha.

Verificação: typecheck, 128 testes, builds, nove smokes (o `smoke:context` com o bloco da v2), `check:data`, `check:regressions`, `check:publication` e `check:ui` (Chrome e Firefox, `/propostas` com e sem busca em três larguras, sem violações). Detalhes no plan.md §48.

Fora da v2, sem reimportação, feitos em 20/10 (plan.md §47):
- `SITE_URL` vazia ou ausente vale o padrão local; inválida interrompe a compilação com mensagem própria. O valor vai como argumento de build da imagem da web e fica nela, para páginas pré-renderizadas e dinâmicas.
- README e "Estado atual" do plan.md sem o "sem push" desatualizado.

## 20. Andamento — fase D3: preparação da rubrica (20/10/2026)

Decisões de Rafael em 20/10/2026:
- quem revisa ainda não está definido: preparar rubrica, protocolo e ferramentas, e a codificação espera;
- tema piloto: acessibilidade e mobilidade urbana;
- uma planilha CSV por pessoa;
- trechos localizados por busca literal com termos publicados.

O que foi feito:
- **Livro de códigos:** [rubrica das propostas](rubrica-propostas.md), versão `rubrica-acessibilidade-mobilidade-v1`. Traz o tema com inclusões e exclusões, 11 critérios documentais com valores e regras de decisão, evidência obrigatória, termos, procedimento, concordância, versionamento e decisões pendentes. Não tem nota, peso nem ordenação.
- **Código:**
  - `apps/importer/src/rubric-core.ts`: versão, termos, critérios, planilha, validação, kappa de Cohen e consolidação depois da adjudicação;
  - `apps/importer/src/rubric.ts`: `npm run rubric:packet` e `npm run rubric:agreement`, com o banco só em leitura;
  - 5 testes com dados sintéticos.
- **Termos:** medidos no corpus publicado antes de fixar a lista.
  - Muitos termos do tema não aparecem em nenhum plano (rampa, ciclovia, ciclofaixa, bicicleta, pedestre, piso tátil, iluminação pública, passe livre, VLT, BRT) e ficam na lista, que sai da definição do tema.
  - Saem os termos que a busca por trecho confunde com outras palavras: "trem" (extrema), "metrô" (metros, parâmetros), "PcD" (PCdoB), "cidades" (capacidades); e saem "urbana" e "urbano", amplos demais.
- **Pacote gerado** a partir da `proposals-2022-v2`, em `data/rubric/rubrica-acessibilidade-mobilidade-v1/pacote-2026-10-21T00-47-35.678Z/` (16 MB):
  - 12 PDFs conferidos pelo SHA-256 publicado e o texto publicado de cada página, de onde se copiam os trechos (nas páginas por OCR, a imagem não tem texto);
  - 132 trechos candidatos em 80 páginas — nenhum nos nº 14 e nº 27, onde a decisão depende da leitura;
  - modelo com 132 linhas (12 documentos × 11 critérios), manifesto e instruções.
  - Um primeiro pacote, sem os textos e nunca distribuído, foi substituído.
- **Ensaio do fluxo** com planilhas fictícias, gravadas fora do repositório e apagadas depois:
  - a validação conferiu um trecho real no texto publicado e recusou um trecho que não estava na página citada, sem calcular nada;
  - concordância, planilha de adjudicação e consolidação final, com a origem de cada valor, funcionaram.

Nada foi codificado nem publicado.

Atualização (24/10/2026): Rafael aceitou que uma das duas codificações seja feita por modelo de linguagem, declarada como tal; exigiu a leitura integral dos documentos; e decidiu declarar, em vez de mudar, a limitação de os critérios serem do documento e não de cada medida. A versão continua `v1` (seção 8 do livro de códigos).

Também em 24/10/2026: concordância mínima por critério (AC1 de Gwet ≥ 0,70) e codificação e adjudicação por contribuidores do projeto.

Ainda em 24/10/2026: "nas cidades" e outros recortes genéricos contam como território declarado; a versão é aprovada pela comunidade de contribuidores, num pull request (uma aprovação de outro contribuidor e nenhuma objeção sem resposta em 7 dias); a contestação é por formulário de issue do repositório, comum à bússola.

Pendente (seção 9 do livro de códigos):
1. abrir o pull request de aprovação;
2. forma e página de publicação.

## 21. Andamento — fase E: pesquisa documental (20/10/2026)

Só documentação pública: sem cadastro, download de microdados ou contato com instituições. As cópias dos documentos consultados, com origem e SHA-256, ficam em `data/analysis/pesquisas-prioridades-2026-10-20/`, fora do Git e sem redistribuição.

**ESEB 2022 (CESOP/Unicamp, pesquisa nº 04810)**

Quatro documentos públicos dão 2.001 entrevistas, com campo iniciado em 19/11/2022:
- a página do estudo no CESOP (até 04/12/2022, em 119 municípios dos 27 estados);
- a metodologia (`Met_04810`, PDF de 21/09/2023: de 19/11 a 04/12/2022);
- as tabelas de frequência (PDF de 15/09/2025), com cabeçalho "Tamanho da Pesquisa: 2001" e total de 2001 em todas as variáveis;
- o relatório de desenho do CSES Módulo 6, preparado pela Quaest em 26/07/2024: "2001 respondents" e início em 19/11/2022. Esse relatório traz a eleição como de 2024 e o fim do campo como "12/04/2018", erros de digitação; os 48 e 20 dias entre os turnos e o início conferem com 19/11/2022.

A ficha técnica ligada ao catálogo (`FichaTec_04810`, exportada do Google Docs) é o único documento com 1806 entrevistas e data "10/2022"; a página do catálogo traz "11/2022".

Leitura: a ficha técnica diverge de todos os demais, e 2.001 é a contagem mais sustentada. Só o arquivo de microdados confirma. A ficha não é "corrigida" aqui: se houver cadastro, conferir no arquivo o número de casos e as datas e então comunicar a divergência ao CESOP.

Diferenças menores entre os documentos:
- municípios: 120 no texto da metodologia, 119 na tabela por UF da própria metodologia e do CSES;
- seleção de domicílios: pular duas casas (metodologia) ou três (CSES);
- referência das cotas: TSE 2022 ou 2018.

Desenho:
- municípios e setores censitários (Censo 2010) sorteados por probabilidade proporcional ao tamanho; a seleção final é por cotas, sem probabilidade;
- representativa do país e das cinco regiões;
- peso obrigatório (variável "peso", pós-estratificação); margem de cerca de 2 pontos sob amostra aleatória simples.

Conteúdo: não há pergunta de prioridade nem de "problema mais importante". Há democracia e voto (módulo CSES) e posições a favor ou contra temas controversos (Q31: maioridade penal, aborto, cotas raciais, privatizações e outros).

Condições do cadastro no CESOP:
- dados pessoais no cadastro (nome, nascimento, endereços, telefone; CPF opcional);
- vetados o uso comercial, a redistribuição dos microdados e a sua publicação em outras plataformas sem autorização;
- citação obrigatória ("Centro de Estudos de Opinião Pública/Unicamp. Pesquisa de Opinião. Banco de Dados do CESOP/Unicamp, Campinas.");
- envio de cópia dos trabalhos a cesopsit@unicamp.br.

**LAPOP AmericasBarometer Brasil 2023**

Desenho (relatório técnico v5.0, 07/03/2024):
- 1.526 entrevistas presenciais, de 06/06 a 04/07/2023, com campo do IPEC;
- amostra probabilística da população em idade de votar, estratificada pelas cinco regiões, pelo porte do município e por área urbana ou rural;
- 125 unidades primárias e 250 pontos em 24 estados e no DF, 22 deles substituídos; base no Censo 2010;
- margem de ±2,51, com recomendação de considerar o efeito do desenho;
- peso obrigatório: `wt`, ou `weight1500` nas comparações entre países;
- representativa do país e das regiões, não de UFs nem de municípios.

Questionário v9.3.3.3, em português:
- A4N: "Na sua opinião, qual é o problema mais grave que o país está enfrentando?", resposta única e espontânea;
- categorias amplas: economia, segurança, serviços básicos, política, desemprego, corrupção, COVID-19, alimentação, educação e outros; transporte e mobilidade não têm categoria própria;
- módulos experimentais só são liberados depois de dois anos.

Condições:
- dados públicos gratuitos;
- os arquivos não podem ser repassados a terceiros, nem a revistas, por força do contrato de usuário; a replicação se faz por link e código;
- citação com LAPOP Lab, título, ano da coleta, versão e editora;
- a página não trata de uso comercial, e o texto integral do contrato só aparece no download.

**Implicações**
- Nenhuma das duas pode ser espacializada abaixo das regiões.
- Estimativas só nacionais ou regionais, ponderadas, com incerteza, versão do arquivo e citação, nunca apresentadas como números do TSE ou do Censo.
- Os microdados não podem ser republicados em nenhum dos dois casos: o observatório só mostraria agregados calculados por ele, citando a fonte e, no caso do CESOP, enviando cópia.
- Para "prioridades declaradas", só o LAPOP 2023 tem a pergunta. As posições sobre temas controversos do ESEB 2022 exigiriam cuidado próprio de neutralidade.

Decisões de Rafael:
1. seguir ou não, sabendo que o próximo passo exige cadastro no CESOP, com dados pessoais, ou aceitar o contrato do LAPOP no download;
2. qual pesquisa usar;
3. no caso do ESEB, conferir o número de casos e as datas no arquivo e comunicar a divergência ao CESOP.
