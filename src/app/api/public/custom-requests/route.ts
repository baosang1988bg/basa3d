import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { query } from '../../../../lib/db';
import { publicCustomRequestInputSchema } from '../../../../domain/schemas';
import { createCustomRequest, type CustomRequestMakerWorldSnapshot } from '../../../../services/custom-request.service';
import { referencePriceFor } from '../../../../services/makerworld-estimate.service';
import { parseMakerWorldUrl } from '../../../../lib/parsers/makerworld-resolver';
import { estimateAttachment } from '../../../../services/file-estimate.service';
import type { CustomRequestQuoteEstimateSnapshot } from '../../../../services/custom-request.service';

// MVP spam defense (phase-4.md Risks section) — honeypot + phone-based rate limiting only.
// No CAPTCHA in Phase 4; revisit with Cloudflare Turnstile (or similar) if spam becomes a real
// problem post-launch, per phase-4.md Non-goals.
const RATE_LIMIT_MAX_SUBMISSIONS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 10;

export async function POST(request: Request) {
  try {
    const input = publicCustomRequestInputSchema.parse(await request.json());

    if (input.honeypot) {
      // Bot filled the hidden field. Return a real-looking 201 without inserting anything or
      // revealing to the bot that it was detected.
      return NextResponse.json({ id: randomUUID(), requestNumber: `CR-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}` }, { status: 201 });
    }

    // Rate limit: max 3 submissions per phone number per 10-minute window.
    const recentCount = await query<{ count: string }>(
      `select count(*) from custom_requests where customer_phone = $1 and created_at > now() - interval '${RATE_LIMIT_WINDOW_MINUTES} minutes'`,
      [input.customerPhone],
    );
    if (Number(recentCount.rows[0].count) >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã gửi yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút.' }, { status: 429 });
    }

    // Phase B: the reference price the customer saw is recomputed here, never taken from the browser.
    let makerworldSnapshot: CustomRequestMakerWorldSnapshot | null = null;
    if (input.makerworld) {
      const { modelId } = parseMakerWorldUrl(input.makerworld.sourceUrl);
      const reference = await referencePriceFor(input.makerworld.sourceUrl, input.makerworld.profileId, input.makerworld.tier, input.makerworld.specText);
      makerworldSnapshot = {
        sourceUrl: input.makerworld.sourceUrl,
        modelId,
        profileId: input.makerworld.profileId,
        modelTitle: reference.modelTitle,
        profileTitle: reference.profileTitle,
        tier: input.makerworld.tier,
        profileConfirmed: true,
        estimateSource: reference.source,
        estimatedPriceVnd: reference.priceVnd,
        estimatedAt: new Date().toISOString(),
        ...(input.makerworld.specText ? { specText: input.makerworld.specText } : {}),
      };
    }

    // ADR-0034: the file estimate the customer saw, recomputed from the stored attachment. A failure
    // here never blocks the request — staff just quote it without the automatic number.
    let quoteEstimateSnapshot: CustomRequestQuoteEstimateSnapshot | null = null;
    if (input.fileEstimateOption && input.attachmentPath) {
      try {
        const result = await estimateAttachment(input.attachmentPath, input.requestedMaterial ?? null);
        const option = result.estimate?.options.find((o) => o.key === input.fileEstimateOption);
        if (result.estimate && (result.estimate.kind === 'SLICED' || result.estimate.kind === 'MESH') && option) {
          quoteEstimateSnapshot = {
            kind: result.estimate.kind, option: option.key, priceVnd: option.priceVnd,
            minVnd: option.minVnd ?? null, maxVnd: option.maxVnd ?? null,
            materialType: result.estimate.materialType, specs: result.estimate.specs, estimatedAt: new Date().toISOString(),
          };
        }
      } catch (error) {
        console.warn('[FILE_ESTIMATE_AT_SUBMIT_FAILED]', error instanceof Error ? error.message : error);
      }
    }

    // sourceChannel is never client-settable here — always hardcoded server-side, same
    // defense-in-depth pattern as the Phase 3 fix that forced status: 'ACTIVE' in GET /api/products.
    // Explicit allowlist (rather than spreading `input`) so honeypot never reaches the service
    // layer / audit log.
    const created = await createCustomRequest({
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      description: input.description,
      quantity: input.quantity,
      requestedMaterial: input.requestedMaterial,
      requestedColor: input.requestedColor,
      requestedSize: input.requestedSize,
      attachmentPath: input.attachmentPath,
      makerworldSnapshot,
      quoteEstimateSnapshot,
      // Phase 29 consent record — validated above (z.literal(true)) but previously never forwarded,
      // so copyright_confirmed/tos_version were stored as false/null for every public request.
      copyrightConfirmed: input.copyrightConfirmed,
      tosVersion: input.tosVersion,
      sourceChannel: 'WEBSITE',
    }, null);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
