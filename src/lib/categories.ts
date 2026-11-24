export type CategoryLike = {
  name: string;
  slug?: string | null;
};

export const CATEGORY_DISPLAY_NAMES: Record<string, { vi: string; en: string }> = {
  keycap: {
    vi: 'Nút bàn phím (Keycap)',
    en: 'Keycaps',
  },
  'accessories-gadgets': {
    vi: 'Phụ kiện & Tiện ích',
    en: 'Accessories & Gadgets',
  },
  'home-decor': {
    vi: 'Trang trí nhà cửa',
    en: 'Home Decor',
  },
  'figure-model': {
    vi: 'Mô hình & Nhân vật',
    en: 'Models & Figures',
  },
  keychain: {
    vi: 'Móc khoá',
    en: 'Keychains',
  },
  'chua-phan-loai': {
    vi: 'Chưa phân loại',
    en: 'Uncategorized',
  },
};

const NAME_TO_SLUG_MAP: Record<string, string> = {
  keycap: 'keycap',
  keycaps: 'keycap',
  'nút bàn phím': 'keycap',
  'nút bàn phím (keycap)': 'keycap',
  'nút phím': 'keycap',
  'nút phím (keycap)': 'keycap',

  'accessories & gadgets': 'accessories-gadgets',
  'accessories and gadgets': 'accessories-gadgets',
  'accessories-gadgets': 'accessories-gadgets',
  'phụ kiện tiện ích': 'accessories-gadgets',
  'phụ kiện & tiện ích': 'accessories-gadgets',
  'phụ kiện': 'accessories-gadgets',

  'home decor': 'home-decor',
  'home-decor': 'home-decor',
  'decor bàn làm việc': 'home-decor',
  'trang trí nhà cửa': 'home-decor',
  decor: 'home-decor',

  'figure & model': 'figure-model',
  'figure and model': 'figure-model',
  'figure-model': 'figure-model',
  'models & figures': 'figure-model',
  'mô hình / art toys': 'figure-model',
  'mô hình & nhân vật': 'figure-model',
  'mô hình': 'figure-model',
  figure: 'figure-model',

  keychain: 'keychain',
  keychains: 'keychain',
  'móc khoá': 'keychain',
  'móc khóa': 'keychain',

  'chưa phân loại': 'chua-phan-loai',
  'chua-phan-loai': 'chua-phan-loai',
  uncategorized: 'chua-phan-loai',
};

/**
 * Returns the localized display name for a product category.
 * Defaults to Vietnamese ('vi') if no locale or an unsupported locale is given.
 */
export function getCategoryDisplayName(
  category: CategoryLike | string,
  locale: string = 'vi',
): string {
  const isEn = locale === 'en';

  if (typeof category === 'string') {
    const raw = category.trim().toLowerCase();
    const resolvedSlug = NAME_TO_SLUG_MAP[raw];
    if (resolvedSlug && resolvedSlug in CATEGORY_DISPLAY_NAMES) {
      return isEn ? CATEGORY_DISPLAY_NAMES[resolvedSlug].en : CATEGORY_DISPLAY_NAMES[resolvedSlug].vi;
    }
    return category;
  }

  // 1. Match by slug
  if (category.slug) {
    const slugKey = category.slug.trim().toLowerCase();
    if (slugKey in CATEGORY_DISPLAY_NAMES) {
      return isEn ? CATEGORY_DISPLAY_NAMES[slugKey].en : CATEGORY_DISPLAY_NAMES[slugKey].vi;
    }
    const resolvedFromSlug = NAME_TO_SLUG_MAP[slugKey];
    if (resolvedFromSlug && resolvedFromSlug in CATEGORY_DISPLAY_NAMES) {
      return isEn ? CATEGORY_DISPLAY_NAMES[resolvedFromSlug].en : CATEGORY_DISPLAY_NAMES[resolvedFromSlug].vi;
    }
  }

  // 2. Match by category name
  const nameKey = (category.name || '').trim().toLowerCase();
  const resolvedFromName = NAME_TO_SLUG_MAP[nameKey];
  if (resolvedFromName && resolvedFromName in CATEGORY_DISPLAY_NAMES) {
    return isEn ? CATEGORY_DISPLAY_NAMES[resolvedFromName].en : CATEGORY_DISPLAY_NAMES[resolvedFromName].vi;
  }

  // 3. Fallback to existing name
  return category.name;
}

export interface CategoryOptionLike {
  id: string;
  label: string;
  slug?: string | null;
}

const CATEGORY_KEYWORD_RULES: { slugOrKeyword: string; matchers: RegExp }[] = [
  {
    slugOrKeyword: 'keychain',
    matchers: /(móc khoá|móc khóa|keychain|key chain|treo chìa)/i,
  },
  {
    slugOrKeyword: 'keycap',
    matchers: /(keycap|keycaps|nút phím|nút bàn phím|switch phím)/i,
  },
  {
    slugOrKeyword: 'figure-model',
    matchers: /(mô hình|figure|statue|tượng|chibi|action figure|toy|fidget|khớp nối|flexi|articulated|búp bê)/i,
  },
  {
    slugOrKeyword: 'accessories-gadgets',
    matchers: /(giá đỡ|stand|holder|khay|kẹp|dock|case|ống cắm|dụng cụ|tiện ích|phụ kiện|tai nghe|dây sạc|cáp)/i,
  },
  {
    slugOrKeyword: 'home-decor',
    matchers: /(decor|trang trí|để bàn|chậu cây|bình hoa|đèn|hộp khăn|đồng hồ|khung ảnh|gạt tàn|treo tường)/i,
  },
];

export function getCategoryIconEmoji(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('móc khoá') || l.includes('móc khóa') || l.includes('keychain')) return '🔑';
  if (l.includes('keycap') || l.includes('phím')) return '⌨️';
  if (l.includes('mô hình') || l.includes('figure') || l.includes('toy')) return '🧸';
  if (l.includes('decor') || l.includes('trang trí') || l.includes('nhà')) return '🏠';
  if (l.includes('phụ kiện') || l.includes('tiện ích') || l.includes('gadget')) return '📱';
  if (l.includes('dụng cụ') || l.includes('tool')) return '🛠️';
  return '🏷️';
}

/**
 * Automatically detects the most relevant category from a given product name.
 */
export function detectCategoryFromName(
  productName: string,
  categories: CategoryOptionLike[]
): { categoryId: string; categoryLabel: string } | null {
  if (!productName || !productName.trim() || !categories.length) return null;
  const normalized = productName.normalize('NFC').toLowerCase().trim();

  // 1. Check direct name match with available categories
  for (const cat of categories) {
    const catLower = (cat.label || '').normalize('NFC').toLowerCase().trim();
    if (normalized.includes(catLower)) {
      return { categoryId: cat.id, categoryLabel: cat.label };
    }
  }

  // 2. Check keyword regex rules
  for (const rule of CATEGORY_KEYWORD_RULES) {
    if (rule.matchers.test(normalized)) {
      const matched = categories.find((c) => {
        const slug = c.slug?.toLowerCase();
        const label = (c.label || '').normalize('NFC').toLowerCase();
        return (
          slug === rule.slugOrKeyword ||
          label.includes(rule.slugOrKeyword) ||
          (rule.slugOrKeyword === 'keychain' && (label.includes('móc khoá') || label.includes('móc khóa') || label.includes('keychain'))) ||
          (rule.slugOrKeyword === 'keycap' && label.includes('keycap')) ||
          (rule.slugOrKeyword === 'figure-model' && (label.includes('mô hình') || label.includes('figure'))) ||
          (rule.slugOrKeyword === 'home-decor' && (label.includes('decor') || label.includes('trang trí'))) ||
          (rule.slugOrKeyword === 'accessories-gadgets' && (label.includes('phụ kiện') || label.includes('tiện ích')))
        );
      });
      if (matched) {
        return { categoryId: matched.id, categoryLabel: matched.label };
      }
    }
  }

  return null;
}
