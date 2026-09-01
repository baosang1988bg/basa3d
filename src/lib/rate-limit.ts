import { withTransaction } from './db';
import { createHash } from 'node:crypto';

export function createDatabaseRateLimiter(input: { scope: string; maxRequests: number; windowMs: number }) {
  return async function isRateLimited(key: string): Promise<boolean> {
    const storedKey = createHash('sha256').update(key).digest('hex');
    return withTransaction(async (client) => {
      await client.query('delete from rate_limit_attempts where window_expires_at <= now()');
      const result = await client.query<{ attempt_count: number }>(`
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
        returning attempt_count`, [input.scope, storedKey, input.windowMs]);
      return result.rows[0].attempt_count > input.maxRequests;
    });
  };
}
