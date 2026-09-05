export const PATTERN_TYPES = ['circle', 'hexagon', 'vertical-slit', 'diamond', 'wave'] as const;
export type PatternType = (typeof PATTERN_TYPES)[number];

export const MIN_AROUND = 6;
export const MAX_AROUND = 48;
export const DEFAULT_AROUND = 18;
export const MIN_ROWS = 2;
export const MAX_ROWS = 30;
export const DEFAULT_ROWS = 9;
export const MIN_CELL_SIZE_MM = 6;
export const MAX_CELL_SIZE_MM = 25;
export const DEFAULT_CELL_SIZE_MM = 12;
export const MAX_TOTAL_HOLES = 1000;
export const MIN_ROTATION_DEG = 0;
export const MAX_ROTATION_DEG = 359;
export const DEFAULT_ROTATION_DEG = 0;
export const WALL_THICKNESS_MM = 1.6;
/** Fraction of a grid cell a hole occupies, leaving structural webbing between holes. */
export const HOLE_FILL_RATIO = 0.65;
/**
 * Lower bound for the shade's usable inner radius, matched against the "MH001" kit's real socket
 * diameter — not independently verified against real hardware (khảo sát không tra được thông số
 * chính xác). See phase-24.md mục 2.3: warn, don't block, Owner to confirm the real kit dimension.
 */
export const SOCKET_MIN_INNER_DIAMETER_MM = 60;
export const DEFAULT_SHADE_COLOR = '#f5f5f4';
