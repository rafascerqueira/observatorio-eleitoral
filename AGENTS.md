# AGENTS.md

Orientações para trabalhar neste repositório, válidas para todos os assistentes de código (Codex lê este arquivo; o Claude Code o importa via `CLAUDE.md`). Este é o único arquivo de orientações: edite aqui, nunca em cópias. Responder em português (pt-BR).

## Revezamento entre agentes

Codex e Claude Code atuam no projeto em revezamento, nunca ao mesmo tempo. A continuidade depende só do que fica no repositório:

- Ao começar: ler `plan.md` (último registro e decisões pendentes) e `git log`/`git status` para ver o que o outro agente deixou.
- Ao encerrar: registro datado em `plan.md` com o que foi feito, verificado e pendente; nenhuma importação em andamento nem estado intermediário sem explicação; mudanças commitadas ou descritas no registro.

## Contexto e princípios

`plan.md` é a fonte de verdade sobre finalidade, princípios, decisões e histórico de implementação; leia-o antes de mudanças relevantes e acrescente um registro datado ao concluir cada marco. `docs/` detalha decisões técnicas (`decisoes-tecnicas.md`), contrato da API (`api.md`) e auditorias de cada importação.

Regras inegociáveis (detalhes em `plan.md` §2–6 e §9):

- Nunca inventar ou estimar números eleitorais/socioeconômicos para preencher a interface. Dados sintéticos só em testes.
- Nulo/ausente não vira zero; denominador zero gera `null`, não percentual. Campos novos opcionais não podem ser lidos como zero em versões antigas.
- Divergências (votos, chaves, duplicatas, tipo de voto não auditado) **bloqueiam a publicação**; não descartar nem "corrigir" silenciosamente.
- Agregar somando votos e denominadores, nunca pela média de percentuais. Liderança ≠ maioria absoluta.
- Neutralidade: mesmos critérios para todas as candidaturas; sem rótulos ideológicos, de classe ou interpretações políticas automáticas. Abstenção/brancos/nulos não indicam motivação.
- Seção ≠ local ≠ zona ≠ bairro/setor censitário. Endereço do local não é residência do eleitor.
- Não publicar, implantar ou contratar serviços externos sem instrução explícita. Recorte novo de dados (cargo, ano, UF piloto) é decidido com o Rafael antes de carga extensa.

## Comandos

Requisitos: Node 24.21.0 (`.nvmrc`), npm workspaces, Docker Compose, `unzip`.

```sh
npm ci
npm run db:up                 # PostgreSQL via Compose
npm run dev                   # api (127.0.0.1:3001) + web (localhost:3000)
npm run typecheck
npm test                      # testes unitários de todas as workspaces (node:test via tsx)
npm run build
npm test -w @observatorio/api # uma workspace
cd apps/api && npx tsx --test --test-name-pattern="trecho" test/api.test.ts  # um teste
```

Smoke tests exigem web, API e banco em execução com dados importados (endereços alternativos via `SMOKE_API_URL`/`SMOKE_WEB_URL`): `npm run smoke`, `smoke:pilot`, `smoke:places`, `smoke:national`, `smoke:exterior`, `smoke:summary`, `smoke:governor` (tabela no README). `npm run compose:up` sobe tudo em contêineres (perfil `app`).

Importações (demoradas, leem ZIPs grandes do TSE): `import:pilot`, `import:national`, `import:exterior`, seguidas de `npm run verify:national -w @observatorio/importer`; cargos estaduais com `npm run import:state -- --office governor --uf SP` (verificação persistida embutida).

## Arquitetura

- `packages/contracts`: esquemas Zod e tipos compartilhados (filtros, respostas, `percent`). Consumido via `dist/` — **recompile (`npm run build -w @observatorio/contracts`) após alterá-lo**; os scripts raiz já fazem isso.
- `apps/api` (NestJS, CommonJS): `ElectionsController` concentra as rotas de leitura; `DatabaseService` usa `pg` com pool pequeno e timeouts de 2 s. Valida filtros e também a própria resposta com os contratos. Sem Prisma por ora (decisão pendente).
- `apps/importer` (scripts `tsx`): baixa os ZIPs → preserva em `data/originals/<sha256>/` (somente leitura) → lê CSV Latin-1 em fluxo (`unzip -p` + `csv-parse`) → particiona por UF/município em `data/staging` → `model.ts` reconcilia por zona/turno contra apuração e nominal → grava votos, agregados e checkpoint por município em transação → troca atômica de `import_batches.published` só quando toda a cobertura reconciliou. Relatórios em `data/audit/<dataset-id>.json`.
- `apps/web` (Next.js 16, App Router): renderização no servidor, consulta a API com `no-store`; formulários GET funcionam sem JavaScript; `/arquivos/*` faz proxy de originais/relatórios.
- Banco: agregados guardados como JSONB `result` (municípios, zonas, locais) e votos por seção em linhas. Tabelas do piloto (`section_votes`, `polling_place_results`) coexistem com as nacionais (`national_*`). Esquema em `apps/importer/src/schema.sql` + `src/migrations/*.sql` (idempotentes, sem tabela de controle).

## Cuidados

- `apps/web/AGENTS.md`: o Next.js 16 difere do conhecimento prévio; consulte `node_modules/next/dist/docs/` antes de escrever código do frontend.
- Códigos municipais TSE são strings de cinco dígitos (`02550`); preservar zeros à esquerda. Não cruzar TSE–IBGE por nome.
- Exterior (`ZZ`) é escopo próprio: zona 1, localidades não são municípios nem países.
- Mudança de fonte ou de regra de importação exige nova versão do importador/dataset e validação própria; nunca reescrever uma publicação existente. Não sobrescrever originais.
- Não apagar `data/` (fora do Git) nem o volume PostgreSQL sem backup.
- Escopo atual: 2022, Presidência (nacional + exterior), Governador nas 27 UFs (`governor-2022-state-v3`; suplementar de RR de 2026 excluída de forma declarada) e Senador nas 27 UFs (`senator-2022-state-v1`, turno único). Contexto municipal do Censo 2022 e perfis do TSE (`municipal-context-2022-v1`, `npm run import:context`) e malhas do IBGE para mapas (`maps-ibge-2022-v2`, `npm run import:maps`); ver `docs/plano-ibge.md`. **Deputados estão fora do escopo** (decisão de 17/10/2026, para reservar armazenamento ao IBGE e ao cruzamento IBGE–TSE): não importar sem nova decisão do Rafael. Cargos são definidos por `ElectionScope` em `apps/importer/src/model.ts` (cargo, eleições por turno, turnos) e por `OFFICES`/`STATE_OFFICES` nos contratos; `datasetSchema.year` ainda é literal 2022. Cargo estadual exige UF e tem uma publicação por UF (`2022/<office>/<UF>`). Ao incluir outros cargos/anos, auditar os originais antes — votos de legenda, Senado de 2026 com duas vagas, anulados/nulos técnicos (`nonValidVotes` no recorte) e eleições suplementares têm regras próprias; exclusão de linhas só por declaração em `EXCLUSIONS` (`state.ts`), contada e registrada.
- Registrar a verificação feita (testes, smoke, auditorias) e o que ficou pendente; não declarar acessibilidade ou cobertura não verificadas.
