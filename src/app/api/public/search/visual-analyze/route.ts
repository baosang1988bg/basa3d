import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';
import { analyzeImageForModelSearch, fallbackVisualResult, type VisualAnalysisResult } from '@/lib/search/visual-search';
import { readVisualSearchCache, visualSearchImageHash, writeVisualSearchCache } from '@/services/visual-search-cache.service';

// ADR-0062 §6. Public endpoint that spends the Gemini quota → DB rate limit, MIME allowlist and a body
// cap below Vercel's 4.5 MB request limit (the client downsizes to ≤1024 px JPEG, typically < 300 KB).
const VISUAL_ANALYZE_MAX_BASE64_CHARS = 4 * 1024 * 1024;
const MAX_BODY_BYTES = VISUAL_ANALYZE_MAX_BASE64_CHARS + 16 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const NO_STORE = { 'cache-control': 'no-store' };

const inputSchema = z.object({
  imageBase64: z.string().min(10).max(VISUAL_ANALYZE_MAX_BASE64_CHARS).optional(),
  mimeType: z.enum(ALLOWED_MIME).default('image/jpeg'),
  queryHint: z.string().trim().max(200).optional(),
}).strict();

const isRateLimited = createDatabaseRateLimiter({ scope: 'visual-analyze', maxRequests: 20, windowMs: 60 * 60_000 });

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ code: 'PAYLOAD_TOO_LARGE', message: 'Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn.' }, { status: 413, headers: NO_STORE });
    }

    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: 'INVALID_INPUT', message: 'Dữ liệu ảnh không hợp lệ (chỉ nhận JPEG/PNG/WebP, tối đa ~3 MB).' }, { status: 400, headers: NO_STORE });
    }

    const { imageBase64, mimeType, queryHint } = parsed.data;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // Without a key or an image there is nothing costly to protect: return the keyword fallback.
    if (!apiKey || !imageBase64) {
      return NextResponse.json({ data: fallbackVisualResult(queryHint) }, { headers: NO_STORE });
    }

    // Cache hit costs no Gemini call, so it is served before the rate limiter. Cache failures never block search.
    const hash = visualSearchImageHash(imageBase64);
    const cachedResult = await readVisualSearchCache<VisualAnalysisResult>(hash).catch(() => null);
    if (cachedResult) {
      return NextResponse.json({ data: { ...cachedResult, cached: true } }, { headers: NO_STORE });
    }

    if (await isRateLimited(getClientIp(request.headers))) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã tìm bằng ảnh quá nhiều lần, vui lòng thử lại sau.' }, { status: 429, headers: NO_STORE });
    }

    let result: VisualAnalysisResult | null = null;
    try {
      result = await analyzeImageForModelSearch(imageBase64, mimeType, { apiKey });
    } catch (aiErr) {
      console.warn('[VISUAL_SEARCH_AI_FAILED]', aiErr instanceof Error ? aiErr.name : typeof aiErr);
    }
    if (result?.aiUsed) {
      await writeVisualSearchCache(hash, result).catch((cacheErr: unknown) => {
        console.warn('[VISUAL_SEARCH_CACHE_WRITE_FAILED]', cacheErr instanceof Error ? cacheErr.name : typeof cacheErr);
      });
    }
    return NextResponse.json({ data: result ?? fallbackVisualResult(queryHint) }, { headers: NO_STORE });
  } catch (error) {
    return apiError(error);
  }
}
