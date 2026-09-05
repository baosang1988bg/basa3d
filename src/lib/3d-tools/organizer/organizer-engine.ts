import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import * as C from './organizer-constants';

export type OrganizerOptions = {
  widthMm: number; depthMm: number; heightMm: number;
  wallThicknessMm: number; bottomThicknessMm: number;
} & ({ mode: 'equal'; rows: number; cols: number } | {
  mode: 'custom'; columnWidthsMm: number[]; rowHeightsMm: number[];
});
export const DEFAULT_ORGANIZER_OPTIONS: OrganizerOptions = {
  widthMm: 180, depthMm: 120, heightMm: 35, wallThicknessMm: 1.6,
  bottomThicknessMm: 2, mode: 'equal', rows: 3, cols: 4,
};
function bound(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${label}: từ ${min} đến ${max}.`);
}
function count(value: number, max: number) {
  bound(value, 1, max, 'Số ngăn');
  if (!Number.isInteger(value)) throw new RangeError('Số ngăn phải là số nguyên.');
}
function available(dimension: number, wall: number, cells: number) {
  const space = dimension - (cells + 1) * wall;
  if (space <= 0) throw new RangeError('Không đủ không gian cho các ngăn và vách.');
  return space;
}
/** Preserve preceding cells and put the remaining clear dimension in the last cell. */
export function autoFitOrganizerCells(dimension: number, wall: number, sizes: number[]): number[] {
  bound(dimension, C.MIN_TRAY_DIMENSION_MM, Math.max(C.MAX_TRAY_WIDTH_MM, C.MAX_TRAY_DEPTH_MM), 'Kích thước');
  bound(wall, C.MIN_WALL_THICKNESS_MM, C.MAX_WALL_THICKNESS_MM, 'Độ dày vách');
  count(sizes.length, Math.min(C.MAX_GRID_ROWS, C.MAX_GRID_COLS));
  if (sizes.some((size) => !Number.isFinite(size) || size <= 0)) throw new RangeError('Kích thước ngăn phải lớn hơn 0.');
  const last = available(dimension, wall, sizes.length) - sizes.slice(0, -1).reduce((sum, size) => sum + size, 0);
  if (last <= 0) throw new RangeError('Không còn không gian cho ngăn cuối.');
  return [...sizes.slice(0, -1), last];
}
export function resolveOrganizerGrid(options: OrganizerOptions) {
  bound(options.widthMm, C.MIN_TRAY_DIMENSION_MM, C.MAX_TRAY_WIDTH_MM, 'Chiều rộng');
  bound(options.depthMm, C.MIN_TRAY_DIMENSION_MM, C.MAX_TRAY_DEPTH_MM, 'Chiều sâu');
  bound(options.heightMm, C.MIN_TRAY_DIMENSION_MM, C.MAX_TRAY_HEIGHT_MM, 'Chiều cao');
  bound(options.wallThicknessMm, C.MIN_WALL_THICKNESS_MM, C.MAX_WALL_THICKNESS_MM, 'Độ dày vách');
  bound(options.bottomThicknessMm, C.MIN_BOTTOM_THICKNESS_MM, C.MAX_BOTTOM_THICKNESS_MM, 'Độ dày đáy');
  if (options.mode !== 'equal' && options.mode !== 'custom') throw new RangeError('Chế độ lưới không hợp lệ.');
  const rows = options.mode === 'equal' ? options.rows : options.rowHeightsMm.length;
  const cols = options.mode === 'equal' ? options.cols : options.columnWidthsMm.length;
  count(rows, C.MAX_GRID_ROWS); count(cols, C.MAX_GRID_COLS);
  const axis = (dimension: number, cells: number, sizes?: number[]) => {
    const space = available(dimension, options.wallThicknessMm, cells);
    if (!sizes) return Array<number>(cells).fill(space / cells);
    if (Math.abs(sizes.reduce((sum, size) => sum + size, 0) - space) > 0.5 + 1e-9) throw new RangeError('Tổng kích thước ngăn lệch quá 0.5 mm. Hãy dùng Auto-fit.');
    return autoFitOrganizerCells(dimension, options.wallThicknessMm, sizes);
  };
  return { rows, cols,
    columnWidthsMm: axis(options.widthMm, cols, options.mode === 'custom' ? options.columnWidthsMm : undefined),
    rowHeightsMm: axis(options.depthMm, rows, options.mode === 'custom' ? options.rowHeightsMm : undefined),
  };
}
export function buildOrganizerModel(options: OrganizerOptions) {
  const grid = resolveOrganizerGrid(options);
  const { widthMm: w, depthMm: d, heightMm: h, wallThicknessMm: t, bottomThicknessMm: b } = options;
  const e = C.WALL_OVERLAP_EPSILON_MM;
  const parts: THREE.BufferGeometry[] = [];
  const box = (x: number, y: number, z: number, cx: number, cy: number, cz: number) => {
    parts.push(new THREE.BoxGeometry(x, y, z).translate(cx, cy, cz));
  };
  box(w, d, b, 0, 0, b / 2);
  const wallHeight = h - b + e; const z = (h + b - e) / 2;
  box(t, d, wallHeight, -(w - t) / 2, 0, z);
  box(t, d, wallHeight, (w - t) / 2, 0, z);
  box(w - 2 * t + 2 * e, t, wallHeight, 0, -(d - t) / 2, z);
  box(w - 2 * t + 2 * e, t, wallHeight, 0, (d - t) / 2, z);
  let x = -w / 2 + t;
  for (const size of grid.columnWidthsMm.slice(0, -1)) {
    x += size; box(t, d - 2 * t + 2 * e, wallHeight, x + t / 2, 0, z); x += t;
  }
  let y = -d / 2 + t;
  for (const size of grid.rowHeightsMm.slice(0, -1)) {
    y += size; box(w - 2 * t + 2 * e, t, wallHeight, 0, y + t / 2, z); y += t;
  }
  // Merge retains intersecting closed shells; slicing performs the union, per Phase 20.
  const mergedGeometry = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!mergedGeometry) throw new Error('Không thể gộp mô hình STL.');
  return { ...grid, mergedGeometry };
}
export function exportOrganizerStl(geometry: THREE.BufferGeometry): Blob {
  const data = new STLExporter().parse(new THREE.Mesh(geometry), { binary: true });
  return new Blob([new Uint8Array(data.buffer, data.byteOffset, data.byteLength)], { type: 'model/stl' });
}
