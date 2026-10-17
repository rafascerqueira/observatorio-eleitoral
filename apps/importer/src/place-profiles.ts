import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { placeProfilesDatasetSchema, STATES } from '@observatorio/contracts';
import { count, rows } from './csv';
import { ROOT, sourceFile } from './sources';
import { municipalityCode } from './territory';
import { tseCategory, tseOrder } from './context-model';

/**
 * Perfil do eleitorado por local de votação (decisão 4 de Rafael): o arquivo do TSE por seção, somado por local, guardado
 * como contagens por dimensão na ordem de `tseOrder`. É cadastro (base própria do TSE), não comparecimento nem voto.
 */
const VERSION = 'place-profiles-2022-v1';
const SCOPE = '2022/places/profiles';
const DIMENSIONS = [['gender', 'DS_GENERO'], ['age', 'DS_FAIXA_ETARIA'], ['education', 'DS_GRAU_ESCOLARIDADE'], ['maritalStatus', 'DS_ESTADO_CIVIL']] as const;
type Profile = { eligible: number; counts: Record<string, number[]> };

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(__dirname, 'migrations/010-place-profiles.sql'), 'utf8'));
    const order = Object.fromEntries(DIMENSIONS.map(([dimension]) => [dimension, tseOrder(dimension).map((item) => item.key)]));
    const profiles = new Map<string, Profile>(); const sources = []; let total = 0;
    for (const uf of STATES) {
      const file = await sourceFile({ file: `perfil_eleitor_secao_2022_${uf}.zip`, entry: `perfil_eleitor_secao_2022_${uf}.csv`, directory: 'perfil_eleitor_secao' });
      const generated = new Set<string>(); let read = 0;
      for await (const row of rows(file.path, file.entry)) {
        read++;
        if (row.SG_UF !== uf) throw new Error(`UF inesperada no perfil por seção de ${uf}: ${row.SG_UF}.`);
        generated.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
        const key = `${uf}/${municipalityCode(row.CD_MUNICIPIO!)}/${count(row, 'NR_ZONA')}/${row.NR_LOCAL_VOTACAO}`;
        const profile = profiles.get(key) ?? { eligible: 0, counts: Object.fromEntries(DIMENSIONS.map(([dimension]) => [dimension, order[dimension]!.map(() => 0)])) };
        const value = count(row, 'QT_ELEITORES_PERFIL');
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
    const context = await client.query<{ eligible: string }>("SELECT sum((result->'electorate'->>'eligible')::bigint)::text AS eligible FROM municipality_context c JOIN import_batches b ON b.id=c.batch_id AND b.published AND b.scope='2022/context/municipal'");
    const contextTotal = Number(context.rows[0]?.eligible ?? 0);
    const resultPlaces = await client.query<{ key: string }>(`SELECT DISTINCT p.uf || '/' || p.municipality_code || '/' || p.zone || '/' || p.code AS key FROM national_place_results p
      JOIN import_batches b ON b.id=p.batch_id AND b.published AND b.scope='2022/president/BR' WHERE p.round=1 AND p.uf<>'ZZ'`);
    const withoutProfile = resultPlaces.rows.filter((row) => !profiles.has(row.key)).length;
    const id = createHash('sha256').update(JSON.stringify({ version: VERSION, hashes: sources.map((source) => source.sha256) })).digest('hex');
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}.`); return; }
    const dataset = placeProfilesDatasetSchema.parse({ id, kind: 'place-profiles', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, sources, order,
      scope: 'Perfil do eleitorado de 2022 por local de votação: arquivo do TSE por seção, somado por município, zona e local (cadastro; base própria do TSE).',
      totals: { places: profiles.size, eligible: total, contextEligible: contextTotal, resultPlaces: resultPlaces.rows.length, resultPlacesWithoutProfile: withoutProfile },
      notes: [`Total do arquivo por seção: ${total.toLocaleString('pt-BR')} eleitores; perfil do eleitorado por município (outra geração do TSE): ${contextTotal.toLocaleString('pt-BR')}. A diferença não foi ajustada.`,
        `${withoutProfile} locais com votos publicados não aparecem no perfil por seção.`, 'Cor/raça, identidade de gênero e quilombola: não coletados em 2022 (fonte "#NE"); não guardados.'] });
    for (const source of sources) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes]);
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
      await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
      await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    const report = { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
    await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
    await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ published: id, scope: SCOPE, totals: dataset.totals, elapsedSeconds: report.elapsedSeconds }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Perfil por local falhou.'); process.exitCode = 1; });
