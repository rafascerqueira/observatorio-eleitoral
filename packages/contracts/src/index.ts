import { z } from 'zod';

/** Formatos dos originais preservados; API e proxy usam a mesma lista. */
export const ORIGINAL_MEDIA_TYPES = { zip: 'application/zip', json: 'application/json', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', gpkg: 'application/geopackage+sqlite3' } as const;
export const originalFileSchema = z.string().regex(/^[a-zA-Z0-9_]+\.(zip|json|xlsx|gpkg)$/);
export function originalMediaType(file: string) { return ORIGINAL_MEDIA_TYPES[file.split('.').at(-1) as keyof typeof ORIGINAL_MEDIA_TYPES]; }

export const publicationInputsSchema = z.array(z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), scope: z.string().min(1) }));

export const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;
export const REGIONS = ['N', 'NE', 'CO', 'SE', 'S'] as const;
export type Region = typeof REGIONS[number];
export const REGION_LABELS: Record<Region, string> = { N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul' };
export const REGION_STATES: Record<Region, readonly typeof STATES[number][]> = {
  N: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'], NE: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  CO: ['DF', 'GO', 'MT', 'MS'], SE: ['ES', 'MG', 'RJ', 'SP'], S: ['PR', 'RS', 'SC'],
};
export const TERRITORIES = [...STATES, 'ZZ'] as const;
export const OFFICES = ['president', 'governor', 'senator'] as const;
export type Office = typeof OFFICES[number];
export const OFFICE_LABELS: Record<Office, string> = { president: 'Presidência', governor: 'Governador', senator: 'Senador' };
/** Cargos estaduais: candidaturas diferem por UF; resultados não são comparáveis entre UFs nem somados ao Brasil. */
export const STATE_OFFICES: readonly Office[] = ['governor', 'senator'];
/** Cargos eleitos por maioria simples em turno único: não existe 2º turno, nem a ser importado. */
export const SINGLE_ROUND_OFFICES: readonly Office[] = ['senator'];
/** Eleições gerais publicadas ou previstas. Cada ano tem publicações próprias (`<ano>/<cargo>/<território>`). */
export const ELECTION_YEARS = ['2022', '2026'] as const;
export type ElectionYear = typeof ELECTION_YEARS[number];
/**
 * Vagas por cargo e eleição: o Senado renova um terço (uma vaga por UF, 2022) ou dois terços (duas vagas, 2026). Com duas vagas,
 * cada eleitor vota duas vezes: os votos somam o dobro do comparecimento, e o percentual de cada candidatura é sobre os votos
 * válidos, não sobre eleitores. Os eleitos são as candidaturas mais votadas, tantas quantas as vagas.
 */
export function officeSeats(year: string | number, office: Office): 1 | 2 { return office === 'senator' && String(year) === '2026' ? 2 : 1; }
export const isStateOffice = (office: Office) => STATE_OFFICES.includes(office);
const integerParameter = (minimum: number, maximum: number, fallback: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(minimum).max(maximum)).default(fallback);
/**
 * Caracteres de controle (fora espaços, tabulações e quebras de linha) não existem nos nomes nem nos textos publicados, e o NUL
 * nem pode ser enviado ao PostgreSQL: a busca com eles é recusada como inválida, em vez de falhar como banco indisponível.
 */
export const hasControlCharacters = (value: string) => /(?!\s)\p{Cc}/u.test(value);
const CONTROL_CHARACTERS_MESSAGE = 'A busca não aceita caracteres de controle.';
const searchInput = (maximum: number) => z.string().trim().max(maximum).refine((value) => !hasControlCharacters(value), CONTROL_CHARACTERS_MESSAGE);

export const municipalityQuerySchema = z.object({
  year: z.enum(ELECTION_YEARS).default('2022'),
  round: z.enum(['1', '2']).default('1'),
  office: z.enum(OFFICES).default('president'),
  uf: z.enum(STATES).optional(),
  search: searchInput(100).optional(),
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
  id: z.string(), year: z.union([z.literal(2022), z.literal(2026)]), office: z.enum(OFFICES), municipalityCode: z.string().optional(),
  municipalityName: z.string().optional(), uf: z.enum(TERRITORIES).optional(), importedAt: z.string(), importerVersion: z.string(),
  sources: z.array(sourceSchema), scope: z.string(), validation: z.literal('reconciled'),
  level: z.enum(['municipality', 'national', 'exterior', 'state']).default('municipality'),
  // Ausente nas versões antigas (Presidência, dois turnos): não significa turno único.
  rounds: z.array(z.enum(['1', '2'])).min(1).optional(),
  coverage: z.object({ expected: nonnegative, reconciled: nonnegative, blocked: nonnegative, excluded: nonnegative }).optional(),
  // Vagas do cargo na eleição (votos por eleitor). Ausente nas versões de 2022: lido por `officeSeats`, nunca como zero.
  seats: z.union([z.literal(1), z.literal(2)]).optional(),
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
  // `placeGroupsImport`: a de 2022, como nas respostas anteriores; `placeGroupsImports`: uma por ano publicado.
  placeGroupsImport: z.object({ inputs: publicationInputsSchema.optional(), id: z.string(), importerVersion: z.string(), importedAt: z.string(), recortes: nonnegative, scope: z.string() }).nullable().default(null),
  placeGroupsImports: z.array(z.object({ inputs: publicationInputsSchema.optional(), id: z.string(), importerVersion: z.string(), importedAt: z.string(), recortes: nonnegative, scope: z.string() })).default([]),
  tractSensitivityImport: z.object({ inputs: publicationInputsSchema.optional(), id: z.string(), importerVersion: z.string(), importedAt: z.string(), recortes: nonnegative, scope: z.string(), method: z.string(), notes: z.array(z.string()), national: z.record(z.enum(TRACT_SENSITIVITY_RADII), tractAgreementSchema) }).nullable().default(null),
  incomeBandsDatasets: z.array(z.lazy(() => incomeBandsDatasetSchema)).default([]),
  tractDemographyDatasets: z.array(z.lazy(() => tractDemographyDatasetSchema)).default([]),
  turnoutProfilesDatasets: z.array(z.lazy(() => turnoutProfilesDatasetSchema)).default([]),
  urbanSurroundingsDatasets: z.array(z.lazy(() => urbanSurroundingsDatasetSchema)).default([]),
  censusIndicatorsDatasets: z.array(z.lazy(() => censusIndicatorsDatasetSchema)).default([]),
  tractGeometriesDatasets: z.array(z.lazy(() => tractGeometriesDatasetSchema)).default([]),
  tractDisplayDatasets: z.array(z.lazy(() => tractDisplayDatasetSchema)).default([]),
  proposalsDatasets: z.array(z.lazy(() => proposalsDatasetSchema)).default([]),
});
const filtersSchema = z.object({ year: z.enum(ELECTION_YEARS), round: z.enum(['1', '2']), office: z.enum(OFFICES), uf: z.enum(STATES).optional(), search: z.string().optional(), sort: z.enum(['municipality', 'uf']), direction: z.enum(['asc', 'desc']) });
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
  // Recortes da fonte somados ou subtraídos para formar esta distribuição (ex.: 15+ = total − 0–4 − 5–9 − 10–14 → 4). Cada recorte
  // da amostra traz o próprio arredondamento, então o limite cresce com eles. Ausente (versões anteriores) = 1.
  slices: z.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (new Set(data.categories.map((item) => item.key)).size !== data.categories.length) fail('Categorias duplicadas na distribuição.');
  if (data.undistributed !== undefined && data.roundingDifference !== undefined) fail('Diferença não discriminada e arredondamento não podem explicar a mesma distribuição.');
  if (data.roundingDifference !== undefined && data.kind !== 'amostra') fail('Arredondamento só é admitido na amostra.');
  const limit = data.kind === 'amostra' ? Math.ceil((data.categories.length + 1) / 2) * (data.slices ?? 1) : 0;
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
/**
 * Só o território (Censo 2022, IBGE): o contexto sem o cadastro, os aptos dos resultados e o comparecimento por perfil do TSE,
 * que na publicação são de 2022. Usado no detalhe municipal de outras eleições, para não misturar comparadores de anos diferentes.
 */
export const territorialContextSchema = municipalityContextSchema.omit({ electorate: true, resultsEligible: true, turnout: true });
export type TerritorialContext = z.infer<typeof territorialContextSchema>;
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

/**
 * Indicadores do Censo 2022 pela idade de voto (`census-indicators-2022-v1`; docs/plano-indicadores-censo-2022.md). Cada tema
 * guarda uma distribuição por recorte de idade, sempre com a base da própria tabela (amostra com denominador da amostra).
 * `15+` só onde a fonte agrupa 15–19 anos; o desvio máximo em relação a 16+ é `age15.age15 ÷ age15.age15plus` (em p.p. × 100).
 * `all`: a tabela não tem idade (tempo de residência de quem mora há menos de 10 anos no município).
 */
export const CENSUS_THEMES = {
  race: ['16+', '15+', '16-17', '18-69', '70+'], religion: ['15+', '70+'], education: ['18+', '18-69', '70+'], literacy: ['16+', '16-17', '18-64', '65+'],
  labor: ['14+', '18-69', '70+'], laborForce: ['14+', '18-69', '70+'], socialSecurity: ['14+'], activity: ['14+'], position: ['14+'], workIncome: ['14+'],
  internet: ['15+', '70+'], tenure: ['15+', '70+'], crowding: ['15+', '70+'], water: ['15+'], sewage: ['15+'], bathroom: ['15+'], garbage: ['15+'],
  urbanRural: ['15+', '70+'], residenceTime: ['all'],
} as const satisfies Record<string, readonly string[]>;
export type CensusTheme = keyof typeof CENSUS_THEMES;
export const CENSUS_THEME_KEYS = Object.keys(CENSUS_THEMES) as [CensusTheme, ...CensusTheme[]];
/** Parcela com numerador e denominador da fonte (contagens `null` = indisponíveis, nunca zero presumido). */
export const censusShareSchema = z.object({ kind: z.enum(['universo', 'amostra']), source: z.string(), numerator: sourceCount, denominator: sourceCount })
  .refine((data) => data.numerator === null || data.denominator === null || data.numerator <= data.denominator, 'Numerador acima do denominador.');
export type CensusShare = z.infer<typeof censusShareSchema>;
/**
 * Favelas e comunidades urbanas: `present` (na SIDRA 9884/9883), `not-delimited` (ausente das tabelas e sem setor de favela nos
 * agregados por setor; zero conferido) ou `divergent` (fontes em desacordo, declarado no importador; sem valor).
 */
export const FAVELA_STATUSES = ['present', 'not-delimited', 'divergent'] as const;
const favelaSchema = z.object({ status: z.enum(FAVELA_STATUSES), favelas: sourceCount, '15+': censusShareSchema.nullable(), note: z.string().optional() }).superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (data.status === 'present' && (!data.favelas || !data['15+'])) fail('Município com favela sem contagem ou parcela.');
  if (data.status === 'not-delimited' && (data.favelas !== 0 || data['15+']?.numerator !== 0)) fail('Sem favela delimitada exige zero conferido.');
  if (data.status === 'divergent' && (data.favelas !== null || data['15+'] !== null || !data.note)) fail('Divergência sem valor e com nota.');
});
export const censusIndicatorsSchema = z.object({
  ibgeCode: z.string().regex(/^\d{7}$/), code: z.string(), uf: z.enum(STATES), name: z.string(),
  // Pessoas de 15 anos e de 15+ (SIDRA 9606, universo): o desvio declarado dos recortes `15+`.
  age15: z.object({ age15: sourceCount, age15plus: sourceCount }),
  distributions: z.record(z.enum(CENSUS_THEME_KEYS), z.record(z.string(), contextDistributionSchema)),
  disability: z.object({ '15+': censusShareSchema, '70+': censusShareSchema, types: z.array(censusShareSchema.and(z.object({ key: z.string(), label: z.string() }))) }),
  migration: z.object({ '15+': censusShareSchema, '70+': censusShareSchema }),
  favela: favelaSchema,
}).superRefine((data, ctx) => {
  for (const theme of CENSUS_THEME_KEYS) {
    const slices = Object.keys(data.distributions[theme] ?? {}).sort();
    if (slices.join() !== [...CENSUS_THEMES[theme]].sort().join()) ctx.addIssue({ code: 'custom', message: `Recortes de ${theme} divergentes: ${slices.join(', ')}.` });
  }
});
export type CensusIndicators = z.infer<typeof censusIndicatorsSchema>;
const censusUfCheckSchema = z.object({ table: z.number().int(), kind: z.enum(['universo', 'amostra']), cells: nonnegative, exact: nonnegative, maxAbsDifference: nonnegative });
export const censusIndicatorsDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('census-indicators'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema),
  scope: z.string(), notes: z.array(z.string()),
  totals: z.object({ municipalities: nonnegative, queries: nonnegative, favela: z.record(z.enum(FAVELA_STATUSES), nonnegative) }),
  // Soma dos municípios × valor da UF publicado pelo IBGE, por tabela: exata no universo; na amostra, diferença de arredondamento.
  ufChecks: z.array(censusUfCheckSchema),
});
export type CensusIndicatorsDataset = z.infer<typeof censusIndicatorsDatasetSchema>;

/**
 * Indicador do Censo lido de `census_indicators` (publicação `census-indicators-2022-v1`): numerador = soma das categorias `keys`
 * do recorte (ou o total de `numeratorSlice`), denominador = total do recorte. Parcelas (`disability`, `migration`, `favela`)
 * têm a chave `numerator`. Recorte `15+` traz o desvio declarado (pessoas de 15 anos ÷ 15+).
 */
export type CensusMapSpec = { theme: string; slice: string; keys?: readonly string[]; numeratorSlice?: string };
/**
 * Recortes 15+: a proporção de pessoas de 15 anos entre as de 15+ (SIDRA 9606, população residente, universo) só é limite
 * demonstrado da diferença entre as parcelas 15+ e 16+ quando a base do indicador é essa mesma população: cor ou raça (9606),
 * situação do domicílio (10089, 15+ igual ao da 9606 nos 5.570 municípios) e favelas (denominador da 9606). Nas tabelas da amostra
 * e nas de moradores em domicílios particulares permanentes ocupados, a composição etária pode ser outra: a proporção fica só como
 * referência, sem limite próprio, e nada é estimado (revisão de 31/10/2026).
 */
export const AGE15_SAME_BASE_THEMES = ['race', 'urbanRural', 'favela'] as const;
export const age15Basis = (theme: string): 'bound' | 'reference' => (AGE15_SAME_BASE_THEMES as readonly string[]).includes(theme) ? 'bound' : 'reference';
type MapIndicatorDefinition = { label: string; short: string; source: string; kind: 'universo' | 'amostra' | 'resultados'; family: 'ibge' | 'tse'; group: string; census?: CensusMapSpec };
const sidraSource = (tables: string) => `IBGE, Censo 2022 — SIDRA ${tables}`;
/** Indicadores do mapa: cada um com fonte, tipo de dado, numerador, denominador e grupo do seletor explícitos. */
export const MAP_INDICATORS = {
  'race-white-16': { label: 'Pessoas de 16 anos ou mais de cor ou raça branca', short: 'Cor ou raça branca (16+)', source: sidraSource('9606'), kind: 'universo', family: 'ibge', group: 'Cor ou raça', census: { theme: 'race', slice: '16+', keys: ['branca'] } },
  'race-black-16': { label: 'Pessoas de 16 anos ou mais de cor ou raça preta', short: 'Cor ou raça preta (16+)', source: sidraSource('9606'), kind: 'universo', family: 'ibge', group: 'Cor ou raça', census: { theme: 'race', slice: '16+', keys: ['preta'] } },
  'race-brown-16': { label: 'Pessoas de 16 anos ou mais de cor ou raça parda', short: 'Cor ou raça parda (16+)', source: sidraSource('9606'), kind: 'universo', family: 'ibge', group: 'Cor ou raça', census: { theme: 'race', slice: '16+', keys: ['parda'] } },
  'race-asian-16': { label: 'Pessoas de 16 anos ou mais de cor ou raça amarela', short: 'Cor ou raça amarela (16+)', source: sidraSource('9606'), kind: 'universo', family: 'ibge', group: 'Cor ou raça', census: { theme: 'race', slice: '16+', keys: ['amarela'] } },
  'race-indigenous-16': { label: 'Pessoas de 16 anos ou mais de cor ou raça indígena', short: 'Cor ou raça indígena (16+)', source: sidraSource('9606'), kind: 'universo', family: 'ibge', group: 'Cor ou raça', census: { theme: 'race', slice: '16+', keys: ['indigena'] } },
  'religion-catholic-15': { label: 'Pessoas de 15 anos ou mais católicas (Católica Apostólica Romana)', short: 'Católicas (15+)', source: sidraSource('9537'), kind: 'amostra', family: 'ibge', group: 'Religião', census: { theme: 'religion', slice: '15+', keys: ['catolica-apostolica-romana'] } },
  'religion-evangelical-15': { label: 'Pessoas de 15 anos ou mais evangélicas', short: 'Evangélicas (15+)', source: sidraSource('9537'), kind: 'amostra', family: 'ibge', group: 'Religião', census: { theme: 'religion', slice: '15+', keys: ['evangelicas'] } },
  'religion-none-15': { label: 'Pessoas de 15 anos ou mais sem religião', short: 'Sem religião (15+)', source: sidraSource('9537'), kind: 'amostra', family: 'ibge', group: 'Religião', census: { theme: 'religion', slice: '15+', keys: ['sem-religiao'] } },
  'age-16-17': { label: 'Pessoas de 16 e 17 anos entre as de 16 anos ou mais (voto facultativo)', short: '16 e 17 anos (÷ 16+)', source: sidraSource('9606'), kind: 'universo', family: 'ibge', group: 'Idade', census: { theme: 'race', slice: '16+', numeratorSlice: '16-17' } },
  'age-70-plus': { label: 'Pessoas de 70 anos ou mais entre as de 16 anos ou mais (voto facultativo)', short: '70 anos ou mais (÷ 16+)', source: sidraSource('9606'), kind: 'universo', family: 'ibge', group: 'Idade', census: { theme: 'race', slice: '16+', numeratorSlice: '70+' } },
  'college-18': { label: 'Pessoas de 18 anos ou mais com superior completo', short: 'Superior completo (18+)', source: sidraSource('10061'), kind: 'amostra', family: 'ibge', group: 'Escolaridade e alfabetização', census: { theme: 'education', slice: '18+', keys: ['superior-completo'] } },
  'education-low-18': { label: 'Pessoas de 18 anos ou mais sem instrução ou com fundamental incompleto', short: 'Sem instrução ou fundamental incompleto (18+)', source: sidraSource('10061'), kind: 'amostra', family: 'ibge', group: 'Escolaridade e alfabetização', census: { theme: 'education', slice: '18+', keys: ['sem-instrucao-e-fundamental-incompleto'] } },
  'illiterate-16': { label: 'Pessoas de 16 anos ou mais não alfabetizadas', short: 'Não alfabetizadas (16+)', source: sidraSource('9542'), kind: 'universo', family: 'ibge', group: 'Escolaridade e alfabetização', census: { theme: 'literacy', slice: '16+', keys: ['nao-alfabetizadas'] } },
  'income-upto-half-mw': { label: 'Moradores com rendimento domiciliar per capita de até ½ salário mínimo (inclui sem rendimento)', short: 'Até ½ salário mínimo per capita', source: sidraSource('10296'), kind: 'amostra', family: 'ibge', group: 'Renda' },
  'unemployment-18-69': { label: 'Desocupação de 18 a 69 anos (desocupados ÷ força de trabalho)', short: 'Desocupação (18–69)', source: sidraSource('10299'), kind: 'amostra', family: 'ibge', group: 'Trabalho', census: { theme: 'laborForce', slice: '18-69', keys: ['forca-de-trabalho-desocupada'] } },
  'non-contributors-14': { label: 'Ocupados de 14 anos ou mais que não contribuem para a previdência oficial', short: 'Ocupados sem contribuição à previdência (14+)', source: sidraSource('10264'), kind: 'amostra', family: 'ibge', group: 'Trabalho', census: { theme: 'socialSecurity', slice: '14+', keys: ['nao-contribuintes'] } },
  'agriculture-14': { label: 'Ocupados de 14 anos ou mais na agropecuária, produção florestal, pesca e aquicultura', short: 'Ocupados na agropecuária (14+)', source: sidraSource('10262'), kind: 'amostra', family: 'ibge', group: 'Trabalho', census: { theme: 'activity', slice: '14+', keys: ['agricultura-pecuaria-producao-florestal-pesca-e-aquicultura'] } },
  'public-sector-14': { label: 'Ocupados de 14 anos ou mais empregados no setor público (como na fonte: sem militares e sem empresas estatais)', short: 'Empregados no setor público (14+)', source: sidraSource('10261'), kind: 'amostra', family: 'ibge', group: 'Trabalho', census: { theme: 'position', slice: '14+', keys: ['empregado-no-setor-publico'] } },
  'internet-15': { label: 'Moradores de 15 anos ou mais em domicílio com conexão à internet', short: 'Domicílio com internet (15+)', source: sidraSource('9942'), kind: 'amostra', family: 'ibge', group: 'Internet e moradia', census: { theme: 'internet', slice: '15+', keys: ['sim'] } },
  'rented-15': { label: 'Moradores de 15 anos ou mais em domicílio alugado', short: 'Domicílio alugado (15+)', source: sidraSource('9938'), kind: 'amostra', family: 'ibge', group: 'Internet e moradia', census: { theme: 'tenure', slice: '15+', keys: ['alugado'] } },
  'crowding-15': { label: 'Moradores de 15 anos ou mais em domicílio com mais de 3 moradores por dormitório', short: 'Mais de 3 por dormitório (15+)', source: sidraSource('9940'), kind: 'amostra', family: 'ibge', group: 'Internet e moradia', census: { theme: 'crowding', slice: '15+', keys: ['mais-de-3-moradores'] } },
  'water-network-15': { label: 'Moradores de 15 anos ou mais em domicílio ligado à rede geral de água, usada como forma principal', short: 'Rede geral de água (15+)', source: sidraSource('6894'), kind: 'universo', family: 'ibge', group: 'Saneamento', census: { theme: 'water', slice: '15+', keys: ['possui-ligacao-a-rede-geral-e-a-utiliza-como-forma-principal'] } },
  'sewage-network-15': { label: 'Moradores de 15 anos ou mais em domicílio com esgoto pela rede geral, pluvial ou fossa ligada à rede', short: 'Esgoto pela rede (15+)', source: sidraSource('7555'), kind: 'universo', family: 'ibge', group: 'Saneamento', census: { theme: 'sewage', slice: '15+', keys: ['rede-geral-rede-pluvial-ou-fossa-ligada-a-rede'] } },
  'garbage-collected-15': { label: 'Moradores de 15 anos ou mais em domicílio com lixo coletado', short: 'Lixo coletado (15+)', source: sidraSource('9541'), kind: 'universo', family: 'ibge', group: 'Saneamento', census: { theme: 'garbage', slice: '15+', keys: ['coletado'] } },
  'urban-15': { label: 'Pessoas de 15 anos ou mais em situação urbana', short: 'Situação urbana (15+)', source: sidraSource('10089'), kind: 'universo', family: 'ibge', group: 'Território', census: { theme: 'urbanRural', slice: '15+', keys: ['urbana'] } },
  'favela-15': { label: 'Pessoas de 15 anos ou mais em favelas e comunidades urbanas', short: 'Em favelas e comunidades urbanas (15+)', source: sidraSource('9884 ÷ 9606'), kind: 'universo', family: 'ibge', group: 'Território', census: { theme: 'favela', slice: '15+', keys: ['numerator'] } },
  'disability-15': { label: 'Pessoas de 15 anos ou mais com deficiência', short: 'Com deficiência (15+)', source: sidraSource('10125'), kind: 'amostra', family: 'ibge', group: 'Deficiência', census: { theme: 'disability', slice: '15+', keys: ['numerator'] } },
  'disability-70': { label: 'Pessoas de 70 anos ou mais com deficiência', short: 'Com deficiência (70+)', source: sidraSource('10125'), kind: 'amostra', family: 'ibge', group: 'Deficiência', census: { theme: 'disability', slice: '70+', keys: ['numerator'] } },
  'migrants-15': { label: 'Pessoas de 15 anos ou mais que não moravam no município 5 anos antes', short: 'Não moravam no município 5 anos antes (15+)', source: sidraSource('10160 ÷ 9537'), kind: 'amostra', family: 'ibge', group: 'Migração', census: { theme: 'migration', slice: '15+', keys: ['numerator'] } },
  abstention: { label: 'Abstenção (abstenções ÷ eleitores aptos)', short: 'Abstenção', source: 'TSE, resultados reconciliados, do cargo escolhido', kind: 'resultados', family: 'tse', group: 'Eleições' },
} as const satisfies Record<string, MapIndicatorDefinition>;
export type MapIndicator = keyof typeof MAP_INDICATORS;
export const MAP_INDICATOR_KEYS = Object.keys(MAP_INDICATORS) as [MapIndicator, ...MapIndicator[]];
/** Indicadores do Censo (lado esquerdo de `/mapa`); a abstenção é uma das séries comparadas. */
export const CENSUS_MAP_INDICATORS = MAP_INDICATOR_KEYS.filter((key) => MAP_INDICATORS[key].family === 'ibge') as [MapIndicator, ...MapIndicator[]];
export const mapQuerySchema = z.object({ year: z.enum(ELECTION_YEARS).default('2022'), round: z.enum(['1', '2']).default('1'), uf: z.enum(STATES).optional(), indicator: z.enum(MAP_INDICATOR_KEYS),
  // Cargo dos resultados na abstenção (cargo estadual exige UF); os indicadores do Censo não dependem de cargo.
  office: z.enum(OFFICES).default('president') }).strict();
/** Publicações lidas numa resposta de mapa: resultados do TSE e contexto municipal (Censo e correspondência TSE–IBGE). */
export const mapPublicationsSchema = z.array(z.object({ role: z.enum(['results', 'context']), id: z.string().regex(/^[a-f0-9]{64}$/) }));
export const mapValuesSchema = z.object({
  status: z.enum(['published', 'awaiting-import', 'round-not-held']), indicator: z.enum(MAP_INDICATOR_KEYS), level: z.enum(['uf', 'municipality']), round: z.enum(['1', '2']),
  // Só na abstenção: cargo dos resultados. Ausente nas respostas anteriores, que eram sempre da Presidência.
  office: z.enum(OFFICES).optional(),
  // `id`: código IBGE (polígono); `null` para município sem correspondência no Censo 2022 (criado depois), que fica só na tabela.
  // `code`: UF ou código TSE do município. Valor `null` quando numerador ou denominador faltam.
  items: z.array(z.object({ id: z.string().nullable(), code: z.string(), uf: z.enum(STATES), name: z.string(), numerator: sourceCount, denominator: sourceCount, value: z.number().min(0).max(100).nullable(),
    // Só nos recortes 15+: pessoas de 15 anos ÷ 15+ × 100 da população residente (9606). Limite do desvio em relação a 16+ só quando
    // `age15Basis(tema)` é `bound`; nas outras bases, referência (ver `AGE15_SAME_BASE_THEMES`). Ausente nos demais.
    deviation: z.number().min(0).max(100).nullable().optional() })),
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
  // `id`: código IBGE do polígono (`null`: município criado depois do Censo 2022, só na tabela); `valid`: votos válidos da unidade
  // (denominador). O exterior não tem polígono e fica fora.
  items: z.array(z.object({ id: z.string().nullable(), code: z.string(), uf: z.enum(STATES), name: z.string(), valid: nonnegative, votes: z.array(nonnegative) })),
  publications: mapPublicationsSchema.optional(),
});
export type CandidateMap = z.infer<typeof candidateMapSchema>;
export const mapGeometrySchema = z.object({ status: z.enum(['published', 'awaiting-import']), level: z.enum(['uf', 'municipality']), uf: z.string(), batchId: z.string().nullable(), topology: z.unknown() });
export const TRACT_STATUSES = ['associated', 'no-coordinate', 'conflicting-coordinates', 'relocated', 'outside-tracts', 'other-municipality', 'ambiguous'] as const;
const statusCountSchema = z.object({ places: nonnegative, electors: nonnegative });
export const tractsDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('polling-place-tracts'), year: z.union([z.literal(2022), z.literal(2026)]), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema),
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
/**
 * Desenho dos setores (fase B3, `2022/geo/tract-display`): largura do SVG, altura máxima, margem e limite do desenho comprimido de
 * uma vista. Vistas acima do limite são divididas em distritos ou subdistritos.
 */
export const TRACT_DISPLAY = { width: 600, maxHeight: 560, margin: 8, gzipLimit: 250 * 1024 } as const;
export const tractDisplayDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('tract-display'), year: z.literal(2022), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(), notes: z.array(z.string()),
  config: z.object({ width: nonnegative, maxHeight: nonnegative, margin: nonnegative, gzipLimit: nonnegative, tolerancePx: z.number().positive(), precision: nonnegative }),
  totals: z.object({ municipalities: nonnegative, tracts: nonnegative, excludedTracts: nonnegative, views: nonnegative, servedViews: nonnegative, splitViews: nonnegative, districtViews: nonnegative, subdistrictViews: nonnegative,
    exactTracts: nonnegative, invalidAfterSimplify: nonnegative, oversizeServed: nonnegative }),
});
/**
 * Mapa local → setor de um município (fase B3). `view`: município (código IBGE, 7 dígitos), distrito (9) ou subdistrito (11);
 * sem `view`, a do município. `paths=1` inclui os caminhos SVG (só a imagem do mapa os usa; a página traz legenda e locais).
 */
export const tractMapQuerySchema = placeTractsQuerySchema.extend({ view: z.string().regex(/^\d{7}(\d{2}){0,2}$/).optional(), paths: z.enum(['0', '1']).default('0') }).strict();
export const TRACT_MAP_LEVELS = ['municipality', 'district', 'subdistrict'] as const;
/** Situação do setor no arquivo de renda: faixa da mediana, mediana que não se aplica, setor omitido ("X") ou sem linha no arquivo. */
export const TRACT_INCOME_STATUSES = ['band', 'no-data', 'undisclosed', 'missing'] as const;
const tractMapViewSchema = z.object({ id: z.string().regex(/^\d{7}(\d{2}){0,2}$/), level: z.enum(TRACT_MAP_LEVELS), name: z.string().nullable(), tracts: nonnegative, split: z.boolean(), oversize: z.boolean() });
// Faixas 1–5 de `INCOME_BANDS` (declaradas adiante; o mesmo limite de `placeTractSchema`).
const bandIndex = z.number().int().min(1).max(5);
export const tractMapSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import') }),
  z.object({
    status: z.literal('published'), displayBatchId: z.string(), incomeBatchId: z.string(), associationBatchId: z.string(),
    // Todas as vistas do município (a do município primeiro); `view`: a pedida. Vista dividida não tem desenho, legenda nem locais.
    views: z.array(tractMapViewSchema).min(1), view: tractMapViewSchema.extend({ width: nonnegative, height: nonnegative }),
    // Setores da vista por faixa de renda mediana do responsável (moradores em domicílios particulares permanentes ocupados).
    legend: z.object({ bands: z.array(z.object({ index: bandIndex, tracts: nonnegative, residents: nonnegative })).length(5),
      noData: z.object({ tracts: nonnegative, residents: nonnegative }), undisclosed: z.object({ tracts: nonnegative }), missing: z.object({ tracts: nonnegative }) }).nullable(),
    tracts: z.array(z.object({ code: z.string().regex(/^\d{15}$/), status: z.enum(TRACT_INCOME_STATUSES), band: bandIndex.nullable(), simplified: z.boolean(), path: z.string() })).optional(),
    // Locais da vista: associados a um setor dela ou, sem setor, com coordenada dentro do quadro. `x`/`y` na escala do SVG.
    places: z.array(z.object({ zone: z.number().int().positive(), code: z.string(), name: z.string().nullable(), status: z.enum(TRACT_STATUSES), tract: z.string().regex(/^\d{15}$/).nullable(),
      band: bandIndex.nullable(), electors: nonnegative, x: z.number().nullable(), y: z.number().nullable() })),
  }).superRefine((data, ctx) => {
    if (data.view.split && (data.legend !== null || data.places.length || data.tracts?.length)) ctx.addIssue({ code: 'custom', message: 'Vista dividida não tem desenho nem locais.' });
    if (!data.view.split && data.legend === null) ctx.addIssue({ code: 'custom', message: 'Vista servida sem legenda.' });
    if (data.tracts && data.legend && data.tracts.length !== data.view.tracts) ctx.addIssue({ code: 'custom', message: 'Setores da vista incompletos.' });
    if (data.tracts?.some((tract) => (tract.status === 'band') !== (tract.band !== null))) ctx.addIssue({ code: 'custom', message: 'Faixa só para setor com mediana.' });
  }),
]);
export type TractMap = z.infer<typeof tractMapSchema>;
export const placeProfilesDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('place-profiles'), year: z.union([z.literal(2022), z.literal(2026)]), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(),
  // Ordem das categorias de cada dimensão nos vetores de contagem guardados por local.
  order: z.record(z.enum(TURNOUT_DIMENSIONS), z.array(z.string())),
  totals: z.object({ places: nonnegative, eligible: nonnegative, contextEligible: nonnegative, resultPlaces: nonnegative, resultPlacesWithoutProfile: nonnegative }), notes: z.array(z.string()),
});
/** Métrica E: locais agrupados pelo perfil do eleitorado (TSE) ou pelo entorno (IBGE); resultados somados por grupo. */
export const PLACE_GROUP_INDICATORS = {
  // `short`: o que o percentual conta, para as definições dos grupos ("locais com X% a Y% de …").
  college: { label: 'Eleitores aptos do local com superior completo (escolaridade declarada no alistamento)', short: 'eleitores com superior completo', source: 'TSE, perfil do eleitorado por seção do ano da eleição, somado por local', kind: 'cadastro', unit: 'percent' },
  'education-low': { label: 'Eleitores aptos do local com até o fundamental incompleto (analfabeto, lê e escreve ou fundamental incompleto; escolaridade declarada)', short: 'eleitores com até o fundamental incompleto', source: 'TSE, perfil do eleitorado por seção do ano da eleição, somado por local', kind: 'cadastro', unit: 'percent' },
  women: { label: 'Eleitoras entre os eleitores aptos do local (gênero do cadastro eleitoral)', short: 'eleitoras (gênero feminino no cadastro)', source: 'TSE, perfil do eleitorado por seção do ano da eleição, somado por local', kind: 'cadastro', unit: 'percent' },
  'age-16-24': { label: 'Eleitores aptos do local com 16 a 24 anos', short: 'eleitores de 16 a 24 anos', source: 'TSE, perfil do eleitorado por seção do ano da eleição, somado por local', kind: 'cadastro', unit: 'percent' },
  'age-60-plus': { label: 'Eleitores aptos do local com 60 anos ou mais (pessoa idosa)', short: 'eleitores de 60 anos ou mais', source: 'TSE, perfil do eleitorado por seção do ano da eleição, somado por local', kind: 'cadastro', unit: 'percent' },
  // 70+: voto facultativo por idade (decisão de Rafael, 31/10/2026: acrescentar, mantendo 60+).
  'age-70-plus': { label: 'Eleitores aptos do local com 70 anos ou mais (voto facultativo)', short: 'eleitores de 70 anos ou mais', source: 'TSE, perfil do eleitorado por seção do ano da eleição, somado por local', kind: 'cadastro', unit: 'percent' },
  'income-median': { label: 'Rendimento mediano do responsável pelo domicílio no setor censitário do local', short: 'renda mediana do responsável no setor', source: 'IBGE, Censo 2022 — agregados por setor (rendimento do responsável); local → setor pelo ponto do TSE', kind: 'universo', unit: 'reais' },
  // Grupos por categoria do setor que contém o local (decisão de Rafael, 31/10/2026); o local não indica onde os eleitores moram.
  'tract-situation': { label: 'Situação do setor censitário do local (urbana ou rural)', short: 'situação do setor', source: 'IBGE, Censo 2022 — situação do setor (associação local → setor); local → setor pelo ponto do TSE', kind: 'universo', unit: 'category' },
  'tract-favela': { label: 'Setor censitário do local em favela ou comunidade urbana', short: 'setor em favela ou comunidade urbana', source: 'IBGE, Censo 2022 — agregados por setor (favelas e comunidades urbanas); local → setor pelo ponto do TSE', kind: 'universo', unit: 'category' },
} as const;
/** Grupos dos indicadores por categoria do setor: índice, nome e definição de cada um, na ordem da tabela. */
export const PLACE_GROUP_CATEGORIES = {
  'tract-situation': [{ index: 1, name: 'Setor urbano', definition: 'Locais em setor censitário de situação urbana' }, { index: 2, name: 'Setor rural', definition: 'Locais em setor censitário de situação rural' }],
  'tract-favela': [{ index: 1, name: 'Setor de favela ou comunidade urbana', definition: 'Locais em setor censitário de favela ou comunidade urbana delimitada pelo IBGE' }, { index: 2, name: 'Outros setores', definition: 'Locais em setor censitário fora de favelas e comunidades urbanas' }],
} as const;
export type PlaceGroupCategoryIndicator = keyof typeof PLACE_GROUP_CATEGORIES;
/** Categorias do perfil por local somadas no numerador de cada indicador percentual (chaves de `tseOrder`). */
export const PLACE_GROUP_NUMERATORS: Record<Exclude<PlaceGroupIndicator, 'income-median' | PlaceGroupCategoryIndicator>, { dimension: 'gender' | 'age' | 'education'; keys: readonly string[] }> = {
  college: { dimension: 'education', keys: ['college-complete'] },
  'education-low': { dimension: 'education', keys: ['illiterate', 'reads-writes', 'fundamental-incomplete'] },
  women: { dimension: 'gender', keys: ['female'] },
  'age-16-24': { dimension: 'age', keys: ['a16', 'a17', 'a18', 'a19', 'a20', 'a21-24'] },
  'age-60-plus': { dimension: 'age', keys: ['a60-64', 'a65-69', 'a70-74', 'a75-79', 'a80-84', 'a85-89', 'a90-94', 'a95-99', 'a100+'] },
  'age-70-plus': { dimension: 'age', keys: ['a70-74', 'a75-79', 'a80-84', 'a85-89', 'a90-94', 'a95-99', 'a100+'] },
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
// `age-70-plus` desde a v3 (31/10/2026); ausente na v2, lido como indisponível (nunca zero).
export const tractDemographySchema = z.object({ residents: nonnegative, indicators: z.object({ women: incomeBandPopulationSchema, 'age-16-24': incomeBandPopulationSchema, 'age-60-plus': incomeBandPopulationSchema, 'age-70-plus': incomeBandPopulationSchema.optional() }) });
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
export const PLACE_GROUP_METHODS = { college: 'bands', 'education-low': 'bands', women: 'bands', 'age-16-24': 'bands', 'age-60-plus': 'bands', 'age-70-plus': 'bands', 'income-median': 'bands', 'tract-situation': 'categories', 'tract-favela': 'categories' } as const;
/**
 * Limites superiores (incluídos) das faixas fixas de cada indicador, na unidade dele (% dos eleitores aptos do local ou reais);
 * a última faixa é aberta. Iguais em todos os recortes (decisão de Rafael, 17/10/2026: números redondos perto da distribuição
 * nacional). Renda: `INCOME_BANDS` em salários mínimos de 2022.
 */
export const PLACE_GROUP_CUTS: Record<PlaceGroupIndicator, readonly number[]> = {
  college: [5, 10, 20, 30], 'education-low': [20, 30, 40, 50], women: [50, 52, 54, 56], 'age-16-24': [10, 12.5, 15, 20], 'age-60-plus': [15, 20, 25, 30],
  // 70+ (31/10/2026): números redondos perto da distribuição nacional (eleitores em locais por faixa: 20,5 / 21,1 / 18,7 / 24,8 / 14,9%).
  'age-70-plus': [5, 7.5, 10, 15],
  // Categorias não têm cortes: o grupo é a categoria do setor.
  'tract-situation': [], 'tract-favela': [],
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
  'age-70-plus': { definition: 'moradores de 70 anos ou mais entre os de 15 anos ou mais', numerator: ['V01041'] },
} as const satisfies Partial<Record<PlaceGroupIndicator, { definition: string; numerator: readonly string[] }>>;
export type TractDemographyIndicator = keyof typeof TRACT_DEMOGRAPHY_INDICATORS;
/** Moradores de 15 anos ou mais (denominador dos indicadores de demografia por setor). */
export const TRACT_DEMOGRAPHY_BASE = ['V01034', 'V01035', 'V01036', 'V01037', 'V01038', 'V01039', 'V01040', 'V01041'] as const;
/** Limites da faixa `index` (1–5) de um indicador: inferior excluído, superior incluído; null quando aberto. */
export function placeGroupLimits(indicator: PlaceGroupIndicator, index: number) {
  const cuts = PLACE_GROUP_CUTS[indicator];
  return { lower: index === 1 ? null : cuts[index - 2]!, upper: index > cuts.length ? null : cuts[index - 1]! };
}
export const placeGroupsQuerySchema = municipalityQuerySchema.pick({ year: true, round: true, office: true, uf: true }).extend({ indicator: z.enum(Object.keys(PLACE_GROUP_INDICATORS) as [PlaceGroupIndicator, ...PlaceGroupIndicator[]]), radius: z.enum(TRACT_SENSITIVITY_RADII).optional(), region: z.enum(REGIONS).optional() }).strict().superRefine(({ region, uf }, context) => {
  if (region && uf && !REGION_STATES[region].includes(uf)) context.addIssue({ code: 'custom', path: ['uf'], message: 'Escolha uma UF da região selecionada ou remova o filtro de UF.' });
});
export const placeGroupsSchema = z.object({
  status: z.enum(['published', 'awaiting-import', 'round-not-held']), indicator: z.enum(Object.keys(PLACE_GROUP_INDICATORS) as [PlaceGroupIndicator, ...PlaceGroupIndicator[]]),
  office: z.enum(OFFICES), round: z.enum(['1', '2']), uf: z.enum(STATES).nullable(),
  // Filtro de região opcional; publicações anteriores continuam legíveis sem ele.
  region: z.enum(REGIONS).optional(),
  // `categories` (v6): o grupo é a categoria do setor do local (situação urbana/rural, favela), sem valores nem limites.
  method: z.enum(['quintiles', 'bands', 'categories']).optional(),
  // `from`/`to`: menor e maior valor observado no grupo (null na sensibilidade por raio, em que o local tem só a faixa). `lower`/`upper` (só faixas): limites da faixa em reais, null quando aberta.
  groups: z.array(z.object({ index: z.number().int().min(1).max(5), from: z.number().nullable(), to: z.number().nullable(), lower: z.number().nullable().optional(), upper: z.number().nullable().optional(),
    places: nonnegative, eligible: nonnegative, valid: nonnegative, blank: nonnegative, null: nonnegative, totalVotes: nonnegative, candidates: z.array(candidateSchema) })),
  // Votos de locais sem o indicador ficam fora dos grupos e são informados aqui (nunca redistribuídos).
  coverage: z.object({ places: nonnegative, placesInGroups: nonnegative, totalVotes: nonnegative, votesInGroups: nonnegative }),
  // Só faixas de renda: moradores do território (Brasil ou UF) nos setores de cada faixa, de todos os setores, com ou sem local de votação.
  population: incomeBandPopulationSchema.nullable().optional(),
  // Só na sensibilidade da associação (renda com raio): o raio usado e a concordância com a associação publicada no território.
  association: z.object({ radius: z.enum(TRACT_SENSITIVITY_RADII), agreement: tractAgreementSchema }).optional(),
  // Publicações consultadas: resultados do cargo e grupos (métrica E) ou sensibilidade por raio. Ausente nas respostas anteriores.
  publications: z.array(z.object({ role: z.enum(['results', 'groups', 'sensitivity']), id: z.string().regex(/^[a-f0-9]{64}$/) })).optional(),
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
  // `round-not-in-source`: a fonte do ano não traz o turno (2026: só o 1º turno no arquivo gerado em 13/10/2026).
  status: z.enum(['published', 'awaiting-import', 'not-in-source', 'round-not-in-source']), round: z.enum(['1', '2']), uf: z.enum(STATES).nullable(),
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
  id: z.string(), kind: z.literal('turnout-profiles'), year: z.union([z.literal(2022), z.literal(2026)]), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema),
  scope: z.string(), notes: z.array(z.string()), missingUfs: z.array(z.enum(STATES)),
  // Turnos presentes na fonte (2026: só o 1º). Ausente nas versões de 2022, que têm os dois.
  rounds: z.array(z.enum(['1', '2'])).min(1).optional(),
  totals: z.array(z.object({ round: z.enum(['1', '2']), eligible: nonnegative, turnout: nonnegative, abstentions: nonnegative, resultsEligible: nonnegative })),
  // v2: células em vetores int4 (`turnout_profile_cells`), uma linha por UF e por município, nesta ordem de categorias.
  cellFormat: z.literal('int4-groups-v2').optional(), order: z.object({ gender: z.array(z.string()), age: z.array(z.string()), education: z.array(z.string()), maritalStatus: z.array(z.string()) }).optional(),
  municipalities: nonnegative.optional(),
});
export type TurnoutProfilesDataset = z.infer<typeof turnoutProfilesDatasetSchema>;
export const contextResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import'), dataset: z.null(), item: z.null() }),
  z.object({ status: z.literal('published'), dataset: contextDatasetSchema, item: municipalityContextSchema, incomeBands: incomeBandPopulationSchema.nullable().optional(),
    // Entorno dos domicílios: fora da interface desde 31/10/2026 (decisão de Rafael); a API não o envia mais. Mantido para respostas anteriores.
    urbanSurroundings: urbanSurroundingsSchema.nullable().optional(),
    // Indicadores do Censo pela idade de voto; `null` sem a publicação, ausente nas respostas anteriores.
    censusIndicators: censusIndicatorsSchema.nullable().optional(), censusIndicatorsId: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional() }),
  // Eleição de outro ano (2026): o Censo 2022 vale como referência territorial; os perfis do TSE de 2022 não são enviados.
  z.object({ status: z.literal('territorial'), electionYear: z.enum(ELECTION_YEARS), censusYear: z.literal(2022), dataset: contextDatasetSchema, item: territorialContextSchema,
    incomeBands: incomeBandPopulationSchema.nullable(), censusIndicators: censusIndicatorsSchema.nullable(), censusIndicatorsId: z.string().regex(/^[a-f0-9]{64}$/).nullable() }),
  // Município da eleição sem correspondência no Censo 2022 (criado depois dele): ausência declarada, não falha nem zero.
  z.object({ status: z.literal('not-in-census'), electionYear: z.enum(ELECTION_YEARS), censusYear: z.literal(2022), dataset: contextDatasetSchema, item: z.null() }),
]);
export type ContextResponse = z.infer<typeof contextResponseSchema>;

/** Sugestões de município enquanto se digita: só municípios publicados no recorte (cargo, UF). */
export const suggestQuerySchema = municipalityQuerySchema.pick({ year: true, office: true, uf: true }).extend({ q: searchInput(60).min(2) }).strict();
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

/** Versão da normalização da busca nas propostas: vai no `method` da publicação, e a API só busca numa publicação desta versão. */
export const PROPOSALS_NORMALIZATION = 'proposals-search-v2';
/** Marcador do hífen de fim de linha no texto normalizado: hífen que pode ou não pertencer à palavra (casa com nada ou com "-"). */
export const SEARCH_HYPHEN_MARKER = '­';
const SEARCH_REPLACEMENTS: Record<string, string> = {
  'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st', '‐': '-', '‑': '-',
  '‘': "'", '’': "'", '‛': "'", 'ʼ': "'", '“': '"', '”': '"', '„': '"', '‟': '"',
};
const SEARCH_INVISIBLE = /[­​-‍⁠﻿]/;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
/**
 * Se o hífen de fim de linha entre `before` e `after` é reunido: com uma quebra, entre letras ou dígitos; depois de linha em branco
 * (fim de fluxo no texto do PDF, de bloco no OCR), só entre letras, porque o que segue um hífen no fim da página costuma ser o
 * número dela (auditoria de 20/10/2026).
 */
export const joinsAtLineEnd = (before: string, gap: string, after: string) =>
  (gap.match(/\n/g) ?? []).length > 1 ? /\p{L}/u.test(before) && /\p{L}/u.test(after) : LETTER_OR_DIGIT.test(before) && LETTER_OR_DIGIT.test(after);

/**
 * Normalização da busca literal nas propostas (`proposals-search-v2`; importador e API usam a mesma): minúsculas sem acentos,
 * espaços colapsados, ligaduras em letras, invisíveis removidos sem virar espaço, hífens e aspas Unicode nos equivalentes ASCII
 * e hífen de fim de linha (`joinsAtLineEnd`) guardado como `SEARCH_HYPHEN_MARKER`, em vez de descartado. Sem NFKD: "nº" e "²"
 * ficam como estão. `map[i]` é a posição, no texto original, do caractere `i` normalizado, para recortar os trechos do original.
 */
export function searchNormalize(text: string): { normalized: string; map: number[] } {
  const out: string[] = [], map: number[] = [];
  const lineBreakHyphen = /[-­‐‑][ \t]*(\r?\n\s*)/y, space = /\s+/y;
  for (let index = 0; index < text.length;) {
    lineBreakHyphen.lastIndex = index;
    const join = index > 0 ? lineBreakHyphen.exec(text) : null;
    if (join && joinsAtLineEnd(text[index - 1]!, join[1]!, text[lineBreakHyphen.lastIndex] ?? '')) { out.push(SEARCH_HYPHEN_MARKER); map.push(index); index = lineBreakHyphen.lastIndex; continue; }
    if (SEARCH_INVISIBLE.test(text[index]!)) { index++; continue; }
    space.lastIndex = index;
    if (space.test(text)) { if (out.length && out[out.length - 1] !== ' ') { out.push(' '); map.push(index); } index = space.lastIndex; continue; }
    for (const char of (SEARCH_REPLACEMENTS[text[index]!] ?? text[index]!).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()) { out.push(char); map.push(index); }
    index++;
  }
  if (out[out.length - 1] === ' ') { out.pop(); map.pop(); }
  return { normalized: out.join(''), map };
}
export const searchText = (text: string) => searchNormalize(text).normalized;
/**
 * Expressão da busca literal, a mesma no PostgreSQL (`~`) e no JavaScript: o termo normalizado com o marcador opcional entre
 * caracteres e o "-" do termo casando "-" ou o marcador. Caracteres especiais escapados; marcador no próprio termo ignorado.
 */
export const searchPattern = (term: string) => [...term.replaceAll(SEARCH_HYPHEN_MARKER, '')]
  .map((char) => char === '-' ? `[-${SEARCH_HYPHEN_MARKER}]` : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(`${SEARCH_HYPHEN_MARKER}?`);

/** Propostas de governo (fase D2, `2022/proposals/president`): documentos do TSE, texto por página e método de extração. */
export const PROPOSAL_METHODS = ['native', 'ocr', 'empty'] as const;
/** `candidate`: candidatura com votos; `no-votes`: inapta e sem votos (listada à parte); `same-document`: documento idêntico ao de outra candidatura, exibido só nela. */
export const PROPOSAL_LISTINGS = ['candidate', 'no-votes', 'same-document'] as const;
export const proposalsDatasetSchema = z.object({
  inputs: publicationInputsSchema.optional(),
  id: z.string(), kind: z.literal('proposals'), year: z.union([z.literal(2022), z.literal(2026)]), importedAt: z.string(), importerVersion: z.string(), sources: z.array(sourceSchema), scope: z.string(), notes: z.array(z.string()),
  // Da v2 em diante: extração em ordem de leitura, distância mínima entre palavras, versão da normalização e limiares de texto
  // ilegível. Ausentes na v1 (texto do `-layout`, normalização anterior), nunca presumidos.
  method: z.object({ textPageMinChars: nonnegative, pdftotext: z.string(), tesseract: z.string(), ocrLanguage: z.string(), ocrDpi: nonnegative,
    extraction: z.literal('bbox-layout').optional(), wordSpace: z.number().positive().optional(), normalization: z.string().optional(),
    // Conferência da ordem de leitura com o modo padrão do pdftotext: ausente = exata (v2 de 2022); `non-whitespace` em 2026.
    readingCheck: z.enum(['exact', 'non-whitespace']).optional(),
    // 2026: página com texto do PDF ilegível vai para o OCR (qualidade do OCR medida pelos mesmos limiares). Ausente = bloqueia (v2 de 2022).
    illegibleToOcr: z.boolean().optional(),
    quality: z.object({ maxBadRatio: z.number().positive(), maxVowellessRatio: z.number().positive() }).optional() }),
  totals: z.object({ candidacies: nonnegative, documents: nonnegative, pages: nonnegative, nativePages: nonnegative, ocrPages: nonnegative, emptyPages: nonnegative }),
});
export type ProposalsDataset = z.infer<typeof proposalsDatasetSchema>;
/** Busca literal: de 3 a 80 caracteres depois da normalização, sem caracteres de controle. Sem `q`, só a cobertura. */
export const proposalsQuerySchema = z.object({ year: z.enum(ELECTION_YEARS).default('2022'), q: z.string().max(200).refine((value) => !hasControlCharacters(value), CONTROL_CHARACTERS_MESSAGE).optional()
  .refine((value) => value === undefined || value.trim() === '' || (searchText(value).length >= 3 && searchText(value).length <= 80), 'A busca precisa ter de 3 a 80 caracteres.') }).strict();
const proposalDocumentSchema = z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), file: z.string(), pages: nonnegative, nativePages: nonnegative, ocrPages: nonnegative, emptyPages: nonnegative })
  .refine((item) => item.nativePages + item.ocrPages + item.emptyPages === item.pages, 'Páginas por método não somam o documento.');
export const proposalsResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting-import') }),
  z.object({
    status: z.literal('published'), batchId: z.string(), query: z.string().nullable(),
    source: z.object({ file: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), url: z.string() }),
    method: proposalsDatasetSchema.shape.method,
    // Todas as candidaturas do recorte, sempre, pela ordem do número; nunca por quantidade de ocorrências.
    candidacies: z.array(z.object({
      number: z.string(), ballotName: z.string(), party: z.string(), situation: z.string(), listing: z.enum(PROPOSAL_LISTINGS), document: proposalDocumentSchema.nullable(),
      sameDocumentAs: z.array(z.object({ number: z.string(), ballotName: z.string(), situation: z.string() })),
      // Só com `q`: páginas com ocorrência literal (todas, em ordem) e trechos das primeiras.
      matches: z.object({ pages: z.array(nonnegative), excerpts: z.array(z.object({ page: nonnegative, method: z.enum(PROPOSAL_METHODS), before: z.string(), match: z.string(), after: z.string() })) }).nullable(),
    })),
  }),
]);
export type ProposalsResponse = z.infer<typeof proposalsResponseSchema>;
