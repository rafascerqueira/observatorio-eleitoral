# Bússola política: livro de códigos

Versão `bussola-kieskompas-v1`, proposta em 22/10/2026 a partir do [plano da bússola política](plano-bussola-politica.md), no modelo do Kieskompas escolhido por Rafael. **As 24 afirmações da seção 4 foram aprovadas por Rafael em 22/10/2026**; acréscimos futuros entram em novas versões (seção 8). Nenhum documento foi codificado e nada foi publicado. Afirmações, escala, termos, mínimo e reamostragem estão no código em `apps/importer/src/compass-core.ts`; mudar qualquer um deles exige nova versão.

## 1. Finalidade e limites

A bússola situa cada plano de governo da Presidência de 2022 em dois eixos, a partir do que o **próprio plano** diz sobre 24 afirmações. Cada posição tem página e trecho.

- Mede o documento, não a candidatura: entrevistas, debates, votações e o histórico do partido ficam fora. O mesmo plano tem a mesma posição, seja qual for a opinião de quem codifica.
- Não há afinidade com o visitante, ranking nem recomendação. A página mostra onde cada plano fica e por quê, com os trechos.
- "Sem posição" quer dizer posição não localizada no texto revisado. Nunca vira neutro nem zero.
- Rótulos dos eixos sem termos pejorativos (decisão de Rafael, 22/10/2026).
- **Quem codifica (decisão de Rafael, 22/10/2026):** a codificação A foi feita pelo Claude (modelo de linguagem), declarada como tal; a codificação B será de uma pessoa, sem ver a A; a adjudicação das divergências é humana. A publicação informa quem fez cada codificação.
- São 12 documentos, como na rubrica da D3: o nº 14 tem um documento para duas candidaturas, e o nº 90, inapto e sem votos, entra na codificação e é listado à parte.

## 2. Modelo

**Origem:** o Kieskompas (Países Baixos), criado por André Krouwel. Na versão documentada em 2024 (Volebný Kompas, Eslováquia), as pessoas que codificam situam cada partido em cada afirmação numa escala de cinco pontos, cada uma indicando fonte e trecho. Cada afirmação tem polaridade +1 ou −1 num eixo, e o plano tem um eixo socioeconômico e outro sociocultural. A concordância é medida pelo kappa ponderado (lá, 0,84).

**Eixos:**

| Eixo | −1 | +1 |
| --- | --- | --- |
| Economia (horizontal) | esquerda: mais Estado na economia, mais redistribuição | direita: mais mercado, menos tributo e gasto |
| Costumes (vertical) | progressista | conservador |

Meio ambiente e clima ficam no eixo de costumes, como no polo "green" da dimensão GAL–TAN do Chapel Hill Expert Survey.

**Diferenças em relação ao Kieskompas, declaradas:**
1. Sem autoposicionamento das candidaturas: a eleição de 2022 acabou, e contatar campanhas exigiria decisão de Rafael.
2. Fonte única: o plano de governo registrado no TSE. O Kieskompas também usa declarações públicas.
3. "Sem posição" fica fora da média. O Volebný Kompas a recodifica para o ponto neutro, o que este projeto não faz, porque ausente não vira zero.
4. Adjudicação registrada linha a linha, com justificativa, como na D3.

## 3. Escala

| Valor | Uso | Número |
| --- | --- | --- |
| `concorda-totalmente` | O plano propõe a medida, ou equivalente direto, como compromisso | +1 |
| `tende-a-concordar` | O plano aponta na direção da afirmação sem se comprometer com a medida, ou com condições e ressalvas | +0,5 |
| `neutra` | O plano trata do assunto da afirmação sem tomar posição, ou com posição ambivalente | 0 |
| `tende-a-discordar` | O plano aponta na direção contrária sem se comprometer, ou com condições | −0,5 |
| `discorda-totalmente` | O plano propõe o contrário como compromisso (manter o que a afirmação muda, revogar o que ela mantém) | −1 |
| `sem-posicao` | Assunto não localizado no texto revisado | fora do cálculo |

**Regras de decisão:**
- **Literalidade:** codifica-se o que está escrito. Sem inferir pela candidatura, pelo partido ou por conhecimento externo.
- **Mais de um trecho:** vale o mais explícito. Se houver trechos em direções opostas, `neutra`, com os dois registrados na observação.
- **Manter o estado atual:** quando a afirmação pede mudança ("ampliar", "reduzir", "revogar") e o plano propõe manter como está, isso é discordar. Quando a afirmação pede manutenção ("deve ser mantida"), propor manter é concordar.
- **Parte da afirmação:** concordar com uma das alternativas da afirmação ("cotas **ou** outras ações afirmativas") basta. Afirmações com "inclusive" ou "mesmo com" exigem a parte qualificada para `concorda-totalmente`; sem ela, no máximo `tende-a-concordar`.
- **Diagnóstico sem proposta:** descrever um problema sem dizer o que fazer é `neutra`, não posição.
- **Dúvida:** vai para a observação, sem decidir pela outra pessoa.

## 4. Afirmações

Seis por polo em cada eixo, para que concordar com tudo não empurre o plano para um lado. "Polo" é para onde a concordância leva.

### Economia

| Código | Polo | Afirmação |
| --- | --- | --- |
| `e01-estatais-bancos-publicos` | esquerda | O Estado deve ampliar o papel de empresas estatais e de bancos públicos no investimento e no crédito. |
| `e02-privatizacao` | direita | Empresas estatais devem ser privatizadas ou ter serviços concedidos à iniciativa privada. |
| `e03-tributacao-progressiva` | esquerda | A tributação deve ficar mais progressiva, cobrando mais de altas rendas, lucros e dividendos ou grandes fortunas. |
| `e04-carga-tributaria` | direita | A carga tributária total deve ser reduzida. |
| `e05-salario-minimo` | esquerda | O salário mínimo deve ter política permanente de aumento acima da inflação. |
| `e06-reforma-trabalhista` | direita | A reforma trabalhista de 2017 deve ser mantida ou aprofundada, com regras de trabalho mais flexíveis. |
| `e07-teto-de-gastos` | esquerda | O teto de gastos deve ser revogado ou substituído por regra que permita ampliar o gasto e o investimento públicos. |
| `e08-abertura-comercial` | direita | O comércio exterior deve ser mais aberto, com redução de tarifas e de barreiras à importação. |
| `e09-reforma-agraria` | esquerda | A reforma agrária deve ser ampliada, inclusive com desapropriação de terras. |
| `e10-banco-central` | direita | A autonomia do Banco Central deve ser mantida. |
| `e11-transferencia-de-renda` | esquerda | Os programas de transferência de renda devem ser ampliados ou tornados direito permanente. |
| `e12-privado-em-servicos` | direita | A iniciativa privada deve ter papel maior na oferta de saúde, educação ou previdência (vouchers, gestão por organizações sociais, capitalização). |

### Costumes

| Código | Polo | Afirmação |
| --- | --- | --- |
| `c01-acoes-afirmativas` | progressista | As cotas e outras ações afirmativas raciais e sociais devem ser mantidas ou ampliadas. |
| `c02-lgbtqia` | progressista | O Estado deve ter políticas específicas de proteção e de direitos para a população LGBTQIA+. |
| `c03-drogas` | progressista | O uso de drogas deve ser tratado como questão de saúde, com descriminalização ou regulação de alguma substância. |
| `c04-terras-indigenas-quilombolas` | progressista | A demarcação de terras indígenas e a titulação de territórios quilombolas devem avançar. |
| `c05-laicidade` | progressista | As políticas públicas devem ser laicas, sem se orientar por preceitos religiosos. |
| `c06-desmatamento-clima` | progressista | O combate ao desmatamento e às mudanças climáticas deve ter metas e fiscalização ampliadas, mesmo com restrições a atividades econômicas. |
| `k01-armas` | conservador | O acesso da população a armas de fogo deve ser facilitado. |
| `k02-penas` | conservador | As penas devem ser endurecidas, com redução da maioridade penal ou restrição de benefícios na execução penal. |
| `k03-aborto` | conservador | O aborto deve continuar proibido fora das hipóteses legais atuais, ou ter essas hipóteses reduzidas. |
| `k04-escolas-civico-militares` | conservador | As escolas cívico-militares ou o ensino domiciliar devem ser ampliados. |
| `k05-familia-e-fe` | conservador | As políticas públicas devem promover os valores da família e da fé religiosa. |
| `k06-ocupacoes-de-terra` | conservador | Ocupações de terras e de imóveis por movimentos sociais devem ser tratadas com maior rigor legal. |

**Notas para quem codifica:**
- `e06`: propor revogar ou rever a reforma trabalhista é discordar. Propor direitos para trabalhadores de aplicativo, sem falar da reforma, é `tende-a-discordar`.
- `e07`: "responsabilidade fiscal" sozinha não é posição sobre o teto. Só conta o que o plano diz da regra de gasto.
- `e10`: criticar os juros sem falar da autonomia é `neutra`.
- `c03`: tratamento em comunidades terapêuticas, sem falar de descriminalização, é `tende-a-discordar` (a saúde aparece sem a parte qualificada).
- `k03`: "defesa da vida desde a concepção" é `concorda-totalmente`. Ampliar o acesso ao aborto legal já previsto é `tende-a-discordar`; ampliar as hipóteses é `discorda-totalmente`.
- `k05`: menção a família como público de política social (por exemplo, renda por família) não é posição.

## 5. Evidência e trechos candidatos

Como na [rubrica da D3](rubrica-propostas.md), seção 4: todo valor com posição exige página e trecho literal do texto publicado (`textos/` do pacote), conferido pelo programa com a normalização da busca. `sem-posicao` dispensa evidência.

O pacote traz os trechos que a busca literal encontra para os termos de cada afirmação (coluna `criterios` de `trechos-candidatos.csv`), reproduzíveis em `/propostas`. Os termos estão em `compass-core.ts` e no `manifest.json` do pacote. Ficam fora da lista os que a busca por trecho não separa de outras palavras, medidos no corpus de 2022:

| Termo | Motivo |
| --- | --- |
| CAC | casa com "educação", "qualificação" e "aplicação" |
| penas | casa com "apenas"; "penal", "pena de" e "punição" ficam |
| MST | casa com "Amsterdam" |
| fé | casa com "federal", "defesa" e "professores" |
| diversidade | casa com "biodiversidade" |
| gênero | casa com "generosos" |
| racismo | casa com "ostracismo" |
| emissões | casa com "demissões" |
| ocupações | casa com "preocupações" |
| família, valores | amplos demais (100 e 20 páginas, em sentidos variados) |

Antes de registrar `sem-posicao`, cada pessoa revisa os trechos candidatos da afirmação, o sumário e as seções do tema. No pacote de 22/10/2026, todas as afirmações têm trecho candidato em ao menos 2 documentos (`k04` em 2, `c05` em 4; as demais em 5 a 11). Por documento, o nº 27 tem trechos para só 2 afirmações de economia e 3 de costumes.

## 6. Procedimento

1. **Pacote** (`npm run compass:packet`): o mesmo material para as duas pessoas, em `data/compass/<versão>/pacote-<data>/`:
   - PDFs conferidos pelo SHA-256 e texto publicado por página;
   - `trechos-candidatos.csv` e `codificacao-modelo.csv` (288 linhas: 12 documentos × 24 afirmações; a coluna `criterio` traz o código da afirmação e `pergunta`, o texto);
   - `manifest.json`, com eixos, escala, polaridades, mínimo e publicação do texto, e `LEIA-ME.txt`.
2. **Codificação independente**, como na D3: as duas pessoas não conversam sobre a codificação nem veem a planilha da outra até terminarem.
3. **Validação e concordância** (`npm run compass:agreement -- --pacote=<dir> --a=<planilha> --b=<planilha>`):
   - por afirmação: kappa de Cohen sobre os seis valores;
   - em `compass`: kappa simples para "posição localizada ou não" e kappa ponderado (pesos lineares) da escala, só nos pares em que as duas registraram posição, por eixo e no todo;
   - `publishable` em cada eixo: kappa ponderado de pelo menos **0,70** (decisão de Rafael, 22/10/2026). Eixo abaixo do mínimo, ou com kappa nulo, não é publicado: as afirmações com mais divergência voltam para revisão das regras, numa nova versão. Afirmação isolada com concordância baixa pode ser publicada, com os números na página de método.
4. **Adjudicação** (`--adjudicacao=<planilha>`): cada divergência recebe valor final, páginas, trecho e justificativa. Gera `codificacao-final.csv`, `posicoes.json` e `posicoes.csv`. Nada disso é publicação.

## 7. Cálculo

- **Contribuição de cada afirmação:** valor da escala × polaridade (+1 se a concordância leva a direita ou conservador; −1 se leva a esquerda ou progressista).
- **Posição no eixo:** média das contribuições das afirmações com posição, entre −1 e +1.
- **Mínimo:** 4 afirmações com posição no eixo (um terço). Abaixo disso, a candidatura fica "insuficiente" naquele eixo, sem coordenada, e a página diz que o plano não permite situá-la.
- **Incerteza:**
  - intervalo de 95% por reamostragem das afirmações (2.000 reamostras, semente fixa por documento: a mesma codificação dá sempre o mesmo intervalo);
  - faixa das médias retirando uma afirmação de cada vez;
  - as contribuições de cada afirmação são guardadas para a página mostrar de onde vem cada coordenada.
- **Conferência externa** (fase P3 do plano): comparar com as posições de partidos estimadas por especialistas (Bolognesi, Ribeiro e Codato; CHES Latin America) e publicar as divergências, sem ajustar nada.

## 8. Versionamento

Mudar afirmações, polos, escala, termos, mínimo ou reamostragem cria uma nova versão, com novo pacote. Codificações de versões diferentes não se misturam. Uma nova publicação das propostas exige um novo pacote.

## 9. Decisões pendentes de Rafael

1. ~~Aprovar as afirmações~~: aprovadas em 22/10/2026, com possibilidade de ampliação em versões futuras.
2. ~~Quem codifica~~: codificação A pelo Claude em 22/10/2026 (`codificacao-claude.csv` no pacote, SHA-256 `3ada9942…`). Pendentes: quem faz a codificação B e quem adjudica.

## 10. Lacunas encontradas na codificação A, para a próxima versão

Registradas durante a codificação A, sem mudar a v1:

1. **Afirmações com "e"** ("estatais **e** bancos públicos", "família **e** fé", "indígenas **e** quilombolas"): o livro não diz o que fazer quando o plano se compromete com só uma das partes. Na codificação A, `tende-a-concordar` (ou `tende-a-discordar`), com a explicação na observação.
2. **Trechos em direções opostas × trecho mais explícito:** a seção 3 traz as duas regras sem ordem de precedência. Na codificação A, valeu o mais explícito quando um lado era compromisso nomeado e o outro, menção genérica (exemplo: oposição nomeada a privatizações ao lado de "concessões" para investimento privado); quando os dois lados eram compromissos, `neutra`.
3. **`e02` e PPPs em serviços:** parcerias público-privadas em saúde ou serviços contam como "serviços concedidos"? Na codificação A, `tende-a-concordar`.
4. **`k02` e excludente de ilicitude:** proteção jurídica de agentes de segurança não trata de penas de infratores. Na codificação A, `sem-posicao`, com observação.
5. **Leitura dos planos longos:** nos nº 22, 30, 44 e 90, a codificação A leu o sumário, os títulos e as seções de cada tema, localizadas por busca ampla, em vez do texto corrido; nos demais, o texto inteiro. A codificação B deve ler os documentos inteiros.
3. ~~Concordância mínima~~: kappa ponderado ≥ 0,70 por eixo (22/10/2026); Rafael também considerou razoável 0,75.
4. Publicação, página e canal de contestação (fases P3 e P4 do plano).
