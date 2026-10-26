import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GENERIC_ORDER_ERROR, ORDER_ERROR_MESSAGES, orderErrorOutcome } from '../src/lib/checkout/order-error-outcome';

// Checkout must never present a failed order as a Zalo hand-off: only "ordering is switched off"
// (404 NOT_FOUND from POST /api/public/orders while the cart is disabled) may fall back to Zalo.

test('cart disabled (404 NOT_FOUND) falls back to the Zalo message', () => {
  assert.deepEqual(orderErrorOutcome(404, { code: 'NOT_FOUND', message: 'Not found.' }), { kind: 'zalo-fallback' });
});

test('a 404 without the NOT_FOUND code (e.g. a proxy page) is an error, not a fallback', () => {
  assert.equal(orderErrorOutcome(404, {}).kind, 'error');
  assert.equal(orderErrorOutcome(404, '<html>').kind, 'error');
});

test('known business errors keep their specific copy', () => {
  for (const code of Object.keys(ORDER_ERROR_MESSAGES)) {
    assert.deepEqual(orderErrorOutcome(409, { code, message: 'raw' }), { kind: 'error', message: ORDER_ERROR_MESSAGES[code] });
  }
});

test('rate limit / validation show the server message', () => {
  const message = 'Bạn đã đặt quá nhiều đơn trong thời gian ngắn, vui lòng thử lại sau ít phút.';
  assert.deepEqual(orderErrorOutcome(429, { code: 'RATE_LIMITED', message }), { kind: 'error', message });
  assert.deepEqual(orderErrorOutcome(400, { code: 'VALIDATION_ERROR', message: 'Số điện thoại không hợp lệ.' }), { kind: 'error', message: 'Số điện thoại không hợp lệ.' });
});

test('5xx, empty or unparseable bodies show the generic error (never internal messages, never Zalo)', () => {
  for (const [status, body] of [[500, { message: 'connect ECONNREFUSED' }], [502, {}], [503, null], [400, { message: '   ' }], [400, 'oops']] as const) {
    assert.deepEqual(orderErrorOutcome(status, body), { kind: 'error', message: GENERIC_ORDER_ERROR }, `${status} ${JSON.stringify(body)}`);
  }
});

test('checkout page routes API failures through orderErrorOutcome', () => {
  const page = readFileSync('src/app/[locale]/(storefront)/checkout/page.tsx', 'utf8');
  assert.match(page, /orderErrorOutcome\(response\.status, body\)/);
  assert.doesNotMatch(page, /const ERROR_MESSAGES/);
});
