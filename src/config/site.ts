export const SITE_CONFIG = {
  name: 'BaSa3D',
  description: 'Dịch vụ in 3D chuyên nghiệp & Sản phẩm độc đáo',
  zaloPhone: process.env.NEXT_PUBLIC_ZALO_PHONE || '0333698638',
  zaloUrl: process.env.NEXT_PUBLIC_ZALO_URL || 'https://zalo.me/84333698638',
  hotline: process.env.NEXT_PUBLIC_HOTLINE || '0333698638',
  // Messenger: no Fanpage created yet, so left empty on purpose — an m.me link only works
  // reliably for a Facebook Page, not a personal profile. Once a Fanpage exists, set this to
  // https://m.me/<fanpage-username> and the contact CTA will pick it up automatically.
  messengerUrl: process.env.NEXT_PUBLIC_MESSENGER_URL || '',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'basa3d.print@gmail.com',
  address: 'Hà Nội, Việt Nam',
  // Cart temporarily hidden (2026-09) — customers are directed to contact Zalo/hotline directly
  // instead of ordering through the storefront cart. Flip NEXT_PUBLIC_CART_ENABLED=true to
  // restore add-to-cart, the cart icon, and the /cart and /checkout routes.
  cartEnabled: process.env.NEXT_PUBLIC_CART_ENABLED === 'true',
  // Blog link temporarily hidden while no published articles exist. Flip
  // NEXT_PUBLIC_BLOG_ENABLED=true to restore the /blog link in navigation.
  blogEnabled: process.env.NEXT_PUBLIC_BLOG_ENABLED === 'true',
  // VietQR static transfer QR (phase-5.md decision #4) — bankId is the short bank code VietQR
  // accepts (e.g. "MBBank", "VCB", "TCB"), not the account holder's own name. Left unset in a
  // fresh env, the bank-transfer QR is simply not rendered (see order-confirmation page) rather
  // than showing a QR pointing at a fake/placeholder account.
  bankId: process.env.NEXT_PUBLIC_BANK_ID || '',
  bankAccountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || '',
  bankAccountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || '',
};
