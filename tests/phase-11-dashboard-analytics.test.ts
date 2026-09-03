import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { getPool } from '../src/lib/db.js';
import { getFinancialMetrics, getOperationalMetrics } from '../src/services/dashboard.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test(
  'getOperationalMetrics() dailyOrderTrends never carries a revenue field (Phase 11 review blocker #2)',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const operational = await getOperationalMetrics();
    assert.equal(operational.dailyOrderTrends.length, 14);
    for (const point of operational.dailyOrderTrends) {
      assert.ok(!('revenue' in point), `OrderTrendPoint for ${point.date} must not carry a revenue field`);
      assert.equal(typeof point.orderCount, 'number');
    }
  },
);
test(
  'getFinancialMetrics() dailyRevenueTrends covers 14 zero-gap days and matches revenueLast14Days',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const financial = await getFinancialMetrics();
    assert.equal(financial.dailyRevenueTrends.length, 14);
    const sum = financial.dailyRevenueTrends.reduce((total, point) => total + point.revenue, 0);
    assert.equal(sum, financial.revenueLast14Days);
    for (const point of financial.dailyRevenueTrends) {
      assert.equal(typeof point.revenue, 'number');
      assert.ok(point.revenue >= 0);
    }
  },
);

test(
  'getOperationalMetrics() materialHealth reuses filament.service.ts tiers, not a separate threshold set',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const operational = await getOperationalMetrics();
    const { materialHealth } = operational;
    assert.ok(materialHealth.totalSpools >= 0);
    // lowStockCount (SAP_HET or worse) must never exceed watchCount (CAN_THEO_DOI or worse) —
    // same nesting invariant as filament.service.ts's getFilamentInventoryStats().
    assert.ok(materialHealth.lowStockCount <= materialHealth.watchCount);
    assert.ok(materialHealth.emptyCount <= materialHealth.lowStockCount);
  },
);

test(
  'getOperationalMetrics() production and custom-request pipelines return non-negative counts',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const operational = await getOperationalMetrics();
    for (const value of Object.values(operational.productionPipeline)) assert.ok(value >= 0);
    for (const value of Object.values(operational.customRequestPipeline)) assert.ok(value >= 0);
  },
);

test(
  'getOperationalMetrics() actionableItems returns at most 5 of each and only open statuses',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const operational = await getOperationalMetrics();
    assert.ok(operational.actionableItems.pendingOrders.length <= 5);
    assert.ok(operational.actionableItems.openCustomRequests.length <= 5);
    for (const order of operational.actionableItems.pendingOrders) {
      assert.ok(['NEW', 'CONFIRMED'].includes(order.status));
    }
    for (const request of operational.actionableItems.openCustomRequests) {
      assert.ok(['NEW', 'REVIEWING', 'NEED_INFO', 'QUOTED'].includes(request.status));
    }
  },
);

test(
  'getOperationalMetrics() actionableItems.pendingOrders never carries a money field (STAFF-reachable path)',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const operational = await getOperationalMetrics();
    for (const order of operational.actionableItems.pendingOrders) {
      assert.ok(!('total' in order), `pendingOrders entry ${order.id} must not carry a total/money field`);
    }
  },
);
