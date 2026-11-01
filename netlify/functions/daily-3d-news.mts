// Phase 54 / 54.1 (D4): Daily AI 3D News Cron for Netlify.
// Scheduled daily at 23:00 UTC (06:00 AM UTC+7 Vietnam time).
// Netlify scheduled functions have a 30s execution limit, but RSS + Gemini can take ~60s. So this
// function does NOT wait for the work: it only fires `daily-3d-news-run-background` (15-minute
// limit, returns 202 immediately), which authenticates with CRON_SECRET and calls the Next route.
// Keep `schedule` identical to vercel.json — tests/netlify-deploy.test.ts guards the drift.

export const config = { schedule: '0 23 * * *' };

export const BACKGROUND_PATH = '/.netlify/functions/daily-3d-news-run-background';

/** Netlify's own site URL first (functions live on every Netlify domain), canonical URL as fallback. */
export function resolveBackgroundTarget(env: Record<string, string | undefined>): string | null {
  const origin = env.URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!origin) return null;
  try {
    return new URL(BACKGROUND_PATH, origin).toString();
  } catch {
    return null;
  }
}

export default async function daily3DNews(): Promise<Response> {
  const target = resolveBackgroundTarget(process.env);
  const secret = process.env.CRON_SECRET;
  if (!target || !secret) {
    console.error('[NETLIFY_CRON_DAILY_NEWS_MISCONFIGURED]', { hasTarget: Boolean(target), hasSecret: Boolean(secret) });
    return new Response(null, { status: 500 });
  }

  const response = await fetch(target, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 202 && !response.ok) {
    console.error('[NETLIFY_CRON_DAILY_NEWS_DISPATCH_FAILED]', response.status);
    return new Response(null, { status: 502 });
  }
  console.log('[NETLIFY_CRON_DAILY_NEWS_DISPATCHED]', response.status);
  return new Response(null, { status: 202 });
}
