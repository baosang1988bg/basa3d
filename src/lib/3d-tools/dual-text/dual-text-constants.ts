export const MAX_DUAL_TEXT_BLOCKS = 12;
export const MIN_BLOCK_SIZE_MM = 10;
export const MAX_BLOCK_SIZE_MM = 40;
export const DEFAULT_BLOCK_SIZE_MM = 20;
export const MIN_BLOCK_GAP_MM = 0;
export const MAX_BLOCK_GAP_MM = 5;
export const DEFAULT_BLOCK_GAP_MM = 1;
export const MIN_BASE_MARGIN_MM = 0;
export const MAX_BASE_MARGIN_MM = 15;
export const DEFAULT_BASE_MARGIN_MM = 4;
export const MIN_BASE_HEIGHT_MM = 1.5;
export const MAX_BASE_HEIGHT_MM = 8;
export const DEFAULT_BASE_HEIGHT_MM = 3;
export const DEFAULT_BASE_CORNER_PERCENT = 80;
export const OVERLAP_MM = 0.2;
export const DEFAULT_TEXT_COLOR = '#f59e0b';
export const DEFAULT_BASE_COLOR = '#475569';
export const FONTS = {
  Anton: '/fonts/Anton-Regular.ttf',
  Oswald: '/fonts/Oswald-Variable.ttf',
  'Be Vietnam Pro Bold': '/fonts/BeVietnamPro-Bold.ttf',
} as const;
/**
 * Whether the side-facing glyph is mirrored before rotating into place. Picked analytically
 * (no GPU/screenshot available in the implementation environment to visually confirm reading
 * direction from the +X corner) — flip this single constant if Owner/print testing finds the
 * second word reads backwards. See phase-22.md mục 5 (Risks).
 */
export const SIDE_GLYPH_MIRRORED = false;
