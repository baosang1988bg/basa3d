import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { uploadUrlsRequestSchema } from '../../../../../domain/schemas';
import { createCustomRequestUploadTargets } from '../../../../../services/custom-request.service';
import { createDatabaseRateLimiter, getClientIp } from '../../../../../lib/rate-limit';

// Phase 33 S2 (§6.2, T7): the browser uploads files STRAIGHT to Supabase Storage (bypassing the
// 4.5MB Vercel function body limit). This route only mints signed upload tokens for server-chosen
// random paths. Anonymous, so it is rate-limited per IP (the customer has no phone number yet);
// one call covers up to 10 files.
const isRateLimited = createDatabaseRateLimiter({ scope: 'custom-request-upload-urls', maxRequests: 20, windowMs: 60 * 60_000 });

export async function POST(request: Request) {
  try {
    if (await isRateLimited(getClientIp(request.headers))) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã tải lên quá nhiều lần, vui lòng thử lại sau.' }, { status: 429 });
    }
    const input = uploadUrlsRequestSchema.parse(await request.json().catch(() => null));
    const uploads = await createCustomRequestUploadTargets(input.files);
    return NextResponse.json({ uploads }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
