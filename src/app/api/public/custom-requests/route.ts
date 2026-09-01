import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { query } from '../../../../lib/db';
import { publicCustomRequestInputSchema } from '../../../../domain/schemas';
import { createCustomRequest } from '../../../../services/custom-request.service';

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
      sourceChannel: 'WEBSITE',
    }, null);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
