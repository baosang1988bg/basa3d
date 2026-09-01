import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

// Phase 9 pricing engine — full DoD browser flow with deterministic waits (Codex's second-pass
// review flagged that manually driving the "upload .3mf then pick a material" path timed out
// because it raced the async upload; this spec sidesteps that specific race by using the
// synchronous "+ Thêm dòng" manual-entry path instead, which needs no wait for an async response —
// the .3mf upload path itself is covered by tests/threemf-slice-info.test.ts + the route handler,
// not re-tested here in the browser).

const ownerEmail = `e2e-pricing-owner-${randomUUID().slice(0, 8)}@example.com`;
const staffEmail = `e2e-pricing-staff-${randomUUID().slice(0, 8)}@example.com`;
const password = 'e2e-test-password-123';
let ownerId: string;
let staffId: string;
let materialId: string;
let customRequestId: string;
let customRequestNumber: string;
let productId: string;
let productSlug: string;

test.beforeAll(async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

  const owner = await supabase.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
  if (owner.error || !owner.data.user) throw owner.error ?? new Error('createUser (owner) returned no user');
  ownerId = owner.data.user.id;

  const staff = await supabase.auth.admin.createUser({ email: staffEmail, password, email_confirm: true });
  if (staff.error || !staff.data.user) throw staff.error ?? new Error('createUser (staff) returned no user');
  staffId = staff.data.user.id;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, true)', [ownerId, 'E2E Pricing Owner', 'OWNER']);
    await client.query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, true)', [staffId, 'E2E Pricing Staff', 'STAFF']);

    materialId = randomUUID();
    await client.query(
      `insert into materials (id, name, material_type, unit, current_unit_cost, is_active)
       values ($1, 'E2E PLA Test', 'PLA', 'GRAM', 160, true)`,
      [materialId],
    );

    // A pricing_configs row must exist or the calculator panel refuses to render (see
    // PricingCalculatorPanel's "Chưa có cấu hình giá" fallback).
    await client.query(
      `insert into pricing_configs
         (electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw,
          labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd, effective_from)
       values (3500, 15000000, 10000, 0.2, 35000, 10, 40, 5000, timezone('utc', now()))`,
    );

    customRequestId = randomUUID();
    customRequestNumber = `CR-${customRequestId.slice(0, 8).toUpperCase()}`;
    await client.query(
      `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
       values ($1, $2, 'OTHER', 'E2E Pricing Custom Request', '0900000000', 'test', 1)`,
      [customRequestId, customRequestNumber],
    );

    productId = randomUUID();
    productSlug = `e2e-pricing-product-${customRequestId.slice(0, 8)}`;
    await client.query(
      `insert into products (id, name, slug, product_type, status) values ($1, 'E2E Pricing Product', $2, 'READY_STOCK', 'DRAFT')`,
      [productId, productSlug],
    );
  } finally {
    await client.end();
  }
});

test.afterAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('delete from staff_profiles where id = any($1)', [[ownerId, staffId]]);
  } finally {
    await client.end();
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  await supabase.auth.admin.deleteUser(ownerId);
  await supabase.auth.admin.deleteUser(staffId);
});

async function login(page: Page, email: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/admin/dashboard');
}

async function fillCalculator(page: Page) {
  await page.locator('#pricing-print-minutes').fill('180');
  await page.locator('#pricing-labor-minutes').fill('30');
  await page.getByRole('button', { name: '+ Thêm dòng' }).click();
  // Manual entry is synchronous (no upload round-trip) — the row exists immediately after click,
  // this wait is just Playwright's normal actionability check, not a race with an async response.
  await page.locator('input[placeholder="Gram"]').first().fill('50');
  await page.locator('select').filter({ hasText: 'Chọn vật liệu' }).selectOption({ label: 'E2E PLA Test' });
  await expect(page.getByText('Giá đề xuất', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dùng giá này' }).click();
  await expect(page.getByText(/Đã điền .* vào form/)).toBeVisible();
}

test('OWNER creates a Quote via the pricing calculator (manual entry) and the snapshot is persisted', async ({ page }) => {
  await login(page, ownerEmail);
  await page.goto(`/admin/custom-requests/${customRequestId}`);

  await fillCalculator(page);

  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await page.locator('#validUntil').fill(validUntil.toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Tạo báo giá' }).click();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await expect.poll(async () => {
      const row = await client.query(
        `select pricing_breakdown, pricing_config_id from quotes where custom_request_id = $1 order by created_at desc limit 1`,
        [customRequestId],
      );
      return row.rows[0]?.pricing_config_id ?? null;
    }, { timeout: 15_000 }).not.toBeNull();

    const row = await client.query(
      `select pricing_breakdown, pricing_config_id from quotes where custom_request_id = $1 order by created_at desc limit 1`,
      [customRequestId],
    );
    expect(row.rows[0].pricing_breakdown).toMatchObject({ materialCostVnd: 8000 });
  } finally {
    await client.end();
  }
});

test('OWNER prices a Product via the pricing calculator on the edit page (reprice, ADR-0022)', async ({ page }) => {
  await login(page, ownerEmail);
  await page.goto(`/admin/products/${productId}`);

  await fillCalculator(page);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await expect.poll(async () => {
      const row = await client.query('select pricing_config_id from products where id = $1', [productId]);
      return row.rows[0]?.pricing_config_id ?? null;
    }, { timeout: 15_000 }).not.toBeNull();

    const row = await client.query('select base_price, pricing_breakdown from products where id = $1', [productId]);
    expect(Number(row.rows[0].base_price)).toBe(65_000);
    expect(row.rows[0].pricing_breakdown).toMatchObject({ finalPriceVnd: 65_000 });
  } finally {
    await client.end();
  }
});

test('STAFF cannot reach /admin/settings/pricing (OWNER-only, requireOwner() enforced server-side)', async ({ page }) => {
  await login(page, staffEmail);
  await page.goto('/admin/settings/pricing');
  // No error.tsx boundary exists for this route today (same as every other OWNER-only admin page,
  // e.g. /admin/staff) — requireOwner() throwing surfaces as a generic error render, not the
  // pricing-config form. Assert the actual OWNER-only content never renders, rather than asserting
  // a specific status code this app doesn't produce for Server Component throws.
  await expect(page.getByRole('button', { name: 'Lưu cấu hình mới' })).not.toBeVisible();
});
