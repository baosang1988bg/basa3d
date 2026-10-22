// Feature 003 — migration 20261022000100_keycap_category: the "Keycap" category targeted by the
// KeyCap3D rule in scripts/stl-import/category-map.json. DB-backed: needs the disposable local PostgreSQL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => {
  if (hasDb) await getPool().end();
});

test('category-map routes KeyCap3D to the keycap category with SKU code KCP', async () => {
  const { rules } = JSON.parse(await readFile('scripts/stl-import/category-map.json', 'utf8')) as { rules: { folderPattern: string; categorySlug: string; skuCode: string }[] };
  const rule = rules.find((entry) => entry.folderPattern === 'KeyCap3D');
  assert.deepEqual(rule && { categorySlug: rule.categorySlug, skuCode: rule.skuCode }, { categorySlug: 'keycap', skuCode: 'KCP' });
});

test('"Keycap" exists and is active', { skip: !hasDb }, async () => {
  const row = (await getPool().query(`select name, is_active from categories where slug = 'keycap'`)).rows[0];
  assert.deepEqual(row, { name: 'Keycap', is_active: true });
});
