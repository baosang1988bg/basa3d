import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

// Phase 11 — real-browser verification for the admin command-center dashboard, nav, process
// steppers, and status-filter tabs. Covers the "OWNER sees money, STAFF never does" boundary
// (ADR-0011 boundary #2) with an actual rendered page, not just a service-layer unit test.

const ownerEmail = `e2e-dash-owner-${randomUUID().slice(0, 8)}@example.com`;
const staffEmail = `e2e-dash-staff-${randomUUID().slice(0, 8)}@example.com`;
const password = 'e2e-test-password-123';
let ownerId: string;
let staffId: string;
let orderId: string;
let orderNumber: string;
let customRequestId: string;
let printJobId: string;

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
    await client.query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, true)', [ownerId, 'E2E Dashboard Owner', 'OWNER']);
    await client.query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, true)', [staffId, 'E2E Dashboard Staff', 'STAFF']);

    orderId = randomUUID();
    orderNumber = `ORD-E2EDASH${orderId.slice(0, 8).toUpperCase()}`;
    await client.query(
      `insert into orders (id, order_number, customer_name, customer_phone, subtotal, total, status)
       values ($1,$2,'E2E Dashboard Customer','0900000000',123456,123456,'NEW')`,
      [orderId, orderNumber],
    );

    customRequestId = randomUUID();
    const requestNumber = `CR-E2EDASH${customRequestId.slice(0, 8).toUpperCase()}`;
    await client.query(
      `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity, status)
       values ($1,$2,'OTHER','E2E Dashboard Customer','0900000000','test',1,'REVIEWING')`,
      [customRequestId, requestNumber],
    );

    printJobId = randomUUID();
    await client.query(
      `insert into print_jobs (id, custom_request_id, status) values ($1,$2,'PRINTING')`,
      [printJobId, customRequestId],
    );
  } finally {
    await client.end();
  }
});

test.afterAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('delete from print_jobs where id = $1', [printJobId]);
    await client.query('delete from custom_requests where id = $1', [customRequestId]);
    await client.query('delete from orders where id = $1', [orderId]);
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

test('OWNER dashboard shows financial KPIs, the 14-day chart, and operational widgets, at desktop and mobile widths', async ({ page }) => {
  await login(page, ownerEmail);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Doanh thu hôm nay')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Biểu đồ đơn hàng và doanh thu 14 ngày' })).toBeVisible();
  await expect(page.getByText('Phễu vận hành xưởng')).toBeVisible();
  await expect(page.getByText('Sức khỏe kho nhựa')).toBeVisible();
  await expect(page.getByText('Cần xử lý ngay')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xử lý' }).first()).toBeVisible();

  // Nav: active route highlighting — the Dashboard link should carry the active-state class,
  // sibling routes should not.
  const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
  await expect(dashboardLink).toHaveClass(/text-primary/);
  const productsLink = page.getByRole('link', { name: 'Sản phẩm' });
  await expect(productsLink).not.toHaveClass(/text-primary/);

  // Mobile viewport — page must still render without horizontal-scroll-inducing crash; the KPI
  // grid and chart stay present (responsive reflow, not an error boundary).
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Doanh thu hôm nay')).toBeVisible();
});

test('STAFF dashboard shows operational metrics but never revenue/order-total figures, in the rendered HTML', async ({ page }) => {
  await login(page, staffEmail);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Đơn đang chờ xử lý')).toBeVisible();
  await expect(page.getByText('Phễu vận hành xưởng')).toBeVisible();
  await expect(page.getByText('Sức khỏe kho nhựa')).toBeVisible();
  await expect(page.getByText('Số liệu doanh thu/lợi nhuận chỉ hiển thị cho OWNER.')).toBeVisible();

  await expect(page.getByText('Doanh thu hôm nay')).toHaveCount(0);
  // STAFF still gets the order-volume chart — just an accurate, revenue-free label/legend.
  await expect(page.getByRole('img', { name: 'Biểu đồ sản lượng đơn hàng 14 ngày' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Biểu đồ đơn hàng và doanh thu 14 ngày' })).toHaveCount(0);

  // Inspect the raw server-rendered HTML (not just what's visible) — money must not be present
  // anywhere in the payload, not merely hidden with CSS (Rule #5, AGENTS.md).
  const html = await page.content();
  expect(html).not.toContain('Doanh thu');
  expect(html.includes('123.456đ') || html.includes('123456đ')).toBe(false);
});

test('order/custom-request/print-job detail pages render a ProcessStepper matching the real status', async ({ page }) => {
  await login(page, ownerEmail);

  await page.goto(`/admin/orders/${orderId}`);
  const orderStepper = page.locator('ol').first();
  await expect(orderStepper.getByText('Mới')).toBeVisible();
  await expect(orderStepper.locator('li').first()).toContainText('Mới');

  await page.goto(`/admin/custom-requests/${customRequestId}`);
  await expect(page.getByText('Đang xem xét')).toBeVisible();

  await page.goto(`/admin/print-jobs/${printJobId}`);
  await expect(page.getByText('Đang in')).toBeVisible();
});

test('status filter tabs update the URL and filtered results, and an invalid filter value falls back safely', async ({ page }) => {
  await login(page, ownerEmail);

  await page.goto('/admin/orders');
  await expect(page.getByRole('link', { name: 'Tất cả' })).toHaveClass(/bg-primary/);

  await page.getByRole('link', { name: 'Đang chờ' }).click();
  await page.waitForURL('**/admin/orders?filter=pending');
  await expect(page.getByRole('link', { name: 'Đang chờ' })).toHaveClass(/bg-primary/);
  await expect(page.getByText(orderNumber)).toBeVisible();

  await page.getByRole('link', { name: 'Hoàn tất' }).click();
  await page.waitForURL('**/admin/orders?filter=completed');
  await expect(page.getByText(new RegExp(`ORD-E2EDASH`))).toHaveCount(0);

  // Unknown filter value must fail safely (fall back to "Tất cả"), not crash the page.
  await page.goto('/admin/orders?filter=not-a-real-filter');
  await expect(page.getByRole('heading', { name: 'Đơn hàng' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tất cả' })).toHaveClass(/bg-primary/);
});
