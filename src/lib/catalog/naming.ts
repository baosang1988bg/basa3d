// Slug / SKU helpers shared by the STL importer (Feature 003) and the admin "Đăng sản phẩm mới" page
// (Phase 52, exec-plan D10). Pure. The regexes mirror the DB constraints on products.slug /
// product_variants.sku, which stay the source of truth.

export const NAME_MAX = 200;
export const SLUG_MAX = 160;
export const SKU_MAX = 40;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKU_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

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

/** SKU prefix per category slug — same codes as scripts/stl-import/category-map.json (Feature 003). */
const CATEGORY_SKU_CODES: Record<string, string> = {
  keycap: 'KCP',
  keychain: 'KEY',
  'figure-model': 'FIG',
  'home-decor': 'DEC',
  'accessories-gadgets': 'ACC',
};

export function skuCodeForCategory(categorySlug: string | null | undefined): string {
  if (!categorySlug) return 'BSA';
  const known = CATEGORY_SKU_CODES[categorySlug];
  if (known) return known;
  const letters = categorySlug.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return letters.slice(0, 3) || 'BSA';
}
