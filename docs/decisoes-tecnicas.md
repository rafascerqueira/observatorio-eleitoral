# Decisões técnicas — marco 1

Registro de 12/10/2026. O ambiente observado possui Node.js 24.21.0, npm 12.2.0, Docker 29.9.0 e Docker Compose 5.6.0. O repositório continha apenas `plan.md`, sem instruções `AGENTS.md` aplicáveis nem código anterior.

## Versões e referências

| Componente | Escolha | Fundamentação |
| --- | --- | --- |
| Node.js | 24.21.0 | Linha 24 LTS, instalada localmente; atende os requisitos dos dois frameworks. |
| Next.js | 16.4.0 | Versão estável informada pelo registro oficial npm na consulta; App Router. |
| React / React DOM | 19.3.0 | Versão estável consultada; compatível com os peer dependencies do Next escolhido. |
| NestJS | 12.1.3 | Pacotes common/core/platform-express/testing na mesma versão. |
| TypeScript | 5.9.3 | Escolha conservadora, compatível com os frameworks; não adota a nova major 7 neste marco. |
| PostgreSQL | 18.6-alpine | Imagem oficial da linha 18, volume em `/var/lib/postgresql`. |
| Driver PostgreSQL | pg 8.23.1 | Pool pequeno e consulta de saúde; evita definir ORM e modelo eleitoral antes da auditoria. |
| Gerenciador | npm workspaces | Disponível no ambiente; monorepo com lockfile único, sem ferramenta extra de orquestração. |

Versões principais são explícitas; dependências auxiliares são resolvidas e registradas no `package-lock.json`. Imagens Docker usam tags específicas, ainda sem fixação por digest. Atualizações deverão repetir as verificações de compatibilidade e os testes.

Documentação oficial consultada:

- [Releases do Node.js](https://nodejs.org/en/about/previous-releases): linha LTS e recomendação para produção.
- [Instalação do Next.js](https://nextjs.org/docs/app/getting-started/installation) e [migração para Next 16](https://nextjs.org/docs/app/guides/upgrading/version-16): Node ≥20.9 e TypeScript ≥5.1.
- [Primeiros passos do NestJS](https://docs.nestjs.com/first-steps) e [migração do NestJS](https://docs.nestjs.com/migration-guide): requisitos da aplicação e distinção dos requisitos dos geradores. Não utilizamos o CLI para gerar este monorepo.
- [Integração de bancos com NestJS](https://docs.nestjs.com/techniques/database): o framework não exige um ORM específico.
- [Releases do PostgreSQL](https://www.postgresql.org/docs/release/) e [imagem oficial](https://hub.docker.com/_/postgres): versão e caminho de persistência da linha 18.
- Registro npm: consultas `npm view` para versões estáveis, engines e peer dependencies. O lockfile identifica o que efetivamente foi instalado.

## Limites e desenho inicial

O backend é modular único, com pool PostgreSQL de até cinco conexões e tempos limite de conexão/consulta. `GET /health/live` mede apenas disponibilidade do processo; `GET /health/ready` executa `SELECT 1` no banco. As consultas também verificam o banco antes de retornar o estado inicial. Essa checagem não certifica dados: ainda não há tabelas eleitorais.

O contrato compartilhado usa Zod para validar os filtros na API e a resposta recebida pelo frontend. O endpoint só pode retornar `awaiting-import` neste marco. Paginação e ordenação são parâmetros validados; a consulta real, índices e agregados serão implementados após a auditoria. Resultados não previstos no contrato geram indisponibilidade na interface em vez de serem interpretados silenciosamente.

O frontend consulta a API no servidor, com `no-store` e timeout. O navegador recebe a página renderizada, sem URL interna do banco/API ou base nacional. Não há recursos remotos de fontes tipográficas. Os filtros funcionam como formulário GET, inclusive sem JavaScript. Há labels, link para pular navegação, foco visível, tabela semântica, região rolável e layouts responsivos.

API local em loopback por padrão; no Compose, escuta na rede interna e sua porta publicada continua em loopback. CORS permite apenas a origem configurada. Credenciais não são incluídas nos erros de configuração ou nas respostas de saúde.

## Adiado até o marco 2

Esquema e migrations eleitorais, importação, Prisma, PostGIS, correspondência TSE–IBGE, geografia de entorno e indicadores de renda. A escolha do piloto deve preceder uma carga extensa. Não há dados fictícios no painel, comparação entre anos, conclusões políticas, IA ou detecção de fraude.

## Validação realizada

- `npm run typecheck`: aprovado nas três workspaces.
- `npm test`: quatro testes aprovados, incluindo verificações HTTP da API.
- `npm run build`: contratos, API e frontend compilados; fontes e metodologia geradas como páginas estáticas, consulta dinâmica.
- Docker Compose: imagens construídas e serviços web/API/PostgreSQL saudáveis, com conexão real ao banco.
- `npm run smoke`: aprovado contra os containers locais, incluindo páginas, filtros inválidos e HTML semântico básico.
- Banco parado temporariamente: readiness retornou `503`, liveness permaneceu `200` e o frontend exibiu indisponibilidade em vez do estado sem importação. Banco restaurado e smoke repetido com sucesso.

Não foi feita auditoria completa de acessibilidade nem revisão visual em navegador; a ferramenta de navegação não apresentou superfícies disponíveis nesta sessão. Nenhuma importação ou reconciliação de resultados oficiais foi realizada.
