# Correções, pesquisa e verificação — 18/10/2026

Registro da revisão anterior às cargas. A execução posterior, incluindo o contexto v3 e a correção do contador de seleção, está em [Reimportações de 18–19/10](reimportacoes-2026-10-18.md). As versões futuras e o estado das publicações abaixo descrevem o encerramento daquela etapa.

Atendimento à revisão local do §26 e às instruções seguintes de Rafael: confirmar e corrigir os quatro defeitos; conferir omissões/inconsistências do Censo; incorporar testes e seus efeitos colaterais; revisar o versionamento das dependências; pesquisar e adequar a listagem longa de municípios. Hospedagem fica por último. Nenhum novo recorte, carga extensa ou implantação faz parte desta etapa.

## Confirmações e correções

- **Ano:** antes da alteração, as respostas de grupos e mapas por candidatura para 2026 eram idênticas, por hash, às de 2022 na Presidência. A seleção de publicação agora confere ano e cargo, inclusive nos cargos estaduais. Ausência de publicação não libera resultados de outro ano. Regressões cobrem os dois turnos, UF, renda por raio, mapas e consumidores anteriores.
- **GeoPackage:** a lista de formatos e os tipos MIME são compartilhados por API e proxy. `.gpkg` usa o tipo registrado pela [IANA](https://www.iana.org/assignments/media-types/application/geopackage+sqlite3). Registro, tamanho e SHA-256 continuam obrigatórios. O cache de integridade inclui `ctime`, além de tamanho e `mtime`, e a desconexão do visitante cancela leitura/fluxo.
- **Relatórios:** resposta nativa em fluxo substitui a dependência da identidade de `StreamableFile` entre os carregadores do Nest/tsx. A regressão verifica bytes, conteúdo e cabeçalhos reais; não basta obter status 200. Um cancelamento normal não é registrado como erro de aplicação.
- **Falha técnica visível:** a página municipal informa quando não conseguiu consultar ou validar o contexto; não o esconde silenciosamente nem apresenta o problema como ausência na fonte. Distribuições incoerentes são recusadas no contrato e não viram uma diferença inferida pela interface.

## Censo: diferença confirmada, causa não presumida

`npm run check:data` lê os originais imutáveis pelas referências de checksum da publicação. Nas 27 respostas preservadas da SIDRA 9605, conferiu categoria por categoria dos 5.570 municípios: mesma contagem no original e no banco, sem células duplicadas nem categorias extras ignoradas. Há 1.277 municípios em que o total supera as cinco categorias. A maior diferença é em Abreu e Lima/PE: total 98.462, categorias 96.959, diferença 1.503.

Uma consulta somente de leitura à [SIDRA atual, Abreu e Lima](https://apisidra.ibge.gov.br/values/t/9605/n6/2600054/v/93/p/2022/c86/all) confirmou as mesmas seis células. Não foi substituído o original preservado. Essa conferência demonstra que a diferença não nasceu na conversão ou renderização local; **não determina sua causa**. Não a chamamos automaticamente de supressão, falta de resposta ou erro do IBGE.

A conferência foi ampliada às **163 respostas preservadas da SIDRA**: idade, cor ou raça, alfabetização, instrução, classes de renda, renda média/mediana e totais populacionais por UF. Os valores publicados coincidiram com as células originais. Linha obrigatória ausente agora bloqueia o importador, em vez de ser confundida com uma linha presente cujo valor é nulo na fonte.

| Estado | Comportamento |
| --- | --- |
| Categorias completas e soma exata | Contagens e percentuais sobre o total divulgado. |
| Diferença já conferida no original | Linha separada “Diferença não discriminada nas categorias da fonte”, com contagem, percentual e explicação de que a causa não foi informada. Não é redistribuída. |
| Arredondamento da amostra | Nota separada com a diferença assinada da soma, dentro do limite já auditado. Não altera contagens nem força soma de 100%. |
| Valor indisponível no arquivo | “Indisponível”; a interface não deduz o valor por diferença nem presume a razão da ausência. |
| Categoria nova, duplicada, soma incompatível ou metadado de diferença incorreto | Importação bloqueada; resposta inconsistente não é exibida como dado válido ou atribuída à fonte. |
| Denominador zero | Percentual indisponível, inclusive na linha total. |

O contrato confere somas e explicações de diferença em todas as distribuições municipais. O novo extrator SIDRA rejeita duplicatas antes de criar mapas e rejeita categorias inesperadas em vez de descartá-las. As regras precisam permanecer explícitas: uma diferença técnica não pode ser automaticamente aceita pelo modo de dados parciais.

## Dependências de dados e arquivos de auditoria

Novas identidades incluem versão, checksums, configuração pertinente e a lista ordenada de pares **escopo + ID** das publicações de entrada. A ordem de leitura não altera a identidade; trocar uma entrada altera. Antes da troca pública, o importador confere novamente os lotes e mantém bloqueio compartilhado dessas linhas até o término da transação. Mudança de entrada durante o trabalho impede a publicação.

O relatório completo é preparado por escrita temporária + renomeação antes de marcar o lote como publicado. Falha de disco impede a troca; um lote já publicado só é declarado idempotente depois de conferir a identidade de seu relatório. Um relatório preparado pode permanecer após rollback, mas o lote correspondente não se torna publicado por isso. Nenhum original é sobrescrito.

| Importador | Versão no código após a revisão | Entradas que passam a compor a identidade |
| --- | --- | --- |
| Contexto municipal | `municipal-context-2022-v2` | Presidência nacional + originais |
| Malhas | `maps-ibge-2022-v3` | Presidência nacional + originais |
| Locais → setores | `polling-place-tracts-2022-v3` | Presidência nacional + originais |
| Perfil por local | `place-profiles-2022-v2` | Contexto municipal, Presidência nacional + originais |
| Faixas de renda | `income-bands-2022-v2` | Contexto municipal + originais |
| Participação | `turnout-profiles-2022-v3` | Contexto municipal, Presidência nacional + original |
| Demografia por setor | `tract-demography-2022-v2` | Contexto municipal + originais |
| Grupos de locais | `place-groups-2022-v5` | Resultados de cada cargo/UF, perfil por local e associação aos setores |
| Sensibilidade | `tract-sensitivity-2022-v2` | Entradas anteriores + publicação dos grupos, originais e raios |

Essas são versões **para as próximas execuções**. As publicações existentes não foram reescritas ou substituídas. A API recusa dependências registradas que deixaram de estar publicadas, inclusive ao ler a sensibilidade e as populações comparadas. O campo `inputs` é opcional para permitir leitura do legado, mas ausência não significa uma lista vazia verificada.

No legado sem `inputs`, a auditoria conferiu numericamente os 11.140 comparadores do contexto e os 11.138 comparadores municipais da participação contra a Presidência atual. A ausência de proveniência registrada continua explícita no relatório do comando. Regeração futura deve seguir a ordem das dependências, sem atribuir IDs novos a dados antigos nem simular uma reimportação já concluída.

## Dependências de software

Revisados `npm ls`, `npm outdated` e `npm audit`. Não havia aviso conhecido de vulnerabilidade na consulta de 18/10. Existem patches mais novos para Next, React, Zod e tipos, mas esta entrega mantém as versões de execução já usadas; não mistura uma migração de framework/TypeScript com as correções de dados. O lockfile continua a fixar a instalação com `npm ci`.

As ferramentas acrescentadas são `puppeteer-core@25.14.0` e `axe-core@4.14.0`, com versões exatas. O Puppeteer Core não baixa um navegador na instalação; usa um binário local configurado. As ferramentas são dependências de desenvolvimento e não são importadas pela aplicação. Node permanece em 24.21.0 e npm em 12.2.0.

## Pesquisa e adequação da listagem municipal

Referências primárias consultadas:

- [ONS — Explore local statistics](https://www.ons.gov.uk/explore-local-statistics/): busca por território e exploração de indicadores por área; o detalhe tem contexto e caminhos próprios.
- [Elections New Zealand — resultados oficiais de 2023](https://www.electionresults.govt.nz/electionresults_2023/): separa o quadro nacional da consulta detalhada por circunscrição. A referência é de organização, sem importar suas regras eleitorais.
- [GOV.UK — tabelas](https://design-system.service.gov.uk/components/table/): comparação em linhas/colunas, cabeçalhos e legendas semânticas.
- [GOV.UK — paginação](https://design-system.service.gov.uk/components/pagination/): paginação explícita, mantendo navegação previsível por teclado; evita rolagem infinita.

Aplicação ao observatório: o consolidado Brasil/UF permanece separado e soma todos os municípios do recorte. A listagem passa a **uma linha por município**, com aptos, comparecimento, abstenção e válidos comparáveis. Todas as candidaturas, sem escolher uma liderança para representar o município, ficam em um `<details>` nativo por linha; ali continuam brancos/nulos, não válidos e avisos. O contexto e os locais conservam seu link próprio. Códigos com zero inicial, filtros e GET compartilhável são preservados.

A lista mantém a paginação do servidor, com controles acima e abaixo. A abertura do detalhe funciona sem JavaScript. Em larguras pequenas, a tabela tem rolagem própria; não encolhemos texto para acomodar dezenas de colunas, não carregamos a base inteira e não introduzimos virtualização que retire linhas do acesso por teclado. A API e a ordenação eleitoral não mudaram com essa apresentação.

## Matriz de testes e efeitos colaterais

Todos os números fictícios permanecem em fixtures de teste. Os casos de falha escrevem somente em diretórios temporários próprios e os removem ao concluir.

| Teste incorporado | Falhas/efeitos que verifica | Efeitos da execução |
| --- | --- | --- |
| Ano por HTTP (API) | Vazamento 2022 → 2026 em grupos, raio, UF e mapas; regressão das rotas antigas; nenhuma leitura de resultados de outro ano. | Servidor efêmero e banco simulado; somente requisições locais. |
| Contexto inconsistente (API) | Falha de soma deve resultar em indisponibilidade técnica, nunca resposta publicada ou ausência na fonte. | Fixture alterada e restaurada; nenhum banco real. |
| Leitura do contexto pela web | HTTP 500/503, JSON/contrato inválidos e conexão interrompida não viram ausência na fonte nem zeros; distingue publicação ausente e município não encontrado; preserva zero inicial. | `fetch` simulado e restaurado em processo isolado. |
| Relatório HTTP | Objeto interno com 200, bytes/cabeçalhos errados, arquivo ausente e ID desconhecido. | Relatório temporário; servidor efêmero; limpeza ao final. |
| Originais HTTP | GeoPackage e formatos anteriores; caminho/arquivo recusado; tamanho e hash corrompidos; mudança com mesmo tamanho/mtime. | Somente arquivos sintéticos temporários; inclusive corrupção e remoção desses arquivos. |
| Cancelamento de download | Interrupção não derruba servidor, não altera original e não impede próxima consulta. | Cancela conexão local de um arquivo temporário de 4 MiB. |
| Proxy web | Preserva binário e cabeçalhos; propaga cancelamento; distingue 404/503; não consulta caminho inválido. | `fetch` simulado e restaurado dentro do processo isolado do teste. |
| Distribuição no contrato/HTML | Diferença preservada, amostra, indisponibilidade, denominador zero, duplicata, metadado incoerente e ausência de explicação. | Renderização estática de fixtures, sem servidor ou dados públicos. |
| Extrator SIDRA | Duplicata não é escondida por `Map`; campo ausente bloqueia; valor omitido permanece nulo. | Função pura sobre fixtures. |
| Identidade de publicação | Troca de versão, fonte, configuração ou entrada altera o ID; reordenar entradas não; escopo duplicado bloqueia. | Funções puras. |
| Troca de dependências | Uma publicação substituída bloqueia importação e leitura; legado ausente não é inventado. | Cliente SQL simulado; nenhum `UPDATE` real. |
| Preparação do relatório | Escrita completa, identidade correta, temporários limpos; falha de disco/entrada impede troca pública. | Diretórios temporários e SQL simulado; teste confere que a falha não chega aos `UPDATE`s. |
| Listagem compacta | Todas as candidaturas, inclusive empate/zero, continuam acessíveis; zero inicial; campos antigos ausentes não viram zero. | HTML estático de fixture. |
| `check:data` | Originais versus banco, contratos, comparadores, relatórios e dependências. | Transação PostgreSQL `READ ONLY`, leitura e hash de 163 JSONs; sem escrita ou importação. |
| `check:publication` | SQL real do protocolo; falha de disco preserva a publicação anterior; nova publicação só aparece após preparo do relatório. | Tabela TEMP sombreia `import_batches` só na conexão do teste; `INSERT/UPDATE` apenas temporários, rollback obrigatório; IDs/flags públicos conferidos intactos. Arquivos em `/tmp` removidos. |
| `check:regressions` | Correções nas rotas reais, incluindo proxy e API em desenvolvimento. | Somente GET e leitura de relatório; checksum do GeoPackage custa uma leitura completa no servidor se não estiver em cache; download cancelado após início. |
| Controle positivo do axe | Evita aceitar falso “sem violações” por ferramenta não executada. | DOM sintético em `about:blank`, descartado com a aba. |
| Seis formulários com/sem scripts | Hidratação, GET real, parâmetros, zeros, filtros; detecta conteúdo presente no HTML mas invisível sem JS; controle positivo confirma não execução dos scripts da página. | Chrome: desativação por CDP. Firefox instalado: proxy local temporário aplica CSP `script-src 'none'`, pois o comando de emulação não é suportado; apenas as mensagens CSP esperadas são contabilizadas separadamente, demais erros falham o teste. Não altera a aplicação nem o perfil do usuário. |
| Axe/refluxo/capturas | Contraste automático, nomes/regiões/cabeçalhos, foco e rolagem fora da tabela em 1280/375/320 px. | Consultas GET e capturas locais; carga de CPU do axe/navegador. |
| Teclado/autocomplete/turnos | Opção selecionada preenche sem enviar; homônimos têm UF; Senado não oferece 2º turno; resumo de erro recebe foco. | Sugestões e navegação GET; sem alterações no cadastro. |
| Lista/paginação por navegador | Todas as candidaturas no detalhe, avisos, preservação de filtros e duas navegações. | Abre/fecha detalhes e consulta outras páginas. |
| Movimento, cores, estado de envio e CLS | Preferências emuladas, foco, `aria-busy`, conclusão e deslocamentos de layout durante consulta. | Preferências da aba e capturas; não muda configuração do sistema. |

`check:ui` não faz importação, não inicia serviços e não publica artefatos externamente. Capturas e relatórios ficam no diretório local informado. Os smokes existentes também só leem, mas `smoke:national` transfere originais inteiros e calcula seus hashes; isso gera I/O e tráfego local maiores. Evitar executar consultas pesadas e importações ao mesmo tempo para não transformar disputa por recursos em falsa regressão.

## Falha adicional descoberta pelo teste sem JavaScript

O `loading.tsx` raiz criava uma fronteira automática de Suspense: o HTML definitivo podia estar presente em um fragmento oculto, enquanto a troca da tela de carregamento dependia de JavaScript. O teste real com JS desativado capturou a página presa em “Consultando o painel”; as antigas buscas de texto no HTML não detectavam o problema.

Removida essa fronteira de carregamento. A navegação completa espera o HTML utilizável no servidor. A consulta aprimorada mantém `QueryForm`, região ocupada, feedback de envio e transições quando há JavaScript; sem ele, o GET nativo continua sendo um fluxo visível. O custo é não ter o antigo esqueleto instantâneo na carga inicial, coerente com o requisito de funcionamento sem JS.

## Resultados e limites

83 testes unitários, typecheck e build aprovados; nove smokes aprovados; 31 regressões HTTP; auditoria dos 163 originais SIDRA e teste SQL isolado do protocolo aprovados. Chrome 151.0.7922.71 e Firefox 158.0: 60 avaliações axe/refluxo (10 páginas × 3 larguras × 2 navegadores), envios dos seis formulários com/sem scripts, cenários funcionais e CLS 0 na troca medida no Chrome. O último ajuste da orientação municipal foi reconferido no Chrome a 320 px com axe sem violações. O smoke do resumo passou a conferir os links por código/UF e o detalhe da nova tabela, mantendo a comparação numérica de todos os municípios e turnos.

Referências das capturas e das rodadas por cenário estão no §27 de `plan.md`. A suíte não substitui leitura humana de contraste sobre todas as imagens, tecnologias assistivas reais ou dispositivos reais. Chrome/Firefox automatizados não equivalem a Safari; a emulação de cores/movimento não equivale a uma sessão de leitor de tela ou a todas as preferências do sistema. Não foi feita implantação nem contratação de hospedagem.
