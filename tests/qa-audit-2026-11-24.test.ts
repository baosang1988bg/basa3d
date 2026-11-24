// Fix plan docs/exec-plans/active/fix-qa-audit-2026-11-24.md — pure helpers + schemas (no DB needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ZodError } from 'zod';
import { buildSearchSql, isMissingSearchFoldError } from '../src/lib/catalog/search-terms';
import { SCHEMA_OUT_OF_DATE_MESSAGE, isSchemaDriftError } from '../src/lib/db-errors';
import { VN_PHONE_HTML_PATTERN, VN_PHONE_INVALID_MESSAGE, isVietnamesePhone, normalizePhoneInput } from '../src/lib/customer/phone';
import { createExpenseInputSchema, publicBaoGiaRequestSchema, publicCheckoutOrderInputSchema, publicCustomRequestInputSchema, publicCustomerPhoneSchema } from '../src/domain/schemas';
import { validationMessage } from '../src/lib/api';
import { formatShippingAddress } from '../src/lib/format';
import { stripHtml } from '../src/lib/parsers/html-text';

test('QA-001: buildSearchSql folds by default and falls back to lower() LIKE', () => {
  const folded: unknown[] = [];
  assert.match(buildSearchSql('giá đỡ', folded), /public\.basa3d_search_fold\(p\.name\) like public\.basa3d_search_fold\(\$1\)/);
  assert.deepEqual(folded, ['%giá%', '%đỡ%']);

  const plain: unknown[] = ['category'];
  const sql = buildSearchSql('Ba%lo', plain, 'p.name', { fold: false });
  assert.equal(sql, ' and lower(p.name) like lower($2)');
  assert.doesNotMatch(sql, /basa3d_search_fold/);
  assert.deepEqual(plain, ['category', '%Ba\\%lo%'], 'LIKE metacharacters stay escaped in the fallback too');
});

test('QA-001: only the missing basa3d_search_fold error triggers the fallback', () => {
  assert.equal(isMissingSearchFoldError({ code: '42883', message: 'function public.basa3d_search_fold(character varying) does not exist' }), true);
  assert.equal(isMissingSearchFoldError({ code: '42883', message: 'function public.other() does not exist' }), false);
  assert.equal(isMissingSearchFoldError({ code: '42P01', message: 'basa3d_search_fold' }), false);
  assert.equal(isMissingSearchFoldError(null), false);
});

test('QA-001: storefront listing retries without folding instead of failing', () => {
  const source = readFileSync('src/services/storefront-catalog.service.ts', 'utf8');
  assert.match(source, /isMissingSearchFoldError\(error\)/);
  assert.match(source, /listStorefrontProductsWith\(input, false\)/);
});

test('QA-002: schema drift (pending migration) is recognised and explained', () => {
  for (const code of ['42883', '42703', '42P01']) assert.equal(isSchemaDriftError({ code }), true, code);
  for (const value of [{ code: '23505' }, { code: 42703 }, new Error('x'), null, 'boom']) assert.equal(isSchemaDriftError(value), false);
  assert.match(SCHEMA_OUT_OF_DATE_MESSAGE, /db:check-migrations/);
  const actions = readFileSync('src/app/basaadmin/(protected)/products/new/actions.ts', 'utf8');
  assert.match(actions, /isSchemaDriftError\(error\)/);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts['db:check-migrations'], /scripts\/check-migrations\.mjs/);
});

test('QA-003: Vietnamese phone rule', () => {
  for (const ok of ['0912345678', '0912 345 678', '091.234.5678', '+84912345678', '84 912 345 678', '(028) 3823 4567', ' 0900000002 ']) {
    assert.equal(isVietnamesePhone(ok), true, ok);
  }
  for (const bad of ['abc123', '0900', '12345678901', '0912abc678', '', '+1 415 555 0100', '09123456789012']) {
    assert.equal(isVietnamesePhone(bad), false, bad);
  }
  assert.equal(normalizePhoneInput(' 0912.345-678 '), '0912345678');
});

test('QA-003: HTML pattern matches the same examples (browser uses the v flag)', () => {
  const pattern = new RegExp(`^(?:${VN_PHONE_HTML_PATTERN})$`, 'v');
  for (const ok of ['0912 345 678', '+84 912345678', '(028) 3823 4567']) assert.equal(pattern.test(ok), true, ok);
  for (const bad of ['abc123', '0900']) assert.equal(pattern.test(bad), false, bad);
});

test('QA-003: the three PUBLIC schemas reject a non-phone with a Vietnamese message', () => {
  const result = publicCustomerPhoneSchema.safeParse('abc123');
  assert.equal(result.success, false);
  assert.equal(validationMessage(result.error as ZodError), VN_PHONE_INVALID_MESSAGE);

  const custom = publicCustomRequestInputSchema.safeParse({
    customerName: 'QA', customerPhone: 'abc123', description: 'x', quantity: 1, copyrightConfirmed: true, tosVersion: 'v1',
  });
  assert.equal(custom.success, false);
  assert.ok(custom.error?.issues.some((issue) => issue.path[0] === 'customerPhone' && issue.message === VN_PHONE_INVALID_MESSAGE));

  const okCustom = publicCustomRequestInputSchema.safeParse({
    customerName: 'QA', customerPhone: '0912 345 678', description: 'x', quantity: 1, copyrightConfirmed: true, tosVersion: 'v1',
  });
  assert.equal(okCustom.success, true);
  assert.equal(okCustom.data?.customerPhone, '0912 345 678', 'stored value is validated, not rewritten');

  const checkout = publicCheckoutOrderInputSchema.safeParse({
    checkoutRequestId: '00000000-0000-4000-8000-000000000001', customerName: 'QA', customerPhone: 'abc123',
    items: [{ variantId: '00000000-0000-4000-8000-000000000002', quantity: 1 }],
  });
  assert.ok(checkout.error?.issues.some((issue) => issue.path[0] === 'customerPhone'));

  const baoGia = publicBaoGiaRequestSchema.safeParse({ customerName: 'QA', customerPhone: 'abc123', copyrightConfirmed: true, tosVersion: 'v1', items: [] });
  assert.ok(baoGia.error?.issues.some((issue) => issue.path[0] === 'customerPhone'));
});

test('QA-003: generic Zod errors still get a Vietnamese fallback message', () => {
  const result = createExpenseInputSchema.safeParse({});
  assert.equal(result.success, false);
  assert.equal(validationMessage(result.error as ZodError), 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại thông tin.');
});

test('QA-004: quote page distinguishes a locked phone-suffix budget', () => {
  const page = readFileSync('src/app/[locale]/(storefront)/quotes/[quoteNumber]/page.tsx', 'utf8');
  assert.match(page, /lookupPublicQuoteByPhoneSuffix/);
  assert.match(page, /locked=\{bySuffix\?\.locked \?\? false\}/);
  const order = readFileSync('src/services/order.service.ts', 'utf8');
  assert.match(order, /return 'LOCKED'/);
});

test('QA-010: MakerWorld summaries are plain text; ai-news keeps the same helper', () => {
  const html = '<p>Meet the <strong>Flexi</strong> Spinosaurus!<br>Fast &amp; cute&nbsp;✨</p>';
  assert.equal(stripHtml(html), 'Meet the Flexi Spinosaurus! Fast & cute ✨');
  assert.match(readFileSync('src/services/ai-news.service.ts', 'utf8'), /export \{ stripHtml \} from '\.\.\/lib\/parsers\/html-text'/);
  const route = readFileSync('src/app/api/public/makerworld-cn/resolve/route.ts', 'utf8');
  assert.equal((route.match(/stripHtml\((data|design)\.summary\)/g) ?? []).length, 2);
});

test('QA-011: expense cash flow only counts PAID, non-cancelled orders', () => {
  const service = readFileSync('src/services/expense.service.ts', 'utf8');
  assert.match(service, /CASH_REVENUE_ORDER_FILTER = "status <> 'CANCELLED' and payment_status = 'PAID'"/);
  assert.match(service, /from orders where \$\{CASH_REVENUE_ORDER_FILTER\}/);
});

test('QA-012: expense amount must be > 0', () => {
  const base = { expenseCode: 'QA-1', title: 'QA', category: 'OTHER' as const };
  assert.equal(createExpenseInputSchema.safeParse({ ...base, amount: 0 }).success, false);
  assert.equal(createExpenseInputSchema.safeParse({ ...base, amount: -1 }).success, false);
  assert.equal(createExpenseInputSchema.safeParse({ ...base, amount: 1 }).success, true);
});

test('QA-013: a discount larger than subtotal + shipping is refused with a clear code', () => {
  const service = readFileSync('src/services/quote.service.ts', 'utf8');
  assert.match(service, /if \(discount > input\.subtotal \+ shippingFee\)/);
  assert.match(service, /'QUOTE_DISCOUNT_TOO_LARGE'/);
});

test('QA-014: shipping address renders as text', () => {
  assert.equal(formatShippingAddress({ city: 'TP.HCM', ward: 'Phường Test', line1: '123 Đường Test' }), '123 Đường Test, Phường Test, TP.HCM');
  assert.equal(formatShippingAddress({ line1: ' 1 Lê Lợi ', note: 'gọi trước', zip: 70000, empty: '' }), '1 Lê Lợi, gọi trước, 70000');
  assert.equal(formatShippingAddress('12 Nguyễn Huệ'), '12 Nguyễn Huệ');
  assert.equal(formatShippingAddress(null), '');
  assert.equal(formatShippingAddress([]), '');
});

test('QA-016: admin shell and next dev do not load Google Analytics', () => {
  assert.match(readFileSync('src/app/basaadmin/layout.tsx', 'utf8'), /analytics=\{false\}/);
  assert.match(readFileSync('src/components/analytics/google-analytics.tsx', 'utf8'), /NODE_ENV === 'development'/);
});

test('QA-017: Vietnamese default metadata', () => {
  const root = readFileSync('src/app/layout.tsx', 'utf8');
  assert.doesNotMatch(root, /description: '3D-printing business platform'/);
  assert.match(root, /description: 'Xưởng in 3D BaSa3D/);
});
