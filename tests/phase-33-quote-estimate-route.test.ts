// Phase 33 S4 — POST /api/public/quote-estimate (plan §6.1). DB-free: limiter, config and
// materials are mocked; the pricing math is the real code.
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

let vat = { vatEnabled: false, vatRateBps: 0 };
const config = () => ({
  id: '00000000-0000-4000-8000-0000000000c1',
  electricityVndPerKwh: 3_500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2,
  laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5_000, ...vat,
});
let hasConfig = true;
const attempts = new Map<string, number>();
let limiterOptions: { scope: string; maxRequests: number; windowMs: number } | undefined;
mock.module('../src/lib/rate-limit.ts', { namedExports: {
  getClientIp: (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
  createDatabaseRateLimiter: (options: NonNullable<typeof limiterOptions>) => {
    limiterOptions = options;
    return async (ip: string) => { const n = (attempts.get(ip) ?? 0) + 1; attempts.set(ip, n); return n > options.maxRequests; };
  },
} });
mock.module('../src/services/pricing-config.service.ts', { namedExports: { getCurrentPricingConfig: async () => (hasConfig ? config() : null) } });
mock.module('../src/services/inventory.service.ts', { namedExports: {
  listMaterials: async () => [
    { materialType: 'PLA', unit: 'GRAM', currentUnitCost: 300 },
    { materialType: 'PETG', unit: 'GRAM', currentUnitCost: 350 },
  ],
} });
process.env.NEXT_PUBLIC_BAO_GIA_ENABLED = 'true';
const { POST } = await import('../src/app/api/public/quote-estimate/route.js');

const box = (x: number, y: number, z: number) => ({ volumeMm3: x * y * z, surfaceMm2: 2 * (x * y + y * z + x * z), sizeMm: { x, y, z }, triangles: 12 });
const item = (overrides: Record<string, unknown> = {}) => ({ kind: 'MESH', metrics: box(40, 40, 40), scalePermille: 1000, materialType: 'PLA', infillPct: 15, quantity: 1, ...overrides });
let ipCounter = 0;
const request = (body: unknown, ip = `ip-${ipCounter++}`) => new Request('http://localhost/api/public/quote-estimate', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
});

test('valid payload → one price per item, totals = sum of lines, no cost/margin fields, no-store', async () => {
  const response = await POST(request({ items: [item(), item({ metrics: box(20, 20, 20), quantity: 4, materialType: 'PETG' })] }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.items.length, 2);
  for (const line of body.items) {
    assert.equal(line.status, 'OK');
    assert.equal(line.unitPriceVnd % 5_000, 0);
    assert.deepEqual(Object.keys(line).sort(), ['floorApplied', 'grams', 'lineSubtotalVnd', 'lineTotalVnd', 'printMinutes', 'sizeMm', 'status', 'unitPriceVnd', 'vatVnd']);
  }
  assert.equal(body.totals.subtotalVnd, body.items[0].lineSubtotalVnd + body.items[1].lineSubtotalVnd);
  assert.equal(body.totals.totalVnd, body.totals.subtotalVnd);
  assert.deepEqual(body.vat, { enabled: false, rateBps: 0 });
  assert.doesNotMatch(JSON.stringify(body), /margin|labor|electricity|machine|cost/i);
});

test('VAT on → per-item VAT and totals include it', async () => {
  vat = { vatEnabled: true, vatRateBps: 800 };
  try {
    const body = await (await POST(request({ items: [item(), item({ quantity: 3 })] }))).json();
    assert.deepEqual(body.vat, { enabled: true, rateBps: 800 });
    for (const line of body.items) assert.equal(line.vatVnd, Math.round((line.lineSubtotalVnd * 800) / 10_000));
    assert.equal(body.totals.vatVnd, body.items[0].vatVnd + body.items[1].vatVnd);
    assert.equal(body.totals.totalVnd, body.totals.subtotalVnd + body.totals.vatVnd);
  } finally {
    vat = { vatEnabled: false, vatRateBps: 0 };
  }
});

test('impossible metrics are rejected with 400: V > box, area too small, absurd size, 11 items, extra fields', async () => {
  const invalid = [
    { items: [item({ metrics: { ...box(10, 10, 10), volumeMm3: 5_000 } })] },
    { items: [item({ metrics: { ...box(20, 20, 20), surfaceMm2: 100 } })] },
    { items: [item({ metrics: box(3_000, 10, 10) })] },
    { items: Array.from({ length: 51 }, () => item()) },
    { items: [] },
    { items: [{ ...item(), priceVnd: 1 }] },
    { items: [item({ infillPct: 25 })] },
    { items: [item({ materialType: 'RESIN' })] },
    { items: [item({ scalePermille: 50 })] },
    { items: [item({ quantity: 1001 })] },
    { items: [item({ kind: 'SLICED' })] },
    { items: [item()], extra: true },
  ];
  for (const body of invalid) assert.equal((await POST(request(body))).status, 400, JSON.stringify(body).slice(0, 120));
});

test('unpriceable items come back with a status instead of a price; totals skip them', async () => {
  const body = await (await POST(request({ items: [item(), item({ metrics: box(300, 20, 20) }), item({ materialType: 'TPU' })] }))).json();
  assert.deepEqual(body.items.map((line: { status: string }) => line.status), ['OK', 'UNPRICED', 'NO_MATERIAL_PRICE']);
  assert.equal(body.items[1].reason, 'EXCEEDS_BUILD_VOLUME');
  assert.equal(body.totals.pricedItems, 1);
  assert.equal(body.totals.subtotalVnd, body.items[0].lineSubtotalVnd);
});

test('no pricing config → 200 with NO_PRICING_CONFIG, not a 5xx', async () => {
  hasConfig = false;
  try {
    const response = await POST(request({ items: [item()] }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reason, 'NO_PRICING_CONFIG');
  } finally {
    hasConfig = true;
  }
});

test('rate limit: 120 calls/hour/IP, then 429', async () => {
  assert.deepEqual(limiterOptions, { scope: 'quote-estimate', maxRequests: 120, windowMs: 3_600_000 });
  let last = 0;
  for (let i = 0; i < 121; i += 1) last = (await POST(request({ items: [item()] }, 'limited'))).status;
  assert.equal(last, 429);
});

test('NEXT_PUBLIC_BAO_GIA_ENABLED off → 404 before any work', async () => {
  process.env.NEXT_PUBLIC_BAO_GIA_ENABLED = 'false';
  try {
    assert.equal((await POST(request({ items: [item()] }))).status, 404);
  } finally {
    process.env.NEXT_PUBLIC_BAO_GIA_ENABLED = 'true';
  }
});
