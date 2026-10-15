# Governador 2022 — piloto São Paulo

Registro de 15/10/2026. Primeiro cargo estadual importado, com SP como UF piloto (escolha de Rafael). A unidade publicada é a UF inteira: governador é eleito por UF, então o recorte inclui os 645 municípios de SP, e o resultado da UF é a soma dos municípios reconciliados.

## Fontes

| Arquivo | Entrada | Observação |
| --- | --- | --- |
| `detalhe_votacao_munzona_2022.zip` | `detalhe_votacao_munzona_2022_SP.csv` | Mesmo ZIP (e SHA-256) da Presidência; entrada da UF, com governador, senador e deputados. |
| `votacao_candidato_munzona_2022.zip` | `votacao_candidato_munzona_2022_SP.csv` | Mesmo ZIP da Presidência; entrada da UF. |
| `votacao_secao_2022_SP.zip` | `votacao_secao_2022_SP.csv` | Novo download: 900.947.881 bytes, SHA-256 `36c417ab6af3fc0a69c01a2ae5ee34d05fb8f2068eee70565c693ebef059688e`, `Last-Modified: Mon, 22 Jun 2026 14:44:46 GMT`; CSV de 5.418.787.274 bytes e 18.761.482 linhas. |

O `votacao_secao_2022_BR.zip` usado pela Presidência contém só o cargo 1 ("Eleição Geral Federal 2022"); os votos por seção dos cargos estaduais estão nos ZIPs por UF. O de SP traz governador (cargo 3), senador (5), deputado federal (6) e estadual (7), sem Presidência. Somente o cargo 3 é selecionado; os demais permanecem no original preservado.

A partir desta etapa, `sourceFile` grava ao lado de cada ZIP baixado um registro da resposta HTTP (`<arquivo>.download.json`: data, `Last-Modified`, URL e SHA-256). Ele só é reaproveitado para os mesmos bytes; arquivos baixados antes continuam marcados como data recuperada do sistema de arquivos.

## Auditoria prévia dos originais

Leitura direta dos CSVs, independente do importador (script descartável, Python `csv`):

- Apuração SP, cargo 3: eleição 546 no 1º turno e 547 no 2º, `CD_TIPO_ELEICAO` 2, 780 linhas município/zona por turno, todas `ST_VOTO_EM_TRANSITO = N`. Anulados, anulados sub judice, nulos técnicos, apuração em separado, votos de legenda e seções não instaladas: zero nos dois turnos.
- Nominal SP, cargo 3: 10 candidaturas no 1º turno e 2 no 2º, todas com destinação `Válido`, sem trânsito; votos nominais = nominais válidos.
- Seções SP, cargo 3: 797.931 registros no 1º turno e 404.055 no 2º, geração 01/11/2022 (as entradas de apuração e nominal foram geradas em 2026). 101.073 seções por turno em 645 municípios, igual à soma de `QT_SECOES_PRINCIPAIS`.
- A soma por votável nas seções coincide exatamente com o nominal (cada candidatura) e com a apuração (brancos 95, nulos 96), nos dois turnos.

| Turno | Aptos | Comparecimento | Abstenção | Válidos | Brancos | Nulos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1º | 34.639.761 | 27.147.847 | 7.491.914 | 23.352.549 | 1.645.522 | 2.149.776 |
| 2º | 34.642.067 | 27.341.816 | 7.300.251 | 24.390.014 | 1.102.504 | 1.849.298 |

Os aptos de governador diferem entre os turnos (+2.306) e também dos aptos da Presidência em SP no mesmo turno (34.684.927 no 1º). A fonte não explica a diferença neste arquivo; ela não foi interpretada, e cada recorte usa os próprios valores, sem somar eleitores entre turnos ou cargos.

## Regras da importação (`governor-2022-state-v1`)

- `ElectionScope` define cargo, códigos de eleição por turno e turnos esperados. A Presidência continua com o recorte anterior (cargo 1, 544/545); as regras e as versões publicadas da Presidência não foram alteradas, e `national.ts`/`exterior.ts` não foram modificados.
- Linha de outra UF na entrada da UF, outro cargo, eleição não auditada ou turno não esperado **bloqueiam** a importação; nada é descartado em silêncio.
- Cada município passa pelas mesmas conferências da Presidência, por zona e turno. Votos, agregados e checkpoint são gravados na mesma transação, nas tabelas territoriais com ano/cargo/UF na chave.
- Antes da troca pública, o importador reconfere no banco os votos por turno/votável contra os agregados, os registros por município contra a cobertura e as dimensões (ano, cargo, eleição por turno). Só então publica `2022/governor/SP`.
- Os turnos realizados são lidos da apuração da UF e gravados em `dataset.rounds`. Uma UF sem 2º turno é bloqueada por enquanto: a consulta ainda não distingue "turno não realizado" de "não importado".

## Consulta

- `office=governor` exige `uf` na API e na interface; não há consolidado Brasil nem exterior para o cargo.
- `GET /elections/state` soma os municípios reconciliados da UF (também disponível para a Presidência, a partir da publicação nacional). Resultados de UFs diferentes não são comparáveis.
- A página inicial, com uma UF escolhida, mostra o resultado da UF e a lista de municípios; os locais de votação preservam o cargo em formulários e links.

## Resultado da carga

Publicação `3028e9d1cb103e31af1f04502c6929cc8f7bcd7c6f9e56a4e61e72521ff0dbf6`, escopo `2022/governor/SP`, importador `governor-2022-state-v1`:

- 645 municípios reconciliados nos dois turnos, nenhum bloqueado; 1.290 agregados município/turno, 1.560 município/zona/turno e 21.692 identificadores de local por município/zona/turno (não são prédios únicos).
- 1.201.986 registros seção/votável persistidos (797.931 + 404.055), selecionados de 18.761.482 linhas do CSV de seções; 20.185.756 linhas das três entradas ficaram fora do recorte (outros cargos), preservadas nos originais.
- Verificação persistida antes da publicação: votos por turno/votável iguais aos agregados, nenhum município com contagem divergente, nenhum registro fora de ano/cargo/eleição.
- 13 ocorrências local/turno com nome ou endereço divergente, preservadas como variantes; não afetam votos.
- Execução completa, incluindo a primeira preparação: 1.059 s (17 min 39 s), pico de RSS de 533 MiB. Preparação em `data/staging/state`: 266 MiB. Banco após a carga: 3.769 MB no total (antes, 3,16 GiB medidos na publicação nacional); a diferença inclui índices e não é medida isolada desta versão.
- Reexecução com os mesmos originais: "Já publicado", sem duplicação.

## Verificação

- `npm run typecheck`, `npm test` (41 testes: 13 importador, 13 API, 11 web, 4 contratos) e `npm run build`.
- `npm run smoke:governor`: 26 requisições conferindo API e páginas contra os totais lidos diretamente dos originais, isolamento entre cargos/UFs, UF obrigatória e transparência.
- Regressão da Presidência: `smoke`, `smoke:pilot`, `smoke:places`, `smoke:exterior` (asserção do seletor de cargo atualizada: com dois cargos, o cargo deixou de ser apenas contexto), `smoke:summary` (127 requisições, todos os 5.570 municípios) e `smoke:national`.

Pendentes: revisão visual e auditoria de teclado/leitor de tela em navegador; tratamento de UF sem 2º turno; demais UFs.
