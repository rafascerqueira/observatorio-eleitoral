# Observatório eleitoral brasileiro

Dashboard público, gratuito e sem fins lucrativos para explorar eleições e contexto territorial. O [planejamento](plan.md) registra o escopo e os princípios do projeto.

Consulta da Presidência de 2022, com turnos separados, participação municipal e locais paginados com busca por zona, seção, código, nome ou endereço. O piloto de São Paulo é preservado; a expansão nacional só é ativada depois de reconciliar todos os municípios do recorte. A página de transparência informa a cobertura efetivamente publicada, os originais preservados e seus checksums. Governador, senador, deputados e 2026 ainda não foram importados.

A página inicial mostra “Todo o Brasil”: um quadro presidencial consolidado por turno, com participação e votos por candidatura dos 5.570 municípios nas 27 UFs e das 181 localidades eleitorais do exterior, sem lista municipal ou paginação. A parcela exterior entra somente com publicação completa e os mesmos originais/checksums da publicação doméstica; as duas versões ficam identificadas. Selecione uma UF ou pesquise um município para consultar resultados municipais; selecione “Exterior — ZZ” para a consulta própria. `npm run smoke:summary` compara o consolidado dos dois turnos com todos os agregados domésticos e do exterior e verifica essa navegação.

## Iniciar localmente

Requisitos: Node.js 24.21.0 (veja `.nvmrc`), npm 11 ou superior, Docker, Docker Compose e `unzip` para o importador. O desenvolvimento usa npm workspaces; o lockfile fixa as dependências.

```sh
cp .env.example .env
npm ci
npm run db:up
npm run dev
```

Abra <http://localhost:3000>. A API fica em <http://127.0.0.1:3001>.

Os comandos npm das aplicações carregam o `.env` da raiz. Variáveis já definidas no ambiente têm precedência. Se alterar `POSTGRES_PORT`, usuário, senha ou banco, ajuste também `DATABASE_URL` para o desenvolvimento fora do Docker. Credenciais do exemplo são apenas locais. O PostgreSQL mantém os dados em um volume; mudar as variáveis de usuário/senha não altera um banco já inicializado.

`Ctrl+C` encerra os servidores de desenvolvimento. `npm run db:stop` para o banco preservando o volume.

## Importar e analisar o piloto

Com o banco em execução e `.env` configurado:

```sh
npm run import:pilot
npm run analyze -w @observatorio/importer
npm run smoke:pilot
npm run smoke:places
```

O importador baixa automaticamente três ZIPs oficiais quando ausentes (aproximadamente 816 MiB juntos). O TSE distribui as seções presidenciais no arquivo nacional; somente São Paulo é carregado no banco. A leitura é em fluxo, em Latin-1, e verifica a integridade ZIP. Os originais ficam em `data/raw/tse/2022`, a preparação em `data/staging` e o relatório em `data/audit/sao-paulo-2022.json`. A primeira leitura pode levar vários minutos.

Cada zona precisa reconciliar candidaturas, válidos, brancos, nulos, participação e quantidade de seções principais. A carga ocorre em lotes e é publicada em uma transação. Reexecuções com os mesmos checksums e versão conferem os originais e reutilizam a publicação, sem duplicar registros. Originais existentes não são atualizados automaticamente.

O esquema está versionado em `apps/importer/src/schema.sql` e é aplicado na transação inicial. Divergências nos votos ou nas chaves impedem publicação. Nomes/endereços divergentes de um mesmo identificador de local ficam indisponíveis, com variantes preservadas e aviso no painel. Aptos e abstenção por local permanecem indisponíveis.

`analyze` reconfere no banco as somas por votável, exporta `data/analysis/sao-paulo-2022.json` e registra os conflitos no relatório de auditoria. A [análise inicial](docs/analise-sao-paulo-2022.md) contém os resultados, denominadores e limites. Arquivos `data/` são locais e estão fora do Git.

## Executar tudo em Docker

```sh
cp .env.example .env
npm run compose:up
```

O perfil `app` constrói e inicia web, API e PostgreSQL, com verificações de saúde e portas vinculadas apenas à máquina local. Não exige Node/npm no host se você usar diretamente `docker compose --profile app up --build -d --wait`. O banco usa o volume no caminho `/var/lib/postgresql`, conforme a imagem oficial PostgreSQL 18.

```sh
docker compose --profile app logs -f
docker compose --profile app stop
```

O ambiente é local; não há publicação, domínio ou contratação de serviços.

## Importação nacional — Presidência 2022

```sh
npm run import:national
npm run verify:national -w @observatorio/importer
npm run smoke:national
```

Usa os mesmos três ZIPs do piloto, sem baixar as 27 fontes de outros cargos. Os originais exatos ficam em `data/originals/<sha256>/<arquivo>`, com permissão somente leitura e integridade conferida. A API recebe esses arquivos e os relatórios por volumes Docker somente leitura. A data de download recuperada de arquivos antigos é identificada como data de modificação local, não como comprovante HTTP; não se usa o `Last-Modified` da versão remota atual para descrever um original antigo.

As seções são particionadas em NDJSON por UF/município, com escrita em fluxo e descritores limitados. Um marcador completo é gravado após leitura de todas as fontes e verificação dos CRCs; uma interrupção **nessa preparação inicial** exige refazer a leitura. Partições incompletas ficam preservadas com nome `.partial-*` e nunca são publicadas. Depois da preparação, a carga retoma por município: votos, agregados e checkpoint são gravados na mesma transação. O município é a maior unidade de memória, não o Brasil inteiro; São Paulo e outras unidades grandes ainda exigem mais memória na reconciliação.

A versão nacional `president-2022-national-v2` normaliza a representação numérica dos códigos TSE para cinco dígitos. A v1 foi interrompida e não publicada porque códigos com/sem zero inicial criavam identidades falsas. A tentativa e seu motivo ficam na transparência. A v2 pode reutilizar a preparação completa da v1 quando hashes/entradas coincidirem, conferindo novamente apuração/nominal contra os ZIPs e cada partição contra seu checksum; não reutiliza os agregados incorretos da v1.

O relatório histórico da publicação doméstica registra o exterior (`ZZ`) como `excluded`, com originais e partições preservados; sua publicação própria, descrita abaixo, não altera esse histórico nem o inclui na lista de municípios brasileiros. Trânsito, votos de categorias não auditadas, duplicatas e divergências bloqueiam o recorte. Todos os municípios domésticos precisam estar reconciliados antes da troca atômica da publicação. A estrutura das novas tabelas inclui ano, eleição, turno, cargo e identidade territorial pertinente, sem colisões entre zonas de UFs/municípios diferentes.

Seções não instaladas domésticas são conferidas separadamente: aptos = comparecimento + abstenção + eleitores dessas seções; principais = seções com registros + não instaladas. Manaus registra uma seção e 84 eleitores nessa categoria em cada turno. Os valores oficiais não são alterados nem reclassificados como abstenção, e a consulta municipal mostra o aviso. Ausência dos novos campos em versões anteriores não é convertida automaticamente em zero.

O relatório nacional está em `data/audit/<dataset-id>.json`; inclui cobertura por município, registros, conflitos e limitações. `verify:national` reconfere a persistência real por município e votável/turno, registra volumes PostgreSQL e anexa o resultado ao relatório. `smoke:national` testa as 27 UFs nos dois turnos, locais, buscas, paginação, transparência e os bytes/checksums dos três originais entregues por HTTP.

Reexecutar `import:national` com os mesmos originais/versão não duplica a publicação. Arquivos já existentes não são atualizados automaticamente; mudanças de fonte/regras exigem versão nova e validação própria. Não apagar `data/` nem o volume PostgreSQL sem backup. A migração `003-national.sql` é idempotente e preserva o piloto.

A primeira publicação nacional reconciliou 5.570 municípios e preservou 5.368.073 registros domésticos. Os três originais servidos por HTTP tiveram seus SHA-256 conferidos. [Resultado e limitações da validação](docs/importacao-nacional-2022.md). A migração `004-national-section-lookup.sql` acrescenta o índice específico de busca por seção; é aplicada automaticamente pela importação nacional, inclusive na reexecução idempotente.

## Exterior — Presidência 2022

Após a preparação nacional completa, com banco em execução e API/web atualizados:

```sh
npm run import:exterior
node scripts/smoke-forms-exterior.mjs
npm run smoke:summary
```

A versão `president-2022-exterior-v1` reutiliza os três originais preservados e as partições completas de ZZ, verificando seus hashes, apuração, candidaturas e persistência. Publica 181 localidades, nos dois turnos, e 12.663 registros seção/votável em escopo separado. Reexecução idempotente reconfere os registros sem duplicação. O relatório fica em `data/audit/<dataset-id>.json`.

Exterior é a unidade `ZZ`; todas as suas localidades pertencem à zona eleitoral 1. País não é zona nem município brasileiro. Não há agrupamento por país sem correspondência oficial auditada. As 46 seções não instaladas e seus 573 eleitores por turno são preservados, incluindo localidades com totais oficiais zero, sem fabricar linhas de votos. Com Manaus, o consolidado Brasil registra 47 seções não instaladas e 657 eleitores nessa categoria. [Auditoria e limites](docs/exterior-2022.md).

Os formulários mantêm GET e URLs compartilháveis, preservam valores inválidos com erros por campo, separam busca principal de filtros avançados e oferecem turnos em opções visíveis. O feedback de consulta e as transições curtas respeitam movimento reduzido. Autocomplete, revisão visual e auditoria de teclado/leitor de tela em navegador permanecem pendentes.

## Verificação

```sh
npm run typecheck
npm test
npm run build
npm run smoke
npm run smoke:pilot
curl http://127.0.0.1:3001/health/live
curl http://127.0.0.1:3001/health/ready
curl 'http://127.0.0.1:3001/elections/municipalities?year=2022&round=1&uf=SP&page=1&pageSize=25'
```

Os testes verificam filtros, configuração, contagens ausentes, duplicatas, divergências de totalização e metadados, denominadores, indisponibilidade, buscas, preservação de filtros, isolamento territorial e integridade das partições. Dados sintéticos ficam exclusivamente em testes; o painel usa dados oficiais. A conexão real com PostgreSQL é verificada por `/health/ready`.

`npm run smoke` exige web, API e banco em execução. Verifica conexão real, contrato vazio, rejeição de filtros, páginas e elementos semânticos básicos no HTML. Não substitui uma auditoria completa de acessibilidade ou revisão visual em diferentes dispositivos. Endereços alternativos podem ser definidos com `SMOKE_API_URL` e `SMOKE_WEB_URL`.

`smoke:pilot` também exige a importação e verifica os dois turnos, totais conhecidos do piloto, busca com e sem acentos, paginação, 2026 sem publicação e páginas com resultados reais.

`smoke:places` verifica busca por zona/seção, código e texto, nomes variantes, acentos, paginação com filtros, buscas sem correspondência, páginas fora do intervalo e mensagens de erro. O formulário de locais usa GET, preserva filtros na URL e reinicia a página ao pesquisar ou trocar de turno. Cada local mostra suas seções; a busca por seção localiza o local e mantém seus totais agregados.

Para bancos instalados antes da busca por seção, aplicar o índice adicional uma vez (não exige reimportação):

```sh
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U observatorio -d observatorio < apps/importer/src/migrations/002-section-lookup.sql
```

O esquema de novas importações já inclui esse índice. Ajuste os nomes de usuário/banco no comando caso tenha alterado a configuração local.

Para executar os builds sem o modo de desenvolvimento, use `npm run start -w @observatorio/api` e `npm run start -w @observatorio/web` em terminais separados, após `npm run build`.

## Estrutura

```text
apps/api/            NestJS: saúde, banco e consultas eleitorais
apps/importer/       TypeScript: auditoria, carga em lote e análise descritiva
apps/web/            Next.js: consulta, fontes e metodologia
packages/contracts/  Validação e tipos compartilhados entre web e API
scripts/             Inicialização conjunta no desenvolvimento
docs/                Decisões técnicas e contrato da API
```

A conexão usa `pg`; Prisma ainda não foi adotado. Não há camadas espaciais ou associação TSE–IBGE nesta etapa.

## Próximo marco

Após a Presidência nacional: governador e senador por UF, com regras próprias de cargo e validação. Deputados terão apresentação resumida, preservando dados completos e distinguindo votos nominais e de legenda; o resumo não define eleitos ou distribuição de cadeiras sem auditoria específica. A integração IBGE/TSE e a etapa espacial ficam posteriores, conforme a prioridade acordada. Resultados de 2026 não foram importados. Não há inferências sobre renda, motivação individual ou migração de votos.

Licença, nome definitivo e hospedagem permanecem pendentes. Não foi copiado código do repositório de referência.
