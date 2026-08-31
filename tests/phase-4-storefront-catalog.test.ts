import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { listStorefrontProducts, getStorefrontProductBySlug } from '../src/services/storefront-catalog.service.js';
import { getPool } from '../src/lib/db.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('storefront catalog never returns cost_price or exact stock, and excludes non-ACTIVE products', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const activeId = randomUUID();
  const draftId = randomUUID();
  const variantId = randomUUID();
  const warehouseId = randomUUID();
  const suffix = activeId.slice(0, 8);
  try {
    await client.query(`insert into warehouses (id, name, code) values ($1, 'Catalog Test Warehouse', $2)`, [warehouseId, `CATTEST${suffix.toUpperCase()}`]);
    await client.query(`insert into products (id, name, slug, product_type, status, cost_price) values ($1, 'Active Product', $2, 'READY_STOCK', 'ACTIVE', 12345)`, [activeId, `active-${suffix}`]);
    await client.query(`insert into products (id, name, slug, product_type, status, cost_price) values ($1, 'Draft Product', $2, 'READY_STOCK', 'DRAFT', 99999)`, [draftId, `draft-${suffix}`]);
    await client.query(`insert into product_variants (id, product_id, sku, name, price, cost_price) values ($1, $2, $3, 'Only variant', 50000, 30000)`, [variantId, activeId, `CATTEST-${suffix.toUpperCase()}`]);
    await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ($1, $2, 'PRODUCTION_IN', 4, 'Catalog test stock')`, [warehouseId, variantId]);

    const listing = await listStorefrontProducts({ limit: 100 });
    const active = listing.items.find((item) => item.id === activeId);
    const draft = listing.items.find((item) => item.id === draftId);
    assert.ok(active, 'ACTIVE product must be listed');
    assert.equal(draft, undefined, 'DRAFT product must never be listed publicly');
    assert.equal('costPrice' in active!, false);
    assert.equal(active!.inStock, true);
    assert.equal('onHand' in active!, false);
    assert.equal('reserved' in active!, false);

    const detail = await getStorefrontProductBySlug(`active-${suffix}`);
    assert.ok(detail);
    assert.equal('costPrice' in detail!, false);
    assert.equal('costPrice' in detail!.variants[0], false);
    assert.equal('onHand' in detail!.variants[0], false);
    assert.equal('reserved' in detail!.variants[0], false);
    assert.equal(detail!.variants[0].inStock, true);

    const draftDetail = await getStorefrontProductBySlug(`draft-${suffix}`);
    assert.equal(draftDetail, null, 'DRAFT product detail must not be reachable publicly');
  } finally {
    await client.end();
  }
});

test('listStorefrontProducts({ categoryId }) only returns products in that category', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const categoryAId = randomUUID();
  const categoryBId = randomUUID();
  const productInAId = randomUUID();
  const productInBId = randomUUID();
  const suffix = categoryAId.slice(0, 8);
  try {
    await client.query(`insert into categories (id, name, slug) values ($1, 'Category A', $2)`, [categoryAId, `cat-a-${suffix}`]);
    await client.query(`insert into categories (id, name, slug) values ($1, 'Category B', $2)`, [categoryBId, `cat-b-${suffix}`]);
    await client.query(`insert into products (id, category_id, name, slug, product_type, status) values ($1, $2, 'Product In A', $3, 'READY_STOCK', 'ACTIVE')`, [productInAId, categoryAId, `prod-a-${suffix}`]);
    await client.query(`insert into products (id, category_id, name, slug, product_type, status) values ($1, $2, 'Product In B', $3, 'READY_STOCK', 'ACTIVE')`, [productInBId, categoryBId, `prod-b-${suffix}`]);

    const filtered = await listStorefrontProducts({ categoryId: categoryAId, limit: 100 });
    assert.ok(filtered.items.some((item) => item.id === productInAId), 'product in the filtered category must be listed');
    assert.equal(filtered.items.some((item) => item.id === productInBId), false, 'product in a different category must be excluded');
  } finally {
    await client.end();
  }
});
