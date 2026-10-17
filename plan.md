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
3. IBGE: próxima prioridade. Pesquisa e plano em `docs/plano-ibge.md` (17/10/2026): correspondência oficial TSE–IBGE auditada (5.570/5.570, 22 nomes divergentes), cor/raça do eleitorado 2022 100% não informada, renda per capita em classes de salário mínimo disponível por município (SIDRA 10296, amostra), coordenadas de locais ausentes em até 31% numa UF. Aguarda as decisões listadas no documento.
4. Página de UF longa; verificações de acessibilidade no repositório; revisão em navegador das páginas do Senado.
5. Rota de relatório em modo dev (`tsx watch`).
6. Formulários e exibição: plano em `docs/plano-ux-formularios.md`. Decisões de Rafael registradas (componente próprio de sugestões, cargo em opções visíveis, manter "Consultar", ordem 1→2→3→5+6→4). Todas as fases implementadas em 17/10/2026, inclusive a busca com sugestões (`pg_trgm`, migration 005, rota `suggest`, combobox próprio). Pendentes: leitor de tela real (condição para declarar a busca acessível), Chrome/Safari e o enriquecimento da busca com distritos do IBGE.
