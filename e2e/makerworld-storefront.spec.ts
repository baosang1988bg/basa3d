import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { Client } from 'pg';

configureTestEnvironment();

// Phase B storefront (makerworld-phase-b-storefront-estimate.md §7, ADR-0033): a customer pastes a
// link that staff already priced → sees the VERIFIED prices → sends a request with an unticked-by-
// default copyright box → the request stores the MakerWorld snapshot. An unpriced link shows no price.

const modelId = String(Date.now()).slice(-10);
const profileId = '3678340';
let materialId: string;
let configId: string;

test.beforeAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    configId = randomUUID();
    await client.query(`insert into pricing_configs (id, electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw, labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd, effective_from)
      values ($1, 3500, 15000000, 10000, 0.2, 35000, 10, 40, 5000, timezone('utc', now()) - interval '1 second')`, [configId]);
    materialId = randomUUID();
    await client.query(`insert into materials (id, name, material_type, unit, current_unit_cost, is_active) values ($1, 'E2E MW Storefront PLA', 'PLA', 'GRAM', 300, true)`, [materialId]);
    for (const [tier, labor] of [['ASSEMBLED', 50], ['KIT', 20]] as const) {
      await client.query(`insert into makerworld_price_presets (model_id, profile_id, tier, source_url, profile_snapshot, material_lines, print_minutes, labor_minutes, pricing_config_id, final_price_vnd_at_save)
        values ($1, $2, $3, $4, $5, $6, 443, $7, $8, 0)`, [
        modelId, profileId, tier, `https://makerworld.com/en/models/${modelId}#profileId-${profileId}`,
        JSON.stringify({ modelTitle: 'E2E Frankenstein', profileTitle: '0.2mm layer, 2 walls, 15% infill', profileCoverImageUrl: null, printerTarget: 'P1S', platesCount: 6, printMinutes: 443, netWeightGrams: 168, amsRequired: false, colorsCount: 1, license: null, dataSource: 'RESOLVER' }),
        JSON.stringify([{ label: 'PLA (PLA)', materialId, materialType: 'PLA', gram: 176.4 }]), labor, configId,
      ]);
    }
  } finally {
    await client.end();
  }
});

test('verified link shows admin prices; request is stored with the MakerWorld snapshot', async ({ page }) => {
  await page.goto('/custom-print');
  await page.locator('#makerworld-url').fill(`https://makerworld.com/en/models/${modelId}-e2e#profileId-${profileId}`);
  await page.getByRole('button', { name: 'Xem giá', exact: true }).click();
  await expect(page.getByText('Giá BaSa3D đã kiểm tra')).toBeVisible();
  await expect(page.getByText('0.2mm layer, 2 walls, 15% infill')).toBeVisible();
  await page.getByRole('button', { name: /Bản kit tự ráp/ }).click();
  await page.getByRole('button', { name: /Gửi yêu cầu in mẫu này/ }).click();

  await expect(page.locator('#mw-copyright')).not.toBeChecked();
  await expect(page.locator('#mw-profile-confirm')).not.toBeChecked();
  const phone = `09${String(Date.now()).slice(-8)}`;
  await page.locator('#mw-customer-name').fill('E2E Khách MakerWorld');
  await page.locator('#mw-customer-phone').fill(phone);
  await page.getByRole('button', { name: /Gửi yêu cầu & nhận báo giá chính thức/ }).click();
  await expect(page.getByRole('alert')).toContainText('xác nhận');
  await page.locator('#mw-profile-confirm').check();
  await page.locator('#mw-copyright').check();
  await page.getByRole('button', { name: /Gửi yêu cầu & nhận báo giá chính thức/ }).click();
  await expect(page.getByText('Đã gửi yêu cầu báo giá thành công!')).toBeVisible();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query(`select copyright_confirmed, makerworld_snapshot from custom_requests where customer_phone = $1 order by created_at desc limit 1`, [phone]);
    expect(row.rows[0].copyright_confirmed).toBe(true);
    expect(row.rows[0].makerworld_snapshot).toMatchObject({ modelId, profileId, tier: 'KIT', estimateSource: 'VERIFIED', profileConfirmed: true });
    expect(row.rows[0].makerworld_snapshot.estimatedPriceVnd).toBeGreaterThan(0);
  } finally {
    await client.end();
  }
});

test('a link without a verified price shows no price, only the request path', async ({ page }) => {
  await page.goto('/custom-print');
  await page.locator('#makerworld-url').fill(`https://makerworld.com/en/models/9${modelId}`);
  await page.getByRole('button', { name: 'Xem giá', exact: true }).click();
  await expect(page.getByText(/chưa có giá sẵn/)).toBeVisible();
  await expect(page.getByText('Giá BaSa3D đã kiểm tra')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Gửi yêu cầu in mẫu này/ })).toBeEnabled();
});
