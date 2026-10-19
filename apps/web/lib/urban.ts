import { URBAN_CHARACTERISTICS, URBAN_INDICATORS, urbanIndex, type UrbanIndicator } from '@observatorio/contracts';

/** Item ausente de cada indicador exibido: "NÃO" ou, na arborização, "SEM ÁRVORES"; as demais categorias são não declarado ou saltado. */
const ABSENT: Record<UrbanIndicator, string> = { 'urban-sidewalk': 'NÃO', 'urban-ramp': 'NÃO', 'urban-obstacle': 'NÃO', 'urban-lighting': 'NÃO', 'urban-paving': 'NÃO', 'urban-drain': 'NÃO', 'urban-bus-stop': 'NÃO', 'urban-trees': 'SEM ÁRVORES' };
export const URBAN_SHORT_LABELS: Record<UrbanIndicator, string> = { 'urban-sidewalk': 'Calçada', 'urban-ramp': 'Rampa para cadeirante', 'urban-obstacle': 'Obstáculo na calçada', 'urban-lighting': 'Iluminação pública',
  'urban-paving': 'Via pavimentada', 'urban-drain': 'Bueiro', 'urban-bus-stop': 'Ponto de ônibus', 'urban-trees': 'Ao menos uma árvore' };

/**
 * Moradores com o item, sem o item e em faces não declaradas ou não avaliadas, lidos das categorias publicadas (somam a base).
 * Nada é redistribuído: "não declarado ou não avaliado" é a soma das categorias restantes da mesma característica.
 */
export function urbanRows(counts: readonly number[]) {
  return (Object.keys(URBAN_INDICATORS) as UrbanIndicator[]).map((indicator) => {
    const { characteristic, categories } = URBAN_INDICATORS[indicator];
    const all = URBAN_CHARACTERISTICS.find((item) => item.key === characteristic)!.categories as readonly string[];
    const sum = (list: readonly string[]) => list.reduce((total, category) => total + counts[urbanIndex(characteristic, category)]!, 0);
    const present = sum(categories), absent = sum([ABSENT[indicator]]);
    return { indicator, label: URBAN_SHORT_LABELS[indicator], present, absent, other: sum(all.filter((category) => !(categories as readonly string[]).includes(category) && category !== ABSENT[indicator])), base: counts[0]! };
  });
}
