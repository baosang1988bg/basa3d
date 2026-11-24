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

/**
 * QA-014: orders.shipping_address is free-form jsonb ({ line1, ward, district, city, … }). Admin used to
 * print it with JSON.stringify. Known keys first in address order, then any other non-empty strings.
 */
const ADDRESS_KEY_ORDER = ['line1', 'addressLine1', 'line2', 'ward', 'district', 'city', 'province'];
export function formatShippingAddress(address: unknown): string {
  if (typeof address === 'string') return address.trim();
  if (!address || typeof address !== 'object' || Array.isArray(address)) return '';
  const record = address as Record<string, unknown>;
  const keys = [...ADDRESS_KEY_ORDER.filter((key) => key in record), ...Object.keys(record).filter((key) => !ADDRESS_KEY_ORDER.includes(key))];
  return keys
    .map((key) => record[key])
    .filter((value): value is string | number => (typeof value === 'string' && value.trim() !== '') || typeof value === 'number')
    .map((value) => String(value).trim())
    .join(', ');
}
