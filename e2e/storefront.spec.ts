import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { Client } from 'pg';
import { CURRENT_TOS_VERSION } from '../src/lib/copyright/tos-version';

configureTestEnvironment();

test('a visitor can load /custom-print, fill the form, and submit successfully', async ({ page }) => {
  const phone = `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`;

  await page.goto('/custom-print');
  await expect(page.getByRole('heading', { name: 'Đặt in 3D theo yêu cầu' })).toBeVisible();

  await page.locator('#customerName').fill('Playwright E2E Visitor');
  await page.locator('#customerPhone').fill(phone);
  await page.locator('#quantity').fill('2');
  await page.locator('#description').fill('E2E smoke test submission — vui lòng bỏ qua.');
  // Phase 29: submit stays disabled until the copyright confirmation checkbox is checked.
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu đặt in' })).toBeDisabled();
  await page.locator('#copyrightConfirmed').check();
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu đặt in' })).toBeEnabled();
  await page.getByRole('button', { name: 'Gửi yêu cầu đặt in' }).click();

  await expect(page.getByText('Đã gửi yêu cầu thành công!')).toBeVisible();

  if (process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const row = await client.query('select source_channel, copyright_confirmed, tos_version from custom_requests where customer_phone = $1', [phone]);
      expect(row.rowCount).toBe(1);
      expect(row.rows[0].source_channel).toBe('WEBSITE');
      expect(row.rows[0].copyright_confirmed).toBe(true);
      expect(row.rows[0].tos_version).toBe(CURRENT_TOS_VERSION);
    } finally {
      await client.end();
    }
  }
});

// Phase 33 S2: files go browser → Supabase Storage via a signed URL, so a file larger than Vercel's
// 4.5MB function body limit must still upload and reach the instant-estimate step.
function largeBinaryStl(): Buffer {
  // A closed 10 mm cube (12 triangles) repeated until the file is > 4.5MB.
  const v = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0], [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10]];
  const faces = [[0, 3, 2], [0, 2, 1], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  const copies = 8_000;
  const triangles = faces.length * copies;
  const buffer = Buffer.alloc(84 + triangles * 50);
  buffer.writeUInt32LE(triangles, 80);
  let offset = 84;
  for (let copy = 0; copy < copies; copy += 1) {
    for (const face of faces) {
      offset += 12; // normal (0,0,0)
      for (const index of face) {
        for (const coordinate of v[index]) { buffer.writeFloatLE(coordinate, offset); offset += 4; }
      }
      offset += 2; // attribute byte count
    }
  }
  return buffer;
}

test('a file > 4.5MB uploads straight to Storage on /custom-print and reaches the estimate step', async ({ page }) => {
  test.setTimeout(120_000); // ~5MB upload + server-side parse of 96k triangles
  const stl = largeBinaryStl();
  expect(stl.length).toBeGreaterThan(4.5 * 1024 * 1024);
  await page.goto('/custom-print');
  const uploadUrls = page.waitForResponse((response) => response.url().includes('/api/public/custom-requests/upload-urls'));
  const estimate = page.waitForResponse((response) => response.url().includes('/api/public/file-estimate'), { timeout: 60_000 });
  await page.locator('input[type="file"]').setInputFiles({ name: 'big-cube.stl', mimeType: 'application/vnd.ms-pki.stl', buffer: stl });
  expect((await uploadUrls).status()).toBe(201);
  await expect(page.getByText('Đã tải lên: big-cube.stl')).toBeVisible({ timeout: 60_000 });
  expect((await estimate).status()).toBe(200);
});
