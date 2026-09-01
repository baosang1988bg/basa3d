import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { uploadCustomRequestAttachment } from '../../../../../services/custom-request.service';
import { createInMemoryRateLimiter } from '../../../../../lib/rate-limit';

// Same in-memory best-effort per-IP limiter as GET /api/public/orders/[orderNumber] (phase-5.md
// Risks) — resets on redeploy, not shared across instances, accepted MVP tradeoff. This endpoint
// writes to Storage rather than the DB, so the limit is intentionally tighter (phase-6.md decision
// #1): the customer has no phone number yet at upload time (that only exists once the
// custom-request itself is submitted), so IP is the only thing to rate-limit on here.
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60_000;
const isRateLimited = createInMemoryRateLimiter({ maxRequests: RATE_LIMIT_MAX_REQUESTS, windowMs: RATE_LIMIT_WINDOW_MS });

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã tải lên quá nhiều lần, vui lòng thử lại sau.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    // `instanceof Blob`, not `File` — the global `File` constructor isn't guaranteed to exist in
    // every Node runtime this route can run under, and undici's multipart parser always returns a
    // File-like Blob with a `name` property regardless (same reasoning as uploadProductImageAction).
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ code: 'FILE_REQUIRED', message: 'Vui lòng chọn một file.' }, { status: 400 });
    }
    const fileName = 'name' in file && typeof file.name === 'string' ? file.name : '';

    const result = await uploadCustomRequestAttachment({ file, fileName });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
