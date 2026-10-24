# Mente Eleitoral

![Mente Eleitoral — Um olhar único sobre votação e população](apps/web/public/brand/banner.svg)

**Um olhar único sobre votação e população.**

Observatório eleitoral brasileiro independente, público, gratuito e sem fins lucrativos. Reúne os resultados oficiais das eleições, publicados pelo TSE, e o contexto dos territórios, medido pelo IBGE, para que qualquer pessoa possa explorar como se votou em cada lugar e quem vive ali.

O projeto não parte de uma tese política a confirmar. Ele mostra os números, com fonte, cobertura e denominador, e deixa as perguntas para quem consulta.

## Princípios

- **Só dados oficiais.** Nenhum número eleitoral ou socioeconômico é estimado ou inventado para preencher a tela. Sem dados importados, a interface mostra o estado vazio.
- **Ausente não é zero.** Valor que falta fica indisponível, e denominador zero não vira percentual.
- **Divergência bloqueia a publicação.** Votos que não fecham, chaves duplicadas ou categorias não auditadas impedem a carga, em vez de serem corrigidos em silêncio.
- **Somas, não médias.** Agregados somam votos e denominadores, nunca a média de percentuais. Liderança não é maioria absoluta.
- **Mesmos critérios para todas as candidaturas.** Sem rótulos ideológicos ou de classe e sem interpretação política automática. Abstenção, brancos e nulos não indicam motivação.
- **Lugar não é pessoa.** Seção, local de votação, zona, bairro e setor censitário são coisas diferentes. O endereço do local de votação não é a residência do eleitor, e o setor descreve o entorno do prédio, não quem vota ali.
- **Tudo verificável.** Cada publicação guarda os arquivos originais com SHA-256 e um relatório de auditoria, ambos disponíveis para download.

## O que você encontra

Resultados de **2022**, com turnos sempre separados:

- **Presidência, no Brasil e no exterior:** consolidado dos 5.570 municípios e das 181 localidades do exterior. O exterior tem consulta própria por localidade, sem equivalência presumida a país.
- **Governador e Senador nas 27 UFs:** resultado da UF, dos municípios e dos locais de votação, com o 2º turno de Governador nas 12 UFs onde ocorreu.
- **Consulta municipal:** filtros por cargo, turno, UF e nome, com sugestões tolerantes a acentos e erros de digitação. O detalhe mostra todas as candidaturas, brancos, nulos e votos não válidos, e funciona sem JavaScript.
- **Locais de votação:** busca por zona, seção, código, nome ou endereço, com as seções de cada local e o setor censitário associado ao ponto.

Votos anulados, anulados sub judice e nulos técnicos mantêm a classificação da fonte, com a candidatura identificada quando houver e os denominadores explícitos.

Território e perfis:

- **Contexto municipal:** população, cor ou raça, alfabetização, instrução e rendimento (Censo 2022); entorno dos domicílios (calçada, rampa, iluminação, pavimentação, ponto de ônibus e árvores); cadastro e comparecimento do eleitorado por perfil (TSE).
- **Participação** (`/participacao`): comparecimento e abstenção por UF e município, turno, gênero, idade, escolaridade, estado civil e obrigatoriedade do voto.
- **Perfis dos locais** (`/perfis`): votos somados por grupos de locais com perfis parecidos (escolaridade, idade, parcela de eleitoras ou renda do setor), com cobertura e limites declarados.
- **Mapas** (`/mapa`): um indicador do Censo ao lado da abstenção ou da votação de uma candidatura, com dispersão e exportação em CSV; mapas por candidatura em escala comum; e o mapa dos locais de votação sobre os setores censitários de cada município. Cada visualização tem uma tabela equivalente.
- **Propostas de governo** (`/propostas`): busca literal no texto dos planos que as candidaturas à Presidência de 2022 registraram no TSE. Todas as candidaturas aparecem na ordem do número, nunca por quantidade de menções.
- **Fontes** (`/fontes`): versões, cobertura, relatórios de auditoria e arquivos originais preservados.

## Fontes de dados

- **TSE**, Portal de Dados Abertos: resultados por seção, apuração e votação nominal, perfil do eleitorado e comparecimento, locais de votação e propostas de governo.
- **IBGE:** Censo Demográfico 2022 (agregados por município e por setor censitário) e malhas territoriais.

Os cruzamentos entre TSE e IBGE usam códigos oficiais, nunca nomes de municípios. Métodos, dicionários e limites de cada base estão na página de metodologia e em [`docs/`](docs).

## Situação

O projeto roda **localmente**, ainda sem endereço público. O escopo atual é a eleição de 2022. A carga de 2026 vem depois do 2º turno, e os cargos de deputado estão fora do escopo. A codificação documental das propostas (uma rubrica de acessibilidade e mobilidade e uma bússola política com dois eixos) está em preparação e ainda não publica nada. A licença ainda não foi definida.

## Executar localmente

Requisitos: Node.js 24.21.0 (veja `.nvmrc`), npm 11 ou superior, Docker e Docker Compose. Para importar os dados, também `unzip` e, só para as propostas de governo, Poppler e Tesseract com o idioma português.

```sh
test -f .env || cp .env.example .env
npm ci
npm run db:up      # PostgreSQL com PostGIS
npm run dev        # API em 127.0.0.1:3001 e web em localhost:3000
```

Abra <http://localhost:3000>. Para ver resultados, importe antes os dados oficiais (por exemplo, `npm run import:national` para a Presidência). As importações são longas e exigem bastante disco. A ordem, as dependências, as versões, a execução completa em Docker e as verificações estão em [operação local](docs/operacao.md).

Para conferir o código:

```sh
npm run typecheck
npm test
npm run build
```

## Estrutura

```text
apps/api/            NestJS: rotas públicas de consulta (contrato em docs/api.md)
apps/importer/       Download, preparação, reconciliação, carga e verificação dos dados
apps/web/            Next.js: consultas, mapas, perfis, participação, propostas, fontes e metodologia
packages/contracts/  Esquemas Zod e tipos compartilhados entre web, API e importador
scripts/             Inicialização, smoke tests, regressões e auditorias
docs/                Operação, decisões técnicas, contrato da API, auditorias e planos
```

## Documentação

- [Operação local](docs/operacao.md): execução, importações, validação, verificações e codificação das propostas.
- [Decisões técnicas](docs/decisoes-tecnicas.md) e [contrato da API](docs/api.md).
- Auditorias das cargas: [Presidência](docs/importacao-nacional-2022.md), [exterior](docs/exterior-2022.md), [Governador](docs/governador-2022.md), [Senador](docs/senador-2022.md) e [IBGE e perfis](docs/plano-ibge.md).
- [Acessibilidade](docs/acessibilidade.md) e [identidade visual](docs/identidade/2026-10-19/README.md).
- [Planejamento](plan.md): finalidade, princípios, decisões, histórico e pendências.
- [`AGENTS.md`](AGENTS.md): orientações para assistentes de código.
