import { CENSUS_THEMES, contextDistributionSchema, type CensusTheme } from '@observatorio/contracts';

/**
 * Especificação e aritmética dos indicadores do Censo 2022 pela idade de voto (`census-indicators-2022-v1`). Nomes de
 * classificação e de categoria exatamente como nos metadados da SIDRA; divergência bloqueia a importação.
 */
export type Kind = 'universo' | 'amostra';
/** Recorte de idade: soma de `plus` menos soma de `minus`, nas categorias de idade da tabela. Sem idade: `plus` vazio. */
export type Slice = { plus: string[]; minus?: string[] };
export type DistributionSpec = {
  theme: CensusTheme; table: number; variable: number; kind: Kind;
  // exact: categorias somam o total; rounding: diferença de arredondamento da amostra; partial: total pode superar as categorias.
  mode: 'exact' | 'rounding' | 'partial';
  dimension: string; categories: string[]; total?: string;
  fixed: string[]; age?: string; slices: Record<string, Slice>; source: string;
};

const U15 = ['0 a 4 anos', '5 a 9 anos', '10 a 14 anos'];
const OLD = ['70 a 74 anos', '75 a 79 anos', '80 a 84 anos', '85 a 89 anos', '90 a 94 anos', '95 a 99 anos', '100 anos ou mais'];
const OLD3 = ['70 a 74 anos', '75 a 79 anos', '80 anos ou mais'];
const TOTAL: Slice = { plus: ['Total'] };
const PLUS15: Slice = { plus: ['Total'], minus: U15 };
const NO_AGE = { '14+': { plus: [] } };
const FT = 'Condição em relação à força de trabalho e condição de ocupação';
const PO = 'Posição na ocupação e categoria do emprego no trabalho principal';
const sidra = (table: number, detail: string) => `IBGE, Censo 2022 — SIDRA ${table} (${detail})`;

export const DISTRIBUTIONS: DistributionSpec[] = [
  { theme: 'race', table: 9606, variable: 93, kind: 'universo', mode: 'partial', dimension: 'Cor ou raça', categories: ['Branca', 'Preta', 'Amarela', 'Parda', 'Indígena'], fixed: ['Sexo'], age: 'Idade',
    slices: { '16+': { plus: ['Total'], minus: [...U15, '15 anos'] }, '15+': PLUS15, '16-17': { plus: ['16 anos', '17 anos'] }, '70+': { plus: OLD },
      '18-69': { plus: ['Total'], minus: [...U15, '15 anos', '16 anos', '17 anos', ...OLD] } }, source: sidra(9606, 'universo') },
  { theme: 'religion', table: 9537, variable: 140, kind: 'amostra', mode: 'rounding', dimension: 'Religião',
    categories: ['Católica Apostólica Romana', 'Evangélicas', 'Espírita', 'Umbanda e Candomblé', 'Tradições indígenas', 'Outras religiosidades', 'Sem religião', 'Não sabe', 'Sem declaração'],
    fixed: ['Sexo'], age: 'Grupo de idade', slices: { '15+': { plus: ['Total'], minus: ['10 a 14 anos'] }, '70+': { plus: ['70 a 79 anos', '80 anos ou mais'] } }, source: sidra(9537, 'estimativa da amostra') },
  { theme: 'education', table: 10061, variable: 2667, kind: 'amostra', mode: 'rounding', dimension: 'Nível de instrução',
    categories: ['Sem instrução e fundamental incompleto', 'Fundamental completo e médio incompleto', 'Médio completo e superior incompleto', 'Superior completo'],
    fixed: ['Sexo', 'Cor ou raça'], age: 'Grupo de idade', slices: { '18+': TOTAL, '70+': { plus: OLD3 }, '18-69': { plus: ['Total'], minus: OLD3 } }, source: sidra(10061, 'estimativa da amostra') },
  { theme: 'literacy', table: 9542, variable: 950, kind: 'universo', mode: 'exact', dimension: 'Alfabetização', categories: ['Alfabetizadas', 'Não alfabetizadas'], fixed: ['Sexo', 'Cor ou raça'], age: 'Idade',
    slices: { '16+': { plus: ['Total'], minus: ['15 anos'] }, '16-17': { plus: ['16 anos', '17 anos'] }, '65+': { plus: ['65 anos ou mais'] },
      '18-64': { plus: ['Total'], minus: ['15 anos', '16 anos', '17 anos', '65 anos ou mais'] } }, source: sidra(9542, 'universo') },
  ...(['labor', 'laborForce'] as const).map((theme): DistributionSpec => ({ theme, table: 10299, variable: 1641, kind: 'amostra', mode: 'rounding', dimension: FT,
    categories: theme === 'labor' ? ['Força de trabalho', 'Fora da força de trabalho'] : ['Força de trabalho - ocupada', 'Força de trabalho - desocupada'],
    total: theme === 'labor' ? 'Total' : 'Força de trabalho', fixed: ['Sexo'], age: 'Grupo de idade',
    slices: { '14+': TOTAL, '70+': { plus: OLD3 }, '18-69': { plus: ['Total'], minus: ['14 a 17 anos', ...OLD3] } }, source: sidra(10299, 'estimativa da amostra') })),
  { theme: 'socialSecurity', table: 10264, variable: 4090, kind: 'amostra', mode: 'rounding', dimension: 'Condição de contribuição para instituto de previdência oficial no trabalho principal',
    categories: ['Contribuintes', 'Não contribuintes'], fixed: ['Sexo', 'Cor ou raça', 'Grandes grupos de ocupação no trabalho principal'], slices: NO_AGE, source: sidra(10264, 'ocupados de 14 anos ou mais; estimativa da amostra') },
  { theme: 'activity', table: 10262, variable: 4090, kind: 'amostra', mode: 'rounding', dimension: 'Seção de atividade do trabalho principal',
    categories: ['Agricultura, pecuária, produção florestal, pesca e aquicultura', 'Indústrias extrativas', 'Indústrias de transformação', 'Eletricidade e gás', 'Água, esgoto, atividades de gestão de resíduos e descontaminação',
      'Construção', 'Comércio; reparação de veículos automotores e motocicletas', 'Transporte, armazenagem e correio', 'Alojamento e alimentação', 'Informação e comunicação', 'Atividades financeiras, de seguros e serviços relacionados',
      'Atividades imobiliárias', 'Atividades profissionais, científicas e técnicas', 'Atividades administrativas e serviços complementares', 'Administração pública, defesa e seguridade social', 'Educação',
      'Saúde humana e serviços sociais', 'Artes, cultura, esporte e recreação', 'Outras atividades de serviços', 'Serviços domésticos', 'Organismos internacionais e outras instituições extraterritoriais', 'Atividades mal especificadas'],
    fixed: [PO], slices: NO_AGE, source: sidra(10262, 'ocupados de 14 anos ou mais; estimativa da amostra') },
  { theme: 'position', table: 10261, variable: 4090, kind: 'amostra', mode: 'rounding', dimension: PO,
    // Primeiro nível da fonte: "Empregado no setor público" não inclui militares nem empregados de empresas estatais (categorias próprias).
    categories: ['Empregado no setor privado, exclusive trabalhador doméstico', 'Trabalhador doméstico', 'Militar do exército, da marinha, da aeronáutica, da polícia militar ou do corpo de bombeiros militar',
      'Empregado no setor público', 'Empregado de empresas estatais', 'Empregador (com pelo menos um empregado)', 'Conta própria (sem empregados)', 'Trabalhador familiar auxiliar'],
    fixed: ['Sexo', 'Cor ou raça'], slices: NO_AGE, source: sidra(10261, 'ocupados de 14 anos ou mais; estimativa da amostra') },
  { theme: 'workIncome', table: 10292, variable: 4090, kind: 'amostra', mode: 'rounding', dimension: 'Classes de rendimento nominal mensal de todos os trabalhos',
    categories: ['Sem rendimento', 'Até 1/4 de salário mínimo', 'Mais de 1/4 a 1/2 salário mínimo', 'Mais de 1/2 a 1 salário mínimo', 'Mais de 1 a 2 salários mínimos', 'Mais de 2 a 3 salários mínimos',
      'Mais de 3 a 5 salários mínimos', 'Mais de 5 a 10 salários mínimos', 'Mais de 10 a 15 salários mínimos', 'Mais de 15 a 20 salários mínimos', 'Mais de 20 salários mínimos'],
    fixed: ['Sexo'], slices: NO_AGE, source: sidra(10292, 'ocupados de 14 anos ou mais; salário mínimo de R$ 1.212,00; estimativa da amostra') },
  ...([['internet', 9942, 'Existência de conexão domiciliar à Internet', ['Sim', 'Não']],
    ['tenure', 9938, 'Condição de ocupação do domicílio', ['Próprio de algum morador', 'Alugado', 'Cedido ou emprestado', 'Outra condição']],
    ['crowding', 9940, 'Número de moradores por cômodos utilizados como dormitório', ['1 morador', 'Mais de 1 morador até 2 moradores', 'Mais de 2 moradores até 3 moradores', 'Mais de 3 moradores']]] as const)
    .map(([theme, table, dimension, categories]): DistributionSpec => ({ theme, table, variable: 382, kind: 'amostra', mode: 'rounding', dimension, categories: [...categories], fixed: ['Cor ou raça'], age: 'Grupo de idade',
      slices: { '15+': PLUS15, '70+': { plus: ['70 anos ou mais'] } }, source: sidra(table, 'moradores em domicílios particulares permanentes ocupados; estimativa da amostra') })),
  ...([['water', 6894, 'Existência de ligação à rede geral de distribuição de água e principal forma de abastecimento de água',
      ['Possui ligação à rede geral e a utiliza como forma principal', 'Possui ligação à rede geral, mas utiliza principalmente outra forma', 'Não possui ligação com a rede geral'], ['Cor ou raça']],
    ['sewage', 7555, 'Tipo de esgotamento sanitário', ['Rede geral, rede pluvial ou fossa ligada à rede', 'Fossa séptica ou fossa filtro não ligada à rede', 'Fossa rudimentar ou buraco', 'Vala', 'Rio, lago, córrego ou mar', 'Outra forma', 'Não tinham banheiro nem sanitário'], ['Cor ou raça']],
    ['bathroom', 9397, 'Existência de banheiro ou sanitário e número de banheiros de uso exclusivo do domicílio',
      ['Tinham banheiro de uso exclusivo do domicílio', 'Apenas banheiro de uso comum a mais de um domicílio', 'Apenas sanitário ou buraco para dejeções, inclusive os localizados no terreno', 'Não tinham banheiro nem sanitário'], ['Tipo de esgotamento sanitário', 'Cor ou raça']],
    ['garbage', 9541, 'Destino do lixo', ['Coletado', 'Queimado na propriedade', 'Enterrado na propriedade', 'Jogado em terreno baldio, encosta ou área pública', 'Outro destino'], ['Cor ou raça']]] as const)
    .map(([theme, table, dimension, categories, fixed]): DistributionSpec => ({ theme, table, variable: 382, kind: 'universo', mode: 'exact', dimension, categories: [...categories], fixed: [...fixed], age: 'Grupo de idade',
      slices: { '15+': PLUS15 }, source: sidra(table, 'moradores em domicílios particulares permanentes ocupados; universo') })),
  { theme: 'urbanRural', table: 10089, variable: 93, kind: 'universo', mode: 'exact', dimension: 'Situação do domicílio', categories: ['Urbana', 'Rural'], fixed: ['Sexo', 'Localização do domicílio'], age: 'Grupo de idade',
    slices: { '15+': PLUS15, '70+': { plus: OLD } }, source: sidra(10089, 'universo') },
  { theme: 'residenceTime', table: 10158, variable: 13338, kind: 'amostra', mode: 'rounding', dimension: 'Tempo ininterrupto de residência no município',
    categories: ['Menos de 1 ano', '1 ano', '2 anos', '3 anos', '4 anos', '5 anos', '6 a 9 anos'], fixed: ['Lugar de residência anterior'], slices: { all: { plus: [] } },
    source: sidra(10158, 'pessoas que moravam havia menos de 10 anos no município; estimativa da amostra') },
];

/** Parcelas de um numerador (deficiência, migração, favelas), com o denominador indicado. */
export const DISABILITY = { table: 10125, numerator: 12785, denominator: 11852, age: 'Grupo de idade', fixed: ['Sexo'], slices: { '15+': { plus: ['Total'], minus: ['2 a 14 anos'] }, '70+': { plus: ['70 anos ou mais'] } } as Record<'15+' | '70+', Slice> };
export const DISABILITY_TYPES = { table: 10127, numerator: 12785, denominator: 11852, dimension: 'Tipos de dificuldades funcionais', categories: [
  'Dificuldade permanente para enxergar, mesmo usando óculos ou lentes de contato', 'Dificuldade permanente para ouvir, mesmo usando aparelhos auditivos',
  'Dificuldade permanente para andar ou subir degraus, mesmo usando prótese ou outro aparelho de auxílio',
  'Dificuldade permanente para pegar pequenos objetos, como botão ou lápis, ou abrir e fechar tampas de garrafas, mesmo usando aparelho de auxílio',
  'Dificuldade permanente para se comunicar, realizar cuidados pessoais, trabalhar ou estudar por causa de alguma limitação nas funções mentais'] };
// Migração: numerador da 10160; denominador da mesma amostra (total de 15+ e de 70+ da religião, 9537), nunca do universo.
export const MIGRATION = { table: 10160, variable: 13435, age: 'Grupo de idade', fixed: ['Sexo'], slices: { '15+': { plus: ['Total'], minus: ['5 a 9 anos', '10 a 14 anos'] }, '70+': { plus: OLD3 } } as Record<'15+' | '70+', Slice> };
// Favelas: moradores de 15+ (9884, universo) ÷ 15+ da 9606 (universo); número de favelas (9883).
export const FAVELA = { table: 9884, variable: 9612, age: 'Grupo de idade', fixed: ['Cor ou raça', 'Sexo'], slice: PLUS15, countTable: 9883, countVariable: 9910 };
/**
 * Divergências entre fontes declaradas (decisão de Rafael, 31/10/2026): o município fica sem valor e com nota. Qualquer outra
 * divergência entre a SIDRA e os agregados por setor bloqueia a publicação.
 */
export const FAVELA_DIVERGENCES: Record<string, string> = {
  '1505601': 'Peixe-Boi (PA): os agregados por setor do Censo 2022 têm um setor da favela "Portelinha Peixe-Boi", mas o município não aparece nas tabelas de favelas da SIDRA (9883 e 9884). Fontes em desacordo: sem valor.',
};

/** Ordem: uma chave estável por categoria (minúsculas sem acento), igual em todos os municípios. */
export function categoryKey(label: string) {
  return label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Valor de um recorte: soma dos `plus` menos soma dos `minus`; célula indisponível torna o recorte indisponível. */
export function sliceValue(slice: Slice, cell: (age: string | null) => number | null): number | null {
  if (!slice.plus.length) return cell(null);
  const values = [...slice.plus, ...(slice.minus ?? [])].map((age) => cell(age));
  if (values.some((value) => value === null)) return null;
  const numbers = values as number[];
  const plus = numbers.slice(0, slice.plus.length).reduce((sum, value) => sum + value, 0);
  const result = plus - numbers.slice(slice.plus.length).reduce((sum, value) => sum + value, 0);
  if (result < 0) throw new Error('Recorte de idade negativo: faixas da fonte incoerentes. Publicação bloqueada.');
  return result;
}
export const sliceCount = (slice: Slice) => Math.max(1, slice.plus.length + (slice.minus?.length ?? 0));

/**
 * Distribuição de um recorte com a soma conferida pelo modo da tabela. Na amostra, o limite do arredondamento é o de cada
 * recorte da fonte vezes o número de recortes combinados (`slices`).
 */
export function buildDistribution(spec: Pick<DistributionSpec, 'kind' | 'mode' | 'source'>, total: number | null, categories: Array<{ label: string; value: number | null }>, slices: number, label: string) {
  const items = categories.map((item) => ({ key: categoryKey(item.label), label: item.label, value: item.value }));
  const base = { kind: spec.kind, source: spec.source, total, categories: items, ...(slices > 1 ? { slices } : {}) };
  if (total === null || items.some((item) => item.value === null)) return contextDistributionSchema.parse(base);
  const sum = items.reduce((value, item) => value + item.value!, 0);
  if (spec.mode === 'exact' && sum !== total) throw new Error(`${label}: categorias somam ${sum}, total ${total}. Publicação bloqueada.`);
  if (spec.mode === 'partial' && sum > total) throw new Error(`${label}: categorias (${sum}) acima do total (${total}). Publicação bloqueada.`);
  if (spec.mode === 'rounding') {
    const limit = Math.ceil((items.length + 1) / 2) * slices;
    if (Math.abs(sum - total) > limit) throw new Error(`${label}: categorias somam ${sum}, total ${total}; acima do arredondamento (${limit}). Publicação bloqueada.`);
  }
  return contextDistributionSchema.parse({ ...base, ...(sum !== total ? spec.mode === 'partial' ? { undistributed: total - sum } : { roundingDifference: sum - total } : {}) });
}

/** Situação das favelas de um município pelas duas fontes; divergência não declarada bloqueia. */
export function favelaStatus(code: string, inSidra: boolean, hasFavelaTract: boolean): 'present' | 'not-delimited' | 'divergent' {
  if (FAVELA_DIVERGENCES[code]) {
    if (inSidra || !hasFavelaTract) throw new Error(`Divergência declarada de favelas em ${code} não se confirma nas fontes; revisar a declaração.`);
    return 'divergent';
  }
  if (inSidra !== hasFavelaTract) throw new Error(`Favelas em ${code}: ${inSidra ? 'na SIDRA sem setor de favela' : 'setor de favela ausente da SIDRA'}. Publicação bloqueada.`);
  return inSidra ? 'present' : 'not-delimited';
}

/** Soma dos municípios × valor da UF: exata no universo; na amostra, até metade do número de municípios (um arredondamento por célula). */
export function ufTolerance(kind: Kind, municipalities: number) { return kind === 'universo' ? 0 : Math.ceil(municipalities / 2); }

/** Cada tema e recorte dos contratos tem uma especificação, e vice-versa. */
export function specCoverageErrors() {
  const errors: string[] = [];
  for (const [theme, slices] of Object.entries(CENSUS_THEMES)) {
    const specs = DISTRIBUTIONS.filter((spec) => spec.theme === theme);
    if (specs.length !== 1) errors.push(`${theme}: ${specs.length} especificações`);
    else if (Object.keys(specs[0]!.slices).sort().join() !== [...slices].sort().join()) errors.push(`${theme}: recortes divergentes`);
  }
  return errors;
}
