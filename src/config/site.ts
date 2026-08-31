export const SITE_CONFIG = {
  name: 'BaSa3D',
  description: 'Dịch vụ in 3D chuyên nghiệp & Sản phẩm độc đáo',
  zaloPhone: process.env.NEXT_PUBLIC_ZALO_PHONE || '098 000 0000',
  zaloUrl: process.env.NEXT_PUBLIC_ZALO_URL || 'https://zalo.me/',
  hotline: process.env.NEXT_PUBLIC_HOTLINE || '098 000 0000',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'basa3d.print@gmail.com',
  address: 'Hà Nội, Việt Nam',
  // VietQR static transfer QR (phase-5.md decision #4) — bankId is the short bank code VietQR
  // accepts (e.g. "MBBank", "VCB", "TCB"), not the account holder's own name. Left unset in a
  // fresh env, the bank-transfer QR is simply not rendered (see order-confirmation page) rather
  // than showing a QR pointing at a fake/placeholder account.
  bankId: process.env.NEXT_PUBLIC_BANK_ID || '',
  bankAccountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || '',
  bankAccountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || '',
};
