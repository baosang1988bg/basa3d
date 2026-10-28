// Phase 53 S7 (I6 DEFER) — deep links to a single defect on the pillar page, e.g. `/cam-nang#loi-stringing`.
// The `loi-` prefix keeps defect anchors out of the chapter-id namespace (`xu-ly-loi`, `dung-sai`, …).
// Defect ids are published URLs from here on: never rename one (B4).

export const DEFECT_ANCHOR_PREFIX = 'loi-';

export const defectAnchorId = (defectId: string) => `${DEFECT_ANCHOR_PREFIX}${defectId}`;

/**
 * `location.hash` is external input (rule #6): anyone can share `#<anything>`. Returns the element id
 * to look up only when the hash is a well-formed defect anchor; otherwise null.
 */
export function parseDefectHash(hash: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(hash);
  } catch {
    return null;
  }
  const match = /^#(loi-[a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(decoded);
  return match ? match[1] : null;
}
