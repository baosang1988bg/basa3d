import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  buildProductDescription,
  buildVariantSkus,
  catalogExportBundleSchema,
  computeJsonBundleSlug,
  type CatalogExportItem,
} from '../src/lib/stl-import/json-bundle';
import { parseJsonImportArgs } from '../scripts/stl-import/import-from-json';

const SKU_RE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

function sampleItem(overrides: Partial<CatalogExportItem> = {}): CatalogExportItem {
  return {
    catalogId: 'abc123',
    sourceKey: 'a'.repeat(40),
    sourceRelPath: 'Keycap/artisan-duck/duck.3mf',
    sourceDir: 'Keycap/artisan-duck',
    groupMode: 'FOLDER',
    sourceBytes: 123456,
    sourceMtime: '2026-11-11T00:00:00Z',
    name: 'Artisan Duck Keycap',
    localCategory: 'Keycap',
    categorySlug: 'keycap',
    categoryName: 'Keycap & Phụ kiện phím',
    skuCode: 'KEYCAP',
    designer: 'BaSa Studio',
    note: 'In 0.16mm layer height',
    basePriceVnd: 45000,
    pricingBreakdown: { costVnd: 15000, sellVnd: 45000 },
    sizeMm: [18, 18, 14],
    volumeCm3: 2.4,
    triangles: 42000,
    images: [],
    variants: [
      {
        name: 'V1 Base',
        priceVnd: 45000,
        costPriceVnd: 15000,
        weightGrams: 4,
        attributes: { filament: 'PLA+' },
      },
      {
        name: 'V2 Dual Color',
        priceVnd: 65000,
        costPriceVnd: 22000,
        weightGrams: 5,
        attributes: { filament: 'PETG' },
      },
    ],
    ...overrides,
  };
}

test('catalogExportBundleSchema accepts multi-variant bundle and rejects malformed values', () => {
  const validBundle = {
    schemaVersion: 'basa3d-catalog-export-v1',
    generatedAt: '2026-11-11T10:00:00Z',
    count: 1,
    items: [sampleItem()],
  };
  const parsed = catalogExportBundleSchema.parse(validBundle);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].variants.length, 2);

  assert.equal(
    catalogExportBundleSchema.safeParse({
      ...validBundle,
      items: [sampleItem({ sourceKey: 'not-sha1' })],
    }).success,
    false,
  );

  assert.equal(
    catalogExportBundleSchema.safeParse({
      ...validBundle,
      items: [
        sampleItem({
          variants: [{ name: 'Bad', priceVnd: -1000, attributes: {} }],
        }),
      ],
    }).success,
    false,
  );

  assert.equal(
    catalogExportBundleSchema.safeParse({
      ...validBundle,
      items: [
        sampleItem({
          variants: [{ name: 'Float', priceVnd: 45000.5, attributes: {} }],
        }),
      ],
    }).success,
    false,
  );

  assert.equal(
    catalogExportBundleSchema.safeParse({
      ...validBundle,
      items: [sampleItem({ variants: [] })],
    }).success,
    false,
  );
});

test('buildVariantSkus enforces SKU pattern, uniqueness, and max 40 chars', () => {
  const taken = new Set<string>(['KEYCAP-SUPER-LONG-NAME-WITH-MANY-WOR-P1']);
  const skus = buildVariantSkus(
    'KEYCAP',
    'super-long-name-with-many-words-exceeding-limit-easily',
    4,
    (candidate) => taken.has(candidate),
  );

  assert.equal(skus.length, 4);
  assert.equal(new Set(skus).size, 4);
  for (const sku of skus) {
    assert.ok(sku.length <= 40, `SKU quá dài: ${sku}`);
    assert.match(sku, SKU_RE);
    assert.equal(taken.has(sku), false);
  }

  const single = buildVariantSkus('DECOR', 'desk-tray', 1, () => false);
  assert.deepEqual(single, ['DECOR-DESK-TRAY']);
});

test('buildProductDescription and computeJsonBundleSlug format details cleanly', () => {
  const fullDesc = buildProductDescription(sampleItem());
  assert.match(fullDesc, /18 × 18 × 14 mm/);
  assert.match(fullDesc, /2\.4 cm³/);
  assert.match(fullDesc, /Gồm 2 cấu hình/);
  assert.match(fullDesc, /BaSa Studio/);
  assert.match(fullDesc, /In 0\.16mm layer height/);

  const minimalDesc = buildProductDescription(
    sampleItem({
      sizeMm: null,
      volumeCm3: null,
      designer: null,
      note: '',
      variants: [{ name: 'Mặc định', priceVnd: 30000, attributes: {} }],
    }),
  );
  assert.equal(minimalDesc, 'Sản phẩm in 3D từ thư viện BaSa3D.');

  const takenSlugs = new Set(['artisan-duck-keycap']);
  assert.equal(computeJsonBundleSlug('Artisan Duck Keycap', takenSlugs), 'artisan-duck-keycap-2');
});

test('parseJsonImportArgs parses flags cleanly and validates conflicting modes', () => {
  const parsed = parseJsonImportArgs(['--json', 'exports/test.json', '--out', 'exports/m.json', '--limit', '10', '--apply']);
  assert.equal(parsed.jsonFile, path.resolve('exports/test.json'));
  assert.equal(parsed.outPath, path.resolve('exports/m.json'));
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.apply, true);

  const dirOut = parseJsonImportArgs(['--json', 'exports/test.json', '--out', 'exports']);
  assert.equal(dirOut.outPath, path.resolve('exports', 'manifest.json'));
  assert.equal(dirOut.apply, false);

  assert.throws(() => parseJsonImportArgs(['--json', 'a.json', '--apply', '--dry-run']));
  assert.throws(() => parseJsonImportArgs(['--apply']));
});
