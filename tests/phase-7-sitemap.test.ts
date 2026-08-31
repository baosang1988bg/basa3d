import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { getPool } from '../src/lib/db.js';
import sitemap from '../src/app/sitemap.js';
import robots from '../src/app/robots.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('sitemap never lists an admin route and includes the public static routes', { skip: !process.env.DATABASE_URL }, async () => {
  const entries = await sitemap();
  assert.ok(entries.length > 0);
  assert.equal(entries.some((entry) => entry.url.includes('/admin')), false);
  assert.equal(entries.some((entry) => entry.url.endsWith('/blog')), true);
  assert.equal(entries.some((entry) => entry.url.endsWith('/products')), true);
});

test('robots.txt disallows /admin and /api and points at the sitemap', () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  assert.ok(rules);
  const disallow = Array.isArray(rules?.disallow) ? rules.disallow : [rules?.disallow];
  assert.ok(disallow.includes('/admin'));
  assert.ok(disallow.includes('/api'));
  assert.match(String(result.sitemap), /\/sitemap\.xml$/);
});
