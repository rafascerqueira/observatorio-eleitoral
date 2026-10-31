# Análise — reportagem do g1 sobre municípios com maior presença evangélica (2º turno de 2026)

Registro de **31/10/2026**, pedido de Rafael: verificar se os dados do projeto batem com a reportagem “MAPA: Como votaram municípios com maior presença evangélica no Brasil” (g1, 31/10/2026) e separar o que a matéria afirma do que os dados mostram. A página não abre para a ferramenta de leitura; o texto e três gráficos foram colados por Rafael. Cálculo somente leitura: religião da SIDRA 9537 (Censo 2022, consultas da auditoria de 31/10) e votos do 2º turno da Presidência de 2026 publicados no banco local (`2026/president/BR`), por município, ligados pelo código IBGE oficial. Nada foi publicado a partir desta análise.

## 1. Os números da reportagem conferem

Reproduzidos com a **base do IBGE (pessoas de 10 anos ou mais)** e a **soma dos votos** de cada faixa (não a média dos percentuais municipais):

| Afirmação do g1 | Projeto | Situação |
| --- | --- | --- |
| Lula 51,8%, Flávio 48,2% dos válidos | 51,78% e 48,22% (soma dos 5.571 municípios) | confere |
| Flávio de 7,6% a 90,5% (gráfico: 7,66 e 90,56) | 7,66% (Carnaubeira da Penha, PE) a 90,56% (Nova Pádua, RS) | confere |
| Evangélicos de 1,2% a 88,7% (gráfico: 1,2 e 88,74) | 1,32% (Montauri, RS) a 88,74% (Arroio do Padre, RS) | máximo e municípios conferem; o mínimo dá 1,32% (1,29% com base 15+), não 1,2% |
| Até 10%: 502 municípios, Flávio 31,5% | 500 municípios, 31,4% | quase igual (2 municípios perto de 10% mudam de faixa; provavelmente arredondamento antes de classificar) |
| 10–20%: 1.929, 38,7% | 1.931, 38,7% | idem |
| 20–30%: 1.819, 48,7% | 1.819, 48,7% | confere |
| 30–40%: 973, 54,2% | 973, 54,2% | confere |
| 40–50%: 289, 54,6% | 289, 54,6% | confere |
| Mais de 50%: 58, 55,2% | 58, 55,2% | confere |
| Total de 5.570 municípios | 5.570: Boa Esperança do Norte (MT), criado depois do Censo, não tem religião | confere |
| Centro-Oeste: 42% dos municípios no grupo alto-alto | 42,0% (terços por número de municípios) | confere |
| Nordeste: 55% dos municípios no baixo-baixo | 54,9% | confere |
| Montauri, menor proporção; Arroio do Padre, a maior; Goiânia, Campo Grande, Cuiabá e Anápolis com mais evangélicos que a média e Flávio vencendo; Juazeiro do Norte, Salvador e Teresina com Lula | Montauri 1,3% de evangélicos e 82,6% para Flávio; Arroio do Padre 88,7% e 86,1%; Goiânia 33,9% e 62,6%; Campo Grande 34,3% e 61,1%; Cuiabá 31,3% e 59,6%; Anápolis 38,7% e 70,3%; Juazeiro do Norte 11,5% e 26,0%; Salvador 24,3% e 26,8%; Teresina 19,4% e 32,0% (média nacional: 26,85%) | confere |

A agregação da reportagem está correta: com a média simples dos percentuais municipais, a faixa acima de 50% daria 60,8% para Flávio, e a de até 10%, 38,0%. Os números publicados são os da soma de votos.

## 2. O que a reportagem diz além dos dados

- **Município não é eleitor.** Tudo é comparação entre municípios. “Flávio teve seu melhor desempenho nos municípios onde os evangélicos pesam mais” descreve municípios e está certo. Mas os intertítulos “Fé e voto na mesma direção” e “Aqui a religião praticamente não explica o voto” sugerem relação entre a crença e o voto de pessoas, que os dados não medem: nenhuma fonte diz como votaram os evangélicos. A própria matéria ressalva que correlação não demonstra causa.
- **Associação moderada.** A correlação entre a parcela de evangélicos e o voto em Lula é −0,36 entre os municípios (−0,39 ponderada pelos votos válidos). Por UF varia de −0,79 (AL) a +0,15 (RS), com SP (+0,06), MS (+0,03) e SC (−0,02) perto de zero. A reportagem cita as diferenças entre estados sem dar os valores.
- **A virada acima de 30% é pequena.** De 30–40% para mais de 50%, Flávio passa de 54,2% para 55,2% (+1 ponto). A mudança grande acontece entre 10% e 30%. Acima de 40% estão só 347 dos 5.570 municípios.
- **Mapas por área exageram regiões pouco povoadas.** Os terços são por número de municípios, e o mapa pinta área: o “alto-alto” do Centro-Oeste (42% dos municípios) não é 42% dos eleitores da região.
- **“Evangélicas” é uma categoria ampla do IBGE.** Reúne igrejas de tradições diferentes, inclusive as de missão, como a luterana. Nos municípios de colonização alemã e pomerana do Sul (como Arroio do Padre), a alta parcela pode refletir essa tradição, e a tabela usada não separa as denominações. Tratar “evangélicos” como um bloco político único é uma leitura, não um dado.
- **Fontes com datas e bases diferentes.** A religião é estimativa da amostra do Censo de 2022, com erro maior nos municípios pequenos (onde estão os extremos), e se refere a moradores de 10 anos ou mais. O voto é do eleitorado de 2026 (16+, domicílio eleitoral). A reportagem não menciona a amostra, a defasagem de quatro anos nem a base de idade (“população considerada pelo levantamento”).
- **Outras diferenças entre municípios não são controladas.** Região, renda, urbanização e atividade econômica também variam junto. A matéria reconhece isso no fim (“não explica sozinha”), mas a estrutura do texto, região por região, apresenta a religião como fio condutor.

## 3. Conclusão

Os números da reportagem estão corretos e foram agregados do jeito certo (soma de votos), com uma pequena diferença no mínimo da parcela de evangélicos e na fronteira de 10%. O exagero está no enquadramento: frases que falam de fé e voto como se medissem pessoas, a ênfase numa virada que, acima de 30%, é de um ponto, e mapas que dão peso de área a regiões com poucos eleitores. O que os dados permitem dizer é que, em 2026, municípios com maior parcela de evangélicos entre os moradores de 2022 deram, em conjunto, mais votos válidos a Flávio Bolsonaro, com uma associação moderada que muda de força e até de sinal entre os estados.

No projeto, o mesmo cruzamento já pode ser explorado em `/mapa` (“Evangélicas (15+)” × votação da candidatura, por município), com a base 15+ e o desvio declarado, a escala comum a todas as candidaturas e o aviso de leitura ecológica.
