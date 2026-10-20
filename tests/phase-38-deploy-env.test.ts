// Phase 38 hotfix: Production had no UPLOAD_CLAIM_SECRET because scripts/deploy/qc-deploy-vercel.mjs
// never synced it, so createUploadClaim()/verifyUploadClaim() threw and every public upload
// (/custom-print, /bao-gia — .3mf, .stl, images alike) answered 500 "An unexpected error occurred".
// Guard: every env var the server code hard-requires ("X must be configured") must be one the
// release script either syncs from .env, copies, or generates.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function listConst(script: string, name: string): string[] {
  const match = script.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
  assert.ok(match, `${name} not found in qc-deploy-vercel.mjs`);
  return [...match[1].matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]);
}

test('every hard-required server env var is handled by the Vercel release script', () => {
  const required = new Set<string>();
  for (const file of walk('src')) {
    for (const m of readFileSync(file, 'utf8').matchAll(/throw new Error\(['`]([A-Z][A-Z0-9_]+) must be configured/g)) required.add(m[1]);
  }
  assert.ok(required.has('UPLOAD_CLAIM_SECRET') && required.has('ORDER_CONFIRMATION_SECRET'), 'scanner should find the known secrets');

  const script = readFileSync('scripts/deploy/qc-deploy-vercel.mjs', 'utf8');
  const handled = new Set([...listConst(script, 'DB_KEYS'), ...listConst(script, 'COPY_IF_MISSING'), ...listConst(script, 'GENERATED')]);
  const missing = [...required].filter((key) => !handled.has(key));
  assert.deepEqual(missing, [], `release script never sets: ${missing.join(', ')}`);
});

test('generated release secrets are long enough for their runtime checks (>= 32 chars)', () => {
  const script = readFileSync('scripts/deploy/qc-deploy-vercel.mjs', 'utf8');
  assert.match(script, /randomBytes\(32\)\.toString\('hex'\)/); // 64 hex chars
  assert.ok(listConst(script, 'GENERATED').includes('UPLOAD_CLAIM_SECRET'));
});
