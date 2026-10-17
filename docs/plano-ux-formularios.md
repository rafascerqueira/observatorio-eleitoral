# Plano — qualidade de UX/UI dos formulários

Registro de 17/10/2026. Pesquisa e plano pedidos por Rafael. **Todas as fases (1–6) implementadas na mesma data** (ver "Andamento"); falta o teste com leitor de tela real, exigido para a fase 4. Escopo: campos de seleção e de entrada, botões e estados dos formulários da consulta (`/`), dos locais (`/municipios/[code]`) e do exterior; turnos exibidos conforme os dados; transições e animações na exibição dos resultados (pedido de Rafael na mesma data). Fora do escopo: redesenho das tabelas, gráficos e mapas.

## Restrições que o plano mantém

- Formulários GET funcionam sem JavaScript; toda melhoria é progressiva sobre o HTML que o servidor já entrega.
- Neutralidade: ordem fixa dos cargos e das UFs, sem destaque a candidaturas; nenhum número inventado para "enfeitar" estados vazios.
- Disponibilidade (cargo × UF × turno) vem do catálogo publicado (`dataset.rounds`, `plannedOffices`), nunca de listas fixas no frontend.
- Acessibilidade já verificada (axe sem violações, contraste ≥ 4,5:1, teclado, refluxo a 320 px; ver `acessibilidade.md`) não pode regredir. Controles de interface precisam de contraste ≥ 3:1 (WCAG 1.4.11).
- Next.js 16: consultar `node_modules/next/dist/docs/` antes de codificar (há `next/form`, com navegação no cliente e aprimoramento progressivo, em `01-app/03-api-reference/02-components/form.md`).

## Diagnóstico (capturas em Firefox, 1280 e 375 px)

1. **Hierarquia plana.** Cinco campos numa grade de quatro colunas: "Município" fica sozinho na segunda linha, e o botão fica solto embaixo. Não há agrupamento visível entre *o quê* (cargo), *onde* (UF/município) e *quando* (eleição/turno).
2. **Rótulos dentro das opções.** "Senador — exige UF" e "Todo o Brasil — somente Presidência" repetem regras nas opções; no desktop a segunda é truncada ("…Presidênc").
3. **O erro é permitido e depois punido.** Escolher Senador ou Governador mantém "Todo o Brasil" selecionável; o envio gera a mesma mensagem **três vezes** (resumo, campo e estado vazio da tabela).
4. **Escolhas impossíveis aparecem como possíveis.** O 2º turno do Senado (turno único) e o 2º turno de Governador nas 15 UFs decididas no 1º só se revelam após o envio. "Eleição" é um select com uma única opção real (2026 está "ainda não publicado").
5. **Busca sem apoio.** UF é um select de 28 opções, sem digitação para filtrar além do comportamento nativo; "Município" é texto livre sem sugestões. Um erro de digitação só aparece como "nenhum município".
6. **Dicas longe dos campos.** A explicação da consulta fica num parágrafo de 11 px abaixo do formulário; as dicas de zona e seção ficam abaixo do bloco inteiro.
7. **Estados pouco expressivos.** O envio só troca o texto do botão ("Consultando…"); não há indicação na área de resultados. Pouco feedback ao passar o mouse e ao pressionar; bordas de 3 px de raio nos campos e 6 px nos botões e cartões.
8. **Filtros aplicados pouco visíveis.** O resumo "Consulta aplicada: …" é uma linha de 13 px na barra da tabela; não dá para remover um filtro com um clique.

O que já funciona e deve ficar: rótulos acima dos campos, alvos de 48 px, campos de largura total no celular, turnos como opções visíveis, filtros avançados recolhidos nos locais, resumo de erros com links, foco visível, `prefers-reduced-motion` e `forced-colors`.

## O que a pesquisa indica

- **Rótulos acima, sem rótulo dentro do campo.** Baymard encontrou problemas graves com rótulos dentro do campo em todos os testes; no celular, o rótulo acima é o padrão. Já fazemos isso.
- **Validação em linha sem precipitação.** Validar após o usuário sair do campo (não durante a digitação) e remover a mensagem assim que corrigida (Baymard, 2024). `:user-invalid` cobre isso em CSS (cerca de 94% dos navegadores).
- **Prevenir antes de reportar.** Opções impossíveis devem vir indisponíveis e explicadas, não aceitas para depois serem rejeitadas.
- **Opções visíveis para listas curtas, lista para listas longas.** Radios para 2–5 (até ~7) opções; para mais, select/combobox. Controle segmentado aplica na hora; radio aplica no envio. Cargo (3) e turno (2) cabem como opções visíveis; UF (27 + exterior) pede combobox.
- **Autocomplete por aprimoramento progressivo.** O componente do GOV.UK (`accessible-autocomplete`) aprimora um `<select>` existente; num teste comparativo com tecnologias assistivas, foi mais robusto que o exemplo WAI-ARIA, por mover o foco com `focus()` em vez de `aria-activedescendant` (estudo pequeno, indicativo). A manutenção oficial do componente é mínima.
- **Filtros aplicados visíveis e removíveis** (eBay, SAP Fiori, Innovaccer): chips com o estado atual; com botão "Aplicar", os chips mostram só o que foi aplicado, não o rascunho.
- **Painéis de dados para o público** (Our World in Data, redesenho do Grapher): controles próximos do que afetam, apenas os relevantes à vista atual, fonte dos dados sempre à mão. Pesquisa sobre painéis eleitorais (Northwestern, CHI 2026) liga clareza do processo de apuração a confiança — reforça explicar "turno não realizado" no próprio controle.
- **Awwwards** (coleções *Search Filters*, *Forms*): referência de acabamento — tipografia, espaçamento, estados e microinterações de 150–250 ms. A maior parte é comércio e moda, com movimento intenso; para uma ferramenta pública de dados, aproveita-se o refinamento dos estados, não o espetáculo (movimento só como feedback, nunca bloqueando leitura).
- **Transições entre estados.** React 19.3 traz `<ViewTransition>`, integrado à View Transitions API; no App Router do Next 16 funciona sem configuração e é ativado por navegações, `startTransition` (já usado pelo `QueryForm`) e `<Suspense>` (guia local `01-app/02-guides/view-transitions.md`). Sem suporte, a página funciona igual, só sem animar. View Transitions no mesmo documento: Chrome/Edge 111+, Safari 18+, Firefox 144+ — cerca de 93%.
- **Suporte dos navegadores (caniuse, out/2026).** `appearance: base-select` (select estilizável, inclusive a lista): Chrome/Edge 135+, Safari 27+; Firefox ainda não (desativado por padrão) — cerca de 72% dos usuários. Anchor positioning: cerca de 87%, parcial em Chrome e Firefox. Os dois só como aprimoramento, com o select nativo como base.

## Proposta por fases

Cada fase é publicável isoladamente e termina com a verificação da fase 7.

### Fase 1 — Fundamentos visuais (CSS, sem mudar comportamento)

- Tokens de formulário em `forms.css`: altura (48 px), raio único (6 px), espessura e cor de borda com ≥ 3:1 contra o fundo, cor de hover, de pressão, de inválido, de desabilitado e de pendente; dicas com no mínimo 13–14 px.
- Select fechado com aparência própria (`appearance: none` + seta em SVG inline, universal) e, onde houver suporte, `appearance: base-select` para estilizar a lista, dentro de `@supports`.
- Turnos como controle segmentado visual (continuam radios no HTML): bloco único, indicador do selecionado com transição de 140–180 ms, desligada com movimento reduzido.
- Botão primário com estados de hover, pressão (leve deslocamento), foco e pendente com indicador giratório dentro do botão e largura estável; botão secundário ("Limpar filtros", "Voltar ao Brasil") como botão de contorno, não link solto.
- Números (zona, seção, código) com `font-variant-numeric: tabular-nums`.

### Fase 2 — Estrutura e redação do formulário da consulta

- Três grupos com título curto: **Cargo** (Presidência · Governador · Senador como opções visíveis em radio, com a observação "cargo estadual: escolha a UF" como dica do grupo, não dentro da opção), **Território** (UF e município) e **Eleição** (ano e turno).
- "Eleição": enquanto só 2022 estiver publicado, mostrar 2022 selecionado e 2026 como opção desabilitada com "ainda não publicado" (o envio de `year=2026` continua aceito e tratado como hoje).
- Dicas junto de cada campo (`aria-describedby` já usado), substituindo o parágrafo geral abaixo do formulário.
- Erro único: resumo + mensagem no campo; o estado vazio da tabela deixa de repetir o texto e só aponta para os filtros.
- Mesma revisão no formulário de locais (zona e seção lado a lado como par, código e por página em "opções avançadas").

### Fase 3 — Turnos conforme os dados e restrições (aprimoramento progressivo)

O 2º turno só aparece quando existe para o recorte escolhido; recorte decidido no 1º turno mostra apenas o 1º turno, e a explicação que hoje fica na página do 2º turno passa a aparecer já no 1º.

- **Fonte da regra:** o servidor envia ao formulário um mapa de disponibilidade extraído do catálogo publicado: cargo → UF → turnos realizados (`dataset.rounds`, mais `SINGLE_ROUND_OFFICES`). Nada de lista fixa de UFs no frontend.
- **Campo Turno condicional:**
  - Presidência (Brasil, UF ou município): 1º e 2º turnos.
  - Governador em UF com 2º turno (12 UFs em 2022): 1º e 2º.
  - Governador em UF decidida no 1º turno, e Senador em qualquer UF: só "1º turno", com uma frase no próprio campo — "Decidida no 1º turno em Ceará" ou "Senador: eleito em turno único". Não há opção desabilitada para escolher.
  - Cargo estadual ainda sem UF: só o 1º turno, com a dica "o 2º turno depende da UF".
  - Ao trocar cargo ou UF (com JavaScript), o campo se recompõe; se o turno marcado deixar de existir, volta ao 1º e o aviso é dado em região viva.
  - Sem JavaScript: o servidor desenha o campo conforme os filtros enviados; uma troca de cargo/UF ainda não enviada pode mostrar um turno indisponível, que o servidor trata como hoje.
- **Frases levadas ao 1º turno:** no resultado da UF, do município e dos locais, um selo/nota curta junto ao título — "Turno único" (Senador) ou "Eleição decidida no 1º turno" (Governador) — com o texto explicativo que hoje só aparece na página do 2º turno. Links para o 2º turno (navegação de turnos nos locais, "Ver o 1º turno") só aparecem quando ele existe.
- **Endereços antigos e compartilhados com `round=2`** num recorte sem 2º turno continuam respondendo `round-not-held` (API e interface), com a mesma explicação e um link para o 1º turno: um link guardado não pode virar erro genérico.
- **Outras restrições:** cargo estadual torna "Todo o Brasil" indisponível na UF (com a dica "cargo estadual"); "Eleição" mostra 2026 como "ainda não publicado".
- Testes: unitários do mapa de disponibilidade (cada combinação acima, a partir de um catálogo sintético) e smoke de que nenhuma página de recorte com turno único oferece link ou opção de 2º turno.

### Fase 4 — Busca com sugestões enquanto se digita

Pedido de Rafael (17/10/2026): sugestões a cada letra, com busca "inteligente" e não `LIKE '%…%'`. Hoje a busca municipal usa `strpos(search_name, …)` sem índice — o mesmo antipadrão, varrendo a tabela a cada consulta —, e será substituída.

- **Técnica (PostgreSQL):** extensões `pg_trgm` e `unaccent`. Coluna normalizada (minúsculas, sem acento, hífens/apóstrofos padronizados) com índice GIN de trigramas; ordenação por `word_similarity`/`similarity` combinada com prefixo exato (`starts_with`) primeiro. Isso tolera erro de digitação ("jaboatao", "sao jao del rei"), acha palavras do meio ("guararapes" → Jaboatão dos Guararapes) e usa índice. Busca textual completa (`tsvector`) não é a ferramenta certa para nomes próprios curtos; fica descartada.
- **Tabela própria de busca**, separada dos resultados: um registro por município (código TSE, UF, nome oficial, formas normalizadas e, depois, nomes alternativos). Construída a partir das publicações, sem duplicar por cargo ou turno.
- **Volume:** são 5.570 municípios. A API pode responder em poucos milissegundos com o índice; avaliar também manter o índice em memória na API (carregado na partida e invalidado a cada publicação) — ambos evitam enviar a base ao navegador.
- **Rota leve:** `GET /elections/municipalities/suggest?q=&uf=&office=` com até 8 itens (código, nome, UF, motivo da correspondência), limite de taxa e resposta validada pelo contrato. Só municípios com publicação no recorte escolhido.
- **Interface:** sugestões a partir de 2 caracteres, espera de ~150 ms entre teclas e cancelamento da requisição anterior; trecho correspondente destacado; homônimos sempre com a UF (há nomes repetidos em UFs diferentes); escolher uma sugestão leva ao município pelo código (sem ambiguidade); Enter sem escolher mantém a busca textual de hoje. Padrão WAI-ARIA combobox próprio (decisão 1), com teclado, contagem anunciada em região viva e funcionamento sem JavaScript como hoje.
- **Enriquecimento com dados públicos (depois da integração IBGE):** a API de localidades do IBGE traz municípios, distritos, microrregiões e regiões imediatas; com a correspondência TSE–IBGE **validada por código** (nunca por nome), a busca pode aceitar nome de distrito ("Itaipava" → Petrópolis/RJ), grafias antigas e região, sempre dizendo por que o município apareceu ("distrito de Petrópolis"). Isso entra junto com a fase IBGE, não antes.
- **UF:** combobox sobre o `<select>`, aceitando nome ou sigla ("rio" → RJ, RN, RS; "ms" → Mato Grosso do Sul).
- Testes: casos de grafia (acentos, hífen, apóstrofo, "d'Oeste"), homônimos, erros de digitação com limiar de similaridade documentado, desempenho medido (p95) e plano de execução usando o índice.

### Fase 5 — Feedback da consulta

- Barra de **filtros aplicados** com chips (Senador · 2022 · 1º turno · Rio de Janeiro); cada chip removível é um link GET (funciona sem JavaScript).
- Durante o envio: `aria-busy` na região de resultados e esqueleto discreto no lugar da tabela; o anúncio de conclusão já existe.
- Locais: validação de zona e seção ao sair do campo (`:user-invalid` + mensagem), mantendo a validação do servidor.

### Fase 6 — Transições e animações na exibição dos dados

Movimento como continuidade e feedback, nunca como espetáculo nem como atraso para ler um número.

- **Troca de resultados** (cargo, UF, turno, página): `<ViewTransition>` na região de resultados, com crossfade curto (150–200 ms) do conteúdo antigo para o novo; cabeçalho e formulário com nome próprio, para não piscarem.
- **Carregamento:** o `loading.tsx` existente vira um esqueleto com as dimensões da tabela e do quadro da UF, e o conteúdo real entra por `<Suspense>` + `<ViewTransition>`, sem salto de layout. O esqueleto não mostra números nem barras fictícias.
- **Troca de turno:** deslocamento curto e direcional (1º → 2º para um lado, de volta para o outro), via tipos de transição (`addTransitionType`).
- **Controles:** indicador do turno e do cargo deslizando entre as opções (CSS); abertura de "opções avançadas" e dos detalhes com altura animada onde houver suporte (`interpolate-size`, `::details-content`), e abertura instantânea no restante.
- **Mudança de turno disponível (fase 3):** a opção de 2º turno entra e sai com fade/colapso curto, sem empurrar os demais campos de forma brusca.
- **Números:** valores aparecem prontos. Sem contagem progressiva nem barras crescendo a partir de zero, que exibiriam valores intermediários inexistentes nos dados.
- **Limites:** `prefers-reduced-motion` desliga deslocamentos e crossfades (troca instantânea); nada de animação acima de ~250 ms; foco e anúncio em região viva não dependem da animação terminar; navegadores sem View Transitions trocam o conteúdo direto.
- Verificação: CLS medido nas trocas (meta: 0), captura em movimento reduzido, teclado durante a transição e teste de que o conteúdo novo é anunciado uma única vez.

### Fase 7 — Verificação (a cada fase)

- Incorporar ao repositório o roteiro de revisão usado em 15/10 (pendência 4 do `plan.md` §19): `puppeteer-core` + `axe-core` como dependências de desenvolvimento, capturas em 1280/375/320 px e um script `npm run check:ui`.
- axe sem violações; contraste de texto e de controles medido; ordem de Tab; `forced-colors`; movimento reduzido; teste sem JavaScript (formulários GET).
- Pendente desde 15/10: leitor de tela real (Orca no Linux ou NVDA) e Chrome/Safari — necessário antes de declarar acessibilidade da fase 4.
- Smokes existentes continuam passando (textos verificados por eles podem mudar e precisam ser atualizados junto).

## Decisões de Rafael (17/10/2026)

1. Sugestões ao digitar: **componente próprio** (padrão WAI-ARIA, foco movido como no GOV.UK), ajustado à realidade brasileira (siglas e nomes de UF, municípios homônimos em UFs diferentes, nomes sem acento). Antes de declarar a fase 4 acessível, testar com leitor de tela real.
2. Cargo como **opções visíveis** (radios).
3. **Manter o botão "Consultar"**; nada se aplica ao mudar.
4. Ordem: **1 → 2 → 3, depois 5 e 6 juntas, e 4 por último**.

## Decisões propostas (registro original)

1. **Autocomplete (fase 4):** adotar `accessible-autocomplete` do GOV.UK (testado com tecnologias assistivas, manutenção mínima, estilo próprio a adaptar) ou componente próprio seguindo o padrão WAI-ARIA (controle total, mais testes nossos). Recomendação: componente próprio pequeno, com o foco movido como no GOV.UK, se pudermos testar com leitor de tela real; caso contrário, a biblioteca.
2. **Cargo como opções visíveis** em vez de select. Recomendação: sim (três opções).
3. **Aplicar ao mudar** ou manter o botão "Consultar". Recomendação: manter o botão (consultas pesadas no servidor, previsível para leitor de tela, mesmo comportamento com e sem JavaScript); só a navegação entre turnos, que já é por link nos locais, continua imediata.
4. **Ordem das fases.** Recomendação: 1 → 2 → 3 (maior ganho com menor risco, incluindo os turnos condicionais), 6 junto com 5 (transições e feedback da consulta dependem um do outro) e por último 4, que exige a rota leve de sugestões e testes com leitor de tela.

## Referências

- Baymard: [rótulos acima no celular](https://baymard.com/blog/mobile-form-usability-label-position), [evitar rótulos dentro do campo](https://baymard.com/blog/mobile-forms-avoid-inline-labels), [validação em linha](https://baymard.com/blog/inline-form-validation).
- GOV.UK: [accessible-autocomplete](https://content-publisher.publishing.service.gov.uk/component-guide/autocomplete); [comparação com o padrão WAI-ARIA](https://tpximpact.com/knowledge-hub/blogs/design/prototype-accessible-autocomplete); [boas práticas de autocomplete (Orange)](https://a11y-guidelines.orange.com/en/articles/autocomplete-component/).
- Filtros: [eBay Playbook](https://playbook.ebay.com/design-system/patterns/filtering-patterns), [Innovaccer](https://design.innovaccer.com/patterns/tableFilters/usage/), [SAP Fiori](https://www.sap.com/design-system/fiori-design-android/v26-4/components/filter-feedback-bar/usage), [Volvo Cars chips](https://designsystem.volvocars.com/web/components/chips/usage/).
- Radios, segmentados e listas: [ServiceTitan Anvil](https://anvil.servicetitan.com/docs/web/components/radio/design), [Trimble Modus](https://modus.trimble.com/components/in-field/segmented-controls/).
- Painéis de dados: [Our World in Data — redesenho do Grapher](https://ourworldindata.org/redesigning-our-interactive-data-visualizations); [Cai et al., Northwestern](https://mucollective.northwestern.edu/files/2024-vote_counting_process.pdf); [Gramener, eleições de 2014](https://blog.gramener.com/design-of-the-2014-election-results-page/).
- Inspiração de acabamento: [Awwwards — Search Filters](https://www.awwwards.com/awwwards/collections/search-filters/), [coleções](https://www.awwwards.com/collections/).
- Busca: [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html), [unaccent](https://www.postgresql.org/docs/current/unaccent.html), [IBGE — API de localidades](https://servicodados.ibge.gov.br/api/docs/localidades).
- Transições: guia local do Next 16 (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`); [caniuse View Transitions](https://caniuse.com/view-transitions).
- Suporte: [select estilizável (Chrome)](https://developer.chrome.com/blog/a-customizable-select), [caniuse base-select](https://caniuse.com/mdn-css_properties_appearance_base-select), [caniuse anchor positioning](https://caniuse.com/css-anchor-positioning), [caniuse :user-invalid](https://caniuse.com/mdn-css_selectors_user-invalid).

## Andamento

### Fases 1–3 — 17/10/2026

- **Fundamentos (1):** tokens de controle em `forms.css` (altura 48 px, raio 6 px, borda `#67746f`, hover, inválido); seta própria no select fechado; opções segmentadas sobre radios nativos, com indicador deslizante (`--i`/`--n` via `:has()`), foco visível, cores forçadas e movimento reduzido; botão com hover, pressão e indicador de envio dentro dele; ação secundária como botão de contorno. `appearance: base-select` não foi aplicado: sem Chrome nesta máquina, não foi possível verificar.
- **Estrutura (2):** página inicial em três grupos — Cargo (opções visíveis), Eleição (ano e turno), Território (UF e município) —, com dicas junto de cada campo (`field-hint`, `aria-describedby`); "Todo o Brasil" sem a regra na própria opção; 2026 desabilitado como "ainda não publicado" (continua aceito no endereço); estado vazio de erro sem repetir a mensagem do resumo e do campo.
- **Turnos conforme os dados (3):** `lib/rounds.ts` monta, a partir do catálogo, cargo → UF → turnos e decide as opções (`roundOptions`); `RoundField` e `UfField` (cliente) acompanham cargo e UF sem enviar o formulário, recompõem o turno, voltam ao 1º com aviso em região viva e desabilitam "Todo o Brasil"/exterior para cargo estadual. O HTML do servidor já sai com os turnos do recorte enviado. `RoundNote` mostra no 1º turno "Turno único" (Senador) ou "Decidida no 1º turno" (Governador), na consulta, no quadro da UF e nos locais; nos locais, a navegação entre turnos só existe quando houve dois.
- **Correção encontrada no caminho:** com os não válidos agora presentes nos locais, o cartão do local crescia com a tabela e a página rolava na horizontal no celular; a grade de locais passou a `minmax(0, 1fr)`.
- **Verificação:** 51 testes (novos: regra de turnos com catálogo sintético e campo de cargo), tipos, build; comportamento no Firefox headless (troca de cargo/UF, aviso, envio leva a `round=1`); axe-core sem violações em 10 páginas, a 1280 e 375 px; sem rolagem horizontal a 375 e 320 px; os 8 smokes passam (`smoke:exterior` passou a verificar cargo em radios e ausência do 2º turno do Senado no HTML). Não verificados: Chrome/Safari, leitor de tela real, zoom de texto.

### Fases 5 e 6 — 17/10/2026

- **Feedback (5):** barra "Consulta aplicada" com chips (Cargo, Eleição, Turno, Território, Município); Território (só na Presidência) e Município são removíveis por link GET, voltando à 1ª página. Durante o envio, `QueryForm` marca a região de resultados com `aria-busy` e `data-pending`: o conteúdo anterior esmaece e uma barra indeterminada corre no topo, sem números provisórios. Nos locais, zona, seção e código mostram "Use apenas números." ao sair do campo (`:user-invalid`, sem JavaScript), e o servidor continua validando. O `loading.tsx` virou esqueleto neutro (formas, sem valores).
- **Transições (6):** `ResultsTransition` envolve os resultados da consulta e dos locais em `<ViewTransition key=…>` (React 19.3/Next 16). Cada consulta faz crossfade (120 ms saída, 200 ms entrada); a troca de turno recebe o tipo `round-next`/`round-prev` (`addTransitionType` no envio; `transitionTypes` nos links de turno dos locais) e desliza 32 px na direção do turno. A raiz da página e o cabeçalho não animam; `::view-transition` não captura cliques. A animação antiga de entrada da tabela foi removida para não se sobrepor. Números aparecem prontos.
- **Movimento reduzido:** indicador sem transição, barra de envio estática, esqueleto sem brilho e transições com duração zero — conferido no Firefox com `ui.prefersReducedMotion`.
- **Verificação:** no Firefox headless, a troca de turno disparou `round-next` com deslize, a busca só crossfade, `aria-busy` durante o envio, nenhum erro no console; axe-core sem violações em 10 páginas (1280 e 375 px), sem rolagem horizontal a 375/320 px; os 8 smokes, 51 testes, tipos e build passam. Não verificados: Chrome/Safari (as transições podem variar no Safari, segundo o guia do Next), leitor de tela real, medição formal de CLS.

### Fase 4 — 17/10/2026

- **Banco:** migration `005-search-trigram.sql` (`pg_trgm` + índice GIN de trigramas em `municipality_results.search_name`), aplicada pelos importadores; criada em 0,5 s, sem alterar dados. A listagem de municípios trocou `strpos` (sem índice) por `LIKE` com curingas escapados, atendido pelo índice; resultados iguais (smokes inalterados).
- **API:** `GET /elections/municipalities/suggest` (até 8; ordem: início do nome, início de palavra, trecho, grafia parecida por `word_similarity`); recorte por cargo/UF publicado; `503` sem a extensão. Plano de execução: `BitmapOr` de dois `Bitmap Index Scan` no índice de trigramas, ~2 ms; ponta a ponta, mediana 10 ms e p95 21 ms em 60 requisições.
- **Web:** `MunicipalitySearch` (combobox WAI-ARIA próprio; foco movido às opções), rota `/sugestoes` como proxy validado pelo contrato, espera de 150 ms e cancelamento, trecho destacado ignorando acentos (`lib/suggest.ts`), homônimos com UF, escolha preenche nome e UF sem enviar; sem JavaScript, campo textual como antes. Atributos de combobox só após hidratação.
- **Verificação:** casos reais — "jaboatau" → Jaboatão dos Guararapes (grafia parecida), "guararapes" → também por palavra, Campo Grande em AL/MS/RN, Senado restrito ao RJ, termo inexistente vazio; teclado no Firefox (setas, Enter preenche nome e UF, digitar numa opção volta ao campo, Esc fecha); axe sem violações com a lista aberta; layout no celular; `smoke:exterior` ganhou as verificações da busca; 53 testes. **Não feito:** leitor de tela real (condição de Rafael para declarar a fase acessível), Chrome/Safari. Apóstrofo e hífen não são equivalentes a espaço na comparação exata (a similaridade cobre "sant'ana").

