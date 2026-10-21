// Feature 003 — naming, slug, SKU, category mapping, source key (specs/003-stl-bulk-import, research R1/R7).
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSku, describeModel, displayName, SKU_MAX, SKU_RE, SLUG_MAX, SLUG_RE, slugify, uniqueSlug } from '../src/lib/stl-import/naming';
import { categoryMapSchema, resolveCategory } from '../src/lib/stl-import/category-map';
import { fingerprintFiles, normalizeRelPath, sameFingerprint, sourceKey } from '../src/lib/stl-import/source-key';

test('display name strips the extension, export suffixes and trailing sequence numbers', () => {
  assert.equal(displayName('Ếch_xanh_v2.stl'), 'Ếch xanh');
  assert.equal(displayName('dragon-final.stl'), 'dragon');
  assert.equal(displayName('vase_final_v03 (1).STL'), 'vase');
  assert.equal(displayName('chess_knight_02.stl'), 'chess knight');
  assert.equal(displayName('Cat'), 'Cat');
});

test('a numbers-only name gets a "Mẫu" prefix and a very long name is cut to 200 characters', () => {
  assert.equal(displayName('12345.stl'), 'Mẫu 12345');
  const long = displayName(`${'rất dài '.repeat(60)}.stl`);
  assert.ok(long.length <= 200);
});

test('slug drops Vietnamese accents (đ → d), is kebab-case and matches the DB regex', () => {
  assert.equal(slugify('Ếch xanh Đà Lạt'), 'ech-xanh-da-lat');
  assert.equal(slugify('  ---  '), 'mau');
  const long = slugify('a'.repeat(300));
  assert.ok(long.length <= SLUG_MAX && SLUG_RE.test(long));
});

test('duplicate slugs get -2, -3 and stay within 160 characters', () => {
  const taken = new Set(['ech-xanh', 'ech-xanh-2']);
  assert.equal(uniqueSlug('Ếch xanh', (slug) => taken.has(slug)), 'ech-xanh-3');
  const base = 'b'.repeat(SLUG_MAX);
  const next = uniqueSlug(base, (slug) => slug === base);
  assert.ok(next.length <= SLUG_MAX && next.endsWith('-2') && SLUG_RE.test(next));
});

test('SKU is <CAT>-<SLUG> upper-case, ≤ 40 characters, matches the DB regex and is unique', () => {
  assert.equal(buildSku('FIG', 'ech-xanh', () => false), 'FIG-ECH-XANH');
  const long = buildSku('FIG', 'x'.repeat(100), () => false);
  assert.ok(long.length <= SKU_MAX && SKU_RE.test(long));
  const taken = new Set([long]);
  const second = buildSku('FIG', 'x'.repeat(100), (sku) => taken.has(sku));
  assert.ok(second.length <= SKU_MAX && second.endsWith('-2') && SKU_RE.test(second));
});

test('generated description quotes the bounding box in whole millimetres', () => {
  assert.equal(describeModel({ x: 120.4, y: 80, z: 39.6 }), 'Mẫu in 3D, kích thước 120 × 80 × 40 mm.');
});

test('folder → category: accent/case-insensitive, deepest folder wins, no match → "Chưa phân loại"', () => {
  const map = categoryMapSchema.parse({ rules: [
    { folderPattern: 'Figures', categorySlug: 'mo-hinh', skuCode: 'FIG' },
    { folderPattern: 'Đồ chơi', categorySlug: 'do-choi', skuCode: 'TOY' },
  ] });
  assert.deepEqual(resolveCategory(map, 'figures'), { categorySlug: 'mo-hinh', skuCode: 'FIG' });
  assert.deepEqual(resolveCategory(map, 'Figures/do choi'), { categorySlug: 'do-choi', skuCode: 'TOY' });
  assert.deepEqual(resolveCategory(map, 'Misc'), { categorySlug: 'chua-phan-loai', skuCode: 'UNC' });
  assert.deepEqual(resolveCategory(map, ''), { categorySlug: 'chua-phan-loai', skuCode: 'UNC' });
  assert.throws(() => categoryMapSchema.parse({ rules: [{ folderPattern: 'x', categorySlug: 'Bad Slug', skuCode: 'X' }] }));
});

test('source key is the same for NFD/NFC names and for \\ vs / separators', () => {
  const nfc = 'Figures/Ếch xanh.stl';
  assert.equal(normalizeRelPath('Figures\\Ếch xanh.stl'.normalize('NFD')), nfc);
  assert.equal(sourceKey('./Figures/Ếch xanh.stl'.normalize('NFD')), sourceKey(nfc));
  assert.match(sourceKey(nfc), /^[0-9a-f]{40}$/);
  assert.notEqual(sourceKey('Figures/a.stl'), sourceKey('Figures/b.stl'));
});

test('fingerprint is order-independent and changes when size or mtime changes', () => {
  const a = { relPath: 'X/a.stl', bytes: 10, mtimeMs: 1000 };
  const b = { relPath: 'X/b.stl', bytes: 20, mtimeMs: 2000 };
  assert.ok(sameFingerprint([a, b], [b, a]));
  assert.ok(!sameFingerprint([a, b], [a, { ...b, bytes: 21 }]));
  assert.ok(!sameFingerprint([a, b], [a, { ...b, mtimeMs: 2001 }]));
  assert.ok(!sameFingerprint([a], [a, b]));
  assert.deepEqual(fingerprintFiles([b, a]).map((file) => file.relPath), ['X/a.stl', 'X/b.stl']);
});
