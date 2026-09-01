import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { getPublicOrderByNumber } from '../../../../../services/order.service';
import { createDatabaseRateLimiter } from '../../../../../lib/rate-limit';

const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const isRateLimited = createDatabaseRateLimiter({ scope: 'public-order-lookup', maxRequests: RATE_LIMIT_MAX_REQUESTS, windowMs: RATE_LIMIT_WINDOW_MS });

export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (await isRateLimited(ip)) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' }, { status: 429 });
    }
    const { orderNumber } = await params;
    const phoneSuffix = new URL(request.url).searchParams.get('phoneSuffix') ?? '';
    if (!/^\d{4}$/.test(phoneSuffix)) {
      return NextResponse.json({ code: 'PHONE_VERIFICATION_REQUIRED', message: 'Vui lòng nhập 4 số cuối số điện thoại nhận hàng.' }, { status: 400 });
    }
    const order = await getPublicOrderByNumber(orderNumber, phoneSuffix);
    if (!order) return NextResponse.json({ code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng này.' }, { status: 404 });
    return NextResponse.json(order);
  } catch (error) {
    return apiError(error);
  }
}
