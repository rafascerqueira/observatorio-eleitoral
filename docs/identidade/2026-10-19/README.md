# Propostas de identidade — 19/10/2026

Exploração solicitada por Rafael para comparar os nomes **Mente Eleitoral** e **Mentalidade Eleitoral**. **Decisão posterior em 19/10/2026: Mente Eleitoral, com a identidade 03A em petróleo/terracota, aprovada para aplicação no projeto.** As propostas abaixo preservam o processo de escolha. As três pranchas iniciais foram geradas pela ferramenta integrada `image_gen.imagegen`; os pedidos completos estão em [prompts.json](prompts.json).

Todas usam a frase proposta por Rafael: **Um olhar único sobre votação e população**. Cada prancha mostra logotipo principal, aplicação sobre fundo escuro, símbolo para ícone e quatro ícones de navegação: resultados, território, população e fontes.

| Proposta | Nome | Ideia | Paleta proposta |
| --- | --- | --- | --- |
| [01 — Olhar](01-mente-eleitoral-olhar.png) | Mente Eleitoral | Olhar aberto com barras de dados; tipografia sem serifa. | Marinho `#13283F`, teal `#147D85`, papel `#F4F1E9`. |
| [02 — Conexões](02-mentalidade-eleitoral-conexoes.png) | Mentalidade Eleitoral | M abstrato formado por conexões; tipografia arredondada. | Berinjela `#392F50`, íris `#7966AD`, lilás `#E9E3F0`, marfim `#F8F5EF`. |
| [03 — Territórios](03-mente-eleitoral-territorios.png) | Mente Eleitoral | M modular com peças territoriais; tipografia editorial com serifa. | Petróleo `#103F4C`, terracota `#BD7159`, aveia `#F1E7D7`, branco `#FFFDFA`. |

Preferência inicial apresentada: nome Mente Eleitoral, por ser mais curto; direção 01 pela associação direta com observação e dados. A direção 03 oferece uma alternativa editorial com maior ênfase territorial. A direção 02 aproxima a identidade do conceito de pensamento e conexões.

As paletas acima são as especificadas nos pedidos, ainda sem normalização dos pixels gerados. As imagens são estudos em PNG, com ícones incorporados às pranchas; não constituem arquivos vetoriais ou ícones individuais prontos para aplicação. A escolha pode combinar nome, símbolo, cores e tipografia de propostas diferentes.

Verificação: revisão visual das três pranchas, conferindo nomes, frase, acentos, amostras claras/escuras e presença dos quatro ícones. Pendentes após a escolha: refinamento e desenho vetorial consistente, exportação dos ícones separados, definição de fontes e licenças, contraste e legibilidade em tamanhos reais. Nenhuma alteração aplicada ao site.

## Refinamento da direção 03

Rafael preferiu a direção 03 pela linguagem e sobriedade das cores. Solicitou que o M incorporasse linhas/grafos remetendo a cérebro e uma alternativa com verde-oliva no lugar do petróleo. Depois da comparação, aprovou a **03A** e o nome **Mente Eleitoral**.

Mantidos o nome Mente Eleitoral, a tipografia editorial, a frase, a terracota e os fundos claros. O M ganhou curvas internas e pontos de conexão, sugerindo percursos neurais; os motivos de território permanecem na divisão das peças.

- [03A — M/conexões em petróleo](03a-mente-eleitoral-conexoes-petroleo.png): cor principal solicitada `#103F4C`.
- [03B — M/conexões em verde-oliva](03b-mente-eleitoral-conexoes-oliva.png): cor principal solicitada `#4B5134`, com terracota `#BD7159`, aveia `#F1E7D7` e branco `#FFFDFA`. Variante gerada a partir da 03A para manter desenho e composição comparáveis.

Edições realizadas com a ferramenta integrada de imagens. Pedidos completos e referências em [prompts-refinamento-03.json](prompts-refinamento-03.json). As pranchas originais foram preservadas. Conferidos visualmente nome, frase, correspondência geral dos símbolos nas aplicações, troca de cor e quatro ícones; verificada integridade dos PNGs e leitura do JSON. Permanecem estudos em imagem, com avaliação de legibilidade em tamanhos reais e acabamento vetorial pendentes.

## Identidade aplicada

Os contornos do símbolo e das letras da prancha 03A foram convertidos em caminhos SVG locais. O logotipo preserva o desenho aprovado sem carregar uma fonte externa; títulos e textos editoriais usam a pilha local Georgia/Times New Roman/serif. A navegação recebeu seis ícones SVG de traço consistente, com texto visível e desenhos decorativos ocultos dos leitores de tela.

- [Logotipo](../../../apps/web/public/brand/logo.svg), [símbolo](../../../apps/web/public/brand/mark.svg), [versão para fundo escuro](../../../apps/web/public/brand/mark-on-dark.svg) e [símbolo monocromático](../../../apps/web/public/brand/mark-mono.svg).
- [Banner vetorial](../../../apps/web/public/brand/banner.svg), usado no README, e [imagem de compartilhamento](../../../apps/web/app/opengraph-image.png), 1200 × 630 px.
- [Ícone da aba](../../../apps/web/app/icon.svg) e [ícone Apple](../../../apps/web/app/apple-icon.png), 180 × 180 px.

Paleta de marca: petróleo `#103F4C`, terracota `#BD7159`, aveia `#F1E7D7` e branco `#FFFDFA`. Para texto pequeno sobre fundo claro, a terracota usa uma variante escura `#8D4B34`; no título sobre petróleo, usa `#EDB79F`. As escalas de cores dos dados dos mapas são independentes da marca e foram preservadas.

O banner inicial apresenta a frase da marca e uma explicação sobre os dados do TSE e do IBGE, com acesso à consulta e aos mapas. A cobertura continua derivada das publicações do recorte consultado. Nome também aplicado aos títulos/metadados, cabeçalho e rodapé; `SITE_URL` configura a origem absoluta da imagem de compartilhamento, com padrão local `http://localhost:3000`. `public/` passa a integrar a imagem Docker da web. Exportações PNG podem ser refeitas por `node scripts/render-brand.mjs`, usando Chrome local e `puppeteer-core` já presente no projeto; o roteiro bloqueia acesso à rede durante a exportação.

Verificação da aplicação: 106 testes, typecheck, build completo e smoke aprovados. Revisão visual da página inicial a 1280 e 375 px; verificações de nome, metadados, carregamento de imagens, ícones e âncora em seis larguras (1280/1024/768/650/375/320 px). Chrome e Firefox passaram em 72 avaliações automáticas de contraste/refluxo (12 páginas × 3 larguras × 2 navegadores); cenário adicional de foco, movimento reduzido e alto contraste no Chrome aprovado, com CLS zero durante a consulta. Evidências em `data/analysis/brand-2026-10-19/` e nos relatórios de UI citados no §37 do planejamento. Isso não certifica toda a acessibilidade; Safari, dispositivos reais e leitor de tela humano continuam pendentes. A imagem Docker não foi reconstruída; os arquivos públicos foram conferidos por HTTP na execução standalone local.
