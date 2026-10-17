import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ServiceUnavailableException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { emptyMunicipalitiesSchema, nationalResponseSchema } from '@observatorio/contracts';

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
  for (const query of ['page=0', 'pageSize=101', 'year=2024', 'uf=XX', 'year=2022&year=2026']) {
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
  for (const query of ['q=s', 'q=', `q=${'a'.repeat(61)}`, 'q=sao&page=2', 'q=sao&office=deputies']) assert.equal((await fetch(`${base}/elections/municipalities/suggest?${query}`)).status, 400, query);
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

