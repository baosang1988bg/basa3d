// QA-003 (docs/qa/2026-11-24-user-test-performance-audit.md): "abc123" was accepted as a phone, so the
// workshop could not call back and the customer could not open /quotes (last-4-digits check).
// Vietnamese numbers only, on PUBLIC forms. Staff/admin forms stay free text (Zalo IDs, foreign numbers).
// Pure, unit tested. The stored value is NOT rewritten — only validated.

export const VN_PHONE_INVALID_MESSAGE = 'Số điện thoại chưa đúng. Nhập SĐT Việt Nam, ví dụ 0912 345 678.';

/** Separators customers type: spaces, dots, dashes, parentheses. */
export function normalizePhoneInput(value: string): string {
  return value.trim().replace(/[\s.\-()]/g, '');
}

/** 0 + 9–10 digits, or +84 / 84 + 9–10 digits (mobile 10 digits, old landline 11). */
export function isVietnamesePhone(value: string): boolean {
  return /^(?:\+?84|0)\d{9,10}$/.test(normalizePhoneInput(value));
}

/** For <input pattern>: same rule, separators allowed. Browser validation runs before submit. */
export const VN_PHONE_HTML_PATTERN = '\\s*\\(?(\\+?84|0)[0-9 .\\-\\(\\)]{9,16}\\s*';
