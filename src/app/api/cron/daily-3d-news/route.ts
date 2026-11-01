import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { syncDaily3DNews } from '@/services/ai-news.service';

export const dynamic = 'force-dynamic';
// Phase 54.1 C3: RSS (≤10s) + Gemini total budget (50s, see ai-news.service) must fit in here.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Missing or invalid Bearer token.' }, { status: 401 });
  }

  try {
    const result = await syncDaily3DNews();
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const code = (error as { code?: string })?.code || 'DAILY_NEWS_CRON_FAILED';
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number })?.status || 500;
    console.error('[DAILY_NEWS_CRON_FAILED]', { code, message });
    return NextResponse.json({ code, message }, { status, headers: { 'cache-control': 'no-store' } });
  }
}
