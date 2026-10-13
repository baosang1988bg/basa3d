// Phase 33 S8 — /bao-gia end to end: 2 STL → configure → price changes → print → submit →
// admin sees 2 items → 2 quotes → 2 public quote pages; VAT on → VAT line; mobile viewport.
// Requires the local test Supabase (Storage + Auth) like the other E2E specs; playwright.config
// sets NEXT_PUBLIC_BAO_GIA_ENABLED=true for the test build.
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { mintStaffAccount, type MintedStaffAccount } from '../tests/helpers/rbac-accounts';

configureTestEnvironment();

const customerName = `E2E bao-gia ${randomUUID().slice(0, 8)}`;
const createdConfigIds: string[] = [];
const createdMaterialIds: string[] = [];
let owner: MintedStaffAccount;

async function withDb<T>(work: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

function cubeStl(edge: number): string {
  const v = [[0, 0, 0], [edge, 0, 0], [edge, edge, 0], [0, edge, 0], [0, 0, edge], [edge, 0, edge], [edge, edge, edge], [0, edge, edge]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 6, 2], [3, 7, 6], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  const buffer = Buffer.alloc(84 + 12 * 50);
  buffer.writeUInt32LE(12, 80);
  t.forEach((tri, i) => tri.forEach((vi, k) => v[vi].forEach((c, j) => buffer.writeFloatLE(c, 84 + i * 50 + 12 + k * 12 + j * 4))));
  const path = join(mkdtempSync(join(tmpdir(), 'bao-gia-e2e-')), `cube-${edge}.stl`);
  writeFileSync(path, buffer);
  return path;
}

async function addConfig(vat: { enabled: boolean; rateBps: number }) {
  const id = await withDb(async (client) => (await client.query<{ id: string }>(`
    insert into pricing_configs (electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw,
      labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd, vat_enabled, vat_rate_bps, effective_from)
    values (3500, 15000000, 10000, 0.2, 35000, 10, 40, 5000, $1, $2, timezone('utc', now())) returning id`, [vat.enabled, vat.rateBps])).rows[0].id);
  createdConfigIds.push(id);
}

test.beforeAll(async () => {
  owner = await mintStaffAccount('OWNER');
  await addConfig({ enabled: false, rateBps: 0 });
  await withDb(async (client) => {
    const row = await client.query<{ id: string }>(`insert into materials (name, material_type, unit, current_unit_cost, is_active) values ('E2E bao-gia PLA', 'PLA', 'GRAM', 300, true) returning id`);
    createdMaterialIds.push(row.rows[0].id);
  });
});

test.afterAll(async () => {
  await withDb(async (client) => {
    await client.query('begin');
    await client.query("set local basa3d.allow_item_purge = 'on'");
    const requests = await client.query<{ id: string }>('select id from custom_requests where customer_name = $1', [customerName]);
    for (const { id } of requests.rows) {
      await client.query('delete from print_jobs where custom_request_id = $1', [id]);
      await client.query('delete from quotes where custom_request_id = $1', [id]);
      await client.query('delete from custom_request_items where custom_request_id = $1', [id]);
      await client.query('delete from custom_requests where id = $1', [id]);
    }
    await client.query('commit');
    await client.query('delete from pricing_configs where id = any($1::uuid[])', [createdConfigIds]);
    await client.query('delete from materials where id = any($1::uuid[])', [createdMaterialIds]);
  });
  await owner?.cleanup();
});

async function loginAsOwner(page: Page) {
  await page.context().addCookies(owner.cookieHeader.split('; ').map((entry) => {
    const index = entry.indexOf('=');
    return { name: entry.slice(0, index), value: entry.slice(index + 1), url: 'http://localhost:3412' };
  }));
}

test('2 STL → configure → print → submit → admin creates 2 quotes → 2 public quote pages', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/bao-gia');
  await expect(page.getByRole('heading', { name: 'Báo giá in 3D tức thì' })).toBeVisible();
  await page.getByTestId('bao-gia-file-input').setInputFiles([cubeStl(20), cubeStl(40)]);
  await expect(page.getByTestId('bao-gia-item')).toHaveCount(2);
  const total = page.getByTestId('bao-gia-total');
  await expect(total).toBeVisible({ timeout: 20_000 });
  const before = await total.textContent();

  // Infill 50% + scale 150% on the second item → the estimate changes.
  const second = page.getByTestId('bao-gia-item').nth(1);
  await second.getByLabel('Độ đặc (infill)').selectOption('50');
  await second.getByLabel('Tỉ lệ (%)').fill('150');
  await expect(total).not.toHaveText(before ?? '', { timeout: 10_000 });
  await expect(page.getByText('VAT', { exact: false })).toHaveCount(0); // VAT off → never mentioned

  await expect(page.getByRole('button', { name: 'In bảng ước tính' })).toBeVisible();

  await page.getByLabel('Họ tên *').fill(customerName);
  await page.getByLabel('SĐT / Zalo *').fill(`09${randomUUID().replace(/\D/g, '').slice(0, 8)}`);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Gửi yêu cầu báo giá' }).click();
  await expect(page.getByText(/Đã nhận yêu cầu CR-/)).toBeVisible({ timeout: 60_000 });

  const request = await withDb(async (client) => (await client.query<{ id: string; attachment_path: string | null }>('select id, attachment_path from custom_requests where customer_name = $1', [customerName])).rows[0]);
  expect(request.attachment_path).toBeNull();
  const items = await withDb(async (client) => (await client.query<{ id: string; verification: string }>('select id, verification from custom_request_items where custom_request_id = $1 order by position', [request.id])).rows);
  expect(items.map((item) => item.verification)).toEqual(['VERIFIED', 'VERIFIED']);

  await loginAsOwner(page);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  for (const item of items) {
    await page.goto(`/admin/custom-requests/${request.id}?item=${item.id}#quote-form`);
    await expect(page.getByText(/Đang báo giá cho món #\d/)).toBeVisible();
    await expect(page.locator('#subtotal')).not.toHaveValue('');
    await page.locator('#validUntil').fill(tomorrow);
    await page.getByRole('button', { name: 'Tạo báo giá', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Đã lưu thay đổi.');
  }
  const quotes = await withDb(async (client) => (await client.query<{ quote_number: string; custom_request_item_id: string }>('select quote_number, custom_request_item_id from quotes where custom_request_id = $1', [request.id])).rows);
  expect(new Set(quotes.map((quote) => quote.custom_request_item_id))).toEqual(new Set(items.map((item) => item.id)));
  await expect(page.getByRole('button', { name: /Sao chép tất cả link báo giá \(2\)/ })).toBeVisible();

  // Each public quote page names its own file (phone-suffix fallback path).
  for (const quote of quotes) {
    await page.goto(`/quotes/${quote.quote_number}`);
    await expect(page.getByText(quote.quote_number)).toBeVisible();
  }
});

test('VAT on → /bao-gia shows the VAT line', async ({ page }) => {
  await addConfig({ enabled: true, rateBps: 800 });
  await page.goto('/bao-gia');
  await page.getByTestId('bao-gia-file-input').setInputFiles([cubeStl(30)]);
  await expect(page.getByTestId('bao-gia-total')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('VAT 8%')).toBeVisible();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('mobile: upload, 3D preview and price', async ({ page }) => {
    await page.goto('/bao-gia');
    await page.getByTestId('bao-gia-file-input').setInputFiles([cubeStl(25)]);
    await expect(page.getByTestId('bao-gia-item-price')).toContainText('~', { timeout: 20_000 });
    await page.getByLabel('Xem 3D').click();
    await expect(page.locator('[data-testid="bao-gia-preview-canvas"]')).toBeVisible();
  });
});
