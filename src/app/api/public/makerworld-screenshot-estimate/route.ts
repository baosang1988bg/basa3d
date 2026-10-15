import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { DomainError } from '@/lib/domain-error';
import { MakerWorldNotFoundError } from '@/lib/parsers/makerworld-resolver';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';
import { verifyUploadClaim } from '@/lib/upload-claim';
import { estimateMakerWorldScreenshot, isScreenshotEstimateEnabled } from '@/services/makerworld-screenshot-estimate.service';

// ADR-0039: link + screenshot in ONE request. The image was uploaded through the existing signed
// upload flow; the body carries only its private path + the HMAC upload claim (never image bytes,
// never numbers or prices). Vision calls cost money → 10/hour/IP here + a global hourly budget in
// the service.
export const maxDuration = 45;

const inputSchema = z.object({
  url: z.string().trim().min(5).max(2_000),
  attachmentPath: z.string().trim().min(1).max(500),
  uploadClaim: z.string().trim().min(1).max(1_000),
}).strict();

const isRateLimited = createDatabaseRateLimiter({ scope: 'makerworld-screenshot-estimate', maxRequests: 10, windowMs: 60 * 60_000 });
const NO_STORE = { 'cache-control': 'no-store' };

export async function POST(request: Request) {
  try {
    if (!isScreenshotEstimateEnabled()) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
    const input = inputSchema.parse(await request.json().catch(() => null));
    if (await isRateLimited(getClientIp(request.headers))) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã gửi ảnh quá nhiều lần, vui lòng thử lại sau.' }, { status: 429, headers: NO_STORE });
    }
    if (!verifyUploadClaim(input.attachmentPath, input.uploadClaim)) {
      throw new DomainError('INVALID_UPLOAD_CLAIM', 'Liên kết tải lên không hợp lệ hoặc đã hết hạn, vui lòng tải lại ảnh.', 403);
    }
    const estimate = await estimateMakerWorldScreenshot({ url: input.url, attachmentPath: input.attachmentPath });
    return NextResponse.json(estimate, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof MakerWorldNotFoundError) {
      return NextResponse.json({ code: 'INVALID_MAKERWORLD_URL', message: 'Link không hợp lệ — vui lòng dán link dạng https://makerworld.com/en/models/...' }, { status: 400, headers: NO_STORE });
    }
    return apiError(error);
  }
}
