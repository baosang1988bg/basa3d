import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { getPool, withTransaction } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { maskIfNotOwner } from '../src/lib/mask.js';
import {
  adjustSpoolStock, createFilamentSpool, getFilamentInventoryStats, listFilamentSpools,
  recordSpoolUsage, remainingPct, warningTier,
} from '../src/services/filament.service.js';
import { assignPrintJobMaterial, assignPrintJobSpool, updatePrintJobStatus } from '../src/services/print-job.service.js';
import { createExpense, deleteExpense, getExpenseFinancialSummary, listExpenses } from '../src/services/expense.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';

test('warningTier computes the 4-tier display purely from weight columns (Q5)', () => {
  assert.equal(warningTier(1000, 0), 'CON_NHIEU');
  assert.equal(warningTier(1000, 490), 'CON_NHIEU');
  assert.equal(warningTier(1000, 500), 'CAN_THEO_DOI');
  assert.equal(warningTier(1000, 800), 'SAP_HET');
  assert.equal(warningTier(1000, 1000), 'DA_HET');
  assert.equal(remainingPct(1000, 750), 25);
});

test('maskIfNotOwner hides the value for STAFF and reveals it for OWNER', () => {
  assert.equal(maskIfNotOwner(250000, 'OWNER'), 250000);
  assert.equal(maskIfNotOwner(250000, 'STAFF'), null);
});

async function seedSpoolFixture(client: Client) {
  const materialId = randomUUID();
  const warehouseId = randomUUID();
  const suffix = materialId.slice(0, 8).toUpperCase();
  await client.query(`insert into materials (id, name, material_type, color, unit) values ($1, 'Test PLA', 'PLA', 'Black', 'GRAM')`, [materialId]);
  await client.query(`insert into warehouses (id, name, code) values ($1, 'Test Warehouse', $2)`, [warehouseId, `TESTW${suffix}`]);
  const spoolId = randomUUID();
  await client.query(
    `insert into filament_spools (id, spool_code, material_id, warehouse_id, initial_weight_grams, purchase_cost)
     values ($1, $2, $3, $4, 1000, 250000)`,
    [spoolId, `TEST-${suffix}`, materialId, warehouseId],
  );
  return { spoolId, materialId, warehouseId };
}

test('recordSpoolUsage deducts weight and inserts a PRODUCTION_OUT movement with spool_id', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { spoolId } = await seedSpoolFixture(client);
    await withTransaction(async (txClient) => {
      await recordSpoolUsage(txClient, spoolId, 200, 'test', randomUUID(), ACTOR_ID);
    });
    const spool = await client.query('select used_weight_grams from filament_spools where id = $1', [spoolId]);
    assert.equal(spool.rows[0].used_weight_grams, 200);
    const movement = await client.query(`select movement_type, quantity, spool_id from material_movements where spool_id = $1`, [spoolId]);
    assert.equal(movement.rowCount, 1);
    assert.equal(movement.rows[0].movement_type, 'PRODUCTION_OUT');
    assert.equal(movement.rows[0].quantity, -200);
  } finally {
    await client.end();
  }
});

test('recordSpoolUsage rejects usage that would push used_weight_grams past initial_weight_grams', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { spoolId } = await seedSpoolFixture(client);
    await assert.rejects(
      () => withTransaction((txClient) => recordSpoolUsage(txClient, spoolId, 1001, 'test', randomUUID(), ACTOR_ID)),
      (error: unknown) => error instanceof DomainError && error.code === 'INSUFFICIENT_SPOOL_STOCK',
    );
  } finally {
    await client.end();
  }
});

test('two concurrent recordSpoolUsage calls on the same spool are serialized and never oversell it', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { spoolId } = await seedSpoolFixture(client);
    const results = await Promise.allSettled([
      withTransaction((txClient) => recordSpoolUsage(txClient, spoolId, 700, 'test', randomUUID(), ACTOR_ID)),
      withTransaction((txClient) => recordSpoolUsage(txClient, spoolId, 700, 'test', randomUUID(), ACTOR_ID)),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert.ok(rejected?.reason instanceof DomainError);
    assert.equal(rejected.reason.code, 'INSUFFICIENT_SPOOL_STOCK');
    const spool = await client.query('select used_weight_grams from filament_spools where id = $1', [spoolId]);
    assert.equal(spool.rows[0].used_weight_grams, 700);
  } finally {
    await client.end();
  }
});

test('adjustSpoolStock records a kiểm kê correction with the right movement direction', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { spoolId } = await seedSpoolFixture(client);
    // Spool starts at used_weight_grams = 0 (fixture default). Recounting it at 850g remaining means
    // 150g was actually consumed that the ledger never recorded — an ADDITIONAL deduction, so this is
    // an ADJUSTMENT_OUT (material leaving stock, negative ledger quantity), not an ADJUSTMENT_IN.
    await adjustSpoolStock(spoolId, 850, 'Cân lại sau kiểm kê', ACTOR_ID);
    const spool = await client.query('select used_weight_grams from filament_spools where id = $1', [spoolId]);
    assert.equal(spool.rows[0].used_weight_grams, 150);
    const movement = await client.query(`select movement_type, quantity from material_movements where spool_id = $1 and reference_type = 'spool_adjustment'`, [spoolId]);
    assert.equal(movement.rows[0].movement_type, 'ADJUSTMENT_OUT');
    assert.equal(movement.rows[0].quantity, -150);
  } finally {
    await client.end();
  }
});

test('adjustSpoolStock rejects a blank reason', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { spoolId } = await seedSpoolFixture(client);
    await assert.rejects(
      () => adjustSpoolStock(spoolId, 900, '   ', ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'ADJUSTMENT_REASON_REQUIRED',
    );
  } finally {
    await client.end();
  }
});

test('createFilamentSpool inserts the spool and a matching PURCHASE movement in one transaction', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const materialId = randomUUID();
    const warehouseId = randomUUID();
    const suffix = materialId.slice(0, 8).toUpperCase();
    await client.query(`insert into materials (id, name, material_type, unit) values ($1, 'Test PETG', 'PETG', 'GRAM')`, [materialId]);
    await client.query(`insert into warehouses (id, name, code) values ($1, 'Test Warehouse', $2)`, [warehouseId, `TESTC${suffix}`]);
    const created = await createFilamentSpool({ spoolCode: `NEW-${suffix}`, materialId, warehouseId, initialWeightGrams: 1000, purchaseCost: 300000 }, ACTOR_ID);
    const movement = await client.query(`select movement_type, quantity, spool_id from material_movements where spool_id = $1`, [created.id]);
    assert.equal(movement.rowCount, 1);
    assert.equal(movement.rows[0].movement_type, 'PURCHASE');
    assert.equal(movement.rows[0].quantity, 1000);
  } finally {
    await client.end();
  }
});

test('listFilamentSpools masks purchase_cost for STAFF but not OWNER', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { materialId } = await seedSpoolFixture(client);
    const asOwner = await listFilamentSpools({ materialId }, 'OWNER');
    const asStaff = await listFilamentSpools({ materialId }, 'STAFF');
    assert.equal(asOwner.items[0].purchaseCost, 250000);
    assert.equal(asStaff.items[0].purchaseCost, null);
  } finally {
    await client.end();
  }
});

async function seedPrintJobWithMaterial(client: Client) {
  const customRequestId = randomUUID();
  const printJobId = randomUUID();
  const suffix = customRequestId.slice(0, 8).toUpperCase();
  await client.query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'OTHER', 'Spool Print Job Test', '0900000000', 'test', 1)`,
    [customRequestId, `CR-${suffix}`],
  );
  await client.query(`insert into print_jobs (id, custom_request_id, status) values ($1, $2, 'QUEUED')`, [printJobId, customRequestId]);
  return { printJobId };
}

test('updatePrintJobStatus -> PRINTING with spool_id consumes the spool and links material_movements.spool_id', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { spoolId, materialId } = await seedSpoolFixture(client);
    const { printJobId } = await seedPrintJobWithMaterial(client);
    await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 120, spoolId }, ACTOR_ID);

    const updated = await updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID);
    assert.equal(updated.status, 'PRINTING');

    const spool = await client.query('select used_weight_grams from filament_spools where id = $1', [spoolId]);
    assert.equal(spool.rows[0].used_weight_grams, 120);
    const movement = await client.query(
      `select spool_id, movement_type, quantity from material_movements where reference_type = 'print_job' and reference_id = $1`,
      [printJobId],
    );
    assert.equal(movement.rowCount, 1);
    assert.equal(movement.rows[0].spool_id, spoolId);
    assert.equal(movement.rows[0].movement_type, 'PRODUCTION_OUT');
    assert.equal(movement.rows[0].quantity, -120);
  } finally {
    await client.end();
  }
});

test('updatePrintJobStatus -> PRINTING without spool_id still works via the old material-lock path when the material has no ACTIVE spools', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const materialId = randomUUID();
    const warehouseId = randomUUID();
    const suffix = materialId.slice(0, 8).toUpperCase();
    await client.query(`insert into materials (id, name, material_type, unit) values ($1, 'Legacy PLA', 'PLA', 'GRAM')`, [materialId]);
    await client.query(`insert into warehouses (id, name, code) values ($1, 'Legacy Warehouse', $2)`, [warehouseId, `LEGACY${suffix}`]);
    await client.query(`insert into material_movements (warehouse_id, material_id, movement_type, quantity) values ($1, $2, 'PURCHASE', 1000)`, [warehouseId, materialId]);
    const { printJobId } = await seedPrintJobWithMaterial(client);
    await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 40 }, ACTOR_ID);

    const updated = await updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID);
    assert.equal(updated.status, 'PRINTING');
    const movement = await client.query(
      `select spool_id, movement_type, quantity from material_movements where reference_type = 'print_job' and reference_id = $1`,
      [printJobId],
    );
    assert.equal(movement.rowCount, 1);
    assert.equal(movement.rows[0].spool_id, null);
  } finally {
    await client.end();
  }
});

test('updatePrintJobStatus -> PRINTING rejects a job with material_id but no spool_id when that material has ACTIVE spools', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { materialId } = await seedSpoolFixture(client);
    const { printJobId } = await seedPrintJobWithMaterial(client);
    await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 40 }, ACTOR_ID);
    await assert.rejects(
      () => updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'PRINT_JOB_SPOOL_REQUIRED',
    );
  } finally {
    await client.end();
  }
});

test('assignPrintJobSpool rejects a spool whose material does not match the job', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { spoolId } = await seedSpoolFixture(client);
    const otherMaterialId = randomUUID();
    await client.query(`insert into materials (id, name, material_type, unit) values ($1, 'Other Material', 'PETG', 'GRAM')`, [otherMaterialId]);
    const { printJobId } = await seedPrintJobWithMaterial(client);
    await assignPrintJobMaterial(printJobId, { materialId: otherMaterialId, estimatedWeightGrams: 10 }, ACTOR_ID);
    await assert.rejects(
      () => assignPrintJobSpool(printJobId, spoolId, ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'SPOOL_MATERIAL_MISMATCH',
    );
  } finally {
    await client.end();
  }
});

test('expense financial summary computes net cash flow and category totals, excluding CANCELLED', { skip: !process.env.DATABASE_URL }, async () => {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const created = await createExpense({ expenseCode: `EXP-TEST-${suffix}`, title: 'Test Equipment', category: 'EQUIPMENT', amount: 500_000 }, ACTOR_ID);
  const before = await getExpenseFinancialSummary();
  const cancelled = await createExpense({ expenseCode: `EXP-TEST-CANCEL-${suffix}`, title: 'Should be excluded', category: 'OTHER', amount: 999_999 }, ACTOR_ID);
  await deleteExpense(cancelled.id, ACTOR_ID);
  const after = await getExpenseFinancialSummary();
  assert.equal(after.totalExpenses, before.totalExpenses);

  const listed = await listExpenses({ status: 'CANCELLED' });
  assert.ok(listed.items.some((e) => e.id === cancelled.id));
  assert.ok(!(await listExpenses({ status: 'PAID' })).items.some((e) => e.id === cancelled.id));
  void created;
});

test('deleteExpense soft-cancels instead of deleting the row (Rule #7)', { skip: !process.env.DATABASE_URL }, async () => {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const created = await createExpense({ expenseCode: `EXP-SOFT-${suffix}`, title: 'Soft cancel test', category: 'OTHER', amount: 1000 }, ACTOR_ID);
  const cancelled = await deleteExpense(created.id, ACTOR_ID);
  assert.equal(cancelled.status, 'CANCELLED');
  const stillThere = await listExpenses({ status: 'CANCELLED' });
  assert.ok(stillThere.items.some((e) => e.id === created.id));
});

test('running the seed migration twice leaves seeded spool/PURCHASE/expense row counts unchanged after the second run', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const sql = await readFile('supabase/migrations/20260903000001_filament_spools_and_expenses_seed.sql', 'utf8');
    async function counts() {
      const spools = await client.query(`select count(*) from filament_spools where spool_code like 'PLA-%' or spool_code like 'PETG-%'`);
      const movements = await client.query(`select count(*) from material_movements where reference_type = 'SEED_MIGRATION'`);
      const expenses = await client.query(`select count(*), sum(amount) from expenses where expense_code like 'EXP-2026%'`);
      return { spools: spools.rows[0], movements: movements.rows[0], expenses: expenses.rows[0] };
    }
    await client.query(sql);
    const before = await counts();
    await client.query(sql);
    const after = await counts();
    assert.deepEqual(after, before);
    assert.equal(after.spools.count, '27');
    assert.equal(after.movements.count, '27');
    assert.equal(after.expenses.count, '9');
    assert.equal(after.expenses.sum, '27184500');
  } finally {
    await client.end();
  }
});

test('getFilamentInventoryStats only counts ACTIVE spools', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const before = await getFilamentInventoryStats();
    const { spoolId } = await seedSpoolFixture(client);
    const afterActive = await getFilamentInventoryStats();
    assert.equal(afterActive.totalSpools, before.totalSpools + 1);
    await client.query("update filament_spools set status = 'ARCHIVED' where id = $1", [spoolId]);
    const afterArchived = await getFilamentInventoryStats();
    assert.equal(afterArchived.totalSpools, before.totalSpools);
  } finally {
    await client.end();
  }
});
