// Feature 003 (research R7): display name, slug and SKU for an imported model. Pure. The regexes are
// the DB constraints on products.slug / product_variants.sku, which stay the source of truth.

export const NAME_MAX = 200;
export const SLUG_MAX = 160;
export const SKU_MAX = 40;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKU_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

const MODEL_EXTENSION_RE = /\.(stl|3mf|obj)$/i;
// Export noise: "_v2", "v03", "final", "copy", "(1)". Applied repeatedly ("cat_final_v2").
const NOISE_SUFFIX_RE = /(?:[\s_-]*(?:v\d+|final|copy|\(\d+\)))+$/i;
const TRAILING_SEQUENCE_RE = /[\s_-]+\d{1,3}$/;

export function displayName(raw: string): string {
  let name = raw.normalize('NFC').replace(MODEL_EXTENSION_RE, '');
  name = name.replace(NOISE_SUFFIX_RE, '');
  const withoutSequence = name.replace(TRAILING_SEQUENCE_RE, '');
  if (/[\p{L}]/u.test(withoutSequence)) name = withoutSequence;
  name = name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) name = raw.replace(MODEL_EXTENSION_RE, '').trim() || 'Mẫu';
  if (!/[\p{L}]/u.test(name)) name = `Mẫu ${name}`;
  return name.slice(0, NAME_MAX).trim();
}

export function slugify(value: string): string {
  const ascii = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  const slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return trimJoined(slug.slice(0, SLUG_MAX)) || 'mau';
}

function trimJoined(value: string): string {
  return value.replace(/-+$/g, '');
}

function withSuffix(base: string, suffix: number, max: number): string {
  const tail = `-${suffix}`;
  return `${trimJoined(base.slice(0, max - tail.length))}${tail}`;
}

/** First free `base`, `base-2`, `base-3`… within `max` characters. */
export function uniqueValue(base: string, isTaken: (value: string) => boolean, max: number): string {
  if (!isTaken(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = withSuffix(base, suffix, max);
    if (!isTaken(candidate)) return candidate;
  }
}

export function uniqueSlug(name: string, isTaken: (slug: string) => boolean): string {
  return uniqueValue(slugify(name), isTaken, SLUG_MAX);
}

/** `<CAT>-<SLUG>` upper-cased (catalog-spec.md §3), ≤ 40 characters, unique. */
export function buildSku(categoryCode: string, slug: string, isTaken: (sku: string) => boolean): string {
  const code = categoryCode.toUpperCase().replace(/[^A-Z0-9]+/g, '') || 'UNC';
  const base = trimJoined(`${code}-${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`.slice(0, SKU_MAX));
  return uniqueValue(base, isTaken, SKU_MAX);
}

export function describeModel(bboxMm: { x: number; y: number; z: number } | null): string {
  if (!bboxMm) return 'Mẫu in 3D.';
  const mm = (value: number) => Math.max(1, Math.round(value));
  return `Mẫu in 3D, kích thước ${mm(bboxMm.x)} × ${mm(bboxMm.y)} × ${mm(bboxMm.z)} mm.`;
}
