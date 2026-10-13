import { notFound } from 'next/navigation';
import Municipality from '../../municipios/[code]/page';
import type { RawQuery } from '../../../lib/query-ui';

export const dynamic = 'force-dynamic';
export default async function ExteriorCity({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<RawQuery> }) {
  const query = await searchParams;
  if (query.uf !== undefined && query.uf !== 'ZZ') notFound();
  return Municipality({ params, searchParams: Promise.resolve({ ...query, uf: 'ZZ' }) });
}
