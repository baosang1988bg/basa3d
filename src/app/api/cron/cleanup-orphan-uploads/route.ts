import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { cleanupOrphanUploads } from '@/services/orphan-upload-cleanup.service';

// Phase 33 S2: daily Vercel Cron (vercel.json). Vercel sends `Authorization: Bearer ${CRON_SECRET}`.
// Anything else — including a missing CRON_SECRET on the server — gets 401 before any work runs.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const result = await cleanupOrphanUploads();
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('[ORPHAN_UPLOAD_CLEANUP_FAILED]', error instanceof Error ? error.message : error);
    return NextResponse.json({ code: 'CLEANUP_FAILED' }, { status: 500 });
  }
}
