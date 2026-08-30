import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { getPool, query } from '../src/lib/db.js';
import { DomainError } from '../src/lib/domain-error.js';
import { acceptQuote, createQuote } from '../src/services/quote.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('accepting an already-accepted quote is rejected and does not create a second print_job', { skip: !process.env.DATABASE_URL }, async () => {
  const actorId = '00000000-0000-4000-8000-0000000000aa';
  const customRequestId = randomUUID();
  await query(
    `insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity)
     values ($1, $2, 'OTHER', 'Quote Accept Test', '0900000000', 'test', 1)`,
    [customRequestId, `CR-${customRequestId.slice(0, 8).toUpperCase()}`],
  );
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const quote = await createQuote({ customRequestId, subtotal: 100_000, total: 100_000, validUntil }, actorId);

  const first = await acceptQuote(quote.id, actorId);
  assert.equal(first.status, 'ACCEPTED');
  assert.ok(first.printJobId);

  await assert.rejects(
    () => acceptQuote(quote.id, actorId),
    (error: unknown) => error instanceof DomainError && error.code === 'QUOTE_ALREADY_FINALIZED',
  );

  const printJobs = await query('select id from print_jobs where quote_id = $1', [quote.id]);
  assert.equal(printJobs.rowCount, 1);
});
