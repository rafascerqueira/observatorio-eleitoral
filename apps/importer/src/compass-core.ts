import { cohenKappa, quantile, random, validateRows, type CodingRow, type Criterion, type RubricDocument, type Value } from './rubric-core';

/**
 * Bússola política das candidaturas no modelo Kieskompas (livro de códigos em docs/bussola-livro-de-codigos.md): afirmações
 * atribuídas a dois eixos, posição de cada plano de governo em cada afirmação numa escala de cinco pontos, em duas codificações
 * independentes (a de uma pessoa, em público, e depois a de um modelo, isolado) com página e trecho, e coordenada do eixo pela média das afirmações com posição documentada. "Sem posição" fica fora
 * da média e nunca vira neutro; abaixo do mínimo de afirmações a candidatura não é situada no eixo.
 */
export const COMPASS_VERSION = 'bussola-kieskompas-v2';
export const COMPASS_THEME = 'Bússola política (modelo Kieskompas)';

/** Eixos: −1 no primeiro polo, +1 no segundo. Rótulos sem termos pejorativos (decisão de Rafael, 22/10/2026). */
export const AXES = {
  economia: { label: 'Economia', negative: 'esquerda', positive: 'direita' },
  costumes: { label: 'Costumes', negative: 'progressista', positive: 'conservador' },
} as const;
export type Axis = keyof typeof AXES;
type Pole = (typeof AXES)[Axis]['negative' | 'positive'];

/** Escala de cinco pontos do Kieskompas, com o valor numérico de cada ponto; `sem-posicao` não tem valor. */
export const SCALE = [
  { code: 'concorda-totalmente', label: 'O plano concorda totalmente', score: 1 },
  { code: 'tende-a-concordar', label: 'O plano tende a concordar', score: 0.5 },
  { code: 'neutra', label: 'O plano trata do assunto sem tomar posição, ou com posição ambivalente', score: 0 },
  { code: 'tende-a-discordar', label: 'O plano tende a discordar', score: -0.5 },
  { code: 'discorda-totalmente', label: 'O plano discorda totalmente', score: -1 },
] as const;
export const NO_POSITION = 'sem-posicao';
const VALUES: readonly Value[] = [...SCALE.map((point) => ({ code: point.code, label: point.label, evidence: true })),
  { code: NO_POSITION, label: 'Posição não localizada no texto revisado', evidence: false }];

type Statement = { code: string; axis: Axis; pole: Pole; text: string; terms: readonly string[] };
/**
 * Afirmações: seis por polo em cada eixo, para que concordar com tudo não empurre ninguém para um lado. `pole` é o polo para onde
 * a concordância leva. Os termos só localizam trechos candidatos (busca literal de /propostas); quem codifica lê o documento.
 */
export const STATEMENTS: readonly Statement[] = [
  { code: 'e01-estatais-bancos-publicos', axis: 'economia', pole: 'esquerda', text: 'O Estado deve ampliar o papel de empresas estatais e de bancos públicos no investimento e no crédito.',
    terms: ['bancos públicos', 'banco do brasil', 'caixa econômica', 'bndes', 'petrobras', 'estatal', 'estatais', 'empresas públicas'] },
  { code: 'e02-privatizacao', axis: 'economia', pole: 'direita', text: 'Empresas estatais devem ser privatizadas ou ter serviços concedidos à iniciativa privada.',
    terms: ['privatiza', 'desestatiza', 'concessão', 'concessões', 'parcerias público-privadas', 'PPP'] },
  { code: 'e03-tributacao-progressiva', axis: 'economia', pole: 'esquerda', text: 'A tributação deve ficar mais progressiva, cobrando mais de altas rendas, lucros e dividendos ou grandes fortunas.',
    terms: ['progressiv', 'grandes fortunas', 'lucros e dividendos', 'dividendos', 'imposto de renda', 'isenção'] },
  { code: 'e04-carga-tributaria', axis: 'economia', pole: 'direita', text: 'A carga tributária total deve ser reduzida.',
    terms: ['carga tributária', 'reduzir impostos', 'redução de impostos', 'redução da carga'] },
  { code: 'e05-salario-minimo', axis: 'economia', pole: 'esquerda', text: 'O salário mínimo deve ter política permanente de aumento acima da inflação.',
    terms: ['salário mínimo', 'valorização do salário', 'poder de compra', 'acima da inflação', 'reajuste'] },
  { code: 'e06-reforma-trabalhista', axis: 'economia', pole: 'direita', text: 'A reforma trabalhista de 2017 deve ser mantida ou aprofundada, com regras de trabalho mais flexíveis.',
    terms: ['reforma trabalhista', 'legislação trabalhista', 'CLT', 'flexibiliza', 'direitos trabalhistas', 'trabalhadores de aplicativo', 'revogação', 'revogar'] },
  { code: 'e07-teto-de-gastos', axis: 'economia', pole: 'esquerda', text: 'O teto de gastos deve ser revogado ou substituído por regra que permita ampliar o gasto e o investimento públicos.',
    terms: ['teto de gastos', 'teto dos gastos', 'investimento público', 'responsabilidade fiscal', 'equilíbrio fiscal', 'ajuste fiscal'] },
  { code: 'e08-abertura-comercial', axis: 'economia', pole: 'direita', text: 'O comércio exterior deve ser mais aberto, com redução de tarifas e de barreiras à importação.',
    terms: ['abertura comercial', 'livre comércio', 'acordos comerciais', 'comércio exterior', 'protecion'] },
  { code: 'e09-reforma-agraria', axis: 'economia', pole: 'esquerda', text: 'A reforma agrária deve ser ampliada, inclusive com desapropriação de terras.',
    terms: ['reforma agrária', 'desapropria', 'assentamento'] },
  { code: 'e10-banco-central', axis: 'economia', pole: 'direita', text: 'A autonomia do Banco Central deve ser mantida.',
    terms: ['banco central', 'independência do banco', 'política monetária', 'juros'] },
  { code: 'e11-transferencia-de-renda', axis: 'economia', pole: 'esquerda', text: 'Os programas de transferência de renda devem ser ampliados ou tornados direito permanente.',
    terms: ['transferência de renda', 'bolsa família', 'auxílio brasil', 'renda básica', 'renda mínima'] },
  { code: 'e12-privado-em-servicos', axis: 'economia', pole: 'direita', text: 'A iniciativa privada deve ter papel maior na oferta de saúde, educação ou previdência (vouchers, gestão por organizações sociais, capitalização).',
    terms: ['voucher', 'organizações sociais', 'capitalização', 'charter', 'bolsas de estudo', 'iniciativa privada', 'setor privado'] },
  { code: 'c01-acoes-afirmativas', axis: 'costumes', pole: 'progressista', text: 'As cotas e outras ações afirmativas raciais e sociais devem ser mantidas ou ampliadas.',
    terms: ['cotas', 'ações afirmativas', 'igualdade racial'] },
  { code: 'c02-lgbtqia', axis: 'costumes', pole: 'progressista', text: 'O Estado deve ter políticas específicas de proteção e de direitos para a população LGBTQIA+.',
    terms: ['LGBT', 'orientação sexual', 'pessoas trans'] },
  { code: 'c03-drogas', axis: 'costumes', pole: 'progressista', text: 'O uso de drogas deve ser tratado como questão de saúde, com descriminalização ou regulação de alguma substância.',
    terms: ['drogas', 'descriminaliza', 'maconha', 'política sobre drogas', 'comunidades terapêuticas'] },
  { code: 'c04-terras-indigenas-quilombolas', axis: 'costumes', pole: 'progressista', text: 'A demarcação de terras indígenas e a titulação de territórios quilombolas devem avançar.',
    terms: ['demarca', 'terras indígenas', 'territórios indígenas', 'quilombo'] },
  { code: 'c05-laicidade', axis: 'costumes', pole: 'progressista', text: 'As políticas públicas devem ser laicas, sem se orientar por preceitos religiosos.',
    terms: ['laic', 'liberdade religiosa'] },
  { code: 'c06-desmatamento-clima', axis: 'costumes', pole: 'progressista', text: 'O combate ao desmatamento e às mudanças climáticas deve ter metas e fiscalização ampliadas, mesmo com restrições a atividades econômicas.',
    terms: ['desmatamento', 'fiscalização ambiental', 'ibama', 'licenciamento', 'mudança do clima', 'mudanças climáticas'] },
  { code: 'k01-armas', axis: 'costumes', pole: 'conservador', text: 'O acesso da população a armas de fogo deve ser facilitado.',
    terms: ['armas', 'arma de fogo', 'armamento', 'posse de arma', 'porte de arma', 'legítima defesa', 'controle de armas'] },
  { code: 'k02-penas', axis: 'costumes', pole: 'conservador', text: 'As penas devem ser endurecidas, com redução da maioridade penal ou restrição de benefícios na execução penal.',
    terms: ['penal', 'código penal', 'pena de', 'punição', 'impunidade', 'endurec', 'excludente de ilicitude', 'encarceramento', 'prisões'] },
  { code: 'k03-aborto', axis: 'costumes', pole: 'conservador', text: 'O aborto deve continuar proibido fora das hipóteses legais atuais, ou ter essas hipóteses reduzidas.',
    terms: ['aborto', 'nascituro', 'desde a concepção', 'direito à vida', 'vida desde', 'defesa da vida', 'planejamento familiar'] },
  { code: 'k04-escolas-civico-militares', axis: 'costumes', pole: 'conservador', text: 'As escolas cívico-militares ou o ensino domiciliar devem ser ampliados.',
    terms: ['cívico-militar', 'ensino domiciliar', 'educação domiciliar', 'homeschooling'] },
  { code: 'k05-familia-e-fe', axis: 'costumes', pole: 'conservador', text: 'As políticas públicas devem promover os valores da família e da fé religiosa.',
    terms: ['família tradicional', 'conservador', 'liberdade religiosa', 'cristão', 'deus'] },
  { code: 'k06-ocupacoes-de-terra', axis: 'costumes', pole: 'conservador', text: 'Ocupações de terras e de imóveis por movimentos sociais devem ser tratadas com maior rigor legal.',
    terms: ['invasão', 'invasões', 'invasores', 'movimentos sociais', 'sem terra', 'conflitos no campo', 'direito de propriedade', 'terrorismo'] },
];
/** Fora da lista de termos: a busca por trecho não os separa de outras palavras (medido no corpus de 2022), ou são amplos demais. */
export const COMPASS_EXCLUDED_TERMS = [
  { term: 'CAC', reason: 'casa com “educação”, “qualificação” e “aplicação”' },
  { term: 'penas', reason: 'casa com “apenas”; “penal”, “pena de” e “punição” ficam na lista' },
  { term: 'MST', reason: 'casa com “Amsterdam”' },
  { term: 'fé', reason: 'casa com “federal”, “defesa” e “professores”' },
  { term: 'diversidade', reason: 'casa com “biodiversidade”' },
  { term: 'gênero', reason: 'casa com “generosos”' },
  { term: 'racismo', reason: 'casa com “ostracismo”' },
  { term: 'emissões', reason: 'casa com “demissões”' },
  { term: 'ocupações', reason: 'casa com “preocupações”' },
  { term: 'família, valores', reason: 'amplos demais (100 e 20 páginas, em sentidos variados)' },
] as const;

/** Polaridade: +1 quando concordar leva ao polo positivo do eixo, −1 quando leva ao negativo. */
export const polarity = (statement: Statement) => statement.pole === AXES[statement.axis].positive ? 1 : -1;
export const COMPASS_CRITERIA: readonly Criterion[] = STATEMENTS.map((statement) => ({ code: statement.code, question: statement.text, values: VALUES }));
/** Termos sem repetição, cada um com as afirmações a que pertence, na ordem das afirmações. */
export const COMPASS_TERMS = STATEMENTS.reduce<Array<{ term: string; criteria: string[] }>>((terms, statement) => {
  for (const term of statement.terms) {
    const found = terms.find((item) => item.term === term);
    if (found) found.criteria.push(statement.code); else terms.push({ term, criteria: [statement.code] });
  }
  return terms;
}, []);
export const validateCompass = (rows: readonly CodingRow[], documents: readonly RubricDocument[], pageText: (sha256: string, page: number) => string | null) =>
  validateRows(rows, documents, pageText, COMPASS_CRITERIA);

const scoreOf = (code: string) => SCALE.find((point) => point.code === code)?.score ?? null;
/**
 * Kappa de Cohen ponderado (pesos lineares) para a escala ordinal de cinco pontos, só com os pares em que as duas codificações
 * registraram posição. Nulo sem pares ou com concordância esperada total.
 */
export function weightedKappa(pairs: ReadonlyArray<readonly [string, string]>) {
  const points = SCALE.map((point) => point.code) as string[];
  const valid = pairs.filter(([a, b]) => points.includes(a) && points.includes(b)).map(([a, b]) => [points.indexOf(a), points.indexOf(b)] as const);
  const items = valid.length;
  if (!items) return { items, observed: null, expected: null, kappa: null };
  const weight = (i: number, j: number) => 1 - Math.abs(i - j) / (points.length - 1);
  const observed = valid.reduce((sum, [i, j]) => sum + weight(i, j), 0) / items;
  const share = (side: 0 | 1, index: number) => valid.filter((pair) => pair[side] === index).length / items;
  let expected = 0;
  for (let i = 0; i < points.length; i++) for (let j = 0; j < points.length; j++) expected += weight(i, j) * share(0, i) * share(1, j);
  // Tolerância de arredondamento: somas de frações podem dar 0,95000…01 onde a conta exata dá 0,95.
  const close = (x: number, y: number) => Math.abs(x - y) < 1e-12;
  return { items, observed, expected, kappa: close(expected, 1) ? null : close(observed, expected) ? 0 : (observed - expected) / (1 - expected) };
}
/** Concordância mínima para publicar um eixo: kappa ponderado da escala (decisão de Rafael, 22/10/2026). */
export const MIN_AXIS_KAPPA = 0.7;
/** Medidas próprias da bússola na concordância: posição localizada ou não (kappa simples) e escala (kappa ponderado), por eixo e no todo. */
export function compassAgreement(a: readonly CodingRow[], b: readonly CodingRow[]) {
  const other = new Map(b.map((row) => [`${row.documento}/${row.criterio}`, row.valor]));
  const pairs = a.flatMap((row) => other.has(`${row.documento}/${row.criterio}`) ? [{ statement: row.criterio, pair: [row.valor, other.get(`${row.documento}/${row.criterio}`)!] as const }] : []);
  const located = (list: typeof pairs) => cohenKappa(list.map(({ pair }) => pair.map((value) => value === NO_POSITION ? 'sem-posicao' : 'com-posicao') as unknown as readonly [string, string]));
  const axis = (name: Axis) => pairs.filter(({ statement }) => STATEMENTS.find((item) => item.code === statement)?.axis === name);
  return { located: located(pairs), scale: weightedKappa(pairs.map(({ pair }) => pair)),
    byAxis: Object.fromEntries((Object.keys(AXES) as Axis[]).map((name) => {
      const scale = weightedKappa(axis(name).map(({ pair }) => pair));
      // Kappa nulo (sem pares com posição, ou uma só categoria nas duas) não atinge o mínimo: decisão fica com a revisão.
      return [name, { located: located(axis(name)), scale, publishable: scale.kappa !== null && scale.kappa >= MIN_AXIS_KAPPA }];
    })) };
}

/** Mínimo de afirmações com posição para situar uma candidatura num eixo (um terço das doze). */
export const MIN_ITEMS = 4;
export const RESAMPLES = 2000;
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
export type AxisPosition = { items: number; status: 'situada' | 'insuficiente'; score: number | null; interval: [number, number] | null; leaveOneOut: [number, number] | null;
  contributions: Array<{ statement: string; value: string; contribution: number }> };
/**
 * Posição de cada documento nos dois eixos: média de (valor × polaridade) das afirmações com posição, entre −1 e +1. Abaixo de
 * `MIN_ITEMS`, sem coordenada. Incerteza: intervalo de 95% por reamostragem das afirmações (bootstrap, semente fixa por documento)
 * e a faixa das médias retirando uma afirmação de cada vez.
 */
export function positions(final: readonly CodingRow[], documents: ReadonlyArray<Pick<RubricDocument, 'id' | 'candidacies'>>) {
  return documents.map((document, index) => ({ document: document.id, candidacies: document.candidacies,
    axes: Object.fromEntries((Object.keys(AXES) as Axis[]).map((axis) => {
      const contributions = STATEMENTS.filter((statement) => statement.axis === axis).flatMap((statement) => {
        const row = final.find((item) => item.documento === document.id && item.criterio === statement.code);
        const score = row ? scoreOf(row.valor) : null;
        return score === null ? [] : [{ statement: statement.code, value: row!.valor, contribution: score * polarity(statement) }];
      });
      const values = contributions.map((item) => item.contribution);
      if (values.length < MIN_ITEMS) return [axis, { items: values.length, status: 'insuficiente', score: null, interval: null, leaveOneOut: null, contributions } satisfies AxisPosition];
      const draw = random(0x5eed + index * 7919), samples: number[] = [];
      for (let sample = 0; sample < RESAMPLES; sample++) samples.push(mean(values.map(() => values[Math.floor(draw() * values.length)]!)));
      samples.sort((a, b) => a - b);
      const without = values.map((_, skip) => mean(values.filter((__, position) => position !== skip)));
      return [axis, { items: values.length, status: 'situada', score: mean(values), interval: [quantile(samples, 0.025), quantile(samples, 0.975)],
        leaveOneOut: [Math.min(...without), Math.max(...without)], contributions } satisfies AxisPosition];
    })) as Record<Axis, AxisPosition> }));
}
