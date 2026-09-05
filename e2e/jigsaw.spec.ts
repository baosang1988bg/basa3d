import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());

const ASCII_CUBE_STL = `solid cube
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 0 40 0
    vertex 60 40 0
  endloop
endfacet
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 60 40 0
    vertex 60 0 0
  endloop
endfacet
facet normal 0 0 1
  outer loop
    vertex 0 0 20
    vertex 60 40 20
    vertex 0 40 20
  endloop
endfacet
facet normal 0 0 1
  outer loop
    vertex 0 0 20
    vertex 60 0 20
    vertex 60 40 20
  endloop
endfacet
facet normal 0 -1 0
  outer loop
    vertex 0 0 0
    vertex 60 0 0
    vertex 60 0 20
  endloop
endfacet
facet normal 0 -1 0
  outer loop
    vertex 0 0 0
    vertex 60 0 20
    vertex 0 0 20
  endloop
endfacet
facet normal 0 1 0
  outer loop
    vertex 0 40 0
    vertex 0 40 20
    vertex 60 40 20
  endloop
endfacet
facet normal 0 1 0
  outer loop
    vertex 0 40 0
    vertex 60 40 20
    vertex 60 40 0
  endloop
endfacet
facet normal -1 0 0
  outer loop
    vertex 0 0 0
    vertex 0 40 20
    vertex 0 40 0
  endloop
endfacet
facet normal -1 0 0
  outer loop
    vertex 0 0 0
    vertex 0 0 20
    vertex 0 40 20
  endloop
endfacet
facet normal 1 0 0
  outer loop
    vertex 60 0 0
    vertex 60 40 0
    vertex 60 40 20
  endloop
endfacet
facet normal 1 0 0
  outer loop
    vertex 60 0 0
    vertex 60 40 20
    vertex 60 0 20
  endloop
endfacet
endsolid cube
`;

test('visitor uploads a model, cuts jigsaw pieces, submits it, and admin can see the request', async ({ page }, testInfo) => {
  const phone = `02${Date.now().toString().slice(-8)}`;
  const customerName = `Jigsaw E2E ${randomUUID().slice(0, 6)}`;
  const stlPath = join(mkdtempSync(join(tmpdir(), 'jigsaw-e2e-')), 'cube.stl');
  writeFileSync(stlPath, ASCII_CUBE_STL);

  await page.goto('/tools/jigsaw');
  await page.locator('input[type="file"]').setInputFiles(stlPath);
  await expect(page.locator('[data-testid="jigsaw-preview-canvas"]')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath('jigsaw-preview.png') });
  for (const label of ['Tải 1 STL gộp', 'Tải STL Zip (mỗi mảnh 1 file)', 'Tải 3MF']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: label, exact: true }).click();
    const file = await download;
    expect(await file.failure()).toBeNull();
  }
  await page.getByRole('button', { name: 'Gửi yêu cầu báo giá' }).click();
  await expect(page.getByRole('heading', { name: 'Hoàn tất yêu cầu báo giá' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#requestedMaterial')).toHaveValue('PLA');
  await expect(page.locator('#description')).toHaveValue(/Mảnh ghép 3D cắt từ "cube\.stl"/);
  const description = await page.locator('#description').inputValue();
  await page.locator('#customerName').fill(customerName);
  await page.locator('#customerPhone').fill(phone);
  await page.locator('#quantity').fill('1');
  await page.getByRole('button', { name: 'Gửi yêu cầu đặt in 3D' }).click();
  await expect(page.getByText('Đã gửi yêu cầu thành công!')).toBeVisible();

  const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
  let requestId: string;
  try {
    const result = await client.query('select id, attachment_path from custom_requests where customer_phone = $1', [phone]);
    expect(result.rowCount).toBe(1); expect(result.rows[0].attachment_path).toMatch(/^requests\/[0-9a-f-]+\.stl$/);
    requestId = result.rows[0].id;
  } finally { await client.end(); }

  const email = `jigsaw-admin-${randomUUID().slice(0, 8)}@example.com`; const password = 'e2e-test-password-123';
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('Could not create E2E admin');
  try {
    const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
    try { await db.query("insert into staff_profiles (id, full_name, role, is_active) values ($1, 'Jigsaw E2E Admin', 'OWNER', true)", [data.user.id]); } finally { await db.end(); }
    await page.goto('/admin/login'); await page.getByLabel('Email').fill(email); await page.getByLabel('Mật khẩu').fill(password); await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL('**/admin/dashboard');
    await page.goto(`/admin/custom-requests/${requestId}`); await expect(page.getByText(customerName)).toBeVisible(); await expect(page.getByText(description)).toBeVisible();
  } finally {
    const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
    try { await db.query('delete from staff_profiles where id = $1', [data.user.id]); } finally { await db.end(); }
    await supabase.auth.admin.deleteUser(data.user.id);
  }
});
