import { reusePublished, publicationId, publishedInputs, preparePublication } from './publication';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { ELECTION_YEARS, placeProfilesDatasetSchema, STATES } from '@observatorio/contracts';
import { parseArgs } from 'node:util';
import { count, entries, rows } from './csv';
import { ROOT, sourceFile } from './sources';
import { municipalityCode } from './territory';
import { tseCategory, tseOrder } from './context-model';

/**
 * Perfil do eleitorado por local de votação (decisão 4 de Rafael): o arquivo do TSE por seção, somado por local, guardado
 * como contagens por dimensão na ordem de `tseOrder`. É cadastro (base própria do TSE), não comparecimento nem voto.
 */
// 2026 (`--year 2026`, 31/10/2026): publicação própria; no arquivo de 2026 a contagem chama `QT_ELEITORES` (2022: `QT_ELEITORES_PERFIL`).
const versionOf = (year: 2022 | 2026) => year === 2022 ? 'place-profiles-2022-v2' : `place-profiles-${year}-v1`;
const DIMENSIONS = [['gender', 'DS_GENERO'], ['age', 'DS_FAIXA_ETARIA'], ['education', 'DS_GRAU_ESCOLARIDADE'], ['maritalStatus', 'DS_ESTADO_CIVIL']] as const;
type Profile = { eligible: number; counts: Record<string, number[]> };

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const { values: args } = parseArgs({ options: { year: { type: 'string', default: '2022' } } });
  if (!(ELECTION_YEARS as readonly string[]).includes(args.year!)) throw new Error(`Uso: --year ${ELECTION_YEARS.join('|')}`);
  const YEAR = Number(args.year) as 2022 | 2026;
  const VERSION = versionOf(YEAR), SCOPE = `${YEAR}/places/profiles`;
  const countField = YEAR === 2022 ? 'QT_ELEITORES_PERFIL' : 'QT_ELEITORES';
  const started = performance.now();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const inputs = await publishedInputs(client, YEAR === 2022 ? ['2022/context/municipal', '2022/president/BR'] : [`${YEAR}/president/BR`]);
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/010-place-profiles.sql'), 'utf8'));
    const files = [];
    for (const uf of STATES) files.push({ uf, file: await sourceFile({ file: `perfil_eleitor_secao_${YEAR}_${uf}.zip`, entry: `perfil_eleitor_secao_${YEAR}_${uf}.csv`, directory: 'perfil_eleitor_secao', ...(YEAR === 2022 ? {} : { year: YEAR }) }) });
    // 2026: total do perfil do eleitorado por município (outra geração do TSE) para a comparação declarada, como o contexto de 2022.
    const electorate = YEAR === 2022 ? null : await sourceFile({ file: `perfil_eleitorado_${YEAR}.zip`, entry: `perfil_eleitorado_${YEAR}_<UF>.csv (27 UFs; ZZ não usado)`, directory: 'perfil_eleitorado', year: YEAR });
    const id = publicationId(VERSION, [...files.map(({ file }) => file.sha256), ...(electorate ? [electorate.sha256] : [])], inputs);
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { console.log(`Já publicado: ${id}.`); return; }
    const order = Object.fromEntries(DIMENSIONS.map(([dimension]) => [dimension, tseOrder(dimension).map((item) => item.key)]));
    const profiles = new Map<string, Profile>(); const sources = []; let total = 0;
    for (const { uf, file } of files) {
      const generated = new Set<string>(); let read = 0;
      for await (const row of rows(file.path, file.entry)) {
        read++;
        if (row.SG_UF !== uf) throw new Error(`UF inesperada no perfil por seção de ${uf}: ${row.SG_UF}.`);
        generated.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
        const key = `${uf}/${municipalityCode(row.CD_MUNICIPIO!)}/${count(row, 'NR_ZONA')}/${row.NR_LOCAL_VOTACAO}`;
        const profile = profiles.get(key) ?? { eligible: 0, counts: Object.fromEntries(DIMENSIONS.map(([dimension]) => [dimension, order[dimension]!.map(() => 0)])) };
        const value = count(row, countField);
        profile.eligible += value; total += value;
        for (const [dimension, field] of DIMENSIONS) {
          const index = order[dimension]!.indexOf(tseCategory(dimension, row[field] ?? '').key);
          profile.counts[dimension]![index]! += value;
        }
        profiles.set(key, profile);
      }
      const { path: _path, ...metadata } = file;
      sources.push({ ...metadata, generatedAt: [...generated], rowsRead: read, rowsSelected: read });
      console.log(`${uf}: ${read.toLocaleString('pt-BR')} linhas; ${profiles.size.toLocaleString('pt-BR')} locais acumulados.`);
    }
    // Conferências: cada dimensão soma o total do local; total nacional comparado ao perfil do eleitorado publicado (outra geração).
    for (const [key, profile] of profiles) for (const [dimension] of DIMENSIONS) {
      const sum = profile.counts[dimension]!.reduce((a, b) => a + b, 0);
      if (sum !== profile.eligible) throw new Error(`${key}: ${dimension} soma ${sum}, total ${profile.eligible}.`);
    }
    let contextTotal = 0, electorateRows = 0;
    if (electorate) {
      for (const entry of entries(electorate.path).filter((name) => name.endsWith('.csv') && !name.includes('BRASIL') && !name.endsWith('_ZZ.csv'))) for await (const row of rows(electorate.path, entry)) { electorateRows++; contextTotal += count(row, 'QT_ELEITORES'); }
    } else {
      const context = await client.query<{ eligible: string }>("SELECT sum((result->'electorate'->>'eligible')::bigint)::text AS eligible FROM municipality_context c JOIN import_batches b ON b.id=c.batch_id AND b.published AND b.scope='2022/context/municipal'");
      contextTotal = Number(context.rows[0]?.eligible ?? 0);
    }
    const resultPlaces = await client.query<{ key: string }>(`SELECT DISTINCT p.uf || '/' || p.municipality_code || '/' || p.zone || '/' || p.code AS key FROM national_place_results p
      JOIN import_batches b ON b.id=p.batch_id AND b.published AND b.scope=$1 WHERE p.round=1 AND p.uf<>'ZZ'`, [`${YEAR}/president/BR`]);
    const withoutProfile = resultPlaces.rows.filter((row) => !profiles.has(row.key)).length;
    const { path: _electoratePath, ...electorateSource } = electorate ?? { path: '' };
    if (electorate) sources.push({ ...(electorateSource as Omit<typeof electorate, 'path'>), generatedAt: [], rowsRead: electorateRows, rowsSelected: electorateRows });
    if (id !== publicationId(VERSION, sources.map((source) => source.sha256), inputs)) throw new Error('Fontes do perfil mudaram durante a leitura; publicação bloqueada.');
    const dataset = placeProfilesDatasetSchema.parse({ id, kind: 'place-profiles', year: YEAR, importedAt: new Date().toISOString(), importerVersion: VERSION, inputs, sources, order,
      scope: `Perfil do eleitorado de ${YEAR} por local de votação: arquivo do TSE por seção, somado por município, zona e local (cadastro; base própria do TSE).`,
      totals: { places: profiles.size, eligible: total, contextEligible: contextTotal, resultPlaces: resultPlaces.rows.length, resultPlacesWithoutProfile: withoutProfile },
      notes: [`Total do arquivo por seção: ${total.toLocaleString('pt-BR')} eleitores; perfil do eleitorado por município (outra geração do TSE): ${contextTotal.toLocaleString('pt-BR')}. A diferença não foi ajustada.`,
        `${withoutProfile} locais com votos publicados não aparecem no perfil por seção.`, YEAR === 2022 ? 'Cor/raça, identidade de gênero e quilombola: não coletados em 2022 (fonte "#NE"); não guardados.' : 'Cor/raça, identidade de gênero e quilombola: não guardados nesta publicação (as dimensões são as mesmas de 2022).'] });
    for (const source of sources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes]);
    const report = { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, dataset]);
      await client.query('DELETE FROM polling_place_profiles WHERE batch_id=$1', [id]);
      const list = [...profiles].map(([key, profile]) => { const [uf, code, zone, local] = key.split('/'); return { uf, code, zone: Number(zone), local, eligible: profile.eligible, counts: profile.counts }; });
      for (let start = 0; start < list.length; start += 5000) {
        await client.query(`INSERT INTO polling_place_profiles SELECT $1, x.uf, x.code, x.zone, x.local, x.eligible, x.counts FROM jsonb_to_recordset($2::jsonb) AS x(uf text, code text, zone integer, local text, eligible integer, counts jsonb)`, [id, JSON.stringify(list.slice(start, start + 5000))]);
      }
      const stored = await client.query<{ n: number; eligible: string }>('SELECT count(*)::integer AS n, sum(eligible)::text AS eligible FROM polling_place_profiles WHERE batch_id=$1', [id]);
      if (stored.rows[0]!.n !== list.length || Number(stored.rows[0]!.eligible) !== total) throw new Error('Perfis gravados não conferem.');
      await preparePublication(client, { id, scope: SCOPE, inputs, report: report });
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }

    console.log(JSON.stringify({ published: id, scope: SCOPE, totals: dataset.totals, elapsedSeconds: report.elapsedSeconds }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Perfil por local falhou.'); process.exitCode = 1; });
