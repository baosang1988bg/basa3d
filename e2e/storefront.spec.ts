import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import nextEnv from '@next/env';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

test('a visitor can load /custom-print, fill the form, and submit successfully', async ({ page }) => {
  const phone = `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`;

  await page.goto('/custom-print');
  await expect(page.getByRole('heading', { name: 'Đặt in 3D theo yêu cầu' })).toBeVisible();

  await page.locator('#customerName').fill('Playwright E2E Visitor');
  await page.locator('#customerPhone').fill(phone);
  await page.locator('#quantity').fill('2');
  await page.locator('#description').fill('E2E smoke test submission — vui lòng bỏ qua.');
  await page.getByRole('button', { name: 'Gửi yêu cầu đặt in' }).click();

  await expect(page.getByText('Đã gửi yêu cầu thành công!')).toBeVisible();

  if (process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const row = await client.query('select source_channel from custom_requests where customer_phone = $1', [phone]);
      expect(row.rowCount).toBe(1);
      expect(row.rows[0].source_channel).toBe('WEBSITE');
    } finally {
      await client.end();
    }
  }
});
