import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { getPool } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { nextCustomRequestStatuses, updateCustomRequestStatus } from '../src/services/custom-request.service.js';
import { nextPrintJobStatuses } from '../src/services/print-job.service.js';
import { updateOrderPaymentAndShipping } from '../src/services/order.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';

test('custom request and print job transition maps stop at terminal states', () => {
  assert.deepEqual(nextCustomRequestStatuses('NEW'), ['REVIEWING', 'REJECTED']);
  assert.deepEqual(nextCustomRequestStatuses('CONVERTED'), []);
  assert.deepEqual(nextPrintJobStatuses('QUEUED'), ['PRINTING', 'CANCELLED']);
  assert.deepEqual(nextPrintJobStatuses('COMPLETED'), []);
});

test('custom request service rejects jumps and permits an OWNER override only with a reason', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const id = randomUUID();
  try {
    await client.query(
      `insert into custom_requests (id,request_number,source_channel,customer_name,customer_phone,description,quantity)
       values ($1,$2,'OTHER','Workflow Test','0900000000','test',1)`,
      [id, `CR-${id.slice(0, 8).toUpperCase()}`],
    );
    await assert.rejects(
      () => updateCustomRequestStatus(id, 'CONVERTED', ACTOR_ID, { role: 'STAFF' }),
      (error: unknown) => error instanceof DomainError && error.code === 'INVALID_CUSTOM_REQUEST_TRANSITION',
    );
    await assert.rejects(
      () => updateCustomRequestStatus(id, 'CONVERTED', ACTOR_ID, { role: 'OWNER' }),
      (error: unknown) => error instanceof DomainError && error.code === 'INVALID_CUSTOM_REQUEST_TRANSITION',
    );
    const overridden = await updateCustomRequestStatus(id, 'CONVERTED', ACTOR_ID, { role: 'OWNER', overrideReason: 'Khôi phục dữ liệu đã đối soát' });
    assert.equal(overridden.status, 'CONVERTED');
    const audit = await client.query(`select after_data from audit_logs where entity_id = $1 and action = 'CUSTOM_REQUEST_STATUS_OVERRIDDEN'`, [id]);
    assert.equal(audit.rows[0].after_data.overrideReason, 'Khôi phục dữ liệu đã đối soát');
  } finally {
    await client.end();
  }
});

test('payment and shipping service rejects backward transitions for STAFF', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const id = randomUUID();
  try {
    await client.query(
      `insert into orders (id,order_number,customer_name,customer_phone,subtotal,total,payment_status,shipping_status)
       values ($1,$2,'Workflow Order','0900000000',1000,1000,'PAID','DELIVERED')`,
      [id, `ORD-${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`],
    );
    await assert.rejects(
      () => updateOrderPaymentAndShipping(id, { paymentStatus: 'UNPAID' }, ACTOR_ID, { role: 'STAFF' }),
      (error: unknown) => error instanceof DomainError && error.code === 'INVALID_ORDER_ADMIN_TRANSITION',
    );
  } finally {
    await client.end();
  }
});
