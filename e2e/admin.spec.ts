import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

configureTestEnvironment();

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
let categoryName: string;

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
    // Phase 52: /admin/products/new requires a real category.
    categoryName = `E2E Category ${suffix}`;
    await client.query(`insert into categories (name, slug) values ($1, $2)`, [categoryName, `e2e-category-${suffix}`]);
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
  // Phase 52: guided page — slug/SKU generated, licence chosen explicitly, saved as DRAFT.
  await login(page);
  await page.goto('/admin/products/new');

  const productName = `E2E New Product ${randomUUID().slice(0, 8)}`;
  await page.getByLabel('Tên sản phẩm').fill(productName);
  await page.getByLabel('Danh mục').selectOption({ label: categoryName });
  await page.getByRole('radio', { name: /Xưởng tự thiết kế/ }).click();
  await page.getByRole('radio', { name: /Có sẵn, giao ngay/ }).click();
  await page.getByLabel('Giá bán niêm yết (đ)').fill('89000');
  await page.getByLabel('Số lượng đang có trên kệ').fill('4');
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page.getByText('Đã lưu sản phẩm (nháp).')).toBeVisible();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query(
      `select p.status, p.product_type, p.license_type, v.sku, coalesce(sum(m.quantity), 0)::int as on_hand
       from products p join product_variants v on v.product_id = p.id left join inventory_movements m on m.product_variant_id = v.id
       where p.name = $1 group by p.id, v.id`, [productName]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toMatchObject({ status: 'DRAFT', product_type: 'READY_STOCK', license_type: 'OWN_DESIGN', on_hand: 4 });
  } finally {
    await client.end();
  }
});

test('staff restock from the product row: +5 once, even when Save is clicked twice', async ({ page }) => {
  await login(page);
  await page.goto('/admin/product-inventory');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const before = Number((await client.query('select coalesce(sum(quantity), 0) as q from inventory_movements where product_variant_id = $1', [variantId])).rows[0].q);
    await page.getByLabel('Tìm sản phẩm').fill(variantSku);
    await page.getByRole('button', { name: 'Nhập kho E2E Product' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Kho').selectOption(warehouseId);
    await dialog.getByRole('radio', { name: 'In xong nhập kho' }).click();
    await dialog.getByLabel('Số lượng').fill('5');
    const save = dialog.getByRole('button', { name: 'Lưu vào kho' });
    await save.dblclick();
    await expect.poll(async () => Number((await client.query('select coalesce(sum(quantity), 0) as q from inventory_movements where product_variant_id = $1', [variantId])).rows[0].q), { timeout: 15_000 }).toBe(before + 5);
    await page.waitForTimeout(1_000);
    const rows = await client.query(`select count(*)::int as n from inventory_movements where product_variant_id = $1 and reference_type = 'quick_restock'`, [variantId]);
    expect(rows.rows[0].n).toBe(1);
  } finally {
    await client.end();
  }
});

test('admin can update an existing product', async ({ page }) => {
  await login(page);
  await page.goto(`/admin/products/${productId}`);

  const updatedName = `E2E Updated Product ${randomUUID().slice(0, 8)}`;
  await page.locator('#name').fill(updatedName);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await expect.poll(async () => {
      const row = await client.query('select name from products where id = $1', [productId]);
      return row.rows[0]?.name;
    }).toBe(updatedName);
  } finally {
    await client.end();
  }
});

test('admin can record an inventory movement', async ({ page }) => {
  await login(page);
  await page.goto('/admin/inventory');

  // Phase 52 P4: the raw movement form lives under "Nâng cao" (OWNER only).
  await page.getByText(/Nâng cao \(OWNER\)/).click();
  await page.locator('select[name="productVariantId"]').selectOption(variantId);
  await page.locator('select[name="warehouseId"]').selectOption(warehouseId);
  await page.locator('select[name="movementType"]').selectOption('PRODUCTION_IN');
  await page.locator('input[name="quantity"]').fill('10');
  await page.locator('textarea[name="note"]').fill('E2E test stock-in');
  await page.getByRole('button', { name: 'Ghi nhận biến động' }).click();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await expect.poll(async () => {
      const row = await client.query(
        `select movement_type, quantity
         from inventory_movements
         where product_variant_id = $1 and warehouse_id = $2
         order by created_at desc
         limit 1`,
        [variantId, warehouseId],
      );
      return row.rows[0];
    }, { timeout: 15_000 }).toMatchObject({ movement_type: 'PRODUCTION_IN', quantity: 10 });
  } finally {
    await client.end();
  }
});
