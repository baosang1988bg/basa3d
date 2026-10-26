// Phase 51 (ADR-0054) — smoke test a deployed BaSa3D build (Netlify first, works for any host).
//
// Usage:
//   node scripts/deploy/smoke-netlify.mjs https://<site>.netlify.app
//   node scripts/deploy/smoke-netlify.mjs https://<site>.netlify.app --rate-limit
//   CRON_SECRET=... node scripts/deploy/smoke-netlify.mjs https://<site>.netlify.app --cron
//
// Read-only by default. Opt-in checks:
//   --rate-limit  sends up to 40 order lookups with a RANDOM spoofed x-real-ip / x-forwarded-for each
//                 time and expects a 429. If spoofing could mint fresh buckets, 429 never comes →
//                 FAIL. Side effect: your own IP is rate-limited on order lookup for ~60 s.
//   --cron        calls the cleanup route with CRON_SECRET and expects 200 (runs the real, idempotent
//                 daily cleanup once).
// Exit code 0 = all checks passed, 1 = at least one failed.
import process from 'node:process';
import console from 'node:console';
import { URL, pathToFileURL } from 'node:url';

const REQUIRED_HEADERS = {
  'x-content-type-options': (value) => value === 'nosniff',
  'x-frame-options': (value) => value === 'DENY',
  'referrer-policy': (value) => value === 'strict-origin-when-cross-origin',
  'content-security-policy-report-only': (value) => typeof value === 'string' && value.includes("frame-ancestors 'none'"),
};

/**
 * Pure: which security headers from next.config.mjs are missing or wrong.
 * @param {Record<string, string | null>} headers lower-case header name → value
 * @returns {string[]} failing header names
 */
export function failingSecurityHeaders(headers) {
  return Object.entries(REQUIRED_HEADERS)
    .filter(([name, isValid]) => !isValid(headers[name] ?? null))
    .map(([name]) => name);
}

/**
 * Pure: validate the /api/version payload.
 * @param {unknown} body
 * @returns {string | null} error message, or null when valid
 */
export function versionPayloadError(body) {
  if (!body || typeof body !== 'object') return 'not a JSON object';
  const { version, channel, commit } = /** @type {Record<string, unknown>} */ (body);
  if (typeof version !== 'string' || !version) return 'missing version';
  if (!['production', 'preview', 'development'].includes(/** @type {string} */ (channel))) return `unexpected channel ${String(channel)}`;
  if (typeof commit !== 'string' || commit === 'unknown') return 'commit is unknown (COMMIT_REF not picked up?)';
  return null;
}

/** @returns {string} a random documentation-range IPv4 (RFC 5737 TEST-NET-3) */
function randomSpoofIp() {
  return `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
}

/**
 * @param {string} baseUrl
 * @param {{ rateLimit: boolean, cron: boolean, cronSecret?: string }} options
 */
export async function runSmoke(baseUrl, { rateLimit, cron, cronSecret }) {
  const origin = new URL(baseUrl).origin;
  /** @type {{ name: string, ok: boolean, detail: string }[]} */
  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const get = (path, init) => globalThis.fetch(new URL(path, origin), { redirect: 'manual', ...init });

  // 1. Build identity
  try {
    const res = await get('/api/version');
    const body = res.ok ? await res.json() : null;
    const error = res.ok ? versionPayloadError(body) : `HTTP ${res.status}`;
    record('/api/version', !error, error ?? `${body.label} (${body.channel}, ${String(body.commit).slice(0, 7)})`);
  } catch (error) {
    record('/api/version', false, String(error));
  }

  // 2. Home page + security headers from next.config.mjs
  try {
    const res = await get('/');
    const headers = Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
    const reachable = res.status === 200 || (res.status >= 300 && res.status < 400);
    record('home page reachable', reachable, `HTTP ${res.status}`);
    const failing = failingSecurityHeaders(headers);
    record('security headers', failing.length === 0, failing.length ? `missing/wrong: ${failing.join(', ')}` : '');
  } catch (error) {
    record('home page reachable', false, String(error));
  }

  // 3. Cron route fails closed without the secret
  try {
    const res = await get('/api/cron/cleanup-orphan-uploads');
    record('cron route rejects anonymous calls', res.status === 401, `HTTP ${res.status}`);
  } catch (error) {
    record('cron route rejects anonymous calls', false, String(error));
  }

  // 4. (opt-in) cron with the real secret
  if (cron) {
    if (!cronSecret) {
      record('cron with CRON_SECRET', false, 'CRON_SECRET env var not set for this script');
    } else {
      const res = await get('/api/cron/cleanup-orphan-uploads', { headers: { authorization: `Bearer ${cronSecret}` } });
      record('cron with CRON_SECRET', res.status === 200, `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  }

  // 5. (opt-in) rate limit cannot be bypassed with spoofed client-IP headers
  if (rateLimit) {
    let limitedAt = 0;
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      const spoof = randomSpoofIp();
      const res = await get('/api/public/orders/SMOKE-0000?phoneSuffix=0000', {
        headers: { 'x-real-ip': spoof, 'x-forwarded-for': spoof },
      });
      await res.arrayBuffer();
      if (res.status === 429) { limitedAt = attempt; break; }
    }
    record(
      'rate limit ignores spoofed IP headers',
      limitedAt > 0,
      limitedAt ? `429 after ${limitedAt} requests` : 'no 429 in 40 requests — spoofed headers are trusted or limiter is off',
    );
  }

  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed against ${origin}`);
  return failed === 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const baseUrl = args.find((arg) => !arg.startsWith('--'));
  if (!baseUrl) {
    console.error('Usage: node scripts/deploy/smoke-netlify.mjs <https://site-url> [--rate-limit] [--cron]');
    process.exit(1);
  }
  const ok = await runSmoke(baseUrl, {
    rateLimit: args.includes('--rate-limit'),
    cron: args.includes('--cron'),
    cronSecret: process.env.CRON_SECRET,
  });
  process.exit(ok ? 0 : 1);
}
