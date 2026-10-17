import { INCOME_BANDS, MINIMUM_WAGE_2022, percent, type IncomeBandPopulation } from '@observatorio/contracts';

const reais = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const wages = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const band = (index: number) => INCOME_BANDS.find((item) => item.index === index)!;

/** Nome curto da faixa fixa em salários mínimos de 2022. */
export function bandName(index: number) {
  const { lower, upper } = band(index);
  return lower === null ? `Até ${wages(upper!)} SM` : upper === null ? `Mais de ${wages(lower)} SM` : `Mais de ${wages(lower)} a ${wages(upper)} SM`;
}
/** Limites da faixa em reais, por extenso (limite superior incluído). */
export function bandRange(index: number) {
  const { lower, upper } = band(index);
  return lower === null ? `de até ${reais(upper! * MINIMUM_WAGE_2022)}` : upper === null ? `acima de ${reais(lower * MINIMUM_WAGE_2022)}` : `acima de ${reais(lower * MINIMUM_WAGE_2022)} até ${reais(upper * MINIMUM_WAGE_2022)}`;
}
/** Percentual dos moradores em setores com mediana (mesma base das faixas; setores sem mediana ficam fora, como os locais sem indicador). */
export function residentsShare(population: IncomeBandPopulation, index: number) {
  return percent(population.bands[index - 1]!.residents, population.total - population.noData.residents);
}
