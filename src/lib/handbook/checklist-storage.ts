// Phase 50 — pre-flight checklist persistence. localStorage is external input (AGENTS.md rule #6):
// it can be missing, corrupt, written by an older version, or throw (Safari private mode). These
// pure helpers are the only code that turns the raw string into state, and they never throw.

export const CHECKLIST_STORAGE_KEY = 'basa3d_preflight_checklist:v1';

/** Checked step ids, in the order of `validIds`, with unknown/duplicate ids dropped. */
export function parseChecklistState(raw: string | null | undefined, validIds: readonly string[]): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { checked?: unknown }).checked)) return [];
  const checked = new Set((parsed as { checked: unknown[] }).checked.filter((id): id is string => typeof id === 'string'));
  return validIds.filter((id) => checked.has(id));
}

export function serializeChecklistState(checked: Iterable<string>, validIds: readonly string[]): string {
  const set = new Set(checked);
  return JSON.stringify({ checked: validIds.filter((id) => set.has(id)) });
}
