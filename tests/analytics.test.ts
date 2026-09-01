import assert from 'node:assert/strict';
import test from 'node:test';
import { sendGAEvent, trackAddToCart, trackPurchase, trackViewItem } from '../src/lib/analytics';

function withMockWindow(run: (dataLayer: IArguments[]) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const browserWindow = { dataLayer: [] as IArguments[] };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });
  try {
    run(browserWindow.dataLayer);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('ecommerce helpers send integer VND amounts without cent conversion', () => {
  withMockWindow((dataLayer) => {
    trackViewItem({ item_id: 'SKU-1', item_name: 'Mẫu', price: 125_000 });
    trackAddToCart({ item_id: 'SKU-1', item_name: 'Mẫu', price: 125_000 }, 2);
    trackPurchase({ orderNumber: 'ORD-1', total: 260_000, shipping: 10_000, items: [{ item_id: 'SKU-1', item_name: 'Mẫu', price: 125_000, quantity: 2 }] });
    const calls = dataLayer.map((entry) => Array.from(entry));
    assert.equal(calls[0][1], 'view_item');
    assert.deepEqual(calls[0][2], { currency: 'VND', value: 125_000, items: [{ item_id: 'SKU-1', item_name: 'Mẫu', price: 125_000, quantity: 1 }] });
    assert.equal(calls[1][1], 'add_to_cart');
    assert.equal((calls[1][2] as Record<string, unknown>).value, 250_000);
    assert.equal(calls[2][1], 'purchase');
    assert.equal((calls[2][2] as Record<string, unknown>).currency, 'VND');
    assert.equal((calls[2][2] as Record<string, unknown>).value, 260_000);
    assert.equal((calls[2][2] as Record<string, unknown>).shipping, 10_000);
  });
});

test('sendGAEvent is an SSR-safe no-op without window', () => {
  assert.doesNotThrow(() => sendGAEvent('test_event', { test: true }));
});

test('sendGAEvent queues an event before gtag.js is available', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  try {
    assert.doesNotThrow(() => sendGAEvent('test_event', { test: true }));
    assert.equal(typeof window.gtag, 'undefined');
    assert.equal(window.dataLayer?.length, 1);
    assert.deepEqual(Array.from(window.dataLayer?.[0] ?? []), ['event', 'test_event', { test: true }]);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
