import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { themeBootstrapScript } from '../src/lib/theme-script.js';
import nextConfig, { securityHeaders } from '../next.config.mjs';

test('security headers include the baseline and report-only CSP with the real theme hash', async () => {
  const map = new Map(securityHeaders.map((header) => [header.key.toLowerCase(), header.value]));
  assert.equal(map.get('x-content-type-options'), 'nosniff');
  assert.equal(map.get('x-frame-options'), 'DENY');
  assert.equal(map.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(map.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
  const hash = createHash('sha256').update(themeBootstrapScript).digest('base64');
  assert.ok(map.get('content-security-policy-report-only')?.includes(`'sha256-${hash}'`));
  assert.equal((await nextConfig.headers?.())?.[0].source, '/(.*)');
});

test('report-only CSP allows only the privacy-enhanced YouTube embed domain (Phase 54.2)', () => {
  const csp = new Map(securityHeaders.map((header) => [header.key.toLowerCase(), header.value])).get('content-security-policy-report-only') ?? '';
  const frameSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('frame-src'));
  assert.equal(frameSrc, 'frame-src https://www.youtube-nocookie.com');
  assert.ok(csp.includes("frame-ancestors 'none'"));
});
