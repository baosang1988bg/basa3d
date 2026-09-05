import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());

test('visitor generates a Keychain Blocks STL, submits it, and admin can see the request', async ({ page }, testInfo) => {
  const phone = `07${Date.now().toString().slice(-8)}`;
  const customerName = `Keychain Blocks E2E ${randomUUID().slice(0, 6)}`;
  await page.goto('/tools/keychain-blocks');
  await page.getByLabel('Tên trên móc khoá', { exact: true }).fill('BASA');
  await page.getByRole('combobox', { name: 'Font chữ', exact: true }).selectOption('Comfortaa');
  await page.getByRole('combobox', { name: 'Icon khối 2', exact: true }).selectOption('icon:heart');
  await page.getByLabel('Màu nền khối 1', { exact: true }).fill('#ff0000');
  await page.getByLabel('Màu chữ khối 2', { exact: true }).fill('#00ff00');
  await expect(page.locator('[data-testid="keychain-blocks-preview-canvas"]')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath('keychain-blocks-preview.png') });
  for (const label of ['Tải STL Zip', 'Tải Bambu 3MF (Màu)']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: label, exact: true }).click();
    const file = await download;
    expect(await file.failure()).toBeNull();
    expect(file.suggestedFilename()).toMatch(/\.(zip|3mf)$/);
  }
  await page.getByRole('button', { name: 'Gửi yêu cầu báo giá' }).click();
  await expect(page.getByRole('heading', { name: 'Hoàn tất yêu cầu báo giá' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#requestedMaterial')).toHaveValue('PLA');
  await expect(page.locator('#description')).toHaveValue(/Móc khoá khối Compact: B icon:heart S A; font Comfortaa/);
  const description = await page.locator('#description').inputValue();
  await page.locator('#customerName').fill(customerName);
  await page.locator('#customerPhone').fill(phone);
  await page.locator('#quantity').fill('2');
  await page.getByRole('button', { name: 'Gửi yêu cầu đặt in 3D' }).click();
  await expect(page.getByText('Đã gửi yêu cầu thành công!')).toBeVisible();

  const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
  let requestId: string;
  try {
    const result = await client.query('select id, attachment_path from custom_requests where customer_phone = $1', [phone]);
    expect(result.rowCount).toBe(1); expect(result.rows[0].attachment_path).toMatch(/^requests\/[0-9a-f-]+\.stl$/);
    requestId = result.rows[0].id;
  } finally { await client.end(); }

  const email = `keychain-blocks-admin-${randomUUID().slice(0, 8)}@example.com`; const password = 'e2e-test-password-123';
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('Could not create E2E admin');
  try {
    const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
    try { await db.query("insert into staff_profiles (id, full_name, role, is_active) values ($1, 'Keychain Blocks E2E Admin', 'OWNER', true)", [data.user.id]); } finally { await db.end(); }
    await page.goto('/admin/login'); await page.getByLabel('Email').fill(email); await page.getByLabel('Mật khẩu').fill(password); await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL('**/admin/dashboard');
    await page.goto(`/admin/custom-requests/${requestId}`); await expect(page.getByText(customerName)).toBeVisible(); await expect(page.getByText(description)).toBeVisible();
  } finally {
    const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
    try { await db.query('delete from staff_profiles where id = $1', [data.user.id]); } finally { await db.end(); }
    await supabase.auth.admin.deleteUser(data.user.id);
  }
});
