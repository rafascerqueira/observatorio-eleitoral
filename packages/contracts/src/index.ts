import { z } from 'zod';

export const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;
export const TERRITORIES = [...STATES, 'ZZ'] as const;
export const OFFICES = ['president', 'governor', 'senator'] as const;
export type Office = typeof OFFICES[number];
export const OFFICE_LABELS: Record<Office, string> = { president: 'Presidência', governor: 'Governador', senator: 'Senador' };
/** Cargos estaduais: candidaturas diferem por UF; resultados não são comparáveis entre UFs nem somados ao Brasil. */
export const STATE_OFFICES: readonly Office[] = ['governor', 'senator'];
/** Cargos eleitos por maioria simples em turno único: não existe 2º turno, nem a ser importado. */
export const SINGLE_ROUND_OFFICES: readonly Office[] = ['senator'];
export const isStateOffice = (office: Office) => STATE_OFFICES.includes(office);
const integerParameter = (minimum: number, maximum: number, fallback: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(minimum).max(maximum)).default(fallback);

export const municipalityQuerySchema = z.object({
  year: z.enum(['2022', '2026']).default('2022'),
  round: z.enum(['1', '2']).default('1'),
  office: z.enum(OFFICES).default('president'),
  uf: z.enum(STATES).optional(),
  search: z.string().trim().max(100).optional(),
  page: integerParameter(1, 1_000_000, 1),
  pageSize: integerParameter(1, 100, 25),
  sort: z.enum(['municipality', 'uf']).default('municipality'),
  direction: z.enum(['asc', 'desc']).default('asc'),
}).strict();
export type MunicipalityQuery = z.infer<typeof municipalityQuerySchema>;
export const nationalQuerySchema = municipalityQuerySchema.pick({ year: true, round: true }).extend({ office: z.literal('president').default('president') }).strict();
export type NationalQuery = z.infer<typeof nationalQuerySchema>;

const optionalIdentifier = (maximum: number) => z.string().trim().regex(/^\d+$/)
  .transform(Number).pipe(z.number().int().min(1).max(maximum)).optional();
export const placesQuerySchema = municipalityQuerySchema.pick({
  year: true, round: true, office: true, uf: true, page: true, pageSize: true, search: true,
}).extend({
  uf: z.enum(TERRITORIES).optional(),
  zone: optionalIdentifier(9999),
  section: optionalIdentifier(99999),
  local: optionalIdentifier(99999),
}).strict();
export type PlacesQuery = z.infer<typeof placesQuerySchema>;

const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const candidateSchema = z.object({
  number: z.string(), name: z.string(), party: z.string(), votes: nonnegative,
  percentValid: z.number().min(0).max(100).nullable(),
});
export const voteTotalsSchema = z.object({
  eligible: nonnegative.nullable(), turnout: nonnegative.nullable(), abstentions: nonnegative.nullable(),
  valid: nonnegative, blank: nonnegative, null: nonnegative, totalVotes: nonnegative,
  nonInstalledEligible: nonnegative.nullable().optional(),
  // Recortes com votos não computados como válidos (Governador v2, Senador). Ausentes nas versões anteriores:
  // não significam zero. `technicalNull` está contido em `null`; anulados ficam fora de válidos e nulos.
  annulled: nonnegative.nullable().optional(), annulledSubJudice: nonnegative.nullable().optional(), technicalNull: nonnegative.nullable().optional(),
});
export const NON_VALID_CATEGORIES = ['annulled', 'annulled-sub-judice', 'technical-null'] as const;
export const NON_VALID_LABELS: Record<typeof NON_VALID_CATEGORIES[number], string> = { annulled: 'Anulado', 'annulled-sub-judice': 'Anulado sub judice', 'technical-null': 'Nulo técnico' };
/** Votos em candidaturas que o TSE não computa como válidos; sem percentual sobre válidos. */
export const nonValidVoteSchema = z.object({
  number: z.string(), name: z.string(), party: z.string().nullable(), category: z.enum(NON_VALID_CATEGORIES),
  // Nome de urna e situação vêm do arquivo nominal; para nulo técnico, só o nome do arquivo de seções existe.
  nameSource: z.enum(['nominal', 'section']), detail: z.string().nullable(), votes: nonnegative,
});
export const municipalitySchema = z.object({
  code: z.string(), name: z.string(), uf: z.enum(STATES), electionCode: z.string(), round: z.enum(['1', '2']),
  totals: voteTotalsSchema, candidates: z.array(candidateSchema), zones: nonnegative, sections: nonnegative, pollingPlaces: nonnegative,
  nonInstalledSections: nonnegative.optional(), nonValidVotes: z.array(nonValidVoteSchema).optional(),
});
export type MunicipalityResult = z.infer<typeof municipalitySchema>;
export const exteriorCitySchema = municipalitySchema.extend({ uf: z.literal('ZZ') });
export type ExteriorCityResult = z.infer<typeof exteriorCitySchema>;
export const sourceSchema = z.object({
  file: z.string(), entry: z.string(), url: z.url(), sha256: z.string().length(64),
  downloadedAt: z.string(), generatedAt: z.array(z.string()), lastModified: z.string().nullable(),
  rowsRead: nonnegative, rowsSelected: nonnegative,
  sizeBytes: nonnegative.optional(), originalUrl: z.string().optional(),
  downloadedAtBasis: z.enum(['filesystem-mtime', 'download-response']).optional(),
});
export const datasetSchema = z.object({
  id: z.string(), year: z.literal(2022), office: z.enum(OFFICES), municipalityCode: z.string().optional(),
  municipalityName: z.string().optional(), uf: z.enum(TERRITORIES).optional(), importedAt: z.string(), importerVersion: z.string(),
  sources: z.array(sourceSchema), scope: z.string(), validation: z.literal('reconciled'),
  level: z.enum(['municipality', 'national', 'exterior', 'state']).default('municipality'),
  // Ausente nas versões antigas (Presidência, dois turnos): não significa turno único.
  rounds: z.array(z.enum(['1', '2'])).min(1).optional(),
  coverage: z.object({ expected: nonnegative, reconciled: nonnegative, blocked: nonnegative, excluded: nonnegative }).optional(),
  // Linhas de outra eleição presentes nas entradas e excluídas explicitamente (ex.: suplementar posterior).
  exclusions: z.array(z.object({ electionCode: z.string(), description: z.string(), reason: z.string(), rows: z.record(z.string(), nonnegative) })).optional(),
});
export const coverageItemSchema = z.object({
  uf: z.enum(TERRITORIES), code: z.string(), name: z.string(),
  status: z.enum(['reconciled', 'blocked', 'excluded', 'pending']), reason: z.string().nullable(),
  sectionRows: nonnegative, metadataConflicts: nonnegative,
});
export const catalogSchema = z.object({
  datasets: z.array(datasetSchema),
  imports: z.array(z.object({ id: z.string(), scope: z.string(), published: z.boolean(), failureReason: z.string().nullable().default(null), coverage: z.array(z.object({ uf: z.enum(TERRITORIES), status: coverageItemSchema.shape.status, municipalities: nonnegative, sectionRows: nonnegative })) })),
  plannedOffices: z.array(z.object({ office: z.string(), label: z.string(), status: z.literal('not-imported') })),
  contextDatasets: z.array(z.lazy(() => contextDatasetSchema)).default([]),
  mapDatasets: z.array(z.lazy(() => mapDatasetSchema)).default([]),
  tractsDatasets: z.array(z.lazy(() => tractsDatasetSchema)).default([]),
  placeProfilesDatasets: z.array(z.lazy(() => placeProfilesDatasetSchema)).default([]),
  placeGroupsImport: z.object({ id: z.string(), importerVersion: z.string(), importedAt: z.string(), recortes: nonnegative, scope: z.string() }).nullable().default(null),
});
const filtersSchema = z.object({ year: z.enum(['2022', '2026']), round: z.enum(['1', '2']), office: z.enum(OFFICES), uf: z.enum(STATES).optional(), search: z.string().optional(), sort: z.enum(['municipality', 'uf']), direction: z.enum(['asc', 'desc']) });
export const emptyMunicipalitiesSchema = z.object({
  status: z.literal('awaiting-import'),
  items: z.array(z.never()).length(0),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive().max(100), total: z.literal(0) }),
  filters: filtersSchema,
  dataset: z.null(),
});
export type EmptyMunicipalities = z.infer<typeof emptyMunicipalitiesSchema>;
export const municipalitiesSchema = z.discriminatedUnion('status', [emptyMunicipalitiesSchema, z.object({
  status: z.literal('published'), items: z.array(municipalitySchema),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive().max(100), total: nonnegative }),
  filters: filtersSchema, dataset: datasetSchema,
}), z.object({
  // A publicação existe, mas a apuração não registra este turno para o cargo na UF.
  status: z.literal('round-not-held'), items: z.array(z.never()).length(0),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive().max(100), total: z.literal(0) }),
  filters: filtersSchema, dataset: datasetSchema,
})]);
export type MunicipalitiesResponse = z.infer<typeof municipalitiesSchema>;
export const nationalSummarySchema = z.object({
  municipalities: nonnegative, sections: nonnegative, pollingPlaces: nonnegative,
  nonInstalledSections: nonnegative.nullable(), totals: voteTotalsSchema, candidates: z.array(candidateSchema),
  nonValidVotes: z.array(nonValidVoteSchema).optional(),
  exteriorCities: nonnegative.default(0),
  nonInstalledCases: z.array(z.object({ uf: z.enum(TERRITORIES), code: z.string(), name: z.string(), electors: nonnegative, sections: nonnegative.nullable() })).default([]),
});
export const nationalResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import'), filters: nationalQuerySchema, summary: z.null(), dataset: z.null() }),
  z.object({ status: z.literal('published'), filters: nationalQuerySchema, summary: nationalSummarySchema, dataset: datasetSchema,
    exteriorDataset: datasetSchema.nullable().default(null), includesExterior: z.boolean().default(false) }),
]);
export type NationalResponse = z.infer<typeof nationalResponseSchema>;
export const exteriorQuerySchema = municipalityQuerySchema.omit({ uf: true, sort: true, direction: true }).extend({ office: z.literal('president').default('president') }).strict();
export type ExteriorQuery = z.infer<typeof exteriorQuerySchema>;
const exteriorFiltersSchema = exteriorQuerySchema.omit({ page: true, pageSize: true }).extend({ page: z.number().int().positive(), pageSize: z.number().int().positive().max(100) });
export const exteriorResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import'), filters: exteriorFiltersSchema, summary: z.null(), dataset: z.null(), items: z.array(z.never()).length(0),
    pagination: z.object({ page: nonnegative, pageSize: nonnegative, total: z.literal(0) }) }),
  z.object({ status: z.literal('published'), filters: exteriorFiltersSchema, summary: nationalSummarySchema, dataset: datasetSchema,
    items: z.array(exteriorCitySchema), pagination: z.object({ page: nonnegative, pageSize: nonnegative, total: nonnegative }) }),
]);
export const stateQuerySchema = municipalityQuerySchema.pick({ year: true, round: true, office: true }).extend({ uf: z.enum(STATES) }).strict();
export type StateQuery = z.infer<typeof stateQuerySchema>;
export const stateResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import'), filters: stateQuerySchema, summary: z.null(), dataset: z.null() }),
  z.object({ status: z.literal('published'), filters: stateQuerySchema, summary: nationalSummarySchema, dataset: datasetSchema }),
  z.object({ status: z.literal('round-not-held'), filters: stateQuerySchema, summary: z.null(), dataset: datasetSchema }),
]);
export type StateResponse = z.infer<typeof stateResponseSchema>;
export const pollingPlaceSchema = z.object({
  zone: z.number().int().positive(), code: z.string(), name: z.string().nullable(), address: z.string().nullable(),
  sections: nonnegative, totals: voteTotalsSchema, candidates: z.array(candidateSchema),
  metadataConflict: z.boolean(), nonValidVotes: z.array(nonValidVoteSchema).optional(),
  metadataVariants: z.array(z.object({ name: z.string().nullable(), address: z.string().nullable() })),
});
export const placesResponseSchema = z.object({
  items: z.array(pollingPlaceSchema.extend({ sectionNumbers: z.array(z.number().int().positive()) })),
  total: nonnegative, page: z.number().int().positive(), pageSize: z.number().int().positive().max(100), dataset: datasetSchema,
  municipality: municipalitySchema.pick({ code: true, name: true, uf: true }).extend({ uf: z.enum(TERRITORIES) }).optional(),
});
/** Contexto municipal (IBGE, Censo 2022) e perfis do TSE. Contagem `null` = suprimida, inexistente ou não disponível na fonte — nunca zero presumido. */
const sourceCount = nonnegative.nullable();
export const CONTEXT_KINDS = ['universo', 'amostra', 'cadastro'] as const;
export const contextDistributionSchema = z.object({
  // `kind`: universo (todas as pessoas), amostra (estimativa com erro amostral) ou cadastro do TSE; `source` identifica a tabela.
  kind: z.enum(CONTEXT_KINDS), source: z.string(), total: sourceCount,
  categories: z.array(z.object({ key: z.string(), label: z.string(), value: sourceCount })),
  // Pessoas no total da fonte sem discriminação nas categorias publicadas (ex.: cor ou raça na SIDRA 9605). Calculado, nunca redistribuído.
  undistributed: nonnegative.optional(),
  // Estimativas da amostra arredondadas célula a célula: soma das categorias − total, dentro do limite do arredondamento.
  roundingDifference: z.number().int().optional(),
});
export const TURNOUT_DIMENSIONS = ['gender', 'age', 'education', 'maritalStatus'] as const;
const turnoutCountsSchema = z.object({ eligible: nonnegative, turnout: nonnegative, abstentions: nonnegative });
export const turnoutRoundSchema = turnoutCountsSchema.extend({
  dimensions: z.array(z.object({ dimension: z.enum(TURNOUT_DIMENSIONS), categories: z.array(turnoutCountsSchema.extend({ key: z.string(), label: z.string() })) })),
});
export const municipalityContextSchema = z.object({
  code: z.string(), name: z.string(), uf: z.enum(STATES), ibgeCode: z.string().regex(/^\d{7}$/), ibgeName: z.string(),
  population: z.object({ total: sourceCount, age16plus: sourceCount, age16to17: sourceCount, age18to69: sourceCount, age70plus: sourceCount }),
  populationByAge: contextDistributionSchema, race: contextDistributionSchema, literacy15: contextDistributionSchema,
  education18: contextDistributionSchema, incomeClasses: contextDistributionSchema,
  incomePerCapita: z.object({ mean: z.number().nonnegative().nullable(), median: z.number().nonnegative().nullable(), source: z.string() }),
  // Cadastro do TSE: base própria, que não fecha com os resultados; `resultsEligible` traz os aptos dos resultados para a diferença declarada.
  electorate: z.object({ eligible: nonnegative, gender: contextDistributionSchema, age: contextDistributionSchema, education: contextDistributionSchema, maritalStatus: contextDistributionSchema }),
  resultsEligible: z.object({ '1': sourceCount, '2': sourceCount }),
  // Comparecimento por perfil: `null` quando a fonte não traz a UF (DF em 2022).
  turnout: z.object({ '1': turnoutRoundSchema.nullable(), '2': turnoutRoundSchema.nullable() }),
});
export type MunicipalityContext = z.infer<typeof municipalityContextSchema>;
export const contextDatasetSchema = z.object({
  id: z.string(), kind: z.literal('municipal-context'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(),
  sources: z.array(sourceSchema), scope: z.string(), validation: z.literal('checked'),
  coverage: z.object({ expected: nonnegative, published: nonnegative, withoutTurnout: z.array(z.enum(TERRITORIES)) }),
  notes: z.array(z.string()),
});
export const mapDatasetSchema = z.object({
  id: z.string(), kind: z.literal('maps'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(),
});
/** Indicadores do mapa: cada um com fonte, tipo de dado, numerador e denominador explícitos. */
export const MAP_INDICATORS = {
  'income-upto-half-mw': { label: 'Moradores com rendimento domiciliar per capita de até ½ salário mínimo (inclui sem rendimento)', source: 'IBGE, Censo 2022 — SIDRA 10296', kind: 'amostra', family: 'ibge' },
  'college-18': { label: 'Pessoas de 18 anos ou mais com superior completo', source: 'IBGE, Censo 2022 — SIDRA 10061', kind: 'amostra', family: 'ibge' },
  'literacy-15': { label: 'Pessoas de 15 anos ou mais alfabetizadas', source: 'IBGE, Censo 2022 — SIDRA 9542', kind: 'universo', family: 'ibge' },
  abstention: { label: 'Abstenção (abstenções ÷ eleitores aptos)', source: 'TSE, resultados da Presidência 2022 reconciliados', kind: 'resultados', family: 'tse' },
} as const;
export type MapIndicator = keyof typeof MAP_INDICATORS;
export const MAP_INDICATOR_KEYS = Object.keys(MAP_INDICATORS) as [MapIndicator, ...MapIndicator[]];
export const mapQuerySchema = z.object({ year: z.enum(['2022', '2026']).default('2022'), round: z.enum(['1', '2']).default('1'), uf: z.enum(STATES).optional(), indicator: z.enum(MAP_INDICATOR_KEYS) }).strict();
export const mapValuesSchema = z.object({
  status: z.enum(['published', 'awaiting-import']), indicator: z.enum(MAP_INDICATOR_KEYS), level: z.enum(['uf', 'municipality']), round: z.enum(['1', '2']),
  // `id`: código IBGE (polígono); `code`: UF ou código TSE do município. Valor `null` quando numerador ou denominador faltam.
  items: z.array(z.object({ id: z.string(), code: z.string(), uf: z.enum(STATES), name: z.string(), numerator: sourceCount, denominator: sourceCount, value: z.number().min(0).max(100).nullable() })),
});
export type MapValues = z.infer<typeof mapValuesSchema>;
export const mapGeometrySchema = z.object({ status: z.enum(['published', 'awaiting-import']), level: z.enum(['uf', 'municipality']), uf: z.string(), batchId: z.string().nullable(), topology: z.unknown() });
export const TRACT_STATUSES = ['associated', 'no-coordinate', 'conflicting-coordinates', 'relocated', 'outside-tracts', 'other-municipality', 'ambiguous'] as const;
const statusCountSchema = z.object({ places: nonnegative, electors: nonnegative });
export const tractsDatasetSchema = z.object({
  id: z.string(), kind: z.literal('polling-place-tracts'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema),
  scope: z.string(), method: z.string(), notes: z.array(z.string()),
  coverage: z.array(z.object({ uf: z.enum(STATES), places: nonnegative, electors: nonnegative, sharedCoordinate: nonnegative, byStatus: z.record(z.enum(TRACT_STATUSES), statusCountSchema) })),
});
export const placeProfilesDatasetSchema = z.object({
  id: z.string(), kind: z.literal('place-profiles'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(),
  // Ordem das categorias de cada dimensão nos vetores de contagem guardados por local.
  order: z.record(z.enum(TURNOUT_DIMENSIONS), z.array(z.string())),
  totals: z.object({ places: nonnegative, eligible: nonnegative, contextEligible: nonnegative, resultPlaces: nonnegative, resultPlacesWithoutProfile: nonnegative }), notes: z.array(z.string()),
});
/** Métrica E: locais agrupados pelo perfil do eleitorado (TSE) ou pelo entorno (IBGE); resultados somados por grupo. */
export const PLACE_GROUP_INDICATORS = {
  college: { label: 'Eleitores aptos do local com superior completo (escolaridade declarada no alistamento)', source: 'TSE, perfil do eleitorado por seção 2022, somado por local', kind: 'cadastro', unit: 'percent' },
  'income-median': { label: 'Rendimento mediano do responsável pelo domicílio no setor censitário do local', source: 'IBGE, Censo 2022 — agregados por setor (rendimento do responsável); local → setor pelo ponto do TSE', kind: 'universo', unit: 'reais' },
} as const;
export type PlaceGroupIndicator = keyof typeof PLACE_GROUP_INDICATORS;
/** Salário mínimo vigente na data de referência do Censo 2022 (31/07/2022): R$ 1.212 (Lei 14.358/2022). */
export const MINIMUM_WAGE_2022 = 1212;
/**
 * Faixas fixas da renda (place-groups v2), iguais em todos os recortes, em múltiplos do salário mínimo de 2022:
 * limite superior incluído, inferior excluído. Muitos setores têm mediana exatamente em 1 SM; faixas fixas evitam
 * dividir valores iguais entre grupos, o que os quintis faziam.
 */
export const INCOME_BANDS = [
  { index: 1, lower: null, upper: 1 }, { index: 2, lower: 1, upper: 1.5 }, { index: 3, lower: 1.5, upper: 2 }, { index: 4, lower: 2, upper: 3 }, { index: 5, lower: 3, upper: null },
] as const;
/** Como os grupos foram formados: quintis ponderados por eleitores aptos (sem dividir valores iguais) ou faixas fixas. Ausente (v1): quintis. */
export const PLACE_GROUP_METHODS = { college: 'quintiles', 'income-median': 'bands' } as const;
export const placeGroupsQuerySchema = municipalityQuerySchema.pick({ year: true, round: true, office: true, uf: true }).extend({ indicator: z.enum(Object.keys(PLACE_GROUP_INDICATORS) as [PlaceGroupIndicator, ...PlaceGroupIndicator[]]) }).strict();
export const placeGroupsSchema = z.object({
  status: z.enum(['published', 'awaiting-import', 'round-not-held']), indicator: z.enum(Object.keys(PLACE_GROUP_INDICATORS) as [PlaceGroupIndicator, ...PlaceGroupIndicator[]]),
  office: z.enum(OFFICES), round: z.enum(['1', '2']), uf: z.enum(STATES).nullable(),
  method: z.enum(['quintiles', 'bands']).optional(),
  // `from`/`to`: menor e maior valor observado no grupo. `lower`/`upper` (só faixas): limites da faixa em reais, null quando aberta.
  groups: z.array(z.object({ index: z.number().int().min(1).max(5), from: z.number(), to: z.number(), lower: z.number().nullable().optional(), upper: z.number().nullable().optional(),
    places: nonnegative, eligible: nonnegative, valid: nonnegative, blank: nonnegative, null: nonnegative, totalVotes: nonnegative, candidates: z.array(candidateSchema) })),
  // Votos de locais sem o indicador ficam fora dos grupos e são informados aqui (nunca redistribuídos).
  coverage: z.object({ places: nonnegative, placesInGroups: nonnegative, totalVotes: nonnegative, votesInGroups: nonnegative }),
});
export type PlaceGroups = z.infer<typeof placeGroupsSchema>;
export const contextResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import'), dataset: z.null(), item: z.null() }),
  z.object({ status: z.literal('published'), dataset: contextDatasetSchema, item: municipalityContextSchema }),
]);
export type ContextResponse = z.infer<typeof contextResponseSchema>;

/** Sugestões de município enquanto se digita: só municípios publicados no recorte (cargo, UF). */
export const suggestQuerySchema = municipalityQuerySchema.pick({ year: true, office: true, uf: true }).extend({ q: z.string().trim().min(2).max(60) }).strict();
export type SuggestQuery = z.infer<typeof suggestQuerySchema>;
export const SUGGESTION_MATCHES = ['prefix', 'word', 'contains', 'similar'] as const;
export const suggestResponseSchema = z.object({
  // `match`: início do nome, início de uma palavra, trecho do nome ou grafia parecida (similaridade de trigramas).
  items: z.array(z.object({ code: z.string(), name: z.string(), uf: z.enum(STATES), match: z.enum(SUGGESTION_MATCHES) })).max(8),
  status: z.enum(['published', 'awaiting-import']),
});
export type SuggestResponse = z.infer<typeof suggestResponseSchema>;
/** Turno realizado segundo a publicação. Sem `rounds` (versões antigas), não se presume turno único. */
export function roundHeld(dataset: { rounds?: Array<'1' | '2'> | undefined }, round: string) {
  return !dataset.rounds || (dataset.rounds as string[]).includes(round);
}
export function percent(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator * 100;
}
