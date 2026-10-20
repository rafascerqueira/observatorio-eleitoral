import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ServiceUnavailableException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { emptyMunicipalitiesSchema, nationalResponseSchema, searchText } from '@observatorio/contracts';

let app: INestApplication;
let base: string;
let databaseAvailable = true;
let published = false;
let national = false;
let incomplete = false;
let exteriorPublished = false;
let exteriorIncomplete = false;
let governor = false;
let governorRounds = ['1', '2'];
let stateOffice = 'governor';
let trigram = true;
let contextPublished = false;
let tractsPublished = false;
let urbanPublished = false;
// Mapa local → setor (fase B3): vistas, setores e locais sintéticos, com a projeção gravada pelo importador.
let tractMapPublished = false;
// Propostas sintéticas: dois documentos, um deles compartilhado por duas candidaturas do mesmo número (valores fictícios).
let proposalsPublished = false;
const proposalSource = { file: 'proposta_governo_2022_BR.zip', entry: 'BR/2022BR<SQ>.pdf', url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_2022_BR.zip', sha256: '5'.repeat(64),
  downloadedAt: '2026-10-20T00:00:00Z', generatedAt: [], lastModified: null, rowsRead: 3, rowsSelected: 3 };
const proposalsDataset = { id: '4'.repeat(64), kind: 'proposals', year: 2022, importedAt: '2026-10-20T00:00:00Z', importerVersion: 'test', sources: [proposalSource], scope: 'Teste', notes: [],
  method: { textPageMinChars: 50, pdftotext: 'pdftotext test', tesseract: 'tesseract test', ocrLanguage: 'por', ocrDpi: 300 }, totals: { candidacies: 4, documents: 2, pages: 3, nativePages: 2, ocrPages: 1, emptyPages: 0 } };
const docA = 'a1'.repeat(32), docB = 'b2'.repeat(32);
const proposalDocument = (sha256: string | null, pages: number, native: number, ocr: number) => sha256 ? { sha256, file: `BR/${sha256.slice(0, 4)}.pdf`, pages, native_pages: native, ocr_pages: ocr, empty_pages: pages - native - ocr } : { sha256: null, file: null, pages: null, native_pages: null, ocr_pages: null, empty_pages: null };
const proposalCandidacies = [
  { number: '12', ballot_name: 'CANDIDATURA A', party: 'P1', situation: 'APTO', listing: 'candidate', ...proposalDocument(docA, 2, 1, 1) },
  { number: '14', ballot_name: 'CANDIDATURA B', party: 'P2', situation: 'INAPTO', listing: 'same-document', ...proposalDocument(docB, 1, 1, 0) },
  { number: '14', ballot_name: 'CANDIDATURA C', party: 'P2', situation: 'APTO', listing: 'candidate', ...proposalDocument(docB, 1, 1, 0) },
  { number: '90', ballot_name: 'CANDIDATURA D', party: 'P3', situation: 'INAPTO', listing: 'no-votes', ...proposalDocument(null, 0, 0, 0) },
];
const proposalPages = [{ sha256: docA, page: 2, method: 'ocr', text: 'Plano de\n  ACESSIBILI-\n  DADE urbana e calçadas' }, { sha256: docB, page: 1, method: 'native', text: 'Mais acessibilidade nas escolas.' }];
let tractMapViews: Array<Record<string, unknown>> = [];
let tractMapTracts: Array<Record<string, unknown>> = [];
let tractMapPlaces: Array<Record<string, unknown>> = [];
const mapView = (view_id: string, level: string, split = false, tracts = 2) => ({ view_id, level, name: level === 'municipality' ? null : 'Sé', tracts, split, oversize: split,
  x0: -46.8, y1: -23.3, kx: 0.92, scale: 1000, offset_x: 8, margin: 8, width: 600, height: 500 });
const mapPlace = (zone: number, code: string, status: string, cd_setor: string | null, longitude: number | null, latitude: number | null) => ({ zone, code, name: `Local ${code}`, status, latitude, longitude, electors: 100, cd_setor, ibge_code: '3550308' });
// Locais e setores sintéticos (códigos de formato real, valores fictícios) para o contrato da associação local → setor.
const tractRow = (zone: number, code: string, status: string, setor: string | null, median: string | null, urban: { surveyed: boolean; urban: number[] | null } = { surveyed: false, urban: null }) => ({ zone, code, status, latitude: setor ? -23.5 : null, longitude: setor ? -46.6 : null,
  electors: 100, shared: 0, cd_setor: setor, context: setor !== null, situation: setor ? 'Urbana' : null, residents: setor ? '500' : null, median, ...urban });
// Entorno sintético coerente: base 10 na primeira categoria de cada característica (calçada SIM = posição 21).
const urbanCounts = () => { const counts = new Array<number>(35).fill(0); counts[0] = 10; let offset = 1; for (const size of [5, 3, 3, 3, 3, 3, 3, 3, 3, 5]) { counts[offset] = 10; offset += size; } return counts; };
let tractRows: Array<ReturnType<typeof tractRow>> = [];
// Contexto sintético mínimo (valores fictícios, só para o contrato HTTP).
const distribution = (kind: string, total: number | null) => ({ kind, source: 'teste', total, categories: [{ key: 'a', label: 'A', value: total }] });
const contextItem = { code: '71072', name: 'SÃO PAULO', uf: 'SP', ibgeCode: '3550308', ibgeName: 'São Paulo', population: { total: 10, age16plus: 8, age16to17: 1, age18to69: 6, age70plus: 1 },
  populationByAge: distribution('universo', 8), race: distribution('universo', 10), literacy15: distribution('universo', 9), education18: distribution('amostra', 7), incomeClasses: distribution('amostra', null),
  incomePerCapita: { mean: null, median: 1000, source: 'teste' },
  electorate: { eligible: 7, gender: distribution('cadastro', 7), age: distribution('cadastro', 7), education: distribution('cadastro', 7), maritalStatus: distribution('cadastro', 7) },
  resultsEligible: { '1': 8, '2': 8 }, turnout: { '1': null, '2': null } };
const contextDataset = { id: 'd'.repeat(64), kind: 'municipal-context', year: 2022, importedAt: '2026-10-17T00:00:00Z', importerVersion: 'test', sources: [], scope: 'Teste', validation: 'checked', coverage: { expected: 1, published: 1, withoutTurnout: ['DF'] }, notes: [] };
const queries: Array<{ sql: string; parameters: unknown[] }> = [];
// Metadados e local exclusivamente sintéticos para verificar o contrato HTTP.
const dataset = { id: 'a'.repeat(64), year: 2022, office: 'president', municipalityCode: '71072', municipalityName: 'São Paulo', uf: 'SP', importedAt: '2026-10-12T00:00:00Z', importerVersion: 'test', sources: [], scope: 'Teste', validation: 'reconciled' };
const place = { zone: 1, code: '1015', name: 'Local de teste', address: null, sections: 2, totals: { eligible: null, turnout: null, abstentions: null, valid: 0, blank: 0, null: 0, totalVotes: 0 }, candidates: [], metadataConflict: false, metadataVariants: [{ name: 'Local de teste', address: null }] };
before(async () => {
  const config = readConfig({ DATABASE_URL: 'postgresql://test:test@localhost/test' });
  const module = await Test.createTestingModule({ imports: [AppModule.register(config)] })
    .overrideProvider(DatabaseService).useValue({ check: async () => {
      if (!databaseAvailable) throw new ServiceUnavailableException({ status: 'unavailable', database: 'unavailable' });
    }, query: async (sql: string, parameters: unknown[] = []) => {
      if (!databaseAvailable) throw new ServiceUnavailableException();
      queries.push({ sql, parameters });
      if (published) {
        if (sql.includes('to_regclass')) return { rows: [{ registry: 'import_batches' }] };
        if (sql.includes('pg_extension')) return { rows: [{ installed: trigram }] };
        if (sql.includes('scope=$1') && parameters[0] === '2022/places/tracts') return { rows: tractsPublished ? [{ id: 'e'.repeat(64), metadata: {} }] : [] };
        if (sql.includes('scope=$1') && parameters[0] === '2022/context/urban-surroundings') return { rows: urbanPublished ? [{ id: 'f'.repeat(64), metadata: {} }] : [] };
        if (sql.includes('FROM import_batches ORDER BY imported_at DESC')) return { rows: urbanPublished ? [{ id: 'f'.repeat(64), scope: '2022/context/urban-surroundings', published: true, metadata: { id: 'f'.repeat(64), kind: 'urban-surroundings', year: 2022, importedAt: '2026-10-19T00:00:00Z',
          importerVersion: 'test', sources: [], scope: 'Teste', notes: [], totals: { municipalities: 1, tracts: 3, suppressedTracts: 1, residents: 10, associatedTracts: 2, associatedSurveyed: 1, associatedSuppressed: 0 } } },
          { id: '9'.repeat(64), scope: '2022/geo/tracts', published: true, metadata: { id: '9'.repeat(64), kind: 'tract-geometries', year: 2022, importedAt: '2026-10-19T00:00:00Z', importerVersion: 'test', sources: [], scope: 'Teste', notes: [],
            totals: { rows: 4, tracts: 3, multipart: 1, invalid: 1, comparedPlaces: 2, equalPlaces: 2 } } },
          { id: '4'.repeat(64), scope: '2022/proposals/president', published: true, metadata: proposalsDataset }] : [] };
        if (sql.includes('FROM municipality_urban_surroundings WHERE batch_id=$1 AND ibge_code=$2')) return { rows: [{ tracts: 3, suppressed: 1, counts: urbanCounts() }] };
        if (sql.includes('FROM municipality_urban_surroundings')) return { rows: [{ id: '3550308', code: '71072', uf: 'SP', name: 'São Paulo', counts: urbanCounts() }] };
        if (sql.includes('scope=$1') && parameters[0] === '2022/context/municipal') return { rows: contextPublished ? [{ id: 'd'.repeat(64), metadata: {} }] : [] };
        if (sql.includes('scope=$1') && parameters[0] === '2022/geo/tract-display') return { rows: tractMapPublished ? [{ id: '7'.repeat(64), metadata: {} }] : [] };
        if (sql.includes('scope=$1') && parameters[0] === '2022/context/income-bands') return { rows: tractMapPublished ? [{ id: '6'.repeat(64), metadata: {} }] : [] };
        if (sql.includes('FROM tract_income_bands WHERE batch_id=$1 LIMIT 1')) return { rows: [{ exists: 1 }] };
        if (sql.includes('place_code AS code, name')) return { rows: parameters[2] === '71072' ? tractMapPlaces : [] };
        if (sql.includes('FROM tract_display_views')) return { rows: tractMapViews };
        if (sql.includes('scope=$1') && parameters[0] === '2022/proposals/president') return { rows: proposalsPublished ? [{ id: '4'.repeat(64), metadata: proposalsDataset }] : [] };
        if (sql.includes('FROM proposal_candidacies')) return { rows: proposalCandidacies };
        if (sql.includes('FROM proposal_pages')) return { rows: proposalPages.filter((page) => searchText(page.text).includes(String(parameters[1]))) };
        if (sql.includes('FROM tract_display d')) return { rows: tractMapTracts.map((tract) => ({ ...tract, path: sql.includes('d.path') ? tract.path : '' })) };
        if (sql.includes('FROM polling_place_tracts')) return { rows: parameters[2] === '71072' ? tractRows : [] };
        if (sql.includes("->'totals'->>'abstentions'")) return { rows: [{ id: '3550308', code: '71072', uf: 'SP', name: 'São Paulo', numerator: '2', denominator: '10' }] };
        if (sql.includes('FROM municipality_indicators')) return { rows: [{ id: '3550308', code: '71072', uf: 'SP', name: 'São Paulo', numerator: '9', denominator: '10' }] };
        if (sql.includes("scope='2022/context/municipal'")) return { rows: contextPublished ? [{ metadata: contextDataset }] : [] };
        if (sql.includes('FROM municipality_context')) return { rows: parameters[2] === '71072' ? [{ result: contextItem }] : [] };
        if (sql.includes('word_similarity')) return { rows: [{ code: '71072', name: 'SÃO PAULO', uf: 'SP', match: 'prefix' }] };
        if (sql.includes('scope=$1')) return { rows: governor && parameters[0] === `2022/${stateOffice}/SP` ? [{ metadata: { ...dataset, id: 'c'.repeat(64), office: stateOffice, municipalityCode: undefined, municipalityName: undefined, level: 'state', rounds: governorRounds, coverage: { expected: 1, reconciled: 1, blocked: 0, excluded: 0 } } }] : [] };
        if (sql.includes('FROM import_coverage WHERE batch_id=$1 AND office=$2')) return { rows: [{ reconciled: 1, other: 0 }] };
        if (sql.includes('AND uf=$5 ORDER BY code')) return { rows: [{ result: { code: '71072', name: 'São Paulo', uf: 'SP', electionCode: parameters[2] === '1' ? '546' : '547', round: parameters[2], totals: { eligible: 10, turnout: 8, abstentions: 2, nonInstalledEligible: 0, valid: 6, blank: 1, null: 1, totalVotes: 8 }, candidates: [{ number: '10', name: 'Candidatura de teste', party: 'Teste', votes: 6, percentValid: 100 }], zones: 1, sections: 2, pollingPlaces: 1, nonInstalledSections: 0 } }] };
        if (sql.includes("scope='2022/president/ZZ'")) return { rows: exteriorPublished ? [{ metadata: { ...dataset, id: 'b'.repeat(64), municipalityCode: undefined, municipalityName: undefined, uf: 'ZZ', level: 'exterior', coverage: { expected: exteriorIncomplete ? 2 : 1, reconciled: exteriorIncomplete ? 2 : 1, blocked: 0, excluded: 0 } } }] : [] };
        if (sql.includes('SELECT metadata')) return { rows: [{ metadata: national ? { ...dataset, municipalityCode: undefined, municipalityName: undefined, uf: undefined, level: 'national', coverage: { expected: incomplete ? 2 : 1, reconciled: incomplete ? 2 : 1, blocked: 0, excluded: 0 } } : dataset }] };
        if (sql.includes("AND uf='ZZ'")) return { rows: [{ result: { code: '60011', name: 'Localidade sintética', uf: 'ZZ', electionCode: '544', round: parameters[2], totals: { eligible: 10, turnout: 8, abstentions: 2, nonInstalledEligible: 0, valid: 6, blank: 1, null: 1, totalVotes: 8 }, candidates: [{ number: '13', name: 'Candidato de teste', party: 'Teste', votes: 6, percentValid: 100 }], zones: 1, sections: 2, pollingPlaces: 1, nonInstalledSections: 0 } }] };
        if (sql.includes("uf<>'ZZ'")) return { rows: [{ result: { code: '60011', name: 'Município teste RJ', uf: 'RJ', electionCode: '544', round: parameters[2], totals: { eligible: 10, turnout: 8, abstentions: 2, nonInstalledEligible: 0, valid: 6, blank: 1, null: 1, totalVotes: 8 }, candidates: [{ number: '13', name: 'Candidato de teste', party: 'Teste', votes: 6, percentValid: 100 }], zones: 1, sections: 2, pollingPlaces: 1, nonInstalledSections: 0 } }] };
        if (sql.startsWith('SELECT result FROM municipality_results')) return { rows: [{ result: { code: national ? '60011' : '71072', name: national ? 'Município teste RJ' : 'São Paulo', uf: parameters[0] === 'b'.repeat(64) ? 'ZZ' : national ? 'RJ' : 'SP' } }] };
        if (sql.includes('count(*)')) return { rows: [{ total: 1 }] };
        if (sql.includes('SELECT p.result')) return { rows: [{ result: place, section_numbers: [1, 2] }] };
        throw new Error('Consulta inesperada no teste');
      }
      return { rows: [{ registry: null }] };
    } }).compile();
  app = module.createNestApplication();
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
test('exterior tem namespace próprio, total independente da busca e soma explícita ao Brasil', async () => {
  assert.equal((await (await fetch(`${base}/elections/exterior`)).json()).status, 'awaiting-import');
  published = true; national = true; exteriorPublished = true; queries.length = 0;
  try {
    const response = await fetch(`${base}/elections/exterior?search=Lisboa&pageSize=10`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.pagination.total, 0); assert.equal(data.summary.exteriorCities, 1); assert.equal(data.summary.totals.valid, 6);
    const all = await (await fetch(`${base}/elections/national`)).json();
    assert.equal(all.includesExterior, true); assert.equal(all.summary.totals.valid, 12); assert.equal(all.summary.municipalities, 1); assert.equal(all.summary.exteriorCities, 1);
    const places = await fetch(`${base}/elections/exterior/cities/60011/places?zone=1&section=2`);
    assert.equal(places.status, 200); assert.equal((await places.json()).municipality.uf, 'ZZ');
    const select = queries.find((query) => query.sql.includes('SELECT p.result'))!;
    assert.deepEqual(select.parameters.slice(6, 10), ['60011', 2022, 'president', 'ZZ']);
    assert.equal(select.parameters[0], 'b'.repeat(64));
    assert.equal((await fetch(`${base}/elections/exterior/cities/60011/places?uf=SP`)).status, 400);
    assert.equal((await fetch(`${base}/elections/exterior/cities/60011/places?year=2026`)).status, 404);
    assert.equal((await (await fetch(`${base}/elections/exterior?year=2026`)).json()).status, 'awaiting-import');
    exteriorIncomplete = true;
    assert.equal((await fetch(`${base}/elections/exterior`)).status, 503);
    assert.equal((await fetch(`${base}/elections/national`)).status, 503, 'Brasil não pode omitir silenciosamente uma publicação de exterior inconsistente');
  } finally { published = false; national = false; exteriorPublished = false; exteriorIncomplete = false; }
});
test('consolidado nacional não usa paginação/filtros municipais nem publica uma cobertura parcial', async () => {
  assert.equal((await (await fetch(`${base}/elections/national`)).json()).status, 'awaiting-import');
  published = true;
  try {
    assert.equal((await (await fetch(`${base}/elections/national`)).json()).status, 'awaiting-import', 'Piloto não é um Brasil consolidado');
    national = true; queries.length = 0;
    for (const round of ['1', '2']) {
      const response = await fetch(`${base}/elections/national?round=${round}`);
      assert.equal(response.status, 200);
      const data = nationalResponseSchema.parse(await response.json());
      assert.equal(data.status, 'published');
      if (data.status === 'published') { assert.equal(data.summary.municipalities, 1); assert.equal(data.summary.totals.valid, 6); }
    }
    const select = queries.find((query) => query.sql.includes("uf<>'ZZ'"))!;
    assert.doesNotMatch(select.sql, /LIMIT|OFFSET/);
    assert.deepEqual(select.parameters, [dataset.id, '2022', '1', 'president']);
    for (const query of ['uf=SP', 'page=2', 'search=Manaus', 'round=3', 'office=senator', 'round=1&round=2']) {
      assert.equal((await fetch(`${base}/elections/national?${query}`)).status, 400);
    }
    assert.equal((await (await fetch(`${base}/elections/national?year=2026`)).json()).status, 'awaiting-import');
    incomplete = true;
    assert.equal((await fetch(`${base}/elections/national`)).status, 503);
  } finally { published = false; national = false; incomplete = false; }
});
test('consulta nacional de locais isola UF/município/ano/cargo nas duas tabelas', async () => {
  published = true; national = true; queries.length = 0;
  try {
    const response = await fetch(`${base}/elections/municipalities/60011/places?uf=RJ&zone=1&section=2`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.municipality.uf, 'RJ');
    const select = queries.find((query) => query.sql.includes('SELECT p.result'))!;
    assert.match(select.sql, /national_place_results/);
    assert.match(select.sql, /national_section_votes/);
    assert.match(select.sql, /p.municipality_code=\$7/);
    assert.match(select.sql, /s.uf=p.uf/);
    assert.deepEqual(select.parameters.slice(6, 10), ['60011', 2022, 'president', 'RJ']);
    assert.equal((await fetch(`${base}/elections/sources/invalid/archive.zip`)).status, 404);
    assert.equal((await fetch(`${base}/elections/imports/invalid/report`)).status, 404);
  } finally { published = false; national = false; }
});

test('busca HTTP por zona/seção usa parâmetros SQL e retorna a lista de seções', async () => {
  published = true; queries.length = 0;
  try {
    const search = "Colégio %_'); SELECT 1; --";
    const params = new URLSearchParams({ zone: '0001', section: '0002', local: '01015', search, pageSize: '10' });
    const response = await fetch(`${base}/elections/municipalities/71072/places?${params}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.items[0].sectionNumbers, [1, 2]);
    assert.equal(data.items[0].sections, 2);
    const select = queries.find((query) => query.sql.includes('SELECT p.result'))!;
    assert.deepEqual(select.parameters.slice(2, 5), [1, 2, 1015]);
    assert.equal(select.parameters[5], search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    assert.equal(select.sql.includes(search), false);
    assert.equal(select.sql.includes('EXISTS'), true);
    for (const query of ['zone=0', 'section=-1', 'local=abc', 'zone=1&zone=2', 'sort=municipality']) assert.equal((await fetch(`${base}/elections/municipalities/71072/places?${query}`)).status, 400);
    assert.equal((await fetch(`${base}/elections/municipalities/71072/places?year=2026`)).status, 404);
  } finally { published = false; }
});
after(async () => { await app?.close(); });

test('saúde, contrato vazio e rejeição de filtros inválidos por HTTP', async () => {
  assert.deepEqual(await (await fetch(`${base}/health/ready`)).json(), { status: 'ok', database: 'ok' });
  const response = await fetch(`${base}/elections/municipalities?year=2026&round=2&uf=RJ&page=2&pageSize=10`);
  assert.equal(response.status, 200);
  const data = emptyMunicipalitiesSchema.parse(await response.json());
  assert.equal(data.dataset, null);
  assert.equal(data.filters.year, '2026');
  assert.equal(data.pagination.page, 2);
  assert.deepEqual(data.items, []);
  for (const query of ['page=0', 'pageSize=101', 'year=2024', 'uf=XX', 'year=2022&year=2026', 'search=S%00o', 'search=S%01o']) {
    assert.equal((await fetch(`${base}/elections/municipalities?${query}`)).status, 400);
  }
});

test('banco indisponível gera 503 e não uma tabela vazia; liveness permanece 200', async () => {
  databaseAvailable = false;
  try {
    assert.equal((await fetch(`${base}/health/ready`)).status, 503);
    assert.equal((await fetch(`${base}/elections/municipalities`)).status, 503);
    assert.equal((await fetch(`${base}/elections/national`)).status, 503);
    assert.equal((await fetch(`${base}/health/live`)).status, 200);
  } finally { databaseAvailable = true; }
});

test('configuração inválida falha sem expor credenciais', () => {
  assert.throws(() => readConfig({ DATABASE_URL: 'segredo', API_PORT: '0' }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /DATABASE_URL/);
    assert.doesNotMatch(error.message, /segredo/);
    return true;
  });
});

test('governador exige UF, usa publicação própria da UF e não entra no Brasil nem no exterior', async () => {
  const fields = await (await fetch(`${base}/elections/municipalities?office=governor`)).json();
  assert.deepEqual(fields.fields, ['uf']);
  assert.equal((await fetch(`${base}/elections/municipalities/71072/places?office=governor`)).status, 400);
  for (const path of ['national?office=governor', 'exterior?office=governor', 'state?office=governor', 'state?office=governor&uf=ZZ', 'exterior/cities/60011/places?office=governor']) {
    assert.equal((await fetch(`${base}/elections/${path}`)).status, 400, path);
  }
  assert.equal((await (await fetch(`${base}/elections/state?office=governor&uf=SP`)).json()).status, 'awaiting-import');
  published = true; governor = true; queries.length = 0;
  try {
    const response = await fetch(`${base}/elections/state?office=governor&uf=SP&round=2`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.status, 'published'); assert.equal(data.dataset.office, 'governor'); assert.equal(data.summary.municipalities, 1); assert.equal(data.summary.totals.valid, 6);
    const select = queries.find((query) => query.sql.includes('AND uf=$5 ORDER BY code'))!;
    assert.deepEqual(select.parameters, ['c'.repeat(64), '2022', '2', 'governor', 'SP']);
    assert.equal((await (await fetch(`${base}/elections/state?office=governor&uf=RJ`)).json()).status, 'awaiting-import', 'Outra UF não herda a publicação de SP');
    assert.equal((await (await fetch(`${base}/elections/state?office=governor&uf=SP&year=2026`)).json()).status, 'awaiting-import');
    assert.equal((await (await fetch(`${base}/elections/municipalities?office=governor&uf=RJ`)).json()).status, 'awaiting-import');
    queries.length = 0;
    const places = await fetch(`${base}/elections/municipalities/71072/places?office=governor&uf=SP`);
    assert.equal(places.status, 200);
    const placeSelect = queries.find((query) => query.sql.includes('SELECT p.result'))!;
    assert.deepEqual(placeSelect.parameters.slice(6, 10), ['71072', 2022, 'governor', 'SP']);
    assert.equal(placeSelect.parameters[0], 'c'.repeat(64));
  } finally { published = false; governor = false; }
});

test('UF sem 2º turno responde turno não realizado, distinto de dado não importado', async () => {
  published = true; governor = true; governorRounds = ['1'];
  try {
    const state = await (await fetch(`${base}/elections/state?office=governor&uf=SP&round=2`)).json();
    assert.equal(state.status, 'round-not-held'); assert.equal(state.summary, null); assert.equal(state.dataset.office, 'governor');
    assert.equal((await (await fetch(`${base}/elections/state?office=governor&uf=SP&round=1`)).json()).status, 'published');
    const list = await (await fetch(`${base}/elections/municipalities?office=governor&uf=SP&round=2`)).json();
    assert.equal(list.status, 'round-not-held'); assert.deepEqual(list.items, []);
    const places = await fetch(`${base}/elections/municipalities/71072/places?office=governor&uf=SP&round=2`);
    assert.equal(places.status, 404); assert.equal((await places.json()).reason, 'round-not-held');
    assert.equal((await (await fetch(`${base}/elections/state?office=governor&uf=RJ&round=2`)).json()).status, 'awaiting-import', 'Sem publicação continua awaiting-import');
  } finally { published = false; governor = false; governorRounds = ['1', '2']; }
});

test('senador é cargo estadual de turno único, com publicação própria e separada do governador', async () => {
  assert.deepEqual((await (await fetch(`${base}/elections/municipalities?office=senator`)).json()).fields, ['uf']);
  for (const path of ['national?office=senator', 'exterior?office=senator', 'state?office=senator', 'state?office=senator&uf=ZZ']) assert.equal((await fetch(`${base}/elections/${path}`)).status, 400, path);
  published = true; governor = true;
  try {
    assert.equal((await (await fetch(`${base}/elections/state?office=senator&uf=SP`)).json()).status, 'awaiting-import', 'Senado não herda a publicação do governador');
    stateOffice = 'senator'; governorRounds = ['1']; queries.length = 0;
    const state = await (await fetch(`${base}/elections/state?office=senator&uf=SP&round=1`)).json();
    assert.equal(state.status, 'published'); assert.equal(state.dataset.office, 'senator');
    assert.deepEqual(queries.find((query) => query.sql.includes('AND uf=$5 ORDER BY code'))!.parameters, ['c'.repeat(64), '2022', '1', 'senator', 'SP']);
    assert.equal((await (await fetch(`${base}/elections/state?office=senator&uf=SP&round=2`)).json()).status, 'round-not-held');
    assert.equal((await (await fetch(`${base}/elections/state?office=governor&uf=SP`)).json()).status, 'awaiting-import', 'Governador não herda a publicação do Senado');
  } finally { published = false; governor = false; stateOffice = 'governor'; governorRounds = ['1', '2']; }
});

test('sugestões usam trigramas sobre o nome normalizado, com curingas escapados e recorte publicado', async () => {
  for (const query of ['q=s', 'q=', `q=${'a'.repeat(61)}`, 'q=sao&page=2', 'q=sao&office=deputies', 'q=sa%00o']) assert.equal((await fetch(`${base}/elections/municipalities/suggest?${query}`)).status, 400, query);
  assert.deepEqual((await (await fetch(`${base}/elections/municipalities/suggest?q=rio&office=senator`)).json()).fields, ['uf']);
  assert.equal((await (await fetch(`${base}/elections/municipalities/suggest?q=sao`)).json()).status, 'awaiting-import');
  published = true; national = true; queries.length = 0;
  try {
    const response = await fetch(`${base}/elections/municipalities/suggest?q=${encodeURIComponent('  São_Pau%lo ')}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.status, 'published'); assert.deepEqual(data.items[0], { code: '71072', name: 'SÃO PAULO', uf: 'SP', match: 'prefix' });
    const select = queries.find((query) => query.sql.includes('word_similarity'))!;
    assert.match(select.sql, /<%/); assert.doesNotMatch(select.sql, /strpos/); assert.match(select.sql, /LIMIT 8/);
    assert.deepEqual(select.parameters, [dataset.id, 'sao_pau%lo', 'sao\\_pau\\%lo', 'president', null]);
    trigram = false;
    assert.equal((await fetch(`${base}/elections/municipalities/suggest?q=sao`)).status, 503, 'Sem índice de trigramas, a busca não cai para varredura');
  } finally { published = false; national = false; trigram = true; }
});

test('contexto municipal: exige UF, separa ausência de publicação de município inexistente e valida o contrato', async () => {
  for (const query of ['', 'uf=ZZ', 'uf=SP&round=1', 'uf=SP&year=2024']) assert.equal((await fetch(`${base}/elections/municipalities/71072/context?${query}`)).status, 400, query);
  assert.equal((await (await fetch(`${base}/elections/municipalities/71072/context?uf=SP`)).json()).status, 'awaiting-import');
  published = true; contextPublished = true; queries.length = 0;
  try {
    const data = await (await fetch(`${base}/elections/municipalities/71072/context?uf=SP`)).json();
    assert.equal(data.status, 'published'); assert.equal(data.item.ibgeCode, '3550308'); assert.equal(data.item.incomeClasses.total, null, 'Suprimido continua null');
    assert.deepEqual(queries.find((query) => query.sql.includes('FROM municipality_context'))!.parameters, ['d'.repeat(64), 'SP', '71072']);
    assert.equal((await fetch(`${base}/elections/municipalities/02550/context?uf=AM`)).status, 404);
    assert.equal((await (await fetch(`${base}/elections/municipalities/71072/context?uf=SP&year=2026`)).json()).status, 'awaiting-import');
  } finally { published = false; contextPublished = false; }
});


test('grupos de locais (métrica E): indicador obrigatório, cargo estadual exige UF e sem publicação nada é calculado', async () => {
  for (const query of ['', 'indicator=renda', 'indicator=college&page=2']) assert.equal((await fetch(`${base}/elections/places/groups?${query}`)).status, 400, query);
  assert.deepEqual((await (await fetch(`${base}/elections/places/groups?indicator=college&office=senator`)).json()).fields, ['uf']);
  const empty = await (await fetch(`${base}/elections/places/groups?indicator=income-median`)).json();
  assert.equal(empty.status, 'awaiting-import'); assert.deepEqual(empty.groups, []); assert.equal(empty.coverage.votesInGroups, 0);
});

test('publicação presidencial de 2022 nunca atende a ano diferente, inclusive grupos, raios e mapas por UF', async () => {
  published = true; national = true;
  try {
    for (const path of ['map/candidates', 'map/candidates?uf=SP', 'places/groups?indicator=college', 'places/groups?indicator=income-median&radius=250', 'places/groups?indicator=women&uf=SP', 'municipalities', 'national', 'state?uf=SP']) {
      queries.length = 0;
      const response = await fetch(`${base}/elections/${path}${path.includes('?') ? '&' : '?'}year=2026`);
      assert.equal(response.status, 200, path);
      const data = await response.json();
      assert.equal(data.status, 'awaiting-import', path);
      assert.equal(data.groups?.length ?? data.items?.length ?? 0, 0, path);
      assert.ok(!queries.some(({ sql }) => /FROM (place_groups|place_group_sensitivity|municipality_results)/.test(sql)), 'Sem leitura de resultados de outro ano');
    }
    assert.equal((await fetch(`${base}/elections/national?year=2022`)).status, 200, 'A publicação correta continua disponível');
  } finally { published = false; national = false; }
});

test('associação local → setor: exige UF, separa ausência de publicação e valida situação, setor e resumo', async () => {
  for (const query of ['', 'uf=ZZ', 'uf=SP&round=1', 'uf=SP&year=2024', 'uf=SP&office=governor']) assert.equal((await fetch(`${base}/elections/municipalities/71072/place-tracts?${query}`)).status, 400, query);
  assert.equal((await fetch(`${base}/elections/municipalities/abc/place-tracts?uf=SP`)).status, 404);
  assert.equal((await (await fetch(`${base}/elections/municipalities/71072/place-tracts?uf=SP`)).json()).status, 'awaiting-import');
  published = true; tractsPublished = true; queries.length = 0;
  tractRows = [tractRow(1, '1015', 'associated', '355030807000234', '1515.5'), tractRow(1, '1023', 'associated', '355030890000197', null), tractRow(2, '1040', 'no-coordinate', null, null)];
  try {
    const data = await (await fetch(`${base}/elections/municipalities/71072/place-tracts?uf=SP`)).json();
    assert.equal(data.status, 'published'); assert.equal(data.batchId, 'e'.repeat(64));
    assert.deepEqual(data.summary.associated, { places: 2, electors: 200 }); assert.deepEqual(data.summary['no-coordinate'], { places: 1, electors: 100 });
    assert.deepEqual(data.summary.relocated, { places: 0, electors: 0 }, 'Situação sem locais é contagem zero, não ausente');
    assert.deepEqual(data.items[0].tract, { code: '355030807000234', situation: 'Urbana', residents: 500, incomeMedian: 1515.5, incomeBand: 2 });
    assert.equal(data.items[1].tract.incomeMedian, null); assert.equal(data.items[1].tract.incomeBand, null, 'Mediana omitida pelo IBGE continua null');
    assert.equal(data.items[2].tract, null); assert.equal(data.items[2].latitude, null);
    assert.deepEqual(queries.find((query) => query.sql.includes('FROM polling_place_tracts'))!.parameters, ['e'.repeat(64), 'SP', '71072']);
    queries.length = 0;
    assert.equal((await fetch(`${base}/elections/municipalities/2550/place-tracts?uf=AM`)).status, 404, 'Município fora da associação');
    assert.deepEqual(queries.find((query) => query.sql.includes('FROM polling_place_tracts'))!.parameters.slice(1), ['AM', '02550'], 'Código TSE com zeros iniciais');
    assert.equal((await (await fetch(`${base}/elections/municipalities/71072/place-tracts?uf=SP&year=2026`)).json()).status, 'awaiting-import');
    tractRows = [{ ...tractRow(1, '1015', 'associated', '355030807000234', '1000'), context: false }];
    assert.equal((await fetch(`${base}/elections/municipalities/71072/place-tracts?uf=SP`)).status, 503, 'Setor sem contexto gravado é inconsistência');
    tractRows = [tractRow(1, '1015', 'no-coordinate', '355030807000234', '1000')];
    assert.equal((await fetch(`${base}/elections/municipalities/71072/place-tracts?uf=SP`)).status, 503, 'Setor em local não associado é inconsistência');
  } finally { published = false; tractsPublished = false; tractRows = []; }
});

test('entorno dos domicílios: contexto do município, indicador do mapa e setor pesquisado, omitido ou fora da pesquisa', async () => {
  published = true; tractsPublished = true; urbanPublished = true; contextPublished = true; queries.length = 0;
  tractRows = [tractRow(1, '1015', 'associated', '355030807000234', '1000', { surveyed: true, urban: urbanCounts() }), tractRow(1, '1023', 'associated', '355030890000197', '1000', { surveyed: true, urban: null }),
    tractRow(1, '1040', 'associated', '355030890000198', '1000'), tractRow(2, '1058', 'no-coordinate', null, null)];
  try {
    const data = await (await fetch(`${base}/elections/municipalities/71072/place-tracts?uf=SP`)).json();
    assert.equal(data.urbanBatchId, 'f'.repeat(64));
    assert.deepEqual(data.items.map((item: { tract: { urban?: { status: string } } | null }) => item.tract?.urban?.status ?? null), ['surveyed', 'suppressed', 'outside', null]);
    assert.equal(data.items[0].tract.urban.counts[21], 10); assert.equal(data.items[1].tract.urban.counts, null, 'Setor omitido pelo IBGE não vira zero');
    const select = queries.find((query) => query.sql.includes('FROM polling_place_tracts'))!;
    assert.match(select.sql, /tract_urban_surroundings u ON u.batch_id=\$4/); assert.equal(select.parameters[3], 'f'.repeat(64));
    const map = await (await fetch(`${base}/elections/map/values?indicator=urban-sidewalk&uf=SP`)).json();
    assert.equal(map.status, 'published'); assert.deepEqual([map.items[0].numerator, map.items[0].denominator, map.items[0].value], [10, 10, 100]); assert.deepEqual(map.publications, [{ role: 'context', id: 'f'.repeat(64) }]);
    const context = await (await fetch(`${base}/elections/municipalities/71072/context?uf=SP`)).json();
    assert.deepEqual([context.urbanSurroundings.tracts, context.urbanSurroundings.suppressedTracts, context.urbanSurroundings.counts[0]], [3, 1, 10]);
    const catalog = await (await fetch(`${base}/elections/catalog`)).json();
    assert.equal(catalog.urbanSurroundingsDatasets[0].totals.residents, 10, 'Catálogo lista a publicação do entorno'); assert.equal(catalog.datasets.length, 0, 'Entorno e malha não são publicações de cargo');
    assert.equal(catalog.tractGeometriesDatasets[0].totals.invalid, 1, 'Malha de setores em lista própria');
    assert.equal(catalog.proposalsDatasets[0].totals.ocrPages, 1, 'Propostas em lista própria, fora das publicações eleitorais');
    urbanPublished = false;
    const without = await (await fetch(`${base}/elections/municipalities/71072/place-tracts?uf=SP`)).json();
    assert.equal(without.urbanBatchId, null); assert.equal(without.items[0].tract.urban, undefined, 'Sem publicação do entorno, o setor não diz "fora da pesquisa"');
    assert.doesNotMatch(queries.at(-1)!.sql, /tract_urban_surroundings/);
    assert.equal((await (await fetch(`${base}/elections/map/values?indicator=urban-sidewalk`)).json()).status, 'awaiting-import');
  } finally { published = false; tractsPublished = false; urbanPublished = false; contextPublished = false; tractRows = []; }
});

test('abstenção do mapa usa aptos e turnos do próprio cargo; cargo estadual exige UF; Censo não depende de cargo', async () => {
  assert.deepEqual((await (await fetch(`${base}/elections/map/values?indicator=abstention&office=governor`)).json()).fields, ['uf']);
  assert.equal((await fetch(`${base}/elections/map/values?indicator=abstention&office=deputies&uf=SP`)).status, 400);
  published = true; governor = true; contextPublished = true; governorRounds = ['1']; queries.length = 0;
  try {
    const data = await (await fetch(`${base}/elections/map/values?indicator=abstention&office=governor&uf=SP`)).json();
    assert.equal(data.status, 'published'); assert.equal(data.office, 'governor'); assert.equal(data.items[0].value, 20);
    assert.deepEqual(data.publications, [{ role: 'results', id: 'c'.repeat(64) }, { role: 'context', id: 'd'.repeat(64) }]);
    const select = queries.find((query) => query.sql.includes("->'totals'->>'abstentions'"))!;
    assert.match(select.sql, /m\.office=\$5/); assert.deepEqual(select.parameters, ['c'.repeat(64), '1', 'SP', 'd'.repeat(64), 'governor']);
    assert.equal((await (await fetch(`${base}/elections/map/values?indicator=abstention&office=governor&uf=SP&round=2`)).json()).status, 'round-not-held');
    assert.equal((await (await fetch(`${base}/elections/map/values?indicator=abstention&office=governor&uf=RJ`)).json()).status, 'awaiting-import', 'Outra UF não herda a publicação de SP');
    const census = await (await fetch(`${base}/elections/map/values?indicator=literacy-15&office=governor`)).json();
    assert.equal(census.status, 'published'); assert.equal(census.office, undefined); assert.deepEqual(census.publications, [{ role: 'context', id: 'd'.repeat(64) }]);
  } finally { published = false; governor = false; contextPublished = false; governorRounds = ['1', '2']; }
});

test('contexto inconsistente não é publicado como ausência na fonte', async () => {
  published = true; contextPublished = true;
  const previous = contextItem.race.total;
  try {
    contextItem.race.total = 11;
    assert.equal((await fetch(`${base}/elections/municipalities/71072/context?uf=SP`)).status, 503);
  } finally { contextItem.race.total = previous; published = false; contextPublished = false; }
});

test('mapa local → setor: vistas, faixa de cada setor, locais projetados e divisão de vistas grandes', async () => {
  for (const query of ['', 'uf=ZZ', 'uf=SP&view=123', 'uf=SP&paths=2', 'uf=SP&office=governor']) assert.equal((await fetch(`${base}/elections/municipalities/71072/tract-map?${query}`)).status, 400, query);
  published = true; tractsPublished = true;
  try {
    assert.equal((await (await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP`)).json()).status, 'awaiting-import', 'Sem desenho publicado');
    tractMapPublished = true;
    tractMapViews = [mapView('3550308', 'municipality')];
    tractMapTracts = [{ code: '355030807000234', simplified: true, path: 'M 1 1 l 2 0 0 2 z', status: 'band', band: 2, residents: 500 }, { code: '355030807000235', simplified: false, path: 'M 5 5 l 1 0 0 1 z', status: null, band: null, residents: null }];
    tractMapPlaces = [mapPlace(1, '1015', 'associated', '355030807000234', -46.6, -23.5), mapPlace(1, '1023', 'no-coordinate', null, null, null), mapPlace(2, '1040', 'outside-tracts', null, -46.7, -23.4), mapPlace(2, '1058', 'other-municipality', null, -40, -20)];
    const data = await (await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP`)).json();
    assert.equal(data.status, 'published'); assert.equal(data.displayBatchId, '7'.repeat(64)); assert.equal(data.incomeBatchId, '6'.repeat(64));
    assert.equal(data.tracts, undefined, 'Sem caminhos na consulta da página');
    assert.deepEqual(data.legend.bands[1], { index: 2, tracts: 1, residents: 500 }); assert.deepEqual(data.legend.missing, { tracts: 1 }, 'Setor sem linha no arquivo de renda não é zero');
    assert.deepEqual(data.places.map((place: { x: number | null; y: number | null; band: number | null }) => [place.x, place.y, place.band]), [[192, 208, 2], [null, null, null], [100, 108, null], [null, null, null]], 'Mesma projeção do desenho; fora do quadro fica só na tabela');
    const withPaths = await (await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP&paths=1`)).json();
    assert.deepEqual(withPaths.tracts.map((tract: { status: string; band: number | null; path: string }) => [tract.status, tract.band, tract.path]), [['band', 2, 'M 1 1 l 2 0 0 2 z'], ['missing', null, 'M 5 5 l 1 0 0 1 z']]);
    assert.equal((await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP&view=3550308099`)).status, 400, 'Vista com número ímpar de dígitos');
    assert.equal((await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP&view=355030899`)).status, 404, 'Vista de outro recorte');
    // Município dividido: a vista dele não tem desenho; a do distrito traz só os locais dos seus setores ou com ponto no quadro.
    tractMapViews = [mapView('3550308', 'municipality', true, 2), mapView('355030807', 'district')];
    const split = await (await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP`)).json();
    assert.equal(split.view.split, true); assert.equal(split.legend, null); assert.deepEqual(split.places, []); assert.equal(split.views.length, 2);
    const district = await (await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP&view=355030807`)).json();
    assert.equal(district.view.level, 'district'); assert.deepEqual(district.places.map((place: { code: string }) => place.code), ['1015', '1040']);
    tractMapViews = [mapView('3550308', 'municipality')];
    tractMapPlaces = [mapPlace(1, '1015', 'associated', '355030890000197', -46.6, -23.5)];
    assert.equal((await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP`)).status, 503, 'Setor associado fora do desenho do município');
    tractMapViews = [];
    assert.equal((await fetch(`${base}/elections/municipalities/71072/tract-map?uf=SP`)).status, 503, 'Município sem vista no desenho publicado');
  } finally { published = false; tractsPublished = false; tractMapPublished = false; }
});

test('propostas: todas as candidaturas pelo número, documento compartilhado uma vez, busca sem acento e trecho do original', async () => {
  for (const query of ['q=ab', `q=${'a'.repeat(81)}`, 'year=2026', 'q=saude&uf=SP', 'q=saude%00', 'q=sa%7Fude']) assert.equal((await fetch(`${base}/elections/proposals?${query}`)).status, 400, query);
  published = true;
  try {
    assert.equal((await (await fetch(`${base}/elections/proposals`)).json()).status, 'awaiting-import');
    proposalsPublished = true;
    const coverage = await (await fetch(`${base}/elections/proposals`)).json();
    assert.equal(coverage.query, null); assert.deepEqual(coverage.candidacies.map((item: { number: string }) => item.number), ['12', '14', '14', '90']);
    assert.ok(coverage.candidacies.every((item: { matches: unknown }) => item.matches === null), 'Sem busca, sem ocorrências');
    const [, inapt, apt, noVotes] = coverage.candidacies;
    assert.equal(inapt.document, null, 'Documento compartilhado só na candidatura com votos'); assert.equal(apt.document.sha256, docB);
    assert.deepEqual(apt.sameDocumentAs, [{ number: '14', ballotName: 'CANDIDATURA B', situation: 'INAPTO' }]); assert.equal(noVotes.listing, 'no-votes');
    const data = await (await fetch(`${base}/elections/proposals?q=${encodeURIComponent('Acessibilidade')}`)).json();
    assert.equal(data.query, 'acessibilidade');
    const [first, , third, fourth] = data.candidacies;
    assert.deepEqual(first.matches.pages, [2]);
    assert.deepEqual(first.matches.excerpts[0], { page: 2, method: 'ocr', before: 'Plano de ', match: 'ACESSIBILI- DADE', after: ' urbana e calçadas' }, 'Palavra partida na linha encontrada; trecho do original');
    assert.deepEqual(third.matches.pages, [1]); assert.equal(fourth.matches, null, 'Sem documento, sem resultado de busca');
    const none = await (await fetch(`${base}/elections/proposals?q=${encodeURIComponent('saúde')}`)).json();
    assert.deepEqual(none.candidacies[0].matches, { pages: [], excerpts: [] }, 'Nenhuma ocorrência é lista vazia, não ausência de documento');
  } finally { published = false; proposalsPublished = false; }
});
