// Phase 36 S3 (ADR-0041): BaSa3D is a Vietnamese workshop, so "today", "this month" and every daily /
// monthly report bucket mean the Asia/Ho_Chi_Minh calendar — never the database session's TimeZone
// (UTC on hosted Supabase, the Mac's zone on a Homebrew test DB). Storage stays plain `timestamptz`
// (`now()`); only calendar bucketing converts, explicitly, with these SQL fragments.
//
// A constant literal, not a bind parameter: it is never user input, and inlining it lets Postgres
// keep using plain expressions in GROUP BY / generate_series.
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** `ts at time zone 'Asia/Ho_Chi_Minh'` — the local wall-clock timestamp of a timestamptz column. */
export function sqlLocal(column: string): string {
  return `(${column} at time zone '${BUSINESS_TIME_ZONE}')`;
}

/** Local calendar date of a timestamptz column. */
export function sqlLocalDate(column: string): string {
  return `${sqlLocal(column)}::date`;
}

/** Today's local calendar date. */
export const SQL_LOCAL_TODAY = sqlLocalDate('now()');
