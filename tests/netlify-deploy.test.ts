// ADR-0054 — Netlify as an alternative deploy target (docs/operations/deploy-netlify.md).
// Pure tests: no DB, no server.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveBuildInfo, resolveDeployPlatform } from '../src/config/resolve-build-info.mjs';
import { getClientIp } from '../src/lib/rate-limit.js';
import { config as netlifyCronConfig, resolveCronTarget } from '../netlify/functions/cleanup-orphan-uploads.mjs';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

test('platform is decided by the build host, Vercel first, otherwise "other"', () => {
  assert.equal(resolveDeployPlatform({ VERCEL: '1' }), 'vercel');
  assert.equal(resolveDeployPlatform({ VERCEL_ENV: 'preview' }), 'vercel');
  assert.equal(resolveDeployPlatform({ NETLIFY: 'true' }), 'netlify');
  assert.equal(resolveDeployPlatform({ NETLIFY: 'false' }), 'other');
  assert.equal(resolveDeployPlatform({}), 'other');
});

test('Netlify CONTEXT maps to the build channel; APP_CHANNEL / VERCEL_ENV still win', () => {
  const v = '1.0.0';
  assert.equal(resolveBuildInfo({ env: { NETLIFY: 'true', CONTEXT: 'production' }, version: v }).channel, 'production');
  assert.equal(resolveBuildInfo({ env: { NETLIFY: 'true', CONTEXT: 'deploy-preview' }, version: v }).channel, 'preview');
  assert.equal(resolveBuildInfo({ env: { NETLIFY: 'true', CONTEXT: 'branch-deploy' }, version: v }).channel, 'preview');
  assert.equal(resolveBuildInfo({ env: { NETLIFY: 'true', CONTEXT: 'dev' }, version: v }).channel, 'development');
  assert.equal(resolveBuildInfo({ env: { CONTEXT: 'production' }, version: v }).channel, 'development', 'CONTEXT is ignored off Netlify');
  assert.equal(resolveBuildInfo({ env: { NETLIFY: 'true', CONTEXT: 'production', APP_CHANNEL: 'preview' }, version: v }).channel, 'preview');
});

test('Netlify COMMIT_REF is used after the deploy-script and Vercel SHAs, before local git', () => {
  const git = () => 'f'.repeat(40);
  assert.equal(resolveBuildInfo({ env: { COMMIT_REF: SHA }, version: '1.0.0', readGitSha: git }).commit, SHA);
  assert.equal(resolveBuildInfo({ env: { APP_COMMIT_SHA: 'b'.repeat(40), COMMIT_REF: SHA }, version: '1.0.0', readGitSha: git }).commit, 'b'.repeat(40));
});

test('client IP on Netlify comes ONLY from x-nf-client-connection-ip', () => {
  const spoofed = { 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '198.51.100.7' };
  assert.equal(getClientIp(new Headers({ ...spoofed, 'x-nf-client-connection-ip': '192.0.2.10' }), 'netlify'), 'v4:192.0.2.10');
  assert.equal(getClientIp(new Headers(spoofed), 'netlify'), 'unknown', 'client-sent headers are never trusted on Netlify');
});

test('off Netlify, x-nf-client-connection-ip is attacker-controlled and ignored', () => {
  const headers = new Headers({ 'x-nf-client-connection-ip': '192.0.2.10', 'x-real-ip': '203.0.113.5' });
  assert.equal(getClientIp(headers, 'vercel'), 'v4:203.0.113.5');
  assert.equal(getClientIp(headers, 'other'), 'v4:203.0.113.5');
  assert.equal(getClientIp(new Headers({ 'x-nf-client-connection-ip': '192.0.2.10' }), 'vercel'), 'unknown');
});

test('Netlify scheduled cleanup keeps the exact vercel.json cron schedule and path', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: { path: string; schedule: string }[] };
  const cron = vercel.crons.find((entry) => entry.path === '/api/cron/cleanup-orphan-uploads');
  assert.ok(cron, 'vercel.json cron entry missing');
  assert.equal(netlifyCronConfig.schedule, cron.schedule);
  assert.equal(resolveCronTarget({ URL: 'https://basa3d.netlify.app' }), `https://basa3d.netlify.app${cron.path}`);
});

test('cron target prefers the canonical site URL and fails closed when nothing is configured', () => {
  assert.equal(
    resolveCronTarget({ NEXT_PUBLIC_SITE_URL: 'https://basa3d.vn', URL: 'https://basa3d.netlify.app' }),
    'https://basa3d.vn/api/cron/cleanup-orphan-uploads',
  );
  assert.equal(resolveCronTarget({}), null);
  assert.equal(resolveCronTarget({ URL: 'not a url' }), null);
});

test('netlify.toml pins Node 22 and the Next.js build output', () => {
  const toml = readFileSync('netlify.toml', 'utf8');
  assert.match(toml, /command\s*=\s*"npm run build"/);
  assert.match(toml, /publish\s*=\s*"\.next"/);
  assert.match(toml, /NODE_VERSION\s*=\s*"22"/);
});
