import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { configureTestEnvironment } from '../tests/helpers/test-environment';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

configureTestEnvironment();

// makerworld-profile-verification Phase A — admin browser flow:
// paste link → pick the exact profile (no silent default) → verification card → tier → confirm
// profile → "Dùng giá này" → create quote → snapshot v2 persisted (license basis recorded automatically).
// Also: switching profile after applying clears the price already written into the form (B3).
//
// The resolver route is mocked with page.route(): MakerWorld's real site sits behind Cloudflare, and
// an E2E run must not depend on (or hammer) a third-party site. The parser itself is covered against
// the real payload shape in tests/makerworld-profile-verification.test.ts.

const ownerEmail = `e2e-mw-owner-${randomUUID().slice(0, 8)}@example.com`;
const password = 'e2e-test-password-123';
let ownerId: string;
let customRequestId: string;
const materialName = `E2E MW PLA ${randomUUID().slice(0, 4)}`;

const MODEL_URL = 'https://makerworld.com/en/models/3246150-frankenstein-s-monster-halloween-version-no-ams';

const resolution = {
  modelId: '3246150',
  modelTitle: "Frankenstein's Monster Halloween Version / NO AMS",
  modelCoverImageUrl: null,
  sourceUrl: MODEL_URL,
  activeProfileId: null,
  requestedProfileMissing: false,
  license: 'Standard Digital File License',
  licenseCommercialUse: 'NOT_ALLOWED',
  profiles: [
    {
      profileId: '3678340', profileTitle: '0.2mm layer, 2 walls, 15% infill', profileCoverImageUrl: null,
      printerTarget: 'P1S', platesCount: 6, printTimeMinutes: 443, netWeightGrams: 168, amsRequired: false, dataIncomplete: false,
      filaments: [{ name: 'PLA #68724D', colorHex: '#68724D', materialType: 'PLA', netWeightGrams: 168 }],
    },
    {
      profileId: '3678348', profileTitle: 'a1 mini (0.2mm layer, 2 walls, 15% infill)', profileCoverImageUrl: null,
      printerTarget: 'A1 mini', platesCount: 6, printTimeMinutes: 527, netWeightGrams: 167, amsRequired: false, dataIncomplete: false,
      filaments: [{ name: 'PLA #68724D', colorHex: '#68724D', materialType: 'PLA', netWeightGrams: 167 }],
    },
  ],
};

test.beforeAll(async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const owner = await supabase.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
  if (owner.error || !owner.data.user) throw owner.error ?? new Error('createUser (owner) returned no user');
  ownerId = owner.data.user.id;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('insert into staff_profiles (id, full_name, role, is_active) values ($1, $2, $3, true)', [ownerId, 'E2E MakerWorld Owner', 'OWNER']);
    await client.query(
      `insert into materials (id, name, material_type, unit, current_unit_cost, is_active) values ($1, $2, 'PLA', 'GRAM', 300, true)`,
      [randomUUID(), materialName],
    );
    await client.query(
      `insert into pricing_configs
         (electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw,
          labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd, effective_from)
       values (3500, 15000000, 10000, 0.2, 35000, 10, 40, 5000, timezone('utc', now()))`,
    );
    customRequestId = randomUUID();
    await client.query(
      `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
       values ($1, $2, 'ZALO', 'E2E MakerWorld Request', '0900000000', 'Frankenstein 24cm', 1)`,
      [customRequestId, `CR-${customRequestId.slice(0, 8).toUpperCase()}`],
    );
  } finally {
    await client.end();
  }
});

test.afterAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('delete from staff_profiles where id = $1', [ownerId]);
  } finally {
    await client.end();
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  await supabase.auth.admin.deleteUser(ownerId);
});

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ownerEmail);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/admin/dashboard');
}

async function openPanelWithMockedResolver(page: Page) {
  await page.route('**/api/admin/pricing/resolve-makerworld', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: resolution }) }));
  await page.goto(`/admin/custom-requests/${customRequestId}`);
  await page.getByPlaceholder('https://makerworld.com/en/models/...#profileId-...').fill(MODEL_URL);
  await page.getByRole('button', { name: 'Tự động lấy dữ liệu' }).click();
  await expect(page.locator('#makerworld-profile-select')).toBeVisible();
}

async function priceSelectedProfile(page: Page) {
  await page.locator('select').filter({ hasText: 'Chọn màu vật liệu phù hợp' }).first().selectOption({ label: materialName });
  await page.getByRole('button', { name: /Bản kit \(tự ráp\)/ }).click();
  await expect(page.getByText('Giá đề xuất', { exact: true })).toBeVisible();
  const apply = page.getByRole('button', { name: /Dùng giá này/ });
  await expect(apply).toBeDisabled(); // profile not confirmed yet
  await page.getByText('Đã xác nhận đúng profile khách yêu cầu', { exact: false }).first().click();
  // No license checkbox: restricted licenses are quoted directly under the shop's
  // personal/non-commercial print policy (print-service-policy.ts), recorded on the snapshot.
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByText(/Đã điền .* cho profile/)).toBeVisible();
}

test('no profile is pre-selected when the link has no #profileId; switching profile after applying clears the form price (B3)', async ({ page }) => {
  await login(page);
  await openPanelWithMockedResolver(page);

  await expect(page.locator('#makerworld-profile-select')).toHaveValue('');
  await expect(page.getByText(/License của mẫu/)).toBeVisible();
  await expect(page.getByText(/In giúp cá nhân theo yêu cầu, phi thương mại/)).toBeVisible();

  await page.locator('#makerworld-profile-select').selectOption('3678340');
  await priceSelectedProfile(page);
  await expect(page.locator('#subtotal')).not.toHaveValue('');

  await page.locator('#makerworld-profile-select').selectOption('3678348');
  await expect(page.locator('#subtotal')).toHaveValue('');
  await expect(page.locator('#total')).toHaveValue('');
  await expect(page.locator('input[name="modelSnapshot"]')).toHaveCount(0);
});

test('creates a KIT quote with a verified v2 profile snapshot', async ({ page }) => {
  await login(page);
  await openPanelWithMockedResolver(page);
  await page.locator('#makerworld-profile-select').selectOption('3678340');
  await priceSelectedProfile(page);

  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await page.locator('#validUntil').fill(validUntil.toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Tạo báo giá', exact: true }).click();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await expect.poll(async () => {
      const row = await client.query(`select model_snapshot from quotes where custom_request_id = $1 order by created_at desc limit 1`, [customRequestId]);
      return row.rows[0]?.model_snapshot ?? null;
    }, { timeout: 15_000 }).not.toBeNull();
    const row = await client.query(`select model_snapshot, pricing_config_id from quotes where custom_request_id = $1 order by created_at desc limit 1`, [customRequestId]);
    expect(row.rows[0].pricing_config_id).not.toBeNull();
    expect(row.rows[0].model_snapshot).toMatchObject({
      schemaVersion: 2,
      dataSource: 'RESOLVER',
      profileId: '3678340',
      profileTitle: '0.2mm layer, 2 walls, 15% infill',
      totalPrintMinutes: 443,
      netWeightGrams: 168,
      amsRequired: false,
      tier: 'KIT',
      license: 'Standard Digital File License',
      licenseAcknowledged: true,
      licenseBasis: 'PERSONAL_NON_COMMERCIAL',
      profileVerified: true,
      sourceUrl: `${MODEL_URL}#profileId-3678340`,
    });
  } finally {
    await client.end();
  }
});
