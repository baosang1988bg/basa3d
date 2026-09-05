export const NAMEPLATE_SIZE_PRESETS_MM = {
  keychain: 40,
  small: 65,
  medium: 90,
  large: 130,
} as const;
export const MIN_NAMEPLATE_WIDTH_MM = 30;
export const MAX_NAMEPLATE_WIDTH_MM = 200;
export const MAX_NAME_LENGTH = 12;
export const MIN_BASE_OVERLAP_MM = 0.1;
export const MAX_BASE_OVERLAP_MM = 1.0;
export const DEFAULT_BASE_OVERLAP_MM = 0.15;
export const MIN_BASE_THICKNESS_MM = 1.5;
export const MAX_BASE_THICKNESS_MM = 6;
export const DEFAULT_BASE_THICKNESS_MM = 3;
export const KEYRING_TAB_RADIUS_MM = 4;
export const KEYRING_HOLE_DIAMETER_MM = 3.5;
export const DEFAULT_NAMEPLATE_COLOR = '#e2e8f0';
export const DEFAULT_BASE_COLOR = '#1f2937';
export const FONTS = {
  Anton: '/fonts/Anton-Regular.ttf',
  Oswald: '/fonts/Oswald-Variable.ttf',
  'Be Vietnam Pro Bold': '/fonts/BeVietnamPro-Bold.ttf',
} as const;
export type Vehicle = 'sedan';
export const VEHICLES: Vehicle[] = ['sedan'];
