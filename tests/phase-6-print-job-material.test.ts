import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { getPool } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { assignPrintJobMaterial, updatePrintJobStatus } from '../src/services/print-job.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';

async function seedPrintJobFixture(client: Client) {
  const customRequestId = randomUUID();
  const materialId = randomUUID();
  const warehouseId = randomUUID();
  const printJobId = randomUUID();
  const suffix = customRequestId.slice(0, 8).toUpperCase();

  await client.query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'OTHER', 'Print Job Material Test', '0900000000', 'test', 1)`,
    [customRequestId, `CR-${suffix}`],
  );
  await client.query(`insert into warehouses (id, name, code) values ($1, 'Test Warehouse', $2)`, [warehouseId, `TEST${suffix}`]);
  await client.query(
    `insert into materials (id, name, material_type, unit) values ($1, 'Test PLA', 'PLA', 'GRAM')`,
    [materialId],
  );
  // Stock the warehouse with enough material for resolveWarehouseForMaterial to find it.
  await client.query(
    `insert into material_movements (warehouse_id, material_id, movement_type, quantity) values ($1, $2, 'PURCHASE', 1000)`,
    [warehouseId, materialId],
  );
  await client.query(
    `insert into print_jobs (id, custom_request_id, status) values ($1, $2, 'QUEUED')`,
    [printJobId, customRequestId],
  );
  return { printJobId, materialId, warehouseId };
}

test('transitioning to PRINTING without an assigned material is rejected', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { printJobId } = await seedPrintJobFixture(client);
    await assert.rejects(
      () => updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'PRINT_JOB_MATERIAL_REQUIRED',
    );
    const movements = await client.query(`select id from material_movements where reference_type = 'print_job' and reference_id = $1`, [printJobId]);
    assert.equal(movements.rowCount, 0);
  } finally {
    await client.end();
  }
});

test('transitioning to PRINTING with material assigned deducts stock exactly once', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { printJobId, materialId, warehouseId } = await seedPrintJobFixture(client);
    await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 50 }, ACTOR_ID);

    const updated = await updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID);
    assert.equal(updated.status, 'PRINTING');

    const movements = await client.query(
      `select warehouse_id, movement_type, quantity, reference_type, reference_id from material_movements where reference_type = 'print_job' and reference_id = $1`,
      [printJobId],
    );
    assert.equal(movements.rowCount, 1);
    assert.equal(movements.rows[0].movement_type, 'PRODUCTION_OUT');
    assert.equal(movements.rows[0].quantity, -50);
    assert.equal(movements.rows[0].warehouse_id, warehouseId);
  } finally {
    await client.end();
  }
});

test('two concurrent QUEUED->PRINTING requests only deduct stock once', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { printJobId, materialId } = await seedPrintJobFixture(client);
    await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 30 }, ACTOR_ID);

    const results = await Promise.allSettled([
      updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID),
      updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof DomainError);
    assert.equal(rejected[0].reason.code, 'INVALID_PRINT_JOB_TRANSITION');

    const movements = await client.query(`select id from material_movements where reference_type = 'print_job' and reference_id = $1`, [printJobId]);
    assert.equal(movements.rowCount, 1);
  } finally {
    await client.end();
  }
});

test('two different print jobs competing for the last material stock: exactly one starts', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const first = await seedPrintJobFixture(client);
    const secondRequestId = randomUUID();
    const secondJobId = randomUUID();
    await client.query(
      `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
       values ($1,$2,'OTHER','Second Material Race','0900000001','test',1)`,
      [secondRequestId, `CR-${secondRequestId.slice(0, 8).toUpperCase()}`],
    );
    await client.query(`insert into print_jobs (id, custom_request_id, status) values ($1,$2,'QUEUED')`, [secondJobId, secondRequestId]);
    // Fixture starts with 1000g; each job asks for 700g, so serialization must reject one.
    await assignPrintJobMaterial(first.printJobId, { materialId: first.materialId, estimatedWeightGrams: 700 }, ACTOR_ID);
    await assignPrintJobMaterial(secondJobId, { materialId: first.materialId, estimatedWeightGrams: 700 }, ACTOR_ID);

    const results = await Promise.allSettled([
      updatePrintJobStatus(first.printJobId, 'PRINTING', ACTOR_ID),
      updatePrintJobStatus(secondJobId, 'PRINTING', ACTOR_ID),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    assert.ok(rejected?.reason instanceof DomainError);
    assert.equal(rejected.reason.code, 'INSUFFICIENT_MATERIAL_STOCK');

    const balance = await client.query('select sum(quantity) as balance from material_movements where material_id = $1', [first.materialId]);
    assert.equal(Number(balance.rows[0].balance), 300);
  } finally {
    await client.end();
  }
});

test('a REPRINT after FAILED deducts stock a second time, not blocked as a false double-consumption', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { printJobId, materialId } = await seedPrintJobFixture(client);
    await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 20 }, ACTOR_ID);

    await updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID);
    await updatePrintJobStatus(printJobId, 'FAILED', ACTOR_ID);
    await updatePrintJobStatus(printJobId, 'REPRINT', ACTOR_ID);
    const second = await updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID);
    assert.equal(second.status, 'PRINTING');

    const movements = await client.query(
      `select quantity from material_movements where reference_type = 'print_job' and reference_id = $1 order by created_at`,
      [printJobId],
    );
    assert.equal(movements.rowCount, 2);
    assert.equal(movements.rows[0].quantity, -20);
    assert.equal(movements.rows[1].quantity, -20);
  } finally {
    await client.end();
  }
});

test('assignPrintJobMaterial rejects an unknown print job', { skip: !process.env.DATABASE_URL }, async () => {
  await assert.rejects(
    () => assignPrintJobMaterial(randomUUID(), { materialId: randomUUID(), estimatedWeightGrams: 10 }, ACTOR_ID),
    (error: unknown) => error instanceof DomainError && error.code === 'PRINT_JOB_NOT_FOUND',
  );
});

test('resolveWarehouseForMaterial-driven deduction fails clearly when no warehouse has enough stock', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { printJobId, materialId } = await seedPrintJobFixture(client);
    // Ask for far more than the 1000g the fixture stocked.
    await assignPrintJobMaterial(printJobId, { materialId, estimatedWeightGrams: 5_000 }, ACTOR_ID);
    await assert.rejects(
      () => updatePrintJobStatus(printJobId, 'PRINTING', ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'INSUFFICIENT_MATERIAL_STOCK',
    );
  } finally {
    await client.end();
  }
});

test('print job terminal and backward transitions are rejected for regular operations', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { printJobId } = await seedPrintJobFixture(client);
    await assert.rejects(
      () => updatePrintJobStatus(printJobId, 'COMPLETED', ACTOR_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'INVALID_PRINT_JOB_TRANSITION',
    );
  } finally {
    await client.end();
  }
});
