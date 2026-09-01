import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { query } from '../../../../lib/db';
import { publicCheckoutOrderInputSchema } from '../../../../domain/schemas';
import { createOrder } from '../../../../services/order.service';
import { createOrderConfirmationToken } from '../../../../lib/order-confirmation-token';

// MVP spam defense (phase-5.md Risks section) — honeypot + phone-based rate limiting only, same
// pattern as POST /api/public/custom-requests (Phase 4). Threshold is looser than that route's
// 3/10min because a real customer may legitimately re-submit a few times while fixing their cart.
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 30;

export async function POST(request: Request) {
  try {
    const input = publicCheckoutOrderInputSchema.parse(await request.json());

    if (input.honeypot) {
      // Bot filled the hidden field. Return a real-looking 201 without inserting anything or
      // revealing to the bot that it was detected.
      return NextResponse.json({ id: randomUUID(), orderNumber: `ORD-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, total: 0 }, { status: 201 });
    }

    const recentCount = await query<{ count: string }>(
      `select count(*) from orders where customer_phone = $1 and created_at > now() - interval '${RATE_LIMIT_WINDOW_MINUTES} minutes'`,
      [input.customerPhone],
    );
    if (Number(recentCount.rows[0].count) >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã đặt quá nhiều đơn trong thời gian ngắn, vui lòng thử lại sau ít phút.' }, { status: 429 });
    }

    // Payment method has no dedicated DB column (phase-5.md decision #4 — no new column for a
    // reference-only field) — folded into customer_note as a plain line admin reads when
    // reconciling payment by hand.
    const paymentMethodLabel = input.paymentMethod === 'BANK_TRANSFER' ? 'Thanh toán: Chuyển khoản ngân hàng' : 'Thanh toán: COD (thanh toán khi nhận hàng)';
    const customerNote = [paymentMethodLabel, input.customerNote].filter(Boolean).join('\n');

    // Explicit allowlist into createOrder — shippingFee/discount/codFee are never forwarded from
    // client input here (publicCheckoutOrderInputSchema doesn't even have those fields), so
    // createOrder computes total from subtotal alone, i.e. shippingFee/discount/codFee = 0.
    const created = await createOrder({
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      shippingAddress: input.shippingAddress,
      customerNote,
      items: input.items,
    }, null);
    return NextResponse.json({ ...created, confirmationToken: createOrderConfirmationToken(created.id) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
