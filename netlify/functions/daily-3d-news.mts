// Phase 54: Daily AI 3D News Cron for Netlify.
// Scheduled daily at 23:00 UTC (06:00 AM UTC+7 Vietnam time).
// Triggers /api/cron/daily-3d-news with `Authorization: Bearer ${CRON_SECRET}`.

export const config = { schedule: '0 23 * * *' };

const CRON_PATH = '/api/cron/daily-3d-news';

export function resolveCronTarget(env: Record<string, string | undefined>): string | null {
  const origin = env.NEXT_PUBLIC_SITE_URL?.trim() || env.URL?.trim();
  if (!origin) return null;
  try {
    return new URL(CRON_PATH, origin).toString();
  } catch {
    return null;
  }
}

export default async function daily3DNews(): Promise<Response> {
  const target = resolveCronTarget(process.env);
  const secret = process.env.CRON_SECRET;
  if (!target || !secret) {
    console.error('[NETLIFY_CRON_DAILY_NEWS_MISCONFIGURED]', { hasTarget: Boolean(target), hasSecret: Boolean(secret) });
    return new Response(null, { status: 500 });
  }

  const response = await fetch(target, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  if (!response.ok) {
    console.error('[NETLIFY_CRON_DAILY_NEWS_FAILED]', response.status, body.slice(0, 500));
    return new Response(null, { status: 502 });
  }
  console.log('[NETLIFY_CRON_DAILY_NEWS_OK]', body.slice(0, 500));
  return new Response(null, { status: 200 });
}
