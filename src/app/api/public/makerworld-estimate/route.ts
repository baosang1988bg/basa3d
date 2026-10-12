import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { MakerWorldNotFoundError } from '@/lib/parsers/makerworld-resolver';
import { estimateMakerWorldUrl, estimateMakerWorldWithSpec } from '@/services/makerworld-estimate.service';

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

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json().catch(() => null));
    const estimate = input.specText
      ? await estimateMakerWorldWithSpec(input.url, input.specText)
      : await estimateMakerWorldUrl(input.url);
    return NextResponse.json(estimate, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof MakerWorldNotFoundError) {
      return NextResponse.json({ code: 'INVALID_MAKERWORLD_URL', message: 'Link không hợp lệ — vui lòng dán link dạng https://makerworld.com/en/models/...' }, { status: 400 });
    }
    return apiError(error);
  }
}
