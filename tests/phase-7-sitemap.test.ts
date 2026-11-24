import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';
import sitemap from '../src/app/sitemap.js';
import robots from '../src/app/robots.js';

configureTestEnvironment();
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('sitemap never lists an admin route and includes the public static routes', { skip: !process.env.DATABASE_URL }, async () => {
  const entries = await sitemap();
  assert.ok(entries.length > 0);
  assert.equal(entries.some((entry) => entry.url.includes('/basaadmin')), false);
  assert.equal(entries.some((entry) => entry.url.endsWith('/blog')), true);
  assert.equal(entries.some((entry) => entry.url.endsWith('/products')), true);
});

// ADR-0059 (showcase-only): robots.txt must NOT name the admin path (it would advertise it); the admin is
// protected by auth + noindex instead. tests/showcase-only.test.ts asserts the same from the other side.
test('robots.txt disallows /api, does not reveal the admin path, and points at the sitemap', () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  assert.ok(rules);
  const disallow = Array.isArray(rules?.disallow) ? rules.disallow : [rules?.disallow];
  assert.ok(!disallow.some((entry) => String(entry).includes('admin')));
  assert.ok(disallow.includes('/api'));
  assert.match(String(result.sitemap), /\/sitemap\.xml$/);
});
