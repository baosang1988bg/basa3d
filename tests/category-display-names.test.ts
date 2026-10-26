import assert from 'node:assert/strict';
import test from 'node:test';
import { getCategoryDisplayName, CATEGORY_DISPLAY_NAMES } from '../src/lib/categories';

test('getCategoryDisplayName returns Vietnamese names by default or for locale vi', () => {
  // Keycap category
  assert.equal(getCategoryDisplayName({ name: 'Keycap', slug: 'keycap' }, 'vi'), 'Nút bàn phím (Keycap)');
  assert.equal(getCategoryDisplayName({ name: 'Keycap' }, 'vi'), 'Nút bàn phím (Keycap)');
  assert.equal(getCategoryDisplayName('Keycap', 'vi'), 'Nút bàn phím (Keycap)');

  // Accessories & Gadgets
  assert.equal(getCategoryDisplayName({ name: 'Accessories & Gadgets', slug: 'accessories-gadgets' }, 'vi'), 'Phụ kiện & Tiện ích');
  assert.equal(getCategoryDisplayName({ name: 'Accessories & Gadgets' }, 'vi'), 'Phụ kiện & Tiện ích');

  // Home Decor
  assert.equal(getCategoryDisplayName({ name: 'Home Decor', slug: 'home-decor' }, 'vi'), 'Trang trí nhà cửa');

  // Figure & Model
  assert.equal(getCategoryDisplayName({ name: 'Figure & Model', slug: 'figure-model' }, 'vi'), 'Mô hình & Nhân vật');

  // Keychain
  assert.equal(getCategoryDisplayName({ name: 'Móc khoá', slug: 'keychain' }, 'vi'), 'Móc khoá');
});

test('getCategoryDisplayName returns English names for locale en', () => {
  assert.equal(getCategoryDisplayName({ name: 'Keycap', slug: 'keycap' }, 'en'), 'Keycaps');
  assert.equal(getCategoryDisplayName({ name: 'Accessories & Gadgets', slug: 'accessories-gadgets' }, 'en'), 'Accessories & Gadgets');
  assert.equal(getCategoryDisplayName({ name: 'Home Decor', slug: 'home-decor' }, 'en'), 'Home Decor');
  assert.equal(getCategoryDisplayName({ name: 'Figure & Model', slug: 'figure-model' }, 'en'), 'Models & Figures');
  assert.equal(getCategoryDisplayName({ name: 'Móc khoá', slug: 'keychain' }, 'en'), 'Keychains');
});

test('getCategoryDisplayName falls back gracefully for unknown categories', () => {
  assert.equal(getCategoryDisplayName({ name: 'Vật phẩm độc lạ', slug: 'doc-la' }, 'vi'), 'Vật phẩm độc lạ');
  assert.equal(getCategoryDisplayName('Sản phẩm thử nghiệm', 'en'), 'Sản phẩm thử nghiệm');
});

test('CATEGORY_DISPLAY_NAMES contains all core categories', () => {
  assert.ok('keycap' in CATEGORY_DISPLAY_NAMES);
  assert.ok('accessories-gadgets' in CATEGORY_DISPLAY_NAMES);
  assert.ok('home-decor' in CATEGORY_DISPLAY_NAMES);
  assert.ok('figure-model' in CATEGORY_DISPLAY_NAMES);
  assert.ok('keychain' in CATEGORY_DISPLAY_NAMES);
});
