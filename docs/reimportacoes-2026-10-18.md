# Reimportações com proveniência — 18–19/10/2026

As nove versões estão publicadas no banco local e aprovadas na auditoria integral e na reexecução idempotente. São os mesmos recortes de 2022 e os mesmos originais; os números derivados permaneceram idênticos. Os nove smokes e as 31 regressões HTTP também passaram. Chrome e Firefox também passaram nas verificações automáticas de acessibilidade/refluxo. Serviços temporários encerrados; somente PostgreSQL permanece ativo. Nenhuma implantação ou contratação externa.

## Versões efetivas

| Importador | ID publicado | Entradas registradas |
| --- | --- | --- |
| `municipal-context-2022-v3` | `da32406274afeed55caff689012aa4d0f2b14c341fd894634694196994b1629f` | 1 |
| `maps-ibge-2022-v3` | `feb856a5d08780ec663434fbd58aa4e92dac366e73f0ce4b10349acff14453b9` | 1 |
| `polling-place-tracts-2022-v3` | `419c7a552aac156543f018534d0e50a4d1a112490cb9aa690a79563be7525701` | 1 |
| `place-profiles-2022-v2` | `b1a30fc0b3372d09932f6ca2dbabb0eb07c1f1dbaedbc2345eeeb805c65fe82a` | 2 |
| `income-bands-2022-v2` | `8ba070d67d970b01040d3d34c6686c84ea28c21f9dcf3ff409af9bcfd265b5c6` | 1 |
| `turnout-profiles-2022-v3` | `513bad2dadcac0a1acac917807fb430934dbabfadefa7f15b5d86dc19a6356ad` | 2 |
| `tract-demography-2022-v2` | `2511fb706a7b8933842cdecd268cab9a0851ae144eb648ef95df302828099bc9` | 1 |
| `place-groups-2022-v5` | `5f84239f8dbaf09cb6910fa88f9c9a173d303fa5d3ea21e656b32eb733d7ab00` | 57 |
| `tract-sensitivity-2022-v2` | `2ea3ae5ff4a63e7c14aea038cc345c621305c4fd24d133f80ca0ce6d57a154c2` | 58 |

Todas as entradas apontam para as publicações atuais. Grupos usam 55 publicações eleitorais, perfil por local e associação aos setores; sensibilidade acrescenta a publicação dos grupos. Não houve importação de cargo/ano novo, deputados ou suplementar. Mapas e setores aprovados na primeira tentativa foram reaproveitados na retomada.

## Proteção e execução

- Backup completo: `data/backups/observatorio-2026-10-18-antes-reimportacoes.dump`, **338.203.963 bytes**, SHA-256 `2ff2e73bb63e793881fa363e65daaf518aaf310cd719b9058dc79f5ba70a064e`. `pg_dump` terminou com sucesso; `pg_restore --list` leu o catálogo de 117 linhas. Checksum reconferido na retomada. Não foi ensaiada uma restauração completa.
- Baseline anterior às cargas: `data/analysis/reimports-2026-10-18/baseline.json`, capturada em transação READ ONLY/REPEATABLE READ: IDs/metadados de todas as publicações e hashes de **303.875 linhas em 11 tabelas**. Cada linha é serializada como JSONB excluindo somente `batch_id`; hashes de linhas ordenados antes do hash agregado, sem depender da ordem física.
- Tentativa 1: contexto v2, mapas v3 e setores v3 aprovados. Na revisão, confirmado erro preexistente no **contador da auditoria do contexto**: `rowsSelected` incluía 36.910 registros de ZZ, apesar de esses registros já serem excluídos corretamente dos agregados municipais. Quantidade e SG_UF conferidos diretamente no CSV Latin-1 preservado. Não foi falha nova da fonte nem diferença nos números municipais.
- Contexto passou à **v3**, preservando integralmente a v2 e seu relatório. Perfil por local da tentativa 1 interrompido antes de gravar qualquer lote, para receber a dependência v3. Tentativa 2 interrompida por pedido expresso de Rafael às 00h20 de 19/10, também sem lote v3 ou perfil v2 parcial; consulta de encerramento em `stopped-state.json`.
- Retomada autorizada às 09h27 de 19/10, após conferir Git, publicações, ausência de concorrência, banco saudável e 67 GB livres. Tentativa 3 sequencial: contexto → mapas → setores → perfil por local → renda → participação → demografia → grupos → sensibilidade. Início: `2026-10-19T09:27:31-03:00`; fim: `2026-10-19T11:39:08-03:00`. Logs/coordenador e manifesto em `attempt-3/`; tentativas anteriores preservadas.

Contexto v3: **4.362.480 linhas lidas, 4.325.570 selecionadas e 36.910 de ZZ excluídas**. Cobertura de 5.570 municípios e 155.756.933 eleitores no cadastro municipal. Perfil v2: 93.291 locais, mesmo total de eleitores; os 262 locais com resultados sem perfil continuam declarados, sem preenchimento. Participação v3: 5.569 municípios nas 26 UFs presentes na fonte; DF permanece indisponível, não zero. Grupos: 732 recortes; sensibilidade: 366.

## Correções operacionais e testes acrescentados

As correções da revisão anterior, pesquisa da listagem municipal e matriz dos demais testes permanecem em [Correções e verificação](correcoes-verificacao-2026-10-18.md). Nesta execução:

| Verificação | Problema/efeitos cobertos | Efeitos da execução |
| --- | --- | --- |
| Consulta finita de categorias do TSE | Evita normalizar repetidamente todas as faixas em milhões de linhas; mesmas categorias, acentos/espaços, erros e isolamento dos objetos retornados. | Função pura e fixtures; sem cache de entradas arbitrárias. Medição local de 200 mil consultas: 4.939 → 684 ms, resultados iguais; não é previsão da importação inteira. |
| Metadados completos do relatório | Mesmo ID não encobre relatório incompleto, entradas diferentes ou cobertura divergente. | Arquivos sintéticos em diretórios temporários próprios, removidos ao final. |
| Reaproveitamento transacional (`reusePublished`) | Confere lote publicado, escopo, entradas e relatório sob locks compartilhados; lote anterior despublicado não pode ser regravado. Contexto/setores/perfil verificam a identidade antes da leitura pesada. | Testes unitários com cliente SQL simulado; integrações com tabelas TEMP isoladas e arquivos temporários. |
| Contador do contexto | Regressão reproduzida no lote v2; desconto independente das linhas do CSV de ZZ na v3. | `check:data` lê o ZIP preservado, confere SG_UF e contador; nenhum arquivo original ou dado é alterado. Rejeição anterior em `counter-regression-before-v3.log`. |
| Comparação integral | Conteúdo científico, fontes, versões atuais, entradas, relatório, dados/metadados antigos e publicações eleitorais. | Somente SELECT em READ ONLY/REPEATABLE READ; cria relatório local com `wx`, sem sobrescrever baseline/resultado. Leitura completa e CPU para hashes. |
| Controle negativo | Hash adulterado deve ser recusado sem relatório de sucesso. | Alterada apenas uma cópia temporária da baseline, depois removida; banco e baseline real intactos. Registro em `negative-control.json`. |
| Idempotência real | As nove importações devem reconhecer o mesmo ID e preservar todos os lotes, registros de originais e relatórios. | Executa os importadores com limite/parada segura; DDL idempotente e inserções `ON CONFLICT DO NOTHING` podem ocorrer. Comparação observada confirmou estado intacto. Não declarar esses comandos somente de leitura. |

O relatório é preparado por arquivo temporário e renomeação antes da troca pública; falha de escrita impede a publicação. Entradas são reconferidas sob lock no fim da carga. O teste SQL de publicação usa tabela TEMP que sombreia `import_batches` apenas na própria conexão, faz rollback da troca simulada, remove temporários e confere IDs/flags públicos intactos. Reexecução centralizada não regrava lotes históricos nem declara sucesso com relatório ausente/inconsistente.

## Evidências finais

Artefatos em `data/analysis/reimports-2026-10-18/` (dados locais fora do Git):

- `comparison.json` e `comparison-after-idempotence.json`: ambos **`complete: true`**, nove versões e 11 tabelas com contagens/hashes idênticos à baseline, versões antigas preservadas e **57 publicações eleitorais intactas**. As comparações parciais anteriores continuam como histórico, não evidência de conclusão.
- `final-data.log`: **163 respostas SIDRA** conferidas célula a célula e por hash, 5.570 contextos válidos, 11.140 comparadores eleitorais do contexto e 11.138 da participação; nenhum derivado sem entradas registradas. As diferenças de cor ou raça de 1.277 municípios continuam iguais aos originais; causa não presumida, valores não redistribuídos.
- `intermediate-context-v2-baseline.json` e `intermediate-context-v2-preserved.json`: metadados completos, hashes das duas tabelas e SHA-256 do relatório da v2 intermediária preservados; somente o flag deixou de ser publicado. Verificador salvo em `verify-intermediate-context.mjs`.
- `idempotence/progress.json`: nove reexecuções com código zero e mensagem do mesmo ID. `idempotence-state-verified.json`: **116 lotes**, **286 registros de originais** e bytes dos **nove relatórios** intactos, comparando todas as colunas. Estado anterior em `idempotence-state-before.json`; verificador salvo em `check-idempotence-state.mjs`.
- `code-checks.json` e `final-{tests,typecheck,build}.log`: **86 testes** (API 25, importador 31, web 22, contratos 8), tipos e build aprovados em 19/10. Os logs temporários anteriores haviam sido limpos na reinicialização; estas evidências são duráveis.
- `http-checks.json` e `final-smoke*.log`: **nove smokes aprovados**, incluindo comparação de todos os municípios/dois turnos no resumo, Governador/Senador nas 27 UFs, contexto e fontes. `final-check-regressions.log`: **31 regressões HTTP aprovadas**, incluindo bytes/cabeçalhos dos relatórios no modo de desenvolvimento e GeoPackage real na API/proxy, com cancelamento do download.
- `final-publication.log`: integração SQL isolada novamente aprovada. Somente tabelas TEMP/arquivos de teste; publicações reais intactas.
- `final-ui/report.json`: Chrome 151.0.7922.71 e Firefox 158.0; controle positivo do axe e **30 avaliações por navegador** (10 páginas × 1280/375/320 px), sem violações ou rolagem horizontal fora das tabelas. Capturas locais em `final-ui/`. Rodada restrita a `Controle positivo|Acessibilidade`; envios com/sem JavaScript e teclado já conferidos em 18/10 não foram repetidos nesta rodada.
- `final-services.json` e `final-database-state.json`: API/web encerradas, portas 3000/3001 livres, nenhuma importação/build restante ou outro cliente PostgreSQL; somente banco saudável em 5432, 116 lotes e 66 publicações.

A web compilada foi exercitada pelo script local `start`: respondeu aos testes, mas o Next emitiu o aviso de que a saída `standalone` deve usar seu servidor Node. O Dockerfile já copia essa saída e os estáticos e executa `node apps/web/server.js`; essa configuração foi lida, sem reconstruir ou iniciar o contêiner nesta rodada. Não se declara validada a operação de hospedagem por esses testes locais.

## Comandos para conferência futura

```sh
npm run check:reimports -- verify data/analysis/reimports-2026-10-18/baseline.json CAMINHO_NOVO.json
npm run check:data
npm run check:publication
```

Use caminho de relatório novo: a criação exclusiva impede sobrescrever evidências. Para comprovar conclusão, omitir escopos parciais e exigir `complete: true`. Não trocar IDs, apagar versões ou reescrever relatórios para fazer uma comparação passar. As fontes e as versões antigas permanecem preservadas.

## Estado ao encerrar

Revisão final concluída sem bloqueio novo para o commit. API/web/navegadores temporários encerrados, portas 3000/3001 livres e nenhuma importação/build ativa; somente PostgreSQL permanece saudável. Mudanças locais ainda sem commit, descritas em `plan.md`; dados/backup/evidências em `data/` ficam fora do Git. Hospedagem continua por último. Permanecem as verificações manuais de leitor de tela, Safari e dispositivos reais, a limpeza de armazenamento, a suplementar de RR e o nome impreciso `responsible_with_income`, sem uso na interface. Sem nova decisão de escopo ou implantação.
