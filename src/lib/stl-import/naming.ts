// Feature 003 (research R7): display name, slug and SKU for an imported model. Pure. The regexes are
// the DB constraints on products.slug / product_variants.sku, which stay the source of truth.

// Phase 52 (D10): slug/SKU helpers moved to src/lib/catalog/naming.ts; re-exported for existing callers.
import { NAME_MAX } from '../catalog/naming';
export { NAME_MAX, SLUG_MAX, SKU_MAX, SLUG_RE, SKU_RE, slugify, uniqueValue, uniqueSlug, buildSku } from '../catalog/naming';

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

export function describeModel(bboxMm: { x: number; y: number; z: number } | null): string {
  if (!bboxMm) return 'Mẫu in 3D.';
  const mm = (value: number) => Math.max(1, Math.round(value));
  return `Mẫu in 3D, kích thước ${mm(bboxMm.x)} × ${mm(bboxMm.y)} × ${mm(bboxMm.z)} mm.`;
}
