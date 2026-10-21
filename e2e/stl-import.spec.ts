import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { mintStaffAccount, type MintedStaffAccount } from '../tests/helpers/rbac-accounts';
import { cleanupImported, seedImportedProduct, type ImportedFixture } from '../tests/helpers/stl-import-fixtures';

// Feature 003: OWNER reviews an imported draft on /admin/stl-import, ticks the licence check,
// approves it, and the product is on the public storefront. Needs the local Supabase test stack
// (TEST_SUPABASE_*) for the staff login, like the other admin E2E specs.
configureTestEnvironment();
let owner: MintedStaffAccount;
let fixture: ImportedFixture;

async function withDb<T>(work: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

test.beforeAll(async () => {
  owner = await mintStaffAccount('OWNER');
  fixture = await withDb((client) => seedImportedProduct(client, { licenseReviewed: false }));
});
test.afterAll(async () => {
  if (fixture) await withDb((client) => cleanupImported(client, [fixture]));
  await owner?.cleanup();
});

test('OWNER ticks the licence check, approves an imported draft and it appears on /products', async ({ page }) => {
  await page.context().addCookies(owner.cookieHeader.split('; ').map((entry) => {
    const index = entry.indexOf('=');
    return { name: entry.slice(0, index), value: entry.slice(index + 1), url: 'http://localhost:3412' };
  }));
  await page.goto(`/admin/stl-import?status=PENDING&q=${fixture.tag}`);
  const card = page.locator('article').filter({ hasText: fixture.sourceRelPath });
  await expect(card.getByText('Chưa kiểm tra bản quyền')).toBeVisible();

  await card.getByLabel('Đã kiểm tra bản quyền (tôi chịu trách nhiệm)').check();
  await card.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(card.getByRole('status')).toHaveText('Đã lưu.');

  await page.reload();
  const fresh = page.locator('article').filter({ hasText: fixture.sourceRelPath });
  await fresh.getByRole('checkbox', { name: /^Chọn / }).check();
  await page.getByRole('button', { name: 'Duyệt lên web' }).click();
  await expect(page.getByRole('status').first()).toContainText('Đã duyệt lên web: 1 mẫu.');

  const slug = await withDb(async (client) => (await client.query('select slug, status from products where id = $1', [fixture.productId])).rows[0]);
  expect(slug.status).toBe('ACTIVE');
  await page.goto(`/products/${slug.slug}`);
  await expect(page.getByRole('heading', { name: fixture.tag })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('SECRET-SOURCE');
});
