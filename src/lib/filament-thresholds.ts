// Filament stock-warning cutoffs (phase-12.md Q5), shared by filament.service.ts's warningTier() and
// the Phase 41 dashboard (ADR-0044 §4). Percent of a spool's initial weight still remaining.
export const FILAMENT_LOW_STOCK_PCT = 20; // ≤ 20% → SAP_HET ("sắp hết")
export const FILAMENT_WATCH_PCT = 50; // ≤ 50% → CAN_THEO_DOI ("cần theo dõi")
