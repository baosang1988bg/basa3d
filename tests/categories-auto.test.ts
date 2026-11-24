import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCategoryFromName,
  getCategoryIconEmoji,
  type CategoryOptionLike,
} from '../src/lib/categories';

test('detectCategoryFromName accurately matches various keywords', () => {
  const categories: CategoryOptionLike[] = [
    { id: 'cat-keychain', label: 'Móc khoá', slug: 'keychain' },
    { id: 'cat-decor', label: 'Trang trí nhà cửa', slug: 'home-decor' },
    { id: 'cat-figures', label: 'Mô hình & Nhân vật', slug: 'figure-model' },
    { id: 'cat-gadgets', label: 'Phụ kiện & Tiện ích', slug: 'accessories-gadgets' },
    { id: 'cat-keycaps', label: 'Nút bàn phím (Keycap)', slug: 'keycap' },
  ];

  // Keychains
  assert.equal(
    detectCategoryFromName('Móc khoá Pokemon Bulbasaur', categories)?.categoryId,
    'cat-keychain'
  );
  assert.equal(
    detectCategoryFromName('Cute Keychain Cat 3D', categories)?.categoryId,
    'cat-keychain'
  );

  // Models & Figures
  assert.equal(
    detectCategoryFromName('Tượng Rồng Cử Động Khớp Nối Flexi', categories)?.categoryId,
    'cat-figures'
  );
  assert.equal(
    detectCategoryFromName('Mô hình Batman chibi', categories)?.categoryId,
    'cat-figures'
  );

  // Accessories & Gadgets
  assert.equal(
    detectCategoryFromName('Giá đỡ điện thoại xoay 360 độ', categories)?.categoryId,
    'cat-gadgets'
  );
  assert.equal(
    detectCategoryFromName('Khay đựng ốc vít gắn tường', categories)?.categoryId,
    'cat-gadgets'
  );

  // Home Decor
  assert.equal(
    detectCategoryFromName('Chậu cây sen đá mini để bàn', categories)?.categoryId,
    'cat-decor'
  );
  assert.equal(
    detectCategoryFromName('Đèn ngủ mặt trăng 3D', categories)?.categoryId,
    'cat-decor'
  );

  // Keycaps
  assert.equal(
    detectCategoryFromName('Keycap Artisan Rồng Thần', categories)?.categoryId,
    'cat-keycaps'
  );

  // Unmatched
  assert.equal(
    detectCategoryFromName('Món đồ ngẫu nhiên không có từ khóa 123456', categories),
    null
  );
});

test('getCategoryIconEmoji returns matching emojis', () => {
  assert.equal(getCategoryIconEmoji('Móc khoá'), '🔑');
  assert.equal(getCategoryIconEmoji('Keycap phím cơ'), '⌨️');
  assert.equal(getCategoryIconEmoji('Mô hình cử động'), '🧸');
  assert.equal(getCategoryIconEmoji('Trang trí phòng'), '🏠');
  assert.equal(getCategoryIconEmoji('Phụ kiện tiện ích'), '📱');
  assert.equal(getCategoryIconEmoji('Dụng cụ cơ khí'), '🛠️');
  assert.equal(getCategoryIconEmoji('Tổng hợp khác'), '🏷️');
});
