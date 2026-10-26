import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStaffNotificationEmail,
  buildStaffNotificationTelegram,
  buildTelegramInlineKeyboard,
  resolveTelegramSiteUrl,
} from '../src/lib/notify/send-staff-notification.js';

// phase-15.md decision #4: email body must be minimal — type + code + a login-gated admin
// link — and NEVER embed customer/order PII (name, phone, address, item specifics). These are
// pure snapshot-style checks on the built content; no network call involved.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const telegramSiteUrl = resolveTelegramSiteUrl();

test('order notification email content is exactly type + code + admin link', () => {
  const built = buildStaffNotificationEmail({ type: 'ORDER', id: 'order-id-1', code: 'ORD-ABC123' });
  assert.equal(built.subject, 'Đơn hàng mới: ORD-ABC123');
  assert.equal(built.text, `Đơn hàng mới.\nMã: ORD-ABC123\n\nXem chi tiết (yêu cầu đăng nhập): ${siteUrl}/admin/orders/order-id-1`);
  assert.equal(built.html, `<p>Đơn hàng mới.</p><p>Mã: <strong>ORD-ABC123</strong></p><p><a href="${siteUrl}/admin/orders/order-id-1">Xem chi tiết</a> (yêu cầu đăng nhập)</p>`);
});

test('custom request notification email content is exactly type + code + admin link', () => {
  const built = buildStaffNotificationEmail({ type: 'CUSTOM_REQUEST', id: 'cr-id-1', code: 'CR-XYZ999' });
  assert.equal(built.subject, 'Yêu cầu custom mới: CR-XYZ999');
  assert.equal(built.text, `Yêu cầu custom mới.\nMã: CR-XYZ999\n\nXem chi tiết (yêu cầu đăng nhập): ${siteUrl}/admin/custom-requests/cr-id-1`);
  assert.equal(built.html, `<p>Yêu cầu custom mới.</p><p>Mã: <strong>CR-XYZ999</strong></p><p><a href="${siteUrl}/admin/custom-requests/cr-id-1">Xem chi tiết</a> (yêu cầu đăng nhập)</p>`);
});

test('email content never carries restricted PII fields beyond code + link', () => {
  const built = buildStaffNotificationEmail({
    type: 'ORDER',
    id: 'order-id-2',
    code: 'ORD-SECRET',
    customerName: 'Secret User',
    customerPhone: '0900000000',
  });
  const combined = `${built.subject}\n${built.text}\n${built.html}`.toLowerCase();
  for (const restricted of ['customername', 'customerphone', 'customeremail', 'shippingaddress', 'name:', 'phone:', 'address:', '@', 'secret user']) {
    assert.ok(!combined.includes(restricted), `email content unexpectedly contains "${restricted}"`);
  }
});

test('order notification telegram content renders basic header, code, and quick open link', () => {
  const built = buildStaffNotificationTelegram({ type: 'ORDER', id: 'order-id-1', code: 'ORD-ABC123' });
  assert.equal(built, `🔔 <b>Đơn hàng mới</b>\n📋 <b>Mã:</b> <code>ORD-ABC123</code>\n\n👉 <a href="${telegramSiteUrl}/admin/orders/order-id-1"><b>Mở nhanh đơn hàng trên Admin</b></a>`);
});

test('custom request notification telegram content escapes HTML', () => {
  const built = buildStaffNotificationTelegram({ type: 'CUSTOM_REQUEST', id: 'cr-id-1', code: 'CR-<XYZ>&123' });
  assert.equal(built, `🔔 <b>Yêu cầu custom mới</b>\n📋 <b>Mã:</b> <code>CR-&lt;XYZ&gt;&amp;123</code>\n\n👉 <a href="${telegramSiteUrl}/admin/custom-requests/cr-id-1"><b>Mở nhanh đơn hàng trên Admin</b></a>`);
});

test('telegram notification content renders rich details with model link and quick open', () => {
  const built = buildStaffNotificationTelegram({
    type: 'CUSTOM_REQUEST',
    id: 'cr-id-rich',
    code: 'CR-RICH1',
    customerName: 'Nguyễn Văn A',
    customerPhone: '0912345678',
    quantity: 2,
    material: 'PLA Matte',
    totalVnd: 150_000,
    modelUrl: 'https://makerworld.com/en/models/12345',
    modelTitle: 'MakerWorld: Articulated Dragon',
    description: 'In gấp trong ngày',
  });
  assert.ok(built.includes('Nguyễn Văn A'));
  assert.ok(built.includes('0912345678'));
  assert.ok(built.includes('Số lượng:</b> 2'));
  assert.ok(built.includes('PLA Matte'));
  assert.ok(built.includes('150.000'));
  assert.ok(built.includes('https://makerworld.com/en/models/12345'));
  assert.ok(built.includes('Articulated Dragon'));
  assert.ok(built.includes('In gấp trong ngày'));
  assert.ok(built.includes(`👉 <a href="${telegramSiteUrl}/admin/custom-requests/cr-id-rich"><b>Mở nhanh đơn hàng trên Admin</b></a>`));
});

test('telegram inline keyboard generates quick open button and 3D model button', () => {
  const keyboard = buildTelegramInlineKeyboard({
    type: 'CUSTOM_REQUEST',
    id: 'cr-id-rich',
    code: 'CR-RICH1',
    modelUrl: 'https://makerworld.com/en/models/12345',
    modelTitle: 'MakerWorld: Articulated Dragon',
  });
  assert.ok(keyboard?.inline_keyboard);
  assert.equal(keyboard.inline_keyboard.length, 2);
  assert.equal(keyboard.inline_keyboard[0][0].text, '🚀 Mở đơn #CR-RICH1 trên Admin');
  assert.equal(keyboard.inline_keyboard[0][0].url, `${telegramSiteUrl}/admin/custom-requests/cr-id-rich`);
  assert.equal(keyboard.inline_keyboard[1][0].url, 'https://makerworld.com/en/models/12345');
});
