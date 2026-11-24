// Trend watchlist status rules (ADR-0062 §4). Pure — shared by the service and the admin client.

export const TREND_WATCH_STATUSES = ['WATCHING', 'PRINT_TESTING', 'CONVERTED_DRAFT', 'ARCHIVED'] as const;
export type TrendWatchStatus = (typeof TREND_WATCH_STATUSES)[number];

export const TREND_WATCH_TRANSITIONS: Record<TrendWatchStatus, readonly TrendWatchStatus[]> = {
  WATCHING: ['PRINT_TESTING', 'CONVERTED_DRAFT', 'ARCHIVED'],
  PRINT_TESTING: ['WATCHING', 'CONVERTED_DRAFT', 'ARCHIVED'],
  CONVERTED_DRAFT: ['ARCHIVED'],
  ARCHIVED: ['WATCHING'],
};

/** Same-status updates are allowed (no-op). */
export function canTransitionTrendStatus(from: TrendWatchStatus, to: TrendWatchStatus): boolean {
  return from === to || TREND_WATCH_TRANSITIONS[from].includes(to);
}
