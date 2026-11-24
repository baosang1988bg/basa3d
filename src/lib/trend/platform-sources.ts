// Structured metadata from 3D-model platforms (ADR-0063 U1). Server-only.
//
// Why: the license verdict must come from the platform's own license field, not from page text.
// - Printables: public GraphQL endpoint `https://api.printables.com/graphql/`. The `print(id) { license { id name
//   abbreviation } }` shape is used by other projects (hackclub/construct PR #46) but is NOT officially documented —
//   every field is parsed defensively and a schema change degrades to "license unknown", never to "allowed".
//   Popularity counters are requested in a SEPARATE query so an unknown field there cannot break the license lookup.
// - Thingiverse: REST `https://api.thingiverse.com/things/{id}` with an app token (THINGIVERSE_APP_TOKEN).
//   Without the token the adapter is skipped.
// All requests go through lib/net/safe-fetch (allowlisted host, deadline, body cap).

import { z } from 'zod';
import { safeFetchText, SafeFetchError, type FetchLike } from '@/lib/net/safe-fetch';

export type PlatformStats = { downloads: number | null; likes: number | null; prints: number | null };

export type PlatformMetadata = {
  title: string | null;
  coverUrl: string | null;
  author: string | null;
  /** Human-readable license name as the platform names it, or null when the platform did not say. */
  license: string | null;
  stats: PlatformStats | null;
};

const PRINTABLES_API = 'https://api.printables.com/graphql/';
const THINGIVERSE_API = 'https://api.thingiverse.com';
const DEADLINE_MS = 5_000;
const MAX_BYTES = 256 * 1024;

export function extractPrintablesModelId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return url.pathname.match(/\/model\/(\d{1,12})(?:[-/]|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function extractThingiverseThingId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return url.pathname.match(/\/thing:(\d{1,12})(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function count(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 && n <= 2_000_000_000 ? Math.floor(n) : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function httpsUrl(value: unknown): string | null {
  const v = text(value, 2000);
  return v && /^https:\/\//i.test(v) ? v : null;
}

async function postJson(url: string, body: unknown, fetchImpl?: FetchLike): Promise<unknown> {
  const raw = await safeFetchText(url, {
    allowedHostSuffixes: ['api.printables.com'],
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    accept: 'application/json',
    deadlineMs: DEADLINE_MS,
    maxBytes: MAX_BYTES,
    fetchImpl,
  });
  return JSON.parse(raw) as unknown;
}

const printablesLicenseSchema = z.object({
  data: z.object({
    print: z.object({
      id: z.union([z.string(), z.number()]).optional(),
      name: z.string().optional().nullable(),
      license: z.object({
        id: z.union([z.string(), z.number()]).optional().nullable(),
        name: z.string().optional().nullable(),
        abbreviation: z.string().optional().nullable(),
      }).nullable().optional(),
    }).nullable(),
  }).nullable().optional(),
});

/** Formats Printables' license as "Name (ABBR)" so the classifier sees both forms. */
export function formatPrintablesLicense(license: { name?: string | null; abbreviation?: string | null } | null | undefined): string | null {
  if (!license) return null;
  const name = text(license.name, 150);
  const abbreviation = text(license.abbreviation, 40);
  if (name && abbreviation && !name.includes(abbreviation)) return `${name} (${abbreviation})`.slice(0, 200);
  return name ?? abbreviation;
}

export async function fetchPrintablesMetadata(modelId: string, deps: { fetchImpl?: FetchLike } = {}): Promise<PlatformMetadata | null> {
  let licenseResult: z.infer<typeof printablesLicenseSchema>;
  try {
    const json = await postJson(PRINTABLES_API, {
      operationName: 'PrintDetail',
      query: 'query PrintDetail($id: ID!) { print(id: $id) { id name license { id name abbreviation } } }',
      variables: { id: modelId },
    }, deps.fetchImpl);
    const parsed = printablesLicenseSchema.safeParse(json);
    if (!parsed.success) return null;
    licenseResult = parsed.data;
  } catch (error) {
    if (error instanceof SafeFetchError || error instanceof SyntaxError) return null;
    throw error;
  }
  const print = licenseResult.data?.print;
  if (!print) return null;
  return {
    title: text(print.name, 255),
    coverUrl: null,
    author: null,
    license: formatPrintablesLicense(print.license),
    stats: await fetchPrintablesStats(modelId, deps),
  };
}

/** Best-effort, schema not documented: any GraphQL error or shape change → null. */
export async function fetchPrintablesStats(modelId: string, deps: { fetchImpl?: FetchLike } = {}): Promise<PlatformStats | null> {
  try {
    const json = await postJson(PRINTABLES_API, {
      operationName: 'PrintStats',
      query: 'query PrintStats($id: ID!) { print(id: $id) { id likesCount downloadCount makesCount } }',
      variables: { id: modelId },
    }, deps.fetchImpl) as { data?: { print?: Record<string, unknown> | null } | null; errors?: unknown };
    const print = json?.data?.print;
    if (!print || json.errors) return null;
    const stats = { downloads: count(print.downloadCount), likes: count(print.likesCount), prints: count(print.makesCount) };
    return stats.downloads === null && stats.likes === null && stats.prints === null ? null : stats;
  } catch {
    return null;
  }
}

const thingSchema = z.object({
  name: z.string().optional().nullable(),
  license: z.string().optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  like_count: z.unknown().optional(),
  collect_count: z.unknown().optional(),
  download_count: z.unknown().optional(),
  make_count: z.unknown().optional(),
  creator: z.object({ name: z.string().optional().nullable() }).nullable().optional(),
});

export async function fetchThingiverseMetadata(
  thingId: string,
  deps: { fetchImpl?: FetchLike; token?: string | undefined } = {},
): Promise<PlatformMetadata | null> {
  const token = deps.token ?? process.env.THINGIVERSE_APP_TOKEN;
  if (!token) return null;
  try {
    const raw = await safeFetchText(`${THINGIVERSE_API}/things/${encodeURIComponent(thingId)}`, {
      allowedHostSuffixes: ['api.thingiverse.com'],
      headers: { Authorization: `Bearer ${token}` },
      accept: 'application/json',
      deadlineMs: DEADLINE_MS,
      maxBytes: MAX_BYTES,
      fetchImpl: deps.fetchImpl,
    });
    const parsed = thingSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const thing = parsed.data;
    const stats = { downloads: count(thing.download_count), likes: count(thing.like_count), prints: count(thing.make_count) };
    return {
      title: text(thing.name, 255),
      coverUrl: httpsUrl(thing.thumbnail),
      author: text(thing.creator?.name, 120),
      license: text(thing.license, 200),
      stats: stats.downloads === null && stats.likes === null && stats.prints === null ? null : stats,
    };
  } catch (error) {
    if (error instanceof SafeFetchError || error instanceof SyntaxError) return null;
    throw error;
  }
}
