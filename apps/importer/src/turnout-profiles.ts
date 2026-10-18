import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { optionalVoter, STATES, turnoutProfilesDatasetSchema } from '@observatorio/contracts';
import { count, entries, rows } from './csv';
import { assertEqual } from './model';
import { ROOT, sourceFile } from './sources';
import { tseCategory } from './context-model';

/**
 * Comparecimento e abstenção por perfil (TSE, base própria, declarada), cruzados por gênero × faixa etária × escolaridade, por
 * UF e turno. Contagens exatas da fonte, não ecológicas; nenhum voto por candidatura (o voto é secreto). Mesma fonte do contexto
 * municipal, que guarda só as marginais por município; os totais por UF precisam coincidir com ele.
 */
const VERSION = 'turnout-profiles-2022-v1';
const SCOPE = '2022/context/turnout-profiles';
type Cell = [number, number, number];

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const file = await sourceFile({ file: 'perfil_comparecimento_abstencao_2022.zip', entry: 'perfil_comparecimento_abstencao_2022_<UF>.csv (26 UFs; sem DF na fonte)', directory: 'perfil_comparecimento_abstencao' });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'migrations/013-turnout-profiles.sql'), 'utf8'));

    // Cubo por UF/turno: gênero/faixa do TSE/escolaridade → [aptos, comparecimento, abstenção].
    const cubes = new Map<string, Map<string, Cell>>(); const generated = new Set<string>(); let read = 0;
    for (const entry of entries(file.path).filter((name) => name.endsWith('.csv') && !name.includes('BRASIL'))) {
      for await (const row of rows(file.path, entry)) {
        read++;
        if (!(STATES as readonly string[]).includes(row.SG_UF ?? '')) throw new Error(`UF não auditada no comparecimento: ${row.SG_UF}.`);
        if (!['1', '2'].includes(row.NR_TURNO ?? '')) throw new Error(`Turno não auditado no comparecimento: ${row.NR_TURNO}.`);
        generated.add(`${row.DT_GERACAO} ${row.HH_GERACAO} (America/Sao_Paulo)`);
        const eligible = count(row, 'QT_APTOS'), present = count(row, 'QT_COMPARECIMENTO'), absent = count(row, 'QT_ABSTENCAO');
        const label = `${row.SG_UF}/${row.CD_MUNICIPIO}/${row.NR_ZONA}`;
        assertEqual(present + absent, eligible, `${label}: comparecimento + abstenção = aptos`);
        assertEqual(count(row, 'QT_COMPAREC_FACULTATIVO') + count(row, 'QT_COMPAREC_OBRIGATORIO'), present, `${label}: comparecimento facultativo + obrigatório`);
        assertEqual(count(row, 'QT_ABST_FACULTATIVO') + count(row, 'QT_ABST_OBRIGATORIO'), absent, `${label}: abstenção facultativa + obrigatória`);
        const gender = tseCategory('gender', row.DS_GENERO ?? '').key, age = tseCategory('age', row.DS_FAIXA_ETARIA ?? '').key, education = tseCategory('education', row.DS_GRAU_ESCOLARIDADE ?? '').key;
        // A divisão facultativo/obrigatório da fonte precisa seguir a regra constitucional aplicada aqui (idade e analfabetismo).
        const optional = count(row, 'QT_COMPAREC_FACULTATIVO') + count(row, 'QT_ABST_FACULTATIVO');
        assertEqual(optional, optionalVoter(age, education) ? eligible : 0, `${label} (${row.DS_FAIXA_ETARIA}, ${row.DS_GRAU_ESCOLARIDADE}): aptos facultativos`);
        const cubeKey = `${row.SG_UF}/${row.NR_TURNO}`; const cellKey = `${gender}/${age}/${education}`;
        const cube = cubes.get(cubeKey) ?? new Map<string, Cell>(); const cell = cube.get(cellKey) ?? [0, 0, 0];
        cell[0] += eligible; cell[1] += present; cell[2] += absent;
        cube.set(cellKey, cell); cubes.set(cubeKey, cube);
      }
    }
    const ufs = [...new Set([...cubes.keys()].map((key) => key.split('/')[0]!))];
    const missingUfs = STATES.filter((uf) => !ufs.includes(uf));
    if (missingUfs.join(',') !== 'DF') throw new Error(`UFs sem comparecimento por perfil: ${missingUfs.join(', ') || 'nenhuma'}; auditado: DF.`);
    for (const uf of ufs) for (const round of ['1', '2']) if (!cubes.has(`${uf}/${round}`)) throw new Error(`${uf}: sem ${round}º turno no comparecimento por perfil.`);

    // Conferências: totais por UF/turno = soma das marginais do contexto municipal publicado (mesma fonte).
    const context = await client.query<{ uf: string; round: string; eligible: string; turnout: string; abstentions: string }>(`SELECT c.uf, r.key AS round, sum((r.value->>'eligible')::bigint)::text AS eligible,
      sum((r.value->>'turnout')::bigint)::text AS turnout, sum((r.value->>'abstentions')::bigint)::text AS abstentions
      FROM municipality_context c JOIN import_batches b ON b.id=c.batch_id AND b.published AND b.scope='2022/context/municipal'
      CROSS JOIN LATERAL jsonb_each(c.result->'turnout') r WHERE jsonb_typeof(r.value)='object' GROUP BY c.uf, r.key`);
    if (!context.rows.length) throw new Error('Contexto municipal precisa estar publicado.');
    for (const row of context.rows) {
      const cube = cubes.get(`${row.uf}/${row.round}`);
      if (!cube) throw new Error(`${row.uf}/${row.round}: no contexto e ausente no cubo.`);
      const sum = [...cube.values()].reduce((total, cell) => [total[0] + cell[0], total[1] + cell[1], total[2] + cell[2]], [0, 0, 0]);
      assertEqual(sum[0], Number(row.eligible), `${row.uf}/${row.round}: aptos = contexto municipal`);
      assertEqual(sum[1], Number(row.turnout), `${row.uf}/${row.round}: comparecimento = contexto municipal`);
      assertEqual(sum[2], Number(row.abstentions), `${row.uf}/${row.round}: abstenção = contexto municipal`);
    }
    if (context.rows.length !== cubes.size) throw new Error(`Cubos: ${cubes.size}; UFs/turnos no contexto: ${context.rows.length}.`);
    // Aptos dos resultados (Presidência) por UF/turno, para a diferença declarada.
    const results = await client.query<{ uf: string; round: number; eligible: string }>(`SELECT m.uf, m.round, sum((m.result->'totals'->>'eligible')::bigint)::text AS eligible FROM municipality_results m
      JOIN import_batches b ON b.id=m.batch_id AND b.published AND b.scope='2022/president/BR' WHERE m.office='president' AND m.uf<>'ZZ' GROUP BY m.uf, m.round`);
    const resultsEligible = new Map(results.rows.map((row) => [`${row.uf}/${row.round}`, Number(row.eligible)]));
    if (ufs.some((uf) => !resultsEligible.has(`${uf}/1`) || !resultsEligible.has(`${uf}/2`))) throw new Error('Resultados da Presidência por UF precisam estar publicados.');

    const { path: _path, ...metadata } = file;
    const sources = [{ ...metadata, generatedAt: [...generated], rowsRead: read, rowsSelected: read }];
    const id = createHash('sha256').update(JSON.stringify({ version: VERSION, hashes: sources.map((source) => source.sha256) })).digest('hex');
    const existing = await client.query('SELECT published FROM import_batches WHERE id=$1', [id]);
    if (existing.rows[0]?.published) { console.log(`Já publicado: ${id}.`); return; }
    const totals = (['1', '2'] as const).map((round) => {
      const cells = ufs.flatMap((uf) => [...cubes.get(`${uf}/${round}`)!.values()]);
      return { round, eligible: cells.reduce((sum, cell) => sum + cell[0], 0), turnout: cells.reduce((sum, cell) => sum + cell[1], 0), abstentions: cells.reduce((sum, cell) => sum + cell[2], 0),
        resultsEligible: ufs.reduce((sum, uf) => sum + resultsEligible.get(`${uf}/${round}`)!, 0) };
    });
    const dataset = turnoutProfilesDatasetSchema.parse({ id, kind: 'turnout-profiles', year: 2022, importedAt: new Date().toISOString(), importerVersion: VERSION, sources, missingUfs,
      scope: 'Comparecimento e abstenção por perfil do eleitorado de 2022 (TSE), cruzados por gênero, faixa etária e escolaridade, por UF e turno: contagens da fonte, base própria que não fecha com os resultados.',
      totals, notes: ['A fonte não traz o Distrito Federal nem o exterior: "Brasil" é a soma das 26 UFs presentes.',
        'Totais por UF e turno iguais à soma das marginais do contexto municipal (mesma fonte); comparecimento + abstenção = aptos em cada linha.',
        'Voto facultativo (16 e 17 anos, 70 anos ou mais e analfabetos) conferido contra a divisão facultativo/obrigatório da própria fonte em cada linha.',
        ...totals.map((total) => `${total.round}º turno: ${total.eligible.toLocaleString('pt-BR')} aptos no perfil; ${total.resultsEligible.toLocaleString('pt-BR')} nos resultados das mesmas UFs (diferença não ajustada).`)] });
    await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [metadata.sha256, metadata.file, metadata.sizeBytes ?? 0]);
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET metadata=EXCLUDED.metadata', [id, SCOPE, dataset]);
      await client.query('DELETE FROM turnout_profiles WHERE batch_id=$1', [id]);
      for (const [key, cube] of cubes) {
        const [uf, round] = key.split('/') as [string, string];
        const cells = [...cube].map(([cellKey, cell]) => [...cellKey.split('/'), ...cell]);
        await client.query('INSERT INTO turnout_profiles VALUES($1,$2,$3,$4)', [id, uf, Number(round), { cells, resultsEligible: resultsEligible.get(`${uf}/${round}`) }]);
      }
      await client.query('UPDATE import_batches SET published=false WHERE scope=$1 AND published', [SCOPE]);
      await client.query('UPDATE import_batches SET published=true WHERE id=$1', [id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    const report = { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
    await mkdir(resolve(ROOT, 'data/audit'), { recursive: true });
    await writeFile(resolve(ROOT, 'data/audit', `${id}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ published: id, scope: SCOPE, totals, elapsedSeconds: report.elapsedSeconds }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Comparecimento por perfil falhou.'); process.exitCode = 1; });
