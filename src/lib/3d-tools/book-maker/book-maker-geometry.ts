import * as THREE from 'three';
import type { BookMakerConfig, BookDesignModifier, BookLayoutPart } from './book-maker-types';
import type { UnpackedModelMap, UnpackedMesh } from './afk2-decoder';
import { PITCH, AXIS_X, BOOK_FORMATS } from './book-maker-constants';

/**
 * Calculates spine stretching along X for dynamic page count n (2-20).
 * Stretches only the middle band, leaving the hinge cylindrical barrels intact.
 */
export function createSpineStretcher(pitch: number = PITCH, n: number = 10): (x: number) => number {
  const D2 = pitch * 2 + 0.102 - 11.47;
  const Dx = pitch * n + 0.102 - 11.47;
  const h2 = 3.2 + D2 / 2;
  const hn = 3.2 + Dx / 2;
  return (x: number) => (Math.abs(x) <= h2 ? (x * hn) / h2 : x + (x < 0 ? -1 : 1) * (Dx - D2) / 2);
}

/**
 * Resolves the 10-mesh key codes according to user selection.
 */
export function getBookMeshKeys(config: BookMakerConfig) {
  const isSnap = config.hingeType === 'snap';
  const isPhoto = config.frontCoverType === 'photo';

  const backKey = isSnap ? 'B-S' : 'B-F';
  const frontKey = isSnap ? (isPhoto ? 'F-S-P' : 'F-S-B') : (isPhoto ? 'F-F-P' : 'F-F-B');
  const spineKey = isSnap ? 'S-S' : 'S-F';

  return {
    back: backKey,
    front: frontKey,
    spine: spineKey,
    pageNormal: 'P-N',
    pageFront: 'P-F',
  };
}

export interface AssembledBookPart {
  id: string;
  name: string;
  geometry: THREE.BufferGeometry;
  colorHex: string;
  isCover: boolean;
}

/**
 * Clones and stretches spine mesh vertices.
 */
export function stretchSpineGeometry(rawMesh: UnpackedMesh, n: number, pitch: number = PITCH): THREE.BufferGeometry {
  const positions = new Float32Array(rawMesh.positions);
  const stretch = createSpineStretcher(pitch, n);

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = stretch(positions[i]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(rawMesh.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Decodes a Base64 string into Float32Array or Uint32Array (browser & Node compatible).
 */
export function decodeBase64ToTypedArray(base64Str: string, type: 'float32' | 'uint32'): Float32Array | Uint32Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64Str, 'base64');
    if (type === 'float32') {
      return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    }
    return new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  }

  const binaryString = atob(base64Str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  if (type === 'float32') {
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  }
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/**
 * Parses modifier buffer from Base64 string, TypedArray, or array of numbers.
 */
export function parseModifierBuffer(data: unknown, type: 'float32' | 'uint32'): Float32Array | Uint32Array {
  if (!data) {
    return type === 'float32' ? new Float32Array(0) : new Uint32Array(0);
  }
  if (typeof data === 'string') {
    return decodeBase64ToTypedArray(data, type);
  }
  if (type === 'float32') {
    return data instanceof Float32Array ? data : new Float32Array(data as ArrayLike<number>);
  }
  return data instanceof Uint32Array ? data : new Uint32Array(data as ArrayLike<number>);
}

/**
 * Lays out the cover pieces (Back, Spine, Front) plus custom color modifiers flat on the build bed (Z=0).
 * Perfectly oriented face down for multi-color AMS layer 1-4 printing.
 */
export function layoutBookCoverFlat(
  modelMap: UnpackedModelMap,
  config: BookMakerConfig,
  designModifiers: BookDesignModifier[] = [],
): BookLayoutPart[] {
  const keys = getBookMeshKeys(config);
  const fmt = BOOK_FORMATS.find(f => f.id === config.formatId) || BOOK_FORMATS[0];

  const actualPitch = PITCH;
  const axisX = AXIS_X;
  const D = actualPitch * config.pages + 0.102;
  const sh = fmt.Dr / 2;

  // Bed-grounding orientation matrix (maps raw outer surface at y = -2.1 to z = 0 flat on bed)
  const wBase = new THREE.Matrix4().set(
    1,  0,  0,   0,
    0,  0, -1,   0,
    0,  1,  0, 2.1,
    0,  0,  0,   1
  );

  // Flat placement matrices (fold progress f = 0)
  const mBack = new THREE.Matrix4().makeTranslation(sh, 0, 0);
  const mSpine = new THREE.Matrix4().makeTranslation(axisX - D / 2, 0, 0);
  const mFront = new THREE.Matrix4().makeTranslation(2 * axisX - D - sh, 0, 0)
    .multiply(new THREE.Matrix4().makeScale(-1, 1, -1));

  const backMesh = modelMap[keys.back];
  const spineMesh = modelMap[keys.spine];
  const frontMesh = modelMap[keys.front];

  if (!backMesh || !spineMesh || !frontMesh) {
    throw new Error('Thiếu dữ liệu mô hình các bộ phận bìa.');
  }

  // 1. Back Cover
  const gBack = new THREE.BufferGeometry();
  gBack.setAttribute('position', new THREE.BufferAttribute(new Float32Array(backMesh.positions), 3));
  gBack.setIndex(new THREE.BufferAttribute(backMesh.indices, 1));
  gBack.applyMatrix4(mBack);
  gBack.applyMatrix4(wBase);

  // 2. Stretched Spine
  const gSpine = stretchSpineGeometry(spineMesh, config.pages, actualPitch);
  gSpine.applyMatrix4(mSpine);
  gSpine.applyMatrix4(wBase);

  // 3. Front Cover
  const gFront = new THREE.BufferGeometry();
  gFront.setAttribute('position', new THREE.BufferAttribute(new Float32Array(frontMesh.positions), 3));
  gFront.setIndex(new THREE.BufferAttribute(frontMesh.indices, 1));
  gFront.applyMatrix4(mFront);
  gFront.applyMatrix4(wBase);

  // Combine bounding box to center precisely at (128, 128) on a 256x256 build plate
  const coverBox = new THREE.Box3();
  gBack.computeBoundingBox(); coverBox.union(gBack.boundingBox!);
  gSpine.computeBoundingBox(); coverBox.union(gSpine.boundingBox!);
  gFront.computeBoundingBox(); coverBox.union(gFront.boundingBox!);

  const coverCenter = new THREE.Vector3();
  coverBox.getCenter(coverCenter);
  const mCenter = new THREE.Matrix4().makeTranslation(
    128 - coverCenter.x,
    128 - coverCenter.y,
    -coverBox.min.z, // Ground bottom exactly at Z = 0
  );

  gBack.applyMatrix4(mCenter);
  gSpine.applyMatrix4(mCenter);
  gFront.applyMatrix4(mCenter);

  gBack.computeVertexNormals();
  gSpine.computeVertexNormals();
  gFront.computeVertexNormals();

  const parts: BookLayoutPart[] = [
    { id: 'cover-back', name: 'Bìa sau', geometry: gBack, colorHex: config.coverColor, extruder: 1, platerId: 1, isCoverSubpart: true },
    { id: 'spine', name: 'Gáy sách', geometry: gSpine, colorHex: config.coverColor, extruder: 1, platerId: 1, isCoverSubpart: true },
    { id: 'cover-front', name: 'Bìa trước', geometry: gFront, colorHex: config.coverColor, extruder: 1, platerId: 1, isCoverSubpart: true },
  ];

  // 4. Custom Design Modifiers (Embossed text / drawings / photos in color)
  if (designModifiers && designModifiers.length > 0) {
    const modifierColors = [...new Set(designModifiers.map(d => d.hex.toUpperCase()))];

    designModifiers.forEach((mod, idx) => {
      const posArray = parseModifierBuffer(mod.v, 'float32') as Float32Array;
      const idxArray = parseModifierBuffer(mod.f, 'uint32') as Uint32Array;

      if (posArray.length === 0 || idxArray.length === 0) {
        return;
      }

      const gMod = new THREE.BufferGeometry();
      gMod.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      gMod.setIndex(new THREE.BufferAttribute(idxArray, 1));

      // Apply the part's placement transform
      if (mod.part === 'back') gMod.applyMatrix4(mBack);
      else if (mod.part === 'spine') gMod.applyMatrix4(mSpine);
      else if (mod.part === 'front') gMod.applyMatrix4(mFront);

      gMod.applyMatrix4(wBase);
      gMod.applyMatrix4(mCenter);
      gMod.computeVertexNormals();

      const colorSlot = modifierColors.indexOf(mod.hex.toUpperCase());
      const extruder = 3 + colorSlot; // Slot 1 = Cover, Slot 2 = Pages, Slot 3+ = Modifiers

      parts.push({
        id: `design-mod-${idx + 1}`,
        name: `Họa tiết / Chữ nổi ${idx + 1}`,
        geometry: gMod,
        colorHex: mod.hex,
        extruder,
        platerId: 1,
        isCoverSubpart: true,
      });
    });
  }

  return parts;
}

/**
 * Computes plate world center in Bambu Studio / OrcaSlicer coordinates.
 * Plate 1: (128, 128)
 * Plate 2: (435.2, 128) - offset along X by +307.2 mm
 * Plate 3: (128, -179.2) - offset along Y by -307.2 mm
 * Plate 4: (435.2, -179.2)
 */
export function getPlateWorldCenter(platerId: number): { x: number; y: number } {
  const plateCol = (platerId - 1) % 2;
  const plateRow = Math.floor((platerId - 1) / 2);
  const centerX = 128 + plateCol * 307.2;
  const centerY = 128 - plateRow * 307.2;
  return { x: centerX, y: centerY };
}

/**
 * Lays out all book pages in a non-overlapping grid on their respective build plates (Z=0).
 * Dynamically computes safe columns and rows to strictly stay within 240x240 mm printable area.
 * When worldOffset is true, shifts pages to Plate 2/3/4 world coordinates for multi-plate 3MF.
 */
export function layoutBookPagesFlat(
  modelMap: UnpackedModelMap,
  config: BookMakerConfig,
  worldOffset = true,
): BookLayoutPart[] {
  const keys = getBookMeshKeys(config);
  const pageNormalMesh = modelMap[keys.pageNormal];
  const pageFrontMesh = modelMap[keys.pageFront];

  if (!pageNormalMesh || !pageFrontMesh) {
    throw new Error('Thiếu dữ liệu mô hình trang sách.');
  }

  // Base orientation for pages to sit flat on print bed (Z=0)
  const mPageBase = new THREE.Matrix4().set(
    1,  0,  0, 0,
    0,  0, -1, 0,
    0,  1,  0, 0,
    0,  0,  0, 1
  );

  // Measure single page bounding box
  const testGeom = new THREE.BufferGeometry();
  testGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pageNormalMesh.positions), 3));
  testGeom.applyMatrix4(mPageBase);
  testGeom.computeBoundingBox();
  const pBox = testGeom.boundingBox!;
  const pWidth = pBox.max.x - pBox.min.x;
  const pHeight = pBox.max.y - pBox.min.y;
  const pCenterOffset = new THREE.Vector3();
  pBox.getCenter(pCenterOffset);

  // Dynamically calculate safe columns and rows within 240x240 printable boundary
  const SAFE_SIZE = 240;
  const MIN_GAP = 8;
  const cols = Math.max(1, Math.floor((SAFE_SIZE + MIN_GAP) / (pWidth + MIN_GAP)));
  const rows = Math.max(1, Math.floor((SAFE_SIZE + MIN_GAP) / (pHeight + MIN_GAP)));
  const perPlate = cols * rows;

  const totalGridW = cols * pWidth + (cols - 1) * MIN_GAP;
  const totalGridH = rows * pHeight + (rows - 1) * MIN_GAP;

  const parts: BookLayoutPart[] = [];

  for (let idx = 0; idx < config.pages; idx++) {
    const pageIndexInPlate = idx % perPlate;
    const platerId = Math.floor(idx / perPlate) + 2; // Pages start on Plate 2

    // Determine target center for the plate
    const plateCenter = worldOffset ? getPlateWorldCenter(platerId) : { x: 128, y: 128 };

    const col = pageIndexInPlate % cols;
    const row = Math.floor(pageIndexInPlate / cols);

    const startX = plateCenter.x - totalGridW / 2 + pWidth / 2;
    const startY = plateCenter.y - totalGridH / 2 + pHeight / 2;

    const targetX = startX + col * (pWidth + MIN_GAP);
    const targetY = startY + row * (pHeight + MIN_GAP);

    const meshData = idx === 0 ? pageFrontMesh : pageNormalMesh;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(meshData.positions), 3));
    g.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    g.applyMatrix4(mPageBase);

    // Position page in grid and ensure Z_min = 0
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(
      targetX - pCenterOffset.x,
      targetY - pCenterOffset.y,
      -pBox.min.z,
    ));
    g.computeVertexNormals();

    parts.push({
      id: `page-${idx + 1}`,
      name: idx === 0 ? 'Trang 1 (Khung ảnh)' : `Trang ${idx + 1}`,
      geometry: g,
      colorHex: config.pageColor,
      extruder: 2,
      platerId,
      isCoverSubpart: false,
    });
  }

  return parts;
}

/**
 * Builds the complete set of transformed parts for interactive 3D preview.
 */
export function assembleBookGeometries(
  modelMap: UnpackedModelMap,
  config: BookMakerConfig,
): AssembledBookPart[] {
  const keys = getBookMeshKeys(config);
  const parts: AssembledBookPart[] = [];

  const backMesh = modelMap[keys.back];
  const frontMesh = modelMap[keys.front];
  const spineMesh = modelMap[keys.spine];
  const pageNormalMesh = modelMap[keys.pageNormal];
  const pageFrontMesh = modelMap[keys.pageFront];

  if (!backMesh || !frontMesh || !spineMesh || !pageNormalMesh || !pageFrontMesh) {
    throw new Error('Thiếu dữ liệu mô hình các bộ phận cần thiết.');
  }

  // 1. Back Cover
  const backGeom = new THREE.BufferGeometry();
  backGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(backMesh.positions), 3));
  backGeom.setIndex(new THREE.BufferAttribute(backMesh.indices, 1));
  backGeom.computeVertexNormals();
  parts.push({
    id: 'cover-back',
    name: 'Bìa sau',
    geometry: backGeom,
    colorHex: config.coverColor,
    isCover: true,
  });

  // 2. Spine (dynamically stretched to page count)
  const spineGeom = stretchSpineGeometry(spineMesh, config.pages, PITCH);
  parts.push({
    id: 'spine',
    name: 'Gáy sách',
    geometry: spineGeom,
    colorHex: config.coverColor,
    isCover: true,
  });

  // 3. Front Cover
  const frontGeom = new THREE.BufferGeometry();
  frontGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(frontMesh.positions), 3));
  frontGeom.setIndex(new THREE.BufferAttribute(frontMesh.indices, 1));
  frontGeom.computeVertexNormals();
  parts.push({
    id: 'cover-front',
    name: 'Bìa trước',
    geometry: frontGeom,
    colorHex: config.coverColor,
    isCover: true,
  });

  // 4. Pages (First page is P-F, remaining (n - 1) are P-N)
  const firstPageGeom = new THREE.BufferGeometry();
  firstPageGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pageFrontMesh.positions), 3));
  firstPageGeom.setIndex(new THREE.BufferAttribute(pageFrontMesh.indices, 1));
  firstPageGeom.computeVertexNormals();
  parts.push({
    id: 'page-1',
    name: 'Trang 1 (Khung ảnh)',
    geometry: firstPageGeom,
    colorHex: config.pageColor,
    isCover: false,
  });

  for (let i = 2; i <= config.pages; i++) {
    const pageGeom = new THREE.BufferGeometry();
    const pos = new Float32Array(pageNormalMesh.positions);
    const yOffset = (i - 1) * PITCH * 0.1;
    for (let k = 1; k < pos.length; k += 3) {
      pos[k] += yOffset;
    }
    pageGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pageGeom.setIndex(new THREE.BufferAttribute(pageNormalMesh.indices, 1));
    pageGeom.computeVertexNormals();
    parts.push({
      id: `page-${i}`,
      name: `Trang ${i}`,
      geometry: pageGeom,
      colorHex: config.pageColor,
      isCover: false,
    });
  }

  return parts;
}
