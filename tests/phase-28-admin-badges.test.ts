import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

// Mock the DB boundary before importing the real service; any unexpected analytics query fails.
test('admin navigation executes exactly the four STAFF-safe counts', async () => {
  const statements: string[] = [];
  const expected = [
    "select count(*) from orders where status in ('NEW','CONFIRMED')",
    "select count(*) from custom_requests where status in ('NEW','REVIEWING','NEED_INFO','QUOTED')",
    "select count(*) from print_jobs where status in ('QUEUED','PRINTING')",
    // Phase 54.2: "Duyệt bài" badge.
    "select count(*) from blog_posts where status = 'DRAFT'",
  ];
  const db = mock.module('../src/lib/db.ts', {
    namedExports: {
      query: async (sql: string) => {
        statements.push(sql);
        const index = expected.indexOf(sql);
        assert.notEqual(index, -1, `Unexpected query: ${sql}`);
        return { rows: [{ count: String(index + 2) }] };
      },
      withTransaction: () => { throw new Error('Navigation must not write'); },
    },
  });
  try {
    const { getAdminNavBadges } = await import('../src/services/dashboard.service');
    assert.deepEqual(await getAdminNavBadges(), { pendingOrders: 2, customRequestsOpen: 3, printJobsActive: 4, blogDrafts: 5 });
    assert.deepEqual(statements, expected);
  } finally { db.restore(); }
});
