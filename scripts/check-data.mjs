// Auditoria somente de leitura. Originais preservados e banco são conferidos por caminhos independentes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parse as parseCsv } from 'csv-parse/sync';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { municipalityContextSchema } from '@observatorio/contracts';
config({ path: resolve('.env'), quiet: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, options: '-c default_transaction_read_only=on -c statement_timeout=15000' });
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ');
    const batches = (await client.query('SELECT id, scope, metadata FROM import_batches WHERE published ORDER BY scope')).rows;
    const scope = (name) => { const found = batches.filter((row) => row.scope === name); assert.equal(found.length, 1, name); return found[0]; };
    const context = scope('2022/context/municipal');
    const profileSource = context.metadata.sources.find((source) => source.file === 'perfil_eleitorado_2022.zip');
    assert.ok(profileSource, 'Fonte do perfil do eleitorado ausente');
    const profilePath = resolve('data/originals', profileSource.sha256, profileSource.file);
    const exteriorRows = parseCsv(execFileSync('unzip', ['-p', profilePath, 'perfil_eleitorado_2022_ZZ.csv'], { maxBuffer: 32 * 1024 * 1024 }).toString('latin1'), { delimiter: ';', columns: true, skip_empty_lines: true });
    assert.ok(exteriorRows.length > 0); assert.ok(exteriorRows.every((row) => row.SG_UF === 'ZZ'));
    assert.equal(profileSource.rowsSelected, profileSource.rowsRead - exteriorRows.length, 'Contador de seleção do perfil inclui exterior');
    const items = (await client.query('SELECT result FROM municipality_context WHERE batch_id=$1', [context.id])).rows.map((row) => municipalityContextSchema.parse(row.result));
    assert.equal(items.length, context.metadata.coverage.published);
    const stored = new Map(items.map((item) => [item.ibgeCode, item]));
    let sourceMunicipalities = 0, differences = 0, largest = null;
    const raceKeys = { '95251': 'Total', '2776': 'white', '2777': 'black', '2778': 'asian', '2779': 'brown', '2780': 'indigenous' };
    const sources = context.metadata.sources.filter((source) => source.url.includes('/t/9605/'));
    assert.equal(sources.length, 27);
    for (const source of sources) {
      const bytes = await readFile(resolve('data/originals', source.sha256, source.file));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256, source.file);
      const rows = JSON.parse(bytes); const byMunicipality = new Map();
      for (const row of rows.slice(1)) {
        assert.equal(row.D2C, '93'); assert.equal(row.D3C, '2022'); assert.ok(raceKeys[row.D4C], 'Categoria nova no original');
        const cells = byMunicipality.get(row.D1C) ?? new Map(); assert.ok(!cells.has(row.D4C), 'Célula duplicada no original');
        assert.ok(row.V === '-' || /^\d+$/.test(row.V), `Valor não auditado: ${row.V}`);
        cells.set(row.D4C, row.V === '-' ? 0 : Number(row.V)); byMunicipality.set(row.D1C, cells);
      }
      for (const [code, cells] of byMunicipality) {
        sourceMunicipalities++; assert.equal(cells.size, 6); const item = stored.get(code); assert.ok(item, code);
        assert.equal(item.race.total, cells.get('95251'));
        for (const [category, key] of Object.entries(raceKeys)) if (key !== 'Total') assert.equal(item.race.categories.find((entry) => entry.key === key)?.value, cells.get(category), `${code}/${category}`);
        const delta = cells.get('95251') - [...cells].filter(([key]) => key !== '95251').reduce((sum, [, value]) => sum + value, 0);
        assert.equal(item.race.undistributed ?? 0, delta, `${code}: diferença original × banco`);
        if (delta) { differences++; if (!largest || delta > largest.difference) largest = { code, name: item.name, uf: item.uf, difference: delta, total: item.race.total }; }
      }
    }
    assert.equal(sourceMunicipalities, items.length);
    const sidraSources = context.metadata.sources.filter((source) => source.url.includes('apisidra'));
    const sourceValue = (raw) => {
      if (raw === '-') return 0;
      if (['X', '.', '..', '...'].includes(raw)) return null;
      assert.match(raw, /^\d+(\.\d+)?$/); return Number(raw);
    };
    // Demais tabelas: confronta o resultado publicado diretamente com cada célula original, sem usar o extrator do importador.
    for (const source of sidraSources.filter((source) => !source.url.includes('/t/9605/'))) {
      const bytes = await readFile(resolve('data/originals', source.sha256, source.file)); assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
      const rows = JSON.parse(bytes).slice(1);
      if (source.file === 'sidra_uf_totais.json') {
        for (const row of rows) assert.equal(sourceValue(row.V), items.filter((item) => item.ibgeCode.startsWith(row.D1C)).reduce((sum, item) => sum + item.population.total, 0));
        continue;
      }
      const topic = /^sidra_(age|literacy|education|income|incomevalue)_/.exec(source.file)?.[1]; assert.ok(topic, source.file);
      const column = topic === 'age' || topic === 'income' ? 'D6N' : topic === 'incomevalue' ? 'D2C' : 'D4N';
      const byMunicipality = new Map();
      for (const row of rows) {
        assert.ok(stored.has(row.D1C)); const cells = byMunicipality.get(row.D1C) ?? new Map(); assert.ok(!cells.has(row[column]), `Célula duplicada ${source.file}/${row.D1C}/${row[column]}`);
        cells.set(row[column], sourceValue(row.V)); byMunicipality.set(row.D1C, cells);
      }
      for (const [code, values] of byMunicipality) {
        const item = stored.get(code); const get = (key) => { assert.ok(values.has(key), `${source.file}/${code}: linha ${key} ausente`); return values.get(key); };
        if (topic === 'incomevalue') { assert.equal(values.size, 2); assert.equal(item.incomePerCapita.mean, get('13431')); assert.equal(item.incomePerCapita.median, get('13534')); }
        else if (topic === 'age') {
          assert.equal(item.population.total, get('Total'));
          const sum = (names) => { const counts = names.map(get); return counts.some((value) => value === null) ? null : counts.reduce((a, b) => a + b, 0); };
          const children = sum(['0 a 4 anos', '5 a 9 anos', '10 a 14 anos', '15 anos']);
          assert.equal(item.population.age16plus, get('Total') === null || children === null ? null : get('Total') - children);
          for (const band of item.populationByAge.categories) {
            const value = band.key === 'a21-24' ? get('20 a 24 anos') === null || get('20 anos') === null ? null : get('20 a 24 anos') - get('20 anos') : get(band.label);
            assert.equal(band.value, value, `${code}/${band.key}`);
          }
        } else {
          const distribution = item[{ literacy: 'literacy15', education: 'education18', income: 'incomeClasses' }[topic]];
          assert.equal(values.size, distribution.categories.length + 1); assert.equal(distribution.total, get('Total'));
          for (const category of distribution.categories) assert.equal(category.value, get(category.label), `${code}/${topic}/${category.label}`);
        }
      }
    }
    // Comparadores eleitorais persistidos: uma troca de publicação não pode passar despercebida no legado sem inputs.
    const president = scope('2022/president/BR');
    const eligible = (await client.query("SELECT uf, code, round, result->'totals'->>'eligible' AS eligible FROM municipality_results WHERE batch_id=$1 AND uf<>'ZZ'", [president.id])).rows;
    const election = new Map(eligible.map((row) => [`${row.uf}/${row.code}/${row.round}`, Number(row.eligible)]));
    for (const item of items) for (const round of ['1', '2']) assert.equal(item.resultsEligible[round], election.get(`${item.uf}/${item.code}/${round}`), 'Comparador do contexto desatualizado');
    const turnout = scope('2022/context/turnout-profiles');
    const cells = (await client.query("SELECT uf, municipality_code, round, results_eligible::text FROM turnout_profile_cells WHERE batch_id=$1 AND municipality_code<>''", [turnout.id])).rows;
    for (const cell of cells) assert.equal(Number(cell.results_eligible), election.get(`${cell.uf}/${cell.municipality_code}/${cell.round}`), 'Comparador da participação desatualizado');
    const legacy = [];
    for (const batch of batches.filter((row) => /2022\/(context|maps|places)\//.test(row.scope))) {
      if (batch.metadata.inputs === undefined) legacy.push(batch.scope);
      for (const input of batch.metadata.inputs ?? []) assert.ok(batches.some((current) => current.id === input.id && current.scope === input.scope), `Dependência antiga: ${batch.scope} → ${input.scope}`);
      const report = JSON.parse(await readFile(resolve('data/audit', `${batch.id}.json`), 'utf8')); assert.equal(report.dataset.id, batch.id);
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ status: 'ok', municipalities: items.length, sourceFilesChecked: sidraSources.length, raceSourceFiles: sources.length, distributionsChecked: 'contratos e células originais das seis tabelas municipais, inclusive totais por UF', race: { municipalitiesWithDifference: differences, largest, cause: 'não informada na consulta; diferença confirmada no original, não estimada' }, electoralComparators: { context: items.length * 2, turnout: cells.length }, legacyWithoutRecordedInputs: legacy, sideEffects: 'Somente SELECT, leitura e hash dos originais; nenhuma publicação ou arquivo alterado.' }, null, 2));
  } finally { client.release(); }
} finally { await pool.end(); }
