import type { PoolClient } from 'pg';
import type { MunicipalityResult } from '@observatorio/contracts';
import type { ElectionScope, SectionVote, reconcile } from './model';

type Territory = { code: string; uf: MunicipalityResult['uf']; name: string };
export const searchName = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Grava votos e agregados de um território já reconciliado; o chamador controla a transação. */
export async function persistTerritory(client: PoolClient, id: string, scope: ElectionScope, territory: Territory, results: ReturnType<typeof reconcile>, sections: SectionVote[]) {
  const key = [id, scope.year, scope.office, territory.uf, territory.code] as const;
  for (const summary of results.summaries) {
    await client.query('INSERT INTO municipality_results(batch_id,year,round,office,code,uf,search_name,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, scope.year, Number(summary.round), scope.office, territory.code, territory.uf, searchName(territory.name), summary]);
  }
  for (let start = 0; start < sections.length; start += 2000) {
    await client.query(`INSERT INTO national_section_votes SELECT $1,$2,x."electionCode",x.round::integer,$3,$4,$5,x.zone,x.section,x.local,x.number,x.votes FROM jsonb_to_recordset($6::jsonb) AS x("electionCode" text,round text,zone integer,section integer,local text,number text,votes integer)`, [...key, JSON.stringify(sections.slice(start, start + 2000))]);
  }
  await client.query(`INSERT INTO national_zone_results SELECT $1,$2,$3,$4,$5,x.round::integer,x.zone,to_jsonb(x) FROM jsonb_to_recordset($6::jsonb) AS x(round text,zone integer,totals jsonb,candidates jsonb)`, [...key, JSON.stringify(results.zones)]);
  await client.query(`INSERT INTO national_place_results SELECT $1,$2,$3,$4,$5,x.round::integer,x.zone,x.code,to_jsonb(x) FROM jsonb_to_recordset($6::jsonb) AS x(round text,zone integer,code text,name text,address text,sections integer,totals jsonb,candidates jsonb,"metadataConflict" boolean,"metadataVariants" jsonb)`, [...key, JSON.stringify(results.places)]);
}
