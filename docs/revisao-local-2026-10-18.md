# Revisão local e lacunas — 18/10/2026

Registro da revisão anterior às correções. O atendimento posterior, os testes incorporados e os limites estão em [correções e verificação](correcoes-verificacao-2026-10-18.md).

Base: commit `5ec76ea7b4202e93fb3841651cb4860ca1e0f7f4`, árvore de trabalho inicialmente limpa. Revisão do código, do histórico e das decisões em `plan.md`, com consultas somente de leitura ao PostgreSQL local. Nenhuma carga, alteração de publicação ou implantação foi executada.

## Defeitos confirmados

### 1. P1 — Consultas de 2026 retornam resultados da Presidência de 2022

Em `apps/api/src/elections/elections.controller.ts:158` e `:331`, `placeGroups` e `candidateMap` verificam nível e existência da publicação, mas não comparam o ano solicitado com `dataset.year`. O auxiliar `publishedDataset` (`:530`) busca os escopos fixos da Presidência de 2022. As consultas seguintes filtram pelo lote, sem outro filtro de ano.

Reprodução com a base publicada:

```text
/elections/places/groups?indicator=college&year=2026
  HTTP 200, status=published, 5 grupos
/elections/map/candidates?year=2026
  HTTP 200, status=published, 27 UFs
```

Em ambos os métodos, a resposta de 2026 é idêntica à de 2022, inclusive por hash do JSON. Reproduzido também por HTTP na API compilada. O defeito afeta a Presidência; os cargos estaduais procuram um escopo contendo o ano. As outras consultas principais já fazem a comparação de ano.

**Falta:** impedir a leitura de publicação de outro ano e acrescentar regressões das duas rotas, incluindo renda com raio e recortes por UF. O resultado esperado sem publicação é `awaiting-import`, sem números de outro ano.

### 2. P2 — O download do original GeoPackage retorna 404

`apps/api/src/elections/elections.controller.ts:501` e `apps/web/app/arquivos/[...path]/route.ts:5` aceitam apenas extensões `zip`, `json` e `xlsx`. O importador preserva a malha nacional como `br_setores_cd2022.gpkg`, e a página de fontes oferece o link do original.

Conferido: o arquivo preservado existe, tem **1.503.952.896 bytes**, está nas fontes da publicação, mas `original(sha256, file)` o recusa com 404 antes da consulta ao registro. O proxy web também o recusa pela extensão.

**Falta:** admitir o formato nas duas rotas, definir o tipo de conteúdo apropriado e testar o caminho de download preservando as verificações de registro, tamanho e checksum. A existência do arquivo foi conferida; não foi refeito o hash de toda a malha nesta revisão.

### 3. P2 — A tabela do Censo omite a parcela não discriminada

`apps/web/components/municipality-context.tsx:18–24` renderiza somente `categories` e a linha total. Os campos contratuais `undistributed` e `roundingDifference`, calculados pelo importador, não são usados pela web.

Na publicação local, **1.277 municípios** têm `race.undistributed > 0`. Em Abreu e Lima/PE (TSE `26310`), o total é **98.462**, as cinco categorias somam **96.959**, e **1.503** pessoas ficam em `undistributed`. A tabela não apresenta essa diferença, embora termine em 100%. O importador e a documentação já registram que ela não deve ser redistribuída nem ter a causa presumida.

**Falta:** mostrar a parcela não discriminada com contagem e denominador, e explicar separadamente diferenças de arredondamento da amostra. Testar a apresentação com os dois casos. Também corrigir o total percentual quando o denominador for zero: o componente hoje escreve 100% para qualquer total não nulo.

### 4. P2 — Relatório no código carregado por `tsx` entrega objeto interno

Pendência já registrada no §25 de `plan.md`, reproduzida em uma instância HTTP temporária da API carregada por `tsx/cjs`, com a configuração TypeScript da API. A rota `apps/api/src/elections/elections.controller.ts:485–495` devolve HTTP 200, mas o JSON tem as chaves `options`, `stream` e `logger`, em vez do relatório.

Comparação com o relatório nacional `0a095fc5…`:

| Execução | Corpo recebido |
| --- | --- |
| Código TypeScript via `tsx/cjs` | Objeto interno, 575 caracteres |
| Código compilado em `dist/` | Relatório com `dataset`, `coverage`, `checks`, `persistedVerification` e demais campos |

O original em disco tem 1.129.599 bytes. A versão compilada entregou o conteúdo do relatório; a causa da diferença de tratamento de `StreamableFile` não foi isolada nesta revisão.

**Falta:** corrigir o caminho de desenvolvimento e testar conteúdo e cabeçalhos do download, além do status HTTP. Verificar também o download de originais nesse modo, pois retorna a mesma classe.

## Lacunas de engenharia

1. **Verificação de interface reproduzível.** O compromisso em `docs/plano-ux-formularios.md:110` continua aberto: não há `check:ui`, dependências de navegador/axe no projeto ou roteiro automatizado de envio real dos formulários. Os testes de navegação atuais verificam funções e HTML; isso não substitui hidratação, teclado e submissão no navegador. O defeito de envio registrado no §25 demonstra essa lacuna. Não há workflow de CI versionado em `.github`; acrescentá-lo pode aproveitar os comandos já existentes.
2. **Dependências de publicações derivadas.** `turnout-profiles.ts:69` usa no identificador apenas versão e checksum do arquivo, embora persista `resultsEligible` dos resultados e confira marginais do contexto. O retorno idempotente ocorre antes de ler essas dependências. Após uma nova publicação de resultados, repetir o comando pode manter o comparador antigo. Falta registrar e incluir os lotes de entrada na identidade. A consulta de sensibilidade também não verifica se o lote de grupos usado em sua geração ainda é o publicado: compara apenas `results_batch`. Uma atualização de perfil/grupos com os mesmos resultados pode deixar a comparação usando gerações diferentes. **Risco para futuras atualizações:** não se encontrou dependência antiga nas publicações atuais que registram `inputs`.
3. **Relatório e recuperação após a publicação.** Há importadores que fazem `COMMIT` e só depois gravam `data/audit/<id>.json` (`place-groups.ts:108–110`, `tract-demography.ts:139–142`, entre outros). Se a gravação falhar, os dados já estarão publicados e uma reexecução poderá sair em “Já publicado” sem reparar o relatório. Falta um protocolo de preparação/recuperação que confira a presença do artefato. Esta é uma análise do caminho de falha; não foi simulada falha em disco nem alterado um lote real.
4. **Manutenção do vocabulário e dos planos.** `responsible_with_income` permanece com o nome impreciso já reconhecido no §25; o dicionário distingue responsáveis totais de responsáveis com rendimento. O comentário do endpoint de grupos ainda descreve quintis. O plano IBGE conserva frases históricas como “Nada importado ainda” e “Pendente: tooltip/mapa de candidaturas”, resolvidas nas seções posteriores. Falta uma lista atual de estado e pendências para evitar repetir trabalho.

Mudanças de regra ou identidade dos importadores devem receber versão nova, preservando as publicações anteriores.

## Pendências de produto e operação

| Pendência | Estado e próximo passo |
| --- | --- |
| Leitor de tela real e Chrome/Safari | Continuam sem verificação registrada. A acessibilidade do autocomplete ainda depende dessa conferência. Zoom de texto, alto contraste real e medição formal de CLS também não estão concluídos. |
| Página longa de resultados por UF | O §19 ainda pede revisão. A página inicial continua repetindo quadros de participação e candidaturas por município; falta definir e verificar uma apresentação mais compacta. |
| Hospedagem e produção | Análise existe; escolha e publicação externa não foram autorizadas. Faltam configuração de produção, HTTPS, backup automatizado com restauração testada, observabilidade e carga no ambiente escolhido. |
| Limpeza de armazenamento | Adiada por Rafael. Fazer inventário e plano de retenção antes de remover staging, dumps ou versões; preservar originais e publicações. Nenhum arquivo de dados foi removido nesta revisão. |
| Suplementar de Governador de RR | Continua excluída de forma declarada. Exige decisão sobre recorte próprio, ano, turnos e apresentação; não é carga automaticamente autorizada. |
| Precisão das estimativas do Censo | A interface identifica amostra e a metodologia informa o erro, mas não há campo de precisão/CV nos contratos. A proposta do plano é mostrar precisão quando disponível; antes é preciso auditar disponibilidade e compatibilidade territorial, sem inventar indicador. |
| Decisões antigas de projeto | Prisma, licença e nome definitivo seguem sem decisão explícita no plano. O uso de `pg` funciona e não torna Prisma uma implementação obrigatória. |

Não são lacunas a preencher automaticamente: deputados (retirados do escopo), cor/raça do eleitorado de 2022 (ausente na fonte), participação por perfil do DF/exterior (ausente na fonte), coordenadas faltantes e renda individual dos eleitores. As ausências devem continuar declaradas.

## O que já foi concluído

Conferido no código e nas versões publicadas: Governador e Senador nas 27 UFs; contexto municipal; associação local → setor; perfil por local; faixas fixas da métrica E; moradores por faixa de renda; participação com estado civil e cruzamento municipal; demografia por setor; sensibilidade a 250 m, 500 m e 1 km; mapas por candidatura e dica própria nos mapas. Não confundir pendências de registros antigos com o estado atual.

## Verificação e limites

- `npm run typecheck`: passou.
- `npm test`: **66 testes**, todos passaram (19 API, 23 importador, 16 web, 8 contratos). A primeira tentativa foi impedida pelos sockets da sandbox; a execução autorizada fora dela passou.
- `npm run build`: passou fora da sandbox. Dentro dela, o Next falhou ao interpretar a saída de `tsc --showConfig`; a repetição fora da restrição completou o build, sem alteração no código.
- Reproduções dos filtros de ano contra o banco local, por métodos do controlador e por HTTP, inclusive na API compilada.
- Consultas PostgreSQL com `default_transaction_read_only=on`; conferência das parcelas não discriminadas e dos metadados das publicações. Nenhum lote publicado com metadados `pending`/`failureReason` foi encontrado. Isso não equivale a uma nova reconciliação integral das fontes.
- Instâncias HTTP temporárias encerradas. API e web estavam desligadas no início; não foi deixado servidor adicional em execução.
- Não foram repetidos os nove smokes completos, importações, auditoria integral dos votos, revisão visual ou testes com tecnologia assistiva. O banco permaneceu em execução.

Ordem sugerida: corrigir o isolamento por ano; completar transparência (GeoPackage, parcela não discriminada, relatório em desenvolvimento); incorporar regressões e verificação de interface; fortalecer dependências/recuperação dos derivados; então tratar apresentação e operação conforme as decisões de Rafael.
