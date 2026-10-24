# Contexto do projeto — Mente Eleitoral

Criado em 12/10/2026 e revisado em **22/10/2026**. Fonte de verdade sobre finalidade, princípios, decisões e continuidade do projeto. O resumo abaixo descreve o estado vigente; os registros a partir do §12 preservam o estado de cada marco, inclusive pendências depois resolvidas. Nome definido: **Mente Eleitoral**, identidade 03A (petróleo e terracota), conforme §37. Licença continua sem decisão.

## Estado atual

Implementação e dados disponíveis **localmente**, sem implantação externa. A entrega de código, testes e auditorias dos §§26–28 está no commit `825dffb`; a revisão documental posterior está registrada no §30. As fases A, C, B (B1–B3), D1 e D2 do [plano de melhorias](docs/plano-postgis-propostas.md), a identidade visual e a revisão de código de 20/10 (§§33–46) foram verificadas e estão em `upstream/main`. A `proposals-2022-v2` da busca nas propostas, decidida por Rafael com a auditoria do §47, está publicada e verificada no banco local (§48). A rubrica da D3 está preparada, sem codificação, à espera de quem codifica e adjudica (uma das codificações pode ser de modelo, §57), e a pesquisa documental da E está feita (§49). Next.js em 16.4.2 por aviso de segurança (§50). Bússola política no modelo Kieskompas (§§51–53): 24 afirmações aprovadas, concordância mínima decidida (kappa ponderado ≥ 0,70 por eixo), pacote gerado e cálculo pronto, à espera de quem codifica. 2026 avaliado e adiado para depois do 2º turno (§§51–52). Próximo: quem codifica e adjudica (D3 e bússola, **pendente por decisão de Rafael em 22/10**), ESEB ou LAPOP (E), hospedagem e, depois de 25/10, a carga de 2026.

| Frente | Situação em 20/10/2026 |
| --- | --- |
| Resultados eleitorais | Presidência 2022 nacional e exterior; Governador e Senador nas 27 UFs, com turnos e categorias não válidas auditados. Deputados fora do escopo; 2026 e suplementar de RR não importados. 2026: avaliação do 1º turno em [avaliação de 2026](docs/avaliacao-2026-primeiro-turno.md); carga dos dois turnos depois de 25/10, com o Senado de duas vagas listado por votos e eleitas destacadas pela situação do TSE (§52). |
| IBGE e perfis TSE | Contexto municipal, mapas, associação local → setor, perfil por local, faixas de renda, participação por perfil, demografia, grupos, sensibilidade e entorno dos domicílios (§34) publicados no banco local. Nove versões atuais e ordem de importação em [operação local](docs/operacao.md); IDs e auditorias em [reimportações](docs/reimportacoes-2026-10-18.md). |
| Interface | Busca com sugestões, listagem municipal compacta/paginada, detalhe de todas as candidaturas, formulários GET sem JS, participação por município/estado civil e mapas por candidatura concluídos. Fase A (§33): setor censitário em cada local e quadro do município por situação; em `/mapa`, abstenção do cargo ou candidatura à escolha, dispersão e exportação CSV. Fase C (§34): entorno dos domicílios no painel do município, no cartão do local e em oito indicadores de `/mapa`. Fase B3 (§41): setores e locais em `/municipios/[code]/setores`. Fase D2 (§43): busca literal nas propostas da Presidência em `/propostas`; na v2 (§48), texto em ordem de leitura das colunas, ligaduras e hífens de fim de linha tratados. |
| Identidade | **Mente Eleitoral**, com a identidade 03A (petróleo/terracota), símbolo M/conexões e frase “Um olhar único sobre votação e população”. Marca aplicada ao site, ícones, banner inicial, compartilhamento e README (§37). |
| Robustez e rastreabilidade | Isolamento por ano/cargo; downloads de relatórios/originais, inclusive GeoPackage; distinção entre falha técnica e ausência na fonte; dependências versionadas e publicação bloqueada por divergência. |
| Última verificação da aplicação | 86 testes, typecheck/build, nove smokes, 31 regressões HTTP e 60 avaliações automáticas em Chrome/Firefox aprovados em 19/10; nove reexecuções idempotentes e duas comparações integrais das 11 tabelas, com dados anteriores preservados (§28). Fase A (§33): 98 testes, typecheck/build, nove smokes, 31 regressões e 66 avaliações automáticas em Chrome/Firefox, com os envios dos formulários com e sem JavaScript. Fase C (§34): 106 testes, typecheck/build, nove smokes, 31 regressões e `check:ui` completo nos dois navegadores, com novo cenário de acessibilidade de detalhes abertos. D2 (§43): typecheck, testes, build, nove smokes, `check:data`, `check:regressions`, `check:publication` e `check:ui` com `/propostas`. Revisão e auditoria de 20/10 (§§44–47): typecheck e testes (123 no §47); no §47, também os nove smokes; sem `check:ui`. V2 das propostas (§48): typecheck, 128 testes, build, nove smokes, `check:data`, `check:regressions`, `check:publication` e `check:ui`. |
| Operação | npm workspaces, Node 24.21.0, Next.js/NestJS, PostgreSQL/PostGIS e `pg_trgm`. Acesso por `pg`, sem Prisma. API/web temporárias encerradas no fim da verificação; banco preservado. |

### Pendências vigentes

- **Antes de declarar acessibilidade completa:** leitor de tela humano, Safari e dispositivos reais, zoom de texto/alto contraste do sistema. Chrome/Firefox e verificações automáticas já foram realizados; não substituem esses ensaios.
- **Próximo marco de operação:** decidir hospedagem com Rafael após o pacote local concluído. O importador das propostas depende de pacotes do sistema (`poppler-utils`, `tesseract-ocr`, `tesseract-ocr-por`), que a API e a web não usam: importar localmente e levar o banco com `data/originals` e `data/audit`, ou criar uma imagem do importador com Ubuntu 24.04 para reproduzir as versões da publicação (§48). A análise de 17/10 é histórica; preço, região, capacidade e desenho final precisam de validação antes de contratar/implantar. Backup teve checksum e catálogo conferidos; restauração completa e carga no ambiente de destino ainda não ensaiadas.
- **Decisões abertas:** licença e eventual tratamento da suplementar de Governador de RR/2026. Nome e identidade definidos no §37. Qualquer novo recorte exige decisão e auditoria próprias; deputados não são uma tarefa automática da fila. Fases A, C, B (B1–B3), D1 e D2 do [plano de melhorias](docs/plano-postgis-propostas.md) concluídas; D3 preparada (rubrica, pacote e ferramentas) à espera de quem codifica e adjudica (§57), e E com a pesquisa documental feita (§49); as decisões pendentes estão nas seções 20 e 21 do plano. As cinco decisões da `proposals-2022-v2` (seção 19 do plano) foram tomadas por Rafael em 20/10 (seguir as recomendações), e a v2 está publicada (§48).
- **Investigação IBGE × TSE por faixa etária (pedida por Rafael em 19/10):** concluída no §40. Não é defeito de cálculo; é diferença entre as fontes (domicílio eleitoral ≠ residência, registros que o Censo já não conta, datas de referência das idades). Nota acrescentada à tabela e à metodologia; nenhum número ajustado.
- **Bússola política (§53):** livro de códigos aprovado; pendente quem codifica e quem adjudica (a mesma pendência da D3, deixada em aberto por Rafael em 22/10); depois, publicação `compass-2022-v1`, conferência externa e página `/propostas/bussola`.
- **Limpeza dos lotes não publicados (§52):** autorizada para o início da carga de 2026, com backup antes; 52 lotes inventariados, nenhum citado pelas publicações vigentes.
- **Manutenção registrada, sem execução autorizada nesta etapa:** renomear a coluna `responsible_with_income`, sem uso na interface. Enriquecimento da busca com distritos do IBGE é possibilidade, não compromisso de implementação.

A página longa, autocomplete, relatório em modo dev, participação por município/estado civil, sensibilidade e mapas por candidatura **já foram resolvidos**. Não recolocá-los na fila com base em listas antigas. O §11 organiza a continuidade; o histórico registra como as decisões foram tomadas.

## 1. Finalidade e intenção do autor

O autor deseja criar um dashboard de acesso público e gratuito para explorar os resultados eleitorais brasileiros junto ao contexto demográfico e socioeconômico dos territórios.

A inspiração é o livro O Cérebro Político, aparentemente The Political Brain, de Drew Westen. A referência inspira o interesse pelo comportamento político; suas conclusões não serão presumidas válidas para o Brasil. O MVP não fará inferências psicológicas.

O projeto começa pequeno com dados oficiais do TSE e IBGE. Não deve partir de uma tese política a confirmar nem exigir um conjunto extenso de perguntas de pesquisa antes da obtenção dos dados. O público poderá formular questionamentos a partir da exploração.

## 2. Princípios acordados

- Independência partidária e mesmos recursos, filtros e fórmulas para todas as candidaturas e partidos.
- Não produzir conclusões editoriais automáticas ou orientar o visitante para uma interpretação política.
- Mostrar distribuições e valores; não classificar pessoas ou lugares automaticamente como de direita, de esquerda, apolíticos, ricos ou pobres.
- Posições de candidaturas (bússola política, decisões de 22/10/2026, §§53–54) só por duas codificações independentes e documentadas dos próprios planos de governo (uma pode ser feita por modelo de linguagem, declarada na publicação) e adjudicação humana, com método, trechos e incerteza publicados; sem afinidade com o visitante, recomendação ou rótulos pejorativos.
- Abstenção, brancos e nulos não identificam motivação nem condição apolítica.
- Fontes, definição de variável, ano de referência, cobertura e denominador sempre consultáveis.
- Ausência absoluta de viés não pode ser garantida: escolhas metodológicas devem ser explícitas, testadas e revisáveis.
- Diferentes perspectivas devem ter critérios consistentes; explicações não recebem o mesmo peso quando a evidência difere.
- Não prometer ineditismo: já existem produtos brasileiros com mapas eleitorais e indicadores socioeconômicos.

## 3. Escopo inicial e apresentação

A primeira entrega priorizou tabelas por município e detalhe dos locais. Hoje há filtros por ano, turno, cargo e território, listagem compacta paginada e detalhe nativo com todas as candidaturas, além de mapas e perfis (§§21–28). Manter leitura simples, tabelas equivalentes às visualizações e uso em telas pequenas, sem depender de JavaScript para consultar os formulários e abrir o detalhe municipal.

Exibir votos absolutos e percentuais de todas as candidaturas, aptos, comparecimento, abstenção, brancos e nulos. A diferença entre candidaturas pode ser mostrada em pontos percentuais, com definição explícita do par comparado.

Apresentar os indicadores do IBGE na escala realmente disponível. A distribuição em faixas de renda só entra onde os arquivos e dicionários confirmarem essa informação; não fabricar distribuição a partir de médias.

Liderança não é maioria absoluta: 40% dos votos válidos pode ser o maior percentual sem ultrapassar 50%. Agregações regionais usam soma dos votos e denominadores correspondentes, não média simples dos percentuais municipais.

Preservar a granularidade das seções na base e agregá-las por local de votação para explorar o contexto do entorno. Município é o ponto inicial mais simples de cruzamento entre fontes.

## 4. Anos e cargos

O interesse original abrange 2022 e 2026; o **escopo implementado e auditado é 2022**: Presidência nacional e exterior, Governador e Senador nas 27 UFs. Os turnos permanecem separados; o Senado de 2022 tem turno único e uma vaga por UF. Deputados foram retirados do escopo por decisão de 17/10 (§20).

Resultados de 2026 e a suplementar de Governador de RR não foram importados. Não são extensão automática da carga de 2022: precisam de recorte decidido com Rafael, fontes auditadas e regras próprias, inclusive para Senado com duas vagas. Resultados por zona/seção já existiam em 2022; cobertura, localizações e denominadores devem ser auditados em cada novo recorte.

Não presumir que resultados de 2026 ou localizações estejam completos só porque o catálogo os apresenta. Verificar arquivos, geração, cobertura e situação de totalização. Não inventar resultados de turnos ainda não realizados. Comparações só são publicadas depois da validação de cada conjunto.

Um exemplo mencionado pelo usuário sobre Rio de Janeiro, Niterói e interior não foi validado nesta conversa e não deve ser tratado como conclusão.

## 5. Associação geográfica

- Seção é um agrupamento eleitoral; local de votação é o prédio; zona é uma unidade administrativa. Não equivalem automaticamente a bairro ou setor censitário.
- O endereço do local mostra onde o eleitor vota, não onde mora.
- O entorno socioeconômico é uma aproximação do contexto territorial. Não atribuir sua renda aos eleitores inscritos.
- Método publicado: setor que contém a coordenada do local, com município validado pela correspondência oficial TSE–IBGE e associação recusada quando ambígua. A coordenada não identifica residência.
- Sensibilidade implementada: faixa predominante nos setores do mesmo município a até **250 m, 500 m e 1 km**, com comparação à associação pelo ponto (§25; detalhes em `docs/plano-ibge.md`). É uma análise alternativa, não substitui a métrica publicada. Casos sem associação confiável continuam separados.
- Várias seções no mesmo prédio compartilham contexto geográfico; não tratá-las como observações socioeconômicas independentes.
- Não calcular renda média do entorno pela média simples das médias de setores: usar os denominadores apropriados quando disponíveis. Não agregar medianas como se fossem médias.
- Associação territorial não demonstra causa, motivo individual, ideologia ou transferência individual de votos entre eleições.
- Comparar seções e locais entre anos exige conferir mudanças, agregações, transferências e correspondências. Números iguais não bastam para garantir continuidade.

## 6. Renda e salário mínimo

O usuário prefere métricas objetivas e faixas em salários mínimos, sem rótulos fixos de classe.

Distinguir rigorosamente:

1. Rendimento do responsável pelo domicílio.
2. Renda domiciliar total, conforme definição da fonte.
3. Renda domiciliar per capita.

Renda domiciliar não deve ser chamada automaticamente de renda familiar. O salário mínimo é uma unidade de expressão da renda, não uma segunda renda. Registrar valor, vigência e período de referência. Para renda de 2022, usar uma referência de 2022 explicitada; comparações temporais de poder de compra exigem tratamento próprio.

As fontes implementadas distinguem classes de rendimento domiciliar per capita da amostra municipal (SIDRA), valores per capita em reais e **mediana do responsável com rendimento por setor** (V06006, dicionário conferido). As faixas do entorno classificam setores pela sua mediana; os moradores entram integralmente na faixa do setor, sem inferir a renda de cada pessoa. Isso não é uma distribuição individual de renda nem demonstra renda domiciliar total/per capita na escala de setor. Células omitidas e diferenças não discriminadas ficam explícitas, sem preenchimento. Novas camadas exigem conferência própria de arquivo e dicionário.

## 7. Fontes e referências

Fontes prioritárias:

- Portal TSE: https://dadosabertos.tse.jus.br/
- Resultados 2022: https://dadosabertos.tse.jus.br/dataset/resultados-2022
- Resultados 2026: https://dadosabertos.tse.jus.br/dataset/resultados-2026
- Eleitorado: https://dadosabertos.tse.jus.br/group/eleitorado
- IBGE Censo 2022: https://www.ibge.gov.br/estatisticas/sociais/populacao/22827-censo-demografico-2022.html
- Rendimento do responsável: https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel/

Perfil cadastral do TSE descreve inscritos, sem indicar voto de cada grupo. Códigos TSE e IBGE precisam de correspondência validada; não cruzar apenas por nome municipal.

Referências de produtos levantadas, sem auditoria integral:

- https://electomaps.com.br/eleicoes — distingue perfil cadastral e entorno censitário.
- https://hubpolitico.com.br/mapa — anuncia cruzamentos eleitorais e socioeconômicos.
- https://datapedia.info/
- https://votehub.com/2024-map/
- https://github.com/nytimes/presidential-precinct-map-2024

Fontes futuras, fora do MVP: CESOP/ESEB para atitudes individuais (https://www.cesop.unicamp.br/por/eseb), Ipea, RAIS/Caged e MDS. Surveys não devem ser presumidos representativos de cada município.

## 8. Direção técnica implementada

Monorepo TypeScript com **npm workspaces**, Node 24.21.0 e npm 12.2.0 como referência de desenvolvimento (requisitos em `.nvmrc`/`package.json`). Next.js 16/React no frontend, NestJS na API, scripts TypeScript no importador e PostgreSQL/PostGIS com `pg_trgm` no Compose. Versões exatas e decisões em `docs/decisoes-tecnicas.md` e nos manifests/lockfile. Acesso SQL por `pg`; Prisma não foi adotado e não é pré-requisito pendente para a entrega atual.

- `apps/web`: consultas, detalhe territorial, mapas, perfis, participação, fontes e metodologia; SSR e formulários GET.
- `apps/api`: leitura com contratos Zod, paginação, validação territorial e de dependências; originais/relatórios em fluxo.
- `apps/importer`: obtenção e preservação de originais, auditoria, preparação, reconciliação e publicação transacional.
- `packages/contracts`: contratos e fórmulas compartilhados, consumidos pelo `dist/` compilado.
- `scripts` e `docs`: execução local, smokes/auditorias, decisões e evidências de cada marco.

Importações fora das requisições do visitante. Preservar originais e versões anteriores; preparar, validar e só então trocar a publicação. Usar SQL em lote e agregados por território, sem enviar a base nacional inteira ao navegador. A fase espacial usa PostGIS; seção, local e setor mantêm chaves/universos próprios.

Backend único, sem microserviços, Redis ou filas sem necessidade demonstrada. Compose é ambiente local; a web empacotada usa saída `standalone`, conforme o Dockerfile. Hospedagem, limites de carga e restauração em destino exigem verificação própria antes de implantação autorizada. Nome definitivo: Mente Eleitoral (§37); licença permanece em aberto.

## 9. Validação e rastreabilidade

- Arquivo original, URL, checksum, data de download/geração e versão do importador.
- Relatório de cobertura, descartes, campos ausentes e conflitos.
- Nulos não viram zeros automaticamente.
- Duplicatas conflitantes não são descartadas silenciosamente.
- Reexecução idempotente: não duplicar dados.
- Chaves incluem eleição, turno, cargo e unidade pertinente.
- Validar aptos, comparecimento, abstenção e denominadores segundo os dicionários; reconciliar agregados com totais oficiais do mesmo recorte.
- Conferir cardinalidade das junções para impedir multiplicação de votos.
- Denominador zero deve gerar estado sem percentual, não valor inventado.
- Dados fictícios apenas em testes, claramente separados dos dados públicos.
- Testar fórmulas e invariantes relevantes; garantir reprodução das tabelas publicadas.

## 10. Revisão do repositório esteleicao

Referência: https://github.com/ralbuque/esteleicao — revisão do commit 69d8fdd (11/10/2026).

Objetivo diferente: detectar seções atípicas em abstenção baixa, horário tardio e habilitação manual. Usa Python, pandas, Parquet, Plotly e Streamlit. Não encontrei IBGE, renda, geometrias censitárias ou votos por candidatura.

Referências úteis: leitura em blocos, Parquet antes da interface, download retomável/HTTP Range com CRC, navegação por local e separação de taxa agregada e média de taxas.

Achados a evitar:

- Conversão de valores inválidos para zero.
- Remoção de duplicatas mantendo primeira sem resolver conflitos.
- Inconsistências geram aviso, mas seguem para análise.
- Nome do Parquet ignora cargo, permitindo sobrescrita entre importações.
- Estimativa de fuso pela abertura confunde atraso com deslocamento: chamada fuso_por_abertura(9, 'SP') retornou 1.
- Critérios de alerta dirigidos a padrões específicos não atendem à exploração aberta pretendida.
- Não encontrei licença explícita nem suíte automatizada/CI; confirmar licença antes de copiar código.

Limites da revisão: leitura de código e documentação, importação dos módulos analíticos e teste pontual do fuso. Painel não executado; dados oficiais nacionais não baixados; validações nacionais relatadas pelo autor não reproduzidas. Logs de urna ficam fora do MVP.

## 11. Continuidade e próximos marcos

Ao começar, ler o resumo vigente, o último registro deste plano e `git log`/`git status`, seguindo `AGENTS.md`. Estrutura executável, piloto, expansão de 2022, integração IBGE, interface, correções e reimportações estão concluídos; não reinicializar o projeto nem repetir cargas para aparentar progresso.

1. **Manter a entrega local validada:** preservar publicações, originais, relatórios e backups; conferir o estado deixado no Git e não executar importações concorrentes. Comandos e dependências em `docs/operacao.md` (antes no README); última auditoria integral no §28.
2. **Avançar na hospedagem com Rafael:** retomar `docs/hospedagem-inicial.md`, escolher a estratégia e validar custos/capacidade atuais. Preparar configuração, restauração e ensaios de carga no destino antes de uma implantação explicitamente autorizada. O estudo de 17/10 não é orçamento vigente nem escolha de provedor.
3. **Planejar os ensaios manuais de acessibilidade:** leitor de tela, Safari/dispositivos reais e preferências do sistema; registrar os resultados sem ampliar a cobertura declarada dos testes automáticos. Esses itens não foram resolvidos pela revisão documental.
4. **Tratar manutenção ou expansão separadamente:** limpeza de armazenamento, eventual migração de nomes de colunas, distritos na busca, suplementar de RR e 2026 só entram conforme decisão/necessidade registradas. Deputados continuam fora do escopo.

Não expandir automaticamente para IA, modelos psicológicos, classificação ideológica ou alertas de fraude. Não contratar, implantar ou alterar recorte sem instrução. Ao concluir cada marco, registrar o que foi feito, verificado e pendente, distinguindo publicação no banco local de implantação externa.

Pesquisa exploratória solicitada por Rafael em 19/10: [PostGIS, contexto territorial e propostas de governo](docs/estudo-postgis-propostas.md), registrada no §31. As alternativas e os marcos ali propostos ficam para discussão; a próxima implementação, a fonte adicional e eventual UF piloto ainda dependem de definição de escopo.

Plano de melhorias derivado dessa pesquisa: [território, PostGIS e propostas de governo](docs/plano-postgis-propostas.md), registrado no §32. Propõe a ordem A → C → B, com propostas de governo em trilha paralela; nenhuma fase começa sem as decisões listadas no plano (seção 10). A fase A, aprovada por Rafael em 19/10, está implementada, verificada e no commit local `d66540c`, sem push (§33). A fase C, aprovada na mesma data por acrescentar cerca de 34 MB, está publicada no banco local, verificada e em commit local, sem push (§34). Rafael definiu a sequência: fase B e depois D, mas só começar cada uma com novo aviso dele; E sem decisão.

## Histórico de implementação

Os registros abaixo preservam as decisões e limitações **na data de cada etapa**. Expressões como “pendente”, “sem commit” ou “não verificado” não representam necessariamente o estado atual; consultar o resumo vigente e os marcos posteriores. Medidas de volume, desempenho e preços são retratos históricos, não garantias atuais.

## 12. Registro de implementação — 12/10/2026

Iniciada a implementação do primeiro marco em monorepo npm workspaces: Next.js 16.4.0 / React 19.3.0, NestJS 12.1.3, TypeScript 5.9.3 e PostgreSQL 18.6 em Docker Compose, com Node.js 24.21.0 LTS. As escolhas e referências oficiais estão em `docs/decisoes-tecnicas.md`; a inicialização está no `README.md`.

Criados frontend com formulário de consulta, tabela sem dados inventados, páginas de fontes/metodologia e estados distintos de ausência de importação e indisponibilidade; API com configuração validada, saúde do processo e verificação real do PostgreSQL. Contratos compartilhados validam filtros e resposta inicial. O endpoint de municípios ainda retorna apenas `awaiting-import`; não há consulta eleitoral nem importador implementado.

Prisma continua pendente; o marco inicial usa o driver `pg`. Não foram baixados arquivos TSE/IBGE nem definidos esquema eleitoral, recorte piloto ou método geográfico. Próxima decisão: escolher com Rafael o recorte pequeno antes de auditar e importar dados reais. Nome, licença e hospedagem seguem pendentes.

Primeiro marco validado com verificação de tipos, quatro testes, build local, builds Docker e smoke contra os serviços locais. Também verificado o comportamento real de indisponibilidade com parada temporária e restauração do banco. Os serviços ficaram em execução local em `http://localhost:3000` (web) e `http://127.0.0.1:3001` (API). Não houve publicação externa. Revisão visual e auditoria completa de acessibilidade permanecem pendentes.

## 13. Piloto São Paulo — 12/10/2026

Rafael definiu o município de São Paulo como piloto e solicitou testes e análise. Implementada importação de Presidência 2022, eleições 544/545, cargo 1, código municipal TSE 71072, preservando os turnos separados. O importador TypeScript usa leitura CSV Latin-1 em fluxo, originais ZIP preservados com SHA-256 e carga PostgreSQL em lotes, publicada em transação apenas após reconciliação por zona e candidatura.

Carregados 325.089 registros seção/votável, com 58 zonas, 26.288 seções principais e 2.049 identificadores zona/local em cada turno. Geração das seções: 01/11/2022; arquivos municipais: 11/10/2026. As somas coincidiram exatamente. O campo de pendência de totalização final está ausente no CSV municipal, limitação registrada.

Identificada divergência de nome no local 1430 da zona 258, nos dois turnos, com endereço comum. Campos divergentes ficam indisponíveis; variantes são preservadas e exibidas. Não foi feita associação geográfica ou ao IBGE. Aptos e abstenção por local continuam indisponíveis.

O painel agora consulta agregados reais e expõe municípios e locais paginados; participação não é repetida entre candidaturas. Fontes e metadados são consultáveis. Oito testes, tipos, builds e smoke com os dois turnos passaram; reexecução com os mesmos checksums confirmou idempotência. A análise descritiva está em `docs/analise-sao-paulo-2022.md`, com artefatos reproduzíveis em `data/audit` e `data/analysis`. Não houve publicação externa nem importação de 2026. Próxima etapa: auditar o IBGE municipal e a correspondência de códigos para São Paulo.

## 14. Busca nos locais e avaliação funcional

Atendendo à solicitação de Rafael, adicionada busca combinada por zona, seção, código do local e nome/endereço. A busca textual ignora caixa e acentos e inclui as variantes de metadados. Identificadores aceitam zeros iniciais. Seção localiza o local correspondente pelos registros já importados; a interface deixa explícito que os totais apresentados são do local inteiro.

Adicionados lista clicável de seções por local, botão de limpeza, contagem de resultados, paginação acima e abaixo, filtros preservados na URL e estados distintos para ausência de correspondência, página fora do intervalo e falhas. Nova busca e troca de turno reiniciam na primeira página. Índice adicional de seção aplicado ao PostgreSQL, sem reimportação ou alteração de resultados.

Verificação: 12 testes, tipos e build local; smoke do piloto e 40 requisições específicas da busca com a base real, nos dois turnos. Avaliação registrada em `docs/avaliacao-busca-locais.md`; inspeção visual em navegador e auditoria completa de acessibilidade permanecem pendentes por indisponibilidade de superfícies de navegador nesta sessão.

## 15. Prioridade acordada — expansão de 2022

Rafael aprovou avançar primeiro na Presidência de 2022 para os municípios das 27 UFs, priorizando a transparência objetiva: arquivos consultáveis, datas, checksums e cobertura. Depois, governador e senador por UF; deputados com apresentação resumida, preservando os dados e denominadores completos. A integração IBGE/espacial fica posterior a essa prioridade; não foi autorizada publicação externa.

Implementada preparação nacional em fluxo por UF/município, tabelas com chaves territoriais completas e checkpoints transacionais por município. A versão pública anterior permanece ativa até todos os municípios domésticos passarem nas verificações dos dois turnos. ZZ é explicitamente separado, com originais e partições preservados, aguardando regra própria para o exterior e seções não instaladas.

A transparência distingue download do original imutável de consulta ao arquivo atual no TSE, registra a base da data de download e oferece cobertura por UF e relatório JSON com municípios/motivos. Acrescentados catálogo e rotas públicas somente leitura; Docker monta originais/relatórios somente para leitura. A consulta municipal e a busca de locais deixam de ser fixas em São Paulo. Métricas e validação da primeira carga nacional estão registradas em `docs/importacao-nacional-2022.md`.

Concluída a versão nacional `president-2022-national-v2`: 5.570 municípios reconciliados, nos dois turnos, sem bloqueios; 5.368.073 registros domésticos preservados no PostgreSQL. ZZ: 181 unidades e 12.663 registros separados. Corrigidos códigos municipais com/sem zero inicial, mantendo a tentativa v1 como rejeitada e nunca publicada. Manaus possui uma seção não instalada e 84 eleitores na categoria por turno; valores mantidos separados da abstenção e conferidos contra os originais.

Validação final: 19 testes, tipos, builds local/Docker, auditoria integral de persistência por município e turno/votável, 182 requisições nacionais (27 UFs/dois turnos), 40 de busca e três ZIPs baixados por HTTP com SHA-256 correspondente. Reexecução idempotente confirmada. Um timeout sob tarefas pesadas concorrentes motivou índice nacional específico de seção; a repetição concorrente passou. Relatório e métricas em `docs/importacao-nacional-2022.md`. Serviços locais saudáveis, sem publicação externa; governador/senador/deputados, exterior consultável, IBGE e 2026 permanecem etapas posteriores.

## 16. Formulários, exterior e explicação dos eleitores de seções não instaladas

Após aprovação de Rafael, implementado o primeiro refinamento dos formulários: turnos visíveis, cargo como contexto, UFs com nomes completos, filtros avançados separados, erros por campo sem descartar valores, GET compartilhável, feedback de consulta e movimento breve com respeito a movimento reduzido. Autocomplete e auditoria visual/teclado/leitor de tela permanecem pendentes.

A pedido de Rafael, publicada a Presidência 2022 do exterior em escopo próprio `ZZ`, com 181 localidades, dois turnos e 12.663 registros seção/votável. Corrigida a hipótese de país como zona: o exterior inteiro pertence à zona 1; não foi inventada correspondência país/localidade. O consolidado Brasil combina as publicações doméstica e exterior somente com fontes idênticas e cobertura completa, expondo ambas na transparência. Auditoria integral de persistência e reexecução idempotente sem divergências; registro em `docs/exterior-2022.md`.

Esclarecido o aviso dos 84 eleitores: são aptos da zona 68 de Manaus, vinculados a uma seção não instalada, não votos nem uma categoria somável entre turnos. O original não informa a causa. O aviso ganhou explicação e distribuição por localidade. Com ZZ, o total nacional dessa categoria é 657 eleitores em 47 seções por turno, sem reclassificação como abstenção. Não houve publicação externa ou importação de outros cargos.

## 17. Governador 2022 — piloto São Paulo — 15/10/2026

Seguindo a prioridade do §15, Rafael escolheu SP como UF piloto para Governador. A unidade publicada é a UF inteira (645 municípios); o resultado da UF é a soma dos municípios reconciliados. Senador e as demais UFs não foram importados.

Auditoria prévia dos originais: governador usa as eleições 546/547 e o cargo 3; os votos por seção dos cargos estaduais estão no ZIP da UF (`votacao_secao_2022_SP.zip`, 859 MiB, baixado nesta etapa com `Last-Modified` registrado), não no ZIP BR da Presidência. Em SP não há anulados, sub judice, legenda, trânsito nem seções não instaladas no cargo; somas por seção coincidem com nominal e apuração nos dois turnos. Os aptos de governador diferem entre turnos e dos da Presidência; a diferença não foi interpretada.

Implementação: `ElectionScope` parametriza cargo, eleições e turnos no modelo, mantendo a Presidência como padrão e sem alterar `national.ts`/`exterior.ts` nem as publicações existentes. Novo importador `state.ts` (`import:state -- --office governor --uf SP`, versão `governor-2022-state-v1`), com verificação persistida antes da troca pública. Contratos aceitam `office=governor`, nível `state` e `rounds` opcional. API: cargo estadual exige UF; nova rota `GET /elections/state` (também para a Presidência por UF). Web: seletor de cargo, erro por campo para cargo estadual sem UF ou com ZZ, resultado da UF acima da lista de municípios, cargo preservado em locais e transparência. UF sem 2º turno fica bloqueada até a consulta distinguir turno não realizado de dado não importado.

Publicada a versão `3028e9d1…` com 645/645 municípios e 1.201.986 registros; 41 testes, tipos, build, smoke de governador contra totais dos originais e regressão completa da Presidência passaram; reexecução idempotente. Detalhes em `docs/governador-2022.md`. Sem publicação externa. Pendentes: revisão visual/acessibilidade em navegador, UFs sem 2º turno e expansão às demais UFs; senador depois (2022 elegeu uma vaga; 2026 terá duas).

## 18. Governador 2022 nas 27 UFs — 15/10/2026

Seguindo o combinado, primeiro a consulta passou a distinguir turno não realizado (`round-not-held`, a partir de `dataset.rounds`) de dado não importado; depois Governador foi expandido às 27 UFs.

A auditoria prévia mostrou que só 10 UFs cabiam nas regras do piloto: as demais têm votos Anulado (BA, GO, MS, MG, PB, PR, PI, SC, TO), Anulado sub judice (AM) ou nulos técnicos (AP, DF, PE, PI, RJ, RS, SE — 457.922 em SE), e RR traz nas mesmas entradas a Eleição Suplementar de Governador de 21/06/2026 (código 6278). Rafael decidiu: (1) categorias não válidas exibidas por categoria e com identificação da candidatura e classificação do TSE, fora do denominador dos válidos, com nulos técnicos contidos nos nulos; (2) excluir a suplementar de RR de forma declarada e contada, com aviso e registro na transparência.

Implementada a versão `governor-2022-state-v2` (regra por zona para anulados, sub judice e nulos técnicos; exclusões só por declaração; novos campos opcionais `annulled`, `annulledSubJudice`, `technicalNull`, `nonValidVotes` e `exclusions`, que não são lidos como zero em versões antigas). A Presidência e suas publicações não mudaram. As versões v1 (AC, AL, CE, ES, MA, SP) foram substituídas e mantidas como não publicadas.

Resultado: 27 UFs publicadas, 5.570 municípios, 4.404.307 registros, nenhum bloqueio; comparação independente com os CSVs de apuração e nominal sem divergências (522 conferências); 46 testes, tipos, build, smoke de governador (27 UFs) e regressão completa da Presidência passaram; reexecução idempotente. Detalhes em `docs/governador-2022.md`. Sem publicação externa. Pendentes: revisão visual/acessibilidade em navegador, suplementar de RR, senador.

## 19. Revisão visual e de acessibilidade — 15/10/2026

Primeira pendência da lista. Sem a extensão do Chrome conectada, a revisão usou o Firefox 157 do sistema em headless com `puppeteer-core` e axe-core 4.14, instalados fora do repositório. 11 páginas em 1280/375 px e refluxo a 320 px: axe sem violações (com controle positivo), contraste medido pixel a pixel sobre os gradientes, ordem de Tab e foco visível, estrutura de títulos/regiões/tabelas e inspeção das capturas.

Corrigidos: rolagem horizontal em `/fontes` no celular, três contrastes abaixo de 4,5:1 no hero e nos cartões, linha de nulos técnicos, recuos, aviso desatualizado e ordem das importações em `/fontes`, rodapé do turno não realizado e plural de zona. Registro e limites em `docs/acessibilidade.md`. Não verificados: leitor de tela real, Chrome/Safari e dispositivos móveis reais, zoom de texto e alto contraste do sistema. Testes e smokes repetidos sem regressão.

### Pendências registradas em 15/10/2026 (histórico)

1. Suplementar de Governador de RR (eleição 6278, 21/06/2026, presente nos arquivos marcados como 2022): como tratá-la (proposta: recorte próprio "suplementar 2026", sem somar nem comparar com a ordinária de 2022); como apresentar os 160.004 votos "Anulado sub judice", maiores que os válidos (102.845), deixando explícita a provisoriedade da classificação; conferir situação da totalização e eventual 2º turno antes de importar.
2. Senador 2022 (uma vaga por UF; 2026 terá duas): auditoria e regras. → Concluído no §20.
3. Página de UF longa (25 municípios com quadros por página): rever apresentação. → Concluído no §27.
4. Incorporar verificações de acessibilidade e testar em outros navegadores. → Automação com `puppeteer-core`/`axe-core`, Chrome e Firefox concluída nos §§27–28; `pngjs` não foi necessário. Leitor de tela humano e Safari continuam pendentes.

## 20. Senador 2022 nas 27 UFs e mudança de escopo — 17/10/2026

Rafael pediu o Senado diretamente nas 27 UFs, sem piloto. Durante a carga, decidiu **retirar os deputados (federais, estaduais e distritais) do escopo por enquanto**, unicamente para reservar armazenamento à integração do IBGE e ao cruzamento IBGE–TSE, que é o propósito inicial do projeto (§1, §3) e também aumentará o volume de dados. Estimativa que embasou a decisão: em AC e PE, as linhas de seção de Deputado Federal e Estadual somam 13 a 14 vezes as do Senado, ou seja, cerca de 50 milhões de registros em 2022 e uns 20 GB no PostgreSQL, levando o projeto local a 55–60 GB. Os ZIPs por UF já baixados preservam os cargos 6, 7 e 8; nada foi descartado. A interface e o catálogo passam a indicar deputados como fora do escopo atual, não como próxima etapa. Próxima prioridade após o Senado: dados do IBGE e sua correspondência validada com o TSE. Retomar os deputados exige nova decisão de Rafael, considerando o armazenamento já ocupado pelo IBGE, e auditoria própria (legenda, proporcional, cadeiras).

Senado — auditoria prévia dos originais (27 UFs, leitura independente): cargo 5 só na eleição 546, turno 1; sem trânsito, legenda, apuração em separado, duplicatas, outra UF ou suplementar (em RR, a suplementar de 2026 é só de Governador). Seções, apuração e nominal coincidem em todas as UFs. Há anulados, sub judice e nulos técnicos em 18 UFs (RJ: 1.573.388 nulos técnicos; PB: 431.857 anulados), todos dentro da regra decidida para o Governador v2 — por isso nenhuma decisão nova foi necessária. Em AP e MS, "Anulado" convive com registro "deferido"; exibido como na fonte, sem interpretação.

Implementação: `SENATOR_2022` (cargo 5, eleição 546, turnos `['1']`, `electionCodes` parcial); `senator` em `OFFICES`/`STATE_OFFICES` e novo `SINGLE_ROUND_OFFICES` nos contratos; `import:state -- --office senator`, versão `senator-2022-state-v1`; turno da apuração fora do recorte do cargo bloqueia; o catálogo lista UFs pendentes de qualquer cargo estadual; a interface diz "eleito em turno único" no 2º turno do Senado. Nenhuma exclusão declarada.

Defeito encontrado e corrigido no código: `persistTerritory` descartava `nonValidVotes` de locais e zonas (Governador v2: totais certos, quadro de não válidos ausente nos locais; 0 de 1.179 locais de SE). Locais e zonas passam a ser gravados como o objeto validado, e a verificação persistida reconta os votos pelos locais (falha nos dados v2 de SE/PR, passa em AC). O importador do Governador foi para a `governor-2022-state-v3`; a v2 continua publicada e não foi reescrita. Rafael aprovou e a reimportação do Governador v3 foi concluída na mesma data (27 UFs, 4.404.307 registros, verificação pelos locais aprovada; v2 não publicada).

Resultado: 27 UFs publicadas, 5.570 municípios, 3.790.841 registros (igual à auditoria), nenhum bloqueio; cerca de 61 min somados, pico de 509 MiB; banco em 7,7 GB. Verificação: 659 conferências independentes originais × API sem divergência; 49 testes, tipos e build; `smoke:senator` (27 UFs, 132 requisições) e regressão de todos os smokes no build de produção. Achado à parte: em `npm run dev`, a rota de relatório da API serializa o `StreamableFile` como JSON e derruba `smoke:national`/`smoke:exterior`; no build de produção funciona. Defeito anterior, ainda não corrigido. Detalhes em `docs/senador-2022.md`.

Também nesta data: `AGENTS.md` passou a ser o único arquivo de orientações (o `CLAUDE.md` só o importa), com uma seção sobre o revezamento entre Codex e Claude Code.

### Pendências registradas em 17/10/2026 (histórico)

2. Suplementar de Governador de RR (2026), como no item 1 da lista do §19.
3. IBGE: etapa municipal publicada em 17/10/2026 (contexto Censo 2022 + perfis do TSE como base própria, 5.570 municípios) e protótipo de mapas (malhas do IBGE, `/mapa`). Detalhes, regras de soma e verificação em `docs/plano-ibge.md`. Fase 3 e métrica E concluídas na mesma data (§22).
4. Página de UF longa; verificações de acessibilidade no repositório; revisão em navegador das páginas do Senado.
5. Rota de relatório em modo dev (`tsx watch`).
6. Formulários e exibição: plano em `docs/plano-ux-formularios.md`. Decisões de Rafael registradas (componente próprio de sugestões, cargo em opções visíveis, manter "Consultar", ordem 1→2→3→5+6→4). Todas as fases implementadas em 17/10/2026, inclusive a busca com sugestões (`pg_trgm`, migration 005, rota `suggest`, combobox próprio). Pendentes: leitor de tela real (condição para declarar a busca acessível), Chrome/Safari e o enriquecimento da busca com distritos do IBGE.

## 21. IBGE (Censo 2022) no nível municipal e mapas — 17/10/2026

Rafael aprovou o plano de `docs/plano-ibge.md`: etapa municipal primeiro, PostGIS na fase de setores, sem microdados de acesso controlado, perfil por seção como marginais por local e métrica E por escolaridade e renda do entorno do local de votação. A auditoria mostrou que os perfis do TSE (cadastro e comparecimento) não fecham com os resultados por município e que o comparecimento por perfil de 2022 não traz o DF; Rafael decidiu publicá-los como base própria, declarada, com a diferença exibida.

Publicados o contexto municipal (`municipal-context-2022-v1`: Censo 2022 via SIDRA ligado aos 5.570 municípios do TSE pela correspondência oficial de códigos; perfil do eleitorado e comparecimento por perfil do TSE) e as malhas do IBGE para mapas (`maps-ibge-2022-v2`). Na página do município, o painel "Território e eleitorado" separa universo, amostra e cadastro; em `/mapa`, dois coropléticos lado a lado (indicador do Censo e abstenção), com quintis, tabela equivalente e avisos de leitura (sem causa, sem voto de grupos, viés de área). Detalhes e números em `docs/plano-ibge.md`. Banco: +38 MB; disco: +0,8 GB. Sem publicação externa.

## 21-A. Análise de hospedagem inicial — 17/10/2026

A pedido de Rafael, analisada a estrutura em desenvolvimento e pesquisados preços oficiais de hospedagem. Relatório em `docs/hospedagem-inicial.md`. Medição somente de leitura, aproximadamente às 18h05 (Brasília): PostgreSQL com 10.372.323.007 bytes (9,66 GiB), extensões PostGIS e `pg_trgm`; `data/` com cerca de 16 GiB, dos quais 5,8 GiB são originais. As medidas são um retrato durante trabalho em andamento, sem certificação das novas importações.

Proposta, ainda não decidida: VPS única com 8 GB de RAM e 80–100 GB de disco para web/API/banco, importações e builds fora do servidor público. Hostinger KVM 2 no Brasil como candidata em reais (promoção e pagamento antecipado precisam ser avaliados); Hetzner CX33 na Europa como alternativa de cobrança por uso, com disponibilidade pendente de confirmação. Comparados também DigitalOcean e Lightsail; detalhados backup independente, armazenamento opcional no R2, limites de planos gratuitos e preparação para produção.

Verificação: leitura de Compose/Dockerfiles, rotas de consulta/download e código espacial em andamento, métricas SQL e disco, páginas oficiais de preços. Sem testes de carga, contratação ou implantação; sem alteração de código, interrupção de serviços ou importação iniciada por esta análise. As alterações de desenvolvimento preexistentes foram preservadas; esta entrega deixa somente o relatório e este registro sem commit. Pendentes: escolha do provedor/prazo com Rafael, confirmação do preço final e região, configuração de produção e medição no ambiente de destino antes de uma publicação autorizada.

Complemento na mesma data: Rafael perguntou sobre AWS aceitando custos superiores. Acrescentada avaliação em `docs/hospedagem-inicial.md`: Lightsail em São Paulo como candidata inicial AWS (região disponível desde junho de 2026), tabela pública de US$ 44/mês para 8 GB como referência ainda sem confirmação regional; EC2 + RDS como evolução para reduzir administração do banco, sem orçamento regional fechado. Verificados preços públicos, regiões, snapshots e suporte a extensões do RDS; a versão de PostGIS disponível deve ser conferida na migração. Nenhuma contratação, implantação ou mudança de código; escolha continua pendente.

Segundo complemento na mesma data, sobre gratuidade: documentadas Oracle A1 Always Free (condição vigente de 2 OCPUs/12 GB, 200 GB de volumes; capacidade regional, retomada por ociosidade e adaptação ARM da imagem PostGIS) e alternativa de exportações locais versionadas para frontend estático + R2/Worker. Banco completo não equivale ao volume necessário de consulta pública, mas é preciso preservar busca por seção, GET sem JavaScript e demais funcionalidades. Medição SQL dos JSONs publicados cancelada pelo timeout de oito segundos; nenhum tamanho de exportação foi confirmado. Verificadas fontes oficiais de quotas/arquiteturas; sem código, criação de recursos, transferência externa ou interrupção de serviços. Próximo passo proposto, sem decisão: prova local de exportação ou validação da disponibilidade da Oracle na conta/região escolhida.

## 22. Locais de votação, setores censitários e métrica E — 17/10/2026

Banco migrado para PostGIS (`postgis/postgis:18-3.6-alpine`) após backup completo em `data/backups/`. Publicados: associação local → setor do Censo 2022 (`polling-place-tracts-2022-v2`: 93,0% dos eleitores em locais associados; a v1 descartava coordenadas sem zero inicial e ficou não publicada), perfil do eleitorado por local (`place-profiles-2022-v1`, mesmo total do perfil municipal) e a métrica E pré-calculada (`place-groups-2022-v1`), consultável em `/perfis`: locais em quintis ponderados por eleitores aptos, pela escolaridade declarada dos seus eleitores (TSE) ou pelo rendimento mediano do responsável no setor do local (IBGE), com votos somados por grupo e rótulo ecológico. O cadastro de locais do TSE foi regerado depois da eleição: a chave é o código original do local, e seções realocadas não herdam a coordenada do prédio novo. Detalhes, números e limites em `docs/plano-ibge.md`. Sem publicação externa.

## 23. Métrica E v2 e próximas métricas — 17/10/2026

Rafael pediu definição mais clara dos grupos de `/perfis`. A conferência mostrou um defeito da v1: com muitos setores com mediana de renda exatamente em 1 SM, os quintis separavam valores iguais pela ordem dos códigos (no MA, dois grupos inteiros em R$ 1.212). Rafael aprovou a correção, publicada como `place-groups-2022-v2`: renda em cinco faixas fixas de salário mínimo de 2022, iguais em todos os recortes; escolaridade em quintis sem dividir empates; definição de cada grupo na página e na metodologia. Detalhes e números em `docs/plano-ibge.md`. Verificado com testes, smokes e axe-core. Sem publicação externa.

Próximo passo indicado por Rafael (sem início): aprofundar métricas por gênero, escolaridade e faixa etária — o perfil por local (`place-profiles-2022-v1`) já guarda gênero, faixa etária, escolaridade e estado civil declarados ao TSE. Antes de implementar, decidir com Rafael os cortes (ex.: faixas etárias agregadas) e a forma de apresentação; mesma leitura ecológica (locais, não pessoas). Pendente também: conferir no dicionário do IBGE a definição de V06006.

Complemento na mesma data, a pedido de Rafael (antes das novas métricas): quanto cada faixa de renda representa da população. Publicado `income-bands-2022-v1` (`npm run import:income-bands`): moradores em domicílios particulares permanentes ocupados de todos os setores somados pela faixa da mediana do setor, conferidos com o total municipal do IBGE nos 5.570 municípios; exibido em `/perfis` (Brasil/UF, ao lado da parcela dos eleitores) e na página do município. Dicionário do IBGE preservado: V06006 é a mediana dos responsáveis **com rendimento** (pendência resolvida). Setores com dados omitidos pelo IBGE ficam contados à parte, sem estimativa. Detalhes em `docs/plano-ibge.md`.

## 24. Participação por perfil e novos agrupamentos de locais — 17/10/2026

Rafael decidiu as faixas etárias por obrigatoriedade do voto e o escopo (participação + locais). Publicados `turnout-profiles-2022-v1` (comparecimento e abstenção do TSE cruzados por gênero, faixa etária e escolaridade, por UF e turno; página `/participacao`; contagens da fonte, conferidas linha a linha e contra o contexto municipal; DF ausente na fonte) e `place-groups-2022-v3` (métrica E com eleitoras, 16 a 24 anos, 60 anos ou mais e até fundamental incompleto). Detalhes e números em `docs/plano-ibge.md`. Verificado com testes, smokes e axe-core. Sem publicação externa.

Complemento: a pedido de Rafael, todos os indicadores de `/perfis` passaram a faixas fixas de números redondos (`place-groups-2022-v4`), porque os quintis davam grupos sempre de ~1/5 dos eleitores e sem definição estável.

Pendente/possível naquele marco: estado civil, cruzamento por município, outros navegadores/leitor de tela e sensibilidade. Estado civil, cruzamento e sensibilidade foram concluídos no §25; Chrome e automação nos §§27–28. Pendências manuais vigentes no resumo inicial.


## 25. Método, dados e mapas pendentes — 17/10/2026

Rafael pediu para atacar o "o que ainda falta" na ordem: melhorias de método e de dados, depois interface. Feito (detalhes e números em `docs/plano-ibge.md`):

- Sensibilidade da associação local → setor (`tract-sensitivity-2022-v1`): grupos de renda refeitos com a faixa predominante nos setores a até 250 m, 500 m e 1 km; tabela de concordância e visão alternativa em `/perfis`. Análise, não substitui a métrica E publicada.
- Participação v2 (`turnout-profiles-2022-v2`): estado civil e cruzamento por município em `/participacao`, conferido com o contexto municipal; página do município com cadastro por gênero e estado civil e link para o cruzamento.
- Moradores de 15+ por faixa de perfil do setor (`tract-demography-2022-v1`, agregado de demografia do Censo): coluna de comparação em `/perfis` para eleitoras, 16 a 24 e 60+; omissões de células do IBGE ficam fora, sem estimativa, com cobertura declarada.
- Interface: `/mapa/candidaturas` (um mapa por candidatura, mesma escala fixa para todas, uma só cor); dica própria ao passar o mouse nos mapas; "valores observados" em `/perfis` sem colidir com o limite excluído da faixa.

Defeito apontado por Rafael (mesma data): em `/participacao`, mudar linhas/colunas e enviar não fazia nada. Causa: a navegação aprimorada (`queryHref`) só aceita ações de uma lista fechada, sem `/participacao` (nem `/mapa/candidaturas`); o envio falhava em silêncio depois de cancelar o GET nativo. Corrigido: ações incluídas, teste com todas as páginas de consulta, e `QueryForm` passa ao envio nativo se a ação for recusada; sem JavaScript, `municipality` vazio ("Toda a UF") vale como ausência. Os smokes e o axe abrem URLs prontas e não pegavam isso; o envio foi conferido no Firefox (puppeteer) nas duas páginas.

Sensibilidade (resumo): 61,6–70,9% dos eleitores dos locais associados ficam na mesma faixa conforme o raio (1 km–250 m); a maior diferença de % válidos de uma candidatura num grupo é de 1,3–2,8 p.p. no Brasil e chega a 9,6 p.p. no MA, em faixas com poucos locais.

Verificado: typecheck, testes unitários (65), todos os smokes, envio dos formulários no Firefox, axe-core sem violações e sem rolagem horizontal em 39 páginas × 3 larguras; capturas de tela das páginas novas. Banco: 10.141 MB (+48 MB: células da participação 31 MB, demografia por setor 15 MB, sensibilidade 1 MB); `data/` 17 GB (+22,5 MB do agregado de demografia). Sem publicação externa.

Pendente: leitor de tela real e Chrome/Safari (nunca verificados); limpeza de armazenamento, hospedagem, suplementar de RR e o bug da rota de relatório em modo de desenvolvimento (adiados por Rafael); coluna `responsible_with_income` com nome impreciso (sem uso na interface).

## 26. Revisão local e consolidação de lacunas — 18/10/2026

A pedido de Rafael, revisão do código local no commit `5ec76ea`, dos planos e das publicações existentes, com consultas somente de leitura. Relatório e prioridades em `docs/revisao-local-2026-10-18.md`. A árvore estava limpa no início; esta entrega acrescenta somente o relatório e este registro, sem commit e sem correções de implementação.

Confirmados: (1) `places/groups` e `map/candidates`, na Presidência, aceitam `year=2026` e entregam a mesma resposta publicada de 2022, por falta de conferência do ano; (2) o original `br_setores_cd2022.gpkg` existe, mas API/proxy rejeitam a extensão e o download retorna 404; (3) a tabela de contexto não mostra `undistributed`/`roundingDifference` — 1.277 municípios têm parcela não discriminada em cor ou raça; (4) reproduzida a pendência do relatório HTTP no código carregado via `tsx/cjs` (objeto interno em vez do relatório), enquanto a API compilada entrega o arquivo correto. Prioridade sugerida: isolamento por ano, transparência e regressões, depois verificação de interface e robustez dos derivados.

Lacunas adicionais documentadas: roteiro `check:ui` ainda não incorporado, dependências/versionamento dos derivados e recuperação de relatório após publicação. As publicações atuais que registram `inputs` não apontaram dependências antigas. Permanecem leitor de tela real/Chrome/Safari, página de UF longa, operação/hospedagem, limpeza de armazenamento e suplementar de RR; nenhuma dessas decisões foi tomada nesta revisão. Estado civil, cruzamento municipal da participação, sensibilidade e mapas por candidatura já estão concluídos e não devem voltar à lista de implementação pendente.

Verificado: typecheck, 66 testes unitários e build completo; testes/build exigiram execução fora da sandbox (sockets do runner e subprocesso TypeScript do Next). Reproduções por HTTP em instâncias temporárias, incluindo a API compilada; consultas PostgreSQL com `default_transaction_read_only=on`. Não repetidos smokes completos, importações, auditoria integral dos votos ou revisão visual/acessibilidade. Instâncias temporárias encerradas; banco mantido como estava. Nenhuma importação iniciada, dado alterado, publicação trocada, arquivo de dados removido ou implantação executada.

## 27. Correções, auditoria do Censo, testes e listagem municipal — 18/10/2026

Rafael autorizou corrigir os quatro achados, reforçar os testes e o versionamento, reavaliar diferenças do Censo e pesquisar/adequar a página longa de municípios. Hospedagem fica por último. Implementação e matriz de efeitos colaterais em `docs/correcoes-verificacao-2026-10-18.md`; comandos incorporados ao README.

- Reconferido antes da alteração o vazamento 2022 → 2026 por respostas idênticas. Seleção de publicação agora confere ano/cargo; regressões cobrem grupos, raios, mapas e UFs. Formatos dos originais compartilhados por API/proxy, incluindo GeoPackage; checksum/tamanho/registro preservados, cache de integridade inclui ctime. Relatórios e originais passam por resposta nativa em fluxo, com bytes/cabeçalhos verificados também em desenvolvimento e cancelamento sem derrubar o servidor.
- Censo: auditoria somente de leitura dos 5.570 contextos contra **163 respostas SIDRA preservadas**, com hashes e células das seis tabelas, além dos totais das UFs. Sem divergência de conversão/persistência nas células conferidas. As diferenças em cor ou raça de 1.277 municípios já existem nos 27 originais; em Abreu e Lima/PE, os 1.503 também coincidem com a consulta oficial atual. A causa não foi presumida. Interface mostra a diferença separadamente; arredondamento da amostra, ausência na fonte e problema técnico têm estados próprios; denominador zero não aparece como 100%. Contratos e extrator bloqueiam somas incompatíveis, duplicatas, categorias novas e linhas obrigatórias ausentes. Falha de consulta/validação do contexto é visível, sem ser atribuída à fonte.
- Dependências: novas identidades incluem escopo/ID das entradas, fontes, versão e configuração pertinente. Importadores conferem novamente as entradas antes da troca pública, com locks; relatório é preparado antes de publicar; idempotência exige relatório válido. API confere dependências transitivas registradas. Versões futuras preparadas: contexto v2, mapas v3, setores v3, perfil por local v2, renda v2, participação v3, demografia v2, grupos v5 e sensibilidade v2. **Nenhuma reimportação foi executada e as publicações existentes foram preservadas.** O legado sem `inputs` não foi apresentado como proveniência completa: 11.140 comparadores do contexto e 11.138 da participação foram conferidos numericamente com a Presidência atual. Teste SQL do protocolo usou tabela TEMP e rollback, conferindo IDs/flags públicos intactos.
- Pesquisa em ONS, Elections New Zealand e GOV.UK: consolidado separado da listagem, comparação em tabela e detalhe por território, paginação explícita. Página municipal agora tem uma linha por município; todas as candidaturas e categorias em detalhe nativo sem JS; navegação acima/abaixo e filtros preservados. Há orientação de rolagem no celular. Não houve seleção de candidatura para representar o município, mudança de ordenação eleitoral ou média de percentuais.
- Incorporados `check:data`, `check:publication`, `check:regressions` e `check:ui`, com `puppeteer-core@25.14.0` e `axe-core@4.14.0` fixados. Auditoria npm sem vulnerabilidade conhecida na consulta; versões de execução mantidas, sem migração de framework/TypeScript. O teste real sem JS encontrou mais um defeito: o `loading.tsx` raiz deixava conteúdo definitivo oculto atrás do fallback de Suspense. Fronteira removida; GET completo entrega HTML utilizável e o envio aprimorado mantém estado ocupado/feedback. O custo é retirar o antigo esqueleto da carga inicial, conforme explicado no plano de UX.

Verificação final: **83 testes unitários**, typecheck e build; **nove smokes** aprovados (nacional: 182 requisições e SHA-256 de três originais; resumo: todos os municípios/dois turnos; Governador/Senador: 27 UFs; contexto: 74 requisições); **31 regressões HTTP** incluindo relatório por bytes e GeoPackage real na API/proxy. O smoke do resumo foi atualizado para verificar os links/detalhes da nova estrutura, preservando as conferências numéricas.

Navegadores: Chrome 151.0.7922.71 e Firefox 158.0; 30 avaliações axe/refluxo por navegador (10 páginas × 1280/375/320 px), sem violações, mais conferência final da dica municipal a 320 px. Seis formulários enviados com e sem scripts em cada navegador, teclado/autocomplete, erro com foco, detalhes, paginação e movimento reduzido. Chrome: cores forçadas emuladas e CLS 0 na troca medida. No Firefox instalado, o protocolo não aceita desligar JavaScript por comando; o roteiro usa proxy local temporário com CSP para bloquear scripts da página e controle positivo de não execução, sem confundir as mensagens CSP esperadas com erro de aplicação. Capturas/relatórios em `data/analysis/ui-checks/`: Chrome `2026-10-19T01-20-54.667Z` (axe), `2026-10-19T01-25-49.744Z` (funcionais), `2026-10-19T01-27-32.447Z` (envios/controle); Firefox `2026-10-19T01-31-32.595Z`; cópia final `final-municipios-320.png`. Horários dos diretórios são UTC, da noite de 18/10 em Brasília.

Pendentes: leitor de tela humano, Safari e dispositivos reais, zoom de texto/alto contraste do sistema (roteiro manual documentado); limpeza de armazenamento e suplementar de RR continuam sem execução; hospedagem por último, como solicitado. A coluna imprecisa `responsible_with_income` continua sem uso na interface. Não houve carga de fonte, mudança de publicação, remoção de dados ou implantação. Mudanças de código/documentação permanecem sem commit, descritas neste registro. Serviços temporários de API/web encerrados ao concluir; banco preservado em execução.

## 28. Reimportações, auditoria integral e revisão para commit — 18–19/10/2026 (concluídas)

Rafael autorizou executar as nove versões derivadas do §27, depois revisar o código para o commit, mantendo hospedagem por último. Mesmos recortes de 2022 e mesmos originais, sem novo cargo/ano, deputados, suplementar ou implantação. Relatório consolidado, IDs completos, testes/efeitos e evidências: `docs/reimportacoes-2026-10-18.md`.

Antes das cargas: API/web desligadas, PostgreSQL saudável, 67 GB livres. Backup completo `data/backups/observatorio-2026-10-18-antes-reimportacoes.dump`, 338.203.963 bytes, SHA-256 `2ff2e73bb63e793881fa363e65daaf518aaf310cd719b9058dc79f5ba70a064e`; `pg_dump` e leitura do catálogo por `pg_restore --list` aprovados, checksum reconferido na retomada. Restauração completa não ensaiada. Baseline em `data/analysis/reimports-2026-10-18/baseline.json`: publicações/metadados/fontes e SHA-256 de 303.875 linhas em 11 tabelas, excluindo somente `batch_id`.

Na primeira tentativa, publicados contexto v2, mapas v3 e setores v3. A revisão confirmou erro preexistente no contador de seleção do contexto: as 36.910 linhas de ZZ já eram excluídas dos agregados, mas eram indevidamente contadas em `rowsSelected`. Conferido diretamente no CSV Latin-1 preservado. Para não reescrever a v2, contexto passou à **v3**. Perfil por local interrompido antes de qualquer lote/gravação para receber a dependência nova. Às 00h20 de 19/10 Rafael solicitou parar: tentativa 2 encerrada por SIGTERM, nenhum lote contexto v3/perfil v2 parcial, logs preservados, API/web desligadas, só banco ativo (`stopped-state.json`).

Retomada autorizada por Rafael às 09h27 de 19/10. Preflight confirmou estado idêntico ao da pausa e ausência de concorrência (`resume-preflight.json`). Tentativa 3 sequencial concluída às **11h39**, com logs/coordenador/manifesto em `attempt-3/`. Versões efetivas: **contexto v3, mapas v3, setores v3, perfil por local v2, renda v2, participação v3, demografia v2, grupos v5 e sensibilidade v2**. Mapas/setores reaproveitados com validação integral do relatório. Contexto v3: 4.362.480 linhas lidas, 4.325.570 selecionadas, 36.910 de ZZ excluídas; 5.570 municípios e 155.756.933 eleitores. Perfil v2: 93.291 locais, mesmo total; 262 locais com resultados sem perfil continuam declarados. Participação: 5.569 municípios das 26 UFs da fonte, DF indisponível; grupos: 732 recortes; sensibilidade: 366. Nenhuma contagem científica foi ajustada para fechar.

Correções adicionais do código: consulta finita de categorias TSE com normalização/erros preservados e teste exaustivo; relatório idempotente exige todos os metadados persistidos; `reusePublished` centraliza transação/locks compartilhados, entradas atuais e bloqueio de lote histórico despublicado; checagem antecipada evita reler arquivos pesados quando já publicados. `check:data` passou a conferir o contador de seleção pelo CSV do exterior. `check:reimports` incorporado para baseline/comparação de todas as tabelas, com gravação exclusiva da evidência. Nenhuma nova dependência de execução ou atualização de framework nesta continuação.

Verificação final, com logs duráveis em `data/analysis/reimports-2026-10-18/`:

- **86 testes unitários**, typecheck e build aprovados novamente em 19/10 (25 API, 31 importador, 22 web, 8 contratos; `code-checks.json`). Logs antigos de `/tmp` foram limpos na reinicialização; `final-*.log` preserva esta execução.
- **Duas comparações integrais aprovadas**, antes/depois da idempotência: `comparison.json` e `comparison-after-idempotence.json`, `complete: true`, nove versões, 11 tabelas idênticas à baseline, dados/metadados anteriores preservados e **57 publicações eleitorais intactas**. Controles negativos/relatórios parciais anteriores mantidos como histórico.
- `check:data` aprovado: **163 respostas SIDRA**, 5.570 contextos, 11.140 comparadores do contexto e 11.138 da participação; nenhuma entrada legada sem proveniência nos nove derivados. Diferenças de cor ou raça de 1.277 municípios continuam iguais aos originais; causa não presumida. V2 intermediária do contexto conferida separadamente: metadados, linhas e SHA-256 do relatório intactos, somente despublicada.
- **Nove reexecuções idempotentes** com mesmo ID. Estado completo antes/depois: **116 lotes**, **286 registros de originais** e bytes dos **nove relatórios** intactos (`idempotence-state-verified.json`); sem regravar histórico. `check:publication` SQL real novamente aprovado em tabelas TEMP, com troca simulada revertida, entrada substituída/lote antigo recusados e publicações reais intactas.
- **Nove smokes** e **31 regressões HTTP** aprovados na API em desenvolvimento e web compilada, incluindo relatórios por bytes/cabeçalhos e GeoPackage real no proxy/API. Nacional: 182 requisições e hashes de três originais; resumo: todos os municípios/dois turnos; Governador/Senador: 27 UFs; contexto: 74 requisições.
- **Chrome 151.0.7922.71 e Firefox 158.0**: controle positivo do axe e 30 avaliações por navegador, 10 páginas × 1280/375/320 px, sem violações automáticas/refluxo indevido (`final-ui/report.json`). Envios com/sem JavaScript, teclado e preferências da rodada de 18/10 não repetidos nesta rodada; sem declaração de leitor de tela/Safari/dispositivo real.

Revisão final do código/diffs concluída sem novo achado bloqueante para commit; testes e efeitos adicionais descritos no relatório. AGENTS/README/plano IBGE e acessibilidade atualizados; relatório do §27 marcado como histórico anterior às cargas. **Mudanças locais sem commit**, incluindo correções/testes/scripts/documentação do §27 e desta etapa, integralmente descritas nesses registros. Dados, originais, backup e artefatos em `data/` continuam fora do Git.

Encerramento — **19/10 às 11h51 (Brasília)**: API/web/navegadores temporários encerrados, portas 3000/3001 livres, nenhum importador/unzip/build ou outro cliente PostgreSQL ativo. Somente banco saudável em 127.0.0.1:5432; 116 lotes e 66 publicações (`final-services.json`, `final-database-state.json`). Sem implantação ou contratação externa. Pendentes fora desta etapa: leitor de tela humano, Safari/dispositivos reais, limpeza de armazenamento, suplementar de RR e nome impreciso `responsible_with_income` (sem uso na interface). Hospedagem continua por último.

## 29. Consolidação e envio ao Git — 19/10/2026

Rafael autorizou commit e push após confirmar ausência de pendências bloqueantes desta entrega. Conferidos `git status`, histórico e diff final; `git fetch upstream` concluído, `main` sincronizada com `upstream/main` antes da consolidação, sem alteração remota a integrar. Consolidação concluída no commit `825dffb` e enviada para `upstream/main`, reunindo correções, testes, scripts e documentação dos §§26–28; árvore de trabalho limpa ao terminar o envio.

Mantidas as verificações já aprovadas no mesmo código: 86 testes, typecheck/build, nove smokes, 31 regressões HTTP, 60 avaliações automáticas em Chrome/Firefox, auditorias integrais e nove reexecuções idempotentes; somente documentação de encerramento alterada desde então. `git diff --check` aprovado. Confirmado que `.env`, originais, banco, backup e evidências locais em `data/` estão ignorados e não integram o envio. Nenhuma importação ou serviço temporário reiniciado; somente PostgreSQL permanece ativo.

Escopo de envio: branch `main`, remoto `upstream`, sem reescrever histórico. Permanecem fora desta entrega as pendências manuais/de operação registradas no §28; hospedagem continua por último. Nenhuma implantação ou contratação externa.

## 30. Revisão do planejamento e README — 19/10/2026

A pedido de Rafael, revisados `plan.md` e o README principal após o envio de `825dffb`. Criado resumo vigente separado do histórico; corrigidas instruções iniciais superadas, método espacial já definido e stack adotada; removida a duplicidade do §22 mantendo as referências à etapa local → setor (§22, hospedagem histórica no §21-A). Pendências antigas receberam indicação dos marcos que as resolveram; commit/push anterior confirmado no §29.

README atualizado com todas as funcionalidades atuais, versões dos nove derivados, ordem/dependências das importações, distinção entre carga eleitoral e derivada, limites de cobertura e pendências reais. Execução compilada orientada pelo Compose/servidor standalone já configurado, retirando a recomendação de `next start` incompatível com a configuração. Comandos de exemplo preservam `.env` existente e o laço de UFs para na primeira falha.

Conferência documental: manifests/scripts npm, rotas existentes, versões/entradas dos importadores, Compose/Dockerfile e relatórios da última verificação; 19 links locais, 41 referências a comandos npm, nove blocos shell (somente sintaxe), nove versões comparadas ao código e numeração das seções sem duplicatas conferidos; `git diff --check` aprovado. Não repetidos testes/build/smokes: somente Markdown foi alterado. Sem importação, consulta/mutação de dados, reinício de serviços ou nova implantação. Rafael autorizou consolidar esta revisão em commit documental separado em 19/10, incluindo somente `README.md` e `plan.md`. Sem novo push nesta etapa; verificações manuais e hospedagem seguem no resumo vigente.

## 31. Pesquisa de expansão espacial e propostas de governo — 19/10/2026

A pedido de Rafael, pesquisadas oportunidades de PostGIS, novas apresentações geográficas, fontes socioeconômicas brasileiras e obtenção/análise de propostas de governo para refletir sobre um “cérebro político brasileiro”. Conferidos `git status`/histórico no início: `2eef361` em `main`, sincronizada com `upstream/main`, árvore limpa. O estudo completo está em `docs/estudo-postgis-propostas.md`; reúne fontes primárias, prioridades, arquitetura conceitual, limitações e critérios de aceite/efeitos colaterais de possíveis marcos.

Auditoria somente leitura do código: PostGIS atua na associação local → setor e na sensibilidade, com geometrias temporárias; mapas atuais usam TopoJSON JSONB e SVG no servidor. Comparação Censo × abstenção e mapas de todas as candidaturas já existem. Oportunidades adicionais: comparação livre com candidatura/dispersão, qualidade da associação, setores e locais no mesmo mapa, catálogo espacial imutável por fonte e reutilização entre importadores. Tiles são alternativa condicionada a escala/benchmark; API atual tem pool de cinco conexões e limite SQL de dois segundos. Não localizada validação `ST_IsValid` no carregador; isso é lacuna de verificação, sem afirmar defeito na fonte. Registrar também a premissa de datum das coordenadas TSE e preservar a regra de setores inteiros no entorno.

Fontes pesquisadas: infraestrutura urbana do entorno Censo 2022 como primeira candidata adicional; CNES histórico e Censo Escolar para etapas posteriores; Ipea Acesso a Oportunidades e risco climático com limites explícitos de ano/cobertura. ONS, Ipea, MapBiomas e repositório NYT como referências de apresentação/metodologia. Planos de governo de 2022 têm recursos oficiais TSE em ZIP/PDF; inventário, chaves de candidatura, versão, extração/OCR e páginas precisam ser auditados antes de comparar. Não localizado recurso de propostas DF no catálogo consultado, sem concluir inexistência de plano. Senado não integra a obrigação documental de planos de presidente/governador/prefeito. Disponibilidade de material de 2026 não altera o recorte implementado.

Reflexão registrada: condições territoriais, voto observado, propostas documentadas e prioridades/confiança declaradas são evidências distintas. Não converter voto em aprovação de cada proposta nem indicador territorial em desejo dos moradores. Rubrica temática/documental uniforme com trechos, metas/prazos/financiamento declarados e revisão humana; Manifesto Project/VCGE e pesquisa de classificação do Brasil Participativo como referências, sem índices ideológicos ou notas automáticas de qualidade. ESEB/LAPOP e participação social são caminhos de escuta com representatividade própria. Identificada divergência externa no ESEB 2022: metodologia da onda informa 2.001 entrevistas/novembro–dezembro; ficha técnica vinculada ao catálogo informa 1.806/outubro. Identidade/versão dos microdados deve ser esclarecida antes de qualquer uso, sem correção presumida.

Verificação: referências locais do estudo existentes, numeração sem duplicatas e `git diff --check`; revisão cruzada somente leitura das descrições espaciais e das fontes/metodologia. Não executados testes/build/smokes por se tratar apenas de documentação. Sem download de corpus ZIP, importação, acesso a microdados com cadastro, consulta/mutação do banco, início de serviços, implantação ou contratação. Pesquisa não modificou código/dados; os dois arquivos documentais ficam sem commit, descritos neste registro. Próximo marco de implementação, fonte e eventual piloto ainda serão definidos com Rafael; hospedagem permanece separada e por último.

## 32. Plano de melhorias a partir do estudo espacial e de propostas — 19/10/2026

A pedido de Rafael, Claude Code leu o estudo do §31 e preparou o [plano de melhorias](docs/plano-postgis-propostas.md). No início: `main` em `2eef361`, sincronizada com `upstream/main`; estudo e §31 deixados sem commit pelo Codex, preservados sem alteração.

Conferências somente de leitura: código citado pelo estudo (confirmados ausência de `ST_IsValid`, malha temporária recarregada, TopoJSON + SVG e pool de cinco conexões com 2 s); banco com `default_transaction_read_only` (PostGIS 3.6.4/GEOS 3.14.1 com funções de cobertura e MVT, 10 GB, parâmetros padrão de memória/WAL, 66 GB livres no disco, contagens da associação v3 e setores por município, máximo de 26.889 em São Paulo); FTP do IBGE (agregados do entorno urbano em contagens por setor e município; dicionário lido fora do repositório, com SHA-256 no plano); cabeçalhos HTTP dos ZIPs do TSE (propostas BR com 15,8 MB; cadastro de candidaturas com 4,4 MB, regerado em 18/10/2026).

Ajustes principais ao estudo: (1) coordenadas, situação e contexto do setor de cada local já estão no banco, sem rota na API, e dois textos da interface ficaram desatualizados (`municipios/[code]/page.tsx:86`, `metodologia/page.tsx:17`); (2) entorno urbano pelos agregados em contagens, com conferência municipal, não pelos arquivos percentuais; (3) o entorno não depende de geometria e pode vir antes da base espacial; (4) base espacial medida primeiro em tabela temporária, sem persistir; (5) não migrar `sectors.ts` e a sensibilidade para um catálogo agora, para não provocar republicação em cascata dos derivados; (6) São Paulo como pior caso do desenho intramunicipal, com recorte por distrito antes de tiles; (7) propostas começam por inventário e busca literal, com rubrica só após definir a revisão humana.

Verificação: referências de arquivo e linha conferidas por busca no código; `git diff --check`. Não executados testes/build/smokes: somente documentação. Sem importação, escrita no banco, início de serviços, implantação ou contratação; nenhum original novo preservado em `data/` (o dicionário do IBGE foi apenas lido em diretório temporário). Pendente: decisões de Rafael (seção 10 do plano); nenhuma fase iniciada. Sem commit: `docs/plano-postgis-propostas.md` e este registro, além do estudo e do §31.

## 33. Fase A do plano de melhorias — 19/10/2026

Rafael aprovou a fase A do [plano de melhorias](docs/plano-postgis-propostas.md) (§32). Implementada com as recomendações das decisões 2 a 4 do plano (rota própria para a associação por local; abstenção como série padrão, sem tendência nem correlação; exportação CSV). As decisões 1 e 5 a 10 seguem abertas. Sem importação, publicação nova, migration ou escrita no banco: as rotas leem as publicações existentes. Andamento e medições também na seção 12 do plano.

- **A0 — textos superados:** `/municipios/[code]` (“Não há associação socioeconômica validada”), `/metodologia` (método geográfico “ainda não definido”; endereços “não relacionados ao IBGE”) e página inicial (futuro em indicadores do IBGE e na origem dos dados).
- **A1 — setor de cada local:** `GET /elections/municipalities/:code/place-tracts?uf=`, contratos `placeTractsQuerySchema`/`placeTractsSchema` (setor só para local associado, faixa conferida contra a mediana, resumo igual aos locais), `checkDependencies` e `503` para setor sem contexto gravado. Cartão do local com setor, situação, moradores, mediana do responsável com faixa, coordenada do TSE e ponto compartilhado, ou o motivo da não associação; quadro do município por situação; rótulos compartilhados com `/fontes`. O A1b (perfil do eleitorado por local), opcional, não foi feito.
- **A2 — série comparada:** `map/values` com `office` na abstenção (aptos do próprio cargo, UF obrigatória para cargo estadual, `round-not-held`) e `publications`, também em `map/candidates`. `/mapa` com cargo, turno conforme o recorte, “Comparar com” (abstenção ou candidatura do recorte, em ordem de votos e na escala fixa dos mapas por candidatura) e dispersão em HTML posicionado (eixos a partir de zero, área proporcional ao denominador com mínimo de 8 px). `/mapa/candidaturas` reutiliza a mesma série.
- **A3 — exportação:** `/mapa/dados.csv` com os filtros da página: UTF-8 com BOM, `;`, vírgula decimal, contagens publicadas e IDs das publicações; filtro inválido ou repetido e candidatura fora do recorte respondem 400, turno não realizado 404 e falha 503.

Verificação, com API e web compiladas temporárias e consultas de conferência com `default_transaction_read_only`:

- **98 testes unitários** (27 API, 31 importador, 30 web, 10 contratos; 12 novos), typecheck e build.
- **Nove smokes e 31 regressões HTTP** aprovados. O `smoke:context` (89 requisições, antes 74) passou a conferir: abstenção de Governador e Senador igual ao consolidado publicado da UF, dispersão com um ponto por município de SP, CSV somando os votos publicados da candidatura e associação de São Paulo com 2.049 locais e 2.030 associados, iguais ao banco. Uma expectativa de texto do smoke (“Abstenção na Presidência — 1º turno”) foi atualizada para o título novo, sem mudar as conferências numéricas.
- **`check:ui` em Chrome 151.0.7922.71 e Firefox 158.0:** 8 cenários por navegador, inclusive os seis formulários com e sem JavaScript, e 33 avaliações axe/refluxo por navegador (11 páginas × 1280/375/320 px, com `/mapa` em série de candidatura), sem violações automáticas nem rolagem horizontal (`data/analysis/ui-checks/2026-10-19T16-50-38.643Z`). Depois de um ajuste de rótulo (latitude e longitude nomeadas), testes, build, `smoke:context` e as 33 avaliações do Chrome foram repetidos e aprovados (`2026-10-19T16-59-05.570Z`).
- **Revisão visual por capturas** (`data/analysis/fase-a-2026-10-19/`): dispersão em MG e SP a 1280 e 375 px, formulário, cartões do local abertos e quadro de Aracaju. Pontos menores ficam por cima dos maiores, de propósito, e podem cobrir parte deles; a tabela traz todos os valores.
- **Medições:** rota da associação em São Paulo em 60–220 ms; `/mapa?uf=MG` com 2.641 KB (442 KB com gzip), dos quais a dispersão ocupa 156 KB (25 KB com gzip), contra 2,3 MB (382 KB) em 17/10, antes das dicas dos mapas; renderização em 1,3–1,9 s. O arredondamento das posições e a dica curta reduziram a dispersão de 263 para 156 KB. `/mapa/candidaturas?uf=MG` segue sendo a maior página (8,2 MB; 830 KB com gzip), sem alteração.

Encerramento: API e web temporárias encerradas, portas 3000/3001 livres; banco saudável e intacto. Não verificados: leitor de tela humano, Safari e dispositivos reais, como nas etapas anteriores. A pedido de Rafael, código, testes, scripts e documentação desta fase foram consolidados em commit local junto com o estudo (§31) e o plano (§32), sem push. As fases C, B, D e E dependem das decisões do plano.

## 34. Fase C do plano de melhorias: entorno dos domicílios — 19/10/2026

Rafael pediu o commit da fase A (feito: `d66540c`, em `main`, sem push) e aprovou a fase C se o acréscimo fosse pequeno (“apenas 34 MB? se sim ok; se não, e for expressivo, vamos pensar”). Medição antes de importar, com download para diretório temporário fora do repositório: os seis ZIPs do entorno somam 34,8 MiB e os CSVs por setor, descompactados, 185 MB, lidos em fluxo sem extração. Como só os moradores são usados, foram preservados apenas o arquivo por setor, o municipal e o dicionário (13,5 MB, com ligação física entre `raw` e `originals`). Ocupação real depois da carga: 21 MB no banco (2,3 MB por município; 18,7 MB nos setores com local de votação). Total de cerca de 34 MB.

Auditoria C1 independente (moradores, domicílios e faces, todos os setores e municípios): identidades das categorias em 100% dos setores e municípios; omissão só por “X” em todas as variáveis (1.418 setores, 632 municípios); soma dos setores igual ao arquivo municipal nos 4.938 municípios sem setor omitido e nunca acima dele nos demais, cujo total inclui os omitidos; 49.181 dos 71.287 setores associados a locais estão na pesquisa, 112 omitidos. Rampa e obstáculo só são avaliados onde há calçada: o “não declarado” desses itens inclui faces sem calçada. Detalhes na seção 13 do [plano de melhorias](docs/plano-postgis-propostas.md).

Decisões aplicadas, conforme as recomendações do plano: moradores como unidade; oito indicadores (calçada, rampa, obstáculo, iluminação, pavimentação, bueiro, ponto de ônibus, ao menos uma árvore), guardando as 35 contagens para que a escolha mude sem reimportar; exibição no município, em `/mapa` e no cartão do local. Domicílios e faces foram auditados e não importados.

Implementação: contratos `URBAN_CHARACTERISTICS`, `URBAN_INDICATORS`, `urbanIdentityErrors` e esquemas; migration 017; leitor de XLSX extraído para `apps/importer/src/xlsx.ts`, sem mudar a demografia nem sua versão; importador `urban-surroundings-2022-v1` (`npm run import:urban-surroundings`, entradas: contexto municipal e associação local → setor), com rótulos conferidos no dicionário, identidades, soma contra o arquivo municipal e omissão só por inteiro, tudo bloqueante. Publicação `960899b9899cf35438f8c3afd08ee0b7f1c6500303dfab8b4ca725e512150f1f` em 26 s, com totais iguais aos da auditoria. API: `urbanSurroundings` no contexto, oito indicadores `urban-*` em `map/values`, `urban` em cada setor da rota dos locais (pesquisado, omitido ou fora da pesquisa; ausente sem publicação) e a publicação no catálogo. Web: tabela do entorno no painel do município, com cobertura frente à população residente; entorno do setor no cartão do local; indicadores em `/mapa` com aviso do denominador; `/fontes` e `/metodologia`. Sem backup novo: a carga só criou duas tabelas e uma publicação, sem alterar dados existentes; o último backup completo é o de 18/10 (§28).

Verificação:

- **106 testes unitários** (28 API, 34 importador, 33 web, 11 contratos), typecheck e build.
- **Nove smokes e 31 regressões HTTP** com API e web compiladas. O `smoke:context` (96 requisições) confere valores lidos dos arquivos do IBGE: totais da publicação, calçada no Brasil (146.376.090 de 174.153.633 moradores), São Paulo e o setor do Colégio Objetivo.
- **`check:ui` completo** em Chrome 151.0.7922.71 e Firefox 158.0: 8 cenários e 36 avaliações axe/refluxo por navegador (`data/analysis/ui-checks/2026-10-19T17-27-29.986Z`). Depois das correções abaixo, os cenários de acessibilidade, inclusive o novo de detalhes abertos (6 avaliações por navegador), foram repetidos no build final e aprovados (`2026-10-19T17-42-53.668Z`).
- **Revisão visual** por capturas em `data/analysis/fase-c-2026-10-19/`.

Problemas encontrados e corrigidos durante a verificação: (1) a rota do catálogo não listava a publicação do entorno, embora o contrato a previsse; o `smoke:context` pulou o bloco em silêncio e a contagem de requisições denunciou. Corrigido, com teste da API que falharia sem a correção. (2) Com os detalhes abertos, o axe acusou regiões com o mesmo nome (`landmark-unique`) na tabela do setor repetida em cada cartão; o `check:ui` ganhou o cenário “Acessibilidade com detalhes abertos (municípios)”. (3) No celular, a regra global `min-width: 790px` das tabelas roláveis empurrava a coluna de percentuais da tabela do setor para fora do cartão; ela virou tabela simples de duas colunas, como a das candidaturas, o que também resolveu (2).

Encerramento: API e web temporárias encerradas, portas 3000/3001 livres; banco saudável, agora com a publicação do entorno. Não verificados: leitor de tela humano, Safari e dispositivos reais. A pedido de Rafael, código, testes, scripts e documentação da fase C foram consolidados em commit local, sem push. Ele definiu a sequência seguinte — fase B (começando pelo ensaio sem persistência, B1) e depois D — e pediu para aguardar novo aviso antes de iniciar cada uma.

## 35. Exploração da marca e identidade visual — 19/10/2026

Rafael solicitou versões de nome, logotipo e ícones para decidir a identidade do observatório, sugerindo Mente Eleitoral, Mentalidade Eleitoral e a frase “Um olhar único sobre votação e população”. No início: `main` em `c1484cf`, com modificação preexistente em `apps/web/next-env.d.ts`, preservada. Lidos o resumo vigente e os últimos registros do planejamento.

Criadas três pranchas com a ferramenta integrada de geração de imagens: **01 — Olhar / Mente Eleitoral**, olhar com barras de dados em marinho/teal; **02 — Conexões / Mentalidade Eleitoral**, M conectado em berinjela/lilás; **03 — Territórios / Mente Eleitoral**, monograma territorial em petróleo/terracota e tipografia editorial. Cada prancha contém logotipo, aplicação escura, símbolo para ícone e quatro ícones de navegação. Arquivos, apresentação e pedidos completos em [docs/identidade/2026-10-19/](docs/identidade/2026-10-19/README.md). A frase sugerida foi mantida nas três para comparação.

Verificação: revisão visual das três imagens (nomes, frase, acentos e elementos solicitados), integridade/dimensões dos PNGs, leitura do JSON dos pedidos, referências locais e `git diff --check`. Sem testes/build/smokes: somente estudos gráficos e documentação. Nome e identidade seguem em decisão; ícones ainda estão incorporados às pranchas, com refinamento vetorial, exportações individuais e verificação em tamanhos reais pendentes após a escolha. Sem mudanças na aplicação, importações, serviços iniciados ou implantação. Mudanças desta etapa sem commit, integralmente descritas neste registro.


## 36. Refinamento do M e variante verde-oliva — 19/10/2026

Rafael preferiu a direção 03 do §35 e solicitou linhas/grafos no M para remeter a cérebro, além de uma variante substituindo o petróleo por verde-oliva. Conferidos planejamento, histórico e estado do Git; preservadas a modificação preexistente em `apps/web/next-env.d.ts` e as propostas anteriores.

Criadas duas edições pela ferramenta integrada de imagens: **03A — M/conexões em petróleo**, com curvas internas e pontos de conexão, e **03B — M/conexões em verde-oliva** (`#4B5134` solicitado), derivada da 03A, mantendo tipografia editorial, frase, terracota e tons claros. As imagens e os pedidos completos estão em [docs/identidade/2026-10-19/](docs/identidade/2026-10-19/README.md). Rafael ainda decidirá sobre o símbolo refinado e a paleta final.

Verificação: revisão visual das duas pranchas, texto/acentos, mudança para oliva, correspondência geral do símbolo nas aplicações, presença dos quatro ícones; integridade/dimensões dos PNGs, leitura dos pedidos JSON, referências e `git diff --check`. Sem testes/build/smokes por serem apenas imagens e documentação. Sem alteração da aplicação, importações, serviços iniciados ou implantação. Pranchas são estudos; desenho vetorial, exportações individuais e avaliação em tamanhos reais seguem pendentes após a escolha. Mudanças desta etapa sem commit, descritas neste registro.


## 37. Aplicação de Mente Eleitoral e revisão do banner — 19/10/2026

Rafael aprovou a identidade **03A** (petróleo/terracota) e o nome **Mente Eleitoral**, pedindo sua aplicação e a revisão posterior do banner. Conferidos histórico e estado inicial (`c1484cf`), preservadas as propostas dos §§35–36 e a modificação preexistente em `apps/web/next-env.d.ts` (restaurada ao conteúdo exato do início depois dos arquivos gerados pelo build). Lidas as orientações da web e a documentação local do Next.js sobre fontes, metadados e ícones.

Implementação: contornos do M/conexões e das letras da prancha 03A convertidos em caminhos SVG locais, com versões clara, para fundo escuro e monocromática; logotipo sem dependência de fonte externa. Aplicados no cabeçalho, seis ícones de navegação, ícone SVG da aba, ícone Apple de 180 px, título/metadados Open Graph/Twitter e rodapé. Paleta normalizada em petróleo `#103F4C`, terracota `#BD7159`, aveia `#F1E7D7` e branco `#FFFDFA`, com variantes de terracota para texto/foco; títulos usam a pilha local Georgia/Times/serif. Escalas dos mapas preservadas. Nome e situação atualizados no resumo vigente, README e documentação de identidade.

Banner inicial revisado: frase “Um olhar único sobre votação e população”, explicação sobre TSE/IBGE e acessos à consulta e aos mapas; marca em destaque no desktop e composição simplificada no celular. A cobertura continua sendo a do recorte publicado, sem números novos ou estimados. Criados também banner SVG do README e imagem de compartilhamento 1200 × 630; exportador local `scripts/render-brand.mjs` usa Chrome com rede bloqueada. `SITE_URL` configura a origem dos metadados (padrão local; configurável na compilação futura); `.env` existente preservado. Dockerfile inclui `public/` na execução standalone. Arquivos e referências em [identidade visual](docs/identidade/2026-10-19/README.md).

Verificações:

- **106 testes** (28 API, 34 importador, 33 web, 11 contratos), typecheck e build completo aprovados; build da web repetido após os últimos ajustes de cor e metadados, sem avisos. `npm run smoke` aprovado com banco/API/web locais e dados já publicados.
- **72 avaliações axe/refluxo:** 12 páginas × 1280/375/320 px, em Chrome 151.0.7922.71 e Firefox 158.0, sem violações automáticas ou rolagem horizontal externa às tabelas. Relatórios `data/analysis/ui-checks/2026-10-19T18-27-40.890Z/` (Chrome) e `2026-10-19T18-30-01.156Z/` (Firefox). Cenário adicional de foco por teclado, movimento reduzido, estabilidade de consulta e captura em alto contraste aprovado no Chrome, CLS 0 (`2026-10-19T18-30-32.276Z/`). A primeira execução do roteiro completo foi interrompida com saída 143 durante os envios sem JavaScript; não foi declarada aprovada integralmente. Antes da interrupção, passaram os seis envios com JavaScript no Chrome; as subrotinas visuais foram concluídas separadamente por navegador. Os demais cenários do roteiro completo não foram todos repetidos nesta etapa.
- **Marca e banner:** nome, frase, metadados/imagem de compartilhamento, ícones, carregamento de todas as imagens, links dos arquivos públicos e âncora da consulta conferidos em 1280/1024/768/650/375/320 px, sem erros de execução nem refluxo; capturas em `data/analysis/brand-2026-10-19/`. Revisão visual do cabeçalho/banner em 1280 e 375 px e do banner de compartilhamento. SVGs, dimensões/integridade dos PNGs, referências locais, sintaxe do exportador e `git diff --check` conferidos.

Encerramento: API e web temporárias encerradas, portas 3000/3001 livres; PostgreSQL disponível, com conferência final somente de leitura. Sem importação, escrita nos dados ou implantação externa. Imagem Docker não reconstruída; arquivos públicos verificados na execução standalone local. Leitor de tela humano, Safari e dispositivos reais continuam pendentes; verificações automáticas não certificam toda a acessibilidade. Alterações desta etapa e estudos anteriores de identidade permanecem sem commit, descritos aqui e nos §§35–36.

## 38. Fase B1 do plano de melhorias: ensaio espacial sem persistência — 19/10/2026

Rafael pediu para continuar com a fase B; o Codex encerrou sua etapa (marca e banner, §§35–37, ainda sem commit e preservados intactos). No início: `main` em `c1484cf`, à frente de `upstream/main` por dois commits; `npm run dev` de Rafael em execução, mantido.

Criado `scripts/check-geo.ts` (`npm run check:geo`): carrega a malha preservada com o mesmo `loadTracts` da associação, em tabelas temporárias e numa transação desfeita, e mede tamanho, validade, cobertura, equivalência e desenho. Resultados completos na seção 14 do [plano de melhorias](docs/plano-postgis-propostas.md): 468.099 setores em 266 s; **1,4 GB** se guardados com a geometria exata; 30 setores inválidos (autointerseção do anel), registrados sem reparo; nenhuma aresta inválida de cobertura nos demais; **84.594 de 84.594** locais com situação e setor iguais aos publicados; desenho simplificado de 6 KB (município mediano) a 847 KB com gzip (São Paulo, 3 polígonos inválidos depois de simplificar), com 88 KB no maior distrito de São Paulo.

Verificação: SHA-256 do GeoPackage conferido; transação desfeita, tabelas temporárias ausentes ao fim e publicações iguais antes e depois (117/67); tipagem do script conferida com `tsc`. Sem escrita em tabelas públicas, importação, publicação ou implantação. Pendente: **decisão de Rafael sobre a B2** (geometria exata nacional ~1,4 GB, representação simplificada por município e distrito — recomendada —, ou UF piloto); B3 depende dela; D vem depois. Sem commit: `scripts/check-geo.ts`, o comando em `package.json` e a documentação desta etapa, junto das mudanças do Codex dos §§35–37.

## 39. Fase B2 do plano de melhorias: malha de setores com a geometria exata — 19/10/2026

Rafael escolheu guardar a geometria exata nacional (opção (a) da decisão 7), depois de saber que o projeto passaria de ~28,8 para ~30,2 GB. Backup completo antes da gravação (`data/backups/observatorio-2026-10-19-antes-geometria.dump`, SHA-256 `bd15b8d2…`) com ensaio de restauração integral em banco temporário (25 tabelas idênticas, 1.805 s).

Publicado `tract-geometries-2022-v1` (`2022/geo/tracts`, `90264219f250a36a…`): 468.099 setores (914 com partes unidas) em `tract_geometries`, 30 inválidos marcados sem reparo, conferência de 84.594 de 84.594 locais iguais à associação publicada (bloqueante). Tabela de 1.397 MB; banco de 10,94 para 12,41 GB. Importação de 4.353 s, quase toda na transação; a conferência isolada leva 46 s, e o importador ganhou `ANALYZE` depois da gravação (sem efeito no resultado; não exercitado numa carga completa). Contratos (`tractGeometriesDatasetSchema`, `tractGeometriesDatasets`), catálogo da API, `/fontes`, README, AGENTS e `docs/api.md` atualizados; detalhes na seção 15 do [plano de melhorias](docs/plano-postgis-propostas.md).

Verificação: typecheck, 106 testes, build; `smoke`, `smoke:pilot`, `smoke:places`, `smoke:national`, `smoke:summary`, `smoke:exterior`, `smoke:governor`, `smoke:senator`, `smoke:context`, `check:data`, `check:regressions`, `check:publication` e `check:ui` (Chrome e Firefox) aprovados contra API/web compiladas, com o banco local. B1 e B2 em commit local, sem push (importador, migração, contratos, API, `/fontes`, `scripts/check-geo.ts` e documentação). As mudanças do Codex dos §§35–37 (marca e identidade) ficaram fora desse commit, ainda pendentes na árvore de trabalho.

Pendente: B3 (mapa local → setor), a iniciar com o aval de Rafael; D depois. A investigar a pedido de Rafael: em algumas faixas de idade, a população do IBGE no município fica menor que os eleitores aptos do TSE — verificar se é erro de cálculo, de correspondência das faixas (datas de referência das idades, limites) ou característica das fontes (domicílio eleitoral ≠ residência recenseada, cadastro desatualizado), sem ajustar números.

## 40. Investigação: população do IBGE menor que eleitores aptos do TSE por faixa etária — 19/10/2026

Pedido de Rafael: na tabela “Eleitorado e população por idade” do contexto municipal, em alguns municípios a população do IBGE é menor que os eleitores aptos do TSE. Antes, o commit `368aeaf` registrou as fases B1 e B2 (as mudanças do Codex dos §§35–37 seguem fora dele).

Consultas somente de leitura na publicação `municipal-context-2022-v3` e nos originais preservados:

- **Código e consulta:** a SIDRA 9514 é consultada com população residente, sexo total e forma de declaração da idade total (cabeçalho do JSON preservado conferido); as faixas do TSE correspondem às do IBGE (16 a 20 anos individuais; 21 a 24 = “20 a 24” − “20 anos”; quinquenais até 100+). Recálculo independente a partir do CSV do TSE e do JSON da SIDRA, sem o código do importador: **0 divergências** em 1.650 células (75 municípios de SE) e 14.190 células (645 de SP). O traço da SIDRA é zero absoluto e é lido assim pelo importador.
- **Dimensão:** o cadastro supera a população da faixa em 71–83% dos municípios nas faixas quinquenais de 25 a 79 anos, e na maioria até 100+; nas faixas de 16 a 20 anos isso ocorre em 0,4% (16) a 48% (20). No total nacional, a razão fica perto de 100% nas faixas adultas (99,1% de 18 a 69 anos), abaixo nas de 16 a 20 (28% a 89%) e muito acima nas de 90+ (127%, 282% e 487%).
- **Porte:** o cadastro supera a população de 16+ em 2.185 dos 2.494 municípios com menos de 10 mil habitantes (razão agregada de 113,4%), em 1.479 de 2.419 entre 10 e 50 mil (102,3%) e fica abaixo nos maiores (91,3% a 97,9%). Em 600 municípios o cadastro supera até a população total, crianças incluídas (ex.: Amparo de São Francisco/SE, 2.686 aptos e 2.170 moradores).
- **Cadastro × resultados:** o arquivo do perfil foi regerado em 25/08/2025 (`DT_GERACAO`), mas soma 155.756.933 aptos contra 155.758.656 nos resultados do 1º turno (27 UFs); as idades são as de 2022 (há eleitores de 16 anos). O dicionário (`leiame.pdf`) não informa a data de referência da idade; o Censo usa 31/07/2022.

Conclusão: não é bug nem incoerência de cálculo. É característica das fontes: domicílio eleitoral não é residência (quem migrou mantém o título no município de origem, o que explica o padrão por porte); nas faixas de 90+ o excesso aparece também no total nacional, o que a migração interna não explica, e nenhuma das fontes informa a causa; nas faixas de um ano, pesam a data de referência e o alistamento facultativo ou tardio. Nenhum número foi ajustado. Mudança só de texto: nota abaixo da tabela por idade na página do município e complemento em `/metodologia#contexto`.

Verificação: typecheck, 106 testes, build, `smoke:context` e `check:ui` (Chrome e Firefox) aprovados contra API/web compiladas; texto conferido na página de Amparo de São Francisco. Em commit junto da B3 e da D1. Próximo: B3, conforme pedido de Rafael.

## 41. Fase B3 do plano de melhorias: mapa local → setor — 19/10/2026

Página `/municipios/[code]/setores` (link na página do município): setores do Censo 2022 coloridos só pela faixa fixa de renda mediana do responsável e locais de votação como pontos neutros, com tabela equivalente; nenhum voto é desenhado em setores. Publicados `income-bands-2022-v3` (mesmas contagens da v2 e a faixa de cada setor em `tract_income_bands`, 116 MB) e `tract-display-2022-v1` (desenho simplificado pré-calculado por município, 209 MB; São Paulo dividido em 96 distritos). Rota `GET /elections/municipalities/:code/tract-map`, imagem SVG servida à parte e comprimida. Dois polígonos sem município (posição das lagoas dos Patos e Mirim, RS) ficam fora do desenho, com exclusão declarada; os 30 setores inválidos são desenhados exatos. Detalhes, medidas e decisões na seção 16 do [plano de melhorias](docs/plano-postgis-propostas.md). README, AGENTS, `docs/api.md`, `/metodologia`, `/fontes`, `check-reimports` (income-bands v3), `smoke:context` e `check:ui` atualizados.

Verificação: typecheck, 109 testes, build, nove smokes, `check:data`, `check:regressions`, `check:publication` e `check:ui` (duas páginas novas em três larguras, Chrome e Firefox) aprovados contra API/web compiladas. Banco: 12,75 GB. Em commit local com a investigação do §40 e a D1, sem push. Pendente: fase D (D1 a seguir, inventário sem publicação), conforme pedido de Rafael.

## 42. Fase D1 do plano de melhorias: inventário das propostas de governo — 20/10/2026

Inventário da Presidência de 2022 sem publicação nem escrita no banco (`npm run inventory:proposals`): originais `proposta_governo_2022_BR.zip` e `consulta_cand_2022.zip` preservados em `data/originals/`; 13 candidaturas do 1º turno (11 aptas) e 13 PDFs, ligados pelo `SQ_CANDIDATO`; 450 páginas, 376 com texto nativo; nenhum arquivo órfão, protegido ou ilegível. O documento de Ciro Gomes (nº 12) não tem texto extraível (26 páginas em imagem); o nº 14 tem o mesmo PDF para a candidatura indeferida e a substituta. Tabela e decisões na seção 17 do [plano de melhorias](docs/plano-postgis-propostas.md). Verificação: typecheck do importador; relatório em `data/analysis/propostas-inventario-2026-10-20T01-32-13.578Z/`; nenhuma alteração no banco. Em commit local com a B3, sem push.

Pendente — decisões de Rafael antes da D2: OCR para documentos em imagem (sem ele, a busca seria desigual entre candidaturas; instalar `tesseract-ocr` é pacote de sistema), tratamento do PDF duplicado do nº 14 e da candidatura inapta do nº 90, e se PDFs individuais serão servidos. D3 continua dependendo de definir a revisão humana.

## 43. Fase D2 do plano de melhorias: busca nas propostas de governo (implementada, aguardando OCR) — 20/10/2026

Rafael decidiu: OCR (Tesseract, português) nos documentos em imagem e nas páginas sem texto; documento repetido do nº 14 uma vez, na candidatura apta (Padre Kelmon), com nota sobre a indeferida; nº 90 à parte; só o ZIP original servido. Nota: na resposta, o nº 14 foi associado ao PDT/Ciro Gomes; no cadastro do TSE, Ciro Gomes é o nº 12 (PDT) e o nº 14 é do PTB — registrado e confirmado com Rafael na sugestão aceita. Commit `eb53b8f` antes desta etapa (investigação IBGE × TSE, B3 e D1).

Implementados importador (`import:proposals`, `proposals-2022-v1`), migração 020, normalização compartilhada nos contratos, `GET /elections/proposals`, página `/propostas`, seções em `/metodologia` e `/fontes`, testes da API e da web. Detalhes na seção 18 do [plano de melhorias](docs/plano-postgis-propostas.md). Rafael instalou o Tesseract 5.3.4; publicado `proposals-2022-v1` (`cce780ce…`): 438 páginas, 388 com texto do PDF e 50 por OCR, 1,6 MB. OCR conferido por amostra em duas páginas (fiel em página de texto; erros localizados em página com fundo gráfico). Corrigida falha do catálogo (500 com a publicação das propostas na lista eleitoral). Verificação: typecheck, testes, build, nove smokes (com o bloco das propostas), `check:data`, `check:regressions`, `check:publication` e `check:ui` com `/propostas`, contra API/web compiladas nas portas 3100/3101 (o `npm run dev` de Rafael estava nas 3000/3001). Em commit local, sem push. Link na navegação em commit próprio, depois do commit do trabalho do Codex (§§35–37), autorizado por Rafael; D3 depende de definir a revisão humana.

## 44. Revisão de código: proveniência em `/fontes` e caracteres de controle nas buscas — 20/10/2026

Revisão de código (Claude Code) sobre o último commit, a fase D2 e a identidade visual; Rafael pediu as correções dos itens 1 e 5, e os demais achados ficam registrados abaixo como pendentes.

- `/fontes`: toda importação sem linhas em `import_coverage` dizia ser o piloto de São Paulo com os dois turnos reconciliados — afirmação falsa para contexto, malhas, locais, setores e propostas — e as propostas apareciam como "proposals 2022 — president". Rótulos e o texto sem cobertura passaram para `apps/web/lib/import-scopes.ts`: o piloto só é declarado quando é o escopo `2022/president/SP/71072` publicado; publicações com seção própria remetem a ela (grupos de locais, à `/metodologia#perfis`); o resto mostra "Nenhuma cobertura por município registrada para esta versão".
- Buscas em texto livre (`search` de municípios, locais e exterior; `q` das sugestões e das propostas): caracteres de controle fora espaços, tabulações e quebras de linha são recusados nos contratos (`hasControlCharacters`), com 400 em vez de 503 "Banco de dados indisponível" (o NUL é rejeitado pelo PostgreSQL e o `DatabaseService` converte qualquer erro em indisponibilidade). Mensagens da API, de `query-ui` e de `/propostas` e `docs/api.md` atualizadas.

Verificação: typecheck, 115 testes (novos casos nos contratos, na API e na web; os da API falham contra o contrato anterior), build, e `/propostas` compilada contra uma API falsa que responde 400 (mensagem própria para `q` com NUL; a de 3 a 80 caracteres segue para `q=ab`). Não verificados: smokes, `check:ui` e `/fontes` contra um catálogo real (sem banco nem Docker nesta sessão); a rejeição do NUL pelo PostgreSQL não foi reproduzida localmente. Node 22 na sessão, não o 24 do `.nvmrc`.

Pendente da revisão, sem decisão: busca nas propostas perde ocorrências com `pdftotext -layout` em páginas de colunas, hífens Unicode/invisíveis e ligaduras, e junção de hífen em palavras compostas ("pré-sal"); páginas nativas com texto ilegível (U+FFFD) não vão para OCR; versão da normalização fora do método da publicação. Correção exige `proposals-2022-v2` e reimportação, sem reescrever a v1. Menores: texto fixo do grupo "Candidaturas sem votos", consulta que traz o texto inteiro de todas as páginas encontradas, `SITE_URL` vazio derruba as páginas e não chega ao build do Docker, `/propostas` sem título próprio, cabeçalhos `h3` do grupo e das candidaturas no mesmo nível, mensagem de `version()` no importador, "link na navegação" ainda pendente em `docs/plano-postgis-propostas.md` e README dizendo "sem push".

## 45. Plano da `proposals-2022-v2` da busca nas propostas — 20/10/2026

Rafael pediu o plano para os itens 2–4 da revisão (§44). Ele está na seção 19 do [plano de melhorias](docs/plano-postgis-propostas.md), com auditoria, proposta, validação, ordem e decisões.

Evidência já obtida com um PDF sintético de duas colunas no `pdftotext` 24.02.0, a versão da v1:
- `-layout` (v1) mistura as colunas na mesma linha e separa a palavra partida da continuação.
- O modo padrão separa as colunas, mas o Poppler remove o hífen de fim de linha sem volta ("présal", "20222026").
- `-bbox-layout` separa as colunas e preserva hífens e quebras de linha.

A recomendação é remontar o texto a partir dele e guardar o hífen de fim de linha como marcador opcional na normalização. Nada foi implementado nem importado. A auditoria dos PDFs reais não rodou nesta sessão: a rede do ambiente recusa `cdn.tse.jus.br` e não há `data/` aqui.

Pendente:
- auditoria `audit:proposals-text`, só leitura, na máquina com os originais;
- decisões 1–5 de Rafael (seção 19);
- correções sem reimportação (`SITE_URL`, README "sem push").

## 46. Script da auditoria do texto das propostas — 20/10/2026

Rafael pediu o script do passo 1 do plano da v2 (seção 19 do [plano de melhorias](docs/plano-postgis-propostas.md)).

- **Script:** `npm run audit:proposals-text` (`apps/importer/src/proposals-text-audit.ts`, funções em `proposals-text.ts`). Só leitura: originais preservados, staging próprio, relatório e imagens em `data/analysis/propostas-texto-<data>/`.
- **Comparação com a v1:** opcional, com o banco em modo só leitura.
- **Normalização:** a proposta é um protótipo dentro do script; a busca publicada não muda.

Verificação: typecheck, 121 testes (6 novos no importador) e o script inteiro rodado de duas formas, ambas desfeitas ao final:
- numa cópia do repositório, com ZIPs sintéticos;
- contra um PostgreSQL 16 temporário com uma v1 simulada.

Na mesma sessão, ficou confirmado que o PostgreSQL rejeita NUL num parâmetro de texto (`22021 invalid byte sequence for encoding "UTF8": 0x00`). Esse era o ponto não reproduzido do §44.

Pendente:
- rodar a auditoria nos PDFs reais na máquina de Rafael (decisão dele, 20/10/2026), onde estão `data/` e os originais preservados. Sem dependência nova: `npm ci` (se preciso), banco no ar para a comparação com a v1 (opcional) e `npm run audit:proposals-text`. Usa `pdfinfo`, `pdftotext` e `pdftoppm` do poppler-utils, já exigidos pela v1. Levar ao agente seguinte o `report.json` e, se possível, as imagens de `paginas/`;
- as decisões 1–5 da seção 19, a partir do relatório;
- correções sem reimportação, ainda não feitas: `SITE_URL` vazio e o README dizendo "sem push".

Os commits desta sessão (§§44–46) foram feitos no branch `ccr-7d7c3c6c-8vzdyn`, a partir de `443c0d1` do `main`.

## 47. Auditoria do texto das propostas nos PDFs reais e correções sem reimportação — 20/10/2026

Rafael pediu, no Claude Code local, para seguir com as próximas etapas da revisão feita remotamente (§§44–46).

- **Auditoria** (`npm run audit:proposals-text`, só leitura, banco no ar): relatório final em `data/analysis/propostas-texto-2026-10-20T23-03-39.700Z/`; as execuções anteriores do dia ficam como histórico. O `-layout` reproduz as 388 páginas nativas da v1 publicada (`cce780ce…`, mesmo ZIP).
- **Falha da remontagem, corrigida no script:** a primeira execução punha espaço entre todas as palavras do `-bbox-layout`, e o Poppler parte palavras na ligadura (nº 22: "ﬁ" e "m"). O espaço passou a depender da distância entre palavras (`WORD_SPACE`, 0,04 da altura da linha), com a estrutura do modo padrão. A remontagem é conferida contra o modo padrão do `pdftotext`: 438 de 438 páginas idênticas.
- **Outras mudanças no script:**
  - amostra para conferência visual por documento;
  - simulação da busca com a semântica de cada versão (`search`), procurando no texto `-raw` o que só a v1 encontra;
  - opção `-- --termos=`;
  - depois de linha em branco, junção de hífen só entre letras: no OCR do nº 12, o hífen do fim da página vinha seguido do número da página;
  - o script da raiz não repassava argumentos (o `-- --sem-imagens` documentado falhava no npm); agora repassa.
- **Achados** (detalhes na seção 19 do [plano de melhorias](docs/plano-postgis-propostas.md)):
  - ligaduras só no documento do nº 22 (334): nele, a v1 não acha "inflação" nenhuma vez e a proposta acha 8; "eficiência" passa de 12 para 39;
  - colunas misturadas no `-layout`, sobretudo nos nº 22, 30 e 14;
  - 461 hífens de fim de linha, 23 deles em palavras compostas confirmadas;
  - nenhuma página ilegível;
  - tudo o que só a v1 encontra (151 pares termo × página, nos nº 30, 14, 22 e 90) é palavra colada entre colunas e não existe no texto `-raw`.
- **Recomendações revistas:** extração e hífen como propostos, com a regra de espaço, a conferência contra o modo padrão (bloqueante) e a regra da linha em branco. Para páginas ilegíveis, medir e bloquear a publicação, em vez de OCR com páginas suspeitas (sem migração 021 nem mudança na interface).
- **`SITE_URL`** (fora da v2): `apps/web/lib/site-url.ts`. Vazia ou ausente vale o padrão local; inválida ou sem http(s) interrompe com mensagem própria. Dockerfile e Compose passam o valor como argumento de build, mantido na imagem.
- **Documentação:** README e "Estado atual" deste arquivo sem o "sem push" desatualizado e com as fases concluídas.

Verificação:
- typecheck e 123 testes (12 nos contratos, 30 na API, 41 no importador e 40 na web), entre eles os 7 da auditoria, revistos, e 1 novo na web;
- `next build` com `SITE_URL` vazia, com `https://exemplo.org/mente` e com valor inválido (falha com a mensagem própria), conferindo a `og:image` da página estática `/metodologia`; recompilado depois com o `.env`;
- imagem Docker da web com e sem `--build-arg SITE_URL`: a variável chega à execução e à `og:image` da página estática; imagens de teste removidas, as de Rafael intactas;
- nove smokes contra API/web compiladas nas portas 3101/3100, encerradas ao final.

Não rodados: `check:data`, `check:regressions`, `check:publication` e `check:ui`. Não houve mudança de dados, rotas ou interface, além das metas de compartilhamento.

A pedido de Rafael, em dois commits locais no `main`, sem push: correção do `SITE_URL` com o README; auditoria com a documentação.

Pendente:
- decisões 1–5 da seção 19 (Rafael);
- depois delas, implementação da v2, carga e validação.

## 48. `proposals-2022-v2` da busca nas propostas: implementação, carga e verificação — 20/10/2026

Rafael decidiu seguir as cinco recomendações da seção 19 do [plano de melhorias](docs/plano-postgis-propostas.md):
1. extração pela remontagem do `-bbox-layout`, conferida com o modo padrão do `pdftotext`;
2. hífen de fim de linha como marcador opcional, só entre letras depois de linha em branco;
3. mapeamentos de caracteres, com o travessão de fora;
4. páginas ilegíveis medidas e bloqueantes, sem migração nem mudança na interface;
5. 503 explícito na busca enquanto a publicação ativa for de outra normalização.

- **Implementação** (detalhes no andamento da seção 19):
  - normalização `proposals-search-v2` e expressão de busca nos contratos;
  - importador `proposals-2022-v2` com a remontagem conferida e o limite de qualidade;
  - API com a mesma expressão no banco e nos trechos, texto só das cinco primeiras páginas de cada documento e 503 para outra normalização;
  - web com título próprio em `/propostas`, cabeçalhos dos grupos corrigidos e a situação de cada candidatura sem votos;
  - auditoria comparando a normalização da v1, congelada, com o código de produção.
- **Carga:** `e2c6e07e…` publicada em 357 s, com os mesmos totais da v1 (438 páginas, 388 com o texto do PDF, 50 por OCR). A v1 (`cce780ce…`) ficou preservada, despublicada; as tabelas das propostas passaram de 1,6 MB para 3,0 MB. A API local não estava no ar entre a troca de código e a carga, então o 503 de transição não chegou a ser servido.
- **Validação** (auditoria depois da carga): páginas nativas da v1 iguais ao `-layout` (388/388) e da v2 iguais à remontagem (388/388); OCR da v2 idêntico ao da v1 (50/50); nenhum `search_text` divergente. Busca: tudo o que só a v1 encontrava eram palavras coladas entre colunas; "acessibilidade" encontra as mesmas páginas da v1; "inflação" passa a aparecer no nº 22 (6 páginas) e "responsabilização" no nº 30 (p. 33), que a v1 não encontrava.
- **Pergunta de Rafael sobre o Tesseract na hospedagem:** `poppler-utils`, `tesseract-ocr` e `tesseract-ocr-por` são pacotes do sistema (apt), que o `npm ci` não instala, e só o importador os usa; a API e a web leem o texto do banco. Para hospedar, importar localmente e levar o banco com `data/originals` e `data/audit` dispensa as ferramentas no servidor. Importar no servidor exige uma imagem do importador com as versões fixadas: elas entram na identidade da publicação, e o Ubuntu 24.04 tem as atuais (Poppler 24.02.0, Tesseract 5.3.4, dados `por` 4.1.0). Decisão junto com a hospedagem; README e AGENTS passam a listar os pacotes.

Verificação:
- typecheck e 128 testes (16 nos contratos, 30 na API, 41 no importador e 41 na web);
- builds dos contratos, da API e da web;
- PostgreSQL e JavaScript com o mesmo resultado para 15 expressões de busca, inclusive caracteres especiais;
- nove smokes contra API/web compiladas nas portas 3101/3100 (o `smoke:context`, com 117 requisições, cobre a v2), `check:data`, `check:regressions` e `check:publication`;
- `check:ui` em Chrome 151 e Firefox 158: 96 avaliações de axe e refluxo sem violações, 12 delas em `/propostas` com e sem busca (1280, 375 e 320 px); servidores de teste encerrados ao final.

Não verificados, como nas etapas anteriores: leitor de tela humano, Safari e dispositivos reais.

A pedido de Rafael, em commit local no `main`, sem push.

Pendente:
- decisão da hospedagem, com o caminho do importador;
- D3 (revisão humana) e E, sem decisão.

## 49. Fase D3 (preparação da rubrica) e fase E (pesquisa documental) — 20/10/2026

Rafael pediu para atacar a D3 e depois a E. Para a D3, definiu:
- quem revisa ainda não está definido: preparar tudo, e a codificação espera;
- tema piloto: acessibilidade e mobilidade urbana;
- uma planilha CSV por pessoa;
- trechos candidatos por busca literal com termos publicados.

**D3** (seção 20 do [plano de melhorias](docs/plano-postgis-propostas.md)):
- livro de códigos em [rubrica das propostas](docs/rubrica-propostas.md), versão `rubrica-acessibilidade-mobilidade-v1`, com 11 critérios documentais, sem nota, peso nem ordenação;
- `npm run rubric:packet` gera o pacote idêntico para as duas pessoas: PDFs conferidos, texto publicado por página, 132 trechos candidatos em 80 páginas e modelo com 132 linhas;
- `npm run rubric:agreement` valida as planilhas contra o texto publicado, mede a concordância (kappa de Cohen) e consolida a adjudicação;
- lista de termos medida no corpus: ficam os termos do tema, mesmo sem ocorrência; saem só os que colidem com outras palavras na busca por trecho, como "trem", "metrô" e "PcD";
- pacote em `data/rubric/rubrica-acessibilidade-mobilidade-v1/pacote-2026-10-21T00-47-35.678Z/`;
- fluxo ensaiado com planilhas fictícias fora do repositório, apagadas depois.

Nada foi codificado nem publicado.

**E** (seção 21 do plano):
- **ESEB 2022:** quatro documentos públicos (página do estudo, metodologia, tabelas de frequência e relatório do CSES feito pela Quaest) dão 2.001 entrevistas e início do campo em 19/11/2022. Só a ficha técnica do catálogo traz 1806 e "10/2022"; a confirmação depende dos microdados, com cadastro.
- O ESEB não tem pergunta de prioridade. O LAPOP Brasil 2023 tem (A4N, "problema mais grave"): 1.526 entrevistas de junho a julho de 2023, peso `wt`.
- Os dois proíbem republicar microdados, e o CESOP veda uso comercial e exige citação e cópia dos trabalhos.
- As cópias dos documentos consultados, com origem e SHA-256, estão em `data/analysis/pesquisas-prioridades-2026-10-20/`.

AGENTS passa a citar a rubrica e os comandos.

Verificação:
- typecheck e 133 testes (5 novos da rubrica);
- pacote gerado do banco em modo só leitura, com os PDFs conferidos pelo SHA-256;
- ensaio do fluxo da concordância e da adjudicação.

Sem smokes nem `check:ui`: nada mudou na API, na web ou nos dados publicados. Na pesquisa, só documentação pública: sem cadastro, contrato aceito ou download de microdados.

A pedido de Rafael, em commit local no `main`, sem push.

Pendente:
- D3: quem codifica e como se adjudica; aprovação do livro de códigos; concordância mínima; publicação e canal de contestação;
- E: seguir ou não; qual pesquisa; cadastro no CESOP ou contrato do LAPOP, ambos com Rafael;
- hospedagem.

## 50. Next.js 16.4.0 → 16.4.2 por aviso de segurança — 22/10/2026

O Next.js avisou que a 16.4.0 tem um alerta de segurança publicado. A pedido de Rafael, segui `next upgrade --agent=security`, que escolheu a 16.4.2 (mesma major, sem codemod).

Mudanças:
- `next` fixado em 16.4.2 em `apps/web/package.json` e no `package-lock.json`;
- `experimental.agentUpgrade: 'security'` em `apps/web/next.config.mjs`, para o Next.js voltar a avisar só de atualizações de segurança.

Antes de mudar, procurei trabalho equivalente: nenhuma branch local ou remota com a atualização e nenhum PR aberto.

Verificação, numa worktree separada (branch `next-16.4.2-security`):
- `npm ci` e `next --version` = 16.4.2;
- typecheck, 133 testes e build;
- web da 16.4.2 com a API e o banco locais: `smoke`, `smoke:pilot`, `smoke:places`, `smoke:national`, `smoke:summary`, `smoke:exterior`, `smoke:governor`, `smoke:senator`, `smoke:context` e `check:ui`, todos passando.

Nada mudou nos dados nem na API. Sem push nem PR.

Pendente: levar a branch ao `main` (merge) e apagar a worktree.
## 51. Avaliação de 2026 (1º turno) e pesquisa sobre espectro político — 22/10/2026

A pedido de Rafael, duas avaliações sem importação nem código:

- **2026, 1º turno** ([avaliação](docs/avaliacao-2026-primeiro-turno.md)): o TSE publicou Presidente, Governador e Senador. As colunas são as de 2022; mudam as aspas e a caixa dos textos. Exterior no arquivo `BR` (o ZIP `ZZ` de seções está vazio). Senado com votos = 2 × comparecimento, o que bloquearia a regra atual (`model.ts:189`). Muitos votos sub judice, nominal regerado em 22/10 e 2º turno da Presidência em 25/10. Estimativa de ~11–13 GB entre originais, staging e banco, com 59 GB livres. Recomendação: esperar o 2º turno e a estabilização e carregar os dois turnos em versões novas. Achados laterais: 7,3 mi de linhas de publicações antigas em `national_section_votes`; nominal de 2022 regerado pelo TSE com outro tamanho.
- **Espectro político** ([pesquisa](docs/pesquisa-espectro-politico.md)): Nolan, bússola e VAAs descartados (contrariam o §2, o resultado depende do método e há a Res. TSE 23.755/2026, que precisa de leitura jurídica). Proposta construtiva: quadro de posições documentadas por tema, continuação da D3, sem eixo nem afinidade. Partidos posicionados por pesquisas acadêmicas citadas ficam como opção separada.

Verificação: catálogo e cabeçalhos HTTP do TSE, leitura parcial dos ZIPs, detalhe por zona e relatório de totalização da Presidência baixados fora do repositório, contagens no banco em modo só leitura. Sem testes: nada mudou no código.

Pendente (decisões de Rafael): esperar ou não o 2º turno; apresentação do Senado com duas vagas; limpeza das publicações antigas; opção D/C da pesquisa; merge da branch `next-16.4.2-security` (§50, na worktree `../observatorio-eleitoral-next-upgrade`) no `main`.

## 52. Decisões sobre 2026 e bússola política — 22/10/2026

Rafael decidiu:
1. esperar o 2º turno de 2026;
2. Senado com duas vagas apresentado de forma simples, pela quantidade de votos e com as eleitas destacadas, explicando a escolha de duas candidaturas;
3. limpar as publicações antigas antes da carga;
4. refletir sobre a pesquisa do espectro e planejar, se for construtivo;
5. merge da atualização do Next.js.

Detalhes em [avaliação de 2026](docs/avaliacao-2026-primeiro-turno.md).

Sobre o espectro, Rafael também decidiu:
- esquerda e direita não ferem o §2 quando não há indução;
- o problema são rótulos pejorativos;
- a Res. TSE 23.755/2026 não se aplica ao projeto, que não recomenda candidaturas.

A pesquisa ganhou outros modelos além de Nolan, e há um rascunho de [plano da bússola política](docs/plano-bussola-politica.md): dois eixos (economia esquerda–direita × costumes progressista–conservador), posições por codificação humana em dupla dos planos de governo de 2022, incerteza e cobertura publicadas, sem afinidade nem recomendação. O texto do §2 e do `AGENTS.md` só muda quando o plano for aprovado (proposta no próprio plano).

Feito: fast-forward do `main` para a branch do §50 (o conflito entre os registros §50 e §51 no fim do `plan.md` foi resolvido mantendo os dois), worktree removida, branch apagada e `npm ci` no `main` (`next --version` = 16.4.2). Inventário somente de leitura dos 52 lotes não publicados.

Pendente:
- aprovar o plano da bússola (fase P0);
- limpeza, quando a carga de 2026 começar;
- carga de 2026 depois do 2º turno.

## 53. Bússola política no modelo Kieskompas: livro de códigos, pacote e cálculo — 22/10/2026

Rafael escolheu o Kieskompas ("vamos por ele") e autorizou seguir sem novas perguntas. Feito (detalhes no [plano](docs/plano-bussola-politica.md) e no [livro de códigos](docs/bussola-livro-de-codigos.md)):

- **Modelo:** eixos economia (esquerda–direita) × costumes (progressista–conservador) e escala de cinco pontos, como no Kieskompas, com o método da família documentado pelo Volebný Kompas (2024). Diferenças declaradas:
  - sem autoposicionamento das campanhas;
  - fonte única: o plano de governo;
  - "sem posição" fora da média, nunca neutro;
  - mínimo de 4 afirmações por eixo.
- **`bussola-kieskompas-v1`:** 24 afirmações, 6 por polo em cada eixo, com termos medidos no corpus de 2022 e 10 termos excluídos por colisão ou amplitude.
- **Código:**
  - o fluxo da rubrica da D3 foi generalizado (`rubric-core.ts`: `validateRows` e critérios por parâmetro; `rubric.ts`: `packet` e `agreementReport` recebem a definição do livro de códigos);
  - `compass-core.ts`: afirmações, escala, kappa ponderado, posições, intervalo por reamostragem com semente fixa e sensibilidade;
  - `compass.ts`, com `npm run compass:packet` e `compass:agreement`.
- **Pacote real:** `data/compass/bussola-kieskompas-v1/pacote-2026-10-23T00-14-13.878Z/` (12 documentos, 288 linhas, 636 trechos candidatos em 218 páginas).
- **§2 e `AGENTS.md`:** passam a trazer a regra da bússola.

Verificação:
- typecheck e 137 testes (4 novos da bússola);
- pacote da D3 regerado depois da refatoração, idêntico ao de 21/10 salvo o `generatedAt` (a cópia de verificação foi apagada);
- fluxo da concordância ensaiado com planilhas fictícias fora do repositório, até as posições; o ensaio revelou um arredondamento no kappa ponderado, já corrigido com teste. As planilhas e o resultado do ensaio foram apagados.

Sem smokes nem `check:ui`: nada mudou na API, na web ou nos dados publicados.

Pendente:
- aprovação do livro de códigos;
- quem codifica e quem adjudica (com a D3);
- concordância mínima;
- importação `compass-2022-v1`, conferência externa e página `/propostas/bussola` depois da codificação real;
- carga de 2026 e limpeza dos lotes antigos depois do 2º turno (§52).

Sem commit.

Atualização (22/10/2026): Rafael leu e aprovou as 24 afirmações da seção 4 do livro de códigos, que podem ser ampliadas em versões futuras (cada ampliação é uma nova versão, com novo pacote). Seguem pendentes quem codifica e quem adjudica, e a concordância mínima.

Atualização (22/10/2026): concordância mínima decidida — kappa ponderado da escala ≥ 0,70 em cada eixo para publicá-lo (Rafael também considerou razoável 0,75). Abaixo disso, o eixo não é publicado e as afirmações com mais divergência voltam para revisão numa nova versão. `compass:agreement` marca `publishable` em cada eixo (`MIN_AXIS_KAPPA` em `compass-core.ts`). Segue pendente quem codifica e quem adjudica.

## 54. Codificação A da bússola pelo Claude — 22/10/2026

Rafael decidiu que o Claude faz uma das duas codificações da bússola, e a divergência será vista depois. A regra muda no §2, no `AGENTS.md`, no livro de códigos e no plano: duas codificações independentes, uma delas podendo ser de modelo de linguagem, declarada como tal na publicação, e adjudicação humana.

Feito:
- **Codificação A:** planilha de 288 linhas, somente leitura, SHA-256 `3ada9942868463da8f18354c72d121c766ad904a527b8cd92adfd9d5f4949d4f`; gravada no diretório do pacote e substituída em 24/10/2026 (§55).
- **Contagem e cobertura por plano:** retiradas deste registro em 24/10/2026 (§55), para não influenciar a codificação B; ficam nas notas da codificação A, fora do pacote.
- **Posições não calculadas** de propósito, para não influenciar a codificação B.
- **Leitura:**
  - texto inteiro em 8 planos;
  - nos nº 22, 30, 44 e 90 (os mais longos), sumário, títulos e seções de cada tema localizadas por busca ampla;
  - limitação declarada então no livro de códigos, com outras quatro lacunas para a próxima versão; a leitura parcial foi refeita em 24/10/2026 (§55).

Verificação: os trechos dos 12 documentos passaram pela validação do `compass:agreement` (mesma função, `validateCompass`, contra o texto publicado).

Pendente:
- codificação B por uma pessoa, sem ver a A;
- adjudicação humana;
- depois, `compass:agreement` com as duas planilhas e a publicação.

Commit `9c493d9` (22/10/2026).

## 55. Correções da revisão da codificação A e releitura completa — 24/10/2026

A revisão de código do commit `9c493d9` (`/code-review`) apontou dez problemas. Os mais graves eram quatro: a planilha A estava dentro do pacote que vai para quem faz a B; o livro de códigos e este `plan.md` mostravam valores e a cobertura da A; e a A leu só em parte os nº 22, 30, 44 e 90, ferindo a regra de mesmos critérios para todas as candidaturas. Rafael pediu que tudo fosse corrigido, com a releitura completa dos quatro planos.

Feito:
- **Independência da B:**
  - a planilha A saiu do pacote: agora fica em `data/compass/bussola-kieskompas-v1/codificacao-a/`, junto com as notas (`NOTAS.md`: lacunas, contagem, cobertura e mudanças), que não vão para quem faz a B;
  - a seção 10 do livro de códigos (lacunas com os valores da A) foi para essas notas;
  - a contagem e a cobertura por plano saíram do §54.
- **Releitura completa:**
  - os nº 22, 30, 44 e 90 foram lidos por inteiro, página a página, e as 96 linhas deles foram refeitas sem consultar a versão anterior;
  - as 192 linhas dos outros oito planos não mudaram;
  - a nova planilha é `codificacao-claude-2026-10-24.csv`, somente leitura, SHA-256 `00165d7316d393814c2ee0079a303cb6c10fce9f8832ff1b0eb1831fa2f63e38`;
  - a de 22/10 continua guardada, sem alteração, como `codificacao-claude-2026-10-22.csv`.
- **Autoria declarada no código:**
  - `rubric:agreement` e `compass:agreement` exigem `--autoria-a` e `--autoria-b` (`pessoa`, sem nome, ou `modelo:<identificador>`);
  - recusam as duas declaradas como modelo;
  - gravam a autoria em `inputs` de `concordancia.json` (`authorship` em `rubric-core.ts`).
- **LEIA-ME:**
  - o texto gerado pelo pacote não fala mais em "duas pessoas" nem em iniciais;
  - manda guardar a planilha fora do diretório do pacote;
  - proíbe ver a outra planilha ou notas sobre ela;
  - o `LEIA-ME.txt` do pacote de 23/10 foi atualizado para o mesmo texto (ele não entra no `manifest.json`).
- **Documentação:**
  - no livro de códigos: cabeçalho, seção 3, seções 5 e 6 (leitura integral obrigatória e autoria declarada) e ordem da seção 9;
  - no plano da bússola: trechos ainda com a regra antiga;
  - no `docs/rubrica-propostas.md` e no `AGENTS.md`: as novas opções da concordância.

Verificação:
- `npm run typecheck -w @observatorio/importer` sem erros;
- `npm test -w @observatorio/importer`: 51 testes (50 antes), todos passando, com o novo teste da autoria;
- a planilha nova passa pela `validateCompass` contra o texto publicado no banco: 288 linhas, nenhum problema;
- `compass:agreement`, rodado com uma cópia do manifesto fora do pacote:
  - recusa sem autoria e com as duas de modelo;
  - com `--autoria-a=modelo:claude-opus-5-5 --autoria-b=pessoa`, grava `author` nas duas entradas;
  - o resultado do teste foi apagado.

Atenção para a codificação B:
- a pessoa deve receber só o diretório do pacote e o livro de códigos;
- o histórico do Git (mensagem e diff do commit `9c493d9`) ainda traz a contagem e as lacunas da A; reescrever o histórico exige decisão de Rafael.

Pendente:
- codificação B por uma pessoa e quem adjudica;
- depois, `compass:agreement` com `--autoria-a=modelo:claude-opus-5-5 --autoria-b=pessoa`, adjudicação e publicação;
- ao fim da B, as lacunas das notas entram no livro de códigos numa nova versão.

Commitado em 24/10/2026 ("Corrige a revisão da codificação A da bússola e refaz a leitura").

## 56. README como apresentação do projeto e manual de operação separado — 24/10/2026

Rafael pediu que o README falasse do projeto, e não de planejamento. Feito:
- `README.md` passa a ter apresentação, princípios, funcionalidades, fontes, situação, execução mínima, estrutura e mapa da documentação, sem citar seções deste arquivo;
- o manual de operação (configuração, Docker, importações e versões, validação e publicação, piloto de SP, rubrica e bússola, smokes, verificações `check:*`, esquema do banco e migração antiga) foi movido sem cortes para `docs/operacao.md`;
- o histórico de verificações e as pendências saíram do README; já estavam no "Estado atual" e nas "Pendências vigentes" deste arquivo;
- `AGENTS.md` e as duas referências vigentes deste arquivo apontam agora para `docs/operacao.md`.

Verificação: links locais do README e de `docs/operacao.md` conferidos; comparação linha a linha com o README anterior, sem perda além do que saiu de propósito. Rafael leu e aprovou o texto.

Commitado em 24/10/2026, sem push.

## 57. Revisão da rubrica da D3: autoria por modelo, leitura integral e limitação declarada — 24/10/2026

Rafael revisou com o Claude o livro de códigos da rubrica (`docs/rubrica-propostas.md`), seção por seção, e decidiu:
1. **Autoria:** uma das duas codificações pode ser feita por modelo de linguagem, declarada como tal; a outra é sempre de uma pessoa, e a adjudicação é humana. Até então, o plano de melhorias falava em "duas pessoas". O código já aceitava `modelo:<id>` (`authorship`, §55) e não mudou.
2. **Leitura integral:** cada codificação lê os documentos inteiros, como na bússola. O passo 3 do `LEIA-ME.txt` gerado (`readingHint` em `rubric.ts` e `compass.ts`) passa a exigir isso, e os `LEIA-ME.txt` dos dois pacotes existentes foram atualizados para o mesmo texto (nenhum dos dois entra no `manifest.json`).
3. **Limitação declarada:** os critérios descrevem o documento, não cada medida. Meta, prazo, custo e outros atributos podem vir de medidas diferentes; a regra não muda, e a publicação repete a limitação.

Os ajustes vieram antes de qualquer codificação e não mudam tema, critérios, valores nem termos: a versão continua `rubrica-acessibilidade-mobilidade-v1`, e o pacote de 21/10 continua válido. Atualizados: livro de códigos da rubrica (seções 1, 2, 3, 5, 6, 7, 8 e 9), seções D3 e 20 e quadro de decisões do plano de melhorias, `AGENTS.md`, `docs/operacao.md` e o "Estado atual" deste arquivo.

Ficou registrado como pendência nova (item 5 da seção 9 do livro): se expressões genéricas como "nas cidades" contam como território declarado. A proposta é que não contem.

**Concordância mínima** (decidida a seguir, por recomendação aceita por Rafael), fixada antes de qualquer codificação, na seção 7 do livro:
- por critério, AC1 de Gwet, com intervalo de 95% por reamostragem dos documentos, ao lado do kappa e das contagens;
- critério com AC1 ≥ 0,70 é publicado; abaixo disso, volta para uma nova versão;
- os números são publicados sempre;
- motivo: com 12 documentos e muitos `nao-localizado`, o kappa pode ficar perto de zero mesmo com quase tudo concordando.

Somam-se:
- exemplos fictícios por critério, na seção 3, para reduzir ambiguidade;
- consistência da codificação por modelo: ele codifica duas vezes; a A1 entra na concordância e a A2 só mede.

**Código:**
- `rubric-core.ts`:
  - `gwetAC1`, `criterionReliability`, `MIN_CRITERION_AC1` e `RELIABILITY_RESAMPLES`;
  - `random` e `quantile` saíram do `compass-core.ts` e passaram a ser compartilhados;
  - `authorship` ganhou o modo de consistência;
- `rubric.ts`:
  - o relatório da rubrica traz `reliability` e `purpose`;
  - `--consistencia` exige o mesmo modelo nas duas codificações, recusa `--adjudicacao` e grava o resultado ao lado da planilha A1, fora do pacote, para não expor a A antes de a outra codificação terminar.

Verificação:
- typecheck sem erros;
- 54 testes do importador passando (3 novos, entre eles o caso do paradoxo do kappa); os testes da bússola continuam passando com o gerador compartilhado;
- `rubric:agreement` rodado do início ao fim com planilhas fictícias válidas e uma cópia do manifesto no rascunho (concordância normal, consistência e recusa de `--adjudicacao` no modo de consistência); tudo apagado depois.

**Quem adjudica** (a seguir, nos dois livros de códigos, seção 6): Rafael perguntou se codificar sem modelo contraria a regra. Não contraria: o modelo é opcional, e o que se exige são duas codificações independentes, ao menos uma de pessoa, e adjudicação humana. A regra nova trata de quem adjudica tendo codificado: de preferência alguém que não codificou; se não, isso é declarado na publicação e cada decisão cita páginas, trecho e regra do livro. Modelo nunca adjudica. Ressalva para a bússola, registrada só aqui (o livro vai para quem faz a B e não deve apontar onde estão os valores da A): o histórico do commit `9c493d9` mostra valores e decisões da A, então quem já o leu não faz a B sem declarar essa exposição.

Pendente:
- quem faz cada codificação e quem adjudica;
- aprovação da versão;
- território genérico (item 5 da seção 9), a decidir antes da codificação;
- publicação e canal de contestação.

Commitado em 24/10/2026, sem push.
