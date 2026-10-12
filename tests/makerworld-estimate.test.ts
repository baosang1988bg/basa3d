// Phase B public estimate service (makerworld-phase-b-storefront-estimate.md §1, §3, ADR-0033).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import { MakerWorldNotFoundError, type FetchLike } from '../src/lib/parsers/makerworld-resolver.js';
import { makerWorldPricePresetInputSchema } from '../src/domain/schemas.js';
import { savePricePreset } from '../src/services/makerworld-price-preset.service.js';
import {
  RESOLVER_GLOBAL_BUDGET_PER_HOUR,
  estimateMakerWorldUrl,
  estimateMakerWorldWithSpec,
  isPublicResolverEnabled,
  referencePriceFor,
  roundAutoEstimate,
} from '../src/services/makerworld-estimate.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

const FORBIDDEN_DTO_KEYS = ['unitCost', 'margin', 'pricingConfig', 'breakdown', 'materialCost', 'laborCost', 'machineDepreciation', 'materialId'];

test('rejects non-MakerWorld and look-alike URLs before touching the DB', async () => {
  for (const url of ['https://evil.com/makerworld.com/en/models/1', 'http://makerworld.com/en/models/1', 'https://makerworld.com.evil.com/en/models/1', 'makerworld.com/en/models/1']) {
    await assert.rejects(() => estimateMakerWorldUrl(url), MakerWorldNotFoundError, url);
  }
});

test('auto estimates round to 5.000đ; the public resolver is OFF unless explicitly enabled', () => {
  assert.equal(roundAutoEstimate(152_000), 150_000);
  assert.equal(roundAutoEstimate(153_000), 155_000);
  assert.equal(isPublicResolverEnabled({}), false);
  assert.equal(isPublicResolverEnabled({ MAKERWORLD_PUBLIC_RESOLVER_ENABLED: '1' }), false);
  assert.equal(isPublicResolverEnabled({ MAKERWORLD_PUBLIC_RESOLVER_ENABLED: 'true' }), true);
});

// ---------------------------------------------------------------- DB

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const uniqueModelId = () => String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000));

async function seedConfigAndMaterial(): Promise<{ configId: string; materialId: string }> {
  const configId = randomUUID();
  await query(`insert into pricing_configs (id, electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw, labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd, effective_from)
    values ($1, 3500, 15000000, 10000, 0.2, 35000, 10, 40, 5000, timezone('utc', now()) - interval '1 second')`, [configId]);
  const materialId = randomUUID();
  await query(`insert into materials (id, name, material_type, unit, current_unit_cost, is_active) values ($1, $2, 'PLA', 'GRAM', 300, true)`, [materialId, `Estimate test ${materialId.slice(0, 6)}`]);
  return { configId, materialId };
}

test('VERIFIED: returns the admin-verified prices, pre-selects the #profileId, and leaks no cost fields', { skip: !hasDb }, async () => {
  const { configId, materialId } = await seedConfigAndMaterial();
  const modelId = uniqueModelId();
  const url = `https://makerworld.com/en/models/${modelId}-frankenstein#profileId-3678340`;
  const saved = await savePricePreset(makerWorldPricePresetInputSchema.parse({
    sourceUrl: url, profileId: '3678340', tier: 'KIT',
    profileSnapshot: {
      modelTitle: 'Frankenstein', profileTitle: '0.2mm layer', profileCoverImageUrl: null, printerTarget: 'P1S',
      platesCount: 6, printMinutes: 443, netWeightGrams: 168, amsRequired: false, colorsCount: 1, license: null, dataSource: 'RESOLVER',
    },
    materialLines: [{ label: 'PLA', materialId, materialType: 'PLA', gram: 176.4 }],
    printMinutes: 443, laborMinutes: 20, pricingConfigId: configId,
  }), ACTOR_ID);

  const estimate = await estimateMakerWorldUrl(`https://makerworld.com/en/models/${modelId}-frankenstein?utm_source=x#profileId-3678340`);
  assert.equal(estimate.source, 'VERIFIED');
  assert.equal(estimate.selectedProfileId, '3678340');
  assert.equal(estimate.profiles[0].prices.KIT, saved.finalPriceVnd);
  assert.equal(estimate.profiles[0].prices.ASSEMBLED, null);
  assert.equal(estimate.sourceUrl.includes('utm_source'), false);
  const json = JSON.stringify(estimate);
  for (const key of FORBIDDEN_DTO_KEYS) assert.equal(json.includes(key), false, `DTO must not contain ${key}`);

  const reference = await referencePriceFor(url, '3678340', 'KIT');
  assert.deepEqual(reference, { source: 'VERIFIED', priceVnd: saved.finalPriceVnd, modelTitle: 'Frankenstein', profileTitle: '0.2mm layer' });
});

test('NOT_VERIFIED: no preset and resolver disabled → no price, never a guess', { skip: !hasDb }, async () => {
  const estimate = await estimateMakerWorldUrl(`https://makerworld.com/en/models/${uniqueModelId()}`, { env: {} });
  assert.equal(estimate.source, 'NONE');
  assert.equal(estimate.reason, 'NOT_VERIFIED');
  assert.deepEqual(estimate.profiles, []);
});

function realShapeHtml(): string {
  const design = {
    title: 'Auto model', coverUrl: 'https://makerworld.bblmw.com/a.png', license: 'Standard Digital File License',
    instances: [{
      id: 111, title: '0.2mm layer', cover: 'https://makerworld.bblmw.com/b.png', prediction: 26_571, weight: 168, needAms: false,
      instanceFilaments: [{ type: 'PLA', color: '#68724D', usedG: '168' }],
      extention: { modelInfo: { plates: [{}, {}, {}, {}, {}, {}], compatibility: { devProductName: 'P1S' } } },
    }],
  };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { design } } })}</script>`;
}

test('AUTO (flag on): same shared rules, rounded to 5.000đ, cached per model (second call does not hit MakerWorld)', { skip: !hasDb }, async () => {
  await seedConfigAndMaterial();
  const modelId = uniqueModelId();
  let calls = 0;
  const fetchImpl: FetchLike = async () => { calls += 1; return new Response(realShapeHtml(), { status: 200 }); };
  const env = { MAKERWORLD_PUBLIC_RESOLVER_ENABLED: 'true' };
  await query(`delete from makerworld_resolver_cache where fetched_at > now() - interval '1 hour'`);
  const first = await estimateMakerWorldUrl(`https://makerworld.com/en/models/${modelId}#profileId-111`, { env, fetchImpl });
  assert.equal(first.source, 'AUTO');
  assert.equal(first.selectedProfileId, '111');
  for (const price of [first.profiles[0].prices.KIT, first.profiles[0].prices.ASSEMBLED]) {
    assert.ok(price !== null && price > 0 && price % 5_000 === 0);
  }
  assert.ok(first.profiles[0].prices.KIT! <= first.profiles[0].prices.ASSEMBLED!);
  await estimateMakerWorldUrl(`https://makerworld.com/en/models/${modelId}`, { env, fetchImpl });
  assert.equal(calls, 1);
});

test('AUTO (flag on): Cloudflare block → NONE/BLOCKED; global hourly budget → NONE/BUSY without calling MakerWorld', { skip: !hasDb }, async () => {
  const env = { MAKERWORLD_PUBLIC_RESOLVER_ENABLED: 'true' };
  await query(`delete from makerworld_resolver_cache where fetched_at > now() - interval '1 hour'`);
  const blocked = await estimateMakerWorldUrl(`https://makerworld.com/en/models/${uniqueModelId()}`, { env, fetchImpl: async () => new Response('blocked', { status: 403 }) });
  assert.deepEqual([blocked.source, blocked.reason], ['NONE', 'BLOCKED']);

  for (let i = 0; i < RESOLVER_GLOBAL_BUDGET_PER_HOUR; i += 1) {
    await query(`insert into makerworld_resolver_cache (model_id, resolution, outcome, fetched_at) values ($1, null, 'BLOCKED_OR_TIMEOUT', now()) on conflict do nothing`, [uniqueModelId() + String(i)]);
  }
  let calls = 0;
  const busy = await estimateMakerWorldUrl(`https://makerworld.com/en/models/${uniqueModelId()}`, { env, fetchImpl: async () => { calls += 1; return new Response(realShapeHtml()); } });
  assert.deepEqual([busy.source, busy.reason], ['NONE', 'BUSY']);
  assert.equal(calls, 0);
  await query(`delete from makerworld_resolver_cache where fetched_at > now() - interval '1 hour'`);
});

test('AUTO (flag on): multi-color profile with unknown AMS is priced conservatively (as AMS), not left without a price', { skip: !hasDb }, async () => {
  await seedConfigAndMaterial();
  await query(`delete from makerworld_resolver_cache where fetched_at > now() - interval '1 hour'`);
  const design = {
    title: 'Unknown AMS model', coverUrl: null, license: null,
    instances: [{
      id: 222, title: 'multi', prediction: 3_600, weight: 100,
      instanceFilaments: [{ type: 'PLA', color: '#000000', usedG: '60' }, { type: 'PLA', color: '#FFFFFF', usedG: '40' }],
      extention: { modelInfo: { plates: [{}], compatibility: { devProductName: 'A1' } } },
    }],
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { design } } })}</script>`;
  const estimate = await estimateMakerWorldUrl(`https://makerworld.com/en/models/${uniqueModelId()}`, { env: { MAKERWORLD_PUBLIC_RESOLVER_ENABLED: 'true' }, fetchImpl: async () => new Response(html) });
  assert.equal(estimate.source, 'AUTO');
  assert.ok((estimate.profiles[0].prices.KIT ?? 0) > 0);
  await query(`delete from makerworld_resolver_cache where fetched_at > now() - interval '1 hour'`);
});

test('SPEC (option 1): pasted MakerWorld spec line → two tier prices; unreadable text → SPEC_UNREADABLE', { skip: !hasDb }, async () => {
  await seedConfigAndMaterial();
  const url = `https://makerworld.com/en/models/${uniqueModelId()}#profileId-3678340`;
  const estimate = await estimateMakerWorldWithSpec(url, '0.2mm layer, 2 walls, 15% infill · P1S · 7.4 h · 6 plates · 168 g · No AMS');
  assert.equal(estimate.source, 'SPEC');
  assert.equal(estimate.selectedProfileId, '3678340');
  const [profile] = estimate.profiles;
  assert.equal(profile.printMinutes, 444);
  assert.equal(profile.platesCount, 6);
  for (const price of [profile.prices.ASSEMBLED, profile.prices.KIT]) assert.ok(price !== null && price % 5_000 === 0);
  const reference = await referencePriceFor(url, '3678340', 'KIT', '7.4 h · 6 plates · 168 g');
  assert.equal(reference.source, 'SPEC');
  assert.ok((reference.priceVnd ?? 0) > 0);
  const bad = await estimateMakerWorldWithSpec(url, 'xin chào');
  assert.deepEqual([bad.source, bad.reason], ['NONE', 'SPEC_UNREADABLE']);
});
