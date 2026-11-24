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
export function buildSearchSql(
  search: string | undefined | null,
  values: unknown[],
  column = 'p.name',
  options: { fold?: boolean } = {},
): string {
  const fold = options.fold ?? true;
  let sql = '';
  for (const token of searchTokens(search)) {
    values.push(`%${escapeLike(token)}%`);
    sql += fold
      ? ` and public.basa3d_search_fold(${column}) like public.basa3d_search_fold($${values.length})`
      // QA-001 fallback: DB without migration 20261126000000 — case-insensitive only, accents must match.
      : ` and lower(${column}) like lower($${values.length})`;
  }
  return sql;
}

/** QA-001: true when Postgres says `basa3d_search_fold` does not exist (migration not applied yet). */
export function isMissingSearchFoldError(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return code === '42883' && typeof message === 'string' && message.includes('basa3d_search_fold');
}
