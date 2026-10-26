import { formatPhoneNumber } from '@/lib/format';
 
function sanitizePhoneNumber(val?: string): string {
  if (!val || val === '0333638698' || val === '0333698638') return '0333 698 638';
  return formatPhoneNumber(val);
}

function sanitizeZaloUrl(val?: string): string {
  if (!val || val.includes('363869')) return 'https://zalo.me/84333698638';
  return val;
}

export const SITE_CONFIG = {
  name: 'BaSa3D',
  description: 'Dịch vụ in 3D chuyên nghiệp & Sản phẩm độc đáo',
  zaloPhone: sanitizePhoneNumber(process.env.NEXT_PUBLIC_ZALO_PHONE),
  zaloUrl: sanitizeZaloUrl(process.env.NEXT_PUBLIC_ZALO_URL),
  hotline: sanitizePhoneNumber(process.env.NEXT_PUBLIC_HOTLINE),
  // Messenger: no Fanpage created yet, so left empty on purpose — an m.me link only works
  // reliably for a Facebook Page, not a personal profile. Once a Fanpage exists, set this to
  // https://m.me/<fanpage-username> and the contact CTA will pick it up automatically.
  messengerUrl: process.env.NEXT_PUBLIC_MESSENGER_URL || '',
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL || '',
  tiktokUrl: process.env.NEXT_PUBLIC_TIKTOK_URL || '',
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'basa3d.vn@gmail.com',
  address: 'Hồ Chí Minh, Việt Nam',
  // Cart temporarily hidden (2026-09) — customers are directed to contact Zalo/hotline directly
  // instead of ordering through the storefront cart. Flip NEXT_PUBLIC_CART_ENABLED=true to
  // restore add-to-cart, the cart icon, and the /cart and /checkout routes.
  cartEnabled: process.env.NEXT_PUBLIC_CART_ENABLED === 'true',
  // Blog link temporarily hidden while no published articles exist. Flip
  // NEXT_PUBLIC_BLOG_ENABLED=true to restore the /blog link in navigation.
  blogEnabled: process.env.NEXT_PUBLIC_BLOG_ENABLED === 'true',
  // EN temporarily switched off as a whole — flip NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED=true (and
  // rebuild) to restore the Header VI/EN toggle, the Organizer toggle, `/en/*` routing, EN sitemap
  // entries and hreflang. Routing reads the same env var via isEnglishEnabled in src/i18n/routing.ts.
  languageSwitcherEnabled: process.env.NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED === 'true',
  // VietQR static transfer QR (phase-5.md decision #4) — bankId is the short bank code VietQR
  // accepts (e.g. "MBBank", "VCB", "TCB"), not the account holder's own name. Left unset in a
  // fresh env, the bank-transfer QR is simply not rendered (see order-confirmation page) rather
  // than showing a QR pointing at a fake/placeholder account.
  bankId: process.env.NEXT_PUBLIC_BANK_ID || '',
  bankAccountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || '',
  bankAccountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || '',
};
