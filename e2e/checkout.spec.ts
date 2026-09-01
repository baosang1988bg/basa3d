import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import nextEnv from '@next/env';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

// Covers required flows #1 and #2 from .agents/skills/e2e-testing/SKILL.md — "Browse product ->
// detail -> cart" and "Checkout -> order created" — now that Phase 5 ships the public cart/
// checkout (see e2e/admin.spec.ts's note that these were out of scope before Phase 4/5 existed).

let productId: string;
let variantId: string;
let productSlug: string;

test.beforeAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    productId = randomUUID();
    variantId = randomUUID();
    const suffix = productId.slice(0, 8);
    productSlug = `e2e-checkout-product-${suffix}`;
    await client.query(`insert into products (id, name, slug, product_type, status) values ($1, 'E2E Checkout Product', $2, 'READY_STOCK', 'ACTIVE')`, [productId, productSlug]);
    await client.query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'Default', 75000)`, [variantId, productId, `E2E-CHECKOUT-${suffix.toUpperCase()}`]);
    await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ('00000000-0000-4000-8000-000000000010', $1, 'PRODUCTION_IN', 10, 'E2E checkout fixture stock')`, [variantId]);
  } finally {
    await client.end();
  }
});

test('a visitor can browse to a product, add it to cart, and complete guest checkout', async ({ page }) => {
  const phone = `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`;

  await page.goto(`/products/${productSlug}`);
  await expect(page.getByRole('heading', { name: 'E2E Checkout Product' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();
  await expect(page.getByText('Đã thêm vào giỏ hàng.')).toBeVisible();

  // Header cart badge reflects the item just added.
  await expect(page.getByLabel('Giỏ hàng, 1 sản phẩm')).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByText('E2E Checkout Product')).toBeVisible();
  await page.getByRole('link', { name: 'Tiến hành đặt hàng' }).click();

  await expect(page).toHaveURL(/\/checkout$/);
  await page.locator('#customerName').fill('Playwright Checkout E2E');
  await page.locator('#customerPhone').fill(phone);
  await page.locator('#addressLine1').fill('123 Đường Test');
  await page.locator('#ward').fill('Phường Test');
  await page.locator('#city').fill('TP Test');
  await page.getByRole('button', { name: 'Xác nhận đặt hàng' }).click();

  await expect(page).toHaveURL(/\/order-confirmation\/ORD-/, { timeout: 15_000 });
  await expect(page.getByText('Đặt hàng thành công!')).toBeVisible();
  await expect(page.getByText('E2E Checkout Product')).toBeVisible();

  const orderNumber = new URL(page.url()).pathname.split('/order-confirmation/')[1];
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select customer_phone, status, total from orders where order_number = $1', [orderNumber]);
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].customer_phone).toBe(phone);
    expect(row.rows[0].status).toBe('NEW');
    expect(Number(row.rows[0].total)).toBe(75_000);

    const auditRow = await client.query(`select actor_id, action from audit_logs where entity_type = 'order' and action = 'ORDER_CREATED_PUBLIC' and after_data->>'orderNumber' = $1`, [orderNumber]);
    expect(auditRow.rowCount).toBe(1);
    expect(auditRow.rows[0].actor_id).toBeNull();
  } finally {
    await client.end();
  }
});

test('a visitor can order a MADE_TO_ORDER product with zero finished stock', async ({ page }) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const mtoProductId = randomUUID();
  const mtoVariantId = randomUUID();
  const suffix = mtoProductId.slice(0, 8);
  const slug = `e2e-mto-${suffix}`;
  try {
    await client.query(`insert into products (id,name,slug,product_type,status) values ($1,'E2E Made To Order',$2,'MADE_TO_ORDER','ACTIVE')`, [mtoProductId, slug]);
    await client.query(`insert into product_variants (id,product_id,sku,name,price) values ($1,$2,$3,'Default',90000)`, [mtoVariantId, mtoProductId, `E2E-MTO-${suffix.toUpperCase()}`]);
  } finally {
    await client.end();
  }

  await page.goto(`/products/${slug}`);
  await page.getByRole('button', { name: 'Đặt in theo yêu cầu' }).click();
  await page.goto('/checkout');
  const phone = `08${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
  await page.locator('#customerName').fill('Playwright MTO E2E');
  await page.locator('#customerPhone').fill(phone);
  await page.locator('#addressLine1').fill('123 Đường Test');
  await page.locator('#ward').fill('Phường Test');
  await page.locator('#city').fill('TP Test');
  await page.getByRole('button', { name: 'Xác nhận đặt hàng' }).click();
  await expect(page).toHaveURL(/\/order-confirmation\/ORD-/, { timeout: 15_000 });
  await expect(page.getByText('Đặt hàng thành công!')).toBeVisible();
});
