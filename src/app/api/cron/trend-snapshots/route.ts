import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { captureTrendSnapshots } from '@/services/trend-hunter.service';
import { pruneVisualSearchCache } from '@/services/visual-search-cache.service';

export const dynamic = 'force-dynamic';
// ADR-0063 U5: ≤40 items × ≤6s each, 3 at a time, inside a 45s budget.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid Bearer token.' }, { status: 401 });
  }

  try {
    const snapshots = await captureTrendSnapshots();
    const prunedVisualCache = await pruneVisualSearchCache();
    return NextResponse.json({ ...snapshots, prunedVisualCache }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[TREND_SNAPSHOT_CRON_FAILED]', { message });
    return NextResponse.json({ code: 'TREND_SNAPSHOT_CRON_FAILED', message: 'Snapshot run failed.' }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}
