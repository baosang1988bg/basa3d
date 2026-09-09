import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import type { PoolClient } from 'pg';
import { updateFilamentSpoolInputSchema } from '../src/domain/schemas';

const statements: { sql: string; values: unknown[] }[] = [];
let existing: Record<string, unknown> | undefined;
let duplicate = false;
const client = {
  query: async (sql: string, values: unknown[] = []) => {
    statements.push({ sql, values });
    if (sql.startsWith('select ')) return { rowCount: existing ? 1 : 0, rows: existing ? [existing] : [] };
    if (duplicate && sql.startsWith('update ')) throw Object.assign(new Error('duplicate'), { code: '23505' });
    return { rowCount: 1, rows: [] };
  },
} as unknown as PoolClient;
mock.module('../src/lib/db.ts', { namedExports: {
  query: async () => { throw new Error('Unexpected connection'); },
  withTransaction: async (work: (tx: PoolClient) => Promise<unknown>) => work(client),
} });
const { updateFilamentSpool, setFilamentSpoolStatus, recordSpoolUsage } = await import('../src/services/filament.service');

function reset(row?: Record<string, unknown>) { statements.length = 0; existing = row; duplicate = false; }

test('spool metadata validation refuses stock, cost and material rewrites', () => {
  const input = { spoolCode: 'PLA-01', hasSpool: true, note: null };
  assert.ok(updateFilamentSpoolInputSchema.safeParse(input).success);
  for (const field of ['usedWeightGrams', 'initialWeightGrams', 'purchaseCost', 'materialId', 'warehouseId']) {
    assert.equal(updateFilamentSpoolInputSchema.safeParse({ ...input, [field]: 0 }).success, false);
  }
  assert.equal(updateFilamentSpoolInputSchema.safeParse({ ...input, spoolCode: '  ' }).success, false);
});

test('missing spool cannot be edited or archived', async () => {
  reset();
  await assert.rejects(updateFilamentSpool('missing', { spoolCode: 'A', hasSpool: true, note: null }, 'actor'), { code: 'SPOOL_NOT_FOUND' });
  await assert.rejects(setFilamentSpoolStatus('missing', 'ARCHIVED', 'actor'), { code: 'SPOOL_NOT_FOUND' });
  assert.ok(statements.every((s) => s.sql.startsWith('select ')));
});

test('duplicate spool code is returned as a useful domain error without a success audit', async () => {
  reset({ spool_code: 'A', has_spool: true, note: null }); duplicate = true;
  await assert.rejects(updateFilamentSpool('id', { spoolCode: 'B', hasSpool: false, note: null }, 'actor'), { code: 'SPOOL_CODE_EXISTS' });
  assert.ok(!statements.some((s) => s.sql.includes('insert into audit_logs')));
});

test('archive and restore keep stock intact, record actor, and repeated archive is a no-op', async () => {
  for (const [previous, next] of [['ACTIVE', 'ARCHIVED'], ['ARCHIVED', 'ACTIVE']] as const) {
    reset({ status: previous });
    await setFilamentSpoolStatus('spool-id', next, 'actor-id');
    assert.ok(statements[0].sql.includes('for update'));
    assert.ok(!statements.some((s) => /material_movements|used_weight_grams|initial_weight_grams|delete from/.test(s.sql)));
    const audit = statements.find((s) => s.sql.includes('insert into audit_logs'));
    assert.equal(audit?.values[0], 'actor-id');
    assert.equal(audit?.values[3], 'spool-id');
    assert.deepEqual(audit?.values[5], { status: next });
  }
  reset({ status: 'ARCHIVED' });
  await setFilamentSpoolStatus('id', 'ARCHIVED', 'actor');
  assert.equal(statements.length, 1);
});

test('archived spools cannot be consumed by a print job', async () => {
  reset({ status: 'ARCHIVED', initial_weight_grams: 1000, used_weight_grams: 0 });
  await assert.rejects(recordSpoolUsage(client, 'id', 100, 'PRINT_JOB', 'job', 'actor'), { code: 'SPOOL_NOT_ACTIVE' });
  assert.equal(statements.length, 1);
});
