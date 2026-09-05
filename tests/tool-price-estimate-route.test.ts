import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

const config = {
  electricityVndPerKwh: 3500, machinePriceVnd: 15000000, machineLifetimeHours: 10000,
  printerPowerKw: 0.12, laborVndPerHour: 35000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5000,
};
const attempts = new Map<string, number>();
let limiterOptions: { scope: string; maxRequests: number; windowMs: number };
mock.module('../src/lib/rate-limit.ts', { namedExports: {
  createDatabaseRateLimiter: (options: typeof limiterOptions) => {
    limiterOptions = options;
    return async (ip: string) => { const n = (attempts.get(ip) ?? 0) + 1; attempts.set(ip, n); return n > options.maxRequests; };
  },
} });
mock.module('../src/services/inventory.service.ts', { namedExports: { listMaterials: async () => [{ materialType: 'PLA', costPerKg: 160000 }] } });
mock.module('../src/services/pricing-config.service.ts', { namedExports: { getCurrentPricingConfig: async () => config } });
// Isolate pricing services here; the pure calculation has separate numerical coverage.
mock.module('../src/services/pricing.service.ts', { namedExports: {
  resolveMaterialUnitCostVndPerGram: () => 160,
  computePricingBreakdown: () => ({ finalPriceVnd: 18000 }),
} });
const { POST } = await import('../src/app/api/public/tool-price-estimate/route.js');
function request(body: unknown, ip = 'valid') {
  return new Request('http://localhost/api/public/tool-price-estimate', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, 'x-forwarded-for': 'ignored' }, body: JSON.stringify(body) });
}
test('route returns only advisory range and rejects invalid and extra fields', async () => {
  const response = await POST(request({ weightGrams: 10, printMinutes: 30 }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['maxPriceVnd', 'minPriceVnd']);
  assert.ok(body.minPriceVnd > 0 && body.maxPriceVnd >= body.minPriceVnd);
  for (const invalid of [{ weightGrams: -1, printMinutes: 30 }, { weightGrams: 2001, printMinutes: 30 }, { weightGrams: 10, printMinutes: 10081 }, { weightGrams: 10, printMinutes: 30, marginPct: 0 }]) {
    assert.equal((await POST(request(invalid))).status, 400);
  }
});
test('route configures the original hourly allowance, keys on IP, and returns 429 after 60', async () => {
  assert.deepEqual(limiterOptions, { scope: 'tool-price-estimate', maxRequests: 60, windowMs: 3600000 });
  for (let i = 0; i < 61; i++) assert.equal((await POST(request({ weightGrams: 10, printMinutes: 30 }, 'limited'))).status, i < 60 ? 200 : 429);
  assert.equal((await POST(request({ weightGrams: 10, printMinutes: 30 }, 'another'))).status, 200);
  assert.equal(attempts.has('ignored'), false);
});
