import { canonicalInputs, reusePublished, publicationId, preparePublication } from './publication';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { incomeBandOf, PLACE_GROUP_CUTS, placeGroupsSchema, STATES, TRACT_SENSITIVITY_RADII, tractAgreementSchema, type TractAgreement } from '@observatorio/contracts';
import { ROOT } from './sources';
import { preservedDownload } from './sidra';
import { IBGE, loadTracts, tractValues } from './sectors';
import { compute } from './place-groups';

/**
 * Sensibilidade da associação local → setor (só o indicador de renda; os demais vêm do cadastro por local). A métrica E
 * publicada usa a mediana do setor que contém o ponto do TSE; aqui, para os mesmos locais associados, a faixa passa a ser a
 * predominante entre os moradores (V06002) dos setores do mesmo município a até 250 m, 500 m e 1 km do ponto (distância
 * geodésica, PostGIS geography), cada setor inteiro na faixa da sua mediana (V06006). Empate entre faixas não escolhe nenhuma.
 * Os grupos são refeitos para cada recorte e comparados com os publicados; nada da publicação da métrica E é alterado.
 */
const VERSION = 'tract-sensitivity-2022-v2';
const SCOPE = '2022/places/tract-sensitivity';
const KEYS = ['uf', 'municipality_code', 'zone', 'place_code'] as const;
const on = (a: string, b: string) => KEYS.map((key) => `${a}.${key}=${b}.${key}`).join(' AND ');
type Input = { id: string; scope: string; metadata: { rounds?: Array<'1' | '2'> } };

async function run() {
  config({ path: resolve(ROOT, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL obrigatória.');
  const started = performance.now();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [`observatorio:${SCOPE}`]);
    if (!lock.rows[0]?.locked) throw new Error(`Já há uma importação de ${SCOPE} em execução.`);
    await client.query(await readFile(resolve(__dirname, 'migrations/014-tract-sensitivity.sql'), 'utf8'));
    const published = (await client.query<Input>("SELECT id, scope, metadata FROM import_batches WHERE published AND (scope='2022/president/BR' OR scope LIKE '2022/governor/%' OR scope LIKE '2022/senator/%' OR scope IN ('2022/places/profiles','2022/places/tracts','2022/places/groups'))")).rows;
    const profiles = published.find((row) => row.scope === '2022/places/profiles'); const tracts = published.find((row) => row.scope === '2022/places/tracts'); const groups = published.find((row) => row.scope === '2022/places/groups');
    if (!profiles || !tracts || !groups) throw new Error('Perfil por local, associação aos setores e métrica E precisam estar publicados.');

    // 1. Mesmas fontes preservadas da associação v2: malha e rendimento do responsável por setor (todos os setores).
    const gpkg = await preservedDownload('br_setores_cd2022', `${IBGE}/malha_com_atributos/setores/gpkg/BR/BR_setores_CD2022.gpkg`, 'setores', 'BR_setores_CD2022.gpkg (malha de setores com atributos)', [], 'gpkg');
    const income = await preservedDownload('agregados_setores_renda_responsavel', `${IBGE}_Rendimento_do_Responsavel/Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip`, 'setores', 'Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip', [], 'zip');
    const inputs = canonicalInputs(published);
    const id = publicationId(VERSION, [gpkg.source.sha256, income.source.sha256], inputs, { radii: TRACT_SENSITIVITY_RADII });
    if (await reusePublished(client, { id, scope: SCOPE, inputs })) { console.log(`Já publicado: ${id}.`); return; }
    const loaded = await loadTracts(client, gpkg.path);
    console.log(`${loaded.tracts.toLocaleString('pt-BR')} setores na malha.`);
    const values = await tractValues(income.path, null, ['V06002', 'V06006']);
    const tractIncome = [...values].flatMap(([setor, value]) => value.V06002 && value.V06006 !== null ? [{ setor, residents: value.V06002, band: incomeBandOf(value.V06006!) }] : []);
    await client.query('CREATE TEMP TABLE tract_income (cd_setor text PRIMARY KEY, residents bigint NOT NULL, band integer NOT NULL)');
    for (let start = 0; start < tractIncome.length; start += 20000) {
      await client.query('INSERT INTO tract_income SELECT x.setor, x.residents, x.band FROM jsonb_to_recordset($1::jsonb) AS x(setor text, residents bigint, band integer)', [JSON.stringify(tractIncome.slice(start, start + 20000))]);
    }
    const unmatched = await client.query<{ n: number }>('SELECT count(*)::integer AS n FROM tract_income i WHERE NOT EXISTS (SELECT 1 FROM tracts t WHERE t.cd_setor=i.cd_setor)');
    if (unmatched.rows[0]!.n) throw new Error(`${unmatched.rows[0]!.n} setores com renda e sem geometria na malha; importação bloqueada.`);
    console.log(`${tractIncome.length.toLocaleString('pt-BR')} setores com moradores e mediana; ${(values.size - tractIncome.length).toLocaleString('pt-BR')} sem (omitidos ou não se aplica).`);

    // 2. Locais: os mesmos da métrica E de renda (associados, sem ponto compartilhado); faixa publicada = a do setor do ponto.
    const cuts = PLACE_GROUP_CUTS['income-median'];
    await client.query(`CREATE TEMP TABLE sens_places AS SELECT t.uf, t.municipality_code, t.zone, t.place_code, t.ibge_code, t.cd_setor, pp.eligible,
        ST_SetSRID(ST_MakePoint(t.longitude, t.latitude), 4674) AS point,
        CASE WHEN c.responsible_income_median IS NULL THEN NULL ${cuts.map((cut, index) => `WHEN c.responsible_income_median <= ${cut} THEN ${index + 1}`).join(' ')} ELSE ${cuts.length + 1} END AS tract_band
      FROM polling_place_tracts t LEFT JOIN census_tract_context c ON c.batch_id=t.batch_id AND c.cd_setor=t.cd_setor
      JOIN polling_place_profiles pp ON pp.batch_id=$2 AND ${on('pp', 't')}
      WHERE t.batch_id=$1 AND t.status='associated' AND t.shared_coordinate=0 AND pp.eligible > 0`, [tracts.id, profiles.id]);
    await client.query('ANALYZE sens_places');

    // 3. Setores do mesmo município a até o maior raio, com a distância geodésica ao ponto; por UF, para acompanhar.
    const largest = Math.max(...TRACT_SENSITIVITY_RADII.map(Number));
    await client.query('CREATE TEMP TABLE sens_pairs (uf text, municipality_code text, zone integer, place_code text, cd_setor text, band integer, residents bigint, distance double precision)');
    for (const uf of STATES) {
      // Pré-filtro pelo retângulo em graus (índice espacial), com folga de 5%; o corte exato é o ST_DWithin geodésico.
      await client.query(`INSERT INTO sens_pairs SELECT p.uf, p.municipality_code, p.zone, p.place_code, t.cd_setor, i.band, i.residents, ST_Distance(t.geom::geography, p.point::geography)
        FROM sens_places p JOIN tracts t ON t.cd_mun=p.ibge_code AND t.geom && ST_Expand(p.point, ${largest} * 1.05 / (111320 * cos(radians(ST_Y(p.point)))), ${largest} * 1.05 / 110540)
        JOIN tract_income i ON i.cd_setor=t.cd_setor
        WHERE p.uf=$1 AND ST_DWithin(t.geom::geography, p.point::geography, ${largest})`, [uf]);
      console.log(`${uf}: pares local–setor calculados (${Math.round((performance.now() - started) / 1000)} s).`);
    }
    // Conferência: o setor que contém o ponto, quando tem mediana, precisa aparecer à distância ~0 (mesma geometria da v2).
    const lost = await client.query<{ n: number }>(`SELECT count(*)::integer AS n FROM sens_places p WHERE p.tract_band IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sens_pairs s WHERE ${on('s', 'p')} AND s.cd_setor=p.cd_setor AND s.distance < 1)`);
    if (lost.rows[0]!.n) throw new Error(`${lost.rows[0]!.n} locais sem o próprio setor entre os vizinhos; importação bloqueada.`);

    // 4. Faixa predominante por raio: a de mais moradores; empate entre faixas fica sem faixa (tie).
    await client.query(`CREATE TEMP TABLE sens_bands AS
      WITH sums AS (SELECT r.radius, ${KEYS.map((key) => `s.${key}`).join(', ')}, s.band, sum(s.residents) AS residents
          FROM unnest(ARRAY[${TRACT_SENSITIVITY_RADII.join(',')}]) AS r(radius) JOIN sens_pairs s ON s.distance <= r.radius GROUP BY r.radius, ${KEYS.map((key) => `s.${key}`).join(', ')}, s.band),
        top AS (SELECT *, rank() OVER (PARTITION BY radius, ${KEYS.join(', ')} ORDER BY residents DESC) AS position FROM sums)
      SELECT radius, ${KEYS.join(', ')}, CASE WHEN count(*) = 1 THEN min(band) END AS band, count(*) > 1 AS tie, min(residents) AS residents FROM top WHERE position = 1 GROUP BY radius, ${KEYS.join(', ')}`);
    const impossible = await client.query<{ n: number }>(`SELECT count(*)::integer AS n FROM sens_places p CROSS JOIN unnest(ARRAY[${TRACT_SENSITIVITY_RADII.join(',')}]) AS r(radius)
      LEFT JOIN sens_bands b ON b.radius=r.radius AND ${on('b', 'p')} WHERE p.tract_band IS NOT NULL AND b.band IS NULL AND NOT coalesce(b.tie, false)`);
    if (impossible.rows[0]!.n) throw new Error(`${impossible.rows[0]!.n} locais com faixa no setor do ponto e sem faixa no raio; importação bloqueada.`);
    // Faixa de cada local por raio, indexada e com estatísticas: sem isso o planejador escolhe laços aninhados (minutos por recorte).
    await client.query(`CREATE TEMP TABLE sens_ind AS SELECT b.radius, p.uf, p.municipality_code, p.zone, p.place_code AS code, b.band::numeric AS value, p.eligible AS weight
      FROM sens_places p JOIN sens_bands b ON ${on('b', 'p')} WHERE b.band IS NOT NULL`);
    await client.query('CREATE INDEX ON sens_ind (radius, uf, municipality_code, zone, code)'); await client.query('ANALYZE sens_ind');

    // 5. Concordância por território (Brasil e UFs) e raio, em locais e eleitores aptos.
    const category = `CASE WHEN coalesce(b.tie, false) THEN 'tie' WHEN p.tract_band IS NULL AND b.band IS NULL THEN 'none' WHEN p.tract_band IS NULL THEN 'radiusOnly'
      WHEN b.band = p.tract_band THEN 'same' WHEN abs(b.band - p.tract_band) = 1 THEN 'adjacent' ELSE 'distant' END`;
    const agreementRows = await client.query<{ radius: number; uf: string; category: keyof TractAgreement; places: number; eligible: string }>(`SELECT r.radius, p.uf, ${category} AS category, count(*)::integer AS places, sum(p.eligible)::text AS eligible
      FROM sens_places p CROSS JOIN unnest(ARRAY[${TRACT_SENSITIVITY_RADII.join(',')}]) AS r(radius) LEFT JOIN sens_bands b ON b.radius=r.radius AND ${on('b', 'p')} GROUP BY 1, 2, 3`);
    const placesByUf = await client.query<{ uf: string; places: number }>('SELECT uf, count(*)::integer AS places FROM sens_places GROUP BY uf');
    const agreement = (radius: string, uf: string | null): TractAgreement => {
      const rows = agreementRows.rows.filter((row) => String(row.radius) === radius && (uf === null || row.uf === uf));
      const empty = { places: 0, eligible: 0 };
      const result = Object.fromEntries((['same', 'adjacent', 'distant', 'tie', 'radiusOnly', 'none'] as const).map((key) => [key, rows.filter((row) => row.category === key)
        .reduce((sum, row) => ({ places: sum.places + row.places, eligible: sum.eligible + Number(row.eligible) }), empty)]));
      const expected = placesByUf.rows.filter((row) => uf === null || row.uf === uf).reduce((sum, row) => sum + row.places, 0);
      const counted = Object.values(result).reduce((sum, item) => sum + item.places, 0);
      if (counted !== expected) throw new Error(`Concordância ${uf ?? 'BR'}/${radius} m: ${counted} locais; esperados ${expected}.`);
      return tractAgreementSchema.parse(result);
    };

    // 6. Grupos refeitos por recorte e raio, com o mesmo cálculo da métrica E (votos somados por grupo).
    const recortes: Array<{ results: string; office: string; uf: string | null; round: string }> = [];
    for (const batch of published.filter((row) => !row.scope.startsWith('2022/places/'))) {
      const [, office, territory] = batch.scope.split('/') as [string, string, string];
      for (const round of batch.metadata.rounds ?? ['1', '2']) for (const uf of territory === 'BR' ? [null, ...STATES] : [territory]) recortes.push({ results: batch.id, office, uf, round });
    }
    if (!recortes.length) throw new Error('Nenhum recorte eleitoral publicado; importação bloqueada.');
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO import_batches(id,scope,metadata) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [id, SCOPE, { kind: 'tract-sensitivity', pending: true }]);
      await client.query('DELETE FROM place_group_sensitivity WHERE batch_id=$1', [id]);
      let done = 0;
      for (const recorte of recortes) for (const radius of TRACT_SENSITIVITY_RADII) {
        // Peso = eleitores aptos do perfil por local (o mesmo da métrica E), já em sens_places; $5 (perfil) só identifica a publicação.
        const banded = `SELECT uf, municipality_code, zone, code, value, weight FROM sens_ind WHERE radius=${Number(radius)} AND $5::text IS NOT NULL`;
        const result = await compute(client, { ...recorte, profiles: profiles.id, tracts: tracts.id, numerators: {}, indicator: 'income-median', banded });
        const reference = await client.query<{ result: { coverage: { places: number; totalVotes: number } } }>('SELECT result FROM place_groups WHERE batch_id=$1 AND results_batch=$2 AND office=$3 AND uf=$4 AND round=$5 AND indicator=$6',
          [groups.id, recorte.results, recorte.office, recorte.uf ?? 'BR', Number(recorte.round), 'income-median']);
        if (!reference.rows[0]) throw new Error(`Sem grupos publicados para ${recorte.office}/${recorte.uf ?? 'BR'}/${recorte.round}.`);
        // Mesmo universo de locais com votos do recorte; muda só a faixa de cada local.
        if (reference.rows[0].result.coverage.places !== result.coverage.places || reference.rows[0].result.coverage.totalVotes !== result.coverage.totalVotes) throw new Error(`Cobertura divergente em ${recorte.office}/${recorte.uf ?? 'BR'}/${recorte.round}.`);
        const parsed = placeGroupsSchema.parse({ ...result, association: { radius, agreement: agreement(radius, recorte.uf) } });
        await client.query('INSERT INTO place_group_sensitivity VALUES($1,$2,$3,$4,$5,$6,$7)', [id, recorte.results, recorte.office, recorte.uf ?? 'BR', Number(recorte.round), Number(radius), parsed]);
        if (++done % 50 === 0) console.log(`${done} recortes calculados.`);
      }
      const pairs = await client.query<{ n: string }>('SELECT count(*)::text AS n FROM sens_pairs');
      const national = Object.fromEntries(TRACT_SENSITIVITY_RADII.map((radius) => [radius, agreement(radius, null)]));
      const method = 'Para cada local associado (setor único, do próprio município, sem ponto compartilhado), a faixa de renda passa a ser a predominante entre os moradores em domicílios particulares permanentes ocupados (V06002) dos setores do mesmo município a até 250 m, 500 m e 1 km do ponto do TSE (distância geodésica). Cada setor entra inteiro, na faixa da sua mediana (V06006), se tocar o círculo; empate entre faixas deixa o local sem faixa.';
      const dataset = { kind: 'tract-sensitivity', id, importerVersion: VERSION, inputs, importedAt: new Date().toISOString(), recortes: done, method,
        sources: [gpkg.source, income.source], national,
        scope: 'Sensibilidade da métrica E de renda à associação local → setor: grupos refeitos com a faixa predominante no entorno do local, para comparação com a publicada.',
        notes: [`${loaded.tracts.toLocaleString('pt-BR')} setores na malha; ${tractIncome.length.toLocaleString('pt-BR')} com moradores e mediana divulgados entram no entorno.`,
          `${Number(pairs.rows[0]!.n).toLocaleString('pt-BR')} pares local–setor a até ${largest} m.`, 'Setores de outro município não entram no entorno, mesmo a poucos metros.',
          'A faixa pelo raio supõe que o entorno do local representa melhor o perfil de quem vota ali; nenhuma das duas associações mede a renda dos eleitores.'] };
      await client.query('UPDATE import_batches SET metadata=$2 WHERE id=$1', [id, dataset]);
      const report = { dataset, elapsedSeconds: Math.round((performance.now() - started) / 1000), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
      for (const source of [gpkg.source, income.source]) await client.query('INSERT INTO original_sources VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [source.sha256, source.file, source.sizeBytes ?? 0]);
      await preparePublication(client, { id, scope: SCOPE, inputs, report });
      await client.query('COMMIT');

      console.log(JSON.stringify({ published: id, scope: SCOPE, recortes: done, national, elapsedSeconds: report.elapsedSeconds }, null, 2));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { client.release(); await pool.end(); }
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Sensibilidade da associação falhou.'); process.exitCode = 1; });
