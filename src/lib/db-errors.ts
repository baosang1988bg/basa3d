// QA-002 (docs/qa/2026-11-24-user-test-performance-audit.md): a deploy whose code is newer than the
// database (a migration was not applied) fails with Postgres "undefined function / column / table".
// Those used to surface as a generic 500 ("Mất kết nối tới máy chủ" on the admin forms), which hid
// the real fix: run the pending migration. Pure, unit tested.

/** 42883 undefined_function · 42703 undefined_column · 42P01 undefined_table */
const SCHEMA_DRIFT_CODES = new Set(['42883', '42703', '42P01']);

export const SCHEMA_OUT_OF_DATE_MESSAGE =
  'Cơ sở dữ liệu chưa được cập nhật bản mới nhất (thiếu migration). Vui lòng báo kỹ thuật chạy "npm run db:check-migrations" rồi thử lại.';

export function isSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && SCHEMA_DRIFT_CODES.has(code);
}
