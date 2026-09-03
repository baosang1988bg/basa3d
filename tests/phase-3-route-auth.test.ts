import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import nextEnv from '@next/env';
import { mintStaffAccount, type MintedStaffAccount } from './helpers/rbac-accounts.js';

nextEnv.loadEnvConfig(process.cwd());

const PORT = 3411;
const BASE_URL = `http://localhost:${PORT}`;
const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000001';

type MinRole = 'STAFF' | 'OWNER';
type ProtectedRoute = { method: string; path: string; minRole: MinRole };

// Phase 14 (RBAC & route-auth coverage hardening): every src/app/api/**/route.ts method that is
// not deliberately public, audited against ADR-0011's 4 OWNER/STAFF boundaries + ADR-0026's 5th
// (expenses — Server Actions only, no route.ts, so out of scope for this HTTP-level table; see
// docs/architecture/decisions.md's Phase 14 ADR for that audit instead).
//
// GET routes deliberately left public (catalog browsing, docs/exec-plans/completed/phase-2.md
// decision #1) are excluded: GET /api/products, GET /api/products/variants, GET
// /api/products/[id]/images, GET /api/categories (storefront category filter, Phase 8 slice 1 —
// only POST /api/categories is admin-only). Every route under /api/public/* is also deliberately
// unauthenticated (Phase 4 decision #3 / Phase 5 / Phase 6) — that coverage lives in
// tests/phase-4-public-custom-request.test.ts and tests/phase-5-public-orders.test.ts.
//
// `minRole: 'STAFF'` means "any active staff_profiles row" (requireAdmin()); `minRole: 'OWNER'`
// means requireOwner() — the actual gap this phase closes: the old table only recorded
// {method, path} and only asserted "401 or 403", which could never catch a STAFF-passable route
// that should have been OWNER-only.
const PROTECTED_ROUTES: ProtectedRoute[] = [
  // Found missing entirely during the Phase 14 audit (src/app/api/admin/pricing/parse-3mf/route.ts,
  // shipped in Phase 9) — this was the concrete gap phase-14.md section 1 flagged.
  { method: 'POST', path: '/api/admin/pricing/parse-3mf', minRole: 'STAFF' },
  // Phase 13: MakerWorld URL resolver — STAFF/OWNER only, mirrors parse-3mf's auth boundary.
  { method: 'POST', path: '/api/admin/pricing/resolve-makerworld', minRole: 'STAFF' },
  { method: 'GET', path: '/api/audit-logs', minRole: 'OWNER' }, // ADR-0011 boundary #4: audit log viewer.
  { method: 'POST', path: '/api/categories', minRole: 'STAFF' },
  { method: 'GET', path: '/api/custom-requests', minRole: 'STAFF' },
  { method: 'POST', path: '/api/custom-requests', minRole: 'STAFF' },
  { method: 'PATCH', path: `/api/custom-requests/${PLACEHOLDER_ID}`, minRole: 'STAFF' },
  { method: 'GET', path: `/api/inventory/${PLACEHOLDER_ID}`, minRole: 'STAFF' },
  { method: 'POST', path: '/api/inventory/movements', minRole: 'STAFF' },
  { method: 'POST', path: '/api/materials/movements', minRole: 'STAFF' },
  { method: 'PATCH', path: `/api/orders/${PLACEHOLDER_ID}`, minRole: 'STAFF' },
  { method: 'POST', path: '/api/orders', minRole: 'STAFF' },
  { method: 'POST', path: `/api/products/${PLACEHOLDER_ID}/images`, minRole: 'STAFF' },
  { method: 'PATCH', path: `/api/products/${PLACEHOLDER_ID}`, minRole: 'STAFF' },
  { method: 'DELETE', path: `/api/products/${PLACEHOLDER_ID}`, minRole: 'OWNER' }, // ADR-0011 boundary #3: hard delete.
  { method: 'DELETE', path: `/api/products/images/${PLACEHOLDER_ID}`, minRole: 'STAFF' },
  { method: 'POST', path: '/api/products', minRole: 'STAFF' },
  { method: 'PATCH', path: `/api/products/variants/${PLACEHOLDER_ID}`, minRole: 'STAFF' },
  { method: 'DELETE', path: `/api/products/variants/${PLACEHOLDER_ID}`, minRole: 'OWNER' }, // ADR-0011 boundary #3: hard delete.
  { method: 'POST', path: '/api/products/variants', minRole: 'STAFF' },
  { method: 'PATCH', path: `/api/quotes/${PLACEHOLDER_ID}`, minRole: 'STAFF' },
  { method: 'POST', path: '/api/quotes', minRole: 'STAFF' },
  { method: 'GET', path: '/api/staff', minRole: 'OWNER' }, // ADR-0011 boundary #1: staff management.
  { method: 'POST', path: '/api/staff', minRole: 'OWNER' }, // ADR-0011 boundary #1: staff management.
  { method: 'PATCH', path: `/api/staff/${PLACEHOLDER_ID}`, minRole: 'OWNER' }, // ADR-0011 boundary #1: staff management.
];

async function callRoute(route: ProtectedRoute, cookieHeader?: string): Promise<Response> {
  return fetch(`${BASE_URL}${route.path}`, {
    method: route.method,
    headers: {
      'content-type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: route.method === 'GET' || route.method === 'DELETE' ? undefined : '{}',
  });
}

const hasDb = !!process.env.DATABASE_URL;
const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
// The 401-vs-unauthenticated check only needs a running server (DATABASE_URL); minting real
// accounts additionally needs SUPABASE_SERVICE_ROLE_KEY (see tests/helpers/rbac-accounts.ts).
const canMintAccounts = hasDb && hasServiceRole;

let owner: MintedStaffAccount | undefined;
let staff: MintedStaffAccount | undefined;

before(async () => {
  if (!canMintAccounts) return;
  [owner, staff] = await Promise.all([mintStaffAccount('OWNER'), mintStaffAccount('STAFF')]);
});

after(async () => {
  await Promise.all([owner?.cleanup(), staff?.cleanup()].filter((p): p is Promise<void> => !!p));
});

test('every protected route rejects an unauthenticated request with 401 or 403', { skip: !hasDb }, async () => {
  const failures: string[] = [];
  for (const route of PROTECTED_ROUTES) {
    const response = await callRoute(route);
    if (response.status !== 401 && response.status !== 403) {
      failures.push(`${route.method} ${route.path} -> ${response.status} (expected 401 or 403)`);
    }
  }
  assert.deepEqual(failures, []);
});

// The actual gap this phase closes: a logged-in STAFF caller must get exactly 403 (proves
// requireOwner() ran and rejected the role), never 401 (which would mean the request was never
// recognized as authenticated at all — a much weaker, wrong signal for this case).
test('every OWNER-only route rejects a logged-in STAFF caller with exactly 403', { skip: !canMintAccounts }, async () => {
  const failures: string[] = [];
  for (const route of PROTECTED_ROUTES.filter((r) => r.minRole === 'OWNER')) {
    const response = await callRoute(route, staff!.cookieHeader);
    if (response.status !== 403) {
      failures.push(`${route.method} ${route.path} -> ${response.status} (expected exactly 403 for a STAFF caller against an OWNER-only route)`);
    }
  }
  assert.deepEqual(failures, []);
});

test('every route accepts a caller who meets its minimum role', { skip: !canMintAccounts }, async () => {
  const failures: string[] = [];
  for (const route of PROTECTED_ROUTES) {
    const account = route.minRole === 'OWNER' ? owner! : staff!;
    const response = await callRoute(route, account.cookieHeader);
    if (response.status === 401 || response.status === 403) {
      failures.push(`${route.method} ${route.path} -> ${response.status} (expected neither 401 nor 403 for a ${route.minRole}-or-above caller)`);
    }
  }
  assert.deepEqual(failures, []);
});

test('GET /api/categories does not require auth', { skip: !hasDb }, async () => {
  const response = await fetch(`${BASE_URL}/api/categories`);
  assert.equal(response.status, 200);
});
