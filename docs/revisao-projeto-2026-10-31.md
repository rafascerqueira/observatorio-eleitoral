# Revisão do projeto — 31/10/2026

Revisão solicitada por Rafael, sobre o commit `c18152a`, com a árvore de trabalho inicialmente limpa. Foram examinados os princípios e o histórico do projeto, os contratos, as rotas da API, os importadores e a publicação, os formulários, as visualizações, a operação local e as verificações existentes. A análise distingue defeitos reproduzidos, falhas de proteção contra entradas inconsistentes e uma limitação metodológica. Não é uma certificação de ausência de outros problemas.

Há **nove achados prioritários: dois P1 e sete P2**. P1 indica correção prioritária antes de exposição externa ou da próxima publicação afetada; P2 indica defeito a corrigir no fluxo correspondente. Os números conferidos nesta revisão não apresentaram divergências; os achados de importação descrevem caminhos que ainda permitem aceitar ou expor um estado inconsistente.

1. **[P1] A API mantém habilitado um parser de corpo com vulnerabilidade de negação de serviço.**

   O lockfile instala `body-parser@2.3.0`, por `express@5.2.1`. A criação padrão da aplicação Nest em [app.ts:21](../apps/api/src/app.ts#L21) registra os parsers; restringir os métodos no CORS não os desabilita. Um POST com JSON malformado para `/health/live`, que só tem GET, respondeu 400 antes de chegar à rejeição da rota: o processamento de corpo está alcançável. O [aviso dos mantenedores](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828), publicado em 22/10, descreve encerramento do processo com um corpo comprimido e bytes excedentes, inclusive sem rota correspondente. A versão corrigida é 2.4.0.

   Corrigir a dependência e repetir os testes; como a API só oferece leitura e não usa corpos, também cabe desabilitar esse processamento na criação da aplicação. A configuração afetada foi confirmada; não foi provocado um encerramento do servidor real. A exposição atual continua local, em loopback.

   `npm audit`, com e sem dependências de desenvolvimento, identificou quatro pacotes: três classificados como altos (`body-parser`, `multer`, `@nestjs/platform-express`, este último pelo `multer`) e um moderado (`qs`). São três avisos distintos. O [aviso do multer](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m) exige upload com `fileFilter` assíncrono, caminho que não foi encontrado no projeto. O [aviso do qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) exige `stringify` com `arrayFormat: 'comma'`, também não encontrado. Esses dois alertas não foram tratados como explorações demonstradas da aplicação.

2. **[P1] As células dos mapas do Censo são preparadas depois da troca pública, e uma preparação parcial pode ser aceita.**

   Em [census-indicators.ts:279](../apps/importer/src/census-indicators.ts#L279), `preparePublication` ativa o lote, e o COMMIT ocorre antes de `cellsFor(id)`. Uma interrupção ou falha nessa etapa já deixa a nova publicação ativa e a anterior desativada. Além disso, [cellsFor:249](../apps/importer/src/census-indicators.ts#L249) considera o trabalho concluído se encontrar uma única célula do lote, sem conferir os demais temas e municípios. A API só rejeita o conjunto principal quando ele está inteiramente vazio ([elections.controller.ts:323](../apps/api/src/elections/elections.controller.ts#L323)).

   Reprodução isolada, com banco simulado: a consulta de um indicador para SP recebeu uma única célula municipal e respondeu `status: published`, com um item. Portanto, a proteção não distingue cobertura parcial de cobertura completa; na visão por UF, isso pode produzir uma soma parcial apresentada como resultado publicado. As 245.080 células da publicação atual foram comparadas com os registros de origem e estão completas e iguais.

   Gerar as células e conferir a cobertura de todos os temas e recortes antes da troca pública, na mesma transação. A retomada deve conferir completude, e a API deve recusar cobertura incompleta. A migração 022 já lê as linhas por lote, sem depender de `published`, o que permite antecipar essa preparação.

3. **[P2] O leitor dos agregados por setor sobrescreve duplicatas conflitantes.**

   [tractValues, sectors.ts:94](../apps/importer/src/sectors.ts#L94) faz `values.set(setor, ...)` sem verificar se o código já apareceu. A associação local → setor usa o resultado para gravar renda e população do setor. As demais verificações não recuperam a linha que foi sobrescrita.

   Teste com ZIP **sintético**, criado e removido em `/tmp`: duas linhas do mesmo setor, com medianas de teste de 1.212 e 6.000, produziram um único registro com 6.000, sem erro. Isso permite alterar a faixa de renda por ordem das linhas, contrariando a regra de bloquear duplicatas e conflitos. Não foi identificada por esse teste uma duplicata nos originais reais.

   Recusar a segunda ocorrência de um setor antes de preencher o Map; caso a fonte permita múltiplas linhas por setor, auditar e declarar essa estrutura e a regra de combinação. Acrescentar uma verificação específica para duplicatas conflitantes.

4. **[P2] A adjudicação da rubrica e da bússola conserva a última decisão humana quando há duplicatas conflitantes.**

   [rubric-core.ts:253](../apps/importer/src/rubric-core.ts#L253) transforma a planilha de decisões em Map sem validar unicidade de documento × critério. A validação posterior recebe apenas a decisão conservada, por isso não detecta a contradição original. O mesmo consolidador é usado pela bússola.

   Reprodução com planilhas **sintéticas** completas: A e B passam na validação; duas decisões para o critério `publico`, uma `declarado` e outra `nao-localizado`, resultam em `problems: []`, codificação final válida e valor `nao-localizado`, da última linha. A ordem da planilha passa a decidir o resultado sem uma resolução humana explícita do conflito.

   Validar chaves repetidas e desconhecidas da adjudicação antes de consolidar, exigindo uma única decisão para cada divergência. Fazer essa proteção antes das primeiras codificações reais; nenhuma rubrica nem bússola foi publicada nesta revisão.

5. **[P2] A troca automática do turno deixa o campo “Comparar com” consultando o turno anterior.**

   [RoundField:28](../apps/web/components/round-field.tsx#L28) remonta os radios com o 1º turno quando o recorte não tem 2º, mas não sincroniza essa mudança com os demais consumidores de `useFormSelection`. `SeriesField` usa a seleção capturada no evento original da troca de UF, antes da remontagem.

   Reprodução em Chrome 151 e Firefox 158: abrir `/mapa?year=2026&office=governor&uf=ES&round=2` e trocar a UF para SP. O formulário passa a ter `round=1`, mas a requisição é `/mapa/comparacoes?office=governor&round=2&year=2026&uf=SP`. O campo oferece só abstenção e afirma que o turno não foi realizado, embora o 1º turno já esteja selecionado. As candidaturas do recorte correto não podem ser escolhidas nesse estado.

   Compartilhar uma seleção efetiva entre os campos, incluindo a normalização automática do turno, ou emitir a mudança do radio de forma que todos os consumidores a leiam. O cenário precisa incluir a troca de uma UF com dois turnos para outra com um só; o teste existente cobre a troca manual entre turnos disponíveis.

6. **[P2] O detalhe municipal de 2026 perde também os indicadores do Censo 2022.**

   A condição em [elections.controller.ts:438](../apps/api/src/elections/elections.controller.ts#L438) retorna `awaiting-import` para todo pedido de contexto com `year=2026`, antes de ler os indicadores do Censo. O detalhe municipal envia o ano da eleição a essa rota. Isso impede consultar ali o contexto territorial definido como comum aos dois anos no README e no resumo vigente do plano.

   Reprodução HTTP em São Paulo: a mesma rota com `year=2022` responde `published` com `censusIndicators`; com `year=2026`, responde `awaiting-import`. A página `/municipios/71072?uf=SP&year=2026` exibe “Contexto municipal ainda sem publicação para este ano”. Os indicadores aparecem normalmente nos mapas de 2026, criando uma diferença entre as páginas.

   Separar os dados territoriais do IBGE dos perfis e comparadores do TSE vinculados à eleição. Reutilizar os indicadores do Censo com o ano de referência explícito, preservando a indisponibilidade de perfis que não existam e a ausência de contexto para municípios criados depois do Censo. Simplesmente remover a condição e devolver todo o bloco de 2022 pode misturar comparadores eleitorais de anos diferentes.

7. **[P2] O “desvio máximo” de 15+ para 16+ usa uma proporção de outra população de referência.**

   A identidade matemática descrita no plano é válida quando `s` é a fração de pessoas de 15 anos **na mesma base do indicador**: `p15+ = (1 − s) × p16+ + s × q`, com `0 ≤ q ≤ 1`. O projeto usa em todos os casos `age15 / age15plus` da população total do universo, SIDRA 9606. [O mapa:112](../apps/web/app/mapa/page.tsx#L112) e o painel municipal apresentam essa fração como limite garantido também para estimativas da amostra e para moradores em domicílios particulares permanentes ocupados.

   Esses recortes não têm necessariamente a mesma composição etária. Na conferência do banco, o total de 15+ da religião difere do total de 15+ do universo em 725 municípios; internet e moradia ainda usam uma população domiciliar própria, como a auditoria das fontes já declara. Usar denominadores corretos nos indicadores não torna a proporção etária do universo um limite demonstrado para essas outras bases. Não há, nesta revisão, uma medida do erro efetivo das parcelas de 16+ indisponíveis nas fontes.

   Manter o limite exato onde a base seja compatível. Nas demais tabelas, tratar a fração do universo como referência contextual, com a limitação explícita, ou obter uma justificativa e um limite próprios da mesma população e dos pesos da tabela. Não estimar nem reponderar números para preencher a informação ausente.

8. **[P2] O relatório do piloto publicado de São Paulo não é servido pela rota pública.**

   O piloto `2022/president/SP/71072`, ID `286a86a00e4b135be9f731c910c3ad48deca951dd0483ee72dbe9bb561754da4`, continua publicado no catálogo. [import.ts:69](../apps/importer/src/import.ts#L69) grava `data/audit/sao-paulo-2022.json`; a API procura `<id>.json`. A consulta `/elections/imports/<id>/report` respondeu 404. O arquivo com o nome antigo existe e contém esse mesmo ID, portanto o achado é uma incompatibilidade de nome e acesso, sem evidência de perda do relatório.

   Compatibilizar o relatório antigo com a rota e padronizar a gravação por ID, preservando o artefato histórico e seus metadados. Conferir a existência e a identidade do relatório também no retorno “já publicado” dos importadores de resultados. A auditoria adicional examinou os 132 lotes publicados; os outros 131 relatórios encontrados têm o mesmo dataset dos metadados do banco.

9. **[P2] O link do consolidado de 2026 para o exterior abre os dados de 2022.**

   Em [page.tsx:139](../apps/web/app/page.tsx#L139), “Consultar somente o exterior” monta `/exterior?round=...` sem `year`. A página do exterior assume 2022 quando o parâmetro está ausente. Os links para localidades do exterior nos casos de seções não instaladas também omitem o ano, na linha 160.

   Reprodução por GET na aplicação compilada: abrir `/?year=2026`, seguir o link `/exterior?round=1` e conferir o seletor do destino: 2022. A navegação deixa de ser um detalhamento do consolidado que a pessoa estava consultando e passa a mostrar outra eleição. No mesmo aviso, a contagem fixa de 5.570 municípios continua aparecendo em 2026, que tem 5.571 na publicação.

   Preservar o ano nos links que detalham o resultado atual e ler a contagem de municípios do consolidado recebido. Acrescentar uma verificação de navegação que comece no consolidado de 2026 e confirme ano, turno e publicação no destino.

**Ajustes menores de transparência e documentação.**

- A legenda da tabela de `/participacao?year=2026` continua dizendo “comparecimento e abstenção 2022” ([page.tsx:115](../apps/web/app/participacao/page.tsx#L115)); as definições do perfil por local em `PLACE_GROUP_INDICATORS` também fixam 2022 na fonte. Usar o ano do recorte nos rótulos do TSE e manter 2022 nas referências do IBGE.
- O catálogo só inclui os metadados detalhados da métrica E de 2022 em `placeGroupsImport` ([controller:676](../apps/api/src/elections/elections.controller.ts#L676)). A publicação `2026/places/groups` existe e aparece entre os IDs das importações, mas seus metadados não têm representação equivalente. Expor as publicações de grupos por ano e identificar a publicação na resposta de grupos melhora a rastreabilidade do recorte consultado.
- `docs/api.md` ainda documenta `literacy-15`, os indicadores `urban-*` e o envio de entorno no contexto e nos setores, removidos da interface e dessas respostas, além de um exemplo que trata 2026 como não publicado. Atualizar o contrato documentado junto das alterações de comportamento.

**Verificação e limites.**

Ambiente: Node 24.21.0; Next 16.4.2; PostgreSQL local existente; Chrome 151.0.7922.71 e Firefox 158.0.1 na reprodução do formulário. Nenhuma importação foi iniciada. As consultas adicionais ao banco usaram transação `READ ONLY` com visão consistente. `check:publication` utiliza apenas tabelas temporárias que sombreiam a tabela pública e confere a preservação dos IDs e flags reais.

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado |
| `npm test` | 155 aprovados: API 30, importador 66, web 41, contratos 18 |
| `npm run build` | Aprovado fora do sandbox; dentro dele, o subprocesso TypeScript retornou saída vazia |
| `npm run check:data` | Aprovado: 5.570 municípios; células das seis tabelas municipais e hashes de 163 consultas SIDRA; comparadores eleitorais do contexto e da participação |
| Auditoria adicional das publicações | 132 publicações e suas dependências declaradas inventariadas; 996 originais localizados, com os tamanhos informados nos metadados conferidos; 131 relatórios com dataset igual ao banco; incompatibilidade de nome do relatório do piloto registrada acima |
| Células derivadas do Censo | 245.080 células, 44 temas/recortes, 5.570 municípios: comparação integral com os registros de origem no banco, sem diferenças |
| HTTP adicional | 58 consultas de mapa (29 indicadores do Censo, Brasil por UF e SP por município) e 54 resultados estaduais de 2026: cobertura e identidades de votos/candidaturas aprovadas |
| `check:regressions` e `check:publication` | Aprovados |
| Smokes | Nove aprovados, incluindo o piloto; `smoke`, `smoke:places`, `smoke:exterior` e `smoke:context` tiveram timeout no desenvolvimento e passaram ao serem repetidos na aplicação compilada |
| Interface | `check:ui` aprovado em Chrome e Firefox: 11 cenários em cada, com 60 avaliações de acessibilidade/refluxo e seis com detalhes abertos por navegador (132 avaliações); reprodução adicional do achado 5 confirmada nos dois |
| Auditoria npm | Quatro pacotes afetados, três avisos distintos; alcance descrito no achado 1 |

Os testes sintéticos verificaram duplicatas no agregado por setor, cobertura parcial na API e decisões duplicadas na adjudicação; esses dados de teste ficaram apenas em `/tmp`. A análise metodológica do desvio é separada das conferências numéricas: nenhuma alteração nos dados ou nas publicações foi feita para contorná-la.

Não foram executadas novas cargas extensas, comparação integral de todos os votos por seção com todos os ZIPs de ambos os anos, restauração de backup, ensaio de carga externa, leitor de tela humano, Safari nem dispositivos reais. Os testes automáticos não certificam toda a acessibilidade. As correções de código e dependências ficam pendentes; esta entrega é uma revisão.

**Correções (02/11/2026).** Os nove achados e os ajustes menores foram corrigidos e verificados; o que mudou em cada um, as diferenças de comportamento e a verificação estão no §69 do `plan.md`. Este relatório fica como registro do estado revisado em 31/10.
