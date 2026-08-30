import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const PORT = 3411;
const BASE_URL = `http://localhost:${PORT}`;
const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000001';

// Every route/method that must reject an unauthenticated caller. GET routes deliberately left
// public (catalog browsing, per docs/exec-plans/completed/phase-2.md decision #1) are excluded:
// GET /api/products, GET /api/products/variants, GET /api/products/[id]/images.
const PROTECTED_ROUTES: { method: string; path: string }[] = [
  { method: 'POST', path: '/api/categories' },
  { method: 'GET', path: '/api/custom-requests' },
  { method: 'POST', path: '/api/custom-requests' },
  { method: 'PATCH', path: `/api/custom-requests/${PLACEHOLDER_ID}` },
  { method: 'POST', path: '/api/inventory/movements' },
  { method: 'GET', path: `/api/inventory/${PLACEHOLDER_ID}` },
  { method: 'POST', path: '/api/materials/movements' },
  { method: 'POST', path: '/api/orders' },
  { method: 'PATCH', path: `/api/orders/${PLACEHOLDER_ID}` },
  { method: 'POST', path: '/api/products' },
  { method: 'PATCH', path: `/api/products/${PLACEHOLDER_ID}` },
  { method: 'DELETE', path: `/api/products/${PLACEHOLDER_ID}` },
  { method: 'POST', path: '/api/products/variants' },
  { method: 'PATCH', path: `/api/products/variants/${PLACEHOLDER_ID}` },
  { method: 'DELETE', path: `/api/products/variants/${PLACEHOLDER_ID}` },
  { method: 'POST', path: `/api/products/${PLACEHOLDER_ID}/images` },
  { method: 'DELETE', path: `/api/products/images/${PLACEHOLDER_ID}` },
  { method: 'POST', path: '/api/quotes' },
  { method: 'PATCH', path: `/api/quotes/${PLACEHOLDER_ID}` },
  { method: 'GET', path: '/api/staff' },
  { method: 'POST', path: '/api/staff' },
  { method: 'PATCH', path: `/api/staff/${PLACEHOLDER_ID}` },
  { method: 'GET', path: '/api/audit-logs' },
];

let serverProcess: ChildProcess | undefined;

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/admin/login`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server did not become ready on ${BASE_URL} within ${timeoutMs}ms`);
}

before(async () => {
  if (!process.env.DATABASE_URL) return;
  serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'ignore',
  });
  await waitForServer(30_000);
});

after(async () => {
  if (serverProcess) serverProcess.kill('SIGTERM');
});

test('every admin/mutating route rejects an unauthenticated request', { skip: !process.env.DATABASE_URL }, async () => {
  const failures: string[] = [];
  for (const route of PROTECTED_ROUTES) {
    const response = await fetch(`${BASE_URL}${route.path}`, {
      method: route.method,
      headers: { 'content-type': 'application/json' },
      body: route.method === 'GET' || route.method === 'DELETE' ? undefined : '{}',
    });
    if (response.status !== 401 && response.status !== 403) {
      failures.push(`${route.method} ${route.path} -> ${response.status} (expected 401 or 403)`);
    }
  }
  assert.deepEqual(failures, []);
});
