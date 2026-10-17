# Senador 2022 — 27 UFs

Registro de 17/10/2026. Segundo cargo estadual importado, diretamente nas 27 UFs, sem piloto (decisão de Rafael). Deputados, inicialmente previstos em seguida, saíram do escopo atual na mesma data (ver `plan.md` §20). Versão `senator-2022-state-v1`; cada UF tem publicação própria (`2022/senator/<UF>`), e o resultado da UF é a soma dos seus municípios reconciliados.

## Regra do cargo em 2022

- Uma vaga por UF; cada eleitor vota uma vez para Senador. O eleito é a candidatura com mais votos, em turno único (maioria simples). Os denominadores são, portanto, os mesmos de um cargo majoritário de um voto: percentual da candidatura = votos ÷ votos válidos.
- Em 2026 haverá duas vagas e dois votos por eleitor: soma de votos ≠ comparecimento, e o recorte exigirá regra e auditoria próprias. Nada aqui se aplica automaticamente a 2026.
- O contrato ganhou `SINGLE_ROUND_OFFICES` (`['senator']`): a consulta do 2º turno responde `round-not-held` e a interface diz que o cargo é eleito em turno único, em vez de "decidida no 1º turno".

## Fontes

As mesmas do Governador (mesmos arquivos e SHA-256): entradas da UF em `detalhe_votacao_munzona_2022.zip` e `votacao_candidato_munzona_2022.zip` (gerados em 11/10/2026) e `votacao_secao_2022_<UF>.zip` (votos de 2022 gerados em 01/11/2022). Nenhum download novo. Só o cargo 5 é selecionado; os demais permanecem nos originais preservados.

## Auditoria dos originais

Leitura direta dos CSVs, independente do importador (script descartável em Python `csv`, 27 UFs, cerca de 12 min):

- Cargo 5 aparece só na eleição 546 ("Eleições Gerais Estaduais 2022", `CD_TIPO_ELEICAO` 2, 02/10/2022), turno 1, nas três fontes. Nenhuma linha de 2º turno, de outra eleição ou de outra UF. Em RR **não** há suplementar de Senado (a de 2026 é só de Governador): nenhuma exclusão declarada.
- Sem trânsito, votos de legenda ou apuração em separado. Sem duplicatas seção/votável.
- Identidades da apuração em todas as zonas: aptos = comparecimento + abstenção + eleitores de seções não instaladas; comparecimento = votos; votos = válidos + brancos + total de nulos + anulados + anulados sub judice; total de nulos = nulos + nulos técnicos.
- Por UF, a soma das seções coincide com a apuração (total, brancos, 96) e com o nominal (cada candidatura); números sem linha no nominal somam exatamente os nulos técnicos.
- AM tem 1 seção não instalada (81 eleitores aptos), mantida fora da abstenção, como nos demais cargos.
- Aptos de Senador e de Governador no 1º turno coincidem em todas as UFs publicadas dos dois cargos (conferido pelo smoke).

Categorias não computadas como válidas (todas no único turno):

| UF | Anulados | Anulados sub judice | Nulos técnicos | Votáveis (fonte) |
| --- | ---: | ---: | ---: | --- |
| AL | — | — | 26.547 | 900, 350 (nulo técnico) |
| AM | — | 10.200 | — | 700 (sub judice; registro: indeferido com recurso) |
| AP | 9.351 | — | — | 145 (registro: deferido), 299 (indeferido) |
| BA | — | — | 1.549 | 290 |
| CE | — | — | 2.919 | 160 |
| DF | 2.069 | — | 9.676 | 777 (anulado); 456 (nulo técnico) |
| MS | 2.101 | — | — | 500 (registro: deferido) |
| MT | — | — | 310.481 | 111 |
| PA | — | — | 1.278 | 901 |
| PB | 431.857 | — | 773 | 133 (anulado); 290 (nulo técnico) |
| PE | 666 | — | — | 290 |
| RJ | 1.198 | — | 1.573.388 | 290 (anulado); 142 (1.566.352) e 277 (nulos técnicos) |
| RO | 63.300 | — | — | 123 |
| RR | — | — | 25.554 | 333 |
| RS | — | — | 80.498 | 111, 290 |
| SC | — | — | 2.940 | 290 |
| SP | 13.280 | — | — | 290 |
| TO | — | 588 | — | 271 (sub judice; registro: deferido) |

AC, ES, GO, MA, MG, PR, PI, RN e SE não têm nenhuma dessas categorias. Em AP e MS, a destinação "Anulado" convive com a situação "deferido" do registro da candidatura; a fonte não traz o motivo, e o observatório exibe as duas informações sem interpretá-las.

## Regras da importação

As mesmas da `governor-2022-state-v2` (decisões de Rafael de 15/10/2026: categorias não válidas exibidas por categoria e com identificação, fora do denominador dos válidos; nulos técnicos contidos nos nulos), com o recorte do cargo:

- `SENATOR_2022`: cargo 5, eleição 546, turnos `['1']`. Linha de 2º turno (qualquer código) bloqueia: a apuração da UF precisa ter só o 1º turno, e o modelo rejeita turno fora do recorte em vez de descartá-lo.
- Linha de outro cargo, eleição ou UF bloqueia; exclusões só por declaração (nenhuma para o Senado).
- Antes da publicação, além dos votos por turno/votável a partir dos municípios, o importador reconta os mesmos votos **a partir dos locais** (candidaturas, não válidos, 95 e 96) e exige igualdade com as seções gravadas.

### Correção na gravação de locais e zonas (Governador v3)

Ao preparar o Senado, constatou-se que `persistTerritory` gravava locais e zonas com uma lista fixa de colunas que omitia `nonValidVotes`. Nas publicações `governor-2022-state-v2`, os **totais** dos locais estão corretos (inclusive "dos quais nulos técnicos", anulados e sub judice), mas o quadro que identifica essas candidaturas por local não existe: no banco, 0 de 1.179 locais de SE (1º turno) têm o campo. A verificação persistida da v2 não olhava os locais, e a revisão de acessibilidade não abriu locais de UFs com essas categorias.

Correção: locais e zonas passam a ser gravados como o objeto reconciliado e validado pelo contrato, e a verificação reconta os votos pelos locais. A nova verificação aplicada aos dados v2 já gravados falha em SE e PR (com não válidos) e passa em AC (sem), como esperado. A Presidência usa outro caminho de gravação e não é afetada (não tem essas categorias). Como a mudança altera o que é gravado, o importador do Governador passa à versão `governor-2022-state-v3`; as publicações v2 não foram reescritas e continuam publicadas. A reimportação v3 (cerca de 75 min e ~1,9 GB no banco) **não foi executada**: fica para decisão de Rafael, considerando o espaço reservado ao IBGE. Até lá, o quadro de não válidos aparece na UF e nos municípios do Governador, mas não nos locais.

## Resultado

- 27 UFs publicadas (`2022/senator/<UF>`), **5.570 municípios** reconciliados, nenhum bloqueado; **3.790.841 registros** seção/votável — exatamente a contagem da auditoria independente. Verificação persistida aprovada em todas, inclusive a nova recontagem pelos locais.
- 329 ocorrências local/turno com nome ou endereço divergente, preservadas como variantes.
- Tempo somado: cerca de 61 min (SP: 14 min 40 s), pico de RSS de 509 MiB. Sem download novo.
- Banco após a carga: 7,7 GB no total (≈ 1,6 GB do Senado, cerca de 400 bytes por registro com índices); `data/staging/state` com 2,5 GB.

## Verificação

- Comparação independente: totais de participação e de votos, categorias não válidas, seções, municípios, cada candidatura (número, nome, partido, votos) e cada votável não válido (categoria, nome, partido, situação), por UF, lidos dos CSVs e comparados à API, mais o 2º turno como `round-not-held`: **659 conferências, nenhuma divergência**.
- `npm run typecheck`, `npm test` (49 testes: 16 importador, 16 API, 12 web, 5 contratos) e `npm run build`.
- `npm run smoke:senator`: 27 UFs, 132 requisições — aptos/votos/válidos/municípios dos originais, invariantes, turno único, categorias e casos auditados (RJ, MT, PB, RO, AM, TO), nulos técnicos identificados nos locais do Rio, aptos iguais aos do Governador no 1º turno em todas as UFs, candidaturas distintas das do Governador, páginas e transparência.
- Regressão contra o build de produção: `smoke`, `smoke:pilot`, `smoke:places`, `smoke:exterior`, `smoke:summary`, `smoke:national` e `smoke:governor` aprovados.
- Em `npm run dev` (`tsx watch`), a rota de relatório da API devolve o `StreamableFile` serializado como JSON em vez do arquivo, e `smoke:national`/`smoke:exterior` falham; no build de produção a mesma rota serve o arquivo. Defeito anterior a esta etapa, só do modo dev, não corrigido aqui.

Pendentes: reimportação do Governador v3 (decisão de Rafael); defeito do relatório em modo dev; revisão em navegador das páginas do Senado (não feita nesta etapa); Senado de 2026 (duas vagas) exigirá regra própria.
