// ADR-0064 — storefront catalog search terms. Pure, unit tested.
// The query is split into words; EVERY word must appear in the folded product name (AND), and both
// sides are folded by `public.basa3d_search_fold` (migration 20261126000000) so "gia do" matches
// "Giá đỡ". `%`, `_` and `\` stay literal (Phase 56 guarantee).

export const SEARCH_MAX_TOKENS = 6;

/** NFC + whitespace split, at most SEARCH_MAX_TOKENS non-empty tokens, duplicates removed. */
export function searchTokens(search: string | undefined | null): string[] {
  if (!search) return [];
  const tokens = search.normalize('NFC').trim().split(/\s+/).filter(Boolean);
  return [...new Set(tokens)].slice(0, SEARCH_MAX_TOKENS);
}

function escapeLike(token: string): string {
  return token.replace(/[%_\\]/g, '\\$&');
}

/**
 * Appends one bind value per token to `values` and returns the SQL fragment (starting with ` and …`,
 * or '' when there is nothing to search). `column` must be a trusted SQL expression.
 */
export function buildSearchSql(search: string | undefined | null, values: unknown[], column = 'p.name'): string {
  let sql = '';
  for (const token of searchTokens(search)) {
    values.push(`%${escapeLike(token)}%`);
    sql += ` and public.basa3d_search_fold(${column}) like public.basa3d_search_fold($${values.length})`;
  }
  return sql;
}
