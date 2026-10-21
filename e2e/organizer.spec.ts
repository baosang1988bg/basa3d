import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

configureTestEnvironment();

test('visitor generates an Organizer STL, submits it, and admin can see the request', async ({ page }) => {
  const phone = `07${Date.now().toString().slice(-8)}`;
  const customerName = `Organizer E2E ${randomUUID().slice(0, 6)}`;
  await page.goto('/tools/organizer');
  await page.getByLabel('Rộng', { exact: true }).fill('200');
  await page.getByLabel('Hàng', { exact: true }).fill('2');
  await page.getByLabel('Cột', { exact: true }).fill('3');
  await expect(page.locator('[data-testid="organizer-preview-canvas"]')).toBeVisible({ timeout: 15_000 });
  // Phase 45: geometry is rebuilt in a manifold-3d worker; wait for the model info of the new size.
  await expect(page.getByText('200×80×40 mm')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Gửi yêu cầu báo giá' }).click();
  await expect(page.getByRole('heading', { name: 'Hoàn tất yêu cầu báo giá' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#requestedMaterial')).toHaveValue('PLA');
  await expect(page.locator('#description')).toHaveValue('Khay chia ngăn: 2x3, 200x80x40mm');
  await page.locator('#customerName').fill(customerName);
  await page.locator('#customerPhone').fill(phone);
  await page.locator('#quantity').fill('2');
  await page.locator('#copyrightConfirmed').check();
  await page.getByRole('button', { name: 'Gửi yêu cầu đặt in 3D' }).click();
  await expect(page.getByText('Đã gửi yêu cầu thành công!')).toBeVisible();

  const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
  let requestId: string;
  try {
    const result = await client.query('select id, attachment_path from custom_requests where customer_phone = $1', [phone]);
    expect(result.rowCount).toBe(1); expect(result.rows[0].attachment_path).toMatch(/^requests\/[0-9a-f-]+\.stl$/);
    requestId = result.rows[0].id;
  } finally { await client.end(); }

  const email = `organizer-admin-${randomUUID().slice(0, 8)}@example.com`; const password = 'e2e-test-password-123';
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('Could not create E2E admin');
  try {
    const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
    try { await db.query("insert into staff_profiles (id, full_name, role, is_active) values ($1, 'Organizer E2E Admin', 'OWNER', true)", [data.user.id]); } finally { await db.end(); }
    await page.goto('/admin/login'); await page.getByLabel('Email').fill(email); await page.getByLabel('Mật khẩu').fill(password); await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL('**/admin/dashboard');
    await page.goto(`/admin/custom-requests/${requestId}`); await expect(page.getByText(customerName)).toBeVisible(); await expect(page.getByText('Khay chia ngăn: 2x3, 200x80x40mm')).toBeVisible();
  } finally {
    const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
    try { await db.query('delete from staff_profiles where id = $1', [data.user.id]); } finally { await db.end(); }
    await supabase.auth.admin.deleteUser(data.user.id);
  }
});

test('a shared Organizer link loads its configuration and downloads the matching STL', async ({ page }) => {
  // "Giá đựng dụng cụ" preset encoded with the reference's query keys (phase-45 §1.5).
  await page.goto('/tools/organizer?w=150&d=60&h=80&co=6&ro=1&wa=2.4&fl=3&dv=2&rd=3&td=1&tc=40&lip=0&tab=0&sco=0&hol=0&wt=none&col=3b82f6');
  await expect(page.getByText('150×60×80 mm')).toBeVisible({ timeout: 15_000 });
  // Golden values from tests/fixtures/organizer-parity.json (preset:toolHolder).
  await expect(page.getByText('146.3 cm³')).toBeVisible();
  await expect(page.getByText('22.5×55.2 mm')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải STL' }).click()]);
  expect(download.suggestedFilename()).toBe('bin_150x60x80.stl');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const stl = Buffer.concat(chunks);
  expect(stl.readUInt32LE(80)).toBe(1900);
  expect(stl.length).toBe(84 + 1900 * 50);
});
