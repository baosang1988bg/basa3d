import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';
import { buildGoogle3dSearchUrl } from '@/lib/search/meta-engines';
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

interface VisualAnalysisResult {
  objectName: string;
  keywordsEn: string[];
  keywordsZh: string[];
  googleLensUrl: string;
  category: string;
  /** false when the response is the keyword fallback (no AI key, AI failed, or no image). */
  aiUsed: boolean;
  /** true when served from visual_search_cache (ADR-0063 U4). */
  cached?: boolean;
}

const aiOutputSchema = z.object({
  objectName: z.string().trim().max(80).optional(),
  keywordsEn: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  keywordsZh: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  category: z.string().trim().max(60).optional(),
});

function fallbackResult(queryHint?: string): VisualAnalysisResult {
  return {
    objectName: queryHint || '3D Printed Model',
    keywordsEn: [queryHint || '3d print articulated model', 'print in place toy', 'desk organizer stl'],
    keywordsZh: ['3D打印', '桌面好物'],
    googleLensUrl: buildGoogle3dSearchUrl(queryHint || '3d printed item'),
    category: 'Tổng hợp',
    aiUsed: false,
  };
}

const PROMPT = `Analyze this 3D-printed item or object. Extract concise search terms suitable for finding its 3D model (STL/3MF) on repositories like MakerWorld, Thingiverse, and Printables.
Return strictly valid JSON only:
{
  "objectName": "Short descriptive name (1-3 words in English)",
  "keywordsEn": ["specific keyword 1", "specific keyword 2", "specific keyword 3"],
  "keywordsZh": ["Chinese search keyword 1", "Chinese search keyword 2"],
  "category": "One of: Desk Organizer, Fidget Toy, Tool, Mechanical, Decor, Gadget"
}`;

async function analyzeWithGemini(apiKey: string, imageBase64: string, mimeType: string): Promise<VisualAnalysisResult | null> {
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z+.-]+;base64,/i, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      // Key in a header, not the query string, so it never lands in proxy/access logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: cleanBase64 } }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const geminiData = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;
    const parsed = aiOutputSchema.safeParse(JSON.parse(rawText));
    if (!parsed.success || !parsed.data.keywordsEn?.length) return null;
    const ai = parsed.data;
    const keywordsEn = ai.keywordsEn!.slice(0, 4);
    return {
      objectName: ai.objectName || keywordsEn[0],
      keywordsEn,
      keywordsZh: ai.keywordsZh?.slice(0, 3) ?? ['3D打印'],
      googleLensUrl: buildGoogle3dSearchUrl(ai.objectName || keywordsEn[0]),
      category: ai.category || 'Tổng hợp',
      aiUsed: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

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
      return NextResponse.json({ data: fallbackResult(queryHint) }, { headers: NO_STORE });
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
      result = await analyzeWithGemini(apiKey, imageBase64, mimeType);
    } catch (aiErr) {
      console.warn('[VISUAL_SEARCH_AI_FAILED]', aiErr instanceof Error ? aiErr.name : typeof aiErr);
    }
    if (result?.aiUsed) {
      await writeVisualSearchCache(hash, result).catch((cacheErr: unknown) => {
        console.warn('[VISUAL_SEARCH_CACHE_WRITE_FAILED]', cacheErr instanceof Error ? cacheErr.name : typeof cacheErr);
      });
    }
    return NextResponse.json({ data: result ?? fallbackResult(queryHint) }, { headers: NO_STORE });
  } catch (error) {
    return apiError(error);
  }
}
