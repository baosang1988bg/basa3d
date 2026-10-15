import { query } from './db';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

// Vercel overwrites x-real-ip / x-forwarded-for on the edge for direct traffic to prevent spoofing
// (https://vercel.com/docs/headers/request-headers), so they are the trusted client IP under this
// project's DNS-only deployment (docs/exec-plans/active/go-live-deployment-plan.md). Do not
// prefer cf-connecting-ip here — with no Cloudflare proxy in the request path, that header is
// fully attacker-controlled and lets a caller mint a fresh rate-limit key on every request.
//
// Phase 36 S4: the limiter key is the client's NETWORK, not its exact address. An IPv6 client
// normally controls a whole /64 (2^64 addresses) and could otherwise get a fresh bucket per request;
// IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is folded back to the IPv4 address.
export function getClientIp(requestHeaders: Headers): string {
  const raw = requestHeaders.get('x-real-ip')?.trim()
    || requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
    || '';
  return rateLimitNetworkKey(raw);
}

/**
 * Exported for tests. Returns `v4:<addr>`, `v6:<first 4 hextets>::/64`, `raw:<value>` for a header
 * that is not an IP at all (only possible off-Vercel, e.g. local/test servers — kept distinct so
 * tests can isolate buckets), or 'unknown' when no header is present.
 */
export function rateLimitNetworkKey(rawAddress: string): string {
  let address = rawAddress.trim();
  if (!address) return 'unknown';
  const original = address;
  if (address.startsWith('[')) address = address.slice(1, address.indexOf(']') > 0 ? address.indexOf(']') : undefined);
  address = address.split('%')[0]; // drop an IPv6 zone id
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (mapped) address = mapped[1];
  const family = isIP(address);
  if (family === 4) return `v4:${address}`;
  if (family === 6) return `v6:${expandIpv6(address).slice(0, 4).join(':')}::/64`;
  return `raw:${original.slice(0, 200)}`;
}

function expandIpv6(address: string): string[] {
  let text = address.toLowerCase();
  // Trailing embedded IPv4 (e.g. 64:ff9b::1.2.3.4) → two hextets.
  const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    text = `${text.slice(0, v4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.includes('::') ? text.split('::') : [text, undefined];
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = tail === undefined ? 0 : 8 - headParts.length - tailParts.length;
  return [...headParts, ...Array(missing).fill('0'), ...tailParts].map((part) => part.padStart(4, '0'));
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

const INCREMENT_SQL = `
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
  returning attempt_count`;

export function createDatabaseRateLimiter(input: { scope: string; maxRequests: number; windowMs: number }) {
  return async function isRateLimited(key: string): Promise<boolean> {
    const result = await query<{ attempt_count: number }>(INCREMENT_SQL, [input.scope, hashKey(key), input.windowMs]);
    return result.rows[0].attempt_count > input.maxRequests;
  };
}

/**
 * Phase 36 S4: a budget of FAILED guesses per protected resource (e.g. "last 4 phone digits of
 * order X"), independent of the caller's IP — so spreading a brute force over many IPs/IPv6
 * addresses gains nothing. Race-free: every attempt increments atomically BEFORE the secret is
 * compared (so N concurrent guesses consume N slots), and a correct answer refunds its slot, so
 * only wrong guesses accumulate and a real customer can revisit the page freely.
 */
export function createDatabaseFailureBudget(input: { scope: string; maxFailures: number; windowMs: number }) {
  return {
    /** Consumes one slot; returns false when the budget is already exhausted (caller must refuse). */
    async tryConsume(key: string): Promise<boolean> {
      const result = await query<{ attempt_count: number }>(INCREMENT_SQL, [input.scope, hashKey(key), input.windowMs]);
      return result.rows[0].attempt_count <= input.maxFailures;
    },
    /** Gives the slot back after a correct answer. */
    async refund(key: string): Promise<void> {
      await query(`
        with refunded as (
          update rate_limit_attempts set attempt_count = attempt_count - 1
          where scope = $1 and limiter_key = $2 and attempt_count > 1
          returning 1
        )
        delete from rate_limit_attempts
        where scope = $1 and limiter_key = $2 and attempt_count = 1 and not exists (select 1 from refunded)`,
      [input.scope, hashKey(key)]);
    },
  };
}

/** Scheduled maintenance only; never call this from a customer request path. */
export async function cleanupExpiredRateLimitAttempts(): Promise<number> {
  const result = await query('delete from rate_limit_attempts where window_expires_at <= now()');
  return result.rowCount ?? 0;
}
