import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { query } from '../../../../lib/db';
import { publicBaoGiaRequestSchema, publicCustomRequestInputSchema } from '../../../../domain/schemas';
import { isBaoGiaEnabled } from '../../../../config/bao-gia';
import { describeBaoGiaRequest, prepareCustomRequestItems } from '../../../../services/custom-request-items.service';
import { loadPricingContext } from '../../../../services/instant-estimate.service';
import { createCustomRequest, inspectUploadedObject, type CustomRequestMakerWorldSnapshot } from '../../../../services/custom-request.service';
import { referencePriceFor } from '../../../../services/makerworld-estimate.service';
import { loadScreenshotSubmission } from '../../../../services/makerworld-screenshot-estimate.service';
import { parseMakerWorldUrl } from '../../../../lib/parsers/makerworld-resolver';
import { parseMakerWorldDescription } from '../../../../lib/parsers/makerworld-description';
import { estimateAttachment } from '../../../../services/file-estimate.service';
import type { CustomRequestQuoteEstimateSnapshot } from '../../../../services/custom-request.service';
import { createDatabaseRateLimiter, getClientIp } from '../../../../lib/rate-limit';
import { verifyUploadClaim } from '../../../../lib/upload-claim';
import { DomainError } from '../../../../lib/domain-error';

// MVP spam defense (phase-4.md Risks section) — honeypot + phone-based rate limiting only.
// No CAPTCHA in Phase 4; revisit with Cloudflare Turnstile (or similar) if spam becomes a real
// problem post-launch, per phase-4.md Non-goals.
const RATE_LIMIT_MAX_SUBMISSIONS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const isIpRateLimited = createDatabaseRateLimiter({ scope: 'public-custom-request-create', maxRequests: 15, windowMs: 15 * 60_000 });
const NO_STORE = { 'cache-control': 'no-store' };

function requireUploadClaim(path: string, claim: string): void {
  if (!verifyUploadClaim(path, claim)) {
    throw new DomainError('INVALID_UPLOAD_CLAIM', 'Liên kết tải lên không hợp lệ hoặc đã hết hạn, vui lòng tải lại file.', 403);
  }
}

function honeypotResponse() {
  // Bot filled the hidden field. Return a real-looking 201 without inserting anything or
  // revealing to the bot that it was detected.
  return NextResponse.json({ id: randomUUID(), requestNumber: `CR-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}` }, { status: 201 });
}

/** Rate limit: max 3 submissions per phone number per 10-minute window. */
async function isPhoneRateLimited(phone: string): Promise<boolean> {
  const recentCount = await query<{ count: string }>(
    `select count(*) from custom_requests where customer_phone = $1 and created_at > now() - interval '${RATE_LIMIT_WINDOW_MINUTES} minutes'`,
    [phone],
  );
  return Number(recentCount.rows[0].count) >= RATE_LIMIT_MAX_SUBMISSIONS;
}

const RATE_LIMITED_BODY = { code: 'RATE_LIMITED', message: 'Bạn đã gửi yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút.' };

/** Phase 33 S5 (§6.3): /bao-gia — N items, each re-checked and re-priced on the server. */
async function postBaoGiaRequest(body: unknown) {
  if (!isBaoGiaEnabled()) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  const input = publicBaoGiaRequestSchema.parse(body);
  if (await isPhoneRateLimited(input.customerPhone)) return NextResponse.json(RATE_LIMITED_BODY, { status: 429, headers: NO_STORE });
  for (const item of input.items) requireUploadClaim(item.attachmentPath, item.uploadClaim);
  const items = await prepareCustomRequestItems(input.items, await loadPricingContext());
  const materials = [...new Set(items.map((item) => item.materialType))].join(', ');
  const created = await createCustomRequest({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    description: describeBaoGiaRequest(input.items, input.description),
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    requestedMaterial: materials.slice(0, 100) || null,
    requestedColor: null,
    requestedSize: null,
    // T4: no denormalised "item #1" — the items table is the only place the files live.
    attachmentPath: null,
    items,
    copyrightConfirmed: input.copyrightConfirmed,
    tosVersion: input.tosVersion,
    sourceChannel: 'WEBSITE',
  }, null);
  return NextResponse.json(created, { status: 201 });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (body && typeof body === 'object' && 'honeypot' in body && typeof body.honeypot === 'string' && body.honeypot.trim()) return honeypotResponse();
    if (await isIpRateLimited(getClientIp(request.headers))) return NextResponse.json(RATE_LIMITED_BODY, { status: 429, headers: NO_STORE });
    // The two shapes are mutually exclusive strict schemas; `items` selects the /bao-gia branch.
    if (body && typeof body === 'object' && 'items' in body) return await postBaoGiaRequest(body);
    const input = publicCustomRequestInputSchema.parse(body);

    if (await isPhoneRateLimited(input.customerPhone)) return NextResponse.json(RATE_LIMITED_BODY, { status: 429, headers: NO_STORE });

    // Phase 33 S2 (§6.3 step 2): files now go straight to Storage via signed URLs, so a path in the
    // body proves nothing. Confirm the object exists, is within MAX_UPLOAD_BYTES and its magic bytes
    // match the extension before it is attached to a request (400 otherwise).
    if (input.attachmentPath && input.uploadClaim) {
      requireUploadClaim(input.attachmentPath, input.uploadClaim);
      await inspectUploadedObject(input.attachmentPath);
    }

    // Phase B: the reference price the customer saw is recomputed here, never taken from the browser.
    let makerworldSnapshot: CustomRequestMakerWorldSnapshot | null = null;
    // ADR-0039: screenshot estimate — snapshot + image path come from the stored row, never the body.
    let attachmentPath = input.attachmentPath ?? null;
    let screenshotEstimateId: string | null = null;
    if (input.makerworld?.screenshotEstimateId && input.makerworld.profileKey) {
      if (input.attachmentPath) throw new DomainError('ATTACHMENT_NOT_ALLOWED', 'Yêu cầu từ ảnh chụp MakerWorld không kèm thêm file.', 400);
      const submission = await loadScreenshotSubmission({
        screenshotEstimateId: input.makerworld.screenshotEstimateId,
        sourceUrl: input.makerworld.sourceUrl,
        profileKey: input.makerworld.profileKey,
        tier: input.makerworld.tier,
      });
      makerworldSnapshot = submission.snapshot;
      attachmentPath = submission.attachmentPath;
      screenshotEstimateId = submission.screenshotEstimateId;
    } else if (input.makerworld) {
      const { modelId } = parseMakerWorldUrl(input.makerworld.sourceUrl);
      const reference = await referencePriceFor(input.makerworld.sourceUrl, input.makerworld.profileId, input.makerworld.tier, input.makerworld.specText);
      const descParsed = parseMakerWorldDescription(input.description);
      const specLine = input.makerworld.specText || (descParsed.printTimeText ? `${descParsed.printTimeText} · ${descParsed.weightText ?? ''} · ${descParsed.platesText ?? ''} · ${descParsed.printerTarget ?? ''} · ${descParsed.amsText ?? ''}`.trim() : undefined);
      makerworldSnapshot = {
        sourceUrl: input.makerworld.sourceUrl,
        modelId,
        profileId: input.makerworld.profileId ?? descParsed.profileId,
        modelTitle: reference.modelTitle ?? descParsed.modelTitle,
        profileTitle: reference.profileTitle ?? descParsed.profileTitle,
        tier: input.makerworld.tier,
        profileConfirmed: true,
        estimateSource: reference.source !== 'NONE' ? reference.source : (descParsed.estimatedPriceVnd ? 'AUTO' : 'NONE'),
        estimatedPriceVnd: reference.priceVnd ?? descParsed.estimatedPriceVnd,
        estimatedAt: new Date().toISOString(),
        ...(specLine ? { specText: specLine } : {}),
      };
    }

    // ADR-0034: the file estimate the customer saw, recomputed from the stored attachment. A failure
    // here never blocks the request — staff just quote it without the automatic number.
    let quoteEstimateSnapshot: CustomRequestQuoteEstimateSnapshot | null = null;
    if (input.fileEstimateOption && input.attachmentPath) {
      try {
        const result = await estimateAttachment(input.attachmentPath, input.requestedMaterial ?? null, { printerTarget: input.printerTarget ?? null });
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

    const descParsed = parseMakerWorldDescription(input.description);

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
      requestedMaterial: input.requestedMaterial ?? (descParsed.isMakerWorld ? descParsed.material : null),
      requestedColor: input.requestedColor ?? (descParsed.isMakerWorld ? (descParsed.requestedColor ?? (descParsed.fileColors ? `${descParsed.fileColors} (theo file)` : null)) : null),
      requestedSize: input.requestedSize,
      attachmentPath,
      makerworldSnapshot,
      screenshotEstimateId,
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
