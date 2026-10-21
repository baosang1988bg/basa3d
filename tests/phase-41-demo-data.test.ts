import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutiveDemoMetrics, DEMO_SCENARIOS, resolveDemoScenario } from '../src/lib/executive-demo-data.js';
import { averageOrderValue, pctChange } from '../src/lib/executive-metrics.js';

test('demo data is only reachable on `next dev` as OWNER', () => {
  for (const nodeEnv of ['production', 'test', undefined, '']) {
    assert.equal(resolveDemoScenario('normal', { nodeEnv, role: 'OWNER' }), null, `NODE_ENV=${nodeEnv}`);
  }
  assert.equal(resolveDemoScenario('normal', { nodeEnv: 'development', role: 'STAFF' }), null);
  for (const raw of [undefined, '', 'NORMAL', 'random', ['normal'], 1]) {
    assert.equal(resolveDemoScenario(raw, { nodeEnv: 'development', role: 'OWNER' }), null, JSON.stringify(raw));
  }
  for (const scenario of DEMO_SCENARIOS) {
    assert.equal(resolveDemoScenario(scenario, { nodeEnv: 'development', role: 'OWNER' }), scenario);
  }
});

test('demo metrics keep the same invariants as the real service', () => {
  // 2026-10-20 18:30 UTC = 2026-10-21 01:30 in Vietnam: "today" must be the local date.
  const now = new Date('2026-10-20T18:30:00Z');
  for (const scenario of DEMO_SCENARIOS) {
    const metrics = buildExecutiveDemoMetrics(scenario, now);
    const days = metrics.dailyTrends30d;
    assert.equal(days.length, 30);
    assert.equal(days[0].date, '2026-09-22');
    assert.equal(days[29].date, '2026-10-21');
    assert.equal(days.reduce((sum, day) => sum + day.revenue, 0), metrics.revenue30d.current);
    assert.equal(days.reduce((sum, day) => sum + day.orderCount, 0), metrics.orders30d.current);
    for (const day of days) {
      const isoDow = ((new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
      assert.equal(day.isWeekend, isoDow >= 6, day.date);
      assert.ok(Number.isInteger(day.revenue) && day.revenue >= 0);
    }
    assert.equal(metrics.aov30d.current, averageOrderValue(metrics.revenue30d.current, metrics.orders30d.current));
    for (const key of ['revenue30d', 'orders30d', 'aov30d', 'filamentUsedGrams30d'] as const) {
      assert.equal(metrics[key].pctChange, pctChange(metrics[key].current, metrics[key].previous), `${scenario} ${key}`);
    }
    const categoryTotal = metrics.categoryRevenue.reduce((sum, row) => sum + row.revenue, 0);
    assert.ok(categoryTotal <= metrics.revenue30d.current, 'merchandise never exceeds the KPI revenue');
  }
});

test('demo scenarios cover the edge cases the UI must handle', () => {
  const normal = buildExecutiveDemoMetrics('normal');
  assert.ok(normal.revenue30d.pctChange != null && normal.revenue30d.pctChange > 0);
  assert.ok(normal.dailyTrends30d.some((day) => day.revenue === 0), 'one empty day');
  assert.ok(normal.categoryRevenue.some((row) => row.categoryId === null), 'uncategorized bucket');
  assert.ok(normal.filamentStock.some((row) => row.isLow) && normal.filamentStock.some((row) => !row.isLow));
  assert.ok(normal.filamentStock.some((row) => row.remainingGrams === row.thresholdGrams && row.isLow), 'exact threshold is low');

  const empty = buildExecutiveDemoMetrics('empty');
  assert.equal(empty.revenue30d.current, 0);
  assert.equal(empty.revenue30d.pctChange, null);
  assert.deepEqual([empty.categoryRevenue, empty.filamentStock], [[], []]);

  const firstMonth = buildExecutiveDemoMetrics('first-month');
  assert.ok(firstMonth.revenue30d.current > 0);
  assert.equal(firstMonth.revenue30d.previous, 0);
  assert.equal(firstMonth.revenue30d.pctChange, null);
  assert.equal(firstMonth.filamentUsedGrams30d.pctChange, null);
});
