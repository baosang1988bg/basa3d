import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildZaloConsultMessage } from '../src/lib/zalo-consult.js';

const root = process.cwd();

test('buildZaloConsultMessage formats structured specs, range price, and filters empty specs', () => {
  const message = buildZaloConsultMessage({
    source: 'tool',
    title: 'Móc khóa chữ "BASA"',
    specs: [
      { label: 'Màu sắc', value: 'Đen / Trắng' },
      { label: 'Bỏ qua rỗng', value: '' },
      { label: 'Bỏ qua null', value: null },
    ],
    estimatedPriceVnd: { min: 25000, max: 35000 },
    referenceUrl: 'https://basa3d.vn/tools/keychain-generator',
    note: 'Làm 2 cái',
  });

  assert.match(message, /Công cụ thiết kế 3D/);
  assert.match(message, /Móc khóa chữ "BASA"/);
  assert.match(message, /• Màu sắc: Đen \/ Trắng/);
  assert.doesNotMatch(message, /Bỏ qua/);
  assert.match(message, /25[.,]000đ – 35[.,]000đ/);
  assert.match(message, /https:\/\/basa3d\.vn\/tools\/keychain-generator/);
  assert.match(message, /Làm 2 cái/);
});

test('public e-commerce routes and modules are removed in showcase-only mode', () => {
  const removedPaths = [
    'src/app/[locale]/(storefront)/cart/page.tsx',
    'src/app/[locale]/(storefront)/checkout/page.tsx',
    'src/app/[locale]/(storefront)/order-confirmation/[orderNumber]/page.tsx',
    'src/app/[locale]/(storefront)/shipping-policy/page.tsx',
    'src/app/[locale]/(storefront)/return-policy/page.tsx',
    'src/app/api/public/orders/route.ts',
    'src/lib/cart/cart-context.tsx',
    'src/lib/vietqr.ts',
  ];
  for (const rel of removedPaths) {
    assert.equal(existsSync(path.join(root, rel)), false, `${rel} should be removed`);
  }
});

test('middleware blocks /admin with 404, routes /basaadmin, and robots.ts does not leak admin path', () => {
  const middleware = readFileSync(path.join(root, 'src/middleware.ts'), 'utf8');
  assert.match(middleware, /pathname === '\/admin'/);
  assert.match(middleware, /status:\s*404/);
  assert.match(middleware, /pathname === '\/basaadmin'/);

  const robots = readFileSync(path.join(root, 'src/app/robots.ts'), 'utf8');
  assert.doesNotMatch(robots, /\/admin/);
  assert.doesNotMatch(robots, /\/basaadmin/);
});
