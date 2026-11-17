// Phase 2 bridge (Catalog local JSON -> BaSa3D DRAFT products without uploading source .3mf/.stl files).
// Pure module (Zod validation, variant SKU generation, description formatting) — zero DB or Node fs imports.
import { z } from 'zod';
import { buildSku, NAME_MAX, SKU_MAX, SLUG_RE, uniqueSlug, uniqueValue } from '../catalog/naming';

const trimDash = (value: string): string => value.replace(/-+$/g, '');

const nonNegativeIntVnd = z.number().int().min(0).max(1_000_000_000);

export const catalogExportVariantSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priceVnd: nonNegativeIntVnd,
  costPriceVnd: nonNegativeIntVnd.nullable().optional(),
  weightGrams: z.number().int().min(0).max(100_000).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  pricingBreakdown: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const catalogExportItemSchema = z.object({
  catalogId: z.string().trim().min(1),
  sourceKey: z.string().regex(/^[0-9a-f]{40}$/),
  sourceRelPath: z.string().trim().min(1),
  sourceDir: z.string().trim().min(1),
  groupMode: z.enum(['FILE', 'FOLDER']),
  sourceBytes: z.number().int().min(0),
  sourceMtime: z.string().optional().default(''),
  name: z.string().trim().min(1).max(NAME_MAX),
  localCategory: z.string().optional().default(''),
  categorySlug: z.string().trim().regex(SLUG_RE),
  categoryName: z.string().trim().min(1).max(160),
  skuCode: z.string().trim().regex(/^[A-Z0-9]{1,8}$/),
  designer: z.string().trim().max(160).nullable().optional(),
  note: z.string().max(2000).optional().default(''),
  basePriceVnd: nonNegativeIntVnd.nullable().optional(),
  pricingBreakdown: z.record(z.string(), z.unknown()).nullable().optional(),
  sizeMm: z.tuple([z.number(), z.number(), z.number()]).nullable().optional(),
  volumeCm3: z.number().min(0).nullable().optional(),
  triangles: z.number().int().min(0).nullable().optional(),
  images: z.array(z.string().trim().min(1)).max(8).default([]),
  variants: z.array(catalogExportVariantSchema).min(1).max(64),
});

export const catalogExportBundleSchema = z.object({
  schemaVersion: z.literal('basa3d-catalog-export-v1'),
  generatedAt: z.string(),
  sourceRoot: z.string().optional(),
  pricingConfig: z.record(z.string(), z.unknown()).optional(),
  count: z.number().int().min(0),
  items: z.array(catalogExportItemSchema),
});

export type CatalogExportVariant = z.infer<typeof catalogExportVariantSchema>;
export type CatalogExportItem = z.infer<typeof catalogExportItemSchema>;
export type CatalogExportBundle = z.infer<typeof catalogExportBundleSchema>;

export function buildVariantSkus(
  skuCode: string,
  slug: string,
  variantsCount: number,
  isTaken: (sku: string) => boolean,
): string[] {
  const baseSku = buildSku(skuCode, slug, (cand) => (variantsCount === 1 ? isTaken(cand) : false));
  if (variantsCount <= 1) return [baseSku];

  const out: string[] = [];
  const localTaken = new Set<string>();
  const check = (cand: string) => localTaken.has(cand) || isTaken(cand);
  for (let i = 0; i < variantsCount; i += 1) {
    const tag = `-P${i + 1}`;
    const trimmedBase = trimDash(baseSku.slice(0, SKU_MAX - tag.length));
    const sku = uniqueValue(`${trimmedBase}${tag}`, check, SKU_MAX);
    localTaken.add(sku);
    out.push(sku);
  }
  return out;
}

export function buildProductDescription(item: CatalogExportItem): string {
  const lines: string[] = [];
  if (item.sizeMm) {
    const dims = item.sizeMm.map((v) => Math.max(1, Math.round(v)));
    lines.push(`Kích thước tham khảo: ${dims[0]} × ${dims[1]} × ${dims[2]} mm.`);
  }
  if (item.volumeCm3 && item.volumeCm3 > 0) {
    lines.push(`Thể tích khối: ${item.volumeCm3} cm³.`);
  }
  if (item.variants.length > 1) {
    lines.push(`Gồm ${item.variants.length} cấu hình / mảnh in: ${item.variants.map((v) => v.name).slice(0, 6).join(', ')}.`);
  }
  if (item.designer) {
    lines.push(`Thiết kế: ${item.designer}.`);
  }
  if (item.note.trim()) {
    lines.push(`Ghi chú xưởng: ${item.note.trim()}`);
  }
  return lines.join('\n') || 'Sản phẩm in 3D từ thư viện BaSa3D.';
}

export function computeJsonBundleSlug(name: string, takenSlugs: Set<string>): string {
  return uniqueSlug(name, (cand) => takenSlugs.has(cand));
}
