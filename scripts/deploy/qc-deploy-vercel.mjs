// QC release to Vercel Production (basa3d.vercel.app) in four confirmed steps:
//   1. sync missing env vars into the Vercel Production environment (from .env + generated secrets)
//   2. apply pending DB migrations to the DATABASE_URL in .env (scripts/deploy/apply-pending-migrations.mjs)
//   3. deploy exactly the committed HEAD (git archive → temp dir) with `vercel deploy --prod`
//   4. smoke-check the deployed URL, incl. /api/version = this exact commit (Phase 44)
//   5. tag the release: annotated `v<package.json version>` at HEAD (never pushed automatically)
//
//   node scripts/deploy/qc-deploy-vercel.mjs              # interactive, asks before each write
//   SITE_URL=https://basa3d.vn node scripts/deploy/...    # override NEXT_PUBLIC_SITE_URL if not set yet
//
// Requires: Vercel CLI logged in (`npx vercel login`), repo linked (.vercel/project.json), Node 22.
// Never prints secret values. Uncommitted changes are NOT deployed (by design — QC tests HEAD).
import process from 'node:process';
import console from 'node:console';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import nextEnv from '@next/env';

/* global fetch -- Node 22 built-in */
const ROOT = process.cwd();
const ENV = 'production';
const DEFAULT_SITE_URL = 'https://basa3d.vercel.app';

// Keys that must all point at the SAME Supabase project → overwritten from .env when they differ.
const DB_KEYS = ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
// Added only when missing in Vercel (existing values are kept).
const COPY_IF_MISSING = ['NEXT_PUBLIC_ZALO_PHONE', 'NEXT_PUBLIC_ZALO_URL', 'NEXT_PUBLIC_HOTLINE', 'NEXT_PUBLIC_MESSENGER_URL', 'NEXT_PUBLIC_CART_ENABLED', 'NEXT_PUBLIC_GA_ID', 'NEXT_PUBLIC_CONTACT_EMAIL', 'NEXT_PUBLIC_BANK_ID', 'NEXT_PUBLIC_BANK_ACCOUNT_NUMBER', 'NEXT_PUBLIC_BANK_ACCOUNT_NAME', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL'];
// Never copied from a dev .env: generated fresh for this environment when missing.
// UPLOAD_CLAIM_SECRET (Phase 34) was missing here, so Production never got it and every public upload
// (/custom-print, /bao-gia) returned 500 — see tests/phase-38-deploy-env.test.ts.
const GENERATED = ['ORDER_CONFIRMATION_SECRET', 'CRON_SECRET', 'UPLOAD_CLAIM_SECRET'];
// Deliberately skipped — see docs/operations/deployment.md (needs the Vercel Firewall rule first).
const SKIPPED = ['MAKERWORLD_PUBLIC_RESOLVER_ENABLED'];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const confirm = async (q) => (await rl.question(`\n${q} [y/N] `)).trim().toLowerCase() === 'y';
const step = (s) => console.log(`\n━━━ ${s} ━━━`);

function vercel(args, { input, cwd = ROOT, capture = true } = {}) {
  const res = spawnSync('npx', ['--yes', 'vercel@latest', ...args], {
    cwd, input, encoding: 'utf8', stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
  });
  if (res.status !== 0) throw new Error(`vercel ${args[0]} ${args[1] ?? ''} failed:\n${res.stderr || res.stdout || ''}`);
  return res.stdout ?? '';
}

function pullRemoteEnv() {
  const dir = mkdtempSync(path.join(tmpdir(), 'basa3d-env-'));
  const file = path.join(dir, '.env.remote');
  try {
    vercel(['env', 'pull', file, `--environment=${ENV}`, '--yes']);
    const parsed = {};
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m) parsed[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
    return parsed; // sensitive vars come back as "" — present, value unknown
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  // ── Preflight ──────────────────────────────────────────────────────────────────────────────
  step('0. Preflight');
  if (!existsSync(path.join(ROOT, '.vercel/project.json'))) throw new Error('Repo is not linked — run `npx vercel link` first.');
  const who = vercel(['whoami']).trim();
  console.log(`Vercel user: ${who}`);
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
  console.log(`Deploying commit: ${head}${dirty ? '  (uncommitted tracked changes exist — they will NOT be deployed)' : ''}`);

  // Phase 44 (ADR-0046, docs/operations/versioning.md): package.json holds the version being released.
  // A tag for it on ANOTHER commit means the version was not bumped after the previous release.
  const fullSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const version = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const tag = `v${version}`;
  const taggedSha = gitTagCommit(tag);
  console.log(`Release version: ${version}${taggedSha === fullSha ? `  (${tag} already tags this commit — redeploy)` : ''}`);
  if (taggedSha && taggedSha !== fullSha) {
    console.log(`⚠ ${tag} already tags ${taggedSha.slice(0, 7)}, not HEAD. Bump package.json first (npm version minor --no-git-tag-version) and add a CHANGELOG entry.`);
    if (!(await confirm(`Deploy anyway as ${version} (it will NOT be tagged)?`))) return console.log('Aborted.');
  }

  const { combinedEnv: local } = nextEnv.loadEnvConfig(ROOT, false, { info() {}, error: console.error });

  // ── 1. Env vars ────────────────────────────────────────────────────────────────────────────
  step(`1. Env vars → Vercel ${ENV}`);
  const remote = pullRemoteEnv();
  const plan = []; // { key, value, action }
  for (const key of DB_KEYS) {
    const value = local[key];
    if (!value) { console.log(`skip     ${key} (empty in .env)`); continue; }
    if (!(key in remote)) plan.push({ key, value, action: 'add' });
    else if (remote[key] === '' ) plan.push({ key, value, action: 'overwrite (sensitive, cannot compare)' });
    else if (remote[key] !== value) plan.push({ key, value, action: 'overwrite (differs from .env)' });
    else console.log(`same     ${key}`);
  }
  for (const key of COPY_IF_MISSING) {
    if (key in remote) console.log(`keep     ${key}`);
    else if (local[key]) plan.push({ key, value: local[key], action: 'add' });
    else console.log(`MISSING  ${key} (not in .env either — set it manually if needed)`);
  }
  for (const key of GENERATED) {
    if (key in remote) console.log(`keep     ${key}`);
    else plan.push({ key, value: randomBytes(32).toString('hex'), action: 'add (generated, 64 hex chars)' });
  }
  if (!('NEXT_PUBLIC_SITE_URL' in remote) || remote.NEXT_PUBLIC_SITE_URL === '' || /localhost/.test(remote.NEXT_PUBLIC_SITE_URL)) {
    plan.push({ key: 'NEXT_PUBLIC_SITE_URL', value: (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, ''), action: 'add/overwrite' });
  } else console.log(`keep     NEXT_PUBLIC_SITE_URL = ${remote.NEXT_PUBLIC_SITE_URL}`);
  for (const key of SKIPPED) console.log(`SKIPPED  ${key} (enable after the Vercel Firewall rule exists)`);

  if (!plan.length) console.log('\nNothing to change.');
  else {
    console.log('\nPlanned changes:');
    for (const p of plan) console.log(`  ${p.action.padEnd(40)} ${p.key}${p.key === 'NEXT_PUBLIC_SITE_URL' ? ` = ${p.value}` : ''}`);
    if (await confirm(`Apply ${plan.length} env change(s) to Vercel ${ENV}?`)) {
      for (const p of plan) {
        if (p.key in remote) vercel(['env', 'rm', p.key, ENV, '--yes']);
        vercel(['env', 'add', p.key, ENV], { input: p.value });
        console.log(`  ✓ ${p.key}`);
      }
    } else console.log('Env step skipped.');
  }

  // ── 2. Migrations ──────────────────────────────────────────────────────────────────────────
  step('2. DB migrations (DATABASE_URL from .env)');
  const migrate = (extra = []) => spawnSync('node', ['scripts/deploy/apply-pending-migrations.mjs', ...extra], { cwd: ROOT, stdio: 'inherit' }).status;
  if (migrate() !== 0) throw new Error('Migration dry run failed — fix before deploying.');
  if (await confirm('Apply the PENDING migrations above (if any)?')) {
    if (migrate(['--apply']) !== 0) throw new Error('Migration failed — deployment aborted.');
  } else console.log('Migration step skipped — the new code may fail against an old schema.');

  // ── 3. Deploy ──────────────────────────────────────────────────────────────────────────────
  step(`3. Deploy ${head} → Vercel ${ENV}`);
  if (!(await confirm(`Deploy commit ${head} to PRODUCTION (basa3d.vercel.app)?`))) return console.log('Deploy skipped.');
  const workdir = mkdtempSync(path.join(tmpdir(), 'basa3d-deploy-'));
  try {
    // Only tracked files at HEAD → no .env, tmp/, backups or WIP edits get uploaded.
    execFileSync('sh', ['-c', `git archive --format=tar HEAD | tar -x -C "${workdir}"`], { cwd: ROOT });
    cpSync(path.join(ROOT, '.vercel'), path.join(workdir, '.vercel'), { recursive: true });
    // A `git archive` export has no .git, so Vercel cannot know the commit — pass it to the build
    // (read by next.config.mjs → /api/version, admin footer).
    const out = vercel(['deploy', '--prod', '--yes', '--build-env', `APP_COMMIT_SHA=${fullSha}`], { cwd: workdir });
    const url = (out.match(/https:\/\/\S+\.vercel\.app/g) ?? []).pop();
    console.log(`Deployed: ${url ?? '(see Vercel dashboard)'}`);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }

  // ── 4. Smoke ───────────────────────────────────────────────────────────────────────────────
  step('4. Smoke checks');
  const base = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const checks = [
    ['/', 200], ['/en', 200], ['/products', 200], ['/custom-print', 200], ['/tools/keychain-generator', 200],
    ['/admin/login', 200], ['/sitemap.xml', 200], ['/api/cron/cleanup-orphan-uploads', 401],
  ];
  let failed = 0;
  for (const [p, want] of checks) {
    const res = await fetch(base + p, { redirect: 'manual' }).catch((e) => ({ status: `ERR ${e.message}` }));
    const ok = res.status === want;
    if (!ok) failed += 1;
    console.log(`${ok ? '✓' : '✗'} ${String(res.status).padEnd(4)} ${p} (expected ${want})`);
  }
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  const robotsOk = !robots.includes('localhost');
  if (!robotsOk) failed += 1;
  console.log(`${robotsOk ? '✓' : '✗'} robots.txt sitemap URL ${robotsOk ? 'uses the real origin' : 'still points at localhost'}`);
  const live = await waitForLiveVersion(base, fullSha);
  const versionOk = live?.commit === fullSha && live?.version === version && live?.channel === 'production';
  if (!versionOk) failed += 1;
  console.log(`${versionOk ? '✓' : '✗'} /api/version ${live ? `${live.label} @ ${String(live.commit).slice(0, 7)} (${live.channel})` : 'unreachable'} — expected ${version} @ ${head} (production)`);
  console.log(failed ? `\n${failed} smoke check(s) failed.` : '\nAll smoke checks passed — hand over to QC.');

  // ── 5. Tag ─────────────────────────────────────────────────────────────────────────────────
  step(`5. Tag release ${tag}`);
  if (failed) return console.log('Not tagging: smoke checks failed.');
  if (taggedSha === fullSha) return console.log(`${tag} already points at this commit.`);
  if (taggedSha) return console.log(`Not tagging: ${tag} belongs to another commit (see warning above).`);
  if (!(await confirm(`Create annotated tag ${tag} at ${head}?`))) return console.log('Tag skipped.');
  execFileSync('git', ['tag', '-a', tag, '-m', `Release ${tag}`, fullSha], { cwd: ROOT });
  console.log(`Tagged ${tag}. Next:\n  git push origin ${tag}\n  then on dev: npm version minor --no-git-tag-version (or patch) + new CHANGELOG section`);
}

// Phase 44: commit a tag points at, or null when the tag does not exist.
function gitTagCommit(tag) {
  try {
    return execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

// Phase 44: the production alias can lag the deploy by a few seconds — poll /api/version until it
// reports the commit just deployed (or give up after ~60s and report what is live instead).
async function waitForLiveVersion(base, expectedSha) {
  let last = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const res = await fetch(`${base}/api/version`, { cache: 'no-store' });
      if (res.ok) last = await res.json();
    } catch { /* not reachable yet */ }
    if (last?.commit === expectedSha) return last;
    await sleep(5_000);
  }
  return last;
}

main()
  .catch((e) => { console.error(`\nERROR: ${e.message}`); process.exitCode = 1; })
  .finally(() => rl.close());
