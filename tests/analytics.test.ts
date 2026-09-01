import assert from 'node:assert/strict';
import test from 'node:test';
import { sendGAEvent, trackAddToCart, trackPurchase, trackViewItem } from '../src/lib/analytics';

type Call = [string, string, Record<string, unknown>];

function withMockWindow(run: (calls: Call[]) => void) {
  const calls: Call[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { gtag: (...args: Call) => calls.push(args) } });
  try { run(calls); } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('ecommerce helpers send integer VND amounts without cent conversion', () => {
  withMockWindow((calls) => {
    trackViewItem({ item_id: 'SKU-1', item_name: 'Mẫu', price: 125_000 });
    trackAddToCart({ item_id: 'SKU-1', item_name: 'Mẫu', price: 125_000 }, 2);
    trackPurchase({ orderNumber: 'ORD-1', total: 260_000, shipping: 10_000, items: [{ item_id: 'SKU-1', item_name: 'Mẫu', price: 125_000, quantity: 2 }] });
    assert.equal(calls[0][1], 'view_item');
    assert.deepEqual(calls[0][2], { currency: 'VND', value: 125_000, items: [{ item_id: 'SKU-1', item_name: 'Mẫu', price: 125_000, quantity: 1 }] });
    assert.equal(calls[1][1], 'add_to_cart');
    assert.equal(calls[1][2].value, 250_000);
    assert.equal(calls[2][1], 'purchase');
    assert.equal(calls[2][2].currency, 'VND');
    assert.equal(calls[2][2].value, 260_000);
    assert.equal(calls[2][2].shipping, 10_000);
  });
});

test('sendGAEvent is a silent no-op when gtag is unavailable', () => {
  assert.doesNotThrow(() => sendGAEvent('test_event', { test: true }));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  try { assert.doesNotThrow(() => sendGAEvent('test_event', { test: true })); } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
