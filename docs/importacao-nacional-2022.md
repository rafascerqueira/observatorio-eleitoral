# Presidência 2022 — importação nacional

## Escopo

Municípios eleitorais das 27 UFs, com os dois turnos separados. As 181 unidades do exterior (`ZZ`) permanecem nos originais e na preparação, com motivo explícito de separação; não integram a consulta municipal publicada nesta versão. Outros cargos e 2026 não foram importados.

Fontes: [catálogo oficial do TSE](https://dadosabertos.tse.jus.br/dataset/resultados-2022), entradas BR dos três ZIPs já usados no piloto. O arquivo presidencial de seções tem 5.380.736 registros; registros lidos não devem ser confundidos com registros domésticos publicados.

## Correções identificadas na carga real

- A apuração usa códigos municipais com cinco dígitos; as seções omitem zeros iniciais em parte dos códigos. A representação é normalizada por UF/código numérico, sem usar nomes e sem associação IBGE. Os originais não são alterados. A primeira tentativa gerou 6.270 identidades brutas, que correspondem a 5.751 identidades canônicas (5.570 domésticas + 181 exteriores). Ela foi interrompida e nunca publicada; o motivo e o diagnóstico ficam consultáveis.
- Manaus/AM, código `02550`, zona 68: uma seção não instalada e 84 eleitores nessa categoria em cada turno. A partição contém 230 seções distintas por turno nessa zona; com a não instalada, reproduz as 231 principais oficiais. Aptos = comparecimento + abstenção + eleitores de seções não instaladas. Não se alterou a abstenção nem se fabricaram registros de votos para essa seção.
- As fontes municipais foram geradas em 2026 e as seções em 2022. Não se presumiu compatibilidade: candidaturas, votos, participação e seções são conferidos por município/zona/turno. O campo de pendência de totalização final está ausente; seu valor não é inferido.
- Nomes e endereços divergentes de locais continuam com variantes preservadas e campos divergentes indisponíveis. Local de votação não equivale a residência ou a território censitário.

## Execução e transparência

Versão corrigida: `president-2022-national-v2`. As partições completas da primeira leitura são reutilizadas somente quando os hashes/entradas das três fontes coincidem; apuração/nominal são reconferidas diretamente contra os ZIPs e cada partição contra seu SHA-256. Os agregados da tentativa rejeitada não são reutilizados. A maior unidade em memória é o município; São Paulo ainda tem custo maior que municípios pequenos.

Votos, agregados e checkpoint são gravados na mesma transação por município. Todos os municípios domésticos precisam passar antes da troca atômica da versão pública. O piloto fica preservado durante a carga. As chaves nacionais incluem ano, eleição, turno, cargo e identidade territorial pertinente.

`/fontes` distingue o original preservado do arquivo atual no TSE, mostra geração, base da data de download, tamanho e SHA-256, cobertura por UF/situação, cargos ainda não importados e relatório JSON por versão. A tentativa rejeitada é identificada como erro do importador, não como ausência de dados do TSE. A API confere o original antes de servi-lo e recebe arquivos/relatórios por volumes somente leitura.

## Verificação reproduzível

```sh
npm run typecheck
npm test
npm run build
npm run import:national
npm run verify:national -w @observatorio/importer
npm run smoke:national
npm run smoke:pilot
npm run smoke:places
```

`verify:national` confere registros persistidos por município, soma de votos por turno/votável contra todas as candidaturas/brancos/nulos e dimensões de eleição/ano/cargo/UF. Registra volumes do PostgreSQL no relatório. `smoke:national` consulta as 27 UFs nos dois turnos, testa locais/seções, paginação, estados sem publicação, Manaus, transparência e os bytes/checksums dos três originais baixados por HTTP.

## Resultado da validação local

Publicação `0a095fc5e2bbc7c416844867e0e6244096e67d0bd3da7316cdf0dae6018031d3`, importador `president-2022-national-v2`:

- 5.570 municípios domésticos reconciliados, nenhum bloqueado; 181 unidades exteriores separadas.
- 5.368.073 registros seção/votável persistidos; 12.663 registros de ZZ preservados na preparação/original, não publicados na consulta municipal. A soma reproduz os 5.380.736 lidos.
- 11.140 agregados município/turno; 12.204 agregados município/zona/turno; 184.722 agregados de identificadores de local por município/zona/turno. Não são contagens de prédios físicos ou zonas únicas do Brasil.
- 635 ocorrências local/turno com metadados divergentes, preservadas no relatório e nos detalhes dos locais. Não implicam divergência de votos.
- Conferência persistida por município e por turno/votável: nenhuma divergência. A regra de Manaus foi reconferida diretamente contra o ZIP de apuração e as seções no banco.
- Execução corrigida, com preparação já concluída: 1.238 segundos (20 min 38 s), pico de RSS de 594 MiB. Esse tempo **não inclui a primeira leitura/preparação nacional**, nem é previsão para outros cargos.
- PostgreSQL medido após o índice adicional: 3.397.867.199 bytes (3,16 GiB) no banco; 2.806.136.832 bytes (2,61 GiB) na tabela nacional de seções e seus índices. Esses volumes incluem a tentativa rejeitada preservada; o banco inclui também o piloto. Não incluem WAL, backups ou originais/preparação fora do PostgreSQL.
- 19 testes automatizados, tipos, builds local/Docker, smoke do piloto e estados gerais passaram. O smoke nacional passou com 182 requisições às 27 UFs/dois turnos e conferiu os bytes/SHA-256 dos três ZIPs servidos. A busca de locais passou com 40 requisições.
- Reexecução da importação conferiu os originais e reutilizou a publicação, sem duplicação; a auditoria posterior confirmou as mesmas quantidades.

Na primeira rodada concorrente (auditoria integral, downloads e busca), uma consulta apenas por seção em São Paulo atingiu o timeout de 2 segundos da API. A repetição isolada passou. Foi adicionado `national_section_lookup`, com seção antes de zona/local. O plano passou de 2.049 buscas internas para um merge semi join sobre o índice de seção; uma execução local medida foi de 57,2 ms para 9,4 ms. A rodada posterior com auditoria concorrente passou: máximo de 239 ms nas 40 requisições de locais e 716 ms até os cabeçalhos nas 182 nacionais, incluindo arquivos. Caches/carga diferem entre rodadas; não é benchmark de produção, e o tempo até cabeçalhos não representa o download completo dos ZIPs.

Relatório completo: `data/audit/0a095fc5e2bbc7c416844867e0e6244096e67d0bd3da7316cdf0dae6018031d3.json`, também disponível pela transparência. Builds e testes semânticos/HTTP não substituem revisão visual ou auditoria completa de acessibilidade; estas permanecem pendentes.

## Próximo passo

Governador e senador por UF, com cobertura de turnos própria e regras de destinação de votos auditadas. Deputados terão apresentação resumida sem descartar registros, distinguindo votos nominais e de legenda. Seus volumes maiores exigirão revisar a unidade de preparação/memória; não se presume que a carga inteira caiba em um município na RAM. Não há atribuição automática de eleitos/cadeiras, ideologia, renda ou motivação individual.
