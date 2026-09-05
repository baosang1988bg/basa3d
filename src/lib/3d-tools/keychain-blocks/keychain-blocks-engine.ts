import * as THREE from 'three';
import * as opentype from 'opentype.js';
import type { Font } from 'opentype.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as C from './keychain-blocks-constants';

export interface KeychainBlockConfig { id: string; char: string; blockColor: string; glyphColor: string }
export type BlockFont = keyof typeof C.FONTS;
export type ColoredPart = { geometry: THREE.BufferGeometry; colorHex: string; name: string };
const fonts = new Map<BlockFont, Promise<Font>>();
export function loadBlocksFont(name: BlockFont): Promise<Font> {
  if (!Object.hasOwn(C.FONTS, name)) return Promise.reject(new RangeError('Font không hợp lệ.'));
  if (!fonts.has(name)) fonts.set(name, fetch(C.FONTS[name]).then(async response => {
    if (!response.ok) throw new Error('Không tải được font dựng mẫu.');
    return opentype.parse(await response.arrayBuffer());
  }).catch(error => { fonts.delete(name); throw error; }));
  return fonts.get(name)!;
}
export function validateColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RangeError('Màu phải có dạng #RRGGBB.');
}
function validateCount(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > C.MAX_BLOCKS) throw new RangeError(`Cần từ 1 đến ${C.MAX_BLOCKS} khối.`);
}
function validateBlock(block: KeychainBlockConfig, font: Font) {
  if (!block.id || block.id.length > 64) throw new RangeError('ID khối không hợp lệ.');
  validateColor(block.blockColor); validateColor(block.glyphColor);
  const char = block.char.normalize('NFC');
  if (char.startsWith('icon:')) {
    if (!Object.hasOwn(C.ICON_PATHS, char.slice(5))) throw new RangeError('Icon không hợp lệ.');
  } else if (!/^(?:\p{Script=Latin}|[0-9])$/u.test(char) || font.charToGlyphIndex(char) === 0) {
    throw new RangeError('Mỗi khối cần một chữ Latin có dấu hoặc chữ số được font hỗ trợ.');
  }
}
export function buildKeycapBaseShape(): THREE.Shape {
  const w = C.BLOCK_WIDTH_MM, d = C.BLOCK_DEPTH_MM, r = 1;
  const s = new THREE.Shape();
  s.moveTo(r, 0); s.lineTo(w-r, 0); s.quadraticCurveTo(w, 0, w, r);
  s.lineTo(w, d-r); s.quadraticCurveTo(w, d, w-r, d);
  s.lineTo(r, d); s.quadraticCurveTo(0, d, 0, d-r);
  s.lineTo(0, r); s.quadraticCurveTo(0, 0, r, 0);
  return s;
}
/** Convert a vendored Lucide centerline into a solid 2-unit-wide stroke outline. */
function strokeShape(coordinates: number[][]): THREE.Shape {
  let points = coordinates.map(([x,y]) => new THREE.Vector2(x, -y));
  const closed = points[0].distanceTo(points.at(-1)!) < 0.01;
  if (closed) points = points.slice(0, -1);
  const sides = [-1, 1].map(side => points.map((p, i) => {
    const before = points[i === 0 ? (closed ? points.length-1 : 0) : i-1];
    const after = points[i === points.length-1 ? (closed ? 0 : i) : i+1];
    const a = p.clone().sub(before).normalize(), b = after.clone().sub(p).normalize();
    if (!a.lengthSq()) a.copy(b); if (!b.lengthSq()) b.copy(a);
    const normalA = new THREE.Vector2(-a.y, a.x), normalB = new THREE.Vector2(-b.y, b.x);
    const bisector = normalA.clone().add(normalB).normalize();
    return p.clone().addScaledVector(bisector, side / Math.max(0.5, bisector.dot(normalB)));
  }));
  if (!closed) return new THREE.Shape([...sides[0], ...sides[1].reverse()]);
  const [outer, inner] = Math.abs(THREE.ShapeUtils.area(sides[0])) > Math.abs(THREE.ShapeUtils.area(sides[1])) ? sides : [sides[1], sides[0]];
  const shape = new THREE.Shape(outer); shape.holes.push(new THREE.Path(inner.reverse())); return shape;
}
export function buildGlyphShape(char: string, font: Font): THREE.Shape[] {
  validateBlock({ id: 'glyph', char, blockColor: '#000000', glyphColor: '#ffffff' }, font);
  if (char.startsWith('icon:')) return C.ICON_PATHS[char.slice(5)].map(strokeShape);
  const shape = new THREE.ShapePath();
  for (const c of font.getPath(char.normalize('NFC'), 0, 0, 10).commands) {
    switch (c.type) {
      case 'M': shape.moveTo(c.x, -c.y); break;
      case 'L': shape.lineTo(c.x, -c.y); break;
      case 'C': shape.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y); break;
      case 'Q': shape.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y); break;
      case 'Z': shape.currentPath?.closePath(); break;
    }
  }
  return shape.toShapes();
}
export function buildSingleBlockMesh(block: KeychainBlockConfig, font: Font): THREE.Group {
  validateBlock(block, font);
  const group = new THREE.Group(); group.name = block.id;
  // Inset the profile before beveling so the finished footprint remains exactly 12x12.
  const shape = buildKeycapBaseShape();
  const cap = new THREE.ExtrudeGeometry(shape, { depth: C.BLOCK_HEIGHT_MM-0.6, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 3, curveSegments: 4 });
  cap.scale(C.BLOCK_WIDTH_MM/(C.BLOCK_WIDTH_MM+0.6), C.BLOCK_DEPTH_MM/(C.BLOCK_DEPTH_MM+0.6), 1);
  cap.translate(0.3*C.BLOCK_WIDTH_MM/(C.BLOCK_WIDTH_MM+0.6), 0.3*C.BLOCK_DEPTH_MM/(C.BLOCK_DEPTH_MM+0.6), C.BASE_THICKNESS_MM-C.OVERLAP_MM+0.3);
  const glyph = new THREE.ExtrudeGeometry(buildGlyphShape(block.char, font), { depth: C.GLYPH_EMBOSS_HEIGHT_MM+C.OVERLAP_MM, bevelEnabled: false, curveSegments: 4 });
  glyph.computeBoundingBox(); const bounds = glyph.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0) { cap.dispose(); glyph.dispose(); throw new RangeError('Không tạo được hình chữ.'); }
  const scale = Math.min(8/size.x, 8/size.y);
  glyph.translate(-bounds.min.x, -bounds.min.y, 0); glyph.scale(scale, scale, 1);
  glyph.translate((C.BLOCK_WIDTH_MM-size.x*scale)/2, (C.BLOCK_DEPTH_MM-size.y*scale)/2, C.BASE_THICKNESS_MM+C.BLOCK_HEIGHT_MM-2*C.OVERLAP_MM);
  for (const [geometry, color, name] of [[cap, block.blockColor, 'block'], [glyph, block.glyphColor, 'glyph']] as const) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.65 })); mesh.name = `${block.id}-${name}`; group.add(mesh);
  }
  return group;
}
export function buildCompactBaseMesh(count: number, colorHex: string): THREE.Mesh {
  validateCount(count); validateColor(colorHex);
  const width = count*C.BLOCK_WIDTH_MM+(count-1)*C.BLOCK_GAP_MM;
  const r = C.KEYRING_TAB_RADIUS_MM, cy = C.BLOCK_DEPTH_MM/2;
  const s = new THREE.Shape(); s.moveTo(0,0); s.lineTo(width,0); s.lineTo(width,C.BLOCK_DEPTH_MM); s.lineTo(0,C.BLOCK_DEPTH_MM);
  s.lineTo(0,cy+r); s.lineTo(-r,cy+r); s.absarc(-r,cy,r,Math.PI/2,3*Math.PI/2,false); s.lineTo(0,cy-r); s.closePath();
  s.holes.push(new THREE.Path().absarc(-r,cy,C.KEYRING_HOLE_DIAMETER_MM/2,0,Math.PI*2,true));
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:C.BASE_THICKNESS_MM,bevelEnabled:false,curveSegments:12}),new THREE.MeshStandardMaterial({color:colorHex,roughness:0.65})); mesh.name='compact-base'; return mesh;
}
export function disposeBlocksScene(group: THREE.Group) {
  group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(m => m.dispose()); } });
}
export function generateKeychainBlocksScene(blocks: KeychainBlockConfig[], font: Font, baseColor = C.DEFAULT_BASE_COLOR): THREE.Group {
  validateCount(blocks.length); validateColor(baseColor); blocks.forEach(block => validateBlock(block,font));
  if (new Set(blocks.map(block=>block.id)).size !== blocks.length) throw new RangeError('ID khối phải khác nhau.');
  const group = new THREE.Group();
  try {
    group.add(buildCompactBaseMesh(blocks.length,baseColor));
    blocks.forEach((block,index) => { const mesh = buildSingleBlockMesh(block,font); mesh.position.x=index*(C.BLOCK_WIDTH_MM+C.BLOCK_GAP_MM); group.add(mesh); });
    group.updateMatrixWorld(true); return group;
  } catch (error) { disposeBlocksScene(group); throw error; }
}
/** World coordinates preserve the assembly in both export formats. Caller owns the clones. */
export function getBlocksExportParts(group: THREE.Group): ColoredPart[] {
  group.updateMatrixWorld(true); const parts: ColoredPart[]=[];
  group.traverse(object => { if (object instanceof THREE.Mesh) parts.push({geometry:object.geometry.clone().applyMatrix4(object.matrixWorld),colorHex:`#${(object.material as THREE.MeshStandardMaterial).color.getHexString()}`,name:object.name}); });
  return parts;
}
export function mergeBlocksGeometry(parts: ColoredPart[]): THREE.BufferGeometry {
  const inputs=parts.map(p=>p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone());
  const merged=mergeGeometries(inputs,false); inputs.forEach(g=>g.dispose());
  if (!merged) throw new Error('Không thể gộp STL.'); return merged;
}
