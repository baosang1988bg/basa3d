// Phase 44 (ADR-0046) — which build is this? Pure functions, shared by next.config.mjs (runs in Node
// at build time, cannot import TypeScript) and src/config/build-info.ts (runtime, server + client).
// No `process` access here on purpose: callers pass the environment in, so tests can feed any case.

/** @typedef {'production' | 'preview' | 'development'} BuildChannel */
/** @typedef {{ version: string, channel: BuildChannel, commit: string, builtAt: string | null }} BuildInfo */

const CHANNELS = /** @type {const} */ (['production', 'preview', 'development']);

/**
 * @param {string | undefined} value
 * @returns {BuildChannel | undefined}
 */
function asChannel(value) {
  const normalized = value?.trim().toLowerCase();
  return CHANNELS.find((channel) => channel === normalized);
}

/**
 * ADR-0054: Netlify build CONTEXT → channel. Netlify sets CONTEXT for every build:
 * `production`, `deploy-preview` (PRs), `branch-deploy` (other branches) or `dev` (netlify dev).
 * @param {string | undefined} context
 * @returns {BuildChannel | undefined}
 */
function netlifyContextChannel(context) {
  switch (context?.trim().toLowerCase()) {
    case 'production': return 'production';
    case 'deploy-preview':
    case 'branch-deploy': return 'preview';
    case 'dev': return 'development';
    default: return undefined;
  }
}

/** @typedef {'vercel' | 'netlify' | 'other'} DeployPlatform */

/**
 * ADR-0054: which host built this bundle. Decided at BUILD time from the variables each host sets
 * during its build (Vercel: VERCEL=1, Netlify: NETLIFY=true), then inlined by next.config.mjs as
 * BASA3D_DEPLOY_PLATFORM — runtime code must not guess, because the trusted client-IP header differs
 * per host and trusting the wrong one lets a caller spoof it (src/lib/rate-limit.ts).
 * @param {Record<string, string | undefined>} env
 * @returns {DeployPlatform}
 */
export function resolveDeployPlatform(env) {
  if (env.VERCEL === '1' || env.VERCEL_ENV) return 'vercel';
  if (env.NETLIFY === 'true') return 'netlify';
  return 'other';
}

/**
 * Resolution order (first hit wins):
 * - channel: APP_CHANNEL override → VERCEL_ENV (Vercel sets it for every build) → Netlify CONTEXT
 *            → 'development'.
 * - commit:  APP_COMMIT_SHA (qc-deploy-vercel.mjs passes it: CLI deploys of a `git archive` have no
 *            git metadata) → VERCEL_GIT_COMMIT_SHA (Git-integration previews) → COMMIT_REF (Netlify)
 *            → local `git rev-parse` → 'unknown'.
 * @param {{ env: Record<string, string | undefined>, version: string, readGitSha?: () => string | undefined, now?: Date }} input
 * @returns {BuildInfo}
 */
export function resolveBuildInfo({ env, version, readGitSha, now = new Date() }) {
  const channel = asChannel(env.APP_CHANNEL)
    ?? asChannel(env.VERCEL_ENV)
    ?? (env.NETLIFY === 'true' ? netlifyContextChannel(env.CONTEXT) : undefined)
    ?? 'development';
  const commit = (env.APP_COMMIT_SHA || env.VERCEL_GIT_COMMIT_SHA || env.COMMIT_REF || readGitSha?.() || 'unknown').trim().toLowerCase();
  return { version, channel, commit, builtAt: now.toISOString() };
}

/**
 * SemVer label. Production shows the bare version ("1.0.0"); every other build is a pre-release of
 * that version ("1.0.0-preview.a1b2c3d"), which SemVer orders BEFORE 1.0.0 — exactly what an
 * unreleased build of the version being prepared is.
 * @param {Pick<BuildInfo, 'version' | 'channel' | 'commit'>} info
 * @returns {string}
 */
export function formatVersionLabel({ version, channel, commit }) {
  if (channel === 'production') return version;
  const shortCommit = /^[0-9a-f]{7,40}$/.test(commit) ? commit.slice(0, 7) : 'unknown';
  return `${version}-${channel}.${shortCommit}`;
}
