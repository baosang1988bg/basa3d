/**
 * Formats a 10-digit Vietnamese phone number into standard readable chunks: `0xxx xxx xxx` (e.g. `0333 698 638`).
 * If the input is already formatted or not a 10-digit phone number, it preserves/returns appropriately.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (cleaned.startsWith('+84') && digits.length === 11 && digits.startsWith('84')) {
    const local = `0${digits.slice(2)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return phone;
}
