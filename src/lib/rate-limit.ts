import { query } from './db';
import { createHash } from 'node:crypto';

// Vercel overwrites x-forwarded-for on the edge for direct traffic to prevent spoofing
// (https://vercel.com/docs/headers/request-headers), so it's the trusted client IP under this
// project's DNS-only deployment (docs/exec-plans/active/go-live-deployment-plan.md). Do not
// prefer cf-connecting-ip here — with no Cloudflare proxy in the request path, that header is
// fully attacker-controlled and lets a caller mint a fresh rate-limit key on every request.
export function getClientIp(requestHeaders: Headers): string {
  return requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function createDatabaseRateLimiter(input: { scope: string; maxRequests: number; windowMs: number }) {
  return async function isRateLimited(key: string): Promise<boolean> {
    const storedKey = createHash('sha256').update(key).digest('hex');
    const result = await query<{ is_limited: boolean }>(`
        insert into rate_limit_attempts (scope, limiter_key, attempt_count, window_expires_at)
        values ($1, $2, 1, now() + ($3::bigint * interval '1 millisecond'))
        on conflict (scope, limiter_key) do update set
          attempt_count = case
            when rate_limit_attempts.window_expires_at <= now() then 1
            else rate_limit_attempts.attempt_count + 1
          end,
          window_expires_at = case
            when rate_limit_attempts.window_expires_at <= now()
              then now() + ($3::bigint * interval '1 millisecond')
            else rate_limit_attempts.window_expires_at
          end
        returning attempt_count > $4 as is_limited`, [input.scope, storedKey, input.windowMs, input.maxRequests]);
    return result.rows[0].is_limited;
  };
}

/** Scheduled maintenance only; never call this from a customer request path. */
export async function cleanupExpiredRateLimitAttempts(): Promise<number> {
  const result = await query('delete from rate_limit_attempts where window_expires_at <= now()');
  return result.rowCount ?? 0;
}
