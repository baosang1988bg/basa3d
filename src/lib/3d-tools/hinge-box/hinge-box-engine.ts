import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as C from './hinge-box-constants';

export interface HingeBoxConfig {
  widthMm: number;
  depthMm: number;
  closedHeightMm: number;
  rows: number;
  cols: number;
  dividerThicknessMm: number;
}

export interface ColoredPart {
  geometry: THREE.BufferGeometry;
  colorHex: string;
  name: string;
}

/** `mergeGeometries` requires every input to be uniformly indexed or non-indexed; the extrude and
 * box geometries built in this file don't consistently agree, so always normalize first. */
function safeMerge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const inputs = geometries.map(g => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(inputs, false);
  inputs.forEach((g, i) => { if (g !== geometries[i]) g.dispose(); });
  if (!merged) throw new Error('Không thể gộp hình học.');
  return merged;
}

export function validateColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RangeError('Màu phải có dạng #RRGGBB.');
}

function validateConfig(config: HingeBoxConfig) {
  if (!(config.widthMm >= C.MIN_WIDTH_MM && config.widthMm <= C.MAX_WIDTH_MM)) throw new RangeError('Chiều rộng ngoài giới hạn cho phép.');
  if (!(config.depthMm >= C.MIN_DEPTH_MM && config.depthMm <= C.MAX_DEPTH_MM)) throw new RangeError('Chiều sâu ngoài giới hạn cho phép.');
  if (!(config.closedHeightMm >= C.MIN_CLOSED_HEIGHT_MM && config.closedHeightMm <= C.MAX_CLOSED_HEIGHT_MM)) throw new RangeError('Chiều cao khi đóng ngoài giới hạn cho phép.');
  if (!Number.isInteger(config.rows) || config.rows < 1 || config.rows > C.MAX_GRID_ROWS) throw new RangeError(`Hàng cần từ 1 đến ${C.MAX_GRID_ROWS}.`);
  if (!Number.isInteger(config.cols) || config.cols < 1 || config.cols > C.MAX_GRID_COLS) throw new RangeError(`Cột cần từ 1 đến ${C.MAX_GRID_COLS}.`);
  if (!(config.dividerThicknessMm >= C.MIN_DIVIDER_THICKNESS_MM && config.dividerThicknessMm <= C.MAX_DIVIDER_THICKNESS_MM)) throw new RangeError('Độ dày vách ngoài giới hạn cho phép.');
  const minInterior = Math.min(config.widthMm, config.depthMm) - 2 * C.SHELL_WALL_THICKNESS_MM;
  if (minInterior <= config.dividerThicknessMm * 2) throw new RangeError('Hộp quá nhỏ so với độ dày vách ngăn.');
}

/** An open rectangular tray: 4 outer walls (ring cross-section) + a floor slab, floor at local
 * y=0, walls rising to y=wallHeight, footprint spanning x:[0,width] z:[0,depth]. */
function buildTrayMesh(width: number, depth: number, wallHeight: number): THREE.BufferGeometry {
  const t = C.SHELL_WALL_THICKNESS_MM;
  const outer = new THREE.Shape();
  outer.moveTo(0, 0);
  outer.lineTo(width, 0);
  outer.lineTo(width, depth);
  outer.lineTo(0, depth);
  outer.closePath();
  outer.holes.push(new THREE.Path([
    new THREE.Vector2(t, t),
    new THREE.Vector2(t, depth - t),
    new THREE.Vector2(width - t, depth - t),
    new THREE.Vector2(width - t, t),
  ]));
  const wallsGeometry = new THREE.ExtrudeGeometry(outer, { depth: wallHeight, bevelEnabled: false, curveSegments: 1 });
  // The shape's local (x, y) = (width, depth); rotating +90° about X maps its extrude axis (was Z,
  // 0..wallHeight) to -Y and its depth axis (was Y, 0..depth) to +Z — translate back up so the
  // walls span y:[0,wallHeight] instead of [-wallHeight,0], keeping z:[0,depth] matching the floor.
  wallsGeometry.rotateX(Math.PI / 2);
  wallsGeometry.translate(0, wallHeight, 0);

  const floorGeometry = new THREE.BoxGeometry(width, C.FLOOR_THICKNESS_MM, depth);
  floorGeometry.translate(width / 2, C.FLOOR_THICKNESS_MM / 2 - C.OVERLAP_MM, depth / 2);

  const merged = safeMerge([wallsGeometry, floorGeometry]);
  wallsGeometry.dispose();
  floorGeometry.dispose();
  return merged;
}

/** Equal-grid divider walls inside a tray's interior, mirroring `organizer-engine.ts`'s
 * epsilon-overlap technique (not imported — each tool keeps its own self-contained engine file
 * per Phase 19 mục 4.1's file convention — but the same proven algorithm). */
function buildDividerWalls(width: number, depth: number, rows: number, cols: number, thickness: number, wallHeight: number): THREE.BufferGeometry | null {
  if (rows === 1 && cols === 1) return null;
  const t = C.SHELL_WALL_THICKNESS_MM;
  const innerWidth = width - 2 * t;
  const innerDepth = depth - 2 * t;
  const parts: THREE.BufferGeometry[] = [];
  const cellWidth = (innerWidth - (cols - 1) * thickness) / cols;
  const cellDepth = (innerDepth - (rows - 1) * thickness) / rows;
  for (let col = 1; col < cols; col++) {
    const x = t + col * cellWidth + (col - 0.5) * thickness;
    const wall = new THREE.BoxGeometry(thickness + C.OVERLAP_MM * 2, wallHeight + C.OVERLAP_MM, innerDepth);
    wall.translate(x, wallHeight / 2 - C.OVERLAP_MM, depth / 2);
    parts.push(wall);
  }
  for (let row = 1; row < rows; row++) {
    const z = t + row * cellDepth + (row - 0.5) * thickness;
    const wall = new THREE.BoxGeometry(innerWidth, wallHeight + C.OVERLAP_MM, thickness + C.OVERLAP_MM * 2);
    wall.translate(width / 2, wallHeight / 2 - C.OVERLAP_MM, z);
    parts.push(wall);
  }
  if (!parts.length) return null;
  const merged = safeMerge(parts);
  parts.forEach(p => p.dispose());
  return merged;
}

/** Several short flexible tabs bridging the gap between the base and lid trays, at the very
 * bottom (thin in the fold direction) — see phase-25.md mục 2.2. */
function buildHingeTabs(depth: number, baseX: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const span = C.HINGE_SEGMENT_LENGTH_MM + C.HINGE_SEGMENT_GAP_MM;
  const count = Math.max(1, Math.floor(depth / span));
  const totalUsed = count * C.HINGE_SEGMENT_LENGTH_MM + (count - 1) * C.HINGE_SEGMENT_GAP_MM;
  const startZ = (depth - totalUsed) / 2;
  const tabWidth = C.HINGE_GAP_MM + 2 * C.OVERLAP_MM;
  for (let i = 0; i < count; i++) {
    const z = startZ + i * span + C.HINGE_SEGMENT_LENGTH_MM / 2;
    const tab = new THREE.BoxGeometry(tabWidth, C.HINGE_THICKNESS_MM, C.HINGE_SEGMENT_LENGTH_MM);
    tab.translate(baseX + C.HINGE_GAP_MM / 2, C.HINGE_THICKNESS_MM / 2, z);
    parts.push(tab);
  }
  const merged = safeMerge(parts);
  parts.forEach(p => p.dispose());
  return merged;
}

/** A small friction bump (not a real snap-fit latch, see mục 2.3) near the middle of the front
 * edge, opposite the hinge. */
function buildLatchBump(width: number, depth: number, wallHeight: number): THREE.BufferGeometry {
  const size = C.LATCH_BUMP_SIZE_MM;
  const geometry = new THREE.BoxGeometry(size, size * 0.6, size);
  geometry.translate(width / 2, wallHeight - size * 0.3 + C.OVERLAP_MM, depth - C.SHELL_WALL_THICKNESS_MM / 2);
  return geometry;
}

export function generateHingeBoxScene(config: HingeBoxConfig, colorHex: string = C.DEFAULT_COLOR): THREE.Group {
  validateConfig(config);
  validateColor(colorHex);
  const baseWallHeight = config.closedHeightMm * C.BASE_HEIGHT_RATIO;
  const lidWallHeight = config.closedHeightMm - baseWallHeight;
  const group = new THREE.Group();
  try {
    const baseTray = buildTrayMesh(config.widthMm, config.depthMm, baseWallHeight);
    const dividers = buildDividerWalls(config.widthMm, config.depthMm, config.rows, config.cols, config.dividerThicknessMm, baseWallHeight);
    const baseGeometries = dividers ? [baseTray, dividers] : [baseTray];
    const baseMerged = baseGeometries.length > 1 ? safeMerge(baseGeometries) : baseTray;
    baseGeometries.forEach(g => { if (g !== baseMerged) g.dispose(); });
    const latch = buildLatchBump(config.widthMm, config.depthMm, baseWallHeight);
    const baseWithLatch = safeMerge([baseMerged, latch]);
    baseMerged.dispose();
    latch.dispose();
    const baseMesh = new THREE.Mesh(baseWithLatch, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 }));
    baseMesh.name = 'hinge-box-base';
    group.add(baseMesh);

    const lidX = config.widthMm + C.HINGE_GAP_MM;
    const lidTray = buildTrayMesh(config.widthMm, config.depthMm, lidWallHeight);
    lidTray.translate(lidX, 0, 0);
    const lidMesh = new THREE.Mesh(lidTray, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 }));
    lidMesh.name = 'hinge-box-lid';
    group.add(lidMesh);

    const hinge = buildHingeTabs(config.depthMm, config.widthMm);
    const hingeMesh = new THREE.Mesh(hinge, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 }));
    hingeMesh.name = 'hinge-box-hinge';
    group.add(hingeMesh);

    group.updateMatrixWorld(true);
    return group;
  } catch (error) {
    disposeHingeBoxScene(group);
    throw error;
  }
}

export function disposeHingeBoxScene(group: THREE.Group) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(m => m.dispose());
    }
  });
}

export function getHingeBoxExportParts(group: THREE.Group): ColoredPart[] {
  group.updateMatrixWorld(true);
  const parts: ColoredPart[] = [];
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      parts.push({
        geometry: object.geometry.clone().applyMatrix4(object.matrixWorld),
        colorHex: `#${(object.material as THREE.MeshStandardMaterial).color.getHexString()}`,
        name: object.name,
      });
    }
  });
  return parts;
}

export function mergeHingeBoxGeometry(parts: ColoredPart[]): THREE.BufferGeometry {
  const inputs = parts.map(p => (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone()));
  const merged = mergeGeometries(inputs, false);
  inputs.forEach(g => g.dispose());
  if (!merged) throw new Error('Không thể gộp STL.');
  return merged;
}
