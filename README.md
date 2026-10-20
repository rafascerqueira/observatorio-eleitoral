# Observatório eleitoral brasileiro

Projeto de dashboard público, gratuito e sem fins lucrativos para explorar eleições e contexto territorial com dados oficiais. A implementação está disponível **localmente, sem implantação externa**. O [planejamento](plan.md) separa o estado vigente, as decisões e o histórico; `AGENTS.md` reúne as orientações para assistentes de código.

## O que está disponível

**Resultados de 2022**, com turnos sempre separados:

- **Presidência — Brasil e exterior:** consolidado dos 5.570 municípios das 27 UFs e das 181 localidades eleitorais do exterior. O exterior só entra com cobertura completa e os mesmos originais/checksums da publicação doméstica; as duas versões ficam identificadas. `ZZ` tem consulta própria por localidade, sem equivalência presumida a país.
- **Governador — 27 UFs:** resultado da UF, municípios e locais; 2º turno nas 12 UFs onde ocorreu, e “turno não realizado” nas demais. A consulta exige UF; sem consolidado Brasil nem exterior para o cargo.
- **Senador — 27 UFs:** resultado da UF, municípios e locais, em turno único. Em 2022 houve uma vaga por UF e um voto por eleitor; o 2º turno é informado como não realizado.
- **Consulta municipal:** filtros por cargo/turno/UF/nome, sugestões tolerantes a acentos e erros de digitação, uma linha por município e paginação acima/abaixo. O detalhe nativo mostra todas as candidaturas, brancos, nulos, categorias não válidas e avisos, inclusive sem JavaScript.
- **Locais de votação:** busca por zona, seção, código, nome ou endereço; cada local mostra suas seções e o setor censitário associado ao seu ponto (ou o motivo da não associação), com um quadro do município por situação. Endereço do local não é residência do eleitor, e o setor descreve o entorno do prédio, não os eleitores.

Votos anulados, anulados sub judice e nulos técnicos mantêm a classificação da fonte, com candidatura identificada quando aplicável e denominadores explícitos. Liderança não significa maioria absoluta; agregações somam votos e denominadores, sem média de percentuais.

**Território, perfis e mapas:**

- **Contexto municipal:** população, cor ou raça, alfabetização, instrução, classes de rendimento domiciliar per capita em salários mínimos e valores per capita em reais (Censo 2022); entorno dos domicílios (calçada, rampa, obstáculo, iluminação, pavimentação, bueiro, ponto de ônibus e árvores) nos setores com essa pesquisa; cadastro e comparecimento por perfil do TSE como base própria declarada. Omissões, diferenças não discriminadas e arredondamento ficam explícitos; falha técnica não é apresentada como ausência na fonte.
- **Participação** (`/participacao`): comparecimento e abstenção por UF/município, turno, gênero, idade, escolaridade, estado civil e obrigatoriedade. A fonte não traz DF nem exterior; indisponibilidade não vira zero. Não contém voto por candidatura de grupos de pessoas.
- **Perfis dos locais** (`/perfis`): cinco faixas fixas por escolaridade, parcela de eleitoras, eleitores de 16 a 24 anos, de 60 anos ou mais, ou renda mediana do setor do local, com votos somados por grupo. Comparações territoriais de moradores por faixa e sensibilidade por entornos de 250 m, 500 m e 1 km, com cobertura e limites declarados. Descreve locais e setores, não a renda ou o voto de cada eleitor.
- **Mapas:** em `/mapa`, um indicador do Censo ao lado da abstenção do cargo escolhido ou da votação de uma candidatura (abstenção como padrão), com dispersão sem linha de tendência e exportação CSV com códigos, denominadores e versões; um mapa por candidatura, com escala comum, em `/mapa/candidaturas`. Tabelas equivalentes acompanham as visualizações.
- **Transparência** (`/fontes`): versões, cobertura, relatórios de auditoria e originais preservados com SHA-256, incluindo GeoPackage. As entradas dos derivados ficam registradas nos metadados/relatórios; mudanças de entrada ou divergências bloqueiam sua publicação.

Resultados de **2026 e a suplementar de Governador de RR/2026 não foram importados**. Deputados estão fora do escopo atual. Não há inferências de motivação, ideologia ou transferência individual de votos.

## Estado da última entrega

Verificação concluída em **19/10/2026**, consolidada no commit `825dffb` e enviada para `upstream/main`:

- 86 testes unitários, typecheck e build; nove smokes e 31 regressões HTTP aprovados.
- 60 avaliações automáticas de acessibilidade/refluxo em Chrome e Firefox, sem violações do axe ou rolagem horizontal fora das tabelas; isso não certifica toda a acessibilidade.
- Nove reexecuções idempotentes e duas comparações integrais das 11 tabelas derivadas: conteúdo idêntico ao anterior, versões antigas e 57 publicações eleitorais preservadas.

Evidências, versões/IDs e limites em [reimportações de 18–19/10](docs/reimportacoes-2026-10-18.md). Depois disso, a fase A do [plano de melhorias](docs/plano-postgis-propostas.md) (setor de cada local, série comparada com dispersão e exportação em `/mapa`) foi verificada localmente em 19/10 e está em commit local, sem push: 98 testes, typecheck/build, nove smokes, 31 regressões e 66 avaliações automáticas em Chrome/Firefox ([plano](plan.md), §33). A fase C (entorno dos domicílios, `import:urban-surroundings`) está publicada no banco local, verificada e em commit local, sem push (§34). A fase B2 (malha de setores com a geometria exata, `import:tract-geometries`, ~1,4 GB no banco) está publicada no banco local, verificada e em commit local, sem push (§39). A fase B3 (mapa dos setores e dos locais, `/municipios/[code]/setores`) e o inventário das propostas de governo (D1, sem publicação) também estão em commit local (§§41–42). O volume Docker do PostgreSQL e o diretório `data/` (originais, backups e artefatos) **não acompanham o Git**; um clone novo exige importar os dados ou restaurar um backup próprio.

## Iniciar localmente

Requisitos: Node.js 24.21.0 (veja `.nvmrc`), npm 11 ou superior (desenvolvido com npm 12.2.0), Docker, Docker Compose e `unzip` para o importador.

```sh
test -f .env || cp .env.example .env
npm ci
npm run db:up
npm run dev
```

Abra <http://localhost:3000>. A API fica em <http://127.0.0.1:3001>. Sem importação, a interface mostra o estado vazio — nunca números de exemplo.

A aplicação e os importadores leem o `.env` da raiz; variáveis já definidas no ambiente têm precedência. O comando acima preserva um `.env` existente. Se alterar `POSTGRES_PORT`, usuário, senha ou banco, ajuste também `DATABASE_URL`. Credenciais do exemplo são apenas locais, e mudar usuário/senha não altera um banco já inicializado no volume.

`Ctrl+C` encerra os servidores de desenvolvimento; `npm run db:stop` para o banco preservando o volume. `npm run build` confere a compilação. Para executar o conjunto compilado sem watch, use o perfil Docker abaixo: a web tem saída `standalone` e o Dockerfile executa seu servidor Node com os arquivos estáticos. O `next start` do script da workspace web não é a forma indicada para essa configuração.

### Tudo em Docker

```sh
test -f .env || cp .env.example .env
npm run compose:up    # equivale a: docker compose --profile app up --build -d --wait
docker compose --profile app logs -f
docker compose --profile app stop
```

O perfil `app` sobe PostgreSQL/PostGIS e constrói/inicia API e web, com verificações de saúde e portas vinculadas apenas à máquina local. A API recebe `data/originals` e `data/audit` como volumes somente leitura. O ambiente é local; não há publicação, domínio ou serviço contratado.

## Importar os dados

Com o banco em execução, escolha as etapas necessárias. Os exemplos reproduzem o escopo já auditado de 2022; não atualizam automaticamente arquivos preservados nem autorizam novos recortes. Importações grandes podem levar dezenas de minutos e usam bastante disco; faça backup antes de alterar um banco existente e não rode cargas em paralelo.

### Resultados eleitorais

```sh
npm run import:national                             # Presidência: municípios das 27 UFs
npm run verify:national -w @observatorio/importer    # reconfere a persistência
npm run import:exterior                             # Presidência: exterior (ZZ)
npm run import:state -- --office governor --uf SP   # exemplo de UF para Governador
npm run import:state -- --office senator --uf SP    # exemplo de UF para Senador
```

Os dois últimos comandos carregam apenas SP; o escopo completo exige executar cada cargo nas 27 UFs. Exemplo para Governador, em subshell que para na primeira falha (para Senador, troque `governor` por `senator`):

```sh
(
  for uf in AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO; do
    npm run import:state -- --office governor --uf "$uf" || exit 1
  done
)
```

`import:state` usa as entradas da UF nos ZIPs de apuração e votação nominal e baixa o ZIP de seções da UF. A conferência persistida é feita antes da publicação. A suplementar de RR é excluída somente pela declaração auditada, com contagem e aviso; não é misturada à eleição ordinária de 2022.

As medidas históricas de cerca de 816 MiB para os ZIPs iniciais da Presidência e 3 GiB no banco referem-se à carga presidencial, **não ao projeto completo**. Cargos estaduais, perfis, IBGE, staging, versões antigas e backups aumentam o armazenamento; confira o espaço disponível antes de carregar.

### Contexto, mapas e derivados

Execute sequencialmente, após a Presidência nacional e os resultados estaduais desejados. Esta é a ordem usada na reimportação auditada:

```sh
(
  set -e
  npm run import:context             # contexto municipal, Censo e perfis TSE
  npm run import:maps                # malhas IBGE para os mapas
  npm run import:sectors             # associação local → setor, PostGIS
  npm run import:place-profiles      # perfil do eleitorado por local
  npm run import:income-bands        # moradores por faixa da mediana de renda do setor
  npm run import:turnout-profiles    # participação cruzada por UF/município
  npm run import:tract-demography    # moradores de 15+ por faixas de perfil do setor
  npm run import:urban-surroundings  # entorno dos domicílios (calçada, rampa, iluminação...)
  npm run import:tract-geometries    # malha de setores com a geometria exata (~1,4 GB)
  npm run import:tract-display       # desenho simplificado dos setores para o mapa local → setor
  npm run import:place-groups        # grupos de locais para os resultados publicados
  npm run import:tract-sensitivity   # grupos alternativos nos três raios
)
```

Pare ao primeiro erro; não trate uma cadeia parcial como concluída. A troca é atômica **por escopo**, não para a cadeia inteira. Durante uma atualização completa dos derivados, mantenha API/web desligadas até concluir as dependências e verificações; a API recusa entradas registradas que ficaram desatualizadas.

| Importador | Versão atual | Publicações de entrada |
| --- | --- | --- |
| `import:context` | `municipal-context-2022-v3` | Presidência nacional |
| `import:maps` | `maps-ibge-2022-v3` | Presidência nacional |
| `import:sectors` | `polling-place-tracts-2022-v3` | Presidência nacional |
| `import:place-profiles` | `place-profiles-2022-v2` | Contexto + Presidência nacional |
| `import:income-bands` | `income-bands-2022-v3` | Contexto |
| `import:turnout-profiles` | `turnout-profiles-2022-v3` | Contexto + Presidência nacional |
| `import:tract-demography` | `tract-demography-2022-v2` | Contexto |
| `import:urban-surroundings` | `urban-surroundings-2022-v1` | Contexto + associação aos setores |
| `import:tract-geometries` | `tract-geometries-2022-v1` | Nenhuma (confere com a associação aos setores publicada) |
| `import:tract-display` | `tract-display-2022-v1` | Malha de setores |
| `import:place-groups` | `place-groups-2022-v5` | Resultados publicados + perfil por local + associação aos setores |
| `import:tract-sensitivity` | `tract-sensitivity-2022-v2` | Entradas dos grupos + publicação dos grupos |

As identidades incluem também os originais e a configuração pertinente. Refaça grupos/sensibilidade após uma nova publicação de resultados; mudanças em qualquer entrada registrada exigem atualizar os dependentes. Renda e demografia fornecem as comparações territoriais da interface; o entorno dos domicílios usa só os agregados em contagens de moradores (por setor e município) e guarda, por setor, apenas os associados a locais de votação. Métodos, cobertura e dicionários em [plano IBGE](docs/plano-ibge.md); IDs e prova de idempotência em [reimportações](docs/reimportacoes-2026-10-18.md).

### Validação e publicação

O fluxo eleitoral funciona assim:

1. **Originais**: ficam em `data/raw/tse/2022` e são preservados em `data/originals/<sha256>/<arquivo>`, somente leitura e com integridade conferida a cada uso. Arquivos existentes não são atualizados automaticamente.
2. **Preparação**: as seções são particionadas em NDJSON por UF/município em `data/staging`. Um manifesto só é gravado após ler todas as fontes e verificar os CRCs; uma interrupção nessa fase exige refazer a leitura, e partições incompletas (`.partial-*`) nunca são publicadas.
3. **Reconciliação e carga**: cada município é conferido por zona e turno (candidaturas, válidos, brancos, nulos, participação e seções) e gravado, com seu checkpoint, numa única transação. A carga retoma por município após interrupção.
4. **Publicação**: a troca da versão pública é atômica e só ocorre quando todos os municípios do recorte reconciliaram. Divergências de votos ou chaves, duplicatas e categorias de voto não auditadas bloqueiam a publicação.

Nos derivados, o lote só é publicado após conferir entradas atuais sob lock e preparar o relatório. A reexecução exige mesmo ID, lote ainda publicado e relatório com metadados idênticos; lote histórico despublicado não é regravado. A identidade considera versão, fontes, entradas e configuração. Mudança de fonte ou de regra exige nova versão e validação própria. Não apague `data/` nem o volume PostgreSQL sem backup.

O relatório de cada versão fica em `data/audit/<dataset-id>.json` (cobertura por município, conflitos e limitações) e também é servido pela transparência. Resultados, decisões e limites de cada carga:

- [Importação nacional](docs/importacao-nacional-2022.md): versão `president-2022-national-v2`, normalização dos códigos TSE com cinco dígitos, tentativa v1 rejeitada, seções não instaladas e métricas.
- [Exterior](docs/exterior-2022.md): versão `president-2022-exterior-v1`, zona única do exterior e os eleitores de seções não instaladas (657 no consolidado Brasil, por turno).
- [Governador 2022](docs/governador-2022.md): versão `governor-2022-state-v3` nas 27 UFs (a v2 omitia os não válidos nos locais), eleições 546/547, votos anulados e nulos técnicos, exclusão declarada da suplementar de RR e conferência contra os originais.
- [Senador 2022](docs/senador-2022.md): versão `senator-2022-state-v1` nas 27 UFs, eleição 546 em turno único, categorias não válidas por UF e conferência contra os originais.
- [IBGE e perfis](docs/plano-ibge.md) e [reimportações](docs/reimportacoes-2026-10-18.md): nove derivados atuais, fontes, dependências, limites e conteúdo preservado nas novas versões.

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

Os testes unitários usam fixtures sintéticas e cobrem filtros, configuração, reconciliação, denominadores, duplicatas, divergências, isolamento por ano/território, partições, dependências, downloads, falhas técnicas e navegação. O painel usa apenas dados oficiais.

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
| `npm run smoke:context` | contexto + mapas + nacional; derivados opcionais conforme catálogo | Contexto de SP contra a SIDRA, códigos, DF indisponível, totais, mapas e páginas; quando presentes, também grupos, renda, participação, demografia, sensibilidade e mapas por candidatura |
| `npm run smoke:senator` | `import:state -- --office senator --uf SP` (UF de exemplo) + nacional | Em cada UF publicada: aptos, votos, válidos e municípios dos originais, invariantes, turno único, categorias não válidas, casos auditados, locais do Rio com nulos técnicos, separação do Governador e páginas |

```sh
curl http://127.0.0.1:3001/health/live
curl http://127.0.0.1:3001/health/ready
curl 'http://127.0.0.1:3001/elections/municipalities?year=2022&round=1&uf=SP&page=1&pageSize=25'
```

Verificações adicionais (não iniciam importações):

| Comando | Exige | Verifica e efeitos |
| --- | --- | --- |
| `npm run check:data` | nove derivados atuais + Presidência nacional + originais | Transação somente de leitura: contratos dos 5.570 contextos, 163 respostas SIDRA com checksum e células originais, comparadores eleitorais, contador de seleção versus CSV do exterior, dependências e relatórios. Não grava no banco nem em `data/`. |
| `npm run check:publication` | banco local | Publicação, falha de disco e reexecução com entrada substituída/lote antigo em tabelas TEMP isoladas; rollback da troca simulada e IDs/flags públicos intactos; temporários removidos. |
| `npm run check:reimports -- snapshot baseline.json` / `npm run check:reimports -- verify baseline.json comparacao.json` | banco antes/depois das nove versões derivadas de 2022 | IDs/fontes, conteúdo SHA-256 das 11 tabelas, preservação das versões anteriores e entradas atuais. SELECT em transação READ ONLY; cria somente os JSONs informados, sem sobrescrever. Uso e artefatos em [reimportações](docs/reimportacoes-2026-10-18.md). |
| `npm run check:regressions` | web/API/banco e dados publicados | Isolamento por ano, bytes dos relatórios, GeoPackage e diferença do Censo. Só GET; cancela os downloads grandes após o primeiro bloco. |
| `npm run check:ui` | web/API/banco, Chrome e Firefox instalados | Navegadores reais, envio dos seis formulários com/sem JavaScript, axe, teclado, refluxo, paginação e preferências de movimento/cores. Grava capturas e relatório em `data/analysis/ui-checks/<data>/`. |

`check:reimports` foi preparado para a migração das nove versões de 2022: a baseline deve ser capturada **antes** da troca. A comparação exige nova identidade/versão e, sem escopos parciais, `complete: true`; não é um verificador genérico de qualquer carga futura nem substitui `check:data`. As evidências da carga atual dependem da baseline local preservada.

As ferramentas `puppeteer-core` e `axe-core` estão fixadas no lockfile; `npm ci` não baixa navegadores. O roteiro procura Chrome no cache do Puppeteer e Firefox em `/usr/bin/firefox`. Para outro caminho, use `UI_BROWSER=chrome` (ou `firefox`) e `UI_EXECUTABLE_PATH=/caminho/do/navegador`. Os serviços podem ser configurados com `UI_WEB_URL`/`UI_API_URL` (somente loopback). `UI_ONLY=Envio` (expressão regular sobre os nomes dos cenários) permite repetir casos específicos, sem declarar a execução da suíte completa. No Chrome o teste sem JS desativa a execução por CDP; no Firefox instalado, usa proxy local temporário com CSP que bloqueia todos os scripts da página, pois o comando BiDi equivalente não é suportado. Há controle positivo de não execução nos dois. Não execute importações pesadas em paralelo com smokes ou testes de interface, pois competem pelo banco e podem causar timeouts.

Testes HTTP não substituem revisão em navegador. A primeira avaliação está em [acessibilidade](docs/acessibilidade.md); a matriz de regressões e limites da revisão de 18/10 está em [correções e verificação](docs/correcoes-verificacao-2026-10-18.md). Leitor de tela humano e Safari real exigem verificação própria.

## Estrutura

```text
apps/api/            NestJS: saúde, banco e rotas públicas de consulta (docs/api.md)
apps/importer/       TypeScript: download, preparação, reconciliação, carga, verificação e análise
apps/web/            Next.js: consultas, mapas, perfis, participação, fontes e metodologia
packages/contracts/  Esquemas Zod e tipos compartilhados entre web, API e importador
scripts/             Inicialização, smoke tests, regressões HTTP/UI e auditorias
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

- **Acessibilidade manual:** leitor de tela humano, Safari, dispositivos móveis reais, zoom de texto e alto contraste do sistema. Chrome/Firefox, axe, teclado e formulários com/sem JS já têm verificações registradas; não equivalem a certificação completa.
- **Hospedagem, por último:** escolher a estratégia com Rafael, validar preço/região/capacidade, restauração do backup e carga no destino antes de uma implantação autorizada. A [análise inicial](docs/hospedagem-inicial.md) é um retrato de 17/10, não orçamento atual nem contratação. Nenhum provedor foi escolhido.
- **Decisões de produto/escopo:** licença e nome definitivo; eventual recorte próprio para a suplementar de RR e para 2026, com novas auditorias e denominadores. Deputados continuam fora do escopo, para reservar armazenamento ao IBGE e ao cruzamento territorial; não importar automaticamente.
- **Manutenção/possibilidades registradas:** limpeza de armazenamento com proteção dos dados; nome impreciso `responsible_with_income`, sem uso na interface; eventual enriquecimento da busca com distritos do IBGE. Não são novas autorizações de execução.

Autocomplete, listagem municipal compacta, participação por município/estado civil, sensibilidade local → setor, mapas por candidatura e relatórios em modo dev estão concluídos. O estado vigente e a continuidade estão no [planejamento](plan.md).
