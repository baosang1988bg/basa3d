import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('Header component includes products category quick-select dropdown', () => {
  const header = read('src/components/storefront/header.tsx');

  // Trigger link "Sản phẩm" with accessible aria attributes and ChevronDown
  assert.match(header, /aria-haspopup="true"/);
  assert.match(header, /aria-expanded=\{isProductsDropdownOpen\}/);
  assert.match(header, /ChevronDown/);

  // Hover and blur handlers on desktop wrapper
  assert.match(header, /onMouseEnter=\{handleMouseEnter\}/);
  assert.match(header, /onMouseLeave=\{handleMouseLeave\}/);
  assert.match(header, /onBlur=\{handleDropdownBlur\}/);

  // Dropdown card with all products option and category listing
  assert.match(header, /href="\/products"/);
  assert.match(header, /href=\{`\/products\?categoryId=\$\{category\.id\}`\}/);
  assert.match(header, /role="menu"/);
  assert.match(header, /role="menuitem"/);

  // Keyboard accessibility: Escape closes dropdown
  assert.match(header, /event\.key === 'Escape'/);
});

test('Storefront layout provides cached categories to Header', () => {
  const layout = read('src/app/[locale]/(storefront)/layout.tsx');
  assert.match(layout, /getCachedCategories/);
  assert.match(layout, /<Header categories=\{categories\} \/>/);
});

test('i18n translation bundles contain allProducts label', () => {
  const vi = JSON.parse(read('messages/vi.json'));
  const en = JSON.parse(read('messages/en.json'));

  assert.equal(vi.nav.allProducts, 'Tất cả sản phẩm');
  assert.equal(en.nav.allProducts, 'All products');
});

test('Mobile drawer provides quick category links under products', () => {
  const header = read('src/components/storefront/header.tsx');
  assert.match(header, /isProductsLink && categories\.length > 0/);
  assert.match(header, /href=\{`\/products\?categoryId=\$\{cat\.id\}`\}/);
});
