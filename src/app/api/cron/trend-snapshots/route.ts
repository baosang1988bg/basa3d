import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { captureTrendSnapshots } from '@/services/trend-hunter.service';
import { pruneVisualSearchCache } from '@/services/visual-search-cache.service';

export const dynamic = 'force-dynamic';
// ADR-0063 U5: ≤40 items × ≤6s each, 3 at a time, inside a 45s budget.
export const maxDuration = 60;

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid Bearer token.' }, { status: 401 });
  }

  try {
    // Optional caps for hosts with shorter function limits (Netlify scheduled functions: 30s).
    const params = new URL(request.url).searchParams;
    const limit = clampInt(params.get('limit'), 1, 40, 40);
    const budgetMs = clampInt(params.get('budgetMs'), 5_000, 45_000, 45_000);
    const snapshots = await captureTrendSnapshots({ limit, budgetMs });
    const prunedVisualCache = await pruneVisualSearchCache();
    return NextResponse.json({ ...snapshots, prunedVisualCache }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[TREND_SNAPSHOT_CRON_FAILED]', { message });
    return NextResponse.json({ code: 'TREND_SNAPSHOT_CRON_FAILED', message: 'Snapshot run failed.' }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}
