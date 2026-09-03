import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { getPool } from '../src/lib/db.js';
import { mintQuoteAccessToken, getPublicQuoteByPhoneSuffix, getPublicQuoteByToken } from '../src/services/quote.service.js';
import { createOrderConfirmationToken } from '../src/lib/order-confirmation-token.js';

nextEnv.loadEnvConfig(process.cwd());
process.env.ORDER_CONFIRMATION_SECRET ??= 'phase-13-public-quote-test-secret-at-least-32-chars';

const PORT = 3411;
const BASE_URL = `http://localhost:${PORT}`;
const hasDb = !!process.env.DATABASE_URL;

after(async () => { if (hasDb) await getPool().end(); });

async function seedQuote(client: Client, opts: { validUntil: Date; customerPhone?: string }) {
  const customRequestId = randomUUID();
  const suffix = customRequestId.slice(0, 8);
  const customerPhone = opts.customerPhone ?? `098${customRequestId.replace(/\D/g, '').slice(0, 7)}`;
  await client.query(`
    insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, customer_email, description, quantity, status)
    values ($1, $2, 'ZALO', 'Nguyen Van Test', $3, 'secret-email@example.com', 'Test description', 1, 'QUOTED')`,
  [customRequestId, `CR-${suffix.toUpperCase()}`, customerPhone]);

  // quotes_pricing_snapshot_pair requires pricing_breakdown and pricing_config_id to be both null or
  // both set — a real pricing_configs row is needed here since this fixture sets a real breakdown.
  const pricingConfigId = randomUUID();
  await client.query(`
    insert into pricing_configs (id, electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw, labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd)
    values ($1, 3500, 15000000, 10000, 0.2, 35000, 10, 40, 5000)`,
  [pricingConfigId]);

  const pricingBreakdown = {
    materialCostVnd: 50_000,
    materialLines: [{ label: 'PLA Đỏ', gram: 100, costVnd: 50_000 }],
    electricityCostVnd: 5_000,
    machineDepreciationVnd: 8_000,
    failureBufferVnd: 3_000,
    laborCostVnd: 20_000,
    packagingFeeVnd: 5_000,
    totalCostVnd: 91_000,
    priceBeforeRoundingVnd: 130_000,
    finalPriceVnd: 130_000,
  };
  const modelSnapshot = {
    sourceUrl: 'https://makerworld.com/en/models/123#profileId-456',
    title: 'Ace Snail Controller Stand',
    coverImageUrl: null,
    platesCount: 8,
    totalPrintMinutes: 792,
    colorsCount: 7,
  };
  const quoteId = randomUUID();
  const quoteNumber = `Q-${quoteId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await client.query(`
    insert into quotes (id, custom_request_id, quote_number, subtotal, shipping_fee, discount, total, valid_until, note, pricing_breakdown, pricing_config_id, model_snapshot)
    values ($1,$2,$3,130000,0,0,130000,$4,'Ghi chú test',$5,$6,$7)`,
  [quoteId, customRequestId, quoteNumber, opts.validUntil, JSON.stringify(pricingBreakdown), pricingConfigId, JSON.stringify(modelSnapshot)]);

  return { quoteId, quoteNumber, customerPhone };
}

test('getPublicQuoteByToken returns unmasked name and a public pricing DTO with no internal cost fields', { skip: !hasDb }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const validUntil = new Date(Date.now() + 60 * 60 * 1000);
    const { quoteId, quoteNumber } = await seedQuote(client, { validUntil });
    const token = mintQuoteAccessToken(quoteId, validUntil);
    const result = await getPublicQuoteByToken(quoteNumber, token);
    assert.ok(result);
    assert.equal(result!.customerName, 'Nguyen Van Test');
    assert.equal(result!.modelSnapshot?.platesCount, 8);
    assert.equal(result!.modelSnapshot?.totalPrintMinutes, 792);
    assert.equal(result!.pricing.materials[0].costVnd, 50_000);
    assert.equal(result!.pricing.totalVnd, 130_000);
    assert.equal(result!.pricing.depositVnd, 65_000);
    // Rule #18: machineDepreciationVnd/electricityCostVnd/failureBufferVnd/laborCostVnd never
    // serialized by name — only lumped printCostVnd/finishingCostVnd.
    assert.equal('machineDepreciationVnd' in (result!.pricing as unknown as Record<string, unknown>), false);
    assert.equal(result!.pricing.printCostVnd, 5_000 + 8_000 + 3_000);
    assert.equal(result!.pricing.finishingCostVnd, 20_000);

    // A token minted for a different quote id must not work here.
    const wrongToken = createOrderConfirmationToken(randomUUID(), 60);
    assert.equal(await getPublicQuoteByToken(quoteNumber, wrongToken), null);
  } finally {
    await client.end();
  }
});

test('getPublicQuoteByPhoneSuffix requires the correct last-4 digits and masks the customer name', { skip: !hasDb }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const validUntil = new Date(Date.now() + 60 * 60 * 1000);
    const { quoteNumber, customerPhone } = await seedQuote(client, { validUntil });
    const suffix = customerPhone.slice(-4);

    const wrong = await getPublicQuoteByPhoneSuffix(quoteNumber, '0000');
    assert.equal(wrong, null);

    const right = await getPublicQuoteByPhoneSuffix(quoteNumber, suffix);
    assert.ok(right);
    assert.notEqual(right!.customerName, 'Nguyen Van Test');
    assert.match(right!.customerName, /\*/);
  } finally {
    await client.end();
  }
});

test('GET /quotes/[quoteNumber]: full detail via token, dual-verification fallback, never leaks phone/email, expiry state', { skip: !hasDb }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const validUntil = new Date(Date.now() + 60 * 60 * 1000);
    const { quoteId, quoteNumber, customerPhone } = await seedQuote(client, { validUntil });
    const token = mintQuoteAccessToken(quoteId, validUntil);
    const suffix = customerPhone.slice(-4);

    const withToken = await fetch(`${BASE_URL}/quotes/${quoteNumber}?token=${encodeURIComponent(token)}`);
    assert.equal(withToken.status, 200);
    const withTokenHtml = await withToken.text();
    assert.match(withTokenHtml, /Nguyen Van Test/);
    assert.match(withTokenHtml, /Ace Snail Controller Stand/);
    assert.doesNotMatch(withTokenHtml, new RegExp(customerPhone));
    assert.doesNotMatch(withTokenHtml, /secret-email@example\.com/);
    assert.doesNotMatch(withTokenHtml, /machineDepreciationVnd/);

    const noVerification = await fetch(`${BASE_URL}/quotes/${quoteNumber}`);
    assert.equal(noVerification.status, 200);
    const noVerificationHtml = await noVerification.text();
    assert.doesNotMatch(noVerificationHtml, /Nguyen Van Test/);
    assert.match(noVerificationHtml, /Xác minh để xem báo giá/);

    const wrongPhone = await fetch(`${BASE_URL}/quotes/${quoteNumber}?phoneSuffix=0000`);
    assert.equal(wrongPhone.status, 200);
    const wrongPhoneHtml = await wrongPhone.text();
    assert.doesNotMatch(wrongPhoneHtml, /Nguyen Van Test/);

    const rightPhone = await fetch(`${BASE_URL}/quotes/${quoteNumber}?phoneSuffix=${suffix}`);
    assert.equal(rightPhone.status, 200);
    const rightPhoneHtml = await rightPhone.text();
    assert.doesNotMatch(rightPhoneHtml, /Nguyen Van Test/); // masked, not verbatim
    assert.doesNotMatch(rightPhoneHtml, new RegExp(customerPhone));

    // Expired quote (quotes.valid_until already passed): the page's expiry banner is driven by
    // valid_until independently of token validity — mint a token with an explicit, still-valid TTL
    // (not derived from the already-past valid_until) so we isolate "detail visible via a valid
    // token" from "expiry state shown because valid_until < now".
    const { quoteId: expiredId, quoteNumber: expiredNumber } = await seedQuote(client, { validUntil: new Date(Date.now() - 60_000) });
    const stillValidToken = createOrderConfirmationToken(expiredId, 60);
    const expiredResponse = await fetch(`${BASE_URL}/quotes/${expiredNumber}?token=${encodeURIComponent(stillValidToken)}`);
    assert.equal(expiredResponse.status, 200);
    const expiredHtml = await expiredResponse.text();
    assert.match(expiredHtml, /Đã hết hạn/);
  } finally {
    await client.end();
  }
});
