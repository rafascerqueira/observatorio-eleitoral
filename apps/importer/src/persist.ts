import type { PoolClient } from 'pg';
import type { MunicipalityResult } from '@observatorio/contracts';
import type { ElectionScope, SectionVote, reconcile, reconcileExterior } from './model';

type Territory = { code: string; uf: MunicipalityResult['uf'] | 'ZZ'; name: string };
export const searchName = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Grava votos e agregados de um território já reconciliado; o chamador controla a transação. */
export async function persistTerritory(client: PoolClient, id: string, scope: ElectionScope, territory: Territory, results: ReturnType<typeof reconcile> | ReturnType<typeof reconcileExterior>, sections: SectionVote[]) {
  const key = [id, scope.year, scope.office, territory.uf, territory.code] as const;
  for (const summary of results.summaries) {
    await client.query('INSERT INTO municipality_results(batch_id,year,round,office,code,uf,search_name,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, scope.year, Number(summary.round), scope.office, territory.code, territory.uf, searchName(territory.name), summary]);
  }
  for (let start = 0; start < sections.length; start += 2000) {
    await client.query(`INSERT INTO national_section_votes SELECT $1,$2,x."electionCode",x.round::integer,$3,$4,$5,x.zone,x.section,x.local,x.number,x.votes FROM jsonb_to_recordset($6::jsonb) AS x("electionCode" text,round text,zone integer,section integer,local text,number text,votes integer)`, [...key, JSON.stringify(sections.slice(start, start + 2000))]);
  }
  // Zonas e locais são gravados como o objeto reconciliado inteiro. Uma lista fixa de colunas (até Governador v2)
  // descartava `nonValidVotes` dos locais e zonas sem bloquear a publicação.
  await client.query(`INSERT INTO national_zone_results SELECT $1,$2,$3,$4,$5,(x->>'round')::integer,(x->>'zone')::integer,x FROM jsonb_array_elements($6::jsonb) AS x`, [...key, JSON.stringify(results.zones)]);
  await client.query(`INSERT INTO national_place_results SELECT $1,$2,$3,$4,$5,(x->>'round')::integer,(x->>'zone')::integer,x->>'code',x FROM jsonb_array_elements($6::jsonb) AS x`, [...key, JSON.stringify(results.places)]);
}

/** Confere o que foi gravado contra os agregados reconciliados, antes de publicar. */
export async function verifyPersisted(client: PoolClient, id: string, scope: ElectionScope, rounds: string[]) {
  const stored = await client.query(`SELECT round,vote_number,sum(votes)::text AS votes FROM national_section_votes WHERE batch_id=$1 GROUP BY round,vote_number ORDER BY round,vote_number`, [id]);
  const expected = await client.query(`SELECT round,c->>'number' AS vote_number,sum((c->>'votes')::bigint)::text AS votes FROM municipality_results CROSS JOIN LATERAL jsonb_array_elements(result->'candidates') c WHERE batch_id=$1 GROUP BY round,c->>'number'
    UNION ALL SELECT round,'95',sum((result->'totals'->>'blank')::bigint)::text FROM municipality_results WHERE batch_id=$1 GROUP BY round
    UNION ALL SELECT round,n->>'number',sum((n->>'votes')::bigint)::text FROM municipality_results CROSS JOIN LATERAL jsonb_array_elements(coalesce(result->'nonValidVotes','[]'::jsonb)) n WHERE batch_id=$1 GROUP BY round,n->>'number'
    UNION ALL SELECT round,'96',sum((result->'totals'->>'null')::bigint - coalesce((result->'totals'->>'technicalNull')::bigint,0))::text FROM municipality_results WHERE batch_id=$1 GROUP BY round ORDER BY round,vote_number`, [id]);
  const mismatched = await client.query<{ count: number }>(`SELECT count(*)::integer AS count FROM (
    SELECT uf,municipality_code,count(*) AS rows FROM national_section_votes WHERE batch_id=$1 GROUP BY uf,municipality_code
  ) s FULL JOIN (SELECT uf,code,section_rows FROM import_coverage WHERE batch_id=$1 AND status='reconciled') c ON s.uf=c.uf AND s.municipality_code=c.code WHERE s.rows IS DISTINCT FROM c.section_rows::bigint`, [id]);
  const dimensions = await client.query<{ count: number }>(`SELECT count(*)::integer AS count FROM national_section_votes WHERE batch_id=$1 AND (year<>$2 OR office<>$3 OR NOT (round::text = ANY($4::text[])) OR election_code<>CASE WHEN round=1 THEN $5 ELSE $6 END)`, [id, scope.year, scope.office, rounds, scope.electionCodes['1'] ?? null, scope.electionCodes['2'] ?? null]);
  const summaries = await client.query<{ count: number }>('SELECT count(*)::integer AS count FROM municipality_results WHERE batch_id=$1', [id]);
  const reconciled = await client.query<{ count: number }>("SELECT count(*)::integer AS count FROM import_coverage WHERE batch_id=$1 AND status='reconciled'", [id]);
  // Mesma soma a partir dos locais: candidaturas, não válidos, brancos e nulos comuns precisam reproduzir as seções.
  const placeVotes = await client.query(`SELECT round,c->>'number' AS vote_number,sum((c->>'votes')::bigint)::text AS votes FROM national_place_results CROSS JOIN LATERAL jsonb_array_elements(result->'candidates') c WHERE batch_id=$1 GROUP BY round,c->>'number'
    UNION ALL SELECT round,'95',sum((result->'totals'->>'blank')::bigint)::text FROM national_place_results WHERE batch_id=$1 GROUP BY round
    UNION ALL SELECT round,n->>'number',sum((n->>'votes')::bigint)::text FROM national_place_results CROSS JOIN LATERAL jsonb_array_elements(coalesce(result->'nonValidVotes','[]'::jsonb)) n WHERE batch_id=$1 GROUP BY round,n->>'number'
    UNION ALL SELECT round,'96',sum((result->'totals'->>'null')::bigint - coalesce((result->'totals'->>'technicalNull')::bigint,0))::text FROM national_place_results WHERE batch_id=$1 GROUP BY round ORDER BY round,vote_number`, [id]);
  const votesMatch = JSON.stringify(stored.rows) === JSON.stringify(expected.rows);
  const placesMatch = JSON.stringify(stored.rows) === JSON.stringify(placeVotes.rows);
  const ok = votesMatch && placesMatch && mismatched.rows[0]!.count === 0 && dimensions.rows[0]!.count === 0 && summaries.rows[0]!.count === reconciled.rows[0]!.count * rounds.length;
  return { at: new Date().toISOString(), ok, votesMatch, placesMatch, mismatchedMunicipalities: mismatched.rows[0]!.count, outOfScopeRows: dimensions.rows[0]!.count, summaries: summaries.rows[0]!.count, votesByRoundAndNumber: stored.rows };
}
