import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import React from 'react';

// Phase 41 — ADR-0011 boundary #2 at the page level: which reader runs for which role/tab, and what
// ends up in the serialized tree. Same mocking approach as tests/phase-28-dashboard-role.test.ts.
Object.assign(globalThis, { React });
let role: 'OWNER' | 'STAFF' = 'OWNER';
const calls = { operational: 0, financial: 0, executive: 0 };

// Sentinel amounts that must never appear in a STAFF render.
const EXEC_REVENUE = 987_654_321;
const operational = {
  ordersToday: 11, pendingOrders: 12, customRequestsOpen: 13, printJobsActive: 14, lowStockCount: 15,
  dailyOrderTrends: [{ date: '2026-09-08', dayLabel: '08/09', orderCount: 11 }],
  productionPipeline: {}, customRequestPipeline: {}, materialHealth: {}, actionableItems: {},
};
const financial = { revenueToday: 123456, dailyRevenueTrends: [{ date: '2026-09-08', revenue: 123456, orderCount: 11 }] };
const executive = {
  revenue30d: { current: EXEC_REVENUE, previous: 0, pctChange: null },
  orders30d: { current: 41, previous: 40, pctChange: 2.5 },
  aov30d: { current: 24_089_130, previous: 0, pctChange: null },
  filamentUsedGrams30d: { current: 50_000, previous: 43_000, pctChange: 16.3 },
  dailyTrends30d: [{ date: '2026-10-18', dayLabel: '18/10', weekdayLabel: 'T7', isWeekend: true, revenue: EXEC_REVENUE, orderCount: 41 }],
  categoryRevenue: [{ categoryId: 'c1', categoryName: 'Đồ decor', revenue: 31_900_000, orderCount: 138 }],
  filamentStock: [],
};

mock.module('../src/lib/auth/require-admin.ts', { namedExports: { requireAdmin: async () => ({ actorId: 'actor', role }) } });
mock.module('../src/services/dashboard.service.ts', { namedExports: {
  getOperationalMetrics: async () => { calls.operational++; return operational; },
  getFinancialMetrics: async () => { calls.financial++; return financial; },
  getExecutiveBusinessMetrics: async () => { calls.executive++; return executive; },
} });
const { default: DashboardPage } = await import('../src/app/admin/(protected)/dashboard/page');

async function render(asRole: 'OWNER' | 'STAFF', searchParams?: { tab?: string | string[]; demo?: string }) {
  role = asRole;
  calls.operational = 0; calls.financial = 0; calls.executive = 0;
  const tree = await DashboardPage(searchParams ? { searchParams: Promise.resolve(searchParams) } : {});
  return JSON.stringify(tree);
}

function assertNoMoney(tree: string) {
  assert.ok(!tree.includes(String(EXEC_REVENUE)), 'executive revenue leaked');
  assert.ok(!tree.includes('987,7 tr₫'), 'formatted executive revenue leaked');
  assert.ok(!tree.includes('123456') && !tree.includes('123.456'), 'today revenue leaked');
  assert.ok(!tree.includes('revenueTrends') && !tree.includes('categoryRevenue') && !tree.includes('"revenue"'));
  assert.ok(!tree.includes('Kinh doanh & Tài chính'), 'tab switcher must not render for STAFF');
}

for (const searchParams of [undefined, { tab: 'business' }, { tab: ['business', 'operations'] }, { tab: 'operations' }]) {
  test(`STAFF ${JSON.stringify(searchParams ?? null)} → operations only, executive/financial readers never called`, async () => {
    const tree = await render('STAFF', searchParams);
    assert.deepEqual(calls, { operational: 1, financial: 0, executive: 0 });
    assert.ok(tree.includes('"value":12'));
    assertNoMoney(tree);
  });
}

test('OWNER defaults to the business tab and loads only the executive reader', async () => {
  const tree = await render('OWNER');
  assert.deepEqual(calls, { operational: 0, financial: 0, executive: 1 });
  assert.ok(tree.includes('987,7 tr₫'));
  assert.ok(tree.includes('"active":"business"'));
  assert.ok(tree.includes('"points"'));
});

test('OWNER ?tab=garbage falls back to business', async () => {
  await render('OWNER', { tab: 'garbage' });
  assert.deepEqual(calls, { operational: 0, financial: 0, executive: 1 });
});

test('OWNER ?tab=operations keeps the existing operations view (D5) without the executive reader', async () => {
  const tree = await render('OWNER', { tab: 'operations' });
  assert.deepEqual(calls, { operational: 1, financial: 1, executive: 0 });
  assert.ok(tree.includes('123.456đ'));
  assert.ok(tree.includes('"active":"operations"'));
  assert.ok(!tree.includes(String(EXEC_REVENUE)));
});

// Dev-only demo data (`?demo=`): honored only when NODE_ENV === 'development' and the viewer is OWNER.
async function withNodeEnv<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const original = env.NODE_ENV;
  env.NODE_ENV = value;
  try { return await run(); } finally { env.NODE_ENV = original; }
}

test('?demo=normal is ignored outside `next dev` — the real executive reader runs', async () => {
  const tree = await withNodeEnv('production', () => render('OWNER', { demo: 'normal' }));
  assert.deepEqual(calls, { operational: 0, financial: 0, executive: 1 });
  assert.ok(!tree.includes('DỮ LIỆU GIẢ'));
});

test('?demo=normal on `next dev` as OWNER renders fake data with a banner and no DB read', async () => {
  const tree = await withNodeEnv('development', () => render('OWNER', { demo: 'normal' }));
  assert.deepEqual(calls, { operational: 0, financial: 0, executive: 0 });
  assert.ok(tree.includes('"scenario":"normal"'), 'demo banner rendered');
  assert.ok(!tree.includes(String(EXEC_REVENUE)));
});

test('?demo= never gives STAFF a business view, even on `next dev`', async () => {
  const tree = await withNodeEnv('development', () => render('STAFF', { tab: 'business', demo: 'normal' }));
  assert.deepEqual(calls, { operational: 1, financial: 0, executive: 0 });
  assertNoMoney(tree);
  assert.ok(!tree.includes('"scenario"'));
});
