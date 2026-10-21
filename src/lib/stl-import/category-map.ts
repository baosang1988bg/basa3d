// Feature 003 (FR-007): folder → category mapping, owned by OWNER in scripts/stl-import/category-map.json.
// `categories` has no code column, so the SKU prefix lives in the map too.
import { z } from 'zod';
import { slugify } from './naming';

export const UNCATEGORIZED_SLUG = 'chua-phan-loai';
export const UNCATEGORIZED_SKU_CODE = 'UNC';

export const categoryMapSchema = z.object({
  groupBy: z.enum(['folder', 'file']).optional(),
  rules: z.array(z.object({
    folderPattern: z.string().trim().min(1).max(200),
    categorySlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    skuCode: z.string().trim().regex(/^[A-Z0-9]{1,8}$/),
  }).strict()).max(500),
}).strict();

export type CategoryMap = z.infer<typeof categoryMapSchema>;
export type ResolvedCategory = { categorySlug: string; skuCode: string };

/**
 * First rule whose pattern equals one of the folder segments of `sourceDir`, compared on the slug
 * (case- and accent-insensitive: "Đồ chơi" matches "do choi"). Deepest segment wins over shallower.
 */
export function resolveCategory(map: CategoryMap, sourceDir: string): ResolvedCategory {
  const segments = sourceDir.split('/').filter(Boolean).map(slugify).reverse();
  for (const segment of segments) {
    const rule = map.rules.find((candidate) => slugify(candidate.folderPattern) === segment);
    if (rule) return { categorySlug: rule.categorySlug, skuCode: rule.skuCode };
  }
  return { categorySlug: UNCATEGORIZED_SLUG, skuCode: UNCATEGORIZED_SKU_CODE };
}
