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
