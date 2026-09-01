import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { getPool } from '../src/lib/db.js';
import { createPricingConfig, getCurrentPricingConfig, listPricingConfigs } from '../src/services/pricing-config.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';

const BASE_INPUT = {
  electricityVndPerKwh: 3_500,
  machinePriceVnd: 15_000_000,
  machineLifetimeHours: 10_000,
  printerPowerKw: 0.2,
  laborVndPerHour: 35_000,
  failureBufferPct: 10,
  marginPct: 40,
  packagingFeeVnd: 5_000,
};

test('createPricingConfig always assigns effective_from server-side, ignoring any caller override', { skip: !process.env.DATABASE_URL }, async () => {
  const { id } = await createPricingConfig(BASE_INPUT, ACTOR_ID);
  const configs = await listPricingConfigs(50);
  const created = configs.find((c) => c.id === id);
  assert.ok(created);
  // Created just now — must be within a few seconds of "now", not a caller-suppliable arbitrary date.
  assert.ok(Date.now() - created!.effectiveFrom.getTime() < 10_000);
  assert.equal(created!.createdBy, ACTOR_ID);
});

test('getCurrentPricingConfig returns the row with the latest effective_from that has already taken effect', { skip: !process.env.DATABASE_URL }, async () => {
  const first = await createPricingConfig(BASE_INPUT, ACTOR_ID);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const second = await createPricingConfig({ ...BASE_INPUT, marginPct: 45 }, ACTOR_ID);

  const current = await getCurrentPricingConfig();
  assert.ok(current);
  assert.equal(current!.id, second.id);
  assert.notEqual(current!.id, first.id);
  assert.equal(Number(current!.marginPct), 45);
});

test('a pricing_configs row created earlier stays retrievable by id even after a newer config exists (immutability for snapshot FKs)', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const older = await createPricingConfig(BASE_INPUT, ACTOR_ID);
    await createPricingConfig({ ...BASE_INPUT, marginPct: 50 }, ACTOR_ID);
    const row = await client.query('select id, margin_pct from pricing_configs where id = $1', [older.id]);
    assert.equal(row.rowCount, 1);
    assert.equal(Number(row.rows[0].margin_pct), 40);
  } finally {
    await client.end();
  }
});

test('quotes/products pricing snapshot columns must be both null or both set together', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { id: configId } = await createPricingConfig(BASE_INPUT, ACTOR_ID);
    const customRequestId = randomUUID();
    const suffix = customRequestId.slice(0, 8).toUpperCase();
    await client.query(
      `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
       values ($1, $2, 'OTHER', 'Pricing Snapshot Pair Test', '0900000000', 'test', 1)`,
      [customRequestId, `CR-${suffix}`],
    );
    // Missing pricing_config_id while pricing_breakdown is set must violate the pair constraint.
    await assert.rejects(() => client.query(
      `insert into quotes (custom_request_id, quote_number, subtotal, total, valid_until, pricing_breakdown)
       values ($1, $2, 10000, 10000, now() + interval '1 day', '{"finalPriceVnd": 10000}'::jsonb)`,
      [customRequestId, `Q-${suffix}`],
    ));
    // Both set together must succeed.
    await client.query(
      `insert into quotes (custom_request_id, quote_number, subtotal, total, valid_until, pricing_breakdown, pricing_config_id)
       values ($1, $2, 10000, 10000, now() + interval '1 day', '{"finalPriceVnd": 10000}'::jsonb, $3)`,
      [customRequestId, `Q2-${suffix}`, configId],
    );
  } finally {
    await client.end();
  }
});
