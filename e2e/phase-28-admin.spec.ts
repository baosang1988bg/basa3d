import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { mintStaffAccount, type MintedStaffAccount } from '../tests/helpers/rbac-accounts';
import { cleanupPhase28Lists, seedPhase28Lists } from '../tests/helpers/phase-28-fixtures';

configureTestEnvironment();
let owner: MintedStaffAccount;
let staff: MintedStaffAccount;
let fixture: Awaited<ReturnType<typeof seedPhase28Lists>>;
const expenseId = randomUUID();
const expenseTitle = `P28 expense ${expenseId.slice(0, 8)}`;

async function withDb<T>(work: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}
async function authenticate(page: Page, account = owner) {
  await page.context().addCookies(account.cookieHeader.split('; ').map((entry) => {
    const index = entry.indexOf('=');
    return { name: entry.slice(0, index), value: entry.slice(index + 1), url: 'http://localhost:3412' };
  }));
}

test.beforeAll(async () => {
  owner = await mintStaffAccount('OWNER');
  staff = await mintStaffAccount('STAFF');
  fixture = await withDb(async (client) => {
    await client.query('BEGIN');
    try {
      const seeded = await seedPhase28Lists(client);
      await client.query(`insert into expenses (id, expense_code, title, category, amount, spent_at)
        values ($1,$2,$3,'OTHER',1000,'2099-01-01')`, [expenseId, `P28-${expenseId.slice(0, 8)}`, expenseTitle]);
      await client.query('COMMIT');
      return seeded;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  });
});
test.afterAll(async () => {
  if (fixture) await withDb(async (client) => {
    await cleanupPhase28Lists(client, fixture);
    await client.query('delete from expenses where id = $1', [expenseId]);
  });
  await owner?.cleanup();
  await staff?.cleanup();
});

for (const route of ['orders', 'custom-requests', 'print-jobs']) {
  test(`${route}: invalid status stays inline, preserves input, disables submit while pending`, async ({ page }) => {
    await authenticate(page);
    await page.goto(`/admin/${route}/${fixture.ids[0]}`);
    const select = page.locator('select[name="status"]');
    const form = page.locator('form').filter({ has: select });
    // Simulate invalid external input that bypasses the select's normal enum choices.
    await select.evaluate((element: HTMLSelectElement) => {
      element.add(new Option('Invalid status fixture', 'INVALID_STATUS'));
      element.value = 'INVALID_STATUS';
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/admin/**', async (route) => {
      if (route.request().method() === 'POST') await gate;
      await route.continue();
    });
    try {
      await form.getByRole('button').click();
      await expect(form.getByRole('button')).toBeDisabled();
      await expect(form.getByRole('status')).toHaveText('Đang lưu…');
    } finally { release(); }
    await expect(form.getByRole('alert')).toContainText('Dữ liệu không hợp lệ');
    await expect(select).toHaveValue('INVALID_STATUS');
    await expect(form.getByRole('button')).toBeEnabled();
    await expect(page.getByRole('heading', { name: 'Không thể tải nội dung quản trị' })).toHaveCount(0);
    const row = await withDb((db) => db.query(`select status from ${route === 'custom-requests' ? 'custom_requests' : route === 'print-jobs' ? 'print_jobs' : 'orders'} where id = $1`, [fixture.ids[0]]));
    expect(row.rows[0].status).toBe(route === 'print-jobs' ? 'QUEUED' : 'NEW');
  });
}

test('business rejection preserves order payment and note; valid retry succeeds', async ({ page }) => {
  await authenticate(page);
  await page.goto(`/admin/orders/${fixture.ids[1]}`);
  const form = page.locator('form').filter({ has: page.locator('#adminNote') });
  await form.locator('#paymentStatus').selectOption('REFUNDED');
  await form.locator('#adminNote').fill('Keep this note after failure');
  await form.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.locator('#paymentStatus')).toHaveValue('REFUNDED');
  await expect(form.locator('#adminNote')).toHaveValue('Keep this note after failure');
  await form.locator('#paymentStatus').selectOption('UNPAID');
  await form.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(form.getByRole('status')).toHaveText('Đã lưu thay đổi.');
  const result = await withDb((db) => db.query('select admin_note from orders where id = $1', [fixture.ids[1]]));
  expect(result.rows[0].admin_note).toBe('Keep this note after failure');
});

test('expense cancel requires confirmation; dismiss leaves it unchanged', async ({ page }) => {
  await authenticate(page);
  await page.goto('/admin/expenses');
  const row = page.getByRole('row').filter({ hasText: expenseTitle });
  page.once('dialog', (dialog) => dialog.dismiss());
  await row.getByRole('button', { name: 'Hủy', exact: true }).click();
  expect((await withDb((db) => db.query('select status from expenses where id = $1', [expenseId]))).rows[0].status).toBe('PAID');
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect.poll(async () => (await withDb((db) => db.query('select status from expenses where id = $1', [expenseId]))).rows[0].status).toBe('CANCELLED');
});

for (const route of ['orders', 'custom-requests', 'print-jobs']) {
  test(`${route}: filter + pagination survive back, forward and refresh`, async ({ page }) => {
    await authenticate(page);
    await page.goto(`/admin/${route}`);
    await page.getByRole('link', { name: 'Đang chờ', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/${route}\\?filter=pending$`));
    await page.getByRole('navigation', { name: 'Phân trang' }).getByRole('link', { name: 'Trang sau' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/${route}\\?filter=pending&page=2$`));
    const rows = await page.locator('tbody tr').allTextContents();
    expect(rows).toHaveLength(20);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/admin/${route}\\?filter=pending$`));
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`filter=pending&page=2$`));
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Phân trang' })).toContainText('Trang 2');
    expect(await page.locator('tbody tr').allTextContents()).toEqual(rows);
  });
}

for (const route of ['orders', 'custom-requests', 'print-jobs', 'products', 'materials']) {
  test(`${route}: page 6 exposes records after the old 100-row limit`, async ({ page }) => {
    await authenticate(page);
    await page.goto(`/admin/${route}?page=6`);
    const expected = route === 'print-jobs' ? fixture.ids[104] : route === 'materials' ? `!${fixture.prefix}-105` : `${fixture.prefix}-105`;
    await expect(page.getByRole('row').filter({ hasText: expected })).toBeVisible();
    if (route === 'products') await expect(page.getByRole('row').filter({ hasText: expected })).toContainText('0đ');
  });
}

test('materials warning tier finds a spool beyond raw row 100 and preserves all filters', async ({ page }) => {
  await authenticate(page);
  await page.goto(`/admin/materials?materialType=${fixture.prefix}&status=ACTIVE&warningTier=SAP_HET`);
  await expect(page.getByRole('row').filter({ hasText: `!${fixture.prefix}-105` })).toBeVisible();
  await page.getByLabel('Trạng thái tồn').selectOption('CON_NHIEU');
  await page.getByRole('button', { name: 'Lọc', exact: true }).click();
  await page.getByRole('link', { name: 'Trang sau' }).click();
  await expect(page).toHaveURL(/page=2/);
  const params = new URL(page.url()).searchParams;
  expect(params.get('materialType')).toBe(fixture.prefix);
  expect(params.get('status')).toBe('ACTIVE');
  expect(params.get('warningTier')).toBe('CON_NHIEU');
  await page.reload();
  await expect(page.getByLabel('Trạng thái tồn')).toHaveValue('CON_NHIEU');
});

for (const role of ['OWNER', 'STAFF'] as const) {
  test(`dashboard ${role} retains operational data and financial boundary`, async ({ page }) => {
    await authenticate(page, role === 'OWNER' ? owner : staff);
    await page.goto('/admin/dashboard');
    await expect(page.getByText('Đơn đang chờ xử lý', { exact: true })).toBeVisible();
    if (role === 'OWNER') {
      await expect(page.getByText('Doanh thu hôm nay', { exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Biểu đồ đơn hàng và doanh thu 14 ngày' })).toBeVisible();
    } else {
      await expect(page.getByText('Doanh thu hôm nay', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Số liệu doanh thu/lợi nhuận chỉ hiển thị cho OWNER.')).toBeVisible();
    }
  });
}
