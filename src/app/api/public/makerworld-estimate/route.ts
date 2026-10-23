import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { MakerWorldNotFoundError } from '@/lib/parsers/makerworld-resolver';
import { estimateMakerWorldUrl, estimateMakerWorldWithSpec, requiresAutoResolver } from '@/services/makerworld-estimate.service';
import { isScreenshotEstimateEnabled } from '@/services/makerworld-screenshot-estimate.service';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';

// Phase B public estimate (makerworld-phase-b-storefront-estimate.md §3, ADR-0033).
// - Input is ONLY the link: no grams/minutes/material from the browser (B1 — otherwise a scraper
//   could solve for unit costs and margin).
// - Output is a public DTO without breakdowns/costs/config ids.
// - Abuse protection is a Vercel Firewall rate-limit rule on this path (docs/operations/deployment.md),
//   not a DB limiter (B5). The verified path only reads the DB; the resolver path is cached + budgeted.
// - "No pricing config" is a normal 200 with reason NO_PRICING_CONFIG so the customer can still send
//   a request (the prototype returned 503).
// specText (ADR-0034): the profile's spec line copied from MakerWorld ("7.4 h · 6 plates · 168 g"),
// used only when there is no verified/auto price. Parsed server-side; results rounded to 5.000đ.
const inputSchema = z.object({
  url: z.string().trim().min(5).max(2_000),
  specText: z.string().trim().min(3).max(2_000).optional(),
}).strict();
const isAutoRateLimited = createDatabaseRateLimiter({ scope: 'makerworld-estimate-auto', maxRequests: 5, windowMs: 10 * 60_000 });
const isLocalRateLimited = createDatabaseRateLimiter({ scope: 'makerworld-estimate-local', maxRequests: 60, windowMs: 10 * 60_000 });
const NO_STORE = { 'cache-control': 'no-store' };

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json().catch(() => null));
    const ip = getClientIp(request.headers);
    if (await isLocalRateLimited(ip)) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' }, { status: 429, headers: NO_STORE });
    }
    const usesAutoResolver = !input.specText && await requiresAutoResolver(input.url);
    if (usesAutoResolver && await isAutoRateLimited(ip)) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' }, { status: 429, headers: NO_STORE });
    }
    const estimate = input.specText
      ? await estimateMakerWorldWithSpec(input.url, input.specText)
      : await estimateMakerWorldUrl(input.url);
    return NextResponse.json({ ...estimate, screenshotAvailable: isScreenshotEstimateEnabled() }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof MakerWorldNotFoundError) {
      return NextResponse.json({ code: 'INVALID_MAKERWORLD_URL', message: 'Link không hợp lệ — vui lòng dán link dạng https://makerworld.com/... hoặc https://makerworld.com.cn/...' }, { status: 400 });
    }
    return apiError(error);
  }
}
