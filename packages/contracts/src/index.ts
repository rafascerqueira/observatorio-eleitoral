import { z } from 'zod';

/** Formatos dos originais preservados; API e proxy usam a mesma lista. */
export const ORIGINAL_MEDIA_TYPES = { zip: 'application/zip', json: 'application/json', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', gpkg: 'application/geopackage+sqlite3' } as const;
export const originalFileSchema = z.string().regex(/^[a-zA-Z0-9_]+\.(zip|json|xlsx|gpkg)$/);
export function originalMediaType(file: string) { return ORIGINAL_MEDIA_TYPES[file.split('.').at(-1) as keyof typeof ORIGINAL_MEDIA_TYPES]; }

export const publicationInputsSchema = z.array(z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), scope: z.string().min(1) }));

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
/**
 * Sensibilidade da associação local → setor (só renda): raios em metros. Com raio, a faixa do local é a predominante entre os
 * moradores (V06002) dos setores do mesmo município a até essa distância do ponto do TSE; empate não escolhe faixa.
 */
export const TRACT_SENSITIVITY_RADII = ['250', '500', '1000'] as const;
export type TractSensitivityRadius = typeof TRACT_SENSITIVITY_RADII[number];
const agreementCountSchema = z.object({ places: nonnegative, eligible: nonnegative });
/**
 * Comparação, por local associado do território, entre a faixa do setor que contém o ponto (publicada) e a faixa pelo raio:
 * mesma faixa, vizinha, a duas ou mais; empate no raio (sem faixa); só o raio classifica (setor do ponto sem mediana); nenhum.
 */
export const tractAgreementSchema = z.object({ same: agreementCountSchema, adjacent: agreementCountSchema, distant: agreementCountSchema, tie: agreementCountSchema, radiusOnly: agreementCountSchema, none: agreementCountSchema });
export type TractAgreement = z.infer<typeof tractAgreementSchema>;
export const catalogSchema = z.object({
  datasets: z.array(datasetSchema),
  imports: z.array(z.object({ id: z.string(), scope: z.string(), published: z.boolean(), failureReason: z.string().nullable().default(null), coverage: z.array(z.object({ uf: z.enum(TERRITORIES), status: coverageItemSchema.shape.status, municipalities: nonnegative, sectionRows: nonnegative })) })),
  plannedOffices: z.array(z.object({ office: z.string(), label: z.string(), status: z.literal('not-imported') })),
  contextDatasets: z.array(z.lazy(() => contextDatasetSchema)).default([]),
  mapDatasets: z.array(z.lazy(() => mapDatasetSchema)).default([]),
  tractsDatasets: z.array(z.lazy(() => tractsDatasetSchema)).default([]),
  placeProfilesDatasets: z.array(z.lazy(() => placeProfilesDatasetSchema)).default([]),
  placeGroupsImport: z.object({ inputs: publicationInputsSchema.optional(), id: z.string(), importerVersion: z.string(), importedAt: z.string(), recortes: nonnegative, scope: z.string() }).nullable().default(null),
  tractSensitivityImport: z.object({ inputs: publicationInputsSchema.optional(), id: z.string(), importerVersion: z.string(), importedAt: z.string(), recortes: nonnegative, scope: z.string(), method: z.string(), notes: z.array(z.string()), national: z.record(z.enum(TRACT_SENSITIVITY_RADII), tractAgreementSchema) }).nullable().default(null),
  incomeBandsDatasets: z.array(z.lazy(() => incomeBandsDatasetSchema)).default([]),
  tractDemographyDatasets: z.array(z.lazy(() => tractDemographyDatasetSchema)).default([]),
  turnoutProfilesDatasets: z.array(z.lazy(() => turnoutProfilesDatasetSchema)).default([]),
  urbanSurroundingsDatasets: z.array(z.lazy(() => urbanSurroundingsDatasetSchema)).default([]),
  tractGeometriesDatasets: z.array(z.lazy(() => tractGeometriesDatasetSchema)).default([]),
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
}).superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (new Set(data.categories.map((item) => item.key)).size !== data.categories.length) fail('Categorias duplicadas na distribuição.');
  if (data.undistributed !== undefined && data.roundingDifference !== undefined) fail('Diferença não discriminada e arredondamento não podem explicar a mesma distribuição.');
  if (data.roundingDifference !== undefined && data.kind !== 'amostra') fail('Arredondamento só é admitido na amostra.');
  const limit = data.kind === 'amostra' ? Math.ceil((data.categories.length + 1) / 2) : 0;
  const known = data.categories.reduce((sum, item) => sum + (item.value ?? 0), 0);
  if (data.total === null || data.categories.some((item) => item.value === null)) {
    if (data.undistributed !== undefined || data.roundingDifference !== undefined) fail('Células indisponíveis não permitem deduzir a diferença.');
    if (data.total !== null && known > data.total + limit) fail('Contagens divulgadas ultrapassam o total.');
    return;
  }
  if (data.roundingDifference !== undefined) {
    if (known - data.total !== data.roundingDifference || Math.abs(data.roundingDifference) > limit) fail('Diferença de arredondamento inconsistente.');
  } else if (known + (data.undistributed ?? 0) !== data.total) fail('Categorias e diferença declarada não somam o total.');
});
export const TURNOUT_DIMENSIONS = ['gender', 'age', 'education', 'maritalStatus'] as const;
const turnoutCountsSchema = z.object({ eligible: nonnegative, turnout: nonnegative, abstentions: nonnegative });
export const turnoutRoundSchema = turnoutCountsSchema.extend({
  dimensions: z.array(z.object({ dimension: z.enum(TURNOUT_DIMENSIONS), categories: z.array(turnoutCountsSchema.extend({ key: z.string(), label: z.string() })) })),
});
export type TurnoutRound = z.infer<typeof turnoutRoundSchema>;
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
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('municipal-context'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(),
  sources: z.array(sourceSchema), scope: z.string(), validation: z.literal('checked'),
  coverage: z.object({ expected: nonnegative, published: nonnegative, withoutTurnout: z.array(z.enum(TERRITORIES)) }),
  notes: z.array(z.string()),
});
export const mapDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('maps'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(),
});
/**
 * Entorno dos domicílios (Censo 2022, agregados por setor e por município): moradores em domicílios particulares permanentes
 * ocupados dos setores escolhidos para a pesquisa do entorno (V05200, base) por característica da face de quadra, nas variáveis
 * V05201–V05234, nesta ordem (dicionário de 07/05/2025). As categorias de cada característica somam a base; "não declarado"
 * inclui faces em que o item não foi avaliado (sem calçada, para rampa e obstáculo) e "saltado", faces não percorridas.
 */
export const URBAN_CHARACTERISTICS = [
  { key: 'circulation', dictionary: 'CIRCULAÇÃO DA VIA', categories: ['CAMINHÃO, ÔNIBUS', 'CARROS DE PASSEIO OU VAN', 'PEDESTRES, BICICLETAS E MOTOCICLETAS', 'AQUAVIA', 'SALTADO'] },
  { key: 'paving', dictionary: 'VIA PAVIMENTADA', categories: ['SIM', 'NÃO', 'NÃO DECLARADO'] },
  { key: 'drain', dictionary: 'BUEIRO', categories: ['SIM', 'NÃO', 'NÃO DECLARADO'] },
  { key: 'lighting', dictionary: 'ILUMINAÇÃO PÚBLICA', categories: ['SIM', 'NÃO', 'NÃO DECLARADO'] },
  { key: 'bus-stop', dictionary: 'PONTO DE ÔNIBUS', categories: ['SIM', 'NÃO', 'NÃO DECLARADO'] },
  { key: 'bike', dictionary: 'VIA SINALIZADA PARA BICICLETA', categories: ['SIM', 'NÃO', 'NÃO DECLARADO'] },
  { key: 'sidewalk', dictionary: 'CALÇADA', categories: ['SIM', 'NÃO', 'NÃO DECLARADO'] },
  { key: 'obstacle', dictionary: 'OBSTÁCULO NA CALÇADA', categories: ['SIM', 'NÃO', 'NÃO DECLARADO'] },
  { key: 'ramp', dictionary: 'RAMPA PARA CADEIRANTE', categories: ['SIM', 'NÃO', 'NÃO DECLARADO'] },
  { key: 'trees', dictionary: 'ARBORIZAÇÃO', categories: ['SEM ÁRVORES', 'DE 1 A 2 ÁRVORES', 'DE 3 A 4 ÁRVORES', '5 OU MAIS ÁRVORES', 'SALTADO'] },
] as const;
export type UrbanCharacteristic = typeof URBAN_CHARACTERISTICS[number]['key'];
/** 35 contagens: base e, em seguida, as categorias de cada característica na ordem de `URBAN_CHARACTERISTICS`. */
export const URBAN_COUNTS = 1 + URBAN_CHARACTERISTICS.reduce((sum, item) => sum + item.categories.length, 0);
/** Posição (0 = base) de uma categoria no vetor de contagens. */
export function urbanIndex(characteristic: UrbanCharacteristic, category: string) {
  let offset = 1;
  for (const item of URBAN_CHARACTERISTICS) {
    const position = (item.categories as readonly string[]).indexOf(category);
    if (item.key === characteristic) { if (position < 0) throw new Error(`Categoria ${category} fora de ${characteristic}.`); return offset + position; }
    offset += item.categories.length;
  }
  throw new Error(`Característica desconhecida: ${characteristic}.`);
}
/** Características cujas categorias não somam a base (vazio = vetor coerente). */
export function urbanIdentityErrors(counts: readonly number[]) {
  let offset = 1;
  return URBAN_CHARACTERISTICS.flatMap((item) => {
    const sum = counts.slice(offset, offset += item.categories.length).reduce((total, value) => total + value, 0);
    return sum === counts[0] ? [] : [item.key];
  });
}
/** Indicadores do entorno exibidos: moradores em face com o item (categorias somadas) ÷ base; a escolha pode mudar sem reimportar. */
export const URBAN_INDICATORS = {
  'urban-sidewalk': { characteristic: 'sidewalk', categories: ['SIM'], label: 'Moradores em face de quadra com calçada' },
  'urban-ramp': { characteristic: 'ramp', categories: ['SIM'], label: 'Moradores em face de quadra com rampa para cadeirante' },
  'urban-obstacle': { characteristic: 'obstacle', categories: ['SIM'], label: 'Moradores em face de quadra com obstáculo na calçada' },
  'urban-lighting': { characteristic: 'lighting', categories: ['SIM'], label: 'Moradores em face de quadra com iluminação pública' },
  'urban-paving': { characteristic: 'paving', categories: ['SIM'], label: 'Moradores em face de quadra com via pavimentada' },
  'urban-drain': { characteristic: 'drain', categories: ['SIM'], label: 'Moradores em face de quadra com bueiro' },
  'urban-bus-stop': { characteristic: 'bus-stop', categories: ['SIM'], label: 'Moradores em face de quadra com ponto de ônibus' },
  'urban-trees': { characteristic: 'trees', categories: ['DE 1 A 2 ÁRVORES', 'DE 3 A 4 ÁRVORES', '5 OU MAIS ÁRVORES'], label: 'Moradores em face de quadra com ao menos uma árvore' },
} as const satisfies Record<string, { characteristic: UrbanCharacteristic; categories: readonly string[]; label: string }>;
export type UrbanIndicator = keyof typeof URBAN_INDICATORS;
/** Numerador (categorias do indicador) e denominador (base) de um vetor de contagens. */
export function urbanIndicatorCounts(counts: readonly number[], indicator: UrbanIndicator) {
  const definition = URBAN_INDICATORS[indicator];
  return { numerator: definition.categories.reduce((sum, category) => sum + counts[urbanIndex(definition.characteristic, category)]!, 0), denominator: counts[0]! };
}
const urbanCountsSchema = z.array(nonnegative).length(URBAN_COUNTS).refine((counts) => urbanIdentityErrors(counts).length === 0, 'Categorias do entorno não somam a base.');
/** Município (arquivo municipal do IBGE, inclui setores omitidos): setores pesquisados, setores omitidos ("X") e as contagens. */
export const urbanSurroundingsSchema = z.object({ tracts: nonnegative, suppressedTracts: nonnegative, counts: urbanCountsSchema });
export type UrbanSurroundings = z.infer<typeof urbanSurroundingsSchema>;
export const urbanSurroundingsDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('urban-surroundings'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(), notes: z.array(z.string()),
  totals: z.object({ municipalities: nonnegative, tracts: nonnegative, suppressedTracts: nonnegative, residents: nonnegative, associatedTracts: nonnegative, associatedSurveyed: nonnegative, associatedSuppressed: nonnegative }),
});

const URBAN_SOURCE = 'IBGE, Censo 2022 — características urbanísticas do entorno dos domicílios';
/** Indicadores do mapa: cada um com fonte, tipo de dado, numerador e denominador explícitos. */
export const MAP_INDICATORS = {
  'income-upto-half-mw': { label: 'Moradores com rendimento domiciliar per capita de até ½ salário mínimo (inclui sem rendimento)', source: 'IBGE, Censo 2022 — SIDRA 10296', kind: 'amostra', family: 'ibge' },
  'college-18': { label: 'Pessoas de 18 anos ou mais com superior completo', source: 'IBGE, Censo 2022 — SIDRA 10061', kind: 'amostra', family: 'ibge' },
  'literacy-15': { label: 'Pessoas de 15 anos ou mais alfabetizadas', source: 'IBGE, Censo 2022 — SIDRA 9542', kind: 'universo', family: 'ibge' },
  abstention: { label: 'Abstenção (abstenções ÷ eleitores aptos)', source: 'TSE, resultados de 2022 reconciliados, do cargo escolhido', kind: 'resultados', family: 'tse' },
  // Entorno dos domicílios: denominador = moradores dos setores com a pesquisa (V05200); fora dela não é ausência do item.
  'urban-sidewalk': { label: 'Moradores em face de quadra com calçada (setores com pesquisa do entorno)', source: URBAN_SOURCE, kind: 'entorno', family: 'ibge' },
  'urban-ramp': { label: 'Moradores em face de quadra com rampa para cadeirante (setores com pesquisa do entorno)', source: URBAN_SOURCE, kind: 'entorno', family: 'ibge' },
  'urban-obstacle': { label: 'Moradores em face de quadra com obstáculo na calçada (setores com pesquisa do entorno)', source: URBAN_SOURCE, kind: 'entorno', family: 'ibge' },
  'urban-lighting': { label: 'Moradores em face de quadra com iluminação pública (setores com pesquisa do entorno)', source: URBAN_SOURCE, kind: 'entorno', family: 'ibge' },
  'urban-paving': { label: 'Moradores em face de quadra com via pavimentada (setores com pesquisa do entorno)', source: URBAN_SOURCE, kind: 'entorno', family: 'ibge' },
  'urban-drain': { label: 'Moradores em face de quadra com bueiro (setores com pesquisa do entorno)', source: URBAN_SOURCE, kind: 'entorno', family: 'ibge' },
  'urban-bus-stop': { label: 'Moradores em face de quadra com ponto de ônibus (setores com pesquisa do entorno)', source: URBAN_SOURCE, kind: 'entorno', family: 'ibge' },
  'urban-trees': { label: 'Moradores em face de quadra com ao menos uma árvore (setores com pesquisa do entorno)', source: URBAN_SOURCE, kind: 'entorno', family: 'ibge' },
} as const;
export type MapIndicator = keyof typeof MAP_INDICATORS;
export const MAP_INDICATOR_KEYS = Object.keys(MAP_INDICATORS) as [MapIndicator, ...MapIndicator[]];
/** Indicadores do Censo (lado esquerdo de `/mapa`); a abstenção é uma das séries comparadas. */
export const CENSUS_MAP_INDICATORS = MAP_INDICATOR_KEYS.filter((key) => MAP_INDICATORS[key].family === 'ibge') as [MapIndicator, ...MapIndicator[]];
export const mapQuerySchema = z.object({ year: z.enum(['2022', '2026']).default('2022'), round: z.enum(['1', '2']).default('1'), uf: z.enum(STATES).optional(), indicator: z.enum(MAP_INDICATOR_KEYS),
  // Cargo dos resultados na abstenção (cargo estadual exige UF); os indicadores do Censo não dependem de cargo.
  office: z.enum(OFFICES).default('president') }).strict();
/** Publicações lidas numa resposta de mapa: resultados do TSE e contexto municipal (Censo e correspondência TSE–IBGE). */
export const mapPublicationsSchema = z.array(z.object({ role: z.enum(['results', 'context']), id: z.string().regex(/^[a-f0-9]{64}$/) }));
export const mapValuesSchema = z.object({
  status: z.enum(['published', 'awaiting-import', 'round-not-held']), indicator: z.enum(MAP_INDICATOR_KEYS), level: z.enum(['uf', 'municipality']), round: z.enum(['1', '2']),
  // Só na abstenção: cargo dos resultados. Ausente nas respostas anteriores, que eram sempre da Presidência.
  office: z.enum(OFFICES).optional(),
  // `id`: código IBGE (polígono); `code`: UF ou código TSE do município. Valor `null` quando numerador ou denominador faltam.
  items: z.array(z.object({ id: z.string(), code: z.string(), uf: z.enum(STATES), name: z.string(), numerator: sourceCount, denominator: sourceCount, value: z.number().min(0).max(100).nullable() })),
  publications: mapPublicationsSchema.optional(),
});
export type MapValues = z.infer<typeof mapValuesSchema>;
/**
 * Página `/mapa` e sua exportação: indicador do Censo × série comparada — a abstenção do cargo ou o % dos válidos de uma
 * candidatura do recorte, pelo número de urna. A série padrão é a abstenção: o site não escolhe candidatura.
 */
export const mapPageQuerySchema = mapQuerySchema.extend({
  indicator: z.enum(CENSUS_MAP_INDICATORS).default('income-upto-half-mw'),
  series: z.union([z.literal('abstention'), z.string().regex(/^\d{2,5}$/)]).default('abstention'),
}).strict();
export type MapPageQuery = z.infer<typeof mapPageQuerySchema>;
/**
 * Mapa por candidatura: % dos votos válidos de cada candidatura em cada unidade (UF ou município), numa escala fixa igual para
 * todas as candidaturas, cargos e territórios (limite superior incluído). 50% marca a maioria absoluta dos válidos na unidade.
 */
export const CANDIDATE_MAP_CUTS = [10, 20, 35, 50] as const;
export const candidateMapQuerySchema = municipalityQuerySchema.pick({ year: true, round: true, office: true, uf: true }).strict();
export const candidateMapSchema = z.object({
  status: z.enum(['published', 'awaiting-import', 'round-not-held']), office: z.enum(OFFICES), round: z.enum(['1', '2']), level: z.enum(['uf', 'municipality']), uf: z.enum(STATES).nullable(),
  // Ordem por votos no recorte (sem exterior); `votes` de cada unidade segue esta ordem.
  candidates: z.array(z.object({ number: z.string(), name: z.string(), party: z.string(), votes: nonnegative, percentValid: z.number().nullable() })),
  // `id`: código IBGE do polígono; `valid`: votos válidos da unidade (denominador). O exterior não tem polígono e fica fora.
  items: z.array(z.object({ id: z.string(), code: z.string(), uf: z.enum(STATES), name: z.string(), valid: nonnegative, votes: z.array(nonnegative) })),
  publications: mapPublicationsSchema.optional(),
});
export type CandidateMap = z.infer<typeof candidateMapSchema>;
export const mapGeometrySchema = z.object({ status: z.enum(['published', 'awaiting-import']), level: z.enum(['uf', 'municipality']), uf: z.string(), batchId: z.string().nullable(), topology: z.unknown() });
export const TRACT_STATUSES = ['associated', 'no-coordinate', 'conflicting-coordinates', 'relocated', 'outside-tracts', 'other-municipality', 'ambiguous'] as const;
const statusCountSchema = z.object({ places: nonnegative, electors: nonnegative });
export const tractsDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('polling-place-tracts'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema),
  scope: z.string(), method: z.string(), notes: z.array(z.string()),
  coverage: z.array(z.object({ uf: z.enum(STATES), places: nonnegative, electors: nonnegative, sharedCoordinate: nonnegative, byStatus: z.record(z.enum(TRACT_STATUSES), statusCountSchema) })),
});
/**
 * Associação local → setor dos locais de um município (publicação `2022/places/tracts`). Vem do cadastro de locais do 1º turno
 * e vale para todos os cargos (o prédio é o mesmo). Setor e contexto só existem para local associado; nos demais, nada é escolhido.
 */
export const placeTractsQuerySchema = municipalityQuerySchema.pick({ year: true }).extend({ uf: z.enum(STATES) }).strict();
export const placeTractSchema = z.object({
  zone: z.number().int().positive(), code: z.string(), status: z.enum(TRACT_STATUSES),
  // Coordenada do cadastro do TSE, quando única para o local: indica onde fica o prédio, não onde moram os eleitores.
  latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(),
  // Outros locais do município, de nome diferente, na mesma coordenada exata (indício de ponto padrão).
  sharedCoordinate: nonnegative,
  // Setor do Censo 2022 (universo): pessoas residentes (V0001) e mediana do rendimento do responsável com rendimento (V06006),
  // na faixa fixa de `INCOME_BANDS`; `null` quando o IBGE omite o valor. Situação urbana/rural da malha.
  tract: z.object({ code: z.string().regex(/^\d{15}$/), situation: z.string().nullable(), residents: sourceCount, incomeMedian: z.number().nonnegative().nullable(), incomeBand: z.number().int().min(1).max(5).nullable(),
    // Entorno do setor (publicação `2022/context/urban-surroundings`): pesquisado, omitido pelo IBGE ("X") ou fora da pesquisa.
    urban: z.object({ status: z.enum(['surveyed', 'suppressed', 'outside']), counts: urbanCountsSchema.nullable() }).optional() }).nullable(),
}).superRefine((item, ctx) => {
  if ((item.status === 'associated') !== (item.tract !== null)) ctx.addIssue({ code: 'custom', message: 'Setor só existe para local associado.' });
  if (item.tract?.urban && (item.tract.urban.status === 'surveyed') !== (item.tract.urban.counts !== null)) ctx.addIssue({ code: 'custom', message: 'Contagens do entorno só para setor pesquisado.' });
  if (item.tract && item.tract.incomeBand !== (item.tract.incomeMedian === null ? null : incomeBandOf(item.tract.incomeMedian))) ctx.addIssue({ code: 'custom', message: 'Faixa de renda diverge da mediana do setor.' });
});
export type PlaceTract = z.infer<typeof placeTractSchema>;
export const placeTractsSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import'), batchId: z.null(), summary: z.null(), items: z.array(z.never()).length(0) }),
  // `summary`: locais e eleitores (cadastro de locais) do município em cada situação; soma = todos os locais da lista.
  // `urbanBatchId`: publicação do entorno juntada aos setores; `null` sem publicação do entorno (setores sem `urban`).
  z.object({ status: z.literal('published'), batchId: z.string(), summary: z.record(z.enum(TRACT_STATUSES), statusCountSchema), items: z.array(placeTractSchema), urbanBatchId: z.string().nullable().optional() })
    .refine((data) => Object.values(data.summary).reduce((sum, item) => sum + item.places, 0) === data.items.length, 'Resumo da associação não soma os locais.'),
]);
export type PlaceTracts = z.infer<typeof placeTractsSchema>;
/** Malha de setores com a geometria exata (`2022/geo/tracts`): validade registrada sem reparo e conferência com a associação publicada. */
export const tractGeometriesDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('tract-geometries'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(), notes: z.array(z.string()),
  totals: z.object({ rows: nonnegative, tracts: nonnegative, multipart: nonnegative, invalid: nonnegative, comparedPlaces: nonnegative, equalPlaces: nonnegative }),
});
export const placeProfilesDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('place-profiles'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(),
  // Ordem das categorias de cada dimensão nos vetores de contagem guardados por local.
  order: z.record(z.enum(TURNOUT_DIMENSIONS), z.array(z.string())),
  totals: z.object({ places: nonnegative, eligible: nonnegative, contextEligible: nonnegative, resultPlaces: nonnegative, resultPlacesWithoutProfile: nonnegative }), notes: z.array(z.string()),
});
/** Métrica E: locais agrupados pelo perfil do eleitorado (TSE) ou pelo entorno (IBGE); resultados somados por grupo. */
export const PLACE_GROUP_INDICATORS = {
  // `short`: o que o percentual conta, para as definições dos grupos ("locais com X% a Y% de …").
  college: { label: 'Eleitores aptos do local com superior completo (escolaridade declarada no alistamento)', short: 'eleitores com superior completo', source: 'TSE, perfil do eleitorado por seção 2022, somado por local', kind: 'cadastro', unit: 'percent' },
  'education-low': { label: 'Eleitores aptos do local com até o fundamental incompleto (analfabeto, lê e escreve ou fundamental incompleto; escolaridade declarada)', short: 'eleitores com até o fundamental incompleto', source: 'TSE, perfil do eleitorado por seção 2022, somado por local', kind: 'cadastro', unit: 'percent' },
  women: { label: 'Eleitoras entre os eleitores aptos do local (gênero do cadastro eleitoral)', short: 'eleitoras (gênero feminino no cadastro)', source: 'TSE, perfil do eleitorado por seção 2022, somado por local', kind: 'cadastro', unit: 'percent' },
  'age-16-24': { label: 'Eleitores aptos do local com 16 a 24 anos', short: 'eleitores de 16 a 24 anos', source: 'TSE, perfil do eleitorado por seção 2022, somado por local', kind: 'cadastro', unit: 'percent' },
  'age-60-plus': { label: 'Eleitores aptos do local com 60 anos ou mais', short: 'eleitores de 60 anos ou mais', source: 'TSE, perfil do eleitorado por seção 2022, somado por local', kind: 'cadastro', unit: 'percent' },
  'income-median': { label: 'Rendimento mediano do responsável pelo domicílio no setor censitário do local', short: 'renda mediana do responsável no setor', source: 'IBGE, Censo 2022 — agregados por setor (rendimento do responsável); local → setor pelo ponto do TSE', kind: 'universo', unit: 'reais' },
} as const;
/** Categorias do perfil por local somadas no numerador de cada indicador percentual (chaves de `tseOrder`). */
export const PLACE_GROUP_NUMERATORS: Record<Exclude<PlaceGroupIndicator, 'income-median'>, { dimension: 'gender' | 'age' | 'education'; keys: readonly string[] }> = {
  college: { dimension: 'education', keys: ['college-complete'] },
  'education-low': { dimension: 'education', keys: ['illiterate', 'reads-writes', 'fundamental-incomplete'] },
  women: { dimension: 'gender', keys: ['female'] },
  'age-16-24': { dimension: 'age', keys: ['a16', 'a17', 'a18', 'a19', 'a20', 'a21-24'] },
  'age-60-plus': { dimension: 'age', keys: ['a60-64', 'a65-69', 'a70-74', 'a75-79', 'a80-84', 'a85-89', 'a90-94', 'a95-99', 'a100+'] },
};
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
/** Faixa fixa (1–5) de uma mediana em reais; limite superior incluído (mesma regra do SQL de `place-groups`). */
export function incomeBandOf(median: number): number {
  return INCOME_BANDS.find((band) => band.upper !== null && median <= band.upper * MINIMUM_WAGE_2022)?.index ?? INCOME_BANDS.length;
}
/**
 * Moradores em domicílios particulares permanentes ocupados (V06002, universo do Censo 2022) somados pelos setores de cada
 * faixa fixa de renda (`INCOME_BANDS`, mediana V06006 do responsável com rendimento no setor). Descreve setores, não pessoas:
 * um morador de setor "até 1 SM" pode ter qualquer renda. `total` = soma das faixas + `noData` = V06002 do município no arquivo
 * municipal do IBGE (conferido). `noData`: setores sem mediana por não se aplicar ("."); `undisclosed`: setores com dados omitidos
 * pelo IBGE ("X"), cujos moradores não são divulgados nem entram no total.
 */
export const incomeBandPopulationSchema = z.object({
  total: nonnegative,
  bands: z.array(z.object({ index: z.number().int().min(1).max(5), residents: nonnegative, tracts: nonnegative })).length(5),
  noData: z.object({ residents: nonnegative, tracts: nonnegative }),
  undisclosed: z.object({ tracts: nonnegative }),
  // Só na demografia por setor: moradores (V01006) dos setores usados no indicador e de todos os setores divulgados — o IBGE
  // omite células isoladas ("X"), e o setor com célula omitida no indicador fica fora, sem estimativa.
  coverage: z.object({ residents: nonnegative, total: nonnegative }).optional(),
});
export type IncomeBandPopulation = z.infer<typeof incomeBandPopulationSchema>;
/** Por município: para cada indicador de demografia, moradores de 15+ por faixa do setor (mesmo formato das faixas de renda). */
export const tractDemographySchema = z.object({ residents: nonnegative, indicators: z.object({ women: incomeBandPopulationSchema, 'age-16-24': incomeBandPopulationSchema, 'age-60-plus': incomeBandPopulationSchema }) });
export const tractDemographyDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('tract-demography'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema),
  scope: z.string(), notes: z.array(z.string()), totals: z.object({ municipalities: nonnegative, tracts: nonnegative, residents: nonnegative, undisclosedTracts: nonnegative }),
});
export const incomeBandsDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('income-bands'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema),
  scope: z.string(), notes: z.array(z.string()), totals: z.object({ municipalities: nonnegative, tracts: nonnegative }).and(incomeBandPopulationSchema),
});
export type IncomeBandsDataset = z.infer<typeof incomeBandsDatasetSchema>;
/** Como os grupos foram formados: quintis ponderados por eleitores aptos (v2–v3) ou faixas fixas (v4: todos). Ausente (v1): quintis. */
export const PLACE_GROUP_METHODS = { college: 'bands', 'education-low': 'bands', women: 'bands', 'age-16-24': 'bands', 'age-60-plus': 'bands', 'income-median': 'bands' } as const;
/**
 * Limites superiores (incluídos) das faixas fixas de cada indicador, na unidade dele (% dos eleitores aptos do local ou reais);
 * a última faixa é aberta. Iguais em todos os recortes (decisão de Rafael, 17/10/2026: números redondos perto da distribuição
 * nacional). Renda: `INCOME_BANDS` em salários mínimos de 2022.
 */
export const PLACE_GROUP_CUTS: Record<PlaceGroupIndicator, readonly number[]> = {
  college: [5, 10, 20, 30], 'education-low': [20, 30, 40, 50], women: [50, 52, 54, 56], 'age-16-24': [10, 12.5, 15, 20], 'age-60-plus': [15, 20, 25, 30],
  'income-median': INCOME_BANDS.flatMap((band) => band.upper === null ? [] : [band.upper * MINIMUM_WAGE_2022]),
};
/** Faixa fixa (1–5) de um percentual `numerator`/`denominator` (contagens inteiras), mesma regra do SQL: superior incluído, sem arredondar. */
export function placeGroupBandOf(indicator: PlaceGroupIndicator, numerator: number, denominator: number) {
  const cuts = PLACE_GROUP_CUTS[indicator];
  const index = cuts.findIndex((cut) => numerator * 100 <= cut * denominator);
  return index < 0 ? cuts.length + 1 : index + 1;
}
/**
 * Equivalente do Censo 2022 por setor (agregados de demografia, universo) para indicadores de perfil: o setor entra na faixa
 * pela parcela calculada entre os seus moradores de 15 anos ou mais (o agregado por setor agrupa 15 a 19 anos). Não é o eleitorado.
 */
export const TRACT_DEMOGRAPHY_INDICATORS = {
  women: { definition: 'mulheres entre os moradores de 15 anos ou mais', numerator: ['V01023', 'V01024', 'V01025', 'V01026', 'V01027', 'V01028', 'V01029', 'V01030'] },
  'age-16-24': { definition: 'moradores de 15 a 24 anos entre os de 15 anos ou mais', numerator: ['V01034', 'V01035'] },
  'age-60-plus': { definition: 'moradores de 60 anos ou mais entre os de 15 anos ou mais', numerator: ['V01040', 'V01041'] },
} as const satisfies Partial<Record<PlaceGroupIndicator, { definition: string; numerator: readonly string[] }>>;
export type TractDemographyIndicator = keyof typeof TRACT_DEMOGRAPHY_INDICATORS;
/** Moradores de 15 anos ou mais (denominador dos indicadores de demografia por setor). */
export const TRACT_DEMOGRAPHY_BASE = ['V01034', 'V01035', 'V01036', 'V01037', 'V01038', 'V01039', 'V01040', 'V01041'] as const;
/** Limites da faixa `index` (1–5) de um indicador: inferior excluído, superior incluído; null quando aberto. */
export function placeGroupLimits(indicator: PlaceGroupIndicator, index: number) {
  const cuts = PLACE_GROUP_CUTS[indicator];
  return { lower: index === 1 ? null : cuts[index - 2]!, upper: index > cuts.length ? null : cuts[index - 1]! };
}
export const placeGroupsQuerySchema = municipalityQuerySchema.pick({ year: true, round: true, office: true, uf: true }).extend({ indicator: z.enum(Object.keys(PLACE_GROUP_INDICATORS) as [PlaceGroupIndicator, ...PlaceGroupIndicator[]]), radius: z.enum(TRACT_SENSITIVITY_RADII).optional() }).strict();
export const placeGroupsSchema = z.object({
  status: z.enum(['published', 'awaiting-import', 'round-not-held']), indicator: z.enum(Object.keys(PLACE_GROUP_INDICATORS) as [PlaceGroupIndicator, ...PlaceGroupIndicator[]]),
  office: z.enum(OFFICES), round: z.enum(['1', '2']), uf: z.enum(STATES).nullable(),
  method: z.enum(['quintiles', 'bands']).optional(),
  // `from`/`to`: menor e maior valor observado no grupo (null na sensibilidade por raio, em que o local tem só a faixa). `lower`/`upper` (só faixas): limites da faixa em reais, null quando aberta.
  groups: z.array(z.object({ index: z.number().int().min(1).max(5), from: z.number().nullable(), to: z.number().nullable(), lower: z.number().nullable().optional(), upper: z.number().nullable().optional(),
    places: nonnegative, eligible: nonnegative, valid: nonnegative, blank: nonnegative, null: nonnegative, totalVotes: nonnegative, candidates: z.array(candidateSchema) })),
  // Votos de locais sem o indicador ficam fora dos grupos e são informados aqui (nunca redistribuídos).
  coverage: z.object({ places: nonnegative, placesInGroups: nonnegative, totalVotes: nonnegative, votesInGroups: nonnegative }),
  // Só faixas de renda: moradores do território (Brasil ou UF) nos setores de cada faixa, de todos os setores, com ou sem local de votação.
  population: incomeBandPopulationSchema.nullable().optional(),
  // Só na sensibilidade da associação (renda com raio): o raio usado e a concordância com a associação publicada no território.
  association: z.object({ radius: z.enum(TRACT_SENSITIVITY_RADII), agreement: tractAgreementSchema }).optional(),
});
export type PlaceGroups = z.infer<typeof placeGroupsSchema>;
/**
 * Faixas etárias agregadas (decisão de Rafael, 17/10/2026): separam quem vota de forma facultativa (16–17 e 70+) dos obrigados.
 * `bands`: chaves das faixas do TSE (`tseOrder('age')`) somadas em cada grupo; idade inválida e não informada ficam como na fonte.
 */
export const AGE_GROUPS = [
  { key: '16-17', label: '16 e 17 anos', bands: ['a16', 'a17'], optional: true },
  { key: '18-24', label: '18 a 24 anos', bands: ['a18', 'a19', 'a20', 'a21-24'], optional: false },
  { key: '25-34', label: '25 a 34 anos', bands: ['a25-29', 'a30-34'], optional: false },
  { key: '35-44', label: '35 a 44 anos', bands: ['a35-39', 'a40-44'], optional: false },
  { key: '45-59', label: '45 a 59 anos', bands: ['a45-49', 'a50-54', 'a55-59'], optional: false },
  { key: '60-69', label: '60 a 69 anos', bands: ['a60-64', 'a65-69'], optional: false },
  { key: '70+', label: '70 anos ou mais', bands: ['a70-74', 'a75-79', 'a80-84', 'a85-89', 'a90-94', 'a95-99', 'a100+'], optional: true },
  { key: 'invalid', label: 'Idade inválida (fonte)', bands: ['invalid'], optional: false },
  { key: 'not-informed', label: 'Não informada', bands: ['not-informed'], optional: false },
] as const;
export type AgeGroup = typeof AGE_GROUPS[number]['key'];
export function ageGroupOf(band: string): AgeGroup {
  const group = AGE_GROUPS.find((item) => (item.bands as readonly string[]).includes(band));
  if (!group) throw new Error(`Faixa etária sem grupo: ${band}.`);
  return group.key;
}
/** Voto facultativo pela Constituição (art. 14): 16 e 17 anos, 70 anos ou mais e analfabetos. Conferido contra a divisão da fonte. */
export function optionalVoter(ageBand: string, education: string) {
  return education === 'illiterate' || AGE_GROUPS.some((group) => group.optional && (group.bands as readonly string[]).includes(ageBand));
}
/** Rótulos das categorias do TSE usadas nos cruzamentos, na ordem da fonte (iguais a `tseOrder` do importador; teste confere). */
export const TSE_PROFILE_LABELS = {
  gender: [{ key: 'female', label: 'Feminino' }, { key: 'male', label: 'Masculino' }, { key: 'not-informed', label: 'Não informado na fonte' }],
  education: [{ key: 'illiterate', label: 'Analfabeto' }, { key: 'reads-writes', label: 'Lê e escreve' }, { key: 'fundamental-incomplete', label: 'Ensino fundamental incompleto' },
    { key: 'fundamental-complete', label: 'Ensino fundamental completo' }, { key: 'high-school-incomplete', label: 'Ensino médio incompleto' }, { key: 'high-school-complete', label: 'Ensino médio completo' },
    { key: 'college-incomplete', label: 'Superior incompleto' }, { key: 'college-complete', label: 'Superior completo' }, { key: 'not-informed', label: 'Não informado na fonte' }],
  maritalStatus: [{ key: 'single', label: 'Solteiro(a)' }, { key: 'married', label: 'Casado(a)' }, { key: 'separated', label: 'Separado(a) judicialmente' }, { key: 'divorced', label: 'Divorciado(a)' },
    { key: 'widowed', label: 'Viúvo(a)' }, { key: 'not-informed', label: 'Não informado na fonte' }],
} as const;
/**
 * Comparecimento por perfil do TSE (base própria, declarada), cruzado por gênero × faixa etária × escolaridade × estado civil
 * (v2), por UF ou município e turno. `obligation` deriva da idade e da escolaridade.
 */
export const TURNOUT_CROSS_DIMENSIONS = ['gender', 'age', 'education', 'maritalStatus', 'obligation'] as const;
/** Ordem das categorias nos vetores de células da v2 (índices guardados no banco; a API confere com a publicação). */
export const TURNOUT_CELL_ORDER = { gender: TSE_PROFILE_LABELS.gender.map((item) => item.key), age: AGE_GROUPS.map((item) => item.key), education: TSE_PROFILE_LABELS.education.map((item) => item.key), maritalStatus: TSE_PROFILE_LABELS.maritalStatus.map((item) => item.key) };
export type TurnoutCrossDimension = typeof TURNOUT_CROSS_DIMENSIONS[number];
export const turnoutProfilesQuerySchema = municipalityQuerySchema.pick({ year: true, round: true, uf: true }).extend({
  // Código TSE do município (cinco dígitos); exige a UF.
  municipality: z.string().regex(/^\d{5}$/).optional(),
  rows: z.enum(TURNOUT_CROSS_DIMENSIONS).default('age'), cols: z.enum(TURNOUT_CROSS_DIMENSIONS).default('gender'),
}).strict();
export type TurnoutProfilesQuery = z.infer<typeof turnoutProfilesQuerySchema>;
const categoryLabelSchema = z.object({ key: z.string(), label: z.string() });
export const turnoutProfilesSchema = z.object({
  status: z.enum(['published', 'awaiting-import', 'not-in-source']), round: z.enum(['1', '2']), uf: z.enum(STATES).nullable(),
  // UFs somadas (Brasil = UFs da fonte) e UFs que a fonte não traz (DF em 2022).
  ufs: z.array(z.enum(STATES)), missingUfs: z.array(z.enum(STATES)),
  // Município consultado (código TSE) e, com UF, a lista dos municípios da UF na publicação.
  municipality: z.object({ code: z.string(), name: z.string() }).nullable().optional(), municipalities: z.array(z.object({ code: z.string(), name: z.string() })).optional(),
  // `maritalStatus` só a partir da v2; ausente na v1 (não é "não informado").
  categories: z.object({ gender: z.array(categoryLabelSchema), age: z.array(categoryLabelSchema), education: z.array(categoryLabelSchema), maritalStatus: z.array(categoryLabelSchema).optional() }),
  // Célula = gênero × grupo etário × escolaridade (× estado civil na v2); `optional`: voto facultativo (idade ou analfabetismo).
  cells: z.array(z.object({ gender: z.string(), age: z.string(), education: z.string(), maritalStatus: z.string().optional(), optional: z.boolean(), eligible: nonnegative, turnout: nonnegative, abstentions: nonnegative })),
  // Aptos nos resultados publicados (Presidência) das mesmas UFs: a diferença para o cadastro por perfil é exibida, não ajustada.
  resultsEligible: nonnegative.nullable(),
});
export type TurnoutProfiles = z.infer<typeof turnoutProfilesSchema>;
export const turnoutProfilesDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('turnout-profiles'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema),
  scope: z.string(), notes: z.array(z.string()), missingUfs: z.array(z.enum(STATES)),
  totals: z.array(z.object({ round: z.enum(['1', '2']), eligible: nonnegative, turnout: nonnegative, abstentions: nonnegative, resultsEligible: nonnegative })),
  // v2: células em vetores int4 (`turnout_profile_cells`), uma linha por UF e por município, nesta ordem de categorias.
  cellFormat: z.literal('int4-groups-v2').optional(), order: z.object({ gender: z.array(z.string()), age: z.array(z.string()), education: z.array(z.string()), maritalStatus: z.array(z.string()) }).optional(),
  municipalities: nonnegative.optional(),
});
export type TurnoutProfilesDataset = z.infer<typeof turnoutProfilesDatasetSchema>;
export const contextResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import'), dataset: z.null(), item: z.null() }),
  z.object({ status: z.literal('published'), dataset: contextDatasetSchema, item: municipalityContextSchema, incomeBands: incomeBandPopulationSchema.nullable().optional(), urbanSurroundings: urbanSurroundingsSchema.nullable().optional() }),
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
