import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

// e2e-testing skill (.agents/skills/e2e-testing/SKILL.md) lists 5 required flows; only
// "Admin updates product" and "Inventory adjustment" are in scope for Phase 3 — the other three
// (browse->cart, checkout, custom request submission) need the public storefront (Phase 4/5),
// which doesn't exist yet.

const email = `e2e-admin-${randomUUID().slice(0, 8)}@example.com`;
const password = 'e2e-test-password-123';
let userId: string;
let productId: string;
let variantId: string;
let warehouseId: string;
let variantSku: string;

test.beforeAll(async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  userId = data.user.id;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, true)', [userId, 'E2E Admin', 'OWNER']);

    productId = randomUUID();
    variantId = randomUUID();
    warehouseId = randomUUID();
    const suffix = productId.slice(0, 8);
    await client.query(`insert into warehouses (id, name, code) values ($1, 'E2E Warehouse', $2)`, [warehouseId, `E2E${suffix.toUpperCase()}`]);
    await client.query(`insert into products (id, name, slug, product_type, status) values ($1, 'E2E Product', $2, 'READY_STOCK', 'ACTIVE')`, [productId, `e2e-product-${suffix}`]);
    variantSku = `E2E-VARIANT-${suffix.toUpperCase()}`;
    await client.query(`insert into product_variants (id, product_id, sku, name, price) values ($1, $2, $3, 'E2E Variant', 50000)`, [variantId, productId, variantSku]);
  } finally {
    await client.end();
  }
});

test.afterAll(async () => {
  // Note: the product/variant/warehouse fixtures are intentionally NOT deleted here — the
  // inventory movement test records a real, immutable inventory_movements row against the
  // variant (ledger is append-only by DB trigger, ADR-0005), which makes the variant
  // undeletable afterward via a product_variants FK restrict. This matches the existing test
  // suite's pattern (see the "Concurrency Test"/"Sale Out Test" fixtures already left behind by
  // tests/phase-2-services.test.ts) — harmless, clearly "E2E"-prefixed leftover rows in the dev
  // database, not something to force-delete around an intentional data-integrity constraint.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('delete from staff_profiles where id = $1', [userId]);
  } finally {
    await client.end();
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  await supabase.auth.admin.deleteUser(userId);
});

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/admin/dashboard');
}

test('admin can log in and create a product', async ({ page }) => {
  await login(page);
  await page.goto('/admin/products');

  const productName = `E2E New Product ${randomUUID().slice(0, 8)}`;
  await page.getByLabel('Tên sản phẩm').fill(productName);
  await page.locator('#slug').fill(`e2e-new-${randomUUID().slice(0, 8)}`);
  await page.getByLabel('Loại sản phẩm').selectOption('READY_STOCK');
  await page.getByRole('button', { name: 'Tạo sản phẩm' }).click();

  await expect(page.getByText(productName)).toBeVisible();
});

test('admin can record an inventory movement', async ({ page }) => {
  await login(page);
  await page.goto('/admin/inventory');

  await page.locator('select[name="productVariantId"]').selectOption(variantId);
  await page.locator('select[name="warehouseId"]').selectOption(warehouseId);
  await page.locator('select[name="movementType"]').selectOption('PRODUCTION_IN');
  await page.locator('input[name="quantity"]').fill('10');
  await page.locator('textarea[name="note"]').fill('E2E test stock-in');
  await page.getByRole('button', { name: 'Ghi nhận biến động' }).click();

  await expect(page.locator('table').last().getByRole('row', { name: new RegExp(variantSku) })).toContainText('PRODUCTION_IN');
});
