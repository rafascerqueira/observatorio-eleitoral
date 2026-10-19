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
| Paralela | D — Propostas de governo | Inventário; busca literal com página; rubrica com revisão humana | Download pequeno (cerca de 20 MB), código e revisão humana | Definição de quem revisa, para D3 |
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
- **D3. Rubrica (só com revisão humana definida).** Tema piloto ligado à fase C (ex.: acessibilidade e mobilidade urbana), aplicado a todos os planos da Presidência. Codificação independente por duas pessoas, adjudicação, concordância medida e publicada, versão da rubrica e canal de contestação. IA pode sugerir trechos, nunca publicar sem revisão.
- **D4.** Governadores só depois da avaliação da D3; Senado fora da obrigação legal de apresentar plano.

## 8. Fase E — prioridades declaradas

Somente pesquisa documental: esclarecer a divergência do ESEB 2022 (2.001 × 1.806 entrevistas; novembro–dezembro × outubro) pela documentação do CESOP e conferir licença e termos do LAPOP Brasil 2023. Cadastro em acervos, contato com instituições e download de microdados dependem de Rafael. Respostas de pesquisas nacionais não são espacializadas.

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
| 10 | Revisão humana (D3) | Definir quem revisa antes de iniciar a rubrica |

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
