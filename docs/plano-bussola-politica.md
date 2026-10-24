# Plano: bússola política das candidaturas — 22/10/2026

Pesquisa de base em [pesquisa sobre espectro político](pesquisa-espectro-politico.md).

## Situação (24/10/2026)

Rafael escolheu o modelo **Kieskompas** e autorizou seguir sem novas perguntas. Ficou assim:

- **P0:**
  - eixos e rótulos do Kieskompas (economia esquerda–direita × costumes progressista–conservador);
  - escala de cinco pontos;
  - mínimo de 4 afirmações por eixo;
  - piloto na Presidência de 2022;
  - quem revisa o livro de códigos continua aberto; quem codifica foi decidido em 22 e 24/10 (P2).
- **P1:** livro de códigos em [bussola-livro-de-codigos.md](bussola-livro-de-codigos.md), com 24 afirmações (6 por polo em cada eixo) e termos medidos no corpus. Afirmações aprovadas por Rafael em 22/10/2026. Em 24/10/2026 o livro passou à `bussola-kieskompas-v2`, à espera de aprovação: mesmas afirmações e termos, mais as regras que vieram das lacunas da v1 e o procedimento novo.
- **P2:**
  - **v1** (registro): pacote em `data/compass/bussola-kieskompas-v1/pacote-2026-10-23T00-14-13.878Z/` (12 documentos, 288 linhas, 636 trechos candidatos em 218 páginas) e uma codificação pelo Claude (modelo de linguagem), feita em 22/10/2026 e refeita em 24/10/2026 com leitura integral, guardada em `data/compass/bussola-kieskompas-v1/codificacao-a/`;
  - **mudança de 24/10/2026:** manter essa codificação escondida de quem faria a segunda contrariava a transparência do projeto, e o commit `9c493d9`, público, já mostrava a contagem e as decisões dela. Rafael decidiu: nova versão, a pessoa codifica primeiro, em público, e o modelo depois, isolado (livro de códigos, seção 6). A codificação da v1 não entra na concordância; o conteúdo dela é publicado quando a pessoa terminar a v2;
  - **v2:** aguarda a aprovação do livro, o pacote novo, a codificação da pessoa, a do modelo e a adjudicação.
- **P3 (parte):**
  - cálculo pronto e testado com dados sintéticos: kappa ponderado, posições, intervalo por reamostragem, sensibilidade e contribuições;
  - roda na concordância e grava `posicoes.json` e `posicoes.csv`, sem publicação;
  - pendentes: importação e publicação `compass-2022-v1` e a conferência externa, que dependem da codificação real.
- **P4:** a página fica para quando houver codificação real, porque não se testa interface com posições inventadas.

O §2 do `plan.md` e o `AGENTS.md` já trazem a regra da bússola.

## Posição de Rafael (22/10/2026)

- Classificar em esquerda e direita não fere o `plan.md`, desde que não haja indução nem orientação de voto. O projeto não recomenda candidaturas em nenhum ponto.
- O problema são rótulos muito negativos, como "autoritário". Um gráfico que funcione como bússola, situando cada candidatura numa direção, não deve ser descartado.
- A Res. TSE 23.755/2026 não se aplica ao projeto (decisão de Rafael).

Consequência para este plano: o §2 do `plan.md` proíbe classificar "automaticamente". A bússola usa duas codificações independentes, documentadas, reprodutíveis e contestáveis, com adjudicação humana, e não oferece "afinidade" nem recomendação. A regra aplicada ao §2 do `plan.md` e ao `AGENTS.md` (22/10/2026, §§53–54 do `plan.md`) admite que uma das duas codificações seja feita por modelo de linguagem, declarada como tal; a outra é sempre de uma pessoa. Desde 24/10/2026 (§59), a da pessoa vem primeiro, em público, e a do modelo depois, isolada.

## Modelo do gráfico

Dois eixos, como o Kieskompas e o Vote Compass, sem os termos do Political Compass e do Nolan:

- **Horizontal — economia:** esquerda (mais Estado na economia, mais redistribuição) ↔ direita (mais mercado, menos tributação e gasto).
- **Vertical — costumes:** progressista ↔ conservador.

Cada candidatura é um ponto com uma cruz de incerteza. Ao lado, uma tabela com os mesmos valores, a cobertura (quantos itens o plano permitiu codificar) e um link para os trechos. Opcional: um radar por candidatura com os temas (no estilo do smartspider), mostrando de onde vem cada coordenada.

## De onde vêm as posições

Da **codificação dos planos de governo** já publicados (`proposals-2022-v2`), com a mesma estrutura da D3:

1. **Livro de códigos `bussola-v1`:** cerca de 24 afirmações, 12 por eixo, com metade apontando para cada polo (equilíbrio contra o viés de concordância). Exemplos de forma, não de conteúdo: "o plano propõe ampliar a participação de empresas estatais em X"; "o plano propõe reduzir tributo Y". Cada afirmação tem eixo, direção e regras de decisão com exemplos.
2. **Respostas possíveis por afirmação:** escala de cinco pontos do Kieskompas (de concorda totalmente, +1, a discorda totalmente, −1) e "sem posição", que fica fora do cálculo e nunca vira zero; detalhes no livro de códigos.
3. **Coordenada no eixo:** média dos itens codificados, com a direção aplicada, numa escala de −1 a +1. Se um eixo tiver menos itens codificados que o mínimo (por exemplo, 4), a candidatura fica sem posição nele e a página diz "o plano não permite situar", sem estimativa.
4. **Incerteza:** intervalo por reamostragem dos itens (bootstrap) e sensibilidade com cada item retirado, um de cada vez. As duas aparecem na página de método.
5. **Duas codificações independentes, concordância (kappa) e adjudicação**, com as ferramentas `rubric:packet` e `rubric:agreement` generalizadas para mais de uma rubrica.
6. **Conferência externa, não fonte:** comparar o resultado com as posições de partidos estimadas por especialistas (Bolognesi, Ribeiro e Codato, rodada de 2022; CHES Latin America 2020, que também posiciona presidentes) e publicar as divergências sem ajustar nada.

## Fases

| Fase | Entrega | Depende de |
| --- | --- | --- |
| P0 | Decisões: eixos e rótulos; mínimo de itens; quem revisa o livro de códigos | Rafael |
| P1 | Livro de códigos `bussola-v1` em `docs/`, com afirmações, direções, regras e exemplos | P0 |
| P2 | Pacote e duas codificações independentes para a Presidência de 2022 (12 documentos, 288 julgamentos por codificação): pessoa em público, depois modelo isolado | P1; aprovação da v2, codificações e adjudicação |
| P3 | Importação `compass-2022-v1`: coordenadas, cobertura, intervalos, sensibilidade, conferência externa e testes com dados sintéticos | P2 |
| P4 | Página `/propostas/bussola`: gráfico SVG no servidor, tabela equivalente, página de trechos por candidatura, método e canal de contestação; `check:ui` | P3 |
| P5 | Extensões: Presidência de 2026 (exige antes o inventário e a extração dos planos de 2026, como D1/D2) e Governador (mais de 200 planos em 2022; avaliar o custo antes) | P4 |

## Complexidade

- **Técnica: média.** Reaproveita a busca, a rubrica, o pacote e a concordância. O gráfico é simples (SVG estático com tabela).
- **Humana: o gargalo.** Contribuidores do projeto para a codificação da pessoa e para adjudicar; a do modelo vem depois, isolada. Planos de governo são vagos em muitos temas, então é provável haver cobertura baixa em costumes. Isso será mostrado, não preenchido.
- **Metodológica: a escolha das afirmações define o resultado** (Louwerse e Rosema mostraram que mudar o método muda a recomendação para a maioria). Por isso: afirmações publicadas antes da codificação, equilíbrio entre os polos, sensibilidade publicada e versão nova a cada mudança.

## Fora do plano

Afinidade com o visitante, ranking, recomendação, posição atribuída só por modelo de linguagem (sem codificação independente de uma pessoa e adjudicação humana), rótulos pejorativos e posição inferida do partido sem leitura do plano.
