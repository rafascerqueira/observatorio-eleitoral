import { CANDIDATE_MAP_CUTS, OFFICE_LABELS, percent, type CandidateMap, type MapPageQuery, type MapValues } from '@observatorio/contracts';

type Item = MapValues['items'][number];
/**
 * Série comparada de `/mapa`: abstenção do cargo (escala em quintis do recorte) ou % dos válidos de uma candidatura (escala fixa
 * dos mapas por candidatura). `weight` nomeia o denominador, que dá a área dos pontos da dispersão.
 */
export type ComparedSeries = { kind: 'abstention' | 'candidate'; title: string; source: string; items: Item[]; weight: string; cuts?: readonly number[]; resultsId: string | null; contextId: string | null };
export type SeriesState = { status: 'ready'; series: ComparedSeries } | { status: 'round-not-held' | 'awaiting-import' | 'unavailable' | 'unknown-candidate' };

/** Uma candidatura como série do mapa: % dos válidos da unidade; sem válidos, sem valor (nunca zero presumido). */
export function candidateSeries(data: CandidateMap, index: number): Item[] {
  return data.items.map((item) => ({ id: item.id, code: item.code, uf: item.uf, name: item.name, numerator: item.votes[index]!, denominator: item.valid, value: percent(item.votes[index]!, item.valid) }));
}
const publication = (list: MapValues['publications'], role: 'results' | 'context') => list?.find((item) => item.role === role)?.id ?? null;

/** Resolve a série pedida a partir das respostas da API; candidatura fora do recorte é erro do filtro, não série vazia. */
export function resolveSeries(filters: Pick<MapPageQuery, 'series' | 'office' | 'round'>, candidates: CandidateMap | null, abstention: MapValues | null): SeriesState {
  const recorte = `${OFFICE_LABELS[filters.office]}, ${filters.round}º turno`;
  if (filters.series === 'abstention') {
    if (!abstention) return { status: 'unavailable' };
    if (abstention.status !== 'published') return { status: abstention.status };
    return { status: 'ready', series: { kind: 'abstention', title: `Abstenção — ${recorte}`, source: 'TSE, resultados reconciliados · abstenções ÷ eleitores aptos', items: abstention.items, weight: 'eleitores aptos',
      resultsId: publication(abstention.publications, 'results'), contextId: publication(abstention.publications, 'context') } };
  }
  if (!candidates) return { status: 'unavailable' };
  if (candidates.status !== 'published') return { status: candidates.status };
  const index = candidates.candidates.findIndex((item) => item.number === filters.series);
  if (index < 0) return { status: 'unknown-candidate' };
  const candidate = candidates.candidates[index]!;
  return { status: 'ready', series: { kind: 'candidate', title: `${candidate.name} (${candidate.number}) — % dos votos válidos`, source: `${candidate.party} · ${recorte} · votos da candidatura ÷ votos válidos`,
    items: candidateSeries(candidates, index), weight: 'votos válidos', cuts: CANDIDATE_MAP_CUTS, resultsId: publication(candidates.publications, 'results'), contextId: publication(candidates.publications, 'context') } };
}

export type MapRow = { id: string | null; code: string; uf: string; name: string; census: Item; series: Item | null };
/**
 * Unidades do indicador do Censo com o valor da série pelo código IBGE do polígono (a ordem é a da tabela). Unidade da série sem
 * correspondência no Censo 2022 (município criado depois) entra no fim, com o Censo sem dado: nunca é descartada.
 */
export function joinSeries(census: Item[], series: Item[]): MapRow[] {
  const byId = new Map(series.flatMap((item) => item.id === null ? [] : [[item.id, item] as const]));
  const joined = census.map((item) => ({ id: item.id, code: item.code, uf: item.uf, name: item.name, census: item, series: item.id === null ? null : byId.get(item.id) ?? null }));
  const censusIds = new Set(census.map((item) => item.id));
  const extra = series.filter((item) => item.id === null || !censusIds.has(item.id))
    .map((item) => ({ id: item.id, code: item.code, uf: item.uf, name: item.name, census: { ...item, numerator: null, denominator: null, value: null }, series: item }));
  return [...joined, ...extra];
}

/** Campo de texto em CSV com `;`: entre aspas quando preciso e sem iniciar fórmula de planilha. */
export function csvText(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
/** Percentual com vírgula decimal (planilhas em português) e quatro casas; vazio quando não há valor. */
export const csvPercent = (value: number | null) => value === null ? '' : value.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: false });
const csvCount = (value: number | null) => value === null ? '' : String(value);
export const MAP_CSV_COLUMNS = ['uf', 'codigo_tse', 'codigo_ibge', 'nome', 'indicador_censo', 'censo_numerador', 'censo_denominador', 'censo_percentual', 'serie', 'serie_numerador', 'serie_denominador', 'serie_percentual', 'publicacao_contexto', 'publicacao_resultados'] as const;
/**
 * Dados de uma visão de `/mapa`: contagens e denominadores como publicados, percentuais recalculados só para leitura, e as versões
 * das publicações em cada linha (arquivo autodescritivo). UTF-8 com BOM e `;`, como os arquivos do TSE e do IBGE.
 */
export function mapCsv(rows: MapRow[], indicatorLabel: string, series: ComparedSeries, contextId: string | null) {
  const lines = rows.map((row) => [row.uf, row.code, row.id ?? '', row.name, indicatorLabel, csvCount(row.census.numerator), csvCount(row.census.denominator), csvPercent(row.census.value),
    series.title, csvCount(row.series?.numerator ?? null), csvCount(row.series?.denominator ?? null), csvPercent(row.series?.value ?? null), contextId ?? '', series.resultsId ?? ''].map(csvText).join(';'));
  return `﻿${[MAP_CSV_COLUMNS.join(';'), ...lines].join('\r\n')}\r\n`;
}
/** Nome do arquivo exportado: só ASCII, com o recorte completo. */
export function mapCsvName(filters: MapPageQuery) {
  return `mapa-${filters.year}-${filters.round}turno-${filters.uf ?? 'BR'}-${filters.indicator}-${filters.series === 'abstention' ? 'abstencao' : `candidatura-${filters.series}`}-${filters.office}.csv`;
}
