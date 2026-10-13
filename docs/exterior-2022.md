# Exterior e seções não instaladas — Presidência 2022

## Identidade territorial

O TRE-DF identifica uma única [Zona Eleitoral do Exterior (ZZ)](https://www.tre-df.jus.br/servicos-eleitorais/eleitor-no-exterior/eleitor-no-exterior). O TSE usa ZZ como unidade territorial, com localidades eleitorais identificadas por nome e código. Todas as unidades auditadas têm zona 1; país não é uma zona eleitoral e não foi inferido a partir do nome da cidade.

A interface oferece “Exterior — ZZ” na seleção territorial, consolidado próprio, lista de localidades e busca de locais/seções. Não é uma reprodução visual pixel a pixel do aplicativo TSE: a configuração histórica de 2022 consultada não estava disponível e não houve navegador para inspeção visual. Não há agrupamento por país sem correspondência oficial auditada.

## Publicação e auditoria

- Versão: `president-2022-exterior-v1`.
- ID: `07b2595f40887756b48dd85a9f78ebc8c464fd115245bcbea223dfb7390276b9`.
- Cobertura: 181 localidades, 362 agregados localidade/turno, 12.663 linhas seção/votável, sem divergências.
- Fontes: os mesmos três ZIPs preservados da publicação doméstica, com arquivos, entradas, SHA-256 e datas consultáveis em Fontes.

O importador relê apuração e votação nominal dos ZIPs, verifica seus CRCs, verifica os originais por SHA-256 e os checksums/contagens das partições de ZZ da preparação nacional completa. Não repete a leitura integral da entrada nacional de seções: usa a preparação já concluída e auditada. A persistência é comparada com cada agregado e cada linha de seção, incluindo identidade territorial completa e votos. A publicação ocorre somente após essa verificação; uma reexecução confirmou idempotência e zero divergências, sem duplicação.

O relatório está em `data/audit/<id>.json`, acessível também pela transparência. O histórico doméstico continua registrando ZZ separado/excluído daquela carga. A API combina as duas publicações somente com cobertura completa e fontes idênticas, expondo os dois IDs; incompatibilidade gera indisponibilidade explícita.

| Indicador de ZZ | 1º turno | 2º turno |
| --- | ---: | ---: |
| Aptos | 695.355 | 695.578 |
| Comparecimento | 304.032 | 310.148 |
| Abstenção | 390.750 | 384.857 |
| Válidos | 294.525 | 298.169 |
| Brancos | 4.857 | 5.900 |
| Nulos | 4.650 | 6.079 |
| Eleitores de seções não instaladas | 573 | 573 |
| Seções não instaladas | 46 | 46 |

Há 42 localidades com zero votos, incluindo 41 com todas as seções não instaladas. Ciudad Guayana tem seção instalada, comparecimento zero e 75 abstenções em cada turno. A exceção de ausência de linhas de votação exige totais oficiais zero; não converte dados ausentes em zero nem enfraquece a reconciliação doméstica. Votos em trânsito/categorias não auditadas, duplicatas e divergências continuam bloqueando publicação.

## O que são os 84 eleitores do aviso anterior?

Na apuração oficial preservada, Manaus (AM, código 02550), zona 68, registra uma seção não instalada e 84 eleitores vinculados a essa categoria em cada turno. São eleitores aptos, não votos. O arquivo não informa o motivo da não instalação nem identifica nessa linha o número da seção; não se deve inferir causa, fraude ou comportamento individual.

- 1º turno, zona 68: 87.671 aptos = 72.962 comparecimentos + 14.625 abstenções + 84 eleitores de seção não instalada.
- 2º turno, zona 68: 87.671 aptos = 72.025 comparecimentos + 15.562 abstenções + 84 eleitores de seção não instalada.

Os turnos não são somados como pessoas distintas: isso não significa 168 eleitores. A fonte mantém a categoria separada da abstenção. Com o exterior incluído, o aviso nacional passa a 657 eleitores (84 de Manaus + 573 de ZZ) em 47 seções (1 + 46), em cada turno. O painel explica a distinção e permite abrir a distribuição por localidade.

## Verificação e limites

Passaram 36 testes automatizados, verificação de tipos e build Docker. Os testes cobrem contratos, reconciliação, conservação dos indicadores, percentuais, isolamento ZZ/doméstico, filtros, erros e navegação. O smoke do consolidado passou em 127 requisições, comparando todas as 5.570 unidades domésticas e 181 localidades de ZZ nos dois turnos; passaram também 26 requisições de formulários/exterior, 40 de locais e o smoke do piloto. A consulta de locais preserva os totais do local inteiro, mesmo quando uma seção é usada para encontrá-lo.

A revisão visual, o feedback de consulta em navegador real e a auditoria de teclado/leitor de tela ainda estão pendentes por ausência de navegador controlável neste ambiente. Autocomplete fica para uma etapa posterior. Não houve publicação externa; outros cargos, IBGE e dados de 2026 permanecem fora deste marco.
