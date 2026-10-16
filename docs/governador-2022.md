# Governador 2022 — 27 UFs

Registro de 15/10/2026. Primeiro cargo estadual importado. O piloto foi São Paulo (escolha de Rafael), publicado como `governor-2022-state-v1`. Em seguida o cargo foi expandido às 27 UFs com a versão `governor-2022-state-v2`, que trata votos não computados como válidos e exclusões declaradas. Cada UF tem publicação própria (`2022/governor/<UF>`); o resultado da UF é a soma dos seus municípios reconciliados.

## Fontes

| Arquivo | Entrada | Observação |
| --- | --- | --- |
| `detalhe_votacao_munzona_2022.zip` | `detalhe_votacao_munzona_2022_<UF>.csv` | Mesmo ZIP (e SHA-256) da Presidência; entrada da UF, com governador, senador e deputados. Gerada em 11/10/2026. |
| `votacao_candidato_munzona_2022.zip` | `votacao_candidato_munzona_2022_<UF>.csv` | Mesmo ZIP da Presidência; entrada da UF. Gerada em 11/10/2026. |
| `votacao_secao_2022_<UF>.zip` | `votacao_secao_2022_<UF>.csv` | Um ZIP por UF, 2,86 GiB no total (SP: 859 MiB; RJ: 300 MiB; AC: 6 MiB), `Last-Modified` de 22/06/2026; votos de 2022 gerados em 01/11/2022. |

O `votacao_secao_2022_BR.zip` usado pela Presidência contém só o cargo 1. Os ZIPs por UF trazem governador (3), senador (5) e deputados (6, 7, 8); somente o cargo 3 é selecionado, e os demais permanecem nos originais preservados.

A partir desta etapa, `sourceFile` grava ao lado de cada ZIP baixado um registro da resposta HTTP (`<arquivo>.download.json`: data, `Last-Modified`, URL e SHA-256), reaproveitado só para os mesmos bytes. Arquivos baixados antes continuam marcados como data recuperada do sistema de arquivos.

## Auditoria dos originais

Leitura direta dos CSVs, independente do importador (scripts descartáveis, Python `csv`):

- Governador usa as eleições 546 (1º turno) e 547 (2º), `CD_TIPO_ELEICAO` 2, sem trânsito. Houve 2º turno em 12 UFs: AL, AM, BA, ES, MS, PB, PE, RO, RS, SC, SE e SP.
- Identidades da apuração, em todas as UFs e turnos: votos = válidos + brancos + total de nulos + anulados + anulados sub judice; total de nulos = nulos + nulos técnicos; votos concorrentes = válidos + anulados + sub judice. Legenda e apuração em separado: zero.
- **Anulado / Anulado sub judice**: linhas no nominal com essa destinação, votos válidos 0 e situação do registro (ex.: indeferido). Nas seções, aparecem pelo número da candidatura.
- **Nulo técnico**: votos em número de candidatura sem linha no nominal; nas seções, aparecem pelo número, com o nome no `NM_VOTAVEL`, e somam exatamente `QT_VOTOS_NULOS_TECNICOS`. O votável 96 contém só os nulos comuns.
- **RR**: além da eleição ordinária de 2022, as entradas trazem a "Eleição Suplementar Governador 2026" (código 6278, tipo 1, 21/06/2026). Os 160.004 votos sub judice de RR são dessa suplementar; a eleição de 2022 de RR não tem categorias não válidas.

| UF (1º turno) | Anulados | Anulados sub judice | Nulos técnicos |
| --- | ---: | ---: | ---: |
| AM | — | 1.895 | — |
| AP | — | — | 634 |
| BA | 826 | — | — |
| DF | — | — | 373 |
| GO | 258 | — | — |
| MG | 2.012 | — | — |
| MS | 2.892 | — | — |
| PB | 280 | — | — |
| PE | — | — | 368 |
| PI | 15.133 | — | 15.588 |
| PR | 10.337 | — | — |
| RJ | — | — | 6.736 |
| RS | — | — | 248 |
| SC | 829 | — | — |
| SE | — | — | 457.922 |
| TO | 384 | — | — |

Nenhuma dessas categorias ocorre no 2º turno. As demais UFs não têm nenhuma delas.

Em SP, os aptos de governador diferem entre os turnos (+2.306) e também dos da Presidência no mesmo turno. A fonte não explica a diferença nesses arquivos; ela não foi interpretada, e cada recorte usa os próprios valores.

## Decisões de Rafael (15/10/2026)

1. Votos não computados como válidos são apresentados por categoria **e** com identificação da candidatura (número, nome, partido quando a fonte informa, classificação do TSE e situação do registro), num quadro à parte, sem percentual sobre válidos. Nulos técnicos continuam somados aos nulos, com o detalhe visível.
2. Em RR, a suplementar de 2026 é excluída de forma declarada e contada, com aviso na consulta e registro na transparência; tratamento próprio fica para uma etapa futura.

## Regras da importação

- `ElectionScope` define cargo, códigos de eleição por turno, turnos e se o recorte aceita votos não válidos. A Presidência continua com o recorte original (cargo 1, 544/545, sem categorias não válidas). `national.ts`, `exterior.ts` e as publicações da Presidência não foram alterados.
- Os turnos realizados vêm da apuração da UF (`dataset.rounds`); todos os municípios precisam ter todos eles. Linha de turno fora desse conjunto bloqueia.
- v2: por zona, cada candidatura anulada/sub judice é conferida contra o nominal; nulos técnicos são identificados pelos números sem linha no nominal e sua soma precisa coincidir com `QT_VOTOS_NULOS_TECNICOS`, e o 96 com `QT_VOTOS_NULOS`. Destinação diferente de Válido/Anulado/Anulado sub judice, legenda ou apuração em separado bloqueiam. Nulo técnico sem nome na fonte bloqueia.
- Exclusões: só por declaração no importador (cargo, UF, código de eleição, descrição e motivo); as linhas são contadas por entrada e registradas em `dataset.exclusions`. Uma exclusão declarada sem linhas, ou qualquer outro código de eleição, bloqueia.
- Linha de outra UF na entrada, outro cargo ou eleição não auditada bloqueiam; nada é descartado em silêncio.
- Antes da publicação, o importador reconfere no banco os votos por turno/votável (incluindo os não válidos e o 96 = nulos − nulos técnicos), os registros por município e as dimensões.

## Consulta

- `office=governor` exige UF na API e na interface; não há consolidado Brasil nem exterior para o cargo.
- `GET /elections/state` soma os municípios reconciliados da UF (também para a Presidência, a partir da publicação nacional). Resultados de UFs diferentes não são comparáveis.
- Turno não realizado responde `round-not-held` (API) e "Não houve 2º turno…" (interface), distinto de "não importado".
- Totais exibem "dos quais nulos técnicos", anulados e anulados sub judice quando existem; o quadro "Votos não computados como válidos" aparece na UF, nos municípios e nos locais.

## Resultado

- SP piloto (v1, 15/10/2026): `3028e9d1…`, 645 municípios, 1.201.986 registros, 17 min 39 s. Substituído pela v2 (mantido como não publicado).
- v2, 27 UFs: todas publicadas, **5.570 municípios** reconciliados, nenhum bloqueado; **4.404.307 registros** seção/votável; verificação persistida aprovada em todas; 467 ocorrências local/turno com nome ou endereço divergente, preservadas como variantes.
- RR: 6.906 linhas de seção, 16 de apuração e 48 do nominal da suplementar de 2026 excluídas e registradas.
- Tempo somado da v2: cerca de 73 min (SP: 16 min 42 s), pico de RSS de 559 MiB. Banco: 6.035 MB no total, incluindo a Presidência e as versões v1 substituídas.
- As publicações v1 de AC, AL, CE, ES, MA e SP permanecem como não publicadas; MT, PA, RN e RO foram importadas diretamente na v2.

## Verificação

- Comparação independente: totais de participação, votos, categorias não válidas, municípios e cada candidatura (válida ou anulada), por UF e turno, lidos diretamente dos CSVs de apuração e nominal e comparados à API: 522 conferências, nenhuma divergência; turnos não realizados conferidos.
- `npm run typecheck`, `npm test` (46 testes: 15 importador, 15 API, 12 web, 4 contratos) e `npm run build`.
- `npm run smoke:governor`: 27 UFs, 99 requisições — invariantes, turnos, categorias por UF, casos auditados (SE, PR, AM), exclusão de RR, páginas e transparência.
- Regressão da Presidência: `smoke`, `smoke:pilot`, `smoke:places`, `smoke:exterior`, `smoke:summary` (127 requisições) e `smoke:national` (182 requisições, 3 originais conferidos por SHA-256).
- Reexecução com os mesmos originais: "Já publicado", sem duplicação.

Pendentes: revisão visual e auditoria de teclado/leitor de tela em navegador; suplementar de 2026 em RR; senador.
