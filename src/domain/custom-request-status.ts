// Pure (no server imports) so client components can show only the moves the server will accept.
// custom-request.service.ts re-exports these; the server stays the enforcement point.
export const CUSTOM_REQUEST_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['REVIEWING', 'REJECTED'],
  REVIEWING: ['NEED_INFO', 'QUOTED', 'REJECTED'],
  NEED_INFO: ['REVIEWING', 'REJECTED'],
  QUOTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['CONVERTED'],
  REJECTED: [],
  CONVERTED: [],
};

export function nextCustomRequestStatuses(status: string) {
  return CUSTOM_REQUEST_STATUS_TRANSITIONS[status] ?? [];
}

/**
 * Owner decision 2026-11-24 (ADR-0066): the site is a QUOTE site, so the request status follows its quotes
 * automatically instead of staff moving it by hand. Returns the new status, or null to leave it alone
 * (already further along, REJECTED, or CONVERTED). Only ever moves FORWARD.
 * - a quote is created → QUOTED (DRAFT/SENT is not used in practice: the quote link goes out over Zalo);
 * - a quote is accepted → APPROVED.
 */
export function syncedCustomRequestStatus(current: string, event: 'QUOTE_CREATED' | 'QUOTE_ACCEPTED'): string | null {
  const open = ['NEW', 'REVIEWING', 'NEED_INFO'];
  if (event === 'QUOTE_CREATED') return open.includes(current) ? 'QUOTED' : null;
  return open.includes(current) || current === 'QUOTED' ? 'APPROVED' : null;
}
