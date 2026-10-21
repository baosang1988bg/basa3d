import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPhoneNumber } from '../src/lib/format';
import { SITE_CONFIG } from '../src/config/site';

test('formatPhoneNumber formats 10-digit Vietnamese phone numbers into 0xxx xxx xxx', () => {
  assert.strictEqual(formatPhoneNumber('0333698638'), '0333 698 638');
  assert.strictEqual(formatPhoneNumber('0912345678'), '0912 345 678');
  assert.strictEqual(formatPhoneNumber('0333 698 638'), '0333 698 638');
  assert.strictEqual(formatPhoneNumber('0333-698-638'), '0333 698 638');
  assert.strictEqual(formatPhoneNumber('0333.698.638'), '0333 698 638');
});

test('formatPhoneNumber handles +84 international format', () => {
  assert.strictEqual(formatPhoneNumber('+84333698638'), '0333 698 638');
  assert.strictEqual(formatPhoneNumber('+84 333 698 638'), '0333 698 638');
});

test('formatPhoneNumber preserves non-phone text or empty string', () => {
  assert.strictEqual(formatPhoneNumber(''), '');
  assert.strictEqual(formatPhoneNumber('Chat Zalo'), 'Chat Zalo');
  assert.strictEqual(formatPhoneNumber('123'), '123');
});

test('SITE_CONFIG default phone numbers are formatted with spaces', () => {
  assert.strictEqual(SITE_CONFIG.zaloPhone, '0333 698 638');
  assert.strictEqual(SITE_CONFIG.hotline, '0333 698 638');
});

test('SITE_CONFIG.hotline cleanses cleanly to tel: dialer digits', () => {
  const digits = SITE_CONFIG.hotline.replace(/[^\d+]/g, '');
  assert.strictEqual(digits, '0333698638');
});
