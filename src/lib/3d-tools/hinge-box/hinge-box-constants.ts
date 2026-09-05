export const MIN_WIDTH_MM = 40;
export const MAX_WIDTH_MM = 250;
export const DEFAULT_WIDTH_MM = 100;
export const MIN_DEPTH_MM = 30;
export const MAX_DEPTH_MM = 200;
export const DEFAULT_DEPTH_MM = 65.5;
export const MIN_CLOSED_HEIGHT_MM = 15;
export const MAX_CLOSED_HEIGHT_MM = 100;
export const DEFAULT_CLOSED_HEIGHT_MM = 35;
export const MAX_GRID_ROWS = 8;
export const MAX_GRID_COLS = 8;
export const MIN_DIVIDER_THICKNESS_MM = 1.0;
export const MAX_DIVIDER_THICKNESS_MM = 3.0;
export const DEFAULT_DIVIDER_THICKNESS_MM = 1.6;
export const SHELL_WALL_THICKNESS_MM = 1.6;
export const FLOOR_THICKNESS_MM = 1.6;
export const BASE_HEIGHT_RATIO = 0.55; // base tray gets 55% of the closed height, lid gets 45%
/**
 * Living-hinge dimensions — picked from common FDM/PLA print-in-place hinge practice (0.6-1.0mm
 * flexible thickness, several short segments rather than one long strip to spread bending stress),
 * NOT measured from the reference site (not exposed via static DOM) and NOT verified with a real
 * print in this implementation environment. See phase-25.md mục 2.2/mục 5 — accepted, non-blocking
 * risk, same status as Phase 20's unverified wall/floor bond.
 */
export const HINGE_THICKNESS_MM = 0.6;
export const HINGE_GAP_MM = 1.8;
export const HINGE_SEGMENT_LENGTH_MM = 8;
export const HINGE_SEGMENT_GAP_MM = 4;
/** A small friction bump, not a real snap-fit latch — see phase-25.md mục 2.3. */
export const LATCH_BUMP_SIZE_MM = 3;
export const OVERLAP_MM = 0.2;
export const DEFAULT_COLOR = '#e5e7eb';
