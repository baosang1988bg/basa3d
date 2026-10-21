import { formatVersionLabel } from './resolve-build-info.mjs';

// Phase 44 (ADR-0046). The BASA3D_BUILD_* values are inlined by next.config.mjs (`env`) at build
// time, so every build carries its own identity — on the server and in client components alike —
// without reading package.json or git at runtime. Each `process.env.X` must stay a literal member
// access for Next.js to inline it. The fallbacks only apply outside a Next.js build (node:test).

export type BuildChannel = 'production' | 'preview' | 'development';

export type BuildInfo = { version: string; channel: BuildChannel; commit: string; builtAt: string | null };

function readChannel(value: string | undefined): BuildChannel {
  return value === 'production' || value === 'preview' ? value : 'development';
}

export const BUILD_INFO: BuildInfo = {
  version: process.env.BASA3D_BUILD_VERSION || '0.0.0',
  channel: readChannel(process.env.BASA3D_BUILD_CHANNEL),
  commit: process.env.BASA3D_BUILD_COMMIT || 'unknown',
  builtAt: process.env.BASA3D_BUILD_TIME || null,
};

/** "1.0.0" in production, "1.0.0-preview.a1b2c3d" elsewhere. */
export const VERSION_LABEL = formatVersionLabel(BUILD_INFO);

export const SHORT_COMMIT = /^[0-9a-f]{7,40}$/.test(BUILD_INFO.commit) ? BUILD_INFO.commit.slice(0, 7) : 'unknown';

export const CHANNEL_LABELS: Record<BuildChannel, string> = {
  production: 'Production',
  preview: 'Preview',
  development: 'Dev',
};
