# Observatório eleitoral brasileiro

Dashboard público, gratuito e sem fins lucrativos para explorar eleições e contexto territorial com dados oficiais. O [planejamento](plan.md) registra finalidade, princípios, decisões e o histórico de implementação.

## O que está disponível

Eleições de 2022, com turnos sempre separados. Presidência:

- **Todo o Brasil**: consolidado presidencial por turno, somando os 5.570 municípios das 27 UFs e as 181 localidades eleitorais do exterior. O exterior só entra com publicação completa e os mesmos originais/checksums da publicação doméstica; as duas versões ficam identificadas.
- **Municípios**: listagem paginada por UF ou nome, com participação e votos de todas as candidaturas.
- **Locais de votação**: busca por zona, seção, código, nome ou endereço; cada local mostra suas seções.
- **Exterior (`ZZ`)**: consulta própria por localidade eleitoral.
- **Transparência** (`/fontes`): versões publicadas, cobertura por UF, relatórios de auditoria e download dos originais preservados com SHA-256.

Governador, nas **27 UFs**: resultado da UF somado dos municípios reconciliados, municípios e locais de votação; 2º turno nas 12 UFs onde ocorreu, e “turno não realizado” nas demais. Votos anulados, anulados sub judice e nulos técnicos aparecem por categoria e com identificação da candidatura, fora do denominador dos válidos. Cargo estadual: a consulta exige UF, sem consolidado Brasil nem exterior. Ao escolher uma UF, a página inicial mostra também o resultado da UF para a Presidência.

Senador, nas **27 UFs**: mesma apresentação do Governador (UF, municípios e locais, com as categorias não válidas identificadas), em turno único — a consulta do 2º turno informa que o cargo não tem 2º turno. Em 2022 cada UF elegeu uma vaga, com um voto por eleitor.

A suplementar de governador de RR (2026), 2026 e dados do IBGE ainda não foram importados. Deputados estão fora do escopo atual. Não há inferências sobre renda, motivação individual ou migração de votos.

## Iniciar localmente

Requisitos: Node.js 24.21.0 (veja `.nvmrc`), npm 11 ou superior (desenvolvido com npm 12.2.0), Docker, Docker Compose e `unzip` para o importador.

```sh
cp .env.example .env
npm ci
npm run db:up
npm run dev
```

Abra <http://localhost:3000>. A API fica em <http://127.0.0.1:3001>. Sem importação, a interface mostra o estado vazio — nunca números de exemplo.

Os comandos npm carregam o `.env` da raiz; variáveis já definidas no ambiente têm precedência. Se alterar `POSTGRES_PORT`, usuário, senha ou banco, ajuste também `DATABASE_URL`. Credenciais do exemplo são apenas locais, e mudar usuário/senha não altera um banco já inicializado no volume.

`Ctrl+C` encerra os servidores de desenvolvimento; `npm run db:stop` para o banco preservando o volume. Para executar os builds sem modo de desenvolvimento: `npm run build` e, em terminais separados, `npm run start -w @observatorio/api` e `npm run start -w @observatorio/web`.

### Tudo em Docker

```sh
cp .env.example .env
npm run compose:up    # equivale a: docker compose --profile app up --build -d --wait
docker compose --profile app logs -f
docker compose --profile app stop
```

O perfil `app` constrói web, API e PostgreSQL com verificações de saúde e portas vinculadas apenas à máquina local. A API recebe `data/originals` e `data/audit` como volumes somente leitura. O ambiente é local; não há publicação, domínio ou serviço contratado.

## Importar os dados

Com o banco em execução:

```sh
npm run import:national                              # municípios das 27 UFs
npm run verify:national -w @observatorio/importer    # reconfere a persistência
npm run import:exterior                              # exterior (ZZ)
npm run import:state -- --office governor --uf SP    # Governador, uma UF por vez
npm run import:state -- --office senator --uf SP     # Senador, uma UF por vez
```

`import:state` usa as entradas da UF nos mesmos ZIPs de apuração e votação nominal e baixa o ZIP de seções da UF (2,86 GiB nas 27 UFs; SP: 859 MiB, com todos os cargos estaduais; só o cargo pedido é selecionado). A verificação da persistência roda dentro do importador, antes da publicação. Para todas as UFs: `for uf in AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO; do npm run import:state -- --office governor --uf $uf; done` (cerca de 75 min na primeira execução; troque `governor` por `senator` para o Senado).

Na primeira execução, o importador baixa três ZIPs oficiais do TSE (cerca de 816 MiB) e lê o arquivo nacional de seções em fluxo; a preparação inicial pode levar bastante tempo. Espere alguns GiB em `data/` e cerca de 3 GiB no PostgreSQL.

Como funciona:

1. **Originais**: ficam em `data/raw/tse/2022` e são preservados em `data/originals/<sha256>/<arquivo>`, somente leitura e com integridade conferida a cada uso. Arquivos existentes não são atualizados automaticamente.
2. **Preparação**: as seções são particionadas em NDJSON por UF/município em `data/staging`. Um manifesto só é gravado após ler todas as fontes e verificar os CRCs; uma interrupção nessa fase exige refazer a leitura, e partições incompletas (`.partial-*`) nunca são publicadas.
3. **Reconciliação e carga**: cada município é conferido por zona e turno (candidaturas, válidos, brancos, nulos, participação e seções) e gravado, com seu checkpoint, numa única transação. A carga retoma por município após interrupção.
4. **Publicação**: a troca da versão pública é atômica e só ocorre quando todos os municípios do recorte reconciliaram. Divergências de votos ou chaves, duplicatas e categorias de voto não auditadas bloqueiam a publicação.

Reexecutar com os mesmos originais e versão do importador não duplica registros. Mudanças de fonte ou de regra exigem nova versão e validação própria. Não apague `data/` nem o volume PostgreSQL sem backup.

O relatório de cada versão fica em `data/audit/<dataset-id>.json` (cobertura por município, conflitos e limitações) e também é servido pela transparência. Resultados, decisões e limites de cada carga:

- [Importação nacional](docs/importacao-nacional-2022.md): versão `president-2022-national-v2`, normalização dos códigos TSE com cinco dígitos, tentativa v1 rejeitada, seções não instaladas e métricas.
- [Exterior](docs/exterior-2022.md): versão `president-2022-exterior-v1`, zona única do exterior e os eleitores de seções não instaladas (657 no consolidado Brasil, por turno).
- [Governador 2022](docs/governador-2022.md): versão `governor-2022-state-v2` publicada nas 27 UFs (os locais não trazem o quadro de não válidos; a v3, que corrige isso, está pronta e aguarda reimportação), eleições 546/547, votos anulados e nulos técnicos, exclusão declarada da suplementar de RR e conferência contra os originais.
- [Senador 2022](docs/senador-2022.md): versão `senator-2022-state-v1` nas 27 UFs, eleição 546 em turno único, categorias não válidas por UF e conferência contra os originais.

Seções não instaladas não são somadas à abstenção: aptos = comparecimento + abstenção + eleitores dessas seções. Nomes/endereços divergentes de um mesmo local ficam indisponíveis, com variantes preservadas e aviso no painel. Aptos e abstenção por local permanecem indisponíveis.

### Piloto São Paulo (opcional)

Primeira importação do projeto, restrita ao município de São Paulo. Não é necessária para a consulta nacional, que tem prioridade na API.

```sh
npm run import:pilot
npm run analyze -w @observatorio/importer
```

`analyze` reconfere as somas no banco e exporta `data/analysis/sao-paulo-2022.json`. Resultados e limites estão na [análise de São Paulo](docs/analise-sao-paulo-2022.md).

## Verificação

```sh
npm run typecheck
npm test
npm run build
```

Os testes unitários usam somente dados sintéticos e cobrem filtros, configuração, reconciliação, denominadores, duplicatas, divergências, isolamento territorial, partições e navegação. O painel usa apenas dados oficiais.

Os smoke tests exigem web, API e banco em execução. Endereços alternativos podem ser definidos com `SMOKE_API_URL` e `SMOKE_WEB_URL`.

| Comando | Exige | Verifica |
| --- | --- | --- |
| `npm run smoke` | serviços | Conexão real, estado vazio de 2026, rejeição de filtros, páginas e HTML semântico básico |
| `npm run smoke:pilot` | piloto SP ou nacional | Totais conhecidos de São Paulo nos dois turnos, locais, paginação e páginas com resultados |
| `npm run smoke:places` | piloto SP ou nacional | Busca de locais por zona/seção/código/texto, acentos, variantes, paginação e erros |
| `npm run smoke:national` | `import:national` | 27 UFs nos dois turnos, locais, transparência e SHA-256 dos originais servidos por HTTP |
| `npm run smoke:exterior` | `import:exterior` | Formulários (GET, erros por campo, turnos) e consulta do exterior |
| `npm run smoke:summary` | nacional + exterior | Consolidado Brasil contra todos os agregados domésticos e do exterior |
| `npm run smoke:governor` | `import:state` (SP, demais UFs opcionais) + nacional | Governador SP contra os totais dos originais; em todas as UFs publicadas: invariantes, turnos, categorias não válidas (também nos locais, v3), exclusão de RR, UF obrigatória e páginas |
| `npm run smoke:senator` | `import:state --office senator` (qualquer UF) + nacional | Em cada UF publicada: aptos, votos, válidos e municípios dos originais, invariantes, turno único, categorias não válidas, casos auditados, locais do Rio com nulos técnicos, separação do Governador e páginas |

```sh
curl http://127.0.0.1:3001/health/live
curl http://127.0.0.1:3001/health/ready
curl 'http://127.0.0.1:3001/elections/municipalities?year=2022&round=1&uf=SP&page=1&pageSize=25'
```

Smoke tests e testes HTTP não substituem revisão em navegador. A primeira revisão visual e de acessibilidade (Firefox headless, axe-core, contraste medido sobre gradientes, teclado e refluxo) está em [acessibilidade](docs/acessibilidade.md); leitor de tela real e outros navegadores continuam pendentes.

## Estrutura

```text
apps/api/            NestJS: saúde, banco e rotas públicas de consulta (docs/api.md)
apps/importer/       TypeScript: download, preparação, reconciliação, carga, verificação e análise
apps/web/            Next.js: consulta, locais, exterior, fontes e metodologia
packages/contracts/  Esquemas Zod e tipos compartilhados entre web, API e importador
scripts/             Inicialização conjunta (dev.mjs) e smoke tests
docs/                Decisões técnicas, contrato da API, auditorias e análises
plan.md              Contexto, princípios, decisões e histórico de implementação
AGENTS.md            Orientações para assistentes de código (Codex; CLAUDE.md o importa)
```

A conexão usa o driver `pg`; Prisma ainda não foi adotado. O esquema está em `apps/importer/src/schema.sql` e `apps/importer/src/migrations/`, aplicados pelos importadores. Versões e referências das escolhas técnicas: [decisões técnicas](docs/decisoes-tecnicas.md).

<details>
<summary>Banco criado antes da busca por seção (piloto antigo)</summary>

Novas importações já incluem o índice. Para um banco do piloto instalado antes dele, aplicar uma vez (não exige reimportação; ajuste usuário/banco se alterados):

```sh
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U observatorio -d observatorio < apps/importer/src/migrations/002-section-lookup.sql
```

</details>

## Pendências e próximos passos

- Deputados (federais, estaduais e distritais) ficam fora do escopo por enquanto (decisão de 17/10/2026): cerca de 50 milhões de registros de seção em 2022, ~20 GB no PostgreSQL; o armazenamento fica reservado aos dados do IBGE e ao cruzamento IBGE–TSE. Os originais já baixados preservam esses cargos.
- Senador 2026 (duas vagas, dois votos por eleitor): regra de denominador própria. Suplementar de governador de RR (2026), em etapa própria.
- Depois: integração IBGE/TSE no nível municipal e etapa espacial.
- Interface: autocomplete; teste com leitor de tela real e em Chrome/Safari/dispositivos móveis (revisão automatizada em Firefox feita: [acessibilidade](docs/acessibilidade.md)); página de UF longa (25 municípios com quadros por página).
- Resultados de 2026 não foram importados.
- Licença, nome definitivo e hospedagem não foram decididos. Não foi copiado código do repositório de referência.
