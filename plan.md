# Contexto do projeto — Observatório eleitoral brasileiro

Consolidado em 12/10/2026 para continuidade no Codex local. Nome provisório. Este documento registra decisões e propostas; não certifica conjuntos de dados ainda não auditados.

## 1. Finalidade e intenção do autor

O autor deseja criar um dashboard de acesso público e gratuito para explorar os resultados eleitorais brasileiros junto ao contexto demográfico e socioeconômico dos territórios.

A inspiração é o livro O Cérebro Político, aparentemente The Political Brain, de Drew Westen. A referência inspira o interesse pelo comportamento político; suas conclusões não serão presumidas válidas para o Brasil. O MVP não fará inferências psicológicas.

O projeto começa pequeno com dados oficiais do TSE e IBGE. Não deve partir de uma tese política a confirmar nem exigir um conjunto extenso de perguntas de pesquisa antes da obtenção dos dados. O público poderá formular questionamentos a partir da exploração.

## 2. Princípios acordados

- Independência partidária e mesmos recursos, filtros e fórmulas para todas as candidaturas e partidos.
- Não produzir conclusões editoriais automáticas ou orientar o visitante para uma interpretação política.
- Mostrar distribuições e valores; não classificar pessoas ou lugares automaticamente como de direita, de esquerda, apolíticos, ricos ou pobres.
- Abstenção, brancos e nulos não identificam motivação nem condição apolítica.
- Fontes, definição de variável, ano de referência, cobertura e denominador sempre consultáveis.
- Ausência absoluta de viés não pode ser garantida: escolhas metodológicas devem ser explícitas, testadas e revisáveis.
- Diferentes perspectivas devem ter critérios consistentes; explicações não recebem o mesmo peso quando a evidência difere.
- Não prometer ineditismo: já existem produtos brasileiros com mapas eleitorais e indicadores socioeconômicos.

## 3. Escopo inicial e apresentação

Primeira entrega: tabela didática por município, com filtros de eleição, turno, cargo e território; permitir abrir o detalhe dos locais de votação. Priorizar leitura simples e acessibilidade, inclusive no celular. Mapas e gráficos ficam para evolução; evitar visualizações densas ou difíceis de interpretar.

Exibir votos absolutos e percentuais de todas as candidaturas, aptos, comparecimento, abstenção, brancos e nulos. A diferença entre candidaturas pode ser mostrada em pontos percentuais, com definição explícita do par comparado.

Apresentar os indicadores do IBGE na escala realmente disponível. A distribuição em faixas de renda só entra onde os arquivos e dicionários confirmarem essa informação; não fabricar distribuição a partir de médias.

Liderança não é maioria absoluta: 40% dos votos válidos pode ser o maior percentual sem ultrapassar 50%. Agregações regionais usam soma dos votos e denominadores correspondentes, não média simples dos percentuais municipais.

Preservar a granularidade das seções na base e agregá-las por local de votação para explorar o contexto do entorno. Município é o ponto inicial mais simples de cruzamento entre fontes.

## 4. Anos e cargos

O usuário quer aproveitar 2022 e 2026. Resultados por zona e seção já existiam em 2022; não são uma novidade exclusiva de 2026. A cobertura e qualidade das localizações de cada ano precisam ser auditadas.

Começar pela eleição presidencial, mantendo os turnos separados; modelar os cargos para expansão futura a governador, senador, deputados etc. Regras de denominador variam por cargo — atenção especial ao Senado em anos com duas escolhas por eleitor.

Não presumir que resultados de 2026 ou localizações estejam completos só porque o catálogo os apresenta. Verificar arquivos, geração, cobertura e situação de totalização. Não inventar resultados de turnos ainda não realizados. Comparações só são publicadas depois da validação de cada conjunto.

Um exemplo mencionado pelo usuário sobre Rio de Janeiro, Niterói e interior não foi validado nesta conversa e não deve ser tratado como conclusão.

## 5. Associação geográfica

- Seção é um agrupamento eleitoral; local de votação é o prédio; zona é uma unidade administrativa. Não equivalem automaticamente a bairro ou setor censitário.
- O endereço do local mostra onde o eleitor vota, não onde mora.
- O entorno socioeconômico será uma aproximação do contexto territorial. Não atribuir sua renda aos eleitores inscritos.
- Definir e versionar o método: setor que contém o local, setores próximos ou área delimitada por distância. Nenhuma distância foi decidida.
- Testar sensibilidade a diferentes delimitações e informar casos sem associação confiável.
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

O levantamento encontrou divulgação do IBGE de rendimento do responsável por setor censitário. Isso não comprova disponibilidade de renda domiciliar total ou per capita na mesma escala. Confirmar dicionários antes de implementar camadas. Se só houver média/mediana, rotular exatamente a medida; não afirmar proporções por faixa.

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

## 8. Direção técnica acordada

Stack: TypeScript e Node.js; NextJS no frontend, NestJS no backend, PostgreSQL. Prisma é compatível com a experiência do usuário; seu uso e versão ainda precisam ser definidos. Docker Compose para ambiente local; Docker e Traefik são familiares ao usuário para hospedagem futura.

Proposta de monorepo:

- apps/web: NextJS, tabela e páginas de fontes/metodologia.
- apps/api: NestJS, API de consulta com paginação e ordenação.
- apps/importer: proposta de importador TypeScript executado separadamente.
- packages/: contratos compartilhados apenas quando necessários.
- docs/: contexto, fontes e decisões.

Importações fora das requisições do visitante. Preservar originais e metadados; carregar em área de preparação, validar e publicar versão consistente. Usar importação em lote e SQL quando apropriado, evitando inserir milhões de registros individualmente pelo ORM. PostgreSQL/PostGIS é uma opção para a etapa espacial, não uma decisão já fechada.

Persistir agregados por município e local para consultas econômicas. Backend modular único; sem microserviços, Redis ou filas no início sem necessidade demonstrada. Nunca enviar a base nacional inteira ao navegador. Dimensionar hospedagem só após medir volume e carga.

Gerenciador de pacotes, versões, município/UF piloto, licença, nome definitivo, hospedagem e fonte exata de cada variável ainda não foram decididos. Linux é habitual ao usuário, mas o ambiente local atual precisa ser inspecionado.

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

## 11. Próxima tarefa para o Codex local

Leia este arquivo e instruções existentes (AGENTS.md e outras aplicáveis). Inspecione ambiente e repositório sem sobrescrever trabalho existente. Inicialize uma estrutura executável com NextJS, NestJS, TypeScript e PostgreSQL via Docker Compose, documentando como iniciar. Escolha versões compatíveis consultando documentação oficial atual e registre a escolha.

Primeiro marco: frontend acessível, API com verificação de saúde e conexão com banco, configuração por ambiente e estado vazio claro na tabela. Não criar números eleitorais para aparentar um produto pronto.

Segundo marco: auditar e importar um recorte pequeno real do TSE, reconciliar totais e expor tabela paginada. Definir recorte piloto com Rafael antes de uma carga extensa. Depois integrar IBGE no nível municipal e detalhar locais onde a correspondência foi validada.

Não expandir automaticamente para IA, modelos psicológicos, classificação ideológica, alertas de fraude ou múltiplas fontes adicionais. Não publicar nem contratar serviços sem instrução. Manter este contexto e decisões atualizados conforme a implementação evoluir.

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

### Decisões pendentes para a próxima sessão

1. Suplementar de Governador de RR (eleição 6278, 21/06/2026, presente nos arquivos marcados como 2022): como tratá-la (proposta: recorte próprio "suplementar 2026", sem somar nem comparar com a ordinária de 2022); como apresentar os 160.004 votos "Anulado sub judice", maiores que os válidos (102.845), deixando explícita a provisoriedade da classificação; conferir situação da totalização e eventual 2º turno antes de importar.
2. Senador 2022 (uma vaga por UF; 2026 terá duas): auditoria e regras. → Concluído no §20.
3. Página de UF longa (25 municípios com quadros por página): rever apresentação.
4. Incorporar ao repositório as verificações de acessibilidade (exigiria `puppeteer-core`, `axe-core` e `pngjs` como dependências de desenvolvimento) e testar com leitor de tela real e outros navegadores.

## 20. Senador 2022 nas 27 UFs e mudança de escopo — 17/10/2026

Rafael pediu o Senado diretamente nas 27 UFs, sem piloto. Durante a carga, decidiu **retirar os deputados (federais, estaduais e distritais) do escopo por enquanto**, unicamente para reservar armazenamento à integração do IBGE e ao cruzamento IBGE–TSE, que é o propósito inicial do projeto (§1, §3) e também aumentará o volume de dados. Estimativa que embasou a decisão: em AC e PE, as linhas de seção de Deputado Federal e Estadual somam 13 a 14 vezes as do Senado, ou seja, cerca de 50 milhões de registros em 2022 e uns 20 GB no PostgreSQL, levando o projeto local a 55–60 GB. Os ZIPs por UF já baixados preservam os cargos 6, 7 e 8; nada foi descartado. A interface e o catálogo passam a indicar deputados como fora do escopo atual, não como próxima etapa. Próxima prioridade após o Senado: dados do IBGE e sua correspondência validada com o TSE. Retomar os deputados exige nova decisão de Rafael, considerando o armazenamento já ocupado pelo IBGE, e auditoria própria (legenda, proporcional, cadeiras).

Senado — auditoria prévia dos originais (27 UFs, leitura independente): cargo 5 só na eleição 546, turno 1; sem trânsito, legenda, apuração em separado, duplicatas, outra UF ou suplementar (em RR, a suplementar de 2026 é só de Governador). Seções, apuração e nominal coincidem em todas as UFs. Há anulados, sub judice e nulos técnicos em 18 UFs (RJ: 1.573.388 nulos técnicos; PB: 431.857 anulados), todos dentro da regra decidida para o Governador v2 — por isso nenhuma decisão nova foi necessária. Em AP e MS, "Anulado" convive com registro "deferido"; exibido como na fonte, sem interpretação.

Implementação: `SENATOR_2022` (cargo 5, eleição 546, turnos `['1']`, `electionCodes` parcial); `senator` em `OFFICES`/`STATE_OFFICES` e novo `SINGLE_ROUND_OFFICES` nos contratos; `import:state -- --office senator`, versão `senator-2022-state-v1`; turno da apuração fora do recorte do cargo bloqueia; o catálogo lista UFs pendentes de qualquer cargo estadual; a interface diz "eleito em turno único" no 2º turno do Senado. Nenhuma exclusão declarada.

Defeito encontrado e corrigido no código: `persistTerritory` descartava `nonValidVotes` de locais e zonas (Governador v2: totais certos, quadro de não válidos ausente nos locais; 0 de 1.179 locais de SE). Locais e zonas passam a ser gravados como o objeto validado, e a verificação persistida reconta os votos pelos locais (falha nos dados v2 de SE/PR, passa em AC). O importador do Governador foi para a `governor-2022-state-v3`; a v2 continua publicada e não foi reescrita. Rafael aprovou e a reimportação do Governador v3 foi concluída na mesma data (27 UFs, 4.404.307 registros, verificação pelos locais aprovada; v2 não publicada).

Resultado: 27 UFs publicadas, 5.570 municípios, 3.790.841 registros (igual à auditoria), nenhum bloqueio; cerca de 61 min somados, pico de 509 MiB; banco em 7,7 GB. Verificação: 659 conferências independentes originais × API sem divergência; 49 testes, tipos e build; `smoke:senator` (27 UFs, 132 requisições) e regressão de todos os smokes no build de produção. Achado à parte: em `npm run dev`, a rota de relatório da API serializa o `StreamableFile` como JSON e derruba `smoke:national`/`smoke:exterior`; no build de produção funciona. Defeito anterior, ainda não corrigido. Detalhes em `docs/senador-2022.md`.

Também nesta data: `AGENTS.md` passou a ser o único arquivo de orientações (o `CLAUDE.md` só o importa), com uma seção sobre o revezamento entre Codex e Claude Code.

### Decisões pendentes (atualizado em 17/10/2026)

2. Suplementar de Governador de RR (2026), como no item 1 da lista do §19.
3. IBGE: etapa municipal publicada em 17/10/2026 (contexto Censo 2022 + perfis do TSE como base própria, 5.570 municípios) e protótipo de mapas (malhas do IBGE, `/mapa`). Detalhes, regras de soma e verificação em `docs/plano-ibge.md`. Fase 3 e métrica E concluídas na mesma data (§22).
4. Página de UF longa; verificações de acessibilidade no repositório; revisão em navegador das páginas do Senado.
5. Rota de relatório em modo dev (`tsx watch`).
6. Formulários e exibição: plano em `docs/plano-ux-formularios.md`. Decisões de Rafael registradas (componente próprio de sugestões, cargo em opções visíveis, manter "Consultar", ordem 1→2→3→5+6→4). Todas as fases implementadas em 17/10/2026, inclusive a busca com sugestões (`pg_trgm`, migration 005, rota `suggest`, combobox próprio). Pendentes: leitor de tela real (condição para declarar a busca acessível), Chrome/Safari e o enriquecimento da busca com distritos do IBGE.

## 21. IBGE (Censo 2022) no nível municipal e mapas — 17/10/2026

Rafael aprovou o plano de `docs/plano-ibge.md`: etapa municipal primeiro, PostGIS na fase de setores, sem microdados de acesso controlado, perfil por seção como marginais por local e métrica E por escolaridade e renda do entorno do local de votação. A auditoria mostrou que os perfis do TSE (cadastro e comparecimento) não fecham com os resultados por município e que o comparecimento por perfil de 2022 não traz o DF; Rafael decidiu publicá-los como base própria, declarada, com a diferença exibida.

Publicados o contexto municipal (`municipal-context-2022-v1`: Censo 2022 via SIDRA ligado aos 5.570 municípios do TSE pela correspondência oficial de códigos; perfil do eleitorado e comparecimento por perfil do TSE) e as malhas do IBGE para mapas (`maps-ibge-2022-v2`). Na página do município, o painel "Território e eleitorado" separa universo, amostra e cadastro; em `/mapa`, dois coropléticos lado a lado (indicador do Censo e abstenção), com quintis, tabela equivalente e avisos de leitura (sem causa, sem voto de grupos, viés de área). Detalhes e números em `docs/plano-ibge.md`. Banco: +38 MB; disco: +0,8 GB. Sem publicação externa.

## 22. Análise de hospedagem inicial — 17/10/2026

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

Pendente/possível: estado civil (já no perfil por local e no comparecimento, não exibido); cruzamento por município na participação (hoje só marginais municipais no contexto); leitor de tela real, Chrome/Safari; sensibilidade da associação local → setor.


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

Rafael autorizou commit e push após confirmar ausência de pendências bloqueantes desta entrega. Conferidos `git status`, histórico e diff final; `git fetch upstream` concluído, `main` sincronizada com `upstream/main` antes da consolidação, sem alteração remota a integrar. Este registro acompanha o commit que reúne as correções, testes, scripts e documentação dos §§26–28.

Mantidas as verificações já aprovadas no mesmo código: 86 testes, typecheck/build, nove smokes, 31 regressões HTTP, 60 avaliações automáticas em Chrome/Firefox, auditorias integrais e nove reexecuções idempotentes; somente documentação de encerramento alterada desde então. `git diff --check` aprovado. Confirmado que `.env`, originais, banco, backup e evidências locais em `data/` estão ignorados e não integram o envio. Nenhuma importação ou serviço temporário reiniciado; somente PostgreSQL permanece ativo.

Escopo de envio: branch `main`, remoto `upstream`, sem reescrever histórico. Permanecem fora desta entrega as pendências manuais/de operação registradas no §28; hospedagem continua por último. Nenhuma implantação ou contratação externa.
