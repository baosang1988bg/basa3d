// ADR-0066 — Owner decisions after the QA audit: quote-only business mode, request status follows its
// quotes, and the first low-risk performance pass. Pure / source checks (no DB needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { syncedCustomRequestStatus, nextCustomRequestStatuses } from '../src/domain/custom-request-status';
import { SERVER_ONLY_MESSAGE_NAMESPACES, pickClientMessages } from '../src/i18n/client-messages';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test('request status follows its quotes, forward only', () => {
  assert.equal(syncedCustomRequestStatus('NEW', 'QUOTE_CREATED'), 'QUOTED');
  assert.equal(syncedCustomRequestStatus('REVIEWING', 'QUOTE_CREATED'), 'QUOTED');
  assert.equal(syncedCustomRequestStatus('NEED_INFO', 'QUOTE_CREATED'), 'QUOTED');
  assert.equal(syncedCustomRequestStatus('QUOTED', 'QUOTE_CREATED'), null);
  assert.equal(syncedCustomRequestStatus('APPROVED', 'QUOTE_CREATED'), null);
  assert.equal(syncedCustomRequestStatus('REJECTED', 'QUOTE_CREATED'), null);

  assert.equal(syncedCustomRequestStatus('NEW', 'QUOTE_ACCEPTED'), 'APPROVED');
  assert.equal(syncedCustomRequestStatus('QUOTED', 'QUOTE_ACCEPTED'), 'APPROVED');
  for (const closed of ['APPROVED', 'CONVERTED', 'REJECTED']) assert.equal(syncedCustomRequestStatus(closed, 'QUOTE_ACCEPTED'), null, closed);

  // Never a move the manual workflow could not reach from QUOTED (APPROVED is QUOTED's forward step).
  assert.ok(nextCustomRequestStatuses('QUOTED').includes('APPROVED'));
});

test('quote service syncs the request inside the same transaction', () => {
  const source = readFileSync('src/services/quote.service.ts', 'utf8');
  assert.match(source, /syncCustomRequestStatus\(client, input\.customRequestId, customRequest\.rows\[0\]\.status, 'QUOTE_CREATED', actorId\)/);
  assert.match(source, /syncCustomRequestStatus\(client, quote\.rows\[0\]\.custom_request_id, request\.rows\[0\]\?\.status \?\? '', 'QUOTE_ACCEPTED', actorId\)/);
  assert.match(source, /'CUSTOM_REQUEST_STATUS_SYNCED'/);
});

test('quote-only business mode is OFF by default and only hides UI', () => {
  const mode = readFileSync('src/config/business-mode.ts', 'utf8');
  assert.match(mode, /readyStock: process\.env\.NEXT_PUBLIC_READY_STOCK_ENABLED === 'true'/);
  assert.match(mode, /printJobs: process\.env\.NEXT_PUBLIC_PRINT_JOBS_ENABLED === 'true'/);
  assert.match(mode, /orders: process\.env\.NEXT_PUBLIC_CART_ENABLED === 'true'/);
  const nav = readFileSync('src/components/admin/admin-nav.tsx', 'utf8');
  for (const flag of ['BUSINESS_MODE.orders', 'BUSINESS_MODE.printJobs', 'BUSINESS_MODE.readyStock']) assert.ok(nav.includes(`enabled: ${flag}`), flag);
  const example = readFileSync('.env.example', 'utf8');
  assert.match(example, /NEXT_PUBLIC_READY_STOCK_ENABLED=false/);
  assert.match(example, /NEXT_PUBLIC_PRINT_JOBS_ENABLED=false/);
});

test('perf: server-only message namespaces are dropped from the client payload', () => {
  const picked = pickClientMessages({ nav: { a: 1 }, policies: { b: 2 }, home: { c: 3 }, tools: { d: 4 }, products: { e: 5 } });
  assert.deepEqual(Object.keys(picked).sort(), ['nav', 'products']);
  assert.match(readFileSync('src/app/[locale]/layout.tsx', 'utf8'), /<NextIntlClientProvider messages=\{messages\}>/);
});

test('perf guard: no client component reads a server-only namespace', () => {
  const offenders: string[] = [];
  for (const file of walk('src')) {
    const code = readFileSync(file, 'utf8');
    if (!/^\s*['"]use client['"]/.test(code)) continue;
    for (const namespace of SERVER_ONLY_MESSAGE_NAMESPACES) {
      if (new RegExp(`useTranslations\\(\\s*['"\`]${namespace}(['"\`.])`).test(code)) offenders.push(`${file} → ${namespace}`);
    }
    if (/useTranslations\(\s*\)/.test(code)) offenders.push(`${file} → useTranslations() without namespace`);
  }
  assert.deepEqual(offenders, []);
});

test('perf: product gallery mounts only images the customer has opened', () => {
  const gallery = readFileSync('src/app/[locale]/(storefront)/products/[slug]/product-gallery.tsx', 'utf8');
  assert.match(gallery, /index === activeIndex \|\| mounted\.has\(index\)/);
  assert.match(gallery, /priority=\{index === 0\}/);
});
