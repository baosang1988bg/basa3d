// ADR-0054 — Netlify Scheduled Function replacing the Vercel Cron entry in vercel.json.
// It does no work itself: it calls the existing Next.js route with the same
// `Authorization: Bearer ${CRON_SECRET}` header Vercel Cron sends, so the cleanup logic, its auth
// (src/lib/cron-auth.ts, fails closed) and its tests stay in one place.
// Keep `schedule` identical to vercel.json — tests/netlify-deploy.test.ts guards the drift.

export const config = { schedule: '0 19 * * *' };

const CRON_PATH = '/api/cron/cleanup-orphan-uploads';

/** Canonical origin first (same value the app uses), Netlify's own site URL as fallback. */
export function resolveCronTarget(env: Record<string, string | undefined>): string | null {
  const origin = env.NEXT_PUBLIC_SITE_URL?.trim() || env.URL?.trim();
  if (!origin) return null;
  try {
    return new URL(CRON_PATH, origin).toString();
  } catch {
    return null;
  }
}

export default async function cleanupOrphanUploads(): Promise<Response> {
  const target = resolveCronTarget(process.env);
  const secret = process.env.CRON_SECRET;
  if (!target || !secret) {
    console.error('[NETLIFY_CRON_MISCONFIGURED]', { hasTarget: Boolean(target), hasSecret: Boolean(secret) });
    return new Response(null, { status: 500 });
  }

  const response = await fetch(target, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25_000),
  });
  const body = await response.text();
  if (!response.ok) {
    console.error('[NETLIFY_CRON_FAILED]', response.status, body.slice(0, 500));
    return new Response(null, { status: 502 });
  }
  console.log('[NETLIFY_CRON_OK]', body.slice(0, 500));
  return new Response(null, { status: 200 });
}
