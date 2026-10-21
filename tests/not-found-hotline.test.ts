import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Helper to cleanse phone number for tel: URI
 * (Duplicate of logic to be used in not-found.tsx or moved to a shared lib if needed)
 */
function cleansePhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

test('cleansePhoneNumber should remove spaces and hyphens', () => {
  assert.strictEqual(cleansePhoneNumber('0333 698 638'), '0333698638');
  assert.strictEqual(cleansePhoneNumber('0333-698-638'), '0333698638');
});

test('cleansePhoneNumber should keep plus sign for international numbers', () => {
  assert.strictEqual(cleansePhoneNumber('+84 333 698 638'), '+84333698638');
});

test('cleansePhoneNumber should handle already clean numbers', () => {
  assert.strictEqual(cleansePhoneNumber('0333698638'), '0333698638');
});
