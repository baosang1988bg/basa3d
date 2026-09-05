import * as THREE from 'three';
import * as opentype from 'opentype.js';
import type { Font } from 'opentype.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as C from './dual-text-constants';

export type DualTextFont = keyof typeof C.FONTS;
export type ColoredPart = { geometry: THREE.BufferGeometry; colorHex: string; name: string };

const fonts = new Map<DualTextFont, Promise<Font>>();
export function loadDualTextFont(name: DualTextFont): Promise<Font> {
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

export function validateWord(word: string): string {
  const normalized = word.normalize('NFC');
  if (![...normalized].every(char => char === ' ' || /^(?:\p{Script=Latin}|[0-9])$/u.test(char))) {
    throw new RangeError('Chỉ hỗ trợ chữ Latin có dấu, chữ số và khoảng trắng.');
  }
  return normalized;
}

function validateSize(count: number, blockSize: number, gap: number, margin: number, height: number, cornerPercent: number) {
  if (!Number.isInteger(count) || count < 1 || count > C.MAX_DUAL_TEXT_BLOCKS) throw new RangeError(`Cần từ 1 đến ${C.MAX_DUAL_TEXT_BLOCKS} khối.`);
  if (!(blockSize >= C.MIN_BLOCK_SIZE_MM && blockSize <= C.MAX_BLOCK_SIZE_MM)) throw new RangeError('Cỡ chữ ngoài giới hạn cho phép.');
  if (!(gap >= C.MIN_BLOCK_GAP_MM && gap <= C.MAX_BLOCK_GAP_MM)) throw new RangeError('Khoảng cách khối ngoài giới hạn cho phép.');
  if (!(margin >= C.MIN_BASE_MARGIN_MM && margin <= C.MAX_BASE_MARGIN_MM)) throw new RangeError('Lề đế ngoài giới hạn cho phép.');
  if (!(height >= C.MIN_BASE_HEIGHT_MM && height <= C.MAX_BASE_HEIGHT_MM)) throw new RangeError('Cao đế ngoài giới hạn cho phép.');
  if (!(cornerPercent >= 0 && cornerPercent <= 100)) throw new RangeError('Bo góc đế phải từ 0% đến 100%.');
}

function buildGlyphShapes(char: string, font: Font): THREE.Shape[] {
  const path = new THREE.ShapePath();
  for (const command of font.getPath(char, 0, 0, 10).commands) {
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
  return path.toShapes();
}

/**
 * One face's solid brush for a block: a `size`-mm cube with `char` embossed through it along the
 * local Z axis, extrusion (and the resulting cube) centered at the local origin. A blank/space
 * character produces a plain solid cube, i.e. no carving from that face.
 */
function buildFaceBrush(char: string, font: Font, size: number, mirror: boolean): Brush {
  if (char === ' ') {
    const brush = new Brush(new THREE.BoxGeometry(size, size, size));
    brush.updateMatrixWorld(true);
    return brush;
  }
  const shapes = buildGlyphShapes(char, font);
  if (!shapes.length) throw new RangeError(`Không tìm thấy hình chữ cho ký tự "${char}".`);
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: size, bevelEnabled: false, curveSegments: 8 });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const glyphSize = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 1e-6);
  const scale = (size * 0.82) / glyphSize;
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -size / 2);
  geometry.scale(mirror ? -scale : scale, scale, 1);
  const brush = new Brush(geometry);
  brush.updateMatrixWorld(true);
  return brush;
}

export interface DualTextBlockChars {
  char1: string;
  char2: string;
}

/** Intersection of `char1` (read from the world +Z face) and `char2` (read from the world +X face). */
export function buildDualTextBlock(chars: DualTextBlockChars, font: Font, blockSize: number): THREE.BufferGeometry {
  const front = buildFaceBrush(chars.char1, font, blockSize, false);
  const side = buildFaceBrush(chars.char2, font, blockSize, C.SIDE_GLYPH_MIRRORED);
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
    throw new RangeError('Không dựng được khối chữ (giao 2 mặt rỗng).');
  }
  return geometry;
}

function buildRoundedRectShape(width: number, height: number, cornerPercent: number): THREE.Shape {
  const radius = Math.min(width, height) / 2 * Math.min(Math.max(cornerPercent, 0), 100) / 100;
  const w = width / 2;
  const h = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-w + radius, -h);
  shape.lineTo(w - radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h + radius);
  shape.lineTo(w, h - radius);
  shape.quadraticCurveTo(w, h, w - radius, h);
  shape.lineTo(-w + radius, h);
  shape.quadraticCurveTo(-w, h, -w, h - radius);
  shape.lineTo(-w, -h + radius);
  shape.quadraticCurveTo(-w, -h, -w + radius, -h);
  return shape;
}

export function buildDualTextBaseMesh(
  blockCount: number,
  blockSize: number,
  gap: number,
  margin: number,
  height: number,
  cornerPercent: number,
  colorHex: string,
): THREE.Mesh {
  validateSize(blockCount, blockSize, gap, margin, height, cornerPercent);
  validateColor(colorHex);
  const width = blockCount * blockSize + (blockCount - 1) * gap + 2 * margin;
  const depth = blockSize + 2 * margin;
  const shape = buildRoundedRectShape(width, depth, cornerPercent);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 12 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.65 }));
  mesh.name = 'dual-text-base';
  return mesh;
}

export function disposeDualTextScene(group: THREE.Group) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(m => m.dispose());
    }
  });
}

export function generateDualTextScene(
  word1: string,
  word2: string,
  font: Font,
  options: { blockSize?: number; gap?: number; margin?: number; baseHeight?: number; cornerPercent?: number; textColor?: string; baseColor?: string } = {},
): THREE.Group {
  const {
    blockSize = C.DEFAULT_BLOCK_SIZE_MM,
    gap = C.DEFAULT_BLOCK_GAP_MM,
    margin = C.DEFAULT_BASE_MARGIN_MM,
    baseHeight = C.DEFAULT_BASE_HEIGHT_MM,
    cornerPercent = C.DEFAULT_BASE_CORNER_PERCENT,
    textColor = C.DEFAULT_TEXT_COLOR,
    baseColor = C.DEFAULT_BASE_COLOR,
  } = options;
  const w1 = validateWord(word1);
  const w2 = validateWord(word2);
  const count = Math.max(w1.length, w2.length, 1);
  validateSize(count, blockSize, gap, margin, baseHeight, cornerPercent);
  validateColor(textColor);
  const group = new THREE.Group();
  try {
    group.add(buildDualTextBaseMesh(count, blockSize, gap, margin, baseHeight, cornerPercent, baseColor));
    const startX = -((count - 1) * (blockSize + gap)) / 2;
    for (let i = 0; i < count; i++) {
      const char1 = w1[i] ?? ' ';
      const char2 = w2[i] ?? ' ';
      const geometry = buildDualTextBlock({ char1, char2 }, font, blockSize);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: textColor, roughness: 0.5 }));
      mesh.name = `block-${i}`;
      // Sink each block OVERLAP_MM into the base (Phase 20/21's epsilon-overlap technique) so the
      // merged STL has no coincident zero-thickness seam at the base/block boundary.
      mesh.position.set(startX + i * (blockSize + gap), blockSize / 2 - C.OVERLAP_MM, 0);
      group.add(mesh);
    }
    group.updateMatrixWorld(true);
    return group;
  } catch (error) {
    disposeDualTextScene(group);
    throw error;
  }
}

export function getDualTextExportParts(group: THREE.Group): ColoredPart[] {
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

export function mergeDualTextGeometry(parts: ColoredPart[]): THREE.BufferGeometry {
  const inputs = parts.map(p => (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone()));
  const merged = mergeGeometries(inputs, false);
  inputs.forEach(g => g.dispose());
  if (!merged) throw new Error('Không thể gộp STL.');
  return merged;
}
