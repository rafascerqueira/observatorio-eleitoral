# Operação local: execução, importações e verificações

Manual de quem roda o projeto na própria máquina: requisitos, configuração, importação dos dados, fluxo de validação e publicação, verificações e ferramentas de codificação das propostas. A apresentação do projeto está no [README](../README.md); decisões e histórico, no [planejamento](../plan.md).

## Executar localmente

Requisitos: Node.js 24.21.0 (veja `.nvmrc`), npm 11 ou superior (desenvolvido com npm 12.2.0), Docker, Docker Compose e `unzip` para o importador. Só para as propostas de governo (`import:proposals`, `inventory:proposals`, `audit:proposals-text`), também os pacotes de sistema `poppler-utils` e `tesseract-ocr` com `tesseract-ocr-por`; as versões entram na identidade da publicação (a atual usa as do Ubuntu 24.04: Poppler 24.02.0 e Tesseract 5.3.4). A API e a web não usam essas ferramentas: leem o texto já extraído do banco.

```sh
test -f .env || cp .env.example .env
npm ci
npm run db:up
npm run dev
```

Abra <http://localhost:3000>. A API fica em <http://127.0.0.1:3001>. Sem importação, a interface mostra o estado vazio — nunca números de exemplo.

A aplicação e os importadores leem o `.env` da raiz; variáveis já definidas no ambiente têm precedência. O comando acima preserva um `.env` existente. Se alterar `POSTGRES_PORT`, usuário, senha ou banco, ajuste também `DATABASE_URL`. Credenciais do exemplo são apenas locais, e mudar usuário/senha não altera um banco já inicializado no volume. Na web, `SITE_URL` define a origem absoluta das imagens de compartilhamento (padrão local: `http://localhost:3000`, também quando vazia); valor inválido interrompe a compilação. Qualquer hospedagem futura precisa definir essa variável na compilação da web: no Compose, ela vai do `.env` como argumento de build da imagem da web.

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

As eleições de 2026 usam os mesmos comandos com `--year 2026` (o padrão continua `2022`, e as publicações de 2022 mantêm a identidade). Os arquivos vão para `data/raw/tse/2026`; cada ano tem publicações próprias (`2026/president/BR`, `2026/president/ZZ`, `2026/<cargo>/<UF>`), versões próprias (`president-2026-national-v1`, `president-2026-exterior-v1`, `governor-2026-state-v1`, `senator-2026-state-v1`) e regras auditadas nos originais de 2026: Senado com duas vagas (votos = 2 × comparecimento, por zona) e Presidência com nulos técnicos.

```sh
npm run import:national -- --year 2026
npm run verify:national -w @observatorio/importer -- --year 2026
npm run import:exterior -- --year 2026   # depois da nacional do mesmo ano (lê as partições dela)
npm run import:state -- --office senator --uf SP --year 2026
```

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
  npm run import:proposals           # propostas de governo da Presidência (exige poppler-utils, tesseract-ocr e tesseract-ocr-por)
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
| `import:proposals` | `proposals-2022-v2` | Presidência nacional e exterior |
| `import:place-groups` | `place-groups-2022-v5` | Resultados publicados + perfil por local + associação aos setores |
| `import:tract-sensitivity` | `tract-sensitivity-2022-v2` | Entradas dos grupos + publicação dos grupos |

As identidades incluem também os originais e a configuração pertinente. Refaça grupos/sensibilidade após uma nova publicação de resultados; mudanças em qualquer entrada registrada exigem atualizar os dependentes. Renda e demografia fornecem as comparações territoriais da interface; o entorno dos domicílios usa só os agregados em contagens de moradores (por setor e município) e guarda, por setor, apenas os associados a locais de votação. Métodos, cobertura e dicionários em [plano IBGE](plano-ibge.md); IDs e prova de idempotência em [reimportações](reimportacoes-2026-10-18.md).

### Validação e publicação

O fluxo eleitoral funciona assim:

1. **Originais**: ficam em `data/raw/tse/2022` e são preservados em `data/originals/<sha256>/<arquivo>`, somente leitura e com integridade conferida a cada uso. Arquivos existentes não são atualizados automaticamente.
2. **Preparação**: as seções são particionadas em NDJSON por UF/município em `data/staging`. Um manifesto só é gravado após ler todas as fontes e verificar os CRCs; uma interrupção nessa fase exige refazer a leitura, e partições incompletas (`.partial-*`) nunca são publicadas.
3. **Reconciliação e carga**: cada município é conferido por zona e turno (candidaturas, válidos, brancos, nulos, participação e seções) e gravado, com seu checkpoint, numa única transação. A carga retoma por município após interrupção.
4. **Publicação**: a troca da versão pública é atômica e só ocorre quando todos os municípios do recorte reconciliaram. Divergências de votos ou chaves, duplicatas e categorias de voto não auditadas bloqueiam a publicação.

Nos derivados, o lote só é publicado após conferir entradas atuais sob lock e preparar o relatório. A reexecução exige mesmo ID, lote ainda publicado e relatório com metadados idênticos; lote histórico despublicado não é regravado. A identidade considera versão, fontes, entradas e configuração. Mudança de fonte ou de regra exige nova versão e validação própria. Não apague `data/` nem o volume PostgreSQL sem backup.

O relatório de cada versão fica em `data/audit/<dataset-id>.json` (cobertura por município, conflitos e limitações) e também é servido pela transparência. Resultados, decisões e limites de cada carga:

- [Importação nacional](importacao-nacional-2022.md): versão `president-2022-national-v2`, normalização dos códigos TSE com cinco dígitos, tentativa v1 rejeitada, seções não instaladas e métricas.
- [Exterior](exterior-2022.md): versão `president-2022-exterior-v1`, zona única do exterior e os eleitores de seções não instaladas (657 no consolidado Brasil, por turno).
- [Governador 2022](governador-2022.md): versão `governor-2022-state-v3` nas 27 UFs (a v2 omitia os não válidos nos locais), eleições 546/547, votos anulados e nulos técnicos, exclusão declarada da suplementar de RR e conferência contra os originais.
- [Senador 2022](senador-2022.md): versão `senator-2022-state-v1` nas 27 UFs, eleição 546 em turno único, categorias não válidas por UF e conferência contra os originais.
- [IBGE e perfis](plano-ibge.md) e [reimportações](reimportacoes-2026-10-18.md): nove derivados atuais, fontes, dependências, limites e conteúdo preservado nas novas versões.

Seções não instaladas não são somadas à abstenção: aptos = comparecimento + abstenção + eleitores dessas seções. Nomes/endereços divergentes de um mesmo local ficam indisponíveis, com variantes preservadas e aviso no painel. Aptos e abstenção por local permanecem indisponíveis.

### Piloto São Paulo (opcional)

Primeira importação do projeto, restrita ao município de São Paulo. Não é necessária para a consulta nacional, que tem prioridade na API.

```sh
npm run import:pilot
npm run analyze -w @observatorio/importer
```

`analyze` reconfere as somas no banco e exporta `data/analysis/sao-paulo-2022.json`. Resultados e limites estão na [análise de São Paulo](analise-sao-paulo-2022.md).

## Codificação das propostas: rubrica e bússola (sem publicação)

Duas ferramentas de codificação documental dos planos de governo da Presidência de 2022, no mesmo fluxo: pacote comum → duas codificações independentes → concordância → adjudicação. Leem o banco só para consulta (a validação nem isso) e gravam em `data/`; **nada disso é publicado** nem aparece na web.

```sh
npm run rubric:packet                 # rubrica de acessibilidade e mobilidade (fase D3)
npm run compass:packet                # bússola política, modelo Kieskompas
npm run rubric:validate -- --pacote=<dir> --planilha=<planilha>   # conferência só com o pacote, sem banco (também compass:validate)
npm run compass:agreement -- --pacote=<dir> --a=<planilha da pessoa> --autoria-a=pessoa \
  --b=<planilha do modelo> --autoria-b=modelo:<id> --isolamento-b=<api|sessao> [--adjudicacao=<planilha>]
```

`rubric:agreement` recebe as mesmas opções e, além delas, `--consistencia`: compara duas codificações do mesmo modelo (`--autoria-a` e `--autoria-b` iguais) e grava o resultado ao lado da primeira planilha, fora do pacote, sem planilha de adjudicação. `rubric:validate` e `compass:validate` conferem uma planilha só com `textos/` do pacote, para quem codifica sem o banco; a concordância confere de novo no texto publicado (em 24/10/2026, as 438 páginas do pacote da rubrica deram o mesmo `search_text` do banco). Caminhos relativos valem a partir do diretório de onde se chama o `npm`. Os pacotes vão como `.zip` em releases do repositório. O relatório da rubrica traz o AC1 de Gwet por critério, com intervalo e o mínimo de 0,70 para publicar. O pacote só traz material comum: as planilhas preenchidas e as notas de cada codificação ficam fora do diretório dele. A autoria de cada codificação é obrigatória (`pessoa`, sem nome, ou `modelo:<identificador>` com `--isolamento-<a|b>=api|sessao`), e a concordância exige uma pessoa e um modelo. Na rubrica e na bússola, a pessoa codifica primeiro, em público, num pull request em `codificacoes/<versão>/`, e o modelo depois, numa execução isolada que recebe só o pacote e o livro (decisões de Rafael, 24/10/2026); a adjudicação é sempre humana e cada codificação lê os documentos inteiros. Regras em [rubrica das propostas](rubrica-propostas.md) e no [livro de códigos da bússola](bussola-livro-de-codigos.md); situação no [plano da bússola](plano-bussola-politica.md).

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
| `npm run check:reimports -- snapshot baseline.json` / `npm run check:reimports -- verify baseline.json comparacao.json` | banco antes/depois das nove versões derivadas de 2022 | IDs/fontes, conteúdo SHA-256 das 11 tabelas, preservação das versões anteriores e entradas atuais. SELECT em transação READ ONLY; cria somente os JSONs informados, sem sobrescrever. Uso e artefatos em [reimportações](reimportacoes-2026-10-18.md). |
| `npm run check:regressions` | web/API/banco e dados publicados | Isolamento por ano, bytes dos relatórios, GeoPackage e diferença do Censo. Só GET; cancela os downloads grandes após o primeiro bloco. |
| `npm run check:ui` | web/API/banco, Chrome e Firefox instalados | Navegadores reais, envio dos seis formulários com/sem JavaScript, axe, teclado, refluxo, paginação e preferências de movimento/cores. Grava capturas e relatório em `data/analysis/ui-checks/<data>/`. |

`check:reimports` foi preparado para a migração das nove versões de 2022: a baseline deve ser capturada **antes** da troca. A comparação exige nova identidade/versão e, sem escopos parciais, `complete: true`; não é um verificador genérico de qualquer carga futura nem substitui `check:data`. As evidências da carga atual dependem da baseline local preservada.

As ferramentas `puppeteer-core` e `axe-core` estão fixadas no lockfile; `npm ci` não baixa navegadores. O roteiro procura Chrome no cache do Puppeteer e Firefox em `/usr/bin/firefox`. Para outro caminho, use `UI_BROWSER=chrome` (ou `firefox`) e `UI_EXECUTABLE_PATH=/caminho/do/navegador`. Os serviços podem ser configurados com `UI_WEB_URL`/`UI_API_URL` (somente loopback). `UI_ONLY=Envio` (expressão regular sobre os nomes dos cenários) permite repetir casos específicos, sem declarar a execução da suíte completa. No Chrome o teste sem JS desativa a execução por CDP; no Firefox instalado, usa proxy local temporário com CSP que bloqueia todos os scripts da página, pois o comando BiDi equivalente não é suportado. Há controle positivo de não execução nos dois. Não execute importações pesadas em paralelo com smokes ou testes de interface, pois competem pelo banco e podem causar timeouts.

Testes HTTP não substituem revisão em navegador. A primeira avaliação está em [acessibilidade](acessibilidade.md); a matriz de regressões e limites da revisão de 18/10 está em [correções e verificação](correcoes-verificacao-2026-10-18.md). Leitor de tela humano e Safari real exigem verificação própria.

## Banco e esquema

A conexão usa o driver `pg`; Prisma ainda não foi adotado. O esquema está em `apps/importer/src/schema.sql` e `apps/importer/src/migrations/`, aplicados pelos importadores. Versões e referências das escolhas técnicas: [decisões técnicas](decisoes-tecnicas.md).

### Bancos antigos

<details>
<summary>Banco criado antes da busca por seção (piloto antigo)</summary>

Novas importações já incluem o índice. Para um banco do piloto instalado antes dele, aplicar uma vez (não exige reimportação; ajuste usuário/banco se alterados):

```sh
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U observatorio -d observatorio < apps/importer/src/migrations/002-section-lookup.sql
```

</details>
