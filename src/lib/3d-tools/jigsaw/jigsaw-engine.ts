import * as THREE from 'three';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as C from './jigsaw-constants';

export interface ColoredPart {
  geometry: THREE.BufferGeometry;
  colorHex: string;
  name: string;
}

export function validateColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RangeError('Màu phải có dạng #RRGGBB.');
}

function countTriangles(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  return (index ? index.count : position.count) / 3;
}

/** Parse an uploaded STL/OBJ file into a single, centered `BufferGeometry` (not yet cut). */
export async function loadUploadedMesh(file: File): Promise<THREE.BufferGeometry> {
  if (file.size > C.MAX_UPLOAD_SIZE_MB * 1024 * 1024) throw new RangeError(`File vượt quá ${C.MAX_UPLOAD_SIZE_MB}MB.`);
  const extension = file.name.toLowerCase().split('.').pop();
  let geometry: THREE.BufferGeometry;
  if (extension === 'stl') {
    geometry = new STLLoader().parse(await file.arrayBuffer());
  } else if (extension === 'obj') {
    const object = new OBJLoader().parse(await file.text());
    const mesh = object.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    if (!mesh) throw new RangeError('Không tìm thấy mesh nào trong file OBJ.');
    geometry = mesh.geometry;
  } else {
    throw new RangeError('Chỉ hỗ trợ file .stl hoặc .obj.');
  }
  if (!geometry.getAttribute('position')?.count) throw new RangeError('File không chứa hình học hợp lệ.');
  const triangles = countTriangles(geometry);
  if (triangles > C.MAX_TRIANGLES) throw new RangeError(`Mô hình có ${Math.round(triangles).toLocaleString('vi-VN')} tam giác, vượt quá giới hạn ${C.MAX_TRIANGLES.toLocaleString('vi-VN')}.`);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -box.min.y, -center.z);
  geometry.computeVertexNormals();
  return geometry;
}

function validateGrid(rows: number, cols: number) {
  if (!Number.isInteger(rows) || rows < 1 || rows > C.MAX_GRID) throw new RangeError(`Hàng cần từ 1 đến ${C.MAX_GRID}.`);
  if (!Number.isInteger(cols) || cols < 1 || cols > C.MAX_GRID) throw new RangeError(`Cột cần từ 1 đến ${C.MAX_GRID}.`);
}

/** A straight run from `from` to `to`, replaced by a semicircular bump of `radius` at the midpoint
 * — bulging along `axis` ('x' or 'z') in the `outward` (+1/-1) direction. Used for a shared edge
 * between two grid cells so the pair interlocks (one cell bumps out, its neighbor bumps in). */
function pushPuzzleEdge(points: THREE.Vector2[], from: THREE.Vector2, to: THREE.Vector2, axis: 'x' | 'z', outward: 1 | -1, radius: number) {
  const midX = (from.x + to.x) / 2;
  const midZ = (from.y + to.y) / 2;
  const bumpStart = axis === 'x' ? new THREE.Vector2(from.x, midZ - radius) : new THREE.Vector2(midX - radius, from.y);
  const bumpEnd = axis === 'x' ? new THREE.Vector2(from.x, midZ + radius) : new THREE.Vector2(midX + radius, from.y);
  points.push(bumpStart);
  for (let i = 1; i < C.TAB_ARC_SEGMENTS; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / C.TAB_ARC_SEGMENTS;
    if (axis === 'x') points.push(new THREE.Vector2(from.x + outward * radius * Math.cos(t), midZ + radius * Math.sin(t)));
    else points.push(new THREE.Vector2(midX + radius * Math.sin(t), from.y + outward * radius * Math.cos(t)));
  }
  points.push(bumpEnd);
  points.push(to);
}

/** The (x, z) footprint shape for grid cell (row, col), with straight boundary edges and puzzle-
 * tab edges shared with interior neighbors — checkerboard-alternating bump direction so adjacent
 * cells always interlock. */
function buildCellShape(x0: number, x1: number, z0: number, z1: number, row: number, col: number, rows: number, cols: number, radius: number): THREE.Shape {
  const points: THREE.Vector2[] = [];
  const parity = (row + col) % 2 === 0 ? 1 : -1;
  // Bottom edge (z0), left -> right.
  points.push(new THREE.Vector2(x0, z0));
  if (row > 0) pushPuzzleEdge(points, new THREE.Vector2(x0, z0), new THREE.Vector2(x1, z0), 'z', parity as 1 | -1, radius);
  else points.push(new THREE.Vector2(x1, z0));
  // Right edge (x1), bottom -> top.
  if (col < cols - 1) pushPuzzleEdge(points, new THREE.Vector2(x1, z0), new THREE.Vector2(x1, z1), 'x', parity as 1 | -1, radius);
  else points.push(new THREE.Vector2(x1, z1));
  // Top edge (z1), right -> left.
  if (row < rows - 1) pushPuzzleEdge(points, new THREE.Vector2(x1, z1), new THREE.Vector2(x0, z1), 'z', (-parity) as 1 | -1, radius);
  else points.push(new THREE.Vector2(x0, z1));
  // Left edge (x0), top -> bottom.
  if (col > 0) pushPuzzleEdge(points, new THREE.Vector2(x0, z1), new THREE.Vector2(x0, z0), 'x', (-parity) as 1 | -1, radius);
  const shape = new THREE.Shape(points);
  return shape;
}

export interface JigsawPiece {
  geometry: THREE.BufferGeometry;
  row: number;
  col: number;
}

/** Cuts `sourceGeometry` into a `rows` x `cols` grid of interlocking jigsaw pieces (see
 * phase-26.md mục 3.1 — a rectangular grid with wavy puzzle-tab cell boundaries, cut via CSG
 * INTERSECTION per cell, not a Voronoi/freeform split). Empty cells (no overlap with the source
 * mesh) are silently skipped. */
export function buildJigsawPieces(sourceGeometry: THREE.BufferGeometry, rows: number, cols: number): JigsawPiece[] {
  validateGrid(rows, cols);
  const triangles = countTriangles(sourceGeometry);
  if (triangles > C.MAX_TRIANGLES) throw new RangeError(`Mô hình vượt quá giới hạn ${C.MAX_TRIANGLES.toLocaleString('vi-VN')} tam giác.`);
  sourceGeometry.computeBoundingBox();
  const box = sourceGeometry.boundingBox!;
  const width = box.max.x - box.min.x;
  const depth = box.max.z - box.min.z;
  const height = box.max.y - box.min.y;
  if (!(width > 0 && depth > 0 && height > 0)) throw new RangeError('Mô hình không có thể tích hợp lệ.');
  const cellWidth = width / cols;
  const cellDepth = depth / rows;
  const radius = Math.min(cellWidth, cellDepth) * C.TAB_BUMP_RATIO;
  const extrudeHeight = height * 1.2;
  const extrudeY = box.min.y - height * 0.1;

  const sourceBrush = new Brush(sourceGeometry);
  sourceBrush.updateMatrixWorld(true);
  const evaluator = new Evaluator();
  // Uploaded STL/OBJ meshes have no UV data; the evaluator's default attribute list expects one on
  // every brush and throws reading `.array` off an undefined attribute otherwise. Pieces are only
  // ever exported as STL/3MF for printing, so texture coordinates are not needed.
  evaluator.attributes = ['position', 'normal'];
  const pieces: JigsawPiece[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = box.min.x + col * cellWidth;
      const x1 = box.min.x + (col + 1) * cellWidth;
      const z0 = box.min.z + row * cellDepth;
      const z1 = box.min.z + (row + 1) * cellDepth;
      const shape = buildCellShape(x0, x1, z0, z1, row, col, rows, cols, radius);
      const cellGeometry = new THREE.ExtrudeGeometry(shape, { depth: extrudeHeight, bevelEnabled: false, curveSegments: 1 });
      cellGeometry.rotateX(Math.PI / 2);
      cellGeometry.translate(0, extrudeHeight + extrudeY, 0);
      const cellBrush = new Brush(cellGeometry);
      cellBrush.updateMatrixWorld(true);
      let pieceGeometry: THREE.BufferGeometry;
      try {
        const result = evaluator.evaluate(sourceBrush, cellBrush, INTERSECTION);
        pieceGeometry = result.geometry.clone();
        result.geometry.dispose();
      } finally {
        cellGeometry.dispose();
      }
      pieceGeometry.computeBoundingBox();
      const pieceBox = pieceGeometry.boundingBox!;
      const hasVolume = pieceBox.max.x > pieceBox.min.x && pieceBox.max.y > pieceBox.min.y && pieceBox.max.z > pieceBox.min.z && pieceGeometry.getAttribute('position').count > 0;
      if (hasVolume) pieces.push({ geometry: pieceGeometry, row, col });
      else pieceGeometry.dispose();
    }
  }
  if (!pieces.length) throw new RangeError('Không cắt được mảnh ghép nào — thử lưới khác hoặc kiểm tra mô hình.');
  return pieces;
}

export function disposeJigsawPieces(pieces: JigsawPiece[]) {
  pieces.forEach(piece => piece.geometry.dispose());
}

/** Spreads pieces apart along X/Z (by `gapRatio` of the model's footprint) purely for preview
 * legibility — the underlying cut geometry (and exported files) keep the true interlocking
 * boundary; this offset is not part of the export. */
export function layoutPiecesForPreview(pieces: JigsawPiece[], rows: number, cols: number, colorHex: string = C.DEFAULT_COLOR): THREE.Group {
  validateColor(colorHex);
  const group = new THREE.Group();
  const bounds = new THREE.Box3();
  pieces.forEach(p => { p.geometry.computeBoundingBox(); bounds.union(p.geometry.boundingBox!); });
  const size = bounds.getSize(new THREE.Vector3());
  const gapX = (size.x / cols) * C.PREVIEW_GAP_RATIO;
  const gapZ = (size.z / rows) * C.PREVIEW_GAP_RATIO;
  for (const piece of pieces) {
    const mesh = new THREE.Mesh(piece.geometry, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 }));
    mesh.name = `piece-${piece.row}-${piece.col}`;
    mesh.position.set((piece.col - (cols - 1) / 2) * gapX, 0, (piece.row - (rows - 1) / 2) * gapZ);
    group.add(mesh);
  }
  group.updateMatrixWorld(true);
  return group;
}

export function disposePreviewScene(group: THREE.Group) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(m => m.dispose());
    }
  });
}

export function getJigsawExportParts(pieces: JigsawPiece[], colorHex: string = C.DEFAULT_COLOR): ColoredPart[] {
  return pieces.map(piece => ({ geometry: piece.geometry.clone(), colorHex, name: `piece-${piece.row}-${piece.col}` }));
}

/** Merges all pieces (with a small preview-only gap, if `group` is given, baked in) into a single
 * geometry — used for the plain single-file STL download and the Custom Request attachment,
 * mirroring every other tool's merged-STL export. */
export function mergeJigsawGeometry(parts: ColoredPart[]): THREE.BufferGeometry {
  const inputs = parts.map(p => (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone()));
  const merged = mergeGeometries(inputs, false);
  inputs.forEach(g => g.dispose());
  if (!merged) throw new Error('Không thể gộp STL.');
  return merged;
}
