# Avaliação: resultados de 2026 (1º turno) — 22/10/2026

Levantamento somente de leitura, para Rafael decidir o recorte. **Nada foi importado.** Os ZIPs grandes não foram baixados: o conteúdo foi lido pelo índice dos ZIPs e pelo início de cada CSV, com requisições HTTP parciais (Range). Só o detalhe por zona (2,5 MB) e o relatório de totalização da Presidência foram baixados, para uma pasta temporária fora do repositório.

## O que o TSE já publicou

Catálogo `resultados-2026` (dadosabertos.tse.jus.br), metadados de 08/10/2026:

| Arquivo | Tamanho | Gerado / modificado |
| --- | --- | --- |
| `detalhe_votacao_munzona_2026.zip` | 2,5 MB | CSVs gerados em 22/10/2026 19:32; ZIP em 22/10 11:51 (cabeçalho HTTP) |
| `votacao_candidato_munzona_2026.zip` | 466 MB | **regerado em 22/10/2026 23:10** |
| `votacao_secao_2026_<UF>.zip` (BR + 27 UFs) | 2,76 GB no total (SP 767 MB; `BR` 162 MB, com CSV de 1,05 GB) | 06/10/2026 |
| `votacao_secao_2026_ZZ.zip` | 181 KB | CSV de 359 bytes: **só o cabeçalho** |
| `Relatorio_Resultado_Totalizacao_2026_*.zip` | PDFs | 06–07/10/2026 |

SHA-256 do detalhe lido: `384d847c9ad033ce6787f68affc930d23876c45b6054326422fb601963c0e715`.

## O que os arquivos mostram

- **Eleições e turnos:** só o 1º turno, de 04/10/2026. Presidência na eleição 6257; Governador, Senador e deputados na 6259. Não há linhas de voto em trânsito separadas (`ST_VOTO_EM_TRANSITO = N`).
- **Presidência:** 6.106 linhas municipais/zonais no Brasil e 186 do exterior (`ZZ`), todas no arquivo `BR`. Aptos 158.745.502, comparecimento 125.275.835, válidos 119.300.788 (o mesmo total do relatório de totalização), brancos 2.300.798, nulos 3.674.249, dos quais 5.246 nulos técnicos. Sem anulados nem sub judice. O relatório do TSE marca duas candidaturas para o **2º turno, em 25/10/2026**.
- **Exterior:** o ZIP de seções `ZZ` está vazio. Como em 2022, as linhas do exterior devem estar no arquivo de seções `BR`; isso precisa ser confirmado na leitura completa.
- **Governador:** 27 UFs, votos = comparecimento em todas. Categorias não válidas em 14 UFs (anulados em MG e PI; sub judice em DF, MA, PA, PI, PR, RN, RR, RS e SE; nulos técnicos em DF, PB, RJ, RN, SE, SP e TO). Todas cabem na regra decidida para o Governador de 2022 (§18 do `plan.md`). Pode haver 2º turno em algumas UFs, também em 25/10.
- **Senador:** 27 UFs, **votos = 2 × comparecimento em todas** (duas vagas). Sub judice em 18 UFs, anulados em MG e PI, nulos técnicos em AM, DF, MS, PI e SP.
- **Formato:** as mesmas colunas de 2022, na mesma ordem. Mudam as aspas (números sem aspas) e a caixa dos textos ("Presidente", "Eleição Ordinária", em vez de maiúsculas). O código de município aparece sem aspas nas seções; os zeros à esquerda precisam ser conferidos na leitura completa (o importador já completa com `padStart(5, '0')`).
- **Arquivos ainda mudando:** o nominal foi regerado hoje, às 23:10, depois da geração do detalhe (19:32). Há muitos votos sub judice, e a classificação deles pode mudar. As seções são de 06/10.

## O que precisaria mudar no código

1. **Senado com duas vagas.** `model.ts:189` exige `comparecimento = total de votos` por zona; com o Senado de 2026 a publicação seria bloqueada, como deve. É preciso declarar no `ElectionScope` os votos por eleitor (2) e decidir com Rafael como apresentar: percentual dos válidos (padrão do TSE, sobre votos e não sobre pessoas) e o que mostrar como "eleitores". Também é preciso auditar se a urna permite dois votos na mesma candidatura e como brancos e nulos entram em cada um dos dois votos.
2. **Ano fixo em 2022.** `ElectionScope.year`, `datasetSchema.year` (contratos), caminhos e nomes em `sources.ts` e o filtro `ANO_ELEICAO === '2022'` do exterior. Os filtros da API e da web já aceitam `2026`, e a seleção da publicação confere o ano (§27).
3. **Novas definições de escopo:** `PRESIDENT_2026` (6257), `GOVERNOR_2026` e `SENATOR_2026` (6259), com os códigos do 2º turno quando forem publicados.
4. **Derivados ligados aos locais.** Associação local → setor, perfil por local, métrica E, sensibilidade e mapa de setores usam o cadastro de locais de 2022. Locais de 2026 mudam de número e endereço; cada derivado precisaria de uma versão própria para 2026, com nova associação aos setores do Censo 2022. Sem isso, 2026 entra com resultados por município, zona e local, sem os cruzamentos com o IBGE.
5. **Comparações 2022 × 2026:** só depois de validar os dois conjuntos, e por município (os locais não se casam por número).

## Espaço estimado

| Item | Estimativa |
| --- | --- |
| Originais (seções 2,76 GB + nominal 0,47 GB + detalhe) | ~3,2 GB |
| `data/staging` | ~3–4 GB, por comparação com 2022 |
| Banco: votos por seção | Em 2022, as publicações vigentes do 1º turno têm 3,53 mi (Presidente), 3,41 mi (Governador) e 3,79 mi (Senador) de linhas. Em 2026, o Senado com duas vagas tende a ter mais candidaturas por UF. Estimativa: 11–12 mi de linhas, ~4,5–5 GB com índices |
| Banco: resultados por local, zona e município | ~0,6–0,8 GB |
| **Total** | **~11–13 GB** |

Disco livre hoje: 59 GB. Banco: 12 GB.

Achado lateral: `national_section_votes` guarda 7,3 mi de linhas de publicações antigas, não publicadas (Governador e Presidente). Isso é cerca de um terço da tabela, ou ~3 GB. A limpeza já estava prevista no §11 e liberaria espaço, sempre com backup antes.

Achado lateral 2: o TSE também regerou hoje (22/10, 07:19) o `votacao_candidato_munzona_2022.zip`, com 580.415.737 bytes; o original preservado tem 579.632.297. As publicações de 2022 continuam ligadas ao original preservado. Vale uma auditoria da diferença antes de qualquer reimportação de 2022.

## Recomendação

- **Esperar o 2º turno (25/10) e a estabilização dos arquivos**: nominal regerado hoje, sub judice em boa parte das UFs. Depois, carregar os dois turnos de uma vez, com versões novas (`president-2026-v1` e afins), em vez de publicar o 1º turno agora e reimportar logo em seguida.
- Se Rafael quiser o 1º turno já, a ordem de menor risco é: (1) Presidência no Brasil e exterior, com as mesmas regras de 2022; (2) Governador, nas regras do Governador v2; (3) Senador, só depois da decisão sobre as duas vagas. Em todos os casos, a publicação deve declarar que os resultados são provisórios enquanto houver sub judice.
- Decisões de Rafael: esperar ou não o 2º turno; Senado com duas vagas (apresentação); fazer ou não a limpeza das publicações antigas antes; derivados do IBGE para 2026 agora ou depois.

## Decisões de Rafael (22/10/2026)

1. **Esperar** o 2º turno e a estabilização dos arquivos, e carregar os dois turnos juntos.
2. **Senado com duas vagas:** apresentação simples, com as candidaturas listadas pela quantidade de votos e as eleitas destacadas, e um texto explicando que cada eleitor escolheu duas candidaturas (total de votos = 2 × comparecimento; percentuais sobre os votos válidos). A situação de eleita vem do campo de situação do TSE, não da posição na lista, porque votos sub judice podem mudar o resultado.
3. **Limpeza das publicações antigas antes da carga:** de acordo. Inventário de 22/10 (somente leitura): 52 lotes não publicados (Governador 33, contexto 7, locais 8, mapas 2, Presidente 1, propostas 1), de 12 a 20/10/2026. Nenhum é citado nos metadados das publicações vigentes. Proposta de execução: backup completo; apagar só as linhas de dados desses lotes (manter as linhas de `import_batches`, que são pequenas e guardam a rastreabilidade); depois `VACUUM FULL` nas tabelas afetadas, para devolver o espaço ao disco (precisa de espaço livre igual ao tamanho da tabela, ~5,5 GB em `national_section_votes`).
4. Pesquisa do espectro: ver [plano da bússola política](plano-bussola-politica.md).
5. Merge da atualização do Next.js no `main`: feito.
