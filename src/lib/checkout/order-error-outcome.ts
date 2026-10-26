// What the checkout page does when POST /api/public/orders does not succeed.
//
// Only "ordering is switched off" (cart disabled → 404 NOT_FOUND, Phase 35 D5) may hand the customer
// over to a Zalo message instead. Every other failure — stock, validation, rate limit, 5xx, an
// unparseable body — means the order was NOT created and must be shown as an error, otherwise the
// customer can believe they ordered when nothing was saved.

export const ORDER_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_STOCK: 'Một sản phẩm trong giỏ hàng không còn đủ số lượng tồn kho. Vui lòng quay lại giỏ hàng và điều chỉnh số lượng.',
  VARIANT_NOT_FOUND: 'Một sản phẩm trong giỏ hàng không còn tồn tại. Vui lòng quay lại giỏ hàng và kiểm tra lại.',
};

export const GENERIC_ORDER_ERROR = 'Có lỗi xảy ra, vui lòng kiểm tra lại thông tin.';

export type OrderErrorOutcome = { kind: 'zalo-fallback' } | { kind: 'error'; message: string };

export function orderErrorOutcome(status: number, body: unknown): OrderErrorOutcome {
  const { code, message } = (typeof body === 'object' && body !== null ? body : {}) as { code?: unknown; message?: unknown };
  if (status === 404 && code === 'NOT_FOUND') return { kind: 'zalo-fallback' };
  if (typeof code === 'string' && ORDER_ERROR_MESSAGES[code]) return { kind: 'error', message: ORDER_ERROR_MESSAGES[code] };
  // Server messages are Vietnamese, customer-facing copy (e.g. RATE_LIMITED, validation errors).
  if (typeof message === 'string' && message.trim() && status < 500) return { kind: 'error', message };
  return { kind: 'error', message: GENERIC_ORDER_ERROR };
}
