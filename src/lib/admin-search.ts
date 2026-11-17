// Phase 55 (D3) — free-text search on the admin Orders / Custom requests lists. Pure, so it is unit
// tested without a database. Staff paste phone numbers from Zalo in many shapes ("0333 698 638",
// "0333.698.638", "+84 333 698 638"), so a query that looks like a phone number is ALSO matched
// against the digits of the stored number.

export const ADMIN_SEARCH_MAX_LENGTH = 100;
const PHONE_LIKE_RE = /^[\d\s.+()-]+$/;
const MIN_PHONE_DIGITS = 3;

export type AdminSearch = {
  /** `%…%` pattern for ILIKE, with `%`, `_` and `\` escaped. */
  textPattern: string;
  /** `%digits%` when the query looks like (part of) a phone number, else null. */
  digitsPattern: string | null;
};

export function parseAdminSearch(raw: string | undefined | null): AdminSearch | null {
  const text = (raw ?? '').trim().slice(0, ADMIN_SEARCH_MAX_LENGTH);
  if (!text) return null;
  const textPattern = `%${text.replace(/[%_\\]/g, '\\$&')}%`;
  let digits = PHONE_LIKE_RE.test(text) ? text.replace(/\D/g, '') : '';
  // "+84 333…" and "0333…" are the same subscriber: compare on the part after the trunk prefix.
  if (text.startsWith('+84') && digits.startsWith('84')) digits = digits.slice(2);
  else if (digits.length >= 9 && digits.startsWith('0')) digits = digits.slice(1);
  return { textPattern, digitsPattern: digits.length >= MIN_PHONE_DIGITS ? `%${digits}%` : null };
}

/**
 * SQL fragment (starting with `and`) matching the search against a code column, the customer name
 * and the customer phone. Pushes its parameters onto `values` and returns '' when there is no search.
 * Column names are compile-time constants from the caller, never user input.
 */
export function adminSearchSql(search: AdminSearch | null, values: unknown[], columns: { code: string; name: string; phone: string }): string {
  if (!search) return '';
  values.push(search.textPattern);
  const text = `$${values.length}`;
  const parts = [`${columns.code} ilike ${text}`, `${columns.name} ilike ${text}`, `${columns.phone} ilike ${text}`];
  if (search.digitsPattern) {
    values.push(search.digitsPattern);
    parts.push(`regexp_replace(${columns.phone}, '\\D', '', 'g') like $${values.length}`);
  }
  return `and (${parts.join(' or ')})`;
}
