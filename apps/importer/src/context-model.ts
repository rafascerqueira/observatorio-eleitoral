import type { z } from 'zod';
import { contextDistributionSchema } from '@observatorio/contracts';
import { assertEqual } from './model';

type Distribution = z.infer<typeof contextDistributionSchema>;

/** Uma categoria por célula consultada; Map não pode esconder duplicatas ou linhas novas da fonte. */
export function uniqueSidraValues(rows: Array<Record<string, string>>, column: string, parse: (value: string | undefined) => number | null) {
  const result = new Map<string, number | null>();
  for (const row of rows) {
    const name = row[column];
    if (!name || result.has(name)) throw new Error(`Categoria SIDRA ausente ou duplicada: ${name}. Publicação bloqueada.`);
    result.set(name, parse(row.V));
  }
  return result;
}
/** Linha ausente é falha estrutural; linha presente com sentinela nula é ausência declarada da fonte. */
export function requiredSidraValue(values: Map<string, number | null>, key: string) {
  if (!values.has(key)) throw new Error(`Célula SIDRA obrigatória ausente: ${key}. Publicação bloqueada.`);
  return values.get(key)!;
}
type Category = { key: string; label: string };

/** Faixas etárias do perfil do eleitorado do TSE, na ordem da fonte; idades de 16 a 20 são simples. */
export const TSE_AGE_BANDS: Array<Category & { from: number; to: number }> = [
  ...[16, 17, 18, 19, 20].map((age) => ({ key: `a${age}`, label: `${age} anos`, from: age, to: age })),
  { key: 'a21-24', label: '21 a 24 anos', from: 21, to: 24 },
  ...Array.from({ length: 15 }, (_, index) => 25 + index * 5).map((from) => ({ key: `a${from}-${from + 4}`, label: `${from} a ${from + 4} anos`, from, to: from + 4 })),
  { key: 'a100+', label: '100 anos ou mais', from: 100, to: 200 },
];
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
const TSE_CATEGORIES: Record<'gender' | 'education' | 'maritalStatus', Array<Category & { source: string }>> = {
  gender: [{ key: 'female', label: 'Feminino', source: 'FEMININO' }, { key: 'male', label: 'Masculino', source: 'MASCULINO' }],
  education: [
    ['illiterate', 'Analfabeto', 'ANALFABETO'], ['reads-writes', 'Lê e escreve', 'LE E ESCREVE'], ['fundamental-incomplete', 'Ensino fundamental incompleto', 'ENSINO FUNDAMENTAL INCOMPLETO'],
    ['fundamental-complete', 'Ensino fundamental completo', 'ENSINO FUNDAMENTAL COMPLETO'], ['high-school-incomplete', 'Ensino médio incompleto', 'ENSINO MEDIO INCOMPLETO'],
    ['high-school-complete', 'Ensino médio completo', 'ENSINO MEDIO COMPLETO'], ['college-incomplete', 'Superior incompleto', 'SUPERIOR INCOMPLETO'], ['college-complete', 'Superior completo', 'SUPERIOR COMPLETO'],
  ].map(([key, label, source]) => ({ key: key!, label: label!, source: source! })),
  maritalStatus: [['single', 'Solteiro(a)', 'SOLTEIRO'], ['married', 'Casado(a)', 'CASADO'], ['separated', 'Separado(a) judicialmente', 'SEPARADO JUDICIALMENTE'], ['divorced', 'Divorciado(a)', 'DIVORCIADO'], ['widowed', 'Viúvo(a)', 'VIUVO']]
    .map(([key, label, source]) => ({ key: key!, label: label!, source: source! })),
};
const NOT_INFORMED: Category = { key: 'not-informed', label: 'Não informado na fonte' };
const INVALID_AGE: Category = { key: 'invalid', label: 'Idade inválida na fonte' };
// Os rótulos auditados são finitos. Normalizar cada faixa em cada linha repetia o mesmo trabalho milhões de vezes.
const TSE_LOOKUP = {
  age: new Map(TSE_AGE_BANDS.map(({ key, label }) => [fold(label), { key, label }])),
  ...Object.fromEntries(Object.entries(TSE_CATEGORIES).map(([dimension, categories]) =>
    [dimension, new Map(categories.map(({ key, label, source }) => [source, { key, label }]))])),
} as Record<'gender' | 'age' | 'education' | 'maritalStatus', Map<string, Category>>;

/** Categoria do TSE pelo rótulo da fonte; rótulo não auditado bloqueia em vez de ser descartado. */
export function tseCategory(dimension: 'gender' | 'age' | 'education' | 'maritalStatus', label: string): Category {
  const value = fold(label);
  if (value === 'NAO INFORMADO') return NOT_INFORMED;
  if (dimension === 'age') {
    // "Inválido" (comparecimento) e "Inválida" (perfil do eleitorado): mesma categoria da fonte, grafias diferentes; nunca redistribuída.
    if (value === 'INVALIDO' || value === 'INVALIDA') return INVALID_AGE;
  }
  const item = TSE_LOOKUP[dimension].get(value);
  if (item) return { key: item.key, label: item.label };
  throw new Error(`Categoria do TSE não auditada (${dimension}): ${label}. Importação bloqueada.`);
}
/** Ordem de exibição: a da fonte, com "não informado"/"inválido" ao final. */
export function tseOrder(dimension: 'gender' | 'age' | 'education' | 'maritalStatus') {
  return [...(dimension === 'age' ? TSE_AGE_BANDS : TSE_CATEGORIES[dimension]).map(({ key, label }) => ({ key, label })), ...(dimension === 'age' ? [INVALID_AGE] : []), NOT_INFORMED];
}

/**
 * Distribuição com soma conferida. `exact` (universo, cadastro): as categorias somam o total. `rounding` (amostra): cada
 * célula é expandida e arredondada, então a diferença pode chegar a metade do número de células — registrada, nunca
 * ajustada. `partial`: a fonte publica um total maior que a soma das categorias; a diferença é exibida como não discriminada.
 * Com supressão (`null`), não há como conferir.
 */
export function distribution(kind: Distribution['kind'], source: string, total: number | null, categories: Distribution['categories'], label: string, mode: 'exact' | 'rounding' | 'partial' = 'exact'): Distribution {
  if (total === null || categories.some((item) => item.value === null)) return contextDistributionSchema.parse({ kind, source, total, categories });
  const sum = categories.reduce((value, item) => value + item.value!, 0);
  if (mode === 'exact') assertEqual(sum, total, `${label}: soma das categorias`);
  if (mode === 'rounding') {
    const limit = Math.ceil((categories.length + 1) / 2);
    if (Math.abs(sum - total) > limit) throw new Error(`${label}: soma das categorias ${sum}, total ${total}; diferença acima do arredondamento (${limit}). Publicação bloqueada.`);
    return contextDistributionSchema.parse({ kind, source, total, categories, ...(sum !== total ? { roundingDifference: sum - total } : {}) });
  }
  if (mode === 'partial') {
    if (sum > total) throw new Error(`${label}: categorias (${sum}) acima do total (${total}). Publicação bloqueada.`);
    return contextDistributionSchema.parse({ kind, source, total, categories, ...(sum !== total ? { undistributed: total - sum } : {}) });
  }
  return contextDistributionSchema.parse({ kind, source, total, categories });
}

type AgeValues = Map<string, number | null>; // nome da categoria da SIDRA 9514 → valor
/**
 * População por faixas do TSE a partir da SIDRA 9514 (idade simples e grupos quinquenais). 21–24 = (20–24) − 20.
 * A partição completa (0–4, 5–9, 10–14, 15, 16…19, 20–24, 25–29 … 95–99, 100+) precisa somar o total.
 */
export function populationByAge(values: AgeValues, label: string) {
  const get = (name: string) => { if (!values.has(name)) throw new Error(`${label}: idade ${name} ausente na consulta.`); return values.get(name)!; };
  const total = get('Total');
  const partition = ['0 a 4 anos', '5 a 9 anos', '10 a 14 anos', '15 anos', '16 anos', '17 anos', '18 anos', '19 anos', '20 a 24 anos',
    ...Array.from({ length: 15 }, (_, index) => `${25 + index * 5} a ${29 + index * 5} anos`), '100 anos ou mais'];
  const parts = partition.map(get);
  if (total !== null && parts.every((value) => value !== null)) assertEqual(parts.reduce((sum, value) => sum + value!, 0), total, `${label}: idades somam o total`);
  const twenty = get('20 anos'), twentyTo24 = get('20 a 24 anos');
  if (twenty !== null && twentyTo24 !== null && twenty > twentyTo24) throw new Error(`${label}: 20 anos maior que 20 a 24 anos.`);
  const band = (item: typeof TSE_AGE_BANDS[number]) => item.key === 'a21-24' ? (twenty === null || twentyTo24 === null ? null : twentyTo24 - twenty)
    : get(item.from === item.to ? `${item.from} anos` : item.key === 'a100+' ? '100 anos ou mais' : `${item.from} a ${item.to} anos`);
  const categories = TSE_AGE_BANDS.map((item) => ({ key: item.key, label: item.label, value: band(item) }));
  const sum = (keys: string[]) => { const selected = categories.filter((item) => keys.includes(item.key)); return selected.some((item) => item.value === null) ? null : selected.reduce((total, item) => total + item.value!, 0); };
  const age16plus = categories.some((item) => item.value === null) ? null : categories.reduce((sum, item) => sum + item.value!, 0);
  return {
    population: { total, age16plus, age16to17: sum(['a16', 'a17']), age18to69: sum(categories.filter((item) => { const band = TSE_AGE_BANDS.find((entry) => entry.key === item.key)!; return band.from >= 18 && band.to <= 69; }).map((item) => item.key)),
      age70plus: sum(categories.filter((item) => TSE_AGE_BANDS.find((entry) => entry.key === item.key)!.from >= 70).map((item) => item.key)) },
    populationByAge: { kind: 'universo' as const, source: 'IBGE, Censo 2022 — SIDRA 9514 (faixas do TSE; 21 a 24 = 20 a 24 − 20 anos)', total: age16plus, categories },
  };
}
