import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import React from 'react';

// tsx's standalone JSX transform uses the classic runtime; Next's build supplies its own.
Object.assign(globalThis, { React });
let role: 'OWNER' | 'STAFF' = 'OWNER';
let financialCalls = 0;
let operationalCalls = 0;
let release: () => void = () => {};
let gate = Promise.resolve();
const operational = {
  ordersToday: 11, pendingOrders: 12, customRequestsOpen: 13, printJobsActive: 14, lowStockCount: 15,
  dailyOrderTrends: [{ date: '2026-09-08', dayLabel: '08/09', orderCount: 11 }],
  productionPipeline: {}, customRequestPipeline: {}, materialHealth: {}, actionableItems: {},
};
const financial = { revenueToday: 123456, dailyRevenueTrends: [{ date: '2026-09-08', revenue: 123456, orderCount: 11 }] };
mock.module('../src/lib/auth/require-admin.ts', { namedExports: { requireAdmin: async () => ({ actorId: 'actor', role }) } });
mock.module('../src/services/dashboard.service.ts', { namedExports: {
  getOperationalMetrics: async () => { operationalCalls++; await gate; return operational; },
  getFinancialMetrics: async () => { financialCalls++; await gate; return financial; },
  // Phase 41: the business tab is covered by tests/phase-41-dashboard-tabs.test.ts.
  getExecutiveBusinessMetrics: async () => { throw new Error('operations-tab tests must not reach the executive reader'); },
} });
const { default: DashboardPage } = await import('../src/app/admin/(protected)/dashboard/page');

test('OWNER starts both independent reads before either completes and renders both datasets', async () => {
  role = 'OWNER';
  gate = new Promise<void>((resolve) => { release = resolve; });
  // Phase 41: OWNER defaults to the business tab; this test covers the operations tab.
  const render = DashboardPage({ searchParams: Promise.resolve({ tab: 'operations' }) });
  await new Promise<void>((resolve) => setImmediate(resolve));
  try { assert.equal(operationalCalls, 1); assert.equal(financialCalls, 1); }
  finally { release(); }
  const tree = JSON.stringify(await render);
  assert.ok(tree.includes('123.456đ'));
  assert.ok(tree.includes('"pendingOrders":12') || tree.includes('"value":12'));
  assert.ok(tree.includes('"revenueTrends"'));
});

test('STAFF never invokes the financial reader or serializes its data', async () => {
  role = 'STAFF';
  financialCalls = 0;
  gate = Promise.resolve();
  const tree = JSON.stringify(await DashboardPage({}));
  assert.equal(financialCalls, 0);
  assert.ok(tree.includes('"value":12'));
  assert.ok(!tree.includes('123456'));
  assert.ok(!tree.includes('revenueTrends'));
});
