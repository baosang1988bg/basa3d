import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { mintStaffAccount, type MintedStaffAccount } from '../tests/helpers/rbac-accounts';

configureTestEnvironment();
let owner: MintedStaffAccount;
const customerName = `E2E copyright ${randomUUID()}`;

async function withDb<T>(work: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

test.beforeAll(async () => { owner = await mintStaffAccount('OWNER'); });
test.afterAll(async () => {
  await withDb(async (client) => {
    await client.query('delete from quotes where custom_request_id in (select id from custom_requests where customer_name = $1)', [customerName]);
    await client.query('delete from custom_requests where customer_name = $1', [customerName]);
  });
  await owner?.cleanup();
});

test('admin sees IP risk badges and must acknowledge risk before creating a quote', async ({ page }) => {
  await page.context().addCookies(owner.cookieHeader.split('; ').map((entry) => {
    const index = entry.indexOf('=');
    return { name: entry.slice(0, index), value: entry.slice(index + 1), url: 'http://localhost:3412' };
  }));
  await page.goto('/admin/custom-requests');
  await page.getByLabel('Tên khách hàng').fill(customerName);
  await page.getByLabel('Số điện thoại').fill('0900000029');
  await page.getByLabel('Số lượng').fill('1');
  await page.getByLabel('Mô tả yêu cầu').fill('In móc khoá Pokemon');
  await page.getByRole('button', { name: 'Ghi nhận yêu cầu', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Đã lưu thay đổi.');
  const result = await withDb((client) => client.query('select id, request_number, ip_risk_flag from custom_requests where customer_name = $1', [customerName]));
  expect(result.rowCount).toBe(1);
  const request = result.rows[0];
  expect(request.ip_risk_flag).toBe(true);
  const row = page.getByRole('row').filter({ hasText: request.request_number });
  await expect(row.getByText('⚠️ Rủi ro SHTT', { exact: true })).toBeVisible();
  await row.getByRole('link', { name: 'Chi tiết' }).click();
  await expect(page.getByText('⚠️ Rủi ro SHTT', { exact: true })).toBeVisible();
  const acknowledgement = page.locator('#ipRiskAcknowledged');
  await expect(acknowledgement).toBeVisible();
  await expect(acknowledgement).not.toBeChecked();
  const form = page.locator('form').filter({ has: acknowledgement });
  await form.locator('#subtotal').fill('100000');
  await form.locator('#total').fill('100000');
  const tomorrow = new Date(Date.now() + 86_400_000);
  await form.locator('#validUntil').fill(tomorrow.toISOString().slice(0, 16));
  // Bypass native required validation to exercise createQuoteAction's server-side gate.
  // The action returns the DomainError message; the integration test asserts its code
  // IP_RISK_ACKNOWLEDGEMENT_REQUIRED directly at the service boundary.
  await form.evaluate((element: HTMLFormElement) => { element.noValidate = true; });
  await form.getByRole('button', { name: 'Tạo báo giá', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText('Yêu cầu này có rủi ro SHTT — cần xác nhận đã kiểm tra trước khi tạo báo giá.');
  const quotes = () => withDb((client) => client.query('select total from quotes where custom_request_id = $1', [request.id]));
  expect((await quotes()).rowCount).toBe(0);
  await acknowledgement.check();
  await form.getByRole('button', { name: 'Tạo báo giá', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText('Đã lưu thay đổi.');
  const created = await quotes();
  expect(created.rowCount).toBe(1);
  expect(Number(created.rows[0].total)).toBe(100000);
  await expect(page.getByText('Báo giá (1)', { exact: true })).toBeVisible();
});
