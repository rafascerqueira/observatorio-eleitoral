# Revisão visual e de acessibilidade — 15/10/2026

Primeira revisão em navegador real, pendente desde o marco 1. A extensão Claude in Chrome não estava conectada; a revisão usou o **Firefox 157.0.1** do sistema em modo headless, controlado por `puppeteer-core` 24 (WebDriver BiDi), com **axe-core 4.14**. As ferramentas foram instaladas fora do repositório (diretório temporário), sem alterar dependências do projeto.

## Escopo

11 páginas, em 1280 px (desktop) e 375 px (celular), mais refluxo a 320 px: consolidado Brasil, Presidência SP, Governador SE (nulos técnicos), Governador CE 2º turno (turno não realizado), Governador sem UF (erro), Governador RR (exclusão declarada), locais de Aracaju (Governador) e de São Paulo (Presidência, busca por zona/seção), exterior, fontes e metodologia. Capturas esperam o fim do streaming da página (o evento `load` chega antes do conteúdo).

## Verificações e resultado

| Verificação | Método | Resultado |
| --- | --- | --- |
| Regras WCAG 2.0/2.1 A e AA + boas práticas | axe-core, 11 páginas (desktop); controle positivo com página sintética acusou as 8 violações plantadas | 0 violações após as correções |
| Contraste sobre gradientes | axe marcou 23+ casos como inconclusivos (fundo em gradiente). Medição própria: texto tornado transparente, captura da página e contraste mínimo pixel a pixel na área de cada trecho de texto | 3 falhas encontradas e corrigidas; todo texto medido ≥ 4,5:1 (texto grande ≥ 3:1) |
| Rolagem horizontal | `scrollWidth` em 375 px e 320 px (WCAG 1.4.10) | 1 falha encontrada e corrigida; nenhuma rolagem de página. Tabelas de dados rolam na própria região, rotulada e focável |
| Teclado | Sequência de Tab nas páginas, foco visível por estilo calculado | Ordem segue a leitura visual; todos os controles com indicador de foco na primeira passada; página com erro leva o foco ao resumo de erros |
| Estrutura para leitor de tela | Títulos, regiões, nomes acessíveis, legendas, `th[scope]`, regiões vivas | Hierarquia h1→h2→h3 consistente; tabelas com legenda e cabeçalhos; regiões roláveis nomeadas; contagem de resultados em região viva |
| Inspeção visual | Capturas lidas em desktop e celular | 4 problemas de apresentação corrigidos (abaixo) |

## Correções

1. `/fontes` tinha 14 px de rolagem horizontal no celular: nomes de arquivo longos no aviso de exclusão de RR. `.prose` passou a quebrar palavras longas.
2. Contraste: nota da publicação no hero (3,55:1 no celular, sobre a parte clara do gradiente) → 4,65:1; números dos cartões de princípios (4,45:1) → acima de 4,5:1; descrição do hero ganhou margem (4,53:1 → maior). Cores ajustadas em `atlas.css`.
3. "Nulos — dos quais nulos técnicos" ocupava várias linhas no corpo grande do número (quatro no celular); o detalhe passou a uma linha menor de apoio.
4. Legenda do quadro de votos não válidos e o título "Municípios de …" estavam sem o recuo do cartão.
5. `/fontes`: o aviso listava "Governador SP, Governador RJ, …" e ainda dizia "demais UFs não importadas"; agora resume "publicado nas 27 UFs". A lista de importações passou a ordem estável (publicados, Presidência, UFs em ordem alfabética, versões substituídas no fim) e os arquivos de cada UF ficam recolhidos.
6. Rodapé da tabela em turno não realizado anunciava "Consulta sem resultados publicados"; agora "Turno não realizado para este cargo na UF". Plural "1 zona".

## Limites — não verificado

- **Leitor de tela real** (NVDA, Orca, VoiceOver, TalkBack): não executado. A estrutura semântica foi conferida, não a experiência falada.
- Chrome/Edge e Safari, e navegadores móveis reais: não testados; o celular foi simulado por largura de viewport no Firefox.
- Foco após sair para a interface do navegador e voltar: em headless, alguns elementos apareceram sem `:focus-visible` nessa volta. Provável artefato do modo headless, mas inconclusivo.
- Zoom de texto (200%) sem mudança de viewport, modo de alto contraste do sistema e preferências de movimento reduzido: não testados nesta rodada (há regras CSS para `forced-colors` e `prefers-reduced-motion`, não verificadas aqui).
- Usabilidade da página de UF com muitos municípios: a página de uma UF lista 25 municípios por página, cada um com seu quadro, o que a torna longa (≈ 22 mil px em SE). Não é falha de acessibilidade, mas é ponto de usabilidade a discutir.

As ferramentas e scripts usados (auditoria axe, contraste sobre gradiente, teclado, estrutura e refluxo) não estão no repositório; podem ser incorporados como verificação reproduzível se for decidido adicionar `puppeteer-core`, `axe-core` e `pngjs` como dependências de desenvolvimento.


## Continuidade e roteiro incorporado — 18/10/2026

O roteiro está agora no repositório (`npm run check:ui`), com binários locais e perfis temporários. O relatório diferencia navegador e método de bloquear os scripts da página: CDP no Chrome; CSP em proxy local de teste no Firefox instalado, cujo protocolo não implementa o comando correspondente. Controle positivo confere a não execução dos scripts e outro confere que o axe detecta um botão sem nome em página de teste. Efeitos, resultados e limites em `docs/correcoes-verificacao-2026-10-18.md` e `plan.md` §27.

Roteiro manual ainda não executado com leitor de tela real: abrir um perfil de teste local com Orca ou NVDA; localizar o formulário por seu nome; alterar cargo/UF/turno sem envio automático; escolher município com as setas e ouvir nome/UF; enviar e conferir os anúncios de ocupado/concluído uma única vez; chegar à tabela municipal pelos cabeçalhos; abrir o detalhe e identificar candidatura, contagem e denominador; distinguir a diferença do Censo de uma falha técnica; voltar e paginar mantendo os filtros. Repetir com zoom de texto e preferências reais de alto contraste. As ações só consultam dados, mas mudam foco e preferências do perfil de teste; restaurá-las ao concluir. Registrar tecnologia, versão, percurso e resultado de cada etapa.

Safari real e dispositivos reais também continuam exigindo verificação própria. Emular cores/movimento e obter axe sem violações não certifica esses ambientes nem substitui o roteiro humano.

### Conferência após as reimportações — 19/10/2026

Executado `check:ui` com `UI_ONLY='Controle positivo|Acessibilidade'` após a auditoria integral e os smokes das nove versões. Chrome 151.0.7922.71 e Firefox 158.0: controle positivo do axe aprovado e 30 avaliações por navegador (10 páginas × 1280/375/320 px), sem violações automáticas e sem rolagem horizontal fora das tabelas. Relatório/capturas em `data/analysis/reimports-2026-10-18/final-ui/`. API em desenvolvimento e web compilada, ambas locais; serviços/navegadores encerrados após o teste.

Rodada de regressão dos dados/fontes, sem alteração nova de interface. Envios com/sem JavaScript, teclado, preferências e demais cenários da revisão anterior não foram repetidos aqui. Leitor de tela humano, Safari real e dispositivos reais continuam pendentes; os testes automáticos não certificam toda a acessibilidade.
