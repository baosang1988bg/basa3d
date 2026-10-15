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
