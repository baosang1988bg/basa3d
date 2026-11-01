// Phase 54.1 (D4): Netlify Background Function (the `-background` suffix gives it a 15-minute limit
// and makes Netlify answer the caller with 202 immediately). Dispatched by `daily-3d-news.mts`.
// Its URL is public, so it authenticates exactly like the cron route (src/lib/cron-auth.ts, fails
// closed) before calling /api/cron/daily-3d-news — the business logic and its tests stay in one place.
import { isAuthorizedCronRequest } from '../../src/lib/cron-auth';

const CRON_PATH = '/api/cron/daily-3d-news';
const ROUTE_TIMEOUT_MS = 120_000;

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

export async function runDailyNewsBackground(
  request: Request,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), env.CRON_SECRET)) {
    console.warn('[NETLIFY_BG_DAILY_NEWS_UNAUTHORIZED]');
    return new Response(null, { status: 401 });
  }
  const target = resolveCronTarget(env);
  if (!target) {
    console.error('[NETLIFY_BG_DAILY_NEWS_MISCONFIGURED]');
    return new Response(null, { status: 500 });
  }

  try {
    const response = await fetchImpl(target, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
    });
    const body = await response.text();
    if (!response.ok) {
      console.error('[NETLIFY_BG_DAILY_NEWS_FAILED]', response.status, body.slice(0, 500));
      return new Response(null, { status: 502 });
    }
    console.log('[NETLIFY_BG_DAILY_NEWS_OK]', body.slice(0, 500));
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('[NETLIFY_BG_DAILY_NEWS_FAILED]', error instanceof Error ? error.message : error);
    return new Response(null, { status: 504 });
  }
}

export default async function dailyNewsBackground(request: Request): Promise<Response> {
  return runDailyNewsBackground(request, process.env);
}
