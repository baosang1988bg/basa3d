// ADR-0063 U5 — Netlify Scheduled Function mirroring the `/api/cron/trend-snapshots` entry in vercel.json
// (Netlify is the frozen fallback host, ADR-0061; kept in parity so switching back needs no code change).
// Netlify scheduled functions stop at 30s, so the route is asked for a smaller batch (15 items / 20s budget);
// items not reached today are picked first tomorrow (oldest snapshot first).
// Keep `schedule` identical to vercel.json — tests/netlify-deploy.test.ts guards the drift.

export const config = { schedule: '30 3 * * *' };

const CRON_PATH = '/api/cron/trend-snapshots?limit=15&budgetMs=20000';

export function resolveCronTarget(env: Record<string, string | undefined>): string | null {
  const origin = env.NEXT_PUBLIC_SITE_URL?.trim() || env.URL?.trim();
  if (!origin) return null;
  try {
    return new URL(CRON_PATH, origin).toString();
  } catch {
    return null;
  }
}

export default async function trendSnapshots(): Promise<Response> {
  const target = resolveCronTarget(process.env);
  const secret = process.env.CRON_SECRET;
  if (!target || !secret) {
    console.error('[NETLIFY_CRON_MISCONFIGURED]', { hasTarget: Boolean(target), hasSecret: Boolean(secret) });
    return new Response(null, { status: 500 });
  }
  const response = await fetch(target, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(27_000) });
  const body = await response.text();
  if (!response.ok) {
    console.error('[NETLIFY_TREND_CRON_FAILED]', response.status, body.slice(0, 500));
    return new Response(null, { status: 502 });
  }
  console.log('[NETLIFY_TREND_CRON_OK]', body.slice(0, 500));
  return new Response(null, { status: 200 });
}
