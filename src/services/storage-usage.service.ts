// Feature 003 (research R13): Supabase Free has 1 GB of Storage. Product images are the bulk of it,
// so the importer and the admin page warn at 800 MB and the importer refuses --apply past 950 MB.
import type { Pool, PoolClient } from 'pg';
import { query } from '../lib/db';

export const STORAGE_WARN_BYTES = 800 * 1024 ** 2;
export const STORAGE_BLOCK_BYTES = 950 * 1024 ** 2;

const USAGE_SQL = `select coalesce(sum((metadata->>'size')::bigint), 0)::text as bytes from storage.objects where bucket_id = $1`;

export async function getBucketUsageBytes(bucket: string, db?: Pool | PoolClient): Promise<number> {
  const result = db ? await db.query<{ bytes: string }>(USAGE_SQL, [bucket]) : await query<{ bytes: string }>(USAGE_SQL, [bucket]);
  return Number(result.rows[0]?.bytes ?? 0);
}
