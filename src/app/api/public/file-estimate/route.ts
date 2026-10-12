import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';
import { estimateAttachment } from '@/services/file-estimate.service';

// Option 2 (ADR-0034): price an attachment the customer just uploaded, before any contact details.
// Input is the private storage path returned by /api/public/custom-requests/attachments (itself
// rate-limited to 10 uploads/hour/IP) — never a URL or raw numbers. Per-IP limit mirrors the
// tool-price-estimate precedent; parsing is bounded (20MB file, 3M triangles).
const isRateLimited = createDatabaseRateLimiter({ scope: 'file-estimate', maxRequests: 30, windowMs: 60 * 60_000 });

const inputSchema = z.object({
  attachmentPath: z.string().trim().min(1).max(500),
  materialType: z.string().trim().max(20).nullable().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    if (await isRateLimited(getClientIp(request.headers))) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã yêu cầu báo giá quá nhiều lần, vui lòng thử lại sau.' }, { status: 429 });
    }
    const input = inputSchema.parse(await request.json().catch(() => null));
    const result = await estimateAttachment(input.attachmentPath, input.materialType);
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
