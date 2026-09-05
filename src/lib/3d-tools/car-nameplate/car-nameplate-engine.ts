import * as THREE from 'three';
import * as opentype from 'opentype.js';
import type { Font } from 'opentype.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as C from './car-nameplate-constants';

export type CarFont = keyof typeof C.FONTS;
export type ColoredPart = { geometry: THREE.BufferGeometry; colorHex: string; name: string };

const CAR_ASPECT_RATIO = 0.42; // nameplate height = width * this ratio, matches a sedan side profile
/** Mirroring of the side-facing (name) brush before rotating into place — see dual-text-constants'
 * SIDE_GLYPH_MIRRORED for why this is a single flippable constant rather than derived analytically. */
const SIDE_MIRRORED = false;

const fonts = new Map<CarFont, Promise<Font>>();
export function loadCarFont(name: CarFont): Promise<Font> {
  if (!Object.hasOwn(C.FONTS, name)) return Promise.reject(new RangeError('Font không hợp lệ.'));
  if (!fonts.has(name)) {
    fonts.set(
      name,
      fetch(C.FONTS[name])
        .then(async response => {
          if (!response.ok) throw new Error('Không tải được font dựng mẫu.');
          return opentype.parse(await response.arrayBuffer());
        })
        .catch(error => {
          fonts.delete(name);
          throw error;
        }),
    );
  }
  return fonts.get(name)!;
}

export function validateColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RangeError('Màu phải có dạng #RRGGBB.');
}

export function validateName(name: string): string {
  const normalized = name.normalize('NFC');
  if (!normalized.length || normalized.length > C.MAX_NAME_LENGTH) throw new RangeError(`Tên cần từ 1 đến ${C.MAX_NAME_LENGTH} ký tự.`);
  if (![...normalized].every(char => char === ' ' || /^(?:\p{Script=Latin}|[0-9])$/u.test(char))) {
    throw new RangeError('Chỉ hỗ trợ chữ Latin có dấu, chữ số và khoảng trắng.');
  }
  return normalized;
}

function validateOptions(width: number, overlap: number, addBase: boolean, baseThickness: number) {
  if (!(width >= C.MIN_NAMEPLATE_WIDTH_MM && width <= C.MAX_NAMEPLATE_WIDTH_MM)) throw new RangeError('Kích thước ngoài giới hạn cho phép.');
  if (!(overlap >= C.MIN_BASE_OVERLAP_MM && overlap <= C.MAX_BASE_OVERLAP_MM)) throw new RangeError('Độ nối chữ ngoài giới hạn cho phép.');
  if (addBase && !(baseThickness >= C.MIN_BASE_THICKNESS_MM && baseThickness <= C.MAX_BASE_THICKNESS_MM)) throw new RangeError('Độ dày đế ngoài giới hạn cho phép.');
}

/** A simplified, hand-authored sedan side-profile silhouette (not sourced from any external asset). */
function buildSedanShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const wheelR = 9;
  const frontWheelX = 24;
  const rearWheelX = 76;
  shape.moveTo(4, 14);
  shape.lineTo(4, 8);
  shape.quadraticCurveTo(4, 0, 10, 0);
  shape.lineTo(frontWheelX - wheelR, 0);
  shape.absarc(frontWheelX, 0, wheelR, Math.PI, Math.PI * 2, false);
  shape.lineTo(rearWheelX - wheelR, 0);
  shape.absarc(rearWheelX, 0, wheelR, Math.PI, Math.PI * 2, false);
  shape.lineTo(96, 0);
  shape.quadraticCurveTo(100, 0, 100, 6);
  shape.lineTo(100, 10);
  shape.quadraticCurveTo(100, 16, 92, 18);
  shape.lineTo(78, 18);
  shape.quadraticCurveTo(70, 32, 55, 32);
  shape.lineTo(45, 32);
  shape.quadraticCurveTo(30, 32, 22, 18);
  shape.lineTo(10, 18);
  shape.quadraticCurveTo(2, 16, 4, 14);
  return shape;
}

function buildVehicleShapes(vehicle: C.Vehicle): THREE.Shape[] {
  if (vehicle === 'sedan') return [buildSedanShape()];
  throw new RangeError('Mẫu xe không hợp lệ.');
}

function buildNameShapes(name: string, font: Font): THREE.Shape[] {
  const path = new THREE.ShapePath();
  for (const command of font.getPath(name, 0, 0, 10).commands) {
    switch (command.type) {
      case 'M':
        path.moveTo(command.x, -command.y);
        break;
      case 'L':
        path.lineTo(command.x, -command.y);
        break;
      case 'C':
        path.bezierCurveTo(command.x1, -command.y1, command.x2, -command.y2, command.x, -command.y);
        break;
      case 'Q':
        path.quadraticCurveTo(command.x1, -command.y1, command.x, -command.y);
        break;
      case 'Z':
        path.currentPath?.closePath();
        break;
    }
  }
  const shapes = path.toShapes();
  if (!shapes.length) throw new RangeError('Không tạo được hình cho tên đã nhập.');
  return shapes;
}

/** Extrude `shapes` by `depth`, then non-uniformly scale/center so the footprint exactly fills a
 * `targetWidth` x `targetHeight` box centered at the local origin (extrusion also centered on Z). */
function buildFittedGeometry(shapes: THREE.Shape[], depth: number, targetWidth: number, targetHeight: number, mirror: boolean): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 8 });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const rawWidth = Math.max(box.max.x - box.min.x, 1e-6);
  const rawHeight = Math.max(box.max.y - box.min.y, 1e-6);
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -depth / 2);
  const sx = targetWidth / rawWidth;
  const sy = targetHeight / rawHeight;
  geometry.scale(mirror ? -sx : sx, sy, 1);
  return geometry;
}

export interface CarNameplateOptions {
  vehicle?: C.Vehicle;
  totalWidthMm?: number;
}

/** Intersection of a vehicle silhouette (world +Z face) and a name (world +X face). */
export function buildCarNameplate(name: string, font: Font, options: CarNameplateOptions = {}): THREE.BufferGeometry {
  const { vehicle = 'sedan', totalWidthMm = C.NAMEPLATE_SIZE_PRESETS_MM.medium } = options;
  const validName = validateName(name);
  if (!(totalWidthMm >= C.MIN_NAMEPLATE_WIDTH_MM && totalWidthMm <= C.MAX_NAMEPLATE_WIDTH_MM)) throw new RangeError('Kích thước ngoài giới hạn cho phép.');
  const width = totalWidthMm;
  const height = width * CAR_ASPECT_RATIO;
  const depth = width;
  const front = new Brush(buildFittedGeometry(buildVehicleShapes(vehicle), depth, width, height, false));
  const side = new Brush(buildFittedGeometry(buildNameShapes(validName, font), depth, width, height, SIDE_MIRRORED));
  front.updateMatrixWorld(true);
  side.geometry.rotateY(Math.PI / 2);
  side.updateMatrixWorld(true);
  const evaluator = new Evaluator();
  const result = evaluator.evaluate(front, side, INTERSECTION);
  const geometry = result.geometry.clone();
  front.geometry.dispose();
  side.geometry.dispose();
  result.geometry.dispose();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  if (!(box.max.x > box.min.x) || !(box.max.y > box.min.y) || !(box.max.z > box.min.z)) {
    geometry.dispose();
    throw new RangeError('Không dựng được bảng tên (giao xe/chữ rỗng — thử tên khác).');
  }
  return geometry;
}

/** A plain rectangular base plate, with an optional keyring tab bulging out of the left edge
 * (same 2D-Path-Hole tab technique as `keychain-blocks-engine.ts`'s `buildCompactBaseMesh`). */
function buildFlatBaseShape(width: number, height: number, includeTab: boolean): THREE.Shape {
  const hw = width / 2;
  const hh = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  if (!includeTab) {
    shape.lineTo(-hw, hh);
    shape.closePath();
    return shape;
  }
  const r = C.KEYRING_TAB_RADIUS_MM;
  shape.lineTo(-hw, hh);
  shape.lineTo(-hw, r);
  shape.lineTo(-hw - r, r);
  shape.absarc(-hw - r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  shape.lineTo(-hw, -r);
  shape.closePath();
  shape.holes.push(new THREE.Path().absarc(-hw - r, 0, C.KEYRING_HOLE_DIAMETER_MM / 2, 0, Math.PI * 2, true));
  return shape;
}

export function buildFlatBaseMesh(width: number, height: number, thickness: number, colorHex: string, includeTab: boolean): THREE.Mesh {
  validateColor(colorHex);
  const marginedWidth = width * 1.08;
  const marginedHeight = height * 1.3;
  const shape = buildFlatBaseShape(marginedWidth, marginedHeight, includeTab);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -thickness, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.65 }));
  mesh.name = 'car-base';
  return mesh;
}

export function disposeCarScene(group: THREE.Group) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(m => m.dispose());
    }
  });
}

export interface GenerateCarSceneOptions {
  vehicle?: C.Vehicle;
  totalWidthMm?: number;
  addBase?: boolean;
  baseThicknessMm?: number;
  baseOverlapMm?: number;
  addKeyring?: boolean;
  nameplateColor?: string;
  baseColor?: string;
}

export function generateCarNameplateScene(name: string, font: Font, options: GenerateCarSceneOptions = {}): THREE.Group {
  const {
    vehicle = 'sedan',
    totalWidthMm = C.NAMEPLATE_SIZE_PRESETS_MM.medium,
    addBase = true,
    baseThicknessMm = C.DEFAULT_BASE_THICKNESS_MM,
    baseOverlapMm = C.DEFAULT_BASE_OVERLAP_MM,
    addKeyring = false,
    nameplateColor = C.DEFAULT_NAMEPLATE_COLOR,
    baseColor = C.DEFAULT_BASE_COLOR,
  } = options;
  validateOptions(totalWidthMm, baseOverlapMm, addBase, baseThicknessMm);
  validateColor(nameplateColor);
  const group = new THREE.Group();
  try {
    const nameplateGeometry = buildCarNameplate(name, font, { vehicle, totalWidthMm });
    const height = totalWidthMm * CAR_ASPECT_RATIO;
    if (addBase) {
      const base = buildFlatBaseMesh(totalWidthMm, height, baseThicknessMm, baseColor, addKeyring);
      group.add(base);
      nameplateGeometry.translate(0, baseThicknessMm - baseOverlapMm, 0);
    }
    const mesh = new THREE.Mesh(nameplateGeometry, new THREE.MeshStandardMaterial({ color: nameplateColor, roughness: 0.5 }));
    mesh.name = 'car-nameplate';
    group.add(mesh);
    group.updateMatrixWorld(true);
    return group;
  } catch (error) {
    disposeCarScene(group);
    throw error;
  }
}

export function getCarExportParts(group: THREE.Group): ColoredPart[] {
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

export function mergeCarGeometry(parts: ColoredPart[]): THREE.BufferGeometry {
  const inputs = parts.map(p => (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone()));
  const merged = mergeGeometries(inputs, false);
  inputs.forEach(g => g.dispose());
  if (!merged) throw new Error('Không thể gộp STL.');
  return merged;
}
