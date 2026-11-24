// ADR-0063 U4 — cache Gemini visual-search results by image SHA-256 so the same screenshot (a viral
// Douyin frame pasted by many customers) costs one Gemini call. Server-only table, pg.Pool access.
import { createHash } from 'node:crypto';
import { query } from '@/lib/db';

export const VISUAL_SEARCH_CACHE_TTL_DAYS = 30;

/** Hash of the decoded image bytes (data-URL prefix stripped), lowercase hex. */
export function visualSearchImageHash(imageBase64: string): string {
  const clean = imageBase64.replace(/^data:image\/[a-z+.-]+;base64,/i, '');
  return createHash('sha256').update(Buffer.from(clean, 'base64')).digest('hex');
}

export async function readVisualSearchCache<T>(hash: string): Promise<T | null> {
  const result = await query<{ result: T }>(
    `update visual_search_cache set hit_count = hit_count + 1, last_hit_at = timezone('utc', now())
     where image_sha256 = $1 and created_at > timezone('utc', now()) - make_interval(days => $2)
     returning result`,
    [hash, VISUAL_SEARCH_CACHE_TTL_DAYS],
  );
  return result.rows[0]?.result ?? null;
}

export async function writeVisualSearchCache(hash: string, value: unknown): Promise<void> {
  await query(
    `insert into visual_search_cache (image_sha256, result) values ($1, $2)
     on conflict (image_sha256) do update set result = excluded.result, created_at = timezone('utc', now()), hit_count = 0, last_hit_at = null`,
    [hash, JSON.stringify(value)],
  );
}

/** Called by the daily trend-snapshot cron. Returns rows removed. */
export async function pruneVisualSearchCache(): Promise<number> {
  const result = await query(
    `delete from visual_search_cache where created_at < timezone('utc', now()) - make_interval(days => $1)`,
    [VISUAL_SEARCH_CACHE_TTL_DAYS],
  );
  return result.rowCount ?? 0;
}
