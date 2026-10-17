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
/** Turno realizado segundo a publicação. Sem `rounds` (versões antigas), não se presume turno único. */
export function roundHeld(dataset: { rounds?: Array<'1' | '2'> | undefined }, round: string) {
  return !dataset.rounds || (dataset.rounds as string[]).includes(round);
}
export function percent(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator * 100;
}
