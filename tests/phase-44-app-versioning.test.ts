import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatVersionLabel, resolveBuildInfo } from '../src/config/resolve-build-info.mjs';

// Phase 44 (ADR-0046, docs/operations/versioning.md) — web versioning.

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const read = (path: string) => readFileSync(path, 'utf8');

test('channel: APP_CHANNEL override → VERCEL_ENV → development', () => {
  assert.equal(resolveBuildInfo({ env: { VERCEL_ENV: 'production' }, version: '1.0.0' }).channel, 'production');
  assert.equal(resolveBuildInfo({ env: { VERCEL_ENV: 'preview' }, version: '1.0.0' }).channel, 'preview');
  assert.equal(resolveBuildInfo({ env: {}, version: '1.0.0' }).channel, 'development');
  assert.equal(resolveBuildInfo({ env: { VERCEL_ENV: 'production', APP_CHANNEL: 'Preview' }, version: '1.0.0' }).channel, 'preview');
  assert.equal(resolveBuildInfo({ env: { APP_CHANNEL: 'staging', VERCEL_ENV: 'preview' }, version: '1.0.0' }).channel, 'preview', 'unknown override is ignored');
});

test('commit: deploy-script SHA wins over Vercel git SHA, then local git, then "unknown"', () => {
  const git = () => 'ffffffffffffffffffffffffffffffffffffffff';
  assert.equal(resolveBuildInfo({ env: { APP_COMMIT_SHA: SHA, VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) }, version: '1.0.0', readGitSha: git }).commit, SHA);
  assert.equal(resolveBuildInfo({ env: { VERCEL_GIT_COMMIT_SHA: SHA }, version: '1.0.0', readGitSha: git }).commit, SHA);
  assert.equal(resolveBuildInfo({ env: {}, version: '1.0.0', readGitSha: git }).commit, git());
  assert.equal(resolveBuildInfo({ env: {}, version: '1.0.0', readGitSha: () => undefined }).commit, 'unknown');
});

test('label: production is the bare SemVer, every other channel a pre-release of it', () => {
  assert.equal(formatVersionLabel({ version: '1.0.0', channel: 'production', commit: SHA }), '1.0.0');
  assert.equal(formatVersionLabel({ version: '1.0.0', channel: 'preview', commit: SHA }), '1.0.0-preview.a1b2c3d');
  assert.equal(formatVersionLabel({ version: '1.2.0', channel: 'development', commit: 'unknown' }), '1.2.0-development.unknown');
  // SemVer pre-release identifiers: [0-9A-Za-z-] only, dot-separated.
  assert.match(formatVersionLabel({ version: '1.0.0', channel: 'preview', commit: SHA }), /^\d+\.\d+\.\d+-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*$/);
});

test('package.json carries a SemVer version and CHANGELOG has its section on top', () => {
  const { version } = JSON.parse(read('package.json'));
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  const firstSection = read('CHANGELOG.md').match(/^## \[([^\]]+)\]/m);
  assert.equal(firstSection?.[1], version, 'top CHANGELOG section must be the version being prepared');
});

test('build info is inlined through next.config env and read with literal process.env members', () => {
  const config = read('next.config.mjs');
  for (const key of ['BASA3D_BUILD_VERSION', 'BASA3D_BUILD_CHANNEL', 'BASA3D_BUILD_COMMIT', 'BASA3D_BUILD_TIME']) {
    assert.match(config, new RegExp(`${key}: buildInfo\\.`), key);
    assert.match(read('src/config/build-info.ts'), new RegExp(`process\\.env\\.${key}\\b`), key);
  }
});

test('/api/version is static and the release script verifies it and passes the commit to the build', () => {
  assert.match(read('src/app/api/version/route.ts'), /export const dynamic = 'force-static'/);
  const script = read('scripts/deploy/qc-deploy-vercel.mjs');
  assert.match(script, /'--build-env', `APP_COMMIT_SHA=\$\{fullSha\}`/);
  assert.match(script, /\/api\/version/);
  assert.match(script, /'tag', '-a', tag/);
  assert.doesNotMatch(script, /'push'[^\n]*tag/, 'the script must never push tags itself');
});

test('the environment badge never renders in production', () => {
  assert.match(read('src/components/layout/environment-badge.tsx'), /if \(BUILD_INFO\.channel === 'production'\) return null;/);
});
