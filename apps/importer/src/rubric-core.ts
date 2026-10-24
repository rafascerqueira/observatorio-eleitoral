import { parse } from 'csv-parse/sync';
import { searchPattern, searchText } from '@observatorio/contracts';

/**
 * Rubrica documental das propostas de governo (fase D3; livro de códigos em docs/rubrica-propostas.md): tema piloto, termos da
 * busca, critérios e valores, planilha de codificação, validação, concordância entre as duas codificações e consolidação depois da
 * adjudicação. Atributos documentais, iguais para todas as candidaturas: sem nota, peso, ordenação ou juízo de mérito.
 */
export const RUBRIC_VERSION = 'rubrica-acessibilidade-mobilidade-v1';
export const RUBRIC_THEME = 'Acessibilidade e mobilidade urbana';

/**
 * Termos da busca literal que localiza trechos candidatos (a mesma busca de /propostas, reproduzível lá). Saem da definição do
 * tema, não do número de ocorrências: ficam também os que não aparecem em nenhum plano. Quem codifica lê os trechos e as seções
 * relacionadas e pode acrescentar trechos achados na leitura.
 */
export const RUBRIC_TERMS = [
  'acessibilidade', 'acessível', 'acessíveis', 'deficiência', 'deficientes', 'cadeirante', 'cadeira de rodas', 'piso tátil', 'rampa',
  'desenho universal', 'lei brasileira de inclusão',
  'mobilidade', 'transporte', 'trânsito', 'ônibus', 'trens', 'metroviário', 'metroviária', 'VLT', 'BRT', 'tarifa', 'passe livre',
  'bilhete único', 'ciclovia', 'ciclofaixa', 'bicicleta', 'pedestre', 'calçada', 'segurança viária', 'iluminação pública', 'pavimentação',
  'infraestrutura urbana', 'deslocamento', 'frota',
] as const;
/** Fora da lista: a busca por trecho não os separa de outras palavras (medido no corpus de 2022), ou são amplos demais para o tema. */
export const RUBRIC_EXCLUDED_TERMS = [
  { term: 'trem', reason: 'casa com “extrema” e “extremamente”; o plural “trens” fica na lista' },
  { term: 'metrô', reason: 'casa com “metros”, “parâmetros”, “metrópoles” e “quilômetros”; “metroviário” e “metroviária” ficam na lista' },
  { term: 'PcD', reason: 'casa com “PCdoB”' },
  { term: 'cidades', reason: 'casa com “capacidades” e é amplo demais para o tema' },
  { term: 'urbana, urbano', reason: 'amplos demais (população urbana, violência urbana)' },
] as const;

export type Value = { code: string; label: string; evidence: boolean };
/** Critério (ou afirmação, na bússola): código, pergunta e valores permitidos; os com evidência exigem página e trecho. */
export type Criterion = { code: string; question: string; values: readonly Value[] };
const NOT_FOUND: Value = { code: 'nao-localizado', label: 'Não localizado no texto revisado', evidence: false };
const NOT_APPLICABLE: Value = { code: 'nao-se-aplica', label: 'Não se aplica: tema não localizado no documento', evidence: false };
const declared = (code: string, label: string): Value[] => [{ code, label, evidence: true }, NOT_FOUND, NOT_APPLICABLE];
/**
 * Critérios, codificados por documento: um valor vale se aparece em qualquer trecho do tema (o mais completo, quando há mais de um).
 * Valor com evidência exige página e trecho literal; `nao-localizado` não significa que o documento não proponha.
 */
export const RUBRIC_CRITERIA = [
  { code: 'tema', question: 'O documento trata de acessibilidade ou de mobilidade urbana?', values: [{ code: 'trata', label: 'Trata: há ao menos um trecho sobre o tema', evidence: true }, NOT_FOUND] },
  { code: 'diagnostico', question: 'Descreve um problema ou a situação do tema?', values: [
    { code: 'com-dado', label: 'Sim, com dado, número ou fonte citada', evidence: true }, { code: 'sem-dado', label: 'Sim, sem dado nem fonte', evidence: true }, NOT_FOUND, NOT_APPLICABLE] },
  { code: 'intervencao', question: 'Propõe medida sobre o tema?', values: [
    { code: 'especifica', label: 'Medida específica: diz o que será feito (programa, obra, norma, serviço)', evidence: true },
    { code: 'generica', label: 'Só intenção geral, sem dizer o que será feito', evidence: true }, NOT_FOUND, NOT_APPLICABLE] },
  { code: 'publico', question: 'Declara o público da medida?', values: declared('declarado', 'Declarado') },
  { code: 'territorio', question: 'Declara o território da medida?', values: declared('declarado', 'Declarado') },
  { code: 'meta-quantidade', question: 'Declara meta em quantidade (valor e unidade)?', values: declared('declarada', 'Declarada') },
  { code: 'meta-prazo', question: 'Declara prazo?', values: declared('declarado', 'Declarado') },
  { code: 'responsabilidade', question: 'Menciona órgão, ente federativo, programa ou norma responsável?', values: declared('mencionada', 'Mencionada') },
  { code: 'custo', question: 'Declara custo?', values: declared('declarado', 'Declarado') },
  { code: 'fonte-recursos', question: 'Declara a fonte dos recursos?', values: declared('declarada', 'Declarada') },
  { code: 'acompanhamento', question: 'Declara indicador de acompanhamento ou critério de entrega?', values: declared('declarado', 'Declarado') },
] as const;

/** Documento a codificar: identificador da planilha (`doc-` + 12 primeiros caracteres do SHA-256, para planilhas não o lerem como número). */
export type RubricDocument = { id: string; sha256: string; pages: number; candidacies: string };
export const documentId = (sha256: string) => `doc-${sha256.slice(0, 12)}`;
export const CODING_COLUMNS = ['documento', 'candidaturas', 'criterio', 'pergunta', 'valores_permitidos', 'valor', 'paginas', 'trecho', 'observacao'] as const;
export type CodingRow = { documento: string; criterio: string; valor: string; paginas: number[]; trecho: string; observacao: string };

/** CSV para Excel e LibreOffice em português: UTF-8 com BOM, `;`, todos os campos entre aspas, CRLF. */
export const csv = (rows: ReadonlyArray<ReadonlyArray<string | number>>) => `﻿${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')}\r\n`;
/** Modelo da planilha: uma linha por documento e critério, na ordem dos documentos e dos critérios. */
export const codingTemplate = (documents: readonly RubricDocument[], criteria: readonly Criterion[] = RUBRIC_CRITERIA) => csv([CODING_COLUMNS, ...documents.flatMap((document) => criteria.map((criterion) =>
  [document.id, document.candidacies, criterion.code, criterion.question, criterion.values.map((value) => value.code).join(' | '), '', '', '', '']))]);

/** Lê uma planilha preenchida. Erro de leitura (formato, colunas) interrompe; os problemas de conteúdo vêm de `validateCoding`. */
export function readCoding(text: string): CodingRow[] {
  if (text.includes('�')) throw new Error('Planilha com caracteres ilegíveis: salve como “CSV UTF-8”.');
  const records = parse(text, { delimiter: ';', columns: true, bom: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;
  const missing = CODING_COLUMNS.filter((column) => !records[0] || !(column in records[0]));
  if (missing.length) throw new Error(`Planilha sem as colunas ${missing.join(', ')} (separador “;”).`);
  return records.map((record) => ({ documento: record.documento!, criterio: record.criterio!, valor: record.valor!.toLowerCase(), trecho: record.trecho!, observacao: record.observacao!,
    paginas: record.paginas!.split(/[,;\s]+/).filter(Boolean).map(Number) }));
}

/**
 * Texto de cada página em `textos/` do pacote (cabeçalho "=== Página N (método) ===" seguido do texto publicado), na ordem das
 * páginas do documento: quem codifica confere a planilha sem o banco. Página fora de ordem ou faltando torna o arquivo inválido.
 */
export function packetPages(content: string, pages: number) {
  // Cabeçalhos aceitos só em sequência (1, 2, 3…): uma linha parecida com outro número, dentro do texto, não divide a página.
  const starts: Array<{ page: number; header: number; body: number }> = [];
  for (const match of content.matchAll(/^=== Página (\d+) \([^)\n]*\) ===\n/gmu))
    if (Number(match[1]) === starts.length + 1) starts.push({ page: starts.length + 1, header: match.index, body: match.index + match[0].length });
  if (starts.length !== pages) throw new Error(`Texto do pacote com ${starts.length} de ${pages} páginas.`);
  return new Map(starts.map((start, index) => [start.page, content.slice(start.body, starts[index + 1]?.header ?? content.length).replace(/\n+$/u, '')]));
}

const key = (row: { documento: string; criterio: string }) => `${row.documento}/${row.criterio}`;
type PageText = (sha256: string, page: number) => string | null;
/**
 * Problemas de uma planilha: linhas ausentes ou repetidas, valor fora dos permitidos, regra própria do livro de códigos (`rule`),
 * evidência ausente, página inexistente ou trecho que não está na página citada (pela mesma normalização da busca).
 * `pageText(documento, página)` devolve o `search_text` publicado, ou nulo.
 */
export function validateRows(rows: readonly CodingRow[], documents: readonly RubricDocument[], pageText: PageText, criteria: readonly Criterion[],
  rule?: (row: CodingRow, value: Value, byKey: ReadonlyMap<string, CodingRow>) => string | null) {
  const problems: string[] = [], byKey = new Map<string, CodingRow>();
  for (const row of rows) {
    if (byKey.has(key(row))) problems.push(`${key(row)}: linha repetida.`);
    byKey.set(key(row), row);
  }
  for (const document of documents) for (const criterion of criteria) {
    const row = byKey.get(`${document.id}/${criterion.code}`);
    if (!row) { problems.push(`${document.id}/${criterion.code}: linha ausente.`); continue; }
    const value = criterion.values.find((item) => item.code === row.valor);
    if (!value) { problems.push(`${key(row)}: valor "${row.valor}" fora dos permitidos (${criterion.values.map((item) => item.code).join(', ')}).`); continue; }
    const broken = rule?.(row, value, byKey);
    if (broken) problems.push(`${key(row)}: ${broken}`);
    if (!value.evidence) continue;
    if (!row.paginas.length || !row.trecho) { problems.push(`${key(row)}: valor "${value.code}" exige página e trecho.`); continue; }
    const invalid = row.paginas.filter((page) => !Number.isInteger(page) || page < 1 || page > document.pages);
    if (invalid.length) { problems.push(`${key(row)}: página ${invalid.join(', ')} fora do documento (1 a ${document.pages}).`); continue; }
    const term = searchText(row.trecho);
    if (term.length < 3) { problems.push(`${key(row)}: trecho curto demais para conferir.`); continue; }
    const expression = new RegExp(searchPattern(term), 'u');
    if (!row.paginas.some((page) => expression.test(pageText(document.sha256, page) ?? ''))) problems.push(`${key(row)}: trecho não encontrado na página ${row.paginas.join(', ')} do texto publicado.`);
  }
  for (const row of rows) if (!documents.some((document) => document.id === row.documento) || !criteria.some((criterion) => criterion.code === row.criterio)) problems.push(`${key(row)}: documento ou critério desconhecido.`);
  return problems;
}
/** Validação da rubrica de acessibilidade e mobilidade: além das regras gerais, "nao-se-aplica" só quando o tema não foi localizado. */
export const validateCoding = (rows: readonly CodingRow[], documents: readonly RubricDocument[], pageText: PageText) => validateRows(rows, documents, pageText, RUBRIC_CRITERIA,
  (row, value, byKey) => row.criterio !== 'tema' && (byKey.get(`${row.documento}/tema`)?.valor === 'nao-localizado') !== (value.code === 'nao-se-aplica')
    ? '"nao-se-aplica" só quando o tema não foi localizado, e sempre nesse caso.' : null);

/**
 * Autoria declarada de cada codificação, gravada na concordância para a publicação informá-la: `pessoa` ou `modelo:<identificador>`
 * (modelo de linguagem, com a versão exata). Sem nome de pessoa. Ao menos uma das duas codificações é de uma pessoa, salvo na
 * medida de consistência do modelo (`consistency`), em que as duas são do mesmo modelo e o resultado não vai para a adjudicação.
 */
/**
 * Execução isolada do modelo: `api` registra a entrada e a saída exatas; `sessao` (sessão aberta só com o pacote) é menos
 * verificável e a publicação declara essa limitação.
 */
export type Isolation = 'api' | 'sessao';
export type Authorship = { kind: 'pessoa' } | { kind: 'modelo'; model: string; isolation: Isolation };
type Declared = readonly [string | null, string | null];
export function authorship(a: string | null, b: string | null, { consistency = false, isolation = [null, null] }: { consistency?: boolean; isolation?: Declared } = {}): [Authorship, Authorship] {
  const read = (value: string | null, declared: string | null, role: string): Authorship => {
    if (value === 'pessoa') {
      if (declared) throw new Error(`--isolamento-${role} vale só para codificação de modelo.`);
      return { kind: 'pessoa' };
    }
    const model = /^modelo:([\w.:/-]+)$/.exec(value ?? '')?.[1];
    if (!model) throw new Error(`Autoria da codificação ${role} ausente ou inválida: declare --autoria-${role}=pessoa ou --autoria-${role}=modelo:<identificador>.`);
    if (declared !== 'api' && declared !== 'sessao') throw new Error(`Codificação ${role} de modelo: declare a execução isolada, --isolamento-${role}=api ou --isolamento-${role}=sessao.`);
    return { kind: 'modelo', model, isolation: declared };
  };
  const result: [Authorship, Authorship] = [read(a, isolation[0], 'a'), read(b, isolation[1], 'b')];
  if (consistency) {
    // Consistência do modelo: duas codificações independentes do mesmo modelo, só para medir; nunca vão para a adjudicação.
    if (!result.every((item) => item.kind === 'modelo') || new Set(result.map((item) => item.kind === 'modelo' && item.model)).size !== 1)
      throw new Error('--consistencia compara duas codificações do mesmo modelo: declare as duas como modelo:<identificador>, com o mesmo identificador.');
  } else if (result.filter((item) => item.kind === 'pessoa').length !== 1)
    // A pessoa codifica primeiro, em público; o modelo depois, isolado (decisão de Rafael, 24/10/2026).
    throw new Error('A concordância compara a codificação de uma pessoa com a de um modelo: declare uma como pessoa e a outra como modelo:<identificador>.');
  return result;
}

/** Gerador pseudoaleatório determinístico (mulberry32): a mesma codificação dá sempre o mesmo intervalo. */
export function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export const quantile = (sorted: readonly number[], q: number) => {
  const position = (sorted.length - 1) * q, low = Math.floor(position), high = Math.ceil(position);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
};

/**
 * Concordância entre duas codificações sobre os mesmos itens: proporção observada e kappa de Cohen. Kappa nulo quando a concordância
 * esperada é total (as duas usaram uma só categoria, a mesma, em todos os itens); sem itens, tudo nulo.
 */
export function cohenKappa(pairs: ReadonlyArray<readonly [string, string]>) {
  const items = pairs.length, agreements = pairs.filter(([a, b]) => a === b).length;
  if (!items) return { items, agreements, observed: null, expected: null, kappa: null };
  const observed = agreements / items;
  const expected = [...new Set(pairs.flat())].reduce((sum, category) => sum + (pairs.filter(([a]) => a === category).length / items) * (pairs.filter(([, b]) => b === category).length / items), 0);
  return { items, agreements, observed, expected, kappa: expected === 1 ? null : (observed - expected) / (1 - expected) };
}
/** Concordância por critério e no conjunto (categorias distintas por critério), e a lista de divergências, na ordem da planilha. */
export function agreement(a: readonly CodingRow[], b: readonly CodingRow[], criteria: readonly Criterion[] = RUBRIC_CRITERIA) {
  const other = new Map(b.map((row) => [key(row), row]));
  const pairs = a.flatMap((row) => other.has(key(row)) ? [{ row, peer: other.get(key(row))! }] : []);
  const byCriterion = Object.fromEntries(criteria.map((criterion) => [criterion.code, cohenKappa(pairs.filter(({ row }) => row.criterio === criterion.code).map(({ row, peer }) => [row.valor, peer.valor] as const))]));
  return { byCriterion, overall: cohenKappa(pairs.map(({ row, peer }) => [`${row.criterio}:${row.valor}`, `${peer.criterio}:${peer.valor}`] as const)),
    divergences: pairs.filter(({ row, peer }) => row.valor !== peer.valor).map(({ row, peer }) => ({ a: row, b: peer })) };
}
/**
 * AC1 de Gwet (nominal), com `categories` = número de valores possíveis. Sofre menos que o kappa com a concentração numa
 * categoria (o "paradoxo do kappa": 11 de 12 documentos `nao-localizado` nas duas dão concordância alta e kappa perto de zero).
 * Sem itens ou com menos de duas categorias possíveis, nulo.
 */
export function gwetAC1(pairs: ReadonlyArray<readonly [string, string]>, categories: number) {
  const items = pairs.length;
  if (!items || categories < 2) return null;
  const observed = pairs.filter(([a, b]) => a === b).length / items;
  const expected = [...new Set(pairs.flat())].reduce((sum, category) => {
    const share = pairs.reduce((count, [a, b]) => count + Number(a === category) + Number(b === category), 0) / (2 * items);
    return sum + share * (1 - share);
  }, 0) / (categories - 1);
  return (observed - expected) / (1 - expected);
}
/** Mínimo de AC1 por critério para publicá-lo (decisão de Rafael, 24/10/2026, fixada antes da codificação). */
export const MIN_CRITERION_AC1 = 0.7;
export const RELIABILITY_RESAMPLES = 2000;
const NOT_APPLICABLE_CODE = 'nao-se-aplica';
/**
 * Confiabilidade por critério, fixada antes da codificação: AC1 de Gwet, kappa de Cohen e concordância observada, com intervalo
 * de 95% por reamostragem dos documentos (semente fixa por critério) e `publishable` quando o AC1 atinge o mínimo. Os pares em que
 * alguma codificação marcou `nao-se-aplica` ficam fora: esse valor decorre do tema, e a divergência no tema já aparece no próprio
 * critério `tema`. O número de categorias é o de valores do critério, menos `nao-se-aplica`.
 */
export function criterionReliability(a: readonly CodingRow[], b: readonly CodingRow[], criteria: readonly Criterion[] = RUBRIC_CRITERIA) {
  const other = new Map(b.map((row) => [key(row), row]));
  return Object.fromEntries(criteria.map((criterion, index) => {
    const pairs = a.filter((row) => row.criterio === criterion.code && other.has(key(row))).map((row) => [row.valor, other.get(key(row))!.valor] as const)
      .filter(([x, y]) => x !== NOT_APPLICABLE_CODE && y !== NOT_APPLICABLE_CODE);
    const categories = criterion.values.filter((value) => value.code !== NOT_APPLICABLE_CODE).length, ac1 = gwetAC1(pairs, categories);
    const draw = random(0xac1 + index * 7919), samples: number[] = [];
    if (pairs.length) for (let sample = 0; sample < RELIABILITY_RESAMPLES; sample++) {
      const value = gwetAC1(pairs.map(() => pairs[Math.floor(draw() * pairs.length)]!), categories);
      if (value !== null) samples.push(value);
    }
    samples.sort((x, y) => x - y);
    const { observed, kappa } = cohenKappa(pairs);
    return [criterion.code, { items: pairs.length, categories, observed, kappa, ac1, interval: samples.length ? [quantile(samples, 0.025), quantile(samples, 0.975)] : null,
      publishable: ac1 !== null && ac1 >= MIN_CRITERION_AC1 }];
  }));
}
export const ADJUDICATION_COLUMNS = ['documento', 'candidaturas', 'criterio', 'valor_a', 'paginas_a', 'trecho_a', 'valor_b', 'paginas_b', 'trecho_b', 'valor_final', 'paginas_final', 'trecho_final', 'justificativa'] as const;
/** Planilha de adjudicação: só as divergências, com o que cada pessoa registrou e campos para a decisão e o motivo. */
export const adjudicationTemplate = (divergences: ReturnType<typeof agreement>['divergences'], documents: readonly RubricDocument[]) => csv([ADJUDICATION_COLUMNS,
  ...divergences.map(({ a, b }) => [a.documento, documents.find((document) => document.id === a.documento)?.candidacies ?? '', a.criterio, a.valor, a.paginas.join(', '), a.trecho, b.valor, b.paginas.join(', '), b.trecho, '', '', '', ''])]);

/**
 * Codificação final: o valor comum quando as duas codificações concordam e a decisão registrada quando divergem. Toda divergência precisa
 * de decisão e justificativa; a decisão passa pela mesma validação de uma planilha. Cada linha guarda a origem (`concordancia` ou
 * `adjudicacao`) para a publicação poder mostrá-la.
 */
export function consolidate(a: readonly CodingRow[], b: readonly CodingRow[], decisions: ReadonlyArray<Record<string, string>>) {
  const decided = new Map(decisions.map((decision) => [`${decision.documento}/${decision.criterio}`, decision]));
  const problems: string[] = [], other = new Map(b.map((row) => [key(row), row]));
  const final = a.map((row) => {
    const peer = other.get(key(row));
    if (peer && peer.valor === row.valor) return { ...row, paginas: [...new Set([...row.paginas, ...peer.paginas])].sort((x, y) => x - y), origem: 'concordancia' as const, justificativa: '' };
    const decision = decided.get(key(row));
    if (!decision?.valor_final?.trim() || !decision.justificativa?.trim()) problems.push(`${key(row)}: divergência sem decisão e justificativa.`);
    return { documento: row.documento, criterio: row.criterio, valor: decision?.valor_final?.trim().toLowerCase() ?? '', paginas: (decision?.paginas_final ?? '').split(/[,;\s]+/).filter(Boolean).map(Number),
      trecho: decision?.trecho_final?.trim() ?? '', observacao: '', origem: 'adjudicacao' as const, justificativa: decision?.justificativa?.trim() ?? '' };
  });
  return { final, problems };
}
