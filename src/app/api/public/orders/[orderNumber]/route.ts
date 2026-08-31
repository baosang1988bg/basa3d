import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { getPublicOrderByNumber } from '../../../../../services/order.service';

// Defense-in-depth only (phase-5.md Risks): orderNumber itself already has 48 bits of entropy
// (see createOrder), so brute-forcing it is impractical — this in-memory limiter is a cheap extra
// speed bump, not a real security boundary. It resets on every server restart/redeploy and isn't
// shared across serverless instances; that's an accepted MVP tradeoff, not a bug.
const attemptsByIp = new Map<string, number[]>();
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attemptsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  attemptsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' }, { status: 429 });
    }
    const { orderNumber } = await params;
    const order = await getPublicOrderByNumber(orderNumber);
    if (!order) return NextResponse.json({ code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng này.' }, { status: 404 });
    return NextResponse.json(order);
  } catch (error) {
    return apiError(error);
  }
}
