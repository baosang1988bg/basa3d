import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStaffNotificationEmail } from '../src/lib/notify/send-staff-notification.js';

// phase-15.md decision #4: the email body must be minimal — type + code + a login-gated admin
// link — and NEVER embed customer/order PII (name, phone, address, item specifics). These are
// pure snapshot-style checks on the built content; no Resend network call involved.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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
  const built = buildStaffNotificationEmail({ type: 'ORDER', id: 'order-id-2', code: 'ORD-SECRET' });
  const combined = `${built.subject}\n${built.text}\n${built.html}`.toLowerCase();
  for (const restricted of ['customername', 'customerphone', 'customeremail', 'shippingaddress', 'name:', 'phone:', 'address:', '@']) {
    assert.ok(!combined.includes(restricted), `email content unexpectedly contains "${restricted}"`);
  }
});
