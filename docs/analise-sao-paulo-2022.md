# São Paulo — análise inicial da eleição presidencial de 2022

Recorte: **município de São Paulo**, código TSE **71072**, eleições 544 e 545, cargo 1 (Presidente). Os números abaixo foram obtidos dos arquivos oficiais, reconciliados por zona e conferidos novamente após a gravação no PostgreSQL. Não são totais do estado.

## Resultados por candidatura

Percentual sobre os votos válidos do respectivo turno. Nomes de urna e partidos seguem os arquivos TSE.

| Candidatura | Partido | 1º turno: votos | % válidos | 2º turno: votos | % válidos |
| --- | --- | ---: | ---: | ---: | ---: |
| Lula | PT | 3.276.512 | 47,54% | 3.677.921 | 53,54% |
| Jair Bolsonaro | PL | 2.618.593 | 37,99% | 3.191.484 | 46,46% |
| Simone Tebet | MDB | 558.748 | 8,11% | — | — |
| Ciro Gomes | PDT | 297.973 | 4,32% | — | — |
| Felipe D Avila | NOVO | 67.714 | 0,98% | — | — |
| Soraya Thronicke | UNIÃO | 51.000 | 0,74% | — | — |
| Léo Péricles | UP | 8.443 | 0,12% | — | — |
| Sofia Manzano | PCB | 5.009 | 0,07% | — | — |
| Padre Kelmon | PTB | 4.281 | 0,06% | — | — |
| Vera | PSTU | 2.676 | 0,04% | — | — |
| Constituinte Eymael | DC | 1.689 | 0,02% | — | — |

O traço significa candidatura ausente no segundo turno, não zero votos. Percentuais arredondados podem não somar exatamente 100%.

Lula teve o maior percentual municipal no primeiro turno, abaixo de 50%, e ultrapassou 50% no segundo. A diferença **Lula menos Bolsonaro** passou de **657.919 votos / 9,55 pontos percentuais** para **486.437 votos / 7,08 pontos percentuais**. Ambos aumentaram sua votação absoluta: Lula em 401.409 e Bolsonaro em 572.891 votos. Esses saldos agregados não identificam de quais eleitores ou candidaturas vieram os votos.

## Participação e composição dos votos

| Medida | 1º turno | 2º turno | 2º menos 1º |
| --- | ---: | ---: | ---: |
| Eleitores aptos | 9.320.706 | 9.320.585 | −121 |
| Comparecimento / total de votos para o cargo | 7.339.532 | 7.372.124 | +32.592 |
| Abstenções | 1.981.174 | 1.948.461 | −32.713 |
| Abstenção ÷ aptos | 21,26% | 20,90% | −0,35 p.p. |
| Votos válidos | 6.892.638 | 6.869.405 | −23.233 |
| Brancos | 152.752 | 153.859 | +1.107 |
| Brancos ÷ total de votos no cargo | 2,08% | 2,09% | +0,01 p.p. |
| Nulos | 294.142 | 348.860 | +54.718 |
| Nulos ÷ total de votos no cargo | 4,01% | 4,73% | +0,72 p.p. |

As diferenças percentuais são calculadas antes do arredondamento. Cada turno usa seus próprios aptos e denominadores oficiais, que não são presumidos idênticos.

O comparecimento aumentou, enquanto o total de válidos diminuiu. A identidade contábil explica a diferença: brancos e nulos juntos cresceram 55.825; subtraindo a queda de 23.233 válidos, resulta o aumento de 32.592 votos totais. Isso não revela a motivação individual de quem votou em branco, nulo ou se absteve.

## Escala territorial disponível

Em cada turno, foram conferidas **58 zonas**, **26.288 seções principais** e **2.049 identificadores de local, definidos pelo par zona/código**. Foram preservados **325.089 registros seção/votável**, incluindo candidaturas, brancos e nulos nos dois turnos.

| Maior votação na zona | 1º turno | 2º turno |
| --- | ---: | ---: |
| Lula | 41 zonas | 35 zonas |
| Jair Bolsonaro | 17 zonas | 23 zonas |

Contar zonas com maior votação não mede proporção de eleitores, área ou população: zonas têm tamanhos diferentes. O percentual municipal é calculado pela soma dos votos e dos denominadores, não pela média dos percentuais das zonas. Zonas não equivalem a bairros, e a manutenção de números ou quantidades entre turnos não certifica continuidade individual de seções ou eleitores.

O painel permite abrir os locais e consultar seus votos. **Aptos, comparecimento e abstenção por local não estão disponíveis nesta importação**. Endereços são de votação, não de residência; ainda não há geocodificação nem associação ao IBGE.

## Auditoria e ressalvas concretas

As três fontes são do [catálogo TSE de resultados de 2022](https://dadosabertos.tse.jus.br/dataset/resultados-2022):

| Entrada lida | Geração no arquivo (Brasília) | Registros selecionados |
| --- | --- | ---: |
| detalhe_votacao_munzona_2022_BR.csv | 11/10/2026 03:17:48 | 116 |
| votacao_candidato_munzona_2022_BR.csv | 11/10/2026 03:16:50 | 754 |
| votacao_secao_2022_BR.csv | 01/11/2022 16:05:25 | 325.089 |

Apesar das gerações diferentes, a reconciliação foi exata por zona e candidatura nos dois turnos. Também foram conferidos válidos, brancos, nulos, quantidade de seções principais, aptos = comparecimento + abstenção e total de votos = válidos + brancos + nulos. Duplicatas ou diferenças nos votos bloqueiam a carga. A reexecução do importador confirmou ausência de duplicação.

Há **uma divergência de nome de local, presente nos dois turnos**: zona 258, código 1430, mesmo endereço, com os nomes “EMEI PROFESSORA ISABEL COLOMBO” e “EMEF. DOUTOR JOSÉ DIAS DA SILVEIRA”. O nome agregado fica indisponível; ambas as variantes são preservadas e mostradas no detalhe. Não foi escolhida silenciosamente a primeira linha.

O CSV de apuração não contém `ST_PENDENTE_TOT_FINAL`, embora o dicionário atual o descreva. A publicação corresponde à reconciliação dos totais históricos; não presume o valor desse campo ausente.

Versão publicada: `286a86a00e4b135be9f731c910c3ad48deca951dd0483ee72dbe9bb561754da4`, importador `sao-paulo-2022-v1`. Checksums dos ZIPs preservados:

- Apuração: `1b378f465de8f457ea8613fec5e947213e7314366769a108acdf1d413228dd8e`.
- Candidaturas: `398d2310a89851c3f4595c487489c406a56ea2dc401c6d08aa3fd37a712e69f1`.
- Seções: `9353993de5cf03778aef44e01d4925e7ee105f5262491d344a2f0dbc956b0139`.

Dados detalhados e validação: `data/analysis/sao-paulo-2022.json` e `data/audit/sao-paulo-2022.json`. Os dicionários oficiais estão preservados em `data/raw/tse/2022/{detalhe,candidato,secao}/leiame.pdf`; foram usados para conferir campos, sentinelas e denominadores. A leitura dos PDFs influenciou o tratamento de ausências e a separação entre votos e cadastro eleitoral.

Foram aprovados oito testes, verificações de tipos, build local, builds Docker e smoke HTTP com dados reais dos dois turnos e paginação. A conferência por HTML não substitui uma revisão visual ou auditoria completa de acessibilidade.

Próxima análise possível: variabilidade dos percentuais entre zonas e locais com denominadores explícitos. Relações com renda ou perfil demográfico dependem da próxima auditoria IBGE e da associação territorial; não foram calculadas aqui.
