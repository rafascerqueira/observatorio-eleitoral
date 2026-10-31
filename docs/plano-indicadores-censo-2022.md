# Plano — indicadores do Censo 2022 refeitos pela idade de voto

Registro de **31/10/2026**, preparado por Claude Code a partir da conversa com Rafael sobre os indicadores do Censo em `/mapa` e no painel do município. É um plano para execução fase a fase: **nada foi importado nem alterado na aplicação**. As conferências abaixo foram feitas por leitura dos metadados da API de agregados do IBGE (catálogo e `/metadados` de cada tabela, consultados em 31/10/2026), dos originais já preservados em `data/raw` e do banco local, sem escrita.

## 1. Por que refazer

- **Desequilíbrio no mapa:** 8 dos 11 indicadores do Censo em `/mapa` são do entorno dos domicílios (“moradores em face de quadra com…”), que pouco dizem ao analista (§4).
- **Base de idade desalinhada do voto:** alfabetização e demografia por setor usam pessoas de 15 anos ou mais; o voto começa aos 16, é facultativo aos 16–17 e a partir dos 70, e obrigatório dos 18 aos 69.
- **Dimensões ausentes:** cor ou raça (já no banco, fora do mapa), religião, trabalho, internet e moradia, saneamento, urbano × rural, favelas, deficiência e migração.
- **Indicadores saturados ou ambíguos:** alfabetização de 15+ (93% no Brasil, concentrada nos idosos).

Catálogo do IBGE em 31/10/2026: 289 tabelas do Censo 2022 com recorte municipal; o projeto usa 6.

## 2. Decisões de Rafael (31/10/2026)

1. **Base de idade:** 16 anos ou mais sempre que a fonte permitir, com a separação entre voto obrigatório (18–69) e facultativo (16–17 e 70+) quando os cortes forem exatos. Quando a fonte agrupa 15–19 anos, base de 15 anos ou mais **com o desvio máximo declarado** (§3). Nenhuma estimativa nem reponderação pelo eleitorado.
2. **Cor ou raça:** as cinco categorias sempre separadas. Se alguma soma aparecer, ela se chama “pretas e pardas (soma de duas categorias do IBGE)”, com aviso de que não é uma cor ou raça única nem indica maioria de uma categoria. As fontes previstas trazem as categorias separadas; nenhuma soma é necessária.
3. **Religião e cor ou raça entram**, com a leitura ecológica explícita (“municípios em que…”, nunca “eleitores que…”) e a mesma escala para todas as candidaturas.
4. **Temas novos:** trabalho (desocupação e outros), internet e moradia, saneamento, urbano × rural, favelas e comunidades urbanas, deficiência e migração.
5. **Entorno dos domicílios sai de toda a interface** (mapa, painel do município, cartão do local). A publicação `urban-surroundings-2022-v1` fica no banco e em `/fontes` como registro, sem apagar dados.
6. **Deficiência como indicador de pessoas** (Censo), não de acessibilidade de ruas ou de seções. A acessibilidade das seções do TSE (`DS_SITU_SECAO_ACESSIBILIDADE`) e as rampas/calçadas do entorno ficam fora.

## 3. Regra de idade e desvio declarado

Prioridade de base, por indicador:

1. **16+ exata**, com 16–17, 18–69 e 70+ quando a fonte tem esses cortes.
2. **18+ exata**, com 18–69 e 70+, quando a fonte começa aos 18 (instrução).
3. **18–69 e 70+ exatas** nas taxas de trabalho que têm idade; **14+** (definição do IBGE) nas que não têm.
4. **15+ com desvio declarado** quando a fonte agrupa 15–19.
5. **Todos os moradores** quando a fonte não tem idade e o atributo é do domicílio (renda per capita).

**Desvio declarado.** Seja *s* a parcela de pessoas de 15 anos entre as de 15+. A parcela de um grupo entre as pessoas de 15+ difere da parcela entre as de 16+ em no máximo *s* × 100 pontos percentuais (p₁₅₊ = (1 − s)·p₁₆₊ + s·q, com 0 ≤ q ≤ 1). *s* vem da SIDRA 9514 (universo) por município e é exibido junto do indicador. Medido nos originais preservados (`data/raw/ibge/2022/sidra/sidra_age_*.json`):

| Recorte | 15 anos ÷ 15+ | 16–19 ÷ 16+ (o que a base 20+ deixaria de fora) |
| --- | --- | --- |
| Brasil | 1,73% | 7,22% |
| Mediana dos municípios | 1,76% | 7,29% |
| Máximo (IBGE 1400704, RR) | 4,95% | 17,72% |

Por isso 15+ fica mais perto do eleitorado que 20+. Nas tabelas da amostra, *s* vem do universo; o texto diz isso.

**Por que não reponderar.** Padronizar pelo perfil etário do eleitorado do TSE exigiria supor que as pessoas de 15 anos se parecem com as de 16–19 e misturar residência com domicílio eleitoral: seria um modelo, e o projeto não estima números.

## 4. Entorno dos domicílios: o que foi medido e por que sai

A pesquisa urbanística observa cada face de quadra (lado de quarteirão) nos setores escolhidos, quase todos urbanos, e o IBGE publica os moradores cujo domicílio fica numa face com cada item. Medido no banco local (`municipality_urban_surroundings`, 5.570 municípios):

- **Cobertura parcial:** 85,8% dos moradores do Brasil estão em setores pesquisados, mas a mediana municipal é 69%, 10% dos municípios ficam abaixo de 39% e 1.261 abaixo de 50%; o mapa comparava pedaços diferentes de cada município.
- **Saturação e piso:** iluminação 97,5% (mediana 98,3%); ponto de ônibus na própria face 8,8% (mediana 1,2%); via para bicicleta 1,9% (mediana 0%).
- **Defeito de denominador na exibição:** obstáculo e rampa só são observados onde há calçada. Os “não declarados” desses itens (27.777.543 moradores, 16,0%) são iguais a “sem calçada + não declarado” nos 5.570 municípios, mas `URBAN_INDICATORS` divide pelo total. Obstáculo: 65,2% exibido × 77,6% entre quem tem calçada; nos 487 municípios com menos de 50% de calçada, 31,2% × 81,9% (leitura invertida). Rampa: 15,2% × 18,1%. Os dados importados estão corretos; a fórmula de exibição não.

Com a retirada da interface (decisão 5), o defeito deixa de ser exibido. Se o entorno voltar um dia, a rampa e o obstáculo usam como base os moradores em face com calçada.

## 5. Indicadores

Publicação nova e separada, **`census-indicators-2022-v1`** (recorte `2022/context/census-indicators`), sem reescrever o contexto municipal v3 (que `/participacao`, os perfis e o painel continuam usando para população, idade e cadastro do TSE). Cada indicador guarda numerador e denominador por município. Na UF e no Brasil, somam-se numeradores e denominadores; médias e medianas nunca são agregadas (o valor da UF vem pronto da SIDRA).

No mapa, um seletor agrupado por tema, com a base no próprio nome. No painel do município, a distribuição completa de cada tema.

| Tema | No mapa | No painel | Tabela | Fonte | Base |
| --- | --- | --- | --- | --- | --- |
| Cor ou raça | branca, preta, parda, amarela, indígena (cada uma) | distribuição; 16–17, 18–69, 70+ | 9606 | universo | 16+ exata |
| Religião | católica, evangélicas, sem religião | todas as categorias; 70+ | 9537 | amostra | 15+ com desvio; 70+ exata |
| Idade | 16–17 e 70+ (voto facultativo por idade) | já existe | 9514 (no banco) | universo | 16+ exata |
| Escolaridade | superior completo; sem instrução e fundamental incompleto | quatro níveis; 18–69 e 70+ | 10061 | amostra | 18+ exata |
| Alfabetização | não alfabetizadas (substitui a de 15+) | 16–17, 18–64, 65+ (a fonte não corta em 70) | 9542 | universo | 16+ exata |
| Renda | até ½ salário mínimo per capita (mantido) | classes (já existe) | 10296 | amostra | todos os moradores |
| Trabalho | taxa de desocupação; ocupados que não contribuem para a previdência; ocupados na agropecuária; empregados no setor público | nível de ocupação; posição na ocupação; seção de atividade; classes do rendimento do trabalho | 10299; 10264; 10262; 10261; 10292 | amostra | 18–69 e 70+ exatas (10299); 14+ nas demais |
| Internet e moradia | em domicílio com internet; em domicílio alugado; mais de 3 moradores por dormitório | condição de ocupação; moradores por dormitório | 9942; 9938; 9940 | amostra (auditoria, §7) | 15+ com desvio; 70+ exata |
| Saneamento | ligação à rede geral de água; esgoto pela rede geral, pluvial ou fossa ligada à rede; lixo coletado | categorias completas; banheiro de uso exclusivo | 6894; 9397 (ou 7555); 9541 | universo | 15+ com desvio (idades da 6894 a conferir) |
| Urbano × rural | população urbana | 70+ | 10089 | universo | 15+ com desvio; 70+ exata |
| Favelas e comunidades urbanas | moradores em favelas e comunidades urbanas | número de favelas | 9884 ÷ 9514; 9883 | universo | 15+ com desvio |
| Deficiência | pessoas com deficiência | por tipo de dificuldade; 70+ separado | 10125; 10127 | amostra | 15+ com desvio; 70+ exata |
| Migração | não moravam no município 5 anos antes | tempo de residência (menos de 10 anos) | 10160; 10158 | amostra | 15+ com desvio; denominador a definir na auditoria |

Rótulos: os nomes literais da fonte, sem “informal”, “inadequado”, “precário”, “pobre” ou equivalentes. A desocupação do Censo não é comparável com a da PNAD Contínua, e a página diz isso. Amostra sempre identificada como estimativa.

Saem do mapa: os 8 indicadores do entorno e a alfabetização de 15+.

## 6. Fases

1. **Auditoria das tabelas, sem gravar no banco** (script descartável, consultas preservadas fora de `data/`):
   - células omitidas, “-”, “X” e “..” na amostra em municípios pequenos, distinguindo zero de ausência;
   - categorias somam o total; soma dos municípios = valor da UF (exata no universo; arredondamento registrado na amostra, como no contexto v3);
   - **16+ da 9606 = 16+ da 9514** (mesma fonte, trava);
   - universo ou amostra de cada tabela (as notas da SIDRA não respondem a consulta automática; conferir na documentação do IBGE);
   - cortes de idade da 6894 e da 10089 (variável “total”, não só quilombola);
   - denominador da migração: total da amostra por idade × universo;
   - municípios sem favela: zero na 9883 × ausência na 9884;
   - critério de deficiência nas notas do IBGE (grau de dificuldade);
   - tamanho dos originais e do banco medido e informado antes da carga.
2. **Importação `census-indicators-2022-v1`**, com as travas acima bloqueando a publicação.
3. **Interface:** seletor agrupado em `/mapa`, painel do município por tema, retirada do entorno (mapa, painel, cartão do local), `/metodologia` e `/fontes` atualizados, testes e smokes.
4. **Depois, se aprovado:** nova versão da demografia por setor (`tract-demography`) com 70+ exata no lugar de 60+, e situação urbana/rural e favela do setor para os perfis por local. Religião, trabalho, internet, deficiência e migração não existem por setor; ficam só no município.

5. **Pesquisa, depois de todas as fases implementadas** (pedido de Rafael, 31/10/2026): levantar as subdivisões de idade que o IBGE usa para adultos e idosos (grupos etários de referência das publicações do Censo 2022 e das tabelas da SIDRA, por exemplo a pessoa idosa a partir de 60 anos e as faixas de idade mais avançada) e confrontá-las com os cortes construídos aqui (16–17, 18–69, 70+ e as faixas do TSE em `AGE_GROUPS`). Objetivo: rever o que foi construído e o que pode melhorar, sem misturar os cortes das regras do voto com os de outras finalidades. Resultado registrado como estudo, para decisão; nenhuma mudança automática.

Cada fase começa com aviso de Rafael.

## 7. Auditoria da fase 1 — 31/10/2026

Somente leitura: 733 consultas à API de valores da SIDRA (`apisidra.ibge.gov.br/values`), 25 tabelas, por UF (municípios) e por UF agregada, gravadas fora de `data/`, sem falha; nada no banco. Conferências feitas contra as consultas da 9514 já preservadas pelo projeto e contra os agregados por setor (`agregados_setores_basico.zip`).

**Cobertura e símbolos.** Todas as tabelas trazem os 5.570 municípios, exceto as de favelas (656). O único símbolo encontrado é “-” (zero); nenhum “X”, “..” ou “...” em nível municipal, em nenhuma tabela.

**Universo × amostra, pelo comportamento dos dados.**

| Tabelas | Soma dos municípios = UF | Categorias = total | Leitura |
| --- | --- | --- | --- |
| 9606, 9542, 6894, 7555, 9397, 9541, 10089, 9884, 9883 | exata em todas as células | exata (cor ou raça: ver abaixo) | universo |
| 9537, 10061, 10299, 10264, 10262, 10261, 10292, 9942, 9938, 9940, 10125, 10127, 10160, 10158 | difere até 26 pessoas por célula | difere ±1 a 3 | amostra (arredondamento por célula) |

Internet e moradia (9942, 9938, 9940) são **amostra**: além do arredondamento, o total de moradores difere do universo (6894) em 4.460 municípios, até 12,8%.

**Travas e conferências.**
- 16+ da 9606 = 16+ da 9514 nos 5.570 municípios; total da 9606, da 10089, da 9542 (15+) e da 4714 = 9514.
- Cor ou raça: as cinco categorias somam menos que o total em 1.277 municípios (até 1.503 pessoas; em 16+, até 3,74%), o mesmo padrão da 9605 já publicado como “não discriminada”. Mantido assim, sem redistribuir.
- Posição na ocupação (10261): os oito grupos de primeiro nível somam o total (±3). “Empregado no setor público” **não inclui** militares nem empregados de empresas estatais, que são categorias próprias.
- **A amostra não fecha com o universo por idade:** 18+ da 10061 difere da 9514 em 5.456 municípios (mediana 0,22%, máximo 5,7%). Regra: indicador da amostra usa denominador da amostra, nunca do universo.
- **As tabelas da amostra compartilham os pesos:** 15+ da 9537 = 15+ da 10125 em 5.316 municípios, diferença máxima de 1 pessoa; 70+ da 10061 = 70+ da 10125, máximo 1. Assim, a migração (10160, sem total próprio) usa como denominador o 15+ de outra tabela da amostra (9537).
- **Favelas:** ausência na 9884/9883 corresponde a nenhum setor de favela nos agregados por setor em 4.913 dos 4.914 municípios ausentes; a soma dos municípios presentes é igual ao total de cada UF. **Divergência:** Peixe-Boi (PA, 1505601) tem um setor da favela “Portelinha Peixe-Boi” com 23 moradores nos agregados por setor e não aparece na 9884. Nos 656 presentes, a soma dos setores de favela iguala a 9884 em 629 (Brasil: 16.392.588 nos setores × 16.390.790 na 9884).
- Desvio declarado (15 anos ÷ 15+): mediana 1,76%, p99 3,40%, máximo 4,95%.

**Valores nacionais de conferência** (soma dos municípios; nenhum município fora): branca 43,85%, preta 10,91%, parda 44,26%, amarela 0,47%, indígena 0,50% (16+); católica 57,15%, evangélicas 26,45%, sem religião 9,20% (15+); superior completo 16,75% (18+); não alfabetizadas 7,09% (16+); desocupação 5,39% (18–69); ocupados não contribuintes 32,75%, na agropecuária 7,50%, empregados no setor público 12,59% (14+); internet 88,98%, alugado 19,97%, mais de 3 por dormitório 3,45%, rede geral de água 83,36%, esgoto pela rede ou fossa ligada 63,69%, lixo coletado 91,28%, população urbana 87,73% (15+); com deficiência 8,36% (15+) e 27,53% (70+); não moravam no município 5 anos antes 6,98% (15+, denominador do universo nesta conferência; na publicação, da amostra).

**Tamanho.** As respostas no formato padrão da SIDRA ocupam ~448 bytes por valor (a coleta da auditoria, 5,0 milhões de valores, somou 2,2 GB). A publicação precisa de ~540 valores por município (~3,0 milhões): ~1,35 GB de originais no formato padrão ou ~0,6 GB com `/f/c` (só códigos, os nomes resolvidos pelos metadados preservados de cada tabela). No banco, dezenas de MB. Hoje `data/raw/ibge/2022/sidra` tem 130 MB; disco com 70 GB livres.

**Decisões para a fase 2:** (1) tratamento de Peixe-Boi e da ausência nas tabelas de favelas; (2) o que entra em “setor público”; (3) formato dos originais.

## 8. Fase 2: importação `census-indicators-2022-v1` — 31/10/2026

Decisões de Rafael (31/10): seguir as três recomendações da auditoria (Peixe-Boi declarado como divergência e ausência conferida nas favelas; “setor público” com o rótulo literal da fonte; originais em `/f/c`).

- **Código:** `apps/importer/src/census-indicators.ts` (download, travas, publicação) e `census-indicators-model.ts` (especificação das 23 tabelas, recortes de idade, distribuições, favelas), migração `021-census-indicators.sql` (tabela `census_indicators`, um registro por município), contratos `CENSUS_THEMES`, `censusIndicatorsSchema` e `censusIndicatorsDatasetSchema`. `contextDistributionSchema` ganhou o campo opcional `slices` (recortes combinados; ausente = 1, como nas versões anteriores).
- **Publicação:** `1423098283d8f0539cb7992d96894bee46d7f72d2fa2ba48cdf263ffcd3b8142` (escopo `2022/context/census-indicators`, entrada: contexto municipal). 5.570 municípios; 647 consultas e 23 metadados preservados (670 originais, hard link e somente leitura; `data/raw/ibge/2022/sidra` 135 → 601 MB) e o arquivo básico por setor, já preservado. Tabela no banco: 46 MB. 162 s de execução com as consultas em cache.
- **Travas cumpridas:** soma dos municípios = UF exata nas 9 tabelas do universo; nas 14 da amostra, maior diferença de 26 pessoas por célula, dentro do limite. 16+ e população total da 9606 iguais ao contexto publicado nos 5.570 municípios; 15+ da 9542 = 9606; pesos comuns da amostra (9537 × 10125) com diferença máxima de 1 pessoa; favelas: 656 presentes, 4.913 sem favela delimitada (zero conferido nos agregados por setor), 1 divergente (Peixe-Boi, sem valor e com nota).
- **Verificação:** valores nacionais recalculados do banco por SQL iguais aos da auditoria (feita por outro código e outras consultas): preta 10,91% e parda 44,26% (16+), evangélicas 26,45% (15+), desocupação 5,39% (18–69), superior completo 16,75% (18+), não alfabetizadas 7,09% (16+), empregados no setor público 12,59%, internet 88,98%, esgoto pela rede 63,69%, urbana 87,73% (15+), deficiência 8,36% (15+) e 27,53% (70+), migração 6,98% (15+, denominador da amostra), favelas 7,72% (15+, 5.569 municípios com valor), desvio máximo 4,95 p.p. Reexecução idempotente (“Já publicado”, sem linhas duplicadas). Typecheck; testes de todas as workspaces (API 30, importador 65 com 6 novos, web 41, contratos 16); `check:publication` ok. Smoke tests não rodados: API e web não mudaram.
- **Ainda não usado pela interface** (fase 3).

## 9. Fase 3: interface — 31/10/2026

Autorizada por Rafael (“segue todas as fases disponíveis antes de commit”).

- **Tabela derivada para leitura rápida:** ler o JSON da publicação a cada pedido levava ~0,9 s para o Brasil (limite de 2 s por consulta). A migração `022-census-indicator-cells.sql` (idempotente, como a 008 do contexto) grava, a partir da publicação e sem dado novo, uma linha por município, tema e recorte (`census_indicator_cells`, 245.080 linhas, 134 MB); a consulta de um indicador para o Brasil cai para ~27 ms. O importador reaplica a migração depois de publicar, ou se as células faltarem numa reexecução. A lista de indicadores fica nos contratos e pode mudar sem reimportar.
- **Contratos:** `MAP_INDICATORS` reescrito com grupo, rótulo curto e especificação (`census`: tema, recorte, categorias ou recorte do numerador). Saem os 8 do entorno e `literacy-15`; entram 25 indicadores em 11 grupos (cor ou raça, religião, idade, escolaridade e alfabetização, renda, trabalho, internet e moradia, saneamento, território, deficiência, migração). `college-18` passa a ler a nova publicação (mesma tabela 10061). Itens do mapa ganham `deviation` (opcional, só nos recortes 15+). Resposta do contexto ganha `censusIndicators` e `censusIndicatorsId` (opcionais); catálogo, `censusIndicatorsDatasets`.
- **API:** mapa pelas células derivadas (UF = soma de numeradores, denominadores e desvio; nulo continua nulo); contexto do município com os indicadores; entorno não é mais enviado no contexto nem no cartão do local (a consulta deixou de ler `tract_urban_surroundings`); catálogo lista a publicação nova e mantém a do entorno como registro.
- **Web:** `/mapa` com seletor em `<optgroup>` nativos (funciona sem JavaScript), avisos de base 15+ com o maior desvio do recorte e coluna do desvio na tabela, aviso de amostra, de leitura (religião e cor ou raça), de desocupação × PNAD, de setor público, de favelas (Peixe-Boi e o Pará sem valor na soma por UF) e de 2026 × Censo 2022. Painel do município com nove seções novas (cor ou raça, religião, escolaridade e alfabetização pela idade de voto, trabalho, internet e moradia, saneamento, urbano × rural e favelas, deficiência, migração) e “não alfabetizadas (16+)” no resumo; seção do entorno, componente, biblioteca e teste do entorno removidos; `/fontes` com a seção da publicação (soma dos municípios × UF por tabela e originais por tabela) e o entorno marcado como fora da interface; `/metodologia` com a seção “Indicadores do Censo pela idade de voto” e o registro da retirada do entorno.
- **Critério de deficiência conferido nos dados** antes de escrevê-lo na página: em cada tipo, as pessoas com deficiência da 10127 são exatamente as que têm muita dificuldade ou não conseguem de modo algum na 10133 (Brasil; diferença de 1 pessoa por arredondamento em “enxergar”).
- **Verificação:** typecheck; testes (contratos 17, importador 66, API 30 com o teste do entorno reescrito para a retirada e os indicadores novos, web 38 sem os 3 do entorno); os nove smokes contra a aplicação em execução (`smoke:context` com os totais da auditoria para oito indicadores, Peixe-Boi e o Pará sem valor, desvio presente só nos recortes 15+, páginas do município, do mapa, de fontes e da metodologia); `check:data` e `check:regressions` (a regressão de Abreu e Lima pediu a mesma redação já validada para a diferença não discriminada de cor ou raça); `check:ui` registrado no `plan.md`.

## 10. Fase 4: proposta, sem execução — 31/10/2026

Não executada: tem decisões de Rafael e republica análises já publicadas (métrica E, 732 recortes, e em cascata a sensibilidade, ~25 min). Medições feitas no banco local, só leitura:

- **Eleitores de 70 anos ou mais por local (TSE):** 9,55% dos aptos no Brasil; quantis ponderados p10 3,8 · p20 5,0 · p40 7,3 · p60 10,0 · p80 13,6 · p90 16,8%. Proposta de faixas fixas, pela regra da v4 (números redondos perto da distribuição nacional): **até 5%, até 7,5%, até 10%, até 15%, acima de 15%**, que reúnem 20,5 / 21,1 / 18,7 / 24,8 / 14,9% dos eleitores. Equivalente do Censo por setor: 70+ entre os moradores de 15+ (o agregado por setor tem 70+ exato).
- **Situação do setor do local:** 59.286 locais associados em setor urbano (135.080.361 eleitores) e 24.163 em setor rural (9.836.462); 4 sem situação (2.931).
- **Favela do setor do local:** 1.522 dos 83.453 locais associados (1,8%) ficam em setor de favela ou comunidade urbana, com 3.958.455 eleitores (2,7%). O endereço do local não é a residência do eleitor, e o rótulo precisa dizer “locais em setor de favela”.
- **Decisões:** (1) acrescentar 70+ e manter 60+, como recomenda o estudo da fase 5, ou trocar; (2) os cortes de 70+; (3) se situação urbana/rural e favela entram como grupos de dois valores na métrica E, com o aviso de leitura ecológica.

## 11. Fase 5: estudo das faixas de idade do IBGE — 31/10/2026

Feita antes da fase 4 porque informa a decisão (1) acima: [estudo das faixas de idade](estudo-faixas-etarias-ibge.md). O IBGE usa 0–14 / 15–64 / 65+ (índice de envelhecimento oficial de 55,2) e publica a pessoa idosa a partir de 60 anos (Estatuto; índice 80,0); juventude 15–29 pelo Estatuto da Juventude; trabalho 14+. Os cortes do voto (16–17, 18–69, 70+) continuam o eixo do projeto; o estudo recomenda manter 60+ ao lado de 70+ nos perfis por local.

## 12. Pendências e limites

- Universo ou amostra das tabelas de internet e moradia: resolvido na auditoria (amostra, §7).
- Denominador da migração: resolvido na auditoria (15+ da 9537, mesma amostra, §7).
- O Censo é de 2022: com as eleições de 2026 o mapa mostra quatro anos de defasagem; resolvido na fase 3 (aviso em “Como ler” quando a eleição não é de 2022).
- Fora deste plano: entorno dos domicílios na interface, acessibilidade das seções do TSE, eleitores com deficiência declarada ao TSE, estado conjugal (não equivale ao estado civil do cadastro), autismo e frequência escolar.
