import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Query, StreamableFile, ServiceUnavailableException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { catalogSchema, datasetSchema, municipalitiesSchema, municipalityQuerySchema, placesQuerySchema, placesResponseSchema, coverageItemSchema, nationalQuerySchema, nationalResponseSchema, exteriorQuerySchema, exteriorResponseSchema, exteriorCitySchema, stateQuerySchema, stateResponseSchema, suggestQuerySchema, suggestResponseSchema, contextDatasetSchema, contextResponseSchema, mapQuerySchema, mapValuesSchema, mapGeometrySchema, MAP_INDICATORS, isStateOffice, roundHeld, OFFICE_LABELS, STATES, STATE_OFFICES, type MunicipalitiesResponse, type PlacesQuery, type Office } from '@observatorio/contracts';
import { DatabaseService } from '../database/database.service';
import { nationalSummary } from './national-summary';

@Controller('elections')
export class ElectionsController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get('national')
  async national(@Query() query: Record<string, unknown>) {
    const parsed = nationalQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Filtros nacionais inválidos.');
    const filters = parsed.data;
    await this.database.check();
    const dataset = await this.publishedDataset(filters.year, 'president');
    if (!dataset || dataset.level !== 'national' || filters.year !== String(dataset.year)) {
      return nationalResponseSchema.parse({ status: 'awaiting-import', filters, summary: null, dataset: null });
    }
    const records = await this.database.query<{ result: unknown }>(
      "SELECT result FROM municipality_results WHERE batch_id=$1 AND year=$2::integer AND round=$3::integer AND office=$4 AND uf<>'ZZ' ORDER BY uf,code",
      [dataset.id, filters.year, filters.round, filters.office],
    );
    const coverage = dataset.coverage;
    if (!coverage || !coverage.expected || coverage.blocked || coverage.expected !== coverage.reconciled || records.rows.length !== coverage.expected) {
      throw new ServiceUnavailableException('Consolidado nacional incompleto.');
    }
    const exteriorDataset = await this.exteriorDataset();
    if (exteriorDataset && (dataset.sources.length !== exteriorDataset.sources.length || dataset.sources.some((source) => !exteriorDataset.sources.some((other) => other.file === source.file && other.entry === source.entry && other.sha256 === source.sha256)))) throw new ServiceUnavailableException('Originais domésticos e do exterior não correspondem à mesma versão.');
    const exterior = exteriorDataset ? await this.exteriorRecords(exteriorDataset, filters.year, filters.round) : [];
    try {
      return nationalResponseSchema.parse({ status: 'published', filters, dataset, exteriorDataset, includesExterior: Boolean(exteriorDataset), summary: nationalSummary([...records.rows.map((row) => row.result), ...exterior], filters.round, Boolean(exteriorDataset)) });
    } catch {
      throw new ServiceUnavailableException('Consolidado nacional inconsistente.');
    }
  }

  @Get('state')
  async state(@Query() query: Record<string, unknown>) {
    const parsed = stateQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ message: 'Filtros estaduais inválidos.', fields: parsed.error.issues.map((issue) => issue.path.join('.')) });
    const filters = parsed.data;
    await this.database.check();
    const dataset = await this.publishedDataset(filters.year, filters.office, filters.uf);
    // O piloto municipal não representa a UF inteira.
    if (!dataset || !['national', 'state'].includes(dataset.level) || filters.year !== String(dataset.year) || (dataset.level === 'state' && dataset.uf !== filters.uf)) {
      return stateResponseSchema.parse({ status: 'awaiting-import', filters, summary: null, dataset: null });
    }
    if (!roundHeld(dataset, filters.round)) return stateResponseSchema.parse({ status: 'round-not-held', filters, summary: null, dataset });
    const records = await this.database.query<{ result: unknown }>(
      'SELECT result FROM municipality_results WHERE batch_id=$1 AND year=$2::integer AND round=$3::integer AND office=$4 AND uf=$5 ORDER BY code',
      [dataset.id, filters.year, filters.round, filters.office, filters.uf],
    );
    const coverage = await this.database.query<{ reconciled: number; other: number }>(
      "SELECT count(*) FILTER (WHERE status='reconciled')::integer AS reconciled, count(*) FILTER (WHERE status<>'reconciled')::integer AS other FROM import_coverage WHERE batch_id=$1 AND office=$2 AND uf=$3",
      [dataset.id, filters.office, filters.uf],
    );
    const { reconciled = 0, other = 1 } = coverage.rows[0] ?? {};
    if (!reconciled || other || records.rows.length !== reconciled) throw new ServiceUnavailableException('Consolidado da UF incompleto.');
    try {
      return stateResponseSchema.parse({ status: 'published', filters, dataset, summary: nationalSummary(records.rows.map((row) => row.result), filters.round) });
    } catch { throw new ServiceUnavailableException('Consolidado da UF inconsistente.'); }
  }

  @Get('exterior')
  async exterior(@Query() query: Record<string, unknown>) {
    const parsed = exteriorQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Filtros do exterior inválidos.');
    const filters = parsed.data;
    const dataset = await this.exteriorDataset();
    if (!dataset || filters.year !== String(dataset.year)) return exteriorResponseSchema.parse({ status: 'awaiting-import', filters, dataset: null, summary: null, items: [], pagination: { page: filters.page, pageSize: filters.pageSize, total: 0 } });
    const records = await this.exteriorRecords(dataset, filters.year, filters.round);
    const search = (filters.search ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const matching = records.filter((record) => (record as { name: string }).name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(search))
      .sort((a, b) => (a as { name: string }).name.localeCompare((b as { name: string }).name, 'pt-BR') || (a as { code: string }).code.localeCompare((b as { code: string }).code));
    try {
      return exteriorResponseSchema.parse({ status: 'published', filters, dataset, summary: nationalSummary(records, filters.round, true),
        items: matching.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize), pagination: { page: filters.page, pageSize: filters.pageSize, total: matching.length } });
    } catch { throw new ServiceUnavailableException('Consolidado do exterior inconsistente.'); }
  }

  @Get('municipalities')
  async municipalities(@Query() query: Record<string, unknown>): Promise<MunicipalitiesResponse> {
    const result = municipalityQuerySchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException({ message: 'Filtros inválidos.', fields: result.error.issues.map((issue) => issue.path.join('.')) });
    }
    if (isStateOffice(result.data.office) && !result.data.uf) throw new BadRequestException({ message: `${OFFICE_LABELS[result.data.office]} é cargo estadual: informe a UF.`, fields: ['uf'] });
    await this.database.check();
    const { page, pageSize, ...filters } = result.data;
    const empty: MunicipalitiesResponse = { status: 'awaiting-import', items: [], pagination: { page, pageSize, total: 0 }, filters, dataset: null };
    const dataset = await this.publishedDataset(filters.year, filters.office, filters.uf);
    if (!dataset || filters.year !== String(dataset.year) || (dataset.uf && filters.uf && filters.uf !== dataset.uf)) return empty;
    if (!roundHeld(dataset, filters.round)) return municipalitiesSchema.parse({ ...empty, status: 'round-not-held', dataset });
    // Trecho do nome com curingas escapados: o índice de trigramas atende o LIKE (strpos não usa índice).
    const search = (filters.search ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\\%_]/g, '\\$&');
    // Identificadores de ordenação vêm somente deste mapa fixo; filtros são parâmetros SQL.
    const column = filters.sort === 'uf' ? 'uf' : 'search_name';
    const direction = filters.direction === 'desc' ? 'DESC' : 'ASC';
    const parameters = [dataset.id, filters.year, filters.round, filters.office, search, filters.uf ?? null];
    const where = "batch_id=$1 AND year=$2::integer AND round=$3::integer AND office=$4 AND search_name LIKE '%' || $5 || '%' AND ($6::text IS NULL OR uf=$6)";
    const total = await this.database.query<{ total: number }>(`SELECT count(*)::integer AS total FROM municipality_results WHERE ${where}`, parameters);
    const items = await this.database.query<{ result: unknown }>(`SELECT result FROM municipality_results WHERE ${where} ORDER BY ${column} ${direction}, uf ASC, code ASC LIMIT $7 OFFSET $8`, [...parameters, pageSize, (page - 1) * pageSize]);
    return municipalitiesSchema.parse({ status: 'published', items: items.rows.map((row) => row.result), pagination: { page, pageSize, total: total.rows[0]?.total ?? 0 }, filters, dataset });
  }

  /** Sugestões enquanto se digita: índice de trigramas (pg_trgm) sobre o nome normalizado, nunca varredura por `strpos`/`LIKE` sem índice. */
  @Get('municipalities/suggest')
  async suggest(@Query() query: Record<string, unknown>) {
    const parsed = suggestQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ message: 'Consulta de sugestões inválida.', fields: parsed.error.issues.map((issue) => issue.path.join('.')) });
    const { year, office, uf, q } = parsed.data;
    if (isStateOffice(office) && !uf) throw new BadRequestException({ message: `${OFFICE_LABELS[office]} é cargo estadual: informe a UF.`, fields: ['uf'] });
    await this.database.check();
    const dataset = await this.publishedDataset(year, office, uf);
    if (!dataset || year !== String(dataset.year)) return suggestResponseSchema.parse({ status: 'awaiting-import', items: [] });
    const extension = await this.database.query<{ installed: boolean }>("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_trgm') AS installed");
    if (!extension.rows[0]?.installed) throw new ServiceUnavailableException('Busca por similaridade indisponível: índice de trigramas não instalado.');
    // Mesma normalização do importador (`search_name`): minúsculas, sem acentos.
    const term = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
    const pattern = term.replace(/[\\%_]/g, '\\$&');
    const rows = await this.database.query<{ code: string; name: string; uf: string; match: string }>(`
      SELECT code, name, uf, match FROM (
        SELECT result->>'code' AS code, result->>'name' AS name, uf, search_name, word_similarity($2, search_name) AS score,
          CASE WHEN starts_with(search_name, $2) THEN 'prefix' WHEN search_name LIKE '% ' || $3 || '%' THEN 'word'
            WHEN search_name LIKE '%' || $3 || '%' THEN 'contains' ELSE 'similar' END AS match
        FROM municipality_results
        WHERE batch_id=$1 AND round=1 AND office=$4 AND uf<>'ZZ' AND ($5::text IS NULL OR uf=$5)
          AND (search_name LIKE '%' || $3 || '%' OR $2 <% search_name)
      ) s ORDER BY array_position(ARRAY['prefix','word','contains','similar'], match), score DESC, search_name, uf LIMIT 8`, [dataset.id, term, pattern, office, uf ?? null]);
    return suggestResponseSchema.parse({ status: 'published', items: rows.rows });
  }

  /** Malha do IBGE: Brasil por UF ou uma UF por município (publicação `2022/maps/ibge`). */
  @Get('map/geometry')
  async mapGeometry(@Query() query: Record<string, unknown>) {
    const parsed = municipalityQuerySchema.pick({ uf: true }).strict().safeParse(query);
    if (!parsed.success) throw new BadRequestException('UF inválida.');
    const level = parsed.data.uf ? 'municipality' as const : 'uf' as const; const uf = parsed.data.uf ?? 'BR';
    await this.database.check();
    const registry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.map_geometries')::text AS registry");
    const row = registry.rows[0]?.registry ? await this.database.query<{ batch_id: string; topology: unknown }>("SELECT g.batch_id, g.topology FROM map_geometries g JOIN import_batches b ON b.id=g.batch_id AND b.published AND b.scope='2022/maps/ibge' WHERE g.level=$1 AND g.uf=$2", [level, uf]) : { rows: [] };
    return mapGeometrySchema.parse(row.rows[0] ? { status: 'published', level, uf, batchId: row.rows[0].batch_id, topology: row.rows[0].topology } : { status: 'awaiting-import', level, uf, batchId: null, topology: null });
  }

  /** Valores do mapa: numerador e denominador somados por município ou UF; percentual só com denominador positivo. */
  @Get('map/values')
  async mapValues(@Query() query: Record<string, unknown>) {
    const parsed = mapQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ message: 'Filtros do mapa inválidos.', fields: parsed.error.issues.map((issue) => issue.path.join('.')) });
    const { indicator, round, uf, year } = parsed.data;
    const level = uf ? 'municipality' as const : 'uf' as const;
    const empty = mapValuesSchema.parse({ status: 'awaiting-import', indicator, level, round, items: [] });
    if (year !== '2022') return empty;
    await this.database.check();
    let rows: Array<{ id: string; code: string; uf: string; name: string; numerator: string | null; denominator: string | null }>;
    if (MAP_INDICATORS[indicator].family === 'ibge') {
      // Indicadores derivados na importação (tabela `municipality_indicators`), sem ler o JSON de contexto inteiro.
      const batch = await this.database.query<{ id: string }>("SELECT id FROM import_batches WHERE published AND scope='2022/context/municipal' LIMIT 1");
      if (!batch.rows[0]) return empty;
      const unit = await this.database.query<typeof rows[number]>(`SELECT ibge_code AS id, code, uf, name, numerator::text, denominator::text FROM municipality_indicators
        WHERE batch_id=$1 AND indicator=$2 AND ($3::text IS NULL OR uf=$3)`, [batch.rows[0].id, indicator, uf ?? null]);
      rows = unit.rows;
    } else {
      const dataset = await this.publishedDataset(year, 'president');
      if (!dataset || dataset.level !== 'national') return empty;
      const context = await this.database.query<{ id: string }>("SELECT id FROM import_batches WHERE published AND scope='2022/context/municipal' LIMIT 1");
      if (!context.rows[0]) return empty;
      const unit = await this.database.query<typeof rows[number]>(`SELECT c.ibge_code AS id, m.code, m.uf, m.result->>'name' AS name, m.result->'totals'->>'abstentions' AS numerator, m.result->'totals'->>'eligible' AS denominator
        FROM municipality_results m JOIN municipality_context c ON c.batch_id=$4 AND c.uf=m.uf AND c.code=m.code
        WHERE m.batch_id=$1 AND m.round=$2::integer AND m.office='president' AND m.uf<>'ZZ' AND ($3::text IS NULL OR m.uf=$3)`, [dataset.id, round, uf ?? null, context.rows[0].id]);
      rows = unit.rows;
    }
    const value = (numerator: number | null, denominator: number | null) => numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator * 100;
    let items = rows.map((row) => { const numerator = row.numerator === null ? null : Number(row.numerator); const denominator = row.denominator === null ? null : Number(row.denominator); return { id: row.id, code: row.code, uf: row.uf, name: row.name, numerator, denominator, value: value(numerator, denominator) }; });
    if (level === 'uf') {
      // UF: soma de numeradores e de denominadores dos municípios (nunca média de percentuais); um nulo torna a UF nula.
      const byUf = new Map<string, { numerator: number | null; denominator: number | null }>();
      for (const item of items) { const sum = byUf.get(item.uf) ?? { numerator: 0, denominator: 0 }; byUf.set(item.uf, { numerator: sum.numerator === null || item.numerator === null ? null : sum.numerator + item.numerator, denominator: sum.denominator === null || item.denominator === null ? null : sum.denominator + item.denominator }); }
      items = [...byUf].map(([code, sum]) => ({ id: items.find((item) => item.uf === code)!.id.slice(0, 2), code, uf: code, name: code, ...sum, value: value(sum.numerator, sum.denominator) }));
    }
    return mapValuesSchema.parse({ status: 'published', indicator, level, round, items: items.sort((a, b) => a.uf.localeCompare(b.uf) || a.name.localeCompare(b.name, 'pt-BR')) });
  }

  /** Contexto do município: Censo 2022 (IBGE) e perfis do TSE como base própria; nada é estimado aqui, só lido da publicação. */
  @Get('municipalities/:code/context')
  async context(@Param('code') code: string, @Query() query: Record<string, unknown>) {
    if (!/^\d+$/.test(code)) throw new NotFoundException('Código municipal inválido.');
    const parsed = municipalityQuerySchema.pick({ year: true }).extend({ uf: municipalityQuerySchema.shape.uf.unwrap() }).strict().safeParse(query);
    if (!parsed.success) throw new BadRequestException({ message: 'Informe ano e UF do município.', fields: parsed.error.issues.map((issue) => issue.path.join('.')) });
    await this.database.check();
    const registry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.municipality_context')::text AS registry");
    const batch = registry.rows[0]?.registry ? await this.database.query<{ metadata: unknown }>("SELECT metadata FROM import_batches WHERE published AND scope='2022/context/municipal' LIMIT 1") : { rows: [] };
    if (!batch.rows[0] || parsed.data.year !== '2022') return contextResponseSchema.parse({ status: 'awaiting-import', dataset: null, item: null });
    const dataset = contextDatasetSchema.parse(batch.rows[0].metadata);
    const item = await this.database.query<{ result: unknown }>('SELECT result FROM municipality_context WHERE batch_id=$1 AND uf=$2 AND code=$3', [dataset.id, parsed.data.uf, code.padStart(5, '0')]);
    if (!item.rows[0]) throw new NotFoundException('Município sem contexto publicado.');
    try { return contextResponseSchema.parse({ status: 'published', dataset, item: item.rows[0].result }); }
    catch { throw new ServiceUnavailableException('Contexto municipal inconsistente.'); }
  }

  @Get('municipalities/:code/places')
  async places(@Param('code') code: string, @Query() query: Record<string, unknown>) {
    if (!/^\d+$/.test(code)) throw new NotFoundException('Código municipal inválido.');
    const parsed = placesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ message: 'Filtros dos locais inválidos.', fields: parsed.error.issues.map((issue) => issue.path.join('.')) });
    const { office, uf } = parsed.data;
    if (isStateOffice(office) && (!uf || uf === 'ZZ')) throw new BadRequestException({ message: `${OFFICE_LABELS[office]} é cargo estadual: informe a UF.`, fields: ['uf'] });
    const dataset = await this.publishedDataset(parsed.data.year, office, uf === 'ZZ' ? undefined : uf);
    return this.placesForDataset(code, parsed.data, dataset);
  }

  @Get('exterior/cities/:code/places')
  async exteriorPlaces(@Param('code') code: string, @Query() query: Record<string, unknown>) {
    if (!/^\d+$/.test(code)) throw new NotFoundException();
    const parsed = placesQuerySchema.extend({ uf: placesQuerySchema.shape.uf.unwrap().extract(['ZZ']).optional(), office: placesQuerySchema.shape.office.unwrap().extract(['president']).default('president') }).safeParse(query);
    if (!parsed.success) throw new BadRequestException('Filtros dos locais do exterior inválidos.');
    return this.placesForDataset(code, { ...parsed.data, uf: 'ZZ' }, await this.exteriorDataset());
  }

  private async placesForDataset(code: string, filters: PlacesQuery, dataset: ReturnType<typeof datasetSchema.parse> | null) {
    const { year, round, page, pageSize, uf, zone, section, local, search } = filters;
    if (!dataset || year !== String(dataset.year) || dataset.office !== filters.office || (dataset.uf && uf && uf !== dataset.uf)) throw new NotFoundException('Recorte municipal não publicado.');
    if (!roundHeld(dataset, round)) throw new NotFoundException({ message: 'Turno não realizado para este cargo na UF, segundo a apuração.', reason: 'round-not-held' });
    const municipalityResult = await this.database.query<{ result: { code: string; name: string; uf: string } }>('SELECT result FROM municipality_results WHERE batch_id=$1 AND code=$2 AND year=$3 AND round=$4 AND office=$5 AND ($6::text IS NULL OR uf=$6)', [dataset.id, code, Number(year), Number(round), filters.office, uf ?? null]);
    const municipality = municipalityResult.rows[0]?.result;
    if (!municipality) throw new NotFoundException('Recorte municipal não publicado.');
    if (municipalityResult.rows.length > 1) throw new BadRequestException('Informe a UF para desambiguar o código municipal.');
    const national = dataset.level !== 'municipality';
    const placeTable = national ? 'national_place_results' : 'polling_place_results';
    const sectionTable = national ? 'national_section_votes' : 'section_votes';
    const text = (search ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const values = [dataset.id, Number(round), zone ?? null, section ?? null, local ?? null, text, code, Number(year), filters.office, municipality.uf];
    const territoryWhere = national ? 'AND p.municipality_code=$7 AND p.year=$8 AND p.office=$9 AND p.uf=$10' : '';
    const sectionWhere = national ? 'AND s.year=p.year AND s.office=p.office AND s.uf=p.uf' : '';
    // EXISTS impede que candidaturas ou várias seções multipliquem os locais.
    // Os filtros numéricos identificam exatamente a unidade, inclusive com zeros iniciais.
    const where = String.raw`p.batch_id=$1 AND p.round=$2 ${territoryWhere}
      AND $7::text IS NOT NULL AND $8::integer IS NOT NULL AND $9::text IS NOT NULL AND $10::text IS NOT NULL
      AND ($3::integer IS NULL OR p.zone=$3)
      AND ($5::integer IS NULL OR p.code::integer=$5)
      AND ($4::integer IS NULL OR EXISTS (
        SELECT 1 FROM ${sectionTable} s WHERE s.batch_id=p.batch_id AND s.round=p.round ${sectionWhere}
        AND s.municipality_code=$7 AND s.zone=p.zone AND s.polling_place_code=p.code AND s.section=$4
      ))
      AND ($6::text='' OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.result->'metadataVariants') v
        WHERE strpos(regexp_replace(normalize(lower(concat_ws(' ', v->>'name', v->>'address')), NFD), U&'[\0300-\036F]', '', 'g'), $6)>0
      ))`;
    const total = await this.database.query<{ total: number }>(`SELECT count(*)::integer AS total FROM ${placeTable} p WHERE ${where}`, values);
    const items = await this.database.query<{ result: Record<string, unknown>; section_numbers: number[] }>(`
      SELECT p.result, ARRAY(
        SELECT DISTINCT s.section FROM ${sectionTable} s WHERE s.batch_id=p.batch_id AND s.round=p.round ${sectionWhere}
        AND s.municipality_code=$7 AND s.zone=p.zone AND s.polling_place_code=p.code ORDER BY s.section
      ) AS section_numbers
      FROM ${placeTable} p WHERE ${where}
      ORDER BY p.zone, p.code::integer LIMIT $11 OFFSET $12`, [...values, pageSize, (page - 1) * pageSize]);
    return placesResponseSchema.parse({ items: items.rows.map((row) => ({ ...row.result, sectionNumbers: row.section_numbers })), total: total.rows[0]?.total ?? 0, page, pageSize, dataset, municipality });
  }

  @Get('catalog')
  async catalog() {
    const registry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.import_batches')::text AS registry");
    const batches = registry.rows[0]?.registry ? await this.database.query<{ id: string; scope: string; published: boolean; metadata: Record<string, unknown> }>('SELECT id,scope,published,metadata FROM import_batches ORDER BY imported_at DESC') : { rows: [] };
    const coverageRegistry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.import_coverage')::text AS registry");
    const coverage = coverageRegistry.rows[0]?.registry ? await this.database.query<{ batch_id: string; uf: string; status: string; municipalities: number; sectionRows: number }>('SELECT batch_id,uf,status,count(*)::integer AS municipalities,sum(section_rows)::integer AS "sectionRows" FROM import_coverage GROUP BY batch_id,uf,status ORDER BY uf,status') : { rows: [] };
    // Contexto municipal (IBGE + perfis do TSE) tem formato próprio, separado das publicações de cargo.
    const isContext = (scope: string) => scope.startsWith('2022/context/'); const isMap = (scope: string) => scope.startsWith('2022/maps/');
    return catalogSchema.parse({ datasets: batches.rows.filter((batch) => batch.published && !isContext(batch.scope) && !isMap(batch.scope)).map((batch) => batch.metadata),
      contextDatasets: batches.rows.filter((batch) => batch.published && isContext(batch.scope)).map((batch) => batch.metadata),
      mapDatasets: batches.rows.filter((batch) => batch.published && isMap(batch.scope)).map((batch) => batch.metadata), imports: batches.rows.map((batch) => ({ id: batch.id, scope: batch.scope, published: batch.published, failureReason: batch.metadata.failureReason ?? null, coverage: coverage.rows.filter((item) => item.batch_id === batch.id) })), plannedOffices: [
      // Cargo estadual: só as UFs sem publicação continuam pendentes.
      ...STATE_OFFICES.flatMap((office) => {
        const published = new Set(batches.rows.filter((batch) => batch.published && batch.scope.startsWith(`2022/${office}/`)).map((batch) => batch.scope.split('/')[2]));
        const missing = STATES.filter((uf) => !published.has(uf));
        return missing.length ? [{ office, label: published.size ? `${OFFICE_LABELS[office]} — ${missing.join(', ')}` : OFFICE_LABELS[office], status: 'not-imported' as const }] : [];
      }),
      // Fora do escopo atual (decisão de 17/10/2026): volume ~13× o do Senado; armazenamento reservado ao IBGE.
      { office: 'deputies', label: 'Deputados federais, estaduais e distritais (fora do escopo atual)', status: 'not-imported' }] });
  }

  @Get('imports/:id/coverage')
  async coverage(@Param('id') id: string, @Query() query: Record<string, unknown>) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new NotFoundException();
    const parsed = municipalityQuerySchema.pick({ page: true, pageSize: true }).safeParse(query);
    if (!parsed.success) throw new BadRequestException('Paginação inválida.');
    const { page, pageSize } = parsed.data;
    const registry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.import_coverage')::text AS registry");
    if (!registry.rows[0]?.registry) throw new NotFoundException();
    const batch = await this.database.query('SELECT id FROM import_batches WHERE id=$1', [id]);
    if (!batch.rows.length) throw new NotFoundException();
    const total = await this.database.query<{ total: number }>('SELECT count(*)::integer AS total FROM import_coverage WHERE batch_id=$1', [id]);
    const records = await this.database.query('SELECT uf,code,name,status,reason,section_rows AS "sectionRows",metadata_conflicts AS "metadataConflicts" FROM import_coverage WHERE batch_id=$1 ORDER BY uf,code LIMIT $2 OFFSET $3', [id, pageSize, (page - 1) * pageSize]);
    return { items: records.rows.map((record) => coverageItemSchema.parse(record)), page, pageSize, total: total.rows[0]?.total ?? 0 };
  }

  @Get('imports/:id/report')
  async report(@Param('id') id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new NotFoundException();
    const registry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.import_batches')::text AS registry");
    if (!registry.rows[0]?.registry) throw new NotFoundException();
    const batch = await this.database.query('SELECT id FROM import_batches WHERE id=$1', [id]);
    if (!batch.rows.length) throw new NotFoundException();
    const path = resolve(process.env.AUDIT_DIRECTORY ?? resolve(__dirname, '../../../../data/audit'), `${id}.json`);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException('Relatório ainda não concluído.');
    return new StreamableFile(createReadStream(path), { type: 'application/json', disposition: `attachment; filename="report-${id}.json"`, length: info.size });
  }

  private verifiedOriginals = new Set<string>();
  @Get('sources/:sha256/:file')
  async original(@Param('sha256') sha256: string, @Param('file') file: string) {
    if (!/^[a-f0-9]{64}$/.test(sha256) || !/^[a-zA-Z0-9_]+\.(zip|json)$/.test(file)) throw new NotFoundException();
    const registry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.original_sources')::text AS registry");
    if (!registry.rows[0]?.registry) throw new NotFoundException();
    const record = await this.database.query<{ size_bytes: string }>('SELECT size_bytes FROM original_sources WHERE sha256=$1 AND file=$2', [sha256, file]);
    if (!record.rows.length) throw new NotFoundException();
    const path = resolve(process.env.ORIGINALS_DIRECTORY ?? resolve(__dirname, '../../../../data/originals'), sha256, file);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile() || info.size !== Number(record.rows[0]!.size_bytes)) throw new ServiceUnavailableException('Original preservado indisponível.');
    const cacheKey = `${path}/${info.size}/${info.mtimeMs}`;
    if (!this.verifiedOriginals.has(cacheKey)) {
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(path)) hash.update(chunk);
      if (hash.digest('hex') !== sha256) throw new ServiceUnavailableException('Integridade do original divergente.');
      this.verifiedOriginals.add(cacheKey);
    }
    return new StreamableFile(createReadStream(path), { type: file.endsWith('.json') ? 'application/json' : 'application/zip', disposition: `attachment; filename="${file}"`, length: info.size });
  }

  /** Presidência: versão nacional, ou o piloto enquanto ela não existir. Cargos estaduais: uma publicação por UF. */
  private async publishedDataset(year: string, office: Office, uf?: string) {
    const registry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.import_batches')::text AS registry");
    if (!registry.rows[0]?.registry) return null;
    if (isStateOffice(office)) {
      if (!uf) return null;
      const result = await this.database.query<{ metadata: unknown }>('SELECT metadata FROM import_batches WHERE published AND scope=$1 LIMIT 1', [`${year}/${office}/${uf}`]);
      if (!result.rows[0]) return null;
      const dataset = datasetSchema.parse(result.rows[0].metadata);
      return dataset.level === 'state' && dataset.office === office && dataset.uf === uf ? dataset : null;
    }
    const dataset = await this.database.query<{ metadata: unknown }>("SELECT metadata FROM import_batches WHERE published AND scope IN ('2022/president/BR','2022/president/SP/71072') ORDER BY CASE WHEN scope='2022/president/BR' THEN 0 ELSE 1 END LIMIT 1");
    return dataset.rows[0] ? datasetSchema.parse(dataset.rows[0].metadata) : null;
  }

  private async exteriorDataset() {
    const registry = await this.database.query<{ registry: string | null }>("SELECT to_regclass('public.import_batches')::text AS registry");
    if (!registry.rows[0]?.registry) return null;
    const result = await this.database.query<{ metadata: unknown }>("SELECT metadata FROM import_batches WHERE published AND scope='2022/president/ZZ' LIMIT 1");
    if (!result.rows[0]) return null;
    const dataset = datasetSchema.parse(result.rows[0].metadata);
    return dataset.level === 'exterior' && dataset.uf === 'ZZ' ? dataset : null;
  }
  private async exteriorRecords(dataset: ReturnType<typeof datasetSchema.parse>, year: string, round: string) {
    const result = await this.database.query<{ result: unknown }>("SELECT result FROM municipality_results WHERE batch_id=$1 AND year=$2::integer AND round=$3::integer AND office='president' AND uf='ZZ' ORDER BY code", [dataset.id, year, round]);
    const coverage = dataset.coverage;
    if (!coverage || !coverage.expected || coverage.blocked || coverage.expected !== coverage.reconciled || result.rows.length !== coverage.expected) throw new ServiceUnavailableException('Cobertura do exterior incompleta.');
    try { return result.rows.map((row) => exteriorCitySchema.parse(row.result)); }
    catch { throw new ServiceUnavailableException('Agregados do exterior inconsistentes.'); }
  }
}
