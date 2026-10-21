/**
 * Phase 45 — Organizer parity. Parameters, presets, printers and normalization ported 1:1 from the
 * reference "Bin & Sorting Tray Generator" (see docs/exec-plans/completed/phase-45-organizer-parity.md §1).
 * Pure TypeScript: no three.js, no manifold — safe to import from the worker, the UI and Node tests.
 */

export const WALL_TEXTURES = ['none', 'fluted', 'reeded', 'ribbed', 'wavy', 'faceted'] as const;
export type WallTexture = (typeof WALL_TEXTURES)[number];

export type OrganizerParams = {
  width: number; depth: number; height: number;
  cols: number; rows: number;
  wall: number; floor: number; divider: number; radius: number;
  stackingLip: boolean; labelTab: boolean; fingerScoops: boolean; floorHoles: boolean;
  wallTexture: WallTexture; textureDepth: number; textureCount: number;
  color: string;
  /**
   * BaSa3D extra (not in the reference, phase-45 D4): explicit inner cell sizes in mm. When set, they
   * override `cols`/`rows`; the last cell always absorbs the remaining space (auto-fit).
   */
  columnWidths?: number[] | null;
  rowDepths?: number[] | null;
};

export type LabelParams = {
  enabled: boolean; text: string; fontSize: number; embossDepth: number; plateHeight: number;
  plateColor: string; textColor: string;
};

export const DEFAULT_ORGANIZER_PARAMS: OrganizerParams = {
  width: 120, depth: 80, height: 40, cols: 3, rows: 2, wall: 2, floor: 2, divider: 1.6, radius: 3,
  stackingLip: false, labelTab: false, fingerScoops: false, floorHoles: false,
  wallTexture: 'none', textureDepth: 1, textureCount: 40, color: '#3b82f6',
  columnWidths: null, rowDepths: null,
};

export const DEFAULT_LABEL_PARAMS: LabelParams = {
  enabled: false, text: 'LABEL', fontSize: 8, embossDepth: 0.6, plateHeight: 14,
  plateColor: '#e2b23a', textColor: '#5c3a10',
};

export type NumericKey = 'width' | 'depth' | 'height' | 'cols' | 'rows' | 'wall' | 'floor' | 'divider' | 'radius' | 'textureDepth' | 'textureCount';
/** UI slider ranges — identical to the reference. Normalization also clamps to these (boundary validation). */
export const PARAM_RANGES: Record<NumericKey, { min: number; max: number; step: number; unit: 'mm' | '' }> = {
  width: { min: 20, max: 300, step: 1, unit: 'mm' },
  depth: { min: 20, max: 300, step: 1, unit: 'mm' },
  height: { min: 5, max: 150, step: 1, unit: 'mm' },
  cols: { min: 1, max: 12, step: 1, unit: '' },
  rows: { min: 1, max: 12, step: 1, unit: '' },
  wall: { min: 0.4, max: 6, step: 0.1, unit: 'mm' },
  floor: { min: 0.4, max: 8, step: 0.1, unit: 'mm' },
  divider: { min: 0.4, max: 6, step: 0.1, unit: 'mm' },
  radius: { min: 0, max: 15, step: 0.5, unit: 'mm' },
  textureDepth: { min: 0.2, max: 3, step: 0.1, unit: 'mm' },
  textureCount: { min: 4, max: 120, step: 1, unit: '' },
};
/** Label clamping in the worker (reference `bd`). Wider than the sliders so shared/API values survive. */
export const LABEL_RANGES = {
  fontSize: { min: 3, max: 40, step: 0.5 },
  embossDepth: { min: 0.2, max: 3, step: 0.1 },
  plateHeight: { min: 6, max: 40, step: 1 },
  maxTextLength: 24,
} as const;
/** Label slider ranges shown in the reference UI. */
export const LABEL_SLIDER_RANGES = {
  fontSize: { min: 3, max: 20, step: 0.5 },
  embossDepth: { min: 0.2, max: 2, step: 0.1 },
  plateHeight: { min: 8, max: 30, step: 1 },
} as const;

export type PresetId = 'smallTray' | 'deskOrganizer' | 'partsBin' | 'drawerInsert' | 'toolHolder' | 'screwSorter';
const preset = (values: Partial<OrganizerParams>): OrganizerParams => ({ ...DEFAULT_ORGANIZER_PARAMS, ...values });
export const ORGANIZER_PRESETS: { id: PresetId; params: OrganizerParams }[] = [
  { id: 'smallTray', params: preset({ width: 90, depth: 60, height: 25, cols: 2, rows: 1, wall: 1.6, floor: 1.6, divider: 1.2, radius: 2 }) },
  { id: 'deskOrganizer', params: preset({ width: 180, depth: 100, height: 60, cols: 4, rows: 2, wall: 2, floor: 2, divider: 1.6, radius: 4 }) },
  { id: 'partsBin', params: preset({ width: 120, depth: 80, height: 50, cols: 3, rows: 3, wall: 2, floor: 2, divider: 1.6, radius: 3 }) },
  { id: 'drawerInsert', params: preset({ width: 220, depth: 160, height: 40, cols: 5, rows: 4, wall: 1.6, floor: 1.6, divider: 1.2, radius: 2 }) },
  { id: 'toolHolder', params: preset({ width: 150, depth: 60, height: 80, cols: 6, rows: 1, wall: 2.4, floor: 3, divider: 2, radius: 3 }) },
  { id: 'screwSorter', params: preset({ width: 100, depth: 100, height: 30, cols: 4, rows: 4, wall: 1.2, floor: 1.2, divider: 1, radius: 2 }) },
];

export type PrinterId = 'a1mini' | 'bambu256' | 'prusa' | 'ender3' | 'large';
export const PRINTERS: { id: PrinterId; label: string; bed: [number, number] }[] = [
  { id: 'a1mini', label: 'Bambu A1 mini', bed: [180, 180] },
  { id: 'bambu256', label: 'Bambu A1 / P1 / X1', bed: [256, 256] },
  { id: 'prusa', label: 'Prusa MK4 / MK3', bed: [250, 210] },
  { id: 'ender3', label: 'Ender 3', bed: [220, 220] },
  { id: 'large', label: 'Large 300×300', bed: [300, 300] },
];
export const DEFAULT_PRINTER_ID: PrinterId = 'bambu256';

export type TextureDef = {
  id: Exclude<WallTexture, 'none'>;
  /** Normal offset at phase u ∈ [0,1) for a texture depth t. */
  offset: (u: number, t: number) => number;
  /** Perimeter samples per texture period. */
  ppg: number;
  reachesInward: boolean;
  growsOutward: boolean;
};
const raisedCosine = (u: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
function ribbedWave(u: number) {
  if (u >= 0.5) return 0;
  const ramp = 0.12;
  return u < ramp ? u / ramp : u > 0.5 - ramp ? (0.5 - u) / ramp : 1;
}
function triangleWave(u: number) {
  return u < 0.25 ? u / 0.25 : u < 0.75 ? 1 - (u - 0.25) / 0.25 : -1 + (u - 0.75) / 0.25;
}
export const TEXTURES: TextureDef[] = [
  { id: 'fluted', offset: (u, t) => -t * raisedCosine(u), ppg: 14, reachesInward: true, growsOutward: false },
  { id: 'reeded', offset: (u, t) => t * raisedCosine(u), ppg: 14, reachesInward: false, growsOutward: true },
  { id: 'ribbed', offset: (u, t) => t * ribbedWave(u), ppg: 12, reachesInward: false, growsOutward: true },
  { id: 'wavy', offset: (u, t) => t * Math.sin(2 * Math.PI * u), ppg: 14, reachesInward: true, growsOutward: true },
  { id: 'faceted', offset: (u, t) => t * triangleWave(u), ppg: 10, reachesInward: true, growsOutward: true },
];
export function textureDef(id: WallTexture | string): TextureDef | null {
  return TEXTURES.find((texture) => texture.id === id) ?? null;
}
export const MAX_TEXTURE_PERIODS = 150;
export const MAX_TEXTURE_POINTS = 2400;
export const MIN_TEXTURE_POINTS = 120;

/** Which panel section shows which warning, as in the reference (BaSa3D-only keys added where they belong). */
export const SECTION_WARNINGS = {
  dimensions: ['warn.widthRaised', 'warn.depthRaised', 'warn.heightRaised'],
  grid: ['warn.colsReduced', 'warn.rowsReduced', 'warn.customAutoFit', 'warn.customReset'],
  walls: ['warn.thinWalls'],
  radius: ['warn.radiusClamped'],
  texture: ['warn.textureClamped'],
  toggles: ['warn.lipWallThin'],
  label: ['warn.labelNoFit'],
} as const satisfies Record<string, readonly WarningKey[]>;

export type WarningKey =
  | 'warn.heightRaised' | 'warn.widthRaised' | 'warn.depthRaised' | 'warn.colsReduced' | 'warn.rowsReduced'
  | 'warn.radiusClamped' | 'warn.lipWallThin' | 'warn.textureClamped' | 'warn.labelNoFit'
  | 'warn.thinWalls' | 'warn.customAutoFit' | 'warn.customReset';

const MIN_THICKNESS = 0.4;
const MIN_CELL = 1;
const MIN_CAVITY = 1;
const MAX_GRID = 12;
/** BaSa3D extra: walls below this are allowed (parity) but flagged for a 0.4 mm nozzle. */
export const THIN_WALL_WARNING_MM = 0.8;
export const CUSTOM_TOLERANCE_MM = 0.5;

const finiteOr = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const HEX = /^#[0-9a-fA-F]{6}$/;
const hexOr = (value: unknown, fallback: string) => (typeof value === 'string' && HEX.test(value) ? value : fallback);

function maxCells(length: number, wall: number, divider: number) {
  return Math.floor((length - 2 * wall + divider) / (MIN_CELL + divider));
}
export function usableSpan(length: number, wall: number, divider: number, cells: number) {
  return length - 2 * wall - (cells - 1) * divider;
}
export function roundedRectPerimeter(width: number, depth: number, radius: number) {
  return 2 * (width - 2 * radius) + 2 * (depth - 2 * radius) + 2 * Math.PI * radius;
}

/**
 * Keep the leading custom cells and give the last cell whatever space remains.
 * Returns null when the list is unusable (empty, non-finite, too many, or no room left).
 */
export function autoFitCells(span: number, sizes: readonly number[] | null | undefined): number[] | null {
  if (!sizes || sizes.length < 1 || sizes.length > MAX_GRID) return null;
  if (sizes.some((size) => !Number.isFinite(size) || size < MIN_CELL)) return null;
  const last = span - sizes.slice(0, -1).reduce((sum, size) => sum + size, 0);
  if (!(last >= MIN_CELL)) return null;
  return [...sizes.slice(0, -1), last];
}

/**
 * Port of the reference worker's normalization (clamps instead of throwing, reports warnings),
 * plus boundary clamping to PARAM_RANGES for values that arrive from a shared URL.
 */
export function normalizeOrganizerParams(input: Partial<OrganizerParams>): { params: OrganizerParams; warnings: WarningKey[] } {
  const warnings: WarningKey[] = [];
  const d = DEFAULT_ORGANIZER_PARAMS;
  const range = (key: NumericKey) => clamp(finiteOr(input[key], d[key]), PARAM_RANGES[key].min, PARAM_RANGES[key].max);
  const p: OrganizerParams = {
    width: range('width'), depth: range('depth'), height: range('height'),
    cols: range('cols'), rows: range('rows'),
    wall: range('wall'), floor: range('floor'), divider: range('divider'), radius: finiteOr(input.radius, d.radius),
    stackingLip: input.stackingLip === true, labelTab: input.labelTab === true,
    fingerScoops: input.fingerScoops === true, floorHoles: input.floorHoles === true,
    wallTexture: (WALL_TEXTURES as readonly string[]).includes(input.wallTexture as string) ? input.wallTexture as WallTexture : 'none',
    textureDepth: finiteOr(input.textureDepth, d.textureDepth), textureCount: finiteOr(input.textureCount, d.textureCount),
    color: hexOr(input.color, d.color),
    columnWidths: null, rowDepths: null,
  };
  p.radius = Math.min(p.radius, PARAM_RANGES.radius.max);
  p.textureDepth = Math.min(p.textureDepth, PARAM_RANGES.textureDepth.max);
  p.textureCount = clamp(p.textureCount, 1, PARAM_RANGES.textureCount.max);

  // --- Reference normalization (same order, same messages) ---
  p.wall = Math.max(MIN_THICKNESS, p.wall);
  p.floor = Math.max(MIN_THICKNESS, p.floor);
  p.divider = Math.max(MIN_THICKNESS, p.divider);
  if (p.height <= p.floor + MIN_CAVITY) { p.height = p.floor + MIN_CAVITY; warnings.push('warn.heightRaised'); }
  p.cols = Math.max(1, Math.round(p.cols));
  p.rows = Math.max(1, Math.round(p.rows));
  if (p.cols > MAX_GRID) { p.cols = MAX_GRID; warnings.push('warn.colsReduced'); }
  if (p.rows > MAX_GRID) { p.rows = MAX_GRID; warnings.push('warn.rowsReduced'); }

  // BaSa3D extra (D4): custom cell lists decide the counts before the fit check below.
  const customCols = input.columnWidths && input.columnWidths.length ? input.columnWidths : null;
  const customRows = input.rowDepths && input.rowDepths.length ? input.rowDepths : null;
  if (customCols) p.cols = Math.min(MAX_GRID, customCols.length);
  if (customRows) p.rows = Math.min(MAX_GRID, customRows.length);

  let fit = maxCells(p.width, p.wall, p.divider);
  if (fit < 1) { p.width = 2 * p.wall + MIN_CELL; p.cols = 1; warnings.push('warn.widthRaised'); }
  else if (p.cols > fit) { p.cols = fit; warnings.push('warn.colsReduced'); }
  fit = maxCells(p.depth, p.wall, p.divider);
  if (fit < 1) { p.depth = 2 * p.wall + MIN_CELL; p.rows = 1; warnings.push('warn.depthRaised'); }
  else if (p.rows > fit) { p.rows = fit; warnings.push('warn.rowsReduced'); }

  const maxRadius = Math.max(0, Math.min(p.width, p.depth) / 2 - p.wall);
  if (p.radius < 0) p.radius = 0;
  if (p.radius > maxRadius) { p.radius = maxRadius; warnings.push('warn.radiusClamped'); }
  if (p.stackingLip && Math.min(1.2, p.wall - 0.6) < MIN_THICKNESS) warnings.push('warn.lipWallThin');

  const texture = textureDef(p.wallTexture);
  if (texture) {
    let clamped = false;
    p.textureDepth = Math.max(0, p.textureDepth);
    if (texture.reachesInward) {
      let limit = p.wall - MIN_THICKNESS;
      if (p.radius > 0.5) limit = Math.min(limit, p.radius * 0.8);
      limit = Math.max(0, limit);
      if (p.textureDepth > limit) { p.textureDepth = limit; clamped = true; }
    } else if (p.textureDepth > 3) { p.textureDepth = 3; clamped = true; }
    const perimeter = roundedRectPerimeter(p.width, p.depth, p.radius);
    const maxPeriods = Math.max(1, Math.min(MAX_TEXTURE_PERIODS, Math.floor(perimeter / (2 * Math.max(p.textureDepth, 0.2)))));
    p.textureCount = Math.max(1, Math.round(p.textureCount));
    if (p.textureCount > maxPeriods) { p.textureCount = maxPeriods; clamped = true; }
    if (clamped) warnings.push('warn.textureClamped');
  }

  // --- BaSa3D extras ---
  if (customCols) {
    const fitted = customCols.length === p.cols ? autoFitCells(usableSpan(p.width, p.wall, p.divider, p.cols), customCols) : null;
    if (!fitted) warnings.push('warn.customReset');
    else {
      if (Math.abs(fitted[fitted.length - 1] - customCols[customCols.length - 1]) > CUSTOM_TOLERANCE_MM) warnings.push('warn.customAutoFit');
      p.columnWidths = fitted;
    }
  }
  if (customRows) {
    const fitted = customRows.length === p.rows ? autoFitCells(usableSpan(p.depth, p.wall, p.divider, p.rows), customRows) : null;
    if (!fitted) warnings.push('warn.customReset');
    else {
      if (Math.abs(fitted[fitted.length - 1] - customRows[customRows.length - 1]) > CUSTOM_TOLERANCE_MM) warnings.push('warn.customAutoFit');
      p.rowDepths = fitted;
    }
  }
  if (p.wall < THIN_WALL_WARNING_MM || p.divider < THIN_WALL_WARNING_MM) warnings.push('warn.thinWalls');

  return { params: p, warnings: [...new Set(warnings)] };
}

export function normalizeLabelParams(input: Partial<LabelParams> | null | undefined): LabelParams {
  const d = DEFAULT_LABEL_PARAMS;
  const value = input ?? {};
  const range = (key: 'fontSize' | 'embossDepth' | 'plateHeight') =>
    clamp(finiteOr(value[key], d[key]), LABEL_RANGES[key].min, LABEL_RANGES[key].max);
  return {
    enabled: value.enabled === true,
    text: (typeof value.text === 'string' ? value.text : '').slice(0, LABEL_RANGES.maxTextLength),
    fontSize: range('fontSize'), embossDepth: range('embossDepth'), plateHeight: range('plateHeight'),
    plateColor: hexOr(value.plateColor, d.plateColor), textColor: hexOr(value.textColor, d.textColor),
  };
}

/** Same rule as the reference: no 90° rotation; outward textures add 2× depth to the footprint. */
export function fitsPrinter(params: Pick<OrganizerParams, 'width' | 'depth' | 'wallTexture' | 'textureDepth'>, printerId: PrinterId): boolean {
  const printer = PRINTERS.find((item) => item.id === printerId);
  if (!printer) return true;
  const texture = textureDef(params.wallTexture);
  const grow = texture && texture.growsOutward ? 2 * Math.max(0, params.textureDepth) : 0;
  return params.width + grow <= printer.bed[0] && params.depth + grow <= printer.bed[1];
}

export type CellLayout = {
  cellWidths: number[]; cellDepths: number[];
  /** Cell centre coordinates (bin centred on the origin). */
  xs: number[]; ys: number[];
  cavityHeight: number;
};
export function cellLayout(p: OrganizerParams): CellLayout {
  const usableW = usableSpan(p.width, p.wall, p.divider, p.cols);
  const usableD = usableSpan(p.depth, p.wall, p.divider, p.rows);
  const customW = p.columnWidths && p.columnWidths.length === p.cols ? p.columnWidths : null;
  const customD = p.rowDepths && p.rowDepths.length === p.rows ? p.rowDepths : null;
  // Equal grid: same float expression as the reference (`x0 + i·(cell + divider)`). Accumulating instead
  // shifts the last bits, which changes manifold's triangulation (same volume, different triangle count).
  const centres = (start: number, count: number, custom: readonly number[] | null, cell: number) => {
    if (!custom) return Array.from({ length: count }, (_, i) => start + cell / 2 + i * (cell + p.divider));
    const out: number[] = [];
    let cursor = start;
    for (const size of custom) { out.push(cursor + size / 2); cursor += size + p.divider; }
    return out;
  };
  return {
    cellWidths: customW ?? Array<number>(p.cols).fill(usableW / p.cols),
    cellDepths: customD ?? Array<number>(p.rows).fill(usableD / p.rows),
    xs: centres(-p.width / 2 + p.wall, p.cols, customW, usableW / p.cols),
    ys: centres(-p.depth / 2 + p.wall, p.rows, customD, usableD / p.rows),
    cavityHeight: p.height - p.floor,
  };
}
