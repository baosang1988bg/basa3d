import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyticsErrorCode,
  clipParam,
  getMakerWorldSourceHost,
  navKeyFromHref,
  sanitizeFreeText,
  sendGAEvent,
  toProductTypeFilter,
  toVndValue,
  trackAddToCart,
  trackBlogPost,
  trackFilterCategory,
  trackMakerWorldDownload,
  trackMakerWorldOrderClick,
  trackMakerWorldPreview3D,
  trackMakerWorldResolve,
  trackMenuOpen,
  trackNavigationClick,
  trackPolicy,
  trackPurchase,
  trackScreenTime,
  trackSearch,
  trackViewItem,
} from '../src/lib/analytics';

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

test('content helpers send the approved blog and policy parameters', () => {
  withMockWindow((dataLayer) => {
    trackBlogPost({ title: 'Chọn vật liệu', slug: 'chon-vat-lieu', category: 'Hướng dẫn' });
    trackPolicy('Chính sách bảo mật');
    assert.deepEqual(Array.from(dataLayer[0]), ['event', 'read_blog_post', { post_title: 'Chọn vật liệu', post_slug: 'chon-vat-lieu', category: 'Hướng dẫn' }]);
    assert.deepEqual(Array.from(dataLayer[1]), ['event', 'view_policy', { policy_name: 'Chính sách bảo mật' }]);
  });
});

function params(entry: IArguments): Record<string, unknown> {
  return Array.from(entry)[2] as Record<string, unknown>;
}

function withLocation(href: string, referrer: string, run: (dataLayer: IArguments[]) => void) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const browserWindow = { dataLayer: [] as IArguments[], location: { href, origin: new URL(href).origin } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { referrer } });
  try {
    run(browserWindow.dataLayer);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
}

test('screen_time sends only screen_time (no reserved user_engagement / engagement_time_msec)', () => {
  withMockWindow((dataLayer) => {
    trackScreenTime({ page_path: '/products', page_location: 'https://basa3d.vn/products', screen_time_msec: 15_200.4, page_title: 'Sản phẩm BaSa3D' });
    assert.equal(dataLayer.length, 1);
    assert.deepEqual(Array.from(dataLayer[0]), [
      'event',
      'screen_time',
      { page_path: '/products', page_location: 'https://basa3d.vn/products', screen_time_msec: 15_200, page_title: 'Sản phẩm BaSa3D' },
    ]);
    assert.ok(!dataLayer.some((entry) => Array.from(entry)[1] === 'user_engagement'));
    assert.ok(!('engagement_time_msec' in params(dataLayer[0])));
  });
});

test('screen_time keeps the PREVIOUS route as page_location even after the URL changed', () => {
  withLocation('https://basa3d.vn/cart', 'https://basa3d.vn/home', (dataLayer) => {
    trackScreenTime({ page_path: '/products', page_location: 'https://basa3d.vn/products', screen_time_msec: 3_000 });
    assert.equal(params(dataLayer[0]).page_location, 'https://basa3d.vn/products');
  });
});

test('screen_time strips bearer tokens from the reported path', () => {
  withMockWindow((dataLayer) => {
    trackScreenTime({ page_path: '/order-confirmation?token=secret&x=1', page_location: 'https://basa3d.vn/order-confirmation?token=secret', screen_time_msec: 2_000 });
    assert.equal(params(dataLayer[0]).page_path, '/order-confirmation?x=1');
    assert.equal(params(dataLayer[0]).page_location, 'https://basa3d.vn/order-confirmation');
  });
});

test('sanitizeFreeText redacts phones, e-mails and clips to 100 chars', () => {
  assert.equal(sanitizeFreeText('  Móc Khoá  '), 'móc khoá');
  assert.equal(sanitizeFreeText('gọi 0912 345 678 nhé'), 'gọi [number] nhé');
  assert.equal(sanitizeFreeText('+84912345678'), '[number]');
  assert.equal(sanitizeFreeText('a.b@example.com mẫu'), '[email] mẫu');
  assert.equal(sanitizeFreeText('in 3d 2025'), 'in 3d 2025');
  assert.equal(sanitizeFreeText('x'.repeat(250)).length, 100);
  assert.equal(clipParam('abc', 2), 'ab');
});

test('search sends a sanitized term and skips empty terms', () => {
  withMockWindow((dataLayer) => {
    trackSearch({ search_term: 'In 3D 0912345678', results_on_page: 5 });
    trackSearch({ search_term: '   ' });
    assert.equal(dataLayer.length, 1);
    assert.deepEqual(Array.from(dataLayer[0]), ['event', 'search', { search_term: 'in 3d [number]', results_on_page: 5 }]);
  });
});

test('filter_category whitelists product type and reports cleared category as all', () => {
  assert.equal(toProductTypeFilter('READY_STOCK'), 'READY_STOCK');
  assert.equal(toProductTypeFilter('<script>'), undefined);
  assert.equal(toProductTypeFilter(undefined), undefined);
  withMockWindow((dataLayer) => {
    trackFilterCategory({ category_id: 'cat-1', category_name: 'Trang trí', product_type: 'MADE_TO_ORDER', sort: 'price_asc' });
    trackFilterCategory({ category_id: 'all', sort: 'newest' });
    assert.deepEqual(params(dataLayer[0]), { category_id: 'cat-1', category_name: 'Trang trí', product_type: 'MADE_TO_ORDER', sort: 'price_asc' });
    assert.deepEqual(params(dataLayer[1]), { category_id: 'all', sort: 'newest' });
  });
});

test('navigation uses stable nav_key (no translated labels) and menu_open is separate', () => {
  assert.equal(navKeyFromHref('/home'), 'home');
  assert.equal(navKeyFromHref('/custom-print'), 'custom_print');
  assert.equal(navKeyFromHref('/products?categoryId=1'), 'products');
  assert.equal(navKeyFromHref('/'), 'home');
  withMockWindow((dataLayer) => {
    trackNavigationClick({ placement: 'header', nav_key: 'cart', target: '/cart' });
    trackNavigationClick({ placement: 'mobile_menu', nav_key: 'category', target: '/products?categoryId=c1', category_id: 'c1' });
    trackMenuOpen({ placement: 'mobile_menu' });
    assert.deepEqual(Array.from(dataLayer[0]), ['event', 'navigation_click', { placement: 'header', nav_key: 'cart', target: '/cart' }]);
    assert.deepEqual(params(dataLayer[1]), { placement: 'mobile_menu', nav_key: 'category', target: '/products?categoryId=c1', category_id: 'c1' });
    assert.deepEqual(Array.from(dataLayer[2]), ['event', 'menu_open', { placement: 'mobile_menu' }]);
    assert.ok(!dataLayer.some((entry) => 'label' in params(entry)));
  });
});

test('makerworld resolve never sends the raw pasted URL', () => {
  assert.equal(getMakerWorldSourceHost('https://makerworld.com.cn/zh/models/123?from=share&token=abc'), 'makerworld.com.cn');
  assert.equal(getMakerWorldSourceHost('www.makerworld.com/en/models/1'), 'makerworld.com');
  assert.equal(getMakerWorldSourceHost('https://evil-makerworld.com/x'), 'other');
  assert.equal(getMakerWorldSourceHost('gọi em 0912345678'), 'invalid');
  assert.equal(getMakerWorldSourceHost(''), 'invalid');
  withMockWindow((dataLayer) => {
    trackMakerWorldResolve({ success: true, source_host: 'makerworld.com.cn', model_id: '123' });
    trackMakerWorldResolve({ success: false, source_host: 'other', error_code: analyticsErrorCode(422) });
    assert.deepEqual(params(dataLayer[0]), { success: true, source_host: 'makerworld.com.cn', model_id: '123' });
    assert.deepEqual(params(dataLayer[1]), { success: false, source_host: 'other', error_code: 'http_422' });
    assert.ok(!JSON.stringify(dataLayer.map((entry) => Array.from(entry))).includes('token'));
  });
  assert.equal(analyticsErrorCode(), 'network');
});

test('makerworld download/preview/order carry outcome, method and integer VND', () => {
  assert.equal(toVndValue(150_000), 150_000);
  assert.equal(toVndValue(150_000.5), undefined);
  assert.equal(toVndValue(-1), undefined);
  assert.equal(toVndValue(null), undefined);
  withMockWindow((dataLayer) => {
    trackMakerWorldDownload({ model_id: '123', profile_id: 'p1', model_title: 'Mẫu test', method: 'direct', success: false, error_code: 'http_502' });
    trackMakerWorldDownload({ model_id: '123', method: 'external', success: true });
    trackMakerWorldPreview3D({ model_id: '123', profile_id: 'p1' });
    trackMakerWorldOrderClick({ model_id: '123', profile_id: 'p1', estimated_price_vnd: 150_000 });
    trackMakerWorldOrderClick({ model_id: '123', estimated_price_vnd: 99.9 });
    assert.deepEqual(params(dataLayer[0]), { model_id: '123', method: 'direct', success: false, profile_id: 'p1', model_title: 'Mẫu test', error_code: 'http_502' });
    assert.deepEqual(params(dataLayer[1]), { model_id: '123', method: 'external', success: true });
    assert.deepEqual(Array.from(dataLayer[2]), ['event', 'makerworld_preview_3d', { model_id: '123', profile_id: 'p1' }]);
    assert.deepEqual(params(dataLayer[3]), { model_id: '123', profile_id: 'p1', currency: 'VND', value: 150_000 });
    assert.deepEqual(params(dataLayer[4]), { model_id: '123' });
  });
});
