import assert from 'node:assert/strict';
import test, { after, mock } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { seedPhase28Lists } from './helpers/phase-28-fixtures';
import { getPool } from '../src/lib/db';
import { listOrders } from '../src/services/order.service';
import { listPrintJobs } from '../src/services/print-job.service';
import { listProducts, pagination } from '../src/services/product.service';
import { listCustomRequests } from '../src/services/custom-request.service';
import { listFilamentSpools, warningTier } from '../src/services/filament.service';
import { getAdminNavBadges, getOperationalMetrics, getFinancialMetrics } from '../src/services/dashboard.service';

configureTestEnvironment();
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('pagination retains default 20 and explicit 100 for existing callers', () => {
  assert.deepEqual(pagination({}), { page: 1, limit: 20, offset: 0 });
  assert.deepEqual(pagination({ page: 2, limit: 100 }), { page: 2, limit: 100, offset: 100 });
  assert.deepEqual(pagination({ page: NaN }), { page: 1, limit: 20, offset: 0 });
});

test('five lists paginate 105 tied rows without gaps; warning tier filters before LIMIT; dashboard data agrees', { skip: !process.env.DATABASE_URL }, async () => {
  const pool = getPool();
  const client = await pool.connect();
  // Route real service SQL to this real transaction so all fixtures roll back, including failures.
  const queryMock = mock.method(pool, 'query', client.query.bind(client));
  try {
    await client.query('BEGIN');
    const before = await getOperationalMetrics();
    const beforeFinancial = await getFinancialMetrics();
    const fixture = await seedPhase28Lists(client);
    const loaders = [
      (page: number) => listOrders({ page, statuses: ['NEW'] }),
      (page: number) => listPrintJobs({ page, statuses: ['QUEUED'] }),
      (page: number) => listProducts({ page }),
      (page: number) => listCustomRequests({ page, statuses: ['NEW'] }),
      (page: number) => listFilamentSpools({ page, materialId: fixture.materialId }, 'OWNER'),
    ];
    for (const load of loaders) {
      const seen: string[] = [];
      for (let page = 1; page <= 6; page++) {
        const result = await load(page);
        const expected = fixture.ids.slice((page - 1) * 20, page * 20);
        // The fixtures sort first (future timestamp / isolated material).
        assert.deepEqual(result.items.slice(0, expected.length).map((row) => row.id), expected);
        assert.equal(result.page, page);
        assert.equal(result.limit, 20);
        if (page < 6) assert.equal(result.hasNext, true);
        seen.push(...result.items.map((row) => row.id).filter((id) => fixture.ids.includes(id)));
      }
      assert.deepEqual(seen, fixture.ids);
      assert.equal(new Set(seen).size, 105);
    }
    const filtered = await listFilamentSpools({ materialId: fixture.materialId, warningTier: 'SAP_HET' }, 'STAFF');
    assert.deepEqual(filtered.items.map((row) => row.id), [fixture.ids[104]]);
    assert.equal(filtered.hasNext, false);
    assert.equal(filtered.items[0].purchaseCost, null);
    assert.equal((await listFilamentSpools({ materialId: fixture.materialId, page: 7 }, 'OWNER')).items.length, 0);
    assert.equal((await listFilamentSpools({ materialId: fixture.materialId, warningTier: "SAP_HET' OR true --" }, 'OWNER')).items.length, 0);
    // Boundary cases compare SQL filtering against the domain helper, including non-round ratios.
    for (const [initial, used] of [[1000, 1000], [1000, 800], [1000, 799], [1000, 500], [1000, 499], [3, 2]]) {
      await client.query('update filament_spools set initial_weight_grams = $2, used_weight_grams = $3 where id = $1', [fixture.ids[104], initial, used]);
      const tier = warningTier(initial, used);
      const result = await listFilamentSpools({ materialId: fixture.materialId, warningTier: tier, limit: 100 }, 'OWNER');
      // Plenty includes 104 other rows, so use page 2 for that tier.
      const next = await listFilamentSpools({ materialId: fixture.materialId, warningTier: tier, limit: 100, page: 2 }, 'OWNER');
      assert.ok([...result.items, ...next.items].some((row) => row.id === fixture.ids[104] && row.warningTier === tier));
    }
    const [operational, financial, badges] = await Promise.all([getOperationalMetrics(), getFinancialMetrics(), getAdminNavBadges()]);
    assert.equal(operational.pendingOrders, before.pendingOrders + 105);
    assert.equal(operational.customRequestsOpen, before.customRequestsOpen + 105);
    assert.equal(operational.printJobsActive, before.printJobsActive + 105);
    assert.deepEqual(badges, { pendingOrders: operational.pendingOrders, customRequestsOpen: operational.customRequestsOpen, printJobsActive: operational.printJobsActive });
    assert.deepEqual(financial, beforeFinancial); // Future zero-value fixtures do not change today's money.
    assert.ok(operational.dailyOrderTrends.every((row) => !('revenue' in row)));
  } finally {
    await client.query('ROLLBACK');
    queryMock.mock.restore();
    client.release();
  }
});
