import * as THREE from 'three';
import * as C from './lamp-shade-constants';

export interface LampShadeConfig {
  pattern: C.PatternType;
  around: number;
  rows: number;
  cellSizeMm: number;
  rotationDeg?: number;
}

export function validateColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RangeError('Màu phải có dạng #RRGGBB.');
}

function validateConfig(config: LampShadeConfig) {
  if (!C.PATTERN_TYPES.includes(config.pattern)) throw new RangeError('Kiểu hoa văn không hợp lệ.');
  if (!Number.isInteger(config.around) || config.around < C.MIN_AROUND || config.around > C.MAX_AROUND) throw new RangeError(`Quanh vòng cần từ ${C.MIN_AROUND} đến ${C.MAX_AROUND}.`);
  if (!Number.isInteger(config.rows) || config.rows < C.MIN_ROWS || config.rows > C.MAX_ROWS) throw new RangeError(`Hàng cần từ ${C.MIN_ROWS} đến ${C.MAX_ROWS}.`);
  if (!(config.cellSizeMm >= C.MIN_CELL_SIZE_MM && config.cellSizeMm <= C.MAX_CELL_SIZE_MM)) throw new RangeError('Kích thước ô ngoài giới hạn cho phép.');
  if (config.around * config.rows > C.MAX_TOTAL_HOLES) throw new RangeError(`Tổng số ô (quanh vòng × hàng) không được vượt quá ${C.MAX_TOTAL_HOLES}.`);
  const rotation = config.rotationDeg ?? C.DEFAULT_ROTATION_DEG;
  if (!(rotation >= C.MIN_ROTATION_DEG && rotation <= C.MAX_ROTATION_DEG)) throw new RangeError('Góc xoay ngoài giới hạn cho phép.');
}

/** One hole centered at the local origin, sized to fit within a `cellSize`-mm square cell. */
function buildHolePath(pattern: C.PatternType, cellSize: number): THREE.Path {
  const r = (cellSize / 2) * C.HOLE_FILL_RATIO;
  const path = new THREE.Path();
  switch (pattern) {
    case 'circle':
      return path.absarc(0, 0, r, 0, Math.PI * 2, false);
    case 'wave':
      return path.absellipse(0, 0, r * 1.15, r * 0.55, 0, Math.PI * 2, false, 0);
    case 'hexagon': {
      const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        return new THREE.Vector2(r * Math.cos(angle), r * Math.sin(angle));
      });
      path.setFromPoints(points);
      path.closePath();
      return path;
    }
    case 'diamond': {
      path.setFromPoints([new THREE.Vector2(0, r), new THREE.Vector2(r, 0), new THREE.Vector2(0, -r), new THREE.Vector2(-r, 0)]);
      path.closePath();
      return path;
    }
    case 'vertical-slit': {
      const halfW = r * 0.35;
      const halfH = r;
      path.moveTo(-halfW, -halfH + halfW);
      path.lineTo(-halfW, halfH - halfW);
      path.absarc(0, halfH - halfW, halfW, Math.PI, 0, true);
      path.lineTo(halfW, -halfH + halfW);
      path.absarc(0, -halfH + halfW, halfW, 0, Math.PI, true);
      path.closePath();
      return path;
    }
  }
}

function curveSegmentsFor(pattern: C.PatternType): number {
  return pattern === 'circle' || pattern === 'wave' ? 16 : 1;
}

function buildFlatPanelShape(config: LampShadeConfig, width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width, 0);
  shape.lineTo(width, height);
  shape.lineTo(0, height);
  shape.closePath();
  const segments = curveSegmentsFor(config.pattern);
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.around; col++) {
      const cx = (col + 0.5) * config.cellSizeMm;
      const cy = (row + 0.5) * config.cellSizeMm;
      const hole = buildHolePath(config.pattern, config.cellSizeMm);
      const points = hole.getPoints(segments).map(p => new THREE.Vector2(p.x + cx, p.y + cy));
      shape.holes.push(new THREE.Path(points));
    }
  }
  return shape;
}

/** Bends a flat perforated panel (already extruded to `wallThickness`) into a tube of radius
 * `radius`, mapping local x to an angle around the Y axis and local z to a radial offset — see
 * phase-24.md mục 2.1 for why this is used instead of CSG-subtracting each hole individually. */
function wrapPanelIntoTube(geometry: THREE.BufferGeometry, radius: number, rotationOffsetRad: number): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = x / radius + rotationOffsetRad;
    const r = radius + z;
    position.setXYZ(i, r * Math.cos(angle), y, r * Math.sin(angle));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function computeShadeDimensions(config: Pick<LampShadeConfig, 'around' | 'rows' | 'cellSizeMm'>) {
  const circumference = config.around * config.cellSizeMm;
  const radius = circumference / (2 * Math.PI);
  const height = config.rows * config.cellSizeMm;
  return { circumference, radius, height };
}

export function buildLampShadeGeometry(config: LampShadeConfig): THREE.BufferGeometry {
  validateConfig(config);
  const { circumference, radius, height } = computeShadeDimensions(config);
  const shape = buildFlatPanelShape(config, circumference, height);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: C.WALL_THICKNESS_MM, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, -height / 2, 0);
  const rotationOffsetRad = ((config.rotationDeg ?? C.DEFAULT_ROTATION_DEG) * Math.PI) / 180;
  return wrapPanelIntoTube(geometry, radius, rotationOffsetRad);
}

export function generateLampShadeScene(config: LampShadeConfig, colorHex: string = C.DEFAULT_SHADE_COLOR): THREE.Group {
  validateColor(colorHex);
  const geometry = buildLampShadeGeometry(config);
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, side: THREE.DoubleSide }));
  mesh.name = 'lamp-shade';
  group.add(mesh);
  group.updateMatrixWorld(true);
  return group;
}

export function disposeLampShadeScene(group: THREE.Group) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(m => m.dispose());
    }
  });
}

export interface ColoredPart {
  geometry: THREE.BufferGeometry;
  colorHex: string;
  name: string;
}

export function getLampShadeExportParts(group: THREE.Group): ColoredPart[] {
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
