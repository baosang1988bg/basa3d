import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_SAVED_CONTACT,
  contactFromFormData,
  mergeSavedContact,
  parseSavedContact,
  serializeSavedContact,
} from '../src/lib/customer/saved-contact';

// "Remember my details on this device" (guest checkout, no accounts). localStorage is untrusted
// input: parsing must never throw and must never yield values longer than the form inputs accept.

const FULL = { name: 'Nguyễn Văn A', phone: '0981234567', email: 'a@example.com', addressLine1: '12 Lê Lợi', ward: 'Phường Bến Thành', city: 'TP. Hồ Chí Minh' };

test('round-trips a full contact', () => {
  assert.deepEqual(parseSavedContact(serializeSavedContact(FULL)), FULL);
});

test('missing, corrupt or wrong-shape storage yields null', () => {
  for (const raw of [null, undefined, '', '{', 'null', '[]', '"x"', '42', '{}', JSON.stringify({ name: 1, phone: null })]) {
    assert.equal(parseSavedContact(raw), null, String(raw));
  }
});

test('unknown keys are dropped, non-strings become empty, values are trimmed and capped', () => {
  const parsed = parseSavedContact(JSON.stringify({ name: '  Bình  ', phone: 98, email: 'x'.repeat(400), isAdmin: true }));
  assert.ok(parsed);
  assert.equal(parsed.name, 'Bình');
  assert.equal(parsed.phone, '');
  assert.equal(parsed.email.length, 320);
  assert.equal('isAdmin' in parsed, false);
});

test('merge keeps stored fields that the submitting form does not have', () => {
  const merged = mergeSavedContact(FULL, { name: 'Trần B', phone: '0900000000', email: '' });
  assert.equal(merged.name, 'Trần B');
  assert.equal(merged.phone, '0900000000');
  assert.equal(merged.email, FULL.email, 'empty submitted email must not wipe the saved one');
  assert.equal(merged.addressLine1, FULL.addressLine1);
  assert.equal(merged.city, FULL.city);
});

test('merge with nothing stored starts from empty', () => {
  assert.deepEqual(mergeSavedContact(null, { phone: ' 0911 ' }), { ...EMPTY_SAVED_CONTACT, phone: '0911' });
});

test('contactFromFormData maps the public form input names', () => {
  const form = new FormData();
  form.set('customerName', 'C');
  form.set('customerPhone', '0912');
  form.set('addressLine1', '1 Trần Phú');
  const contact = contactFromFormData(form);
  assert.equal(contact.name, 'C');
  assert.equal(contact.phone, '0912');
  assert.equal(contact.addressLine1, '1 Trần Phú');
  assert.equal(contact.email, '');
});
