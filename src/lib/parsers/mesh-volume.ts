// Server-side mesh volume for the storefront file estimate (instant-quote plan, ADR-0034).
// Pure, dependency-free: binary STL, ASCII STL and OBJ (triangulated as fans). Units are assumed to
// be millimetres (the de-facto convention for 3D-printing files). Never trusts sizes declared inside
// the file beyond hard caps, so a crafted file can't make the server allocate/loop unboundedly.
import { unzipSync, strFromU8 } from 'fflate';
import { DomainError } from '../domain-error';

export const MESH_MAX_TRIANGLES = 3_000_000;

export type MeshVolumeResult = {
  volumeCm3: number;
  triangles: number;
  /** Axis-aligned bounding box in mm — shown to the customer as a sanity check of units/scale.
   * Omitted for .3mf (objects are placed with transforms; volume is exact, the box is not needed). */
  sizeMm?: { x: number; y: number; z: number };
};

class VolumeAccumulator {
  private signedMm3 = 0;
  triangles = 0;
  private min = [Infinity, Infinity, Infinity];
  private max = [-Infinity, -Infinity, -Infinity];

  add(a: number[], b: number[], c: number[]) {
    if (++this.triangles > MESH_MAX_TRIANGLES) throw new DomainError('MESH_TOO_LARGE', 'File có quá nhiều tam giác để ước tính tự động.', 422);
    this.signedMm3 += (
      a[0] * (b[1] * c[2] - b[2] * c[1])
      - a[1] * (b[0] * c[2] - b[2] * c[0])
      + a[2] * (b[0] * c[1] - b[1] * c[0])
    ) / 6;
    for (const p of [a, b, c]) {
      for (let i = 0; i < 3; i += 1) {
        if (p[i] < this.min[i]) this.min[i] = p[i];
        if (p[i] > this.max[i]) this.max[i] = p[i];
      }
    }
  }

  result(): MeshVolumeResult {
    if (!this.triangles) throw new DomainError('MESH_EMPTY', 'Không đọc được hình khối nào trong file.', 422);
    const volumeCm3 = Math.abs(this.signedMm3) / 1_000;
    if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0) throw new DomainError('MESH_INVALID', 'Hình khối trong file không hợp lệ (thể tích bằng 0).', 422);
    const size = (i: number) => Math.round((this.max[i] - this.min[i]) * 10) / 10;
    return { volumeCm3, triangles: this.triangles, sizeMm: { x: size(0), y: size(1), z: size(2) } };
  }
}

function isBinaryStl(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 84) return false;
  const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true);
  return 84 + count * 50 === bytes.byteLength;
}

export function parseStlVolume(bytes: Uint8Array): MeshVolumeResult {
  const acc = new VolumeAccumulator();
  if (isBinaryStl(bytes)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(80, true);
    for (let t = 0; t < count; t += 1) {
      const o = 84 + t * 50 + 12; // skip normal
      const v = (k: number) => [view.getFloat32(o + k * 12, true), view.getFloat32(o + k * 12 + 4, true), view.getFloat32(o + k * 12 + 8, true)];
      acc.add(v(0), v(1), v(2));
    }
    return acc.result();
  }
  const text = new TextDecoder().decode(bytes);
  const vertexRe = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  let triangle: number[][] = [];
  for (const match of text.matchAll(vertexRe)) {
    triangle.push([Number(match[1]), Number(match[2]), Number(match[3])]);
    if (triangle.length === 3) {
      acc.add(triangle[0], triangle[1], triangle[2]);
      triangle = [];
    }
  }
  return acc.result();
}

export function parseObjVolume(bytes: Uint8Array): MeshVolumeResult {
  const acc = new VolumeAccumulator();
  const vertices: number[][] = [];
  const text = new TextDecoder().decode(bytes);
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      vertices.push([Number(x), Number(y), Number(z)]);
    } else if (line.startsWith('f ')) {
      const indices = line.split(/\s+/).slice(1).map((token) => {
        const raw = Number(token.split('/')[0]);
        return raw < 0 ? vertices.length + raw : raw - 1;
      });
      for (let i = 1; i + 1 < indices.length; i += 1) {
        const a = vertices[indices[0]]; const b = vertices[indices[i]]; const c = vertices[indices[i + 1]];
        if (!a || !b || !c) throw new DomainError('MESH_INVALID', 'File OBJ tham chiếu đỉnh không tồn tại.', 422);
        acc.add(a, b, c);
      }
    }
  }
  return acc.result();
}

// ---------------------------------------------------------------------------------------------
// Unsliced .3mf (e.g. a MakerWorld/Bambu Studio project): no print time inside, but the geometry is.
// Volume = Σ over <build><item> of the referenced object's volume × |det(transform)|, where an object
// is either a <mesh> or <components> (possibly in another .model file, Bambu's 3D/Objects/*.model).
// Copies placed on the plate count as separate items, exactly like the printer would print them.

const UNIT_TO_MM: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };
const MAX_3MF_UNZIPPED_BYTES = 200 * 1024 * 1024;

type ModelObject = { volumeMm3?: number; components?: { path: string; objectId: string; det: number }[] };

function attr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match?.[1];
}

function transformDet(transform: string | undefined): number {
  if (!transform) return 1;
  const m = transform.trim().split(/\s+/).map(Number);
  if (m.length !== 12 || m.some((v) => !Number.isFinite(v))) return 1;
  // 3MF row-major 4x3: rows (m00 m01 m02) (m10 m11 m12) (m20 m21 m22) (translation)
  return Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]));
}

function parseModelFile(xml: string, path: string, objects: Map<string, ModelObject>, triangleBudget: { used: number }) {
  for (const objectMatch of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const id = attr(objectMatch[1], 'id');
    if (!id) continue;
    const body = objectMatch[2];
    const key = `${path}#${id}`;
    const meshMatch = body.match(/<mesh\b[\s\S]*?<\/mesh>/);
    if (meshMatch) {
      const vertices: number[][] = [];
      for (const v of meshMatch[0].matchAll(/<vertex\b([^>]*)\/?>/g)) {
        vertices.push([Number(attr(v[1], 'x')), Number(attr(v[1], 'y')), Number(attr(v[1], 'z'))]);
      }
      let signed = 0;
      for (const t of meshMatch[0].matchAll(/<triangle\b([^>]*)\/?>/g)) {
        if (++triangleBudget.used > MESH_MAX_TRIANGLES) throw new DomainError('MESH_TOO_LARGE', 'File có quá nhiều tam giác để ước tính tự động.', 422);
        const a = vertices[Number(attr(t[1], 'v1'))]; const b = vertices[Number(attr(t[1], 'v2'))]; const c = vertices[Number(attr(t[1], 'v3'))];
        if (!a || !b || !c) throw new DomainError('MESH_INVALID', 'File .3mf tham chiếu đỉnh không tồn tại.', 422);
        signed += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      }
      objects.set(key, { volumeMm3: Math.abs(signed) });
      continue;
    }
    const components = [...body.matchAll(/<component\b([^>]*)\/?>/g)].map((c) => ({
      path: (attr(c[1], 'p:path') ?? path).replace(/^\//, ''),
      objectId: attr(c[1], 'objectid') ?? '',
      det: transformDet(attr(c[1], 'transform')),
    }));
    objects.set(key, { components });
  }
}

export function parseThreeMfMeshVolume(bytes: Uint8Array): MeshVolumeResult {
  let files: Record<string, Uint8Array>;
  try {
    let total = 0;
    files = unzipSync(bytes, {
      filter: (file) => {
        if (!file.name.toLowerCase().endsWith('.model')) return false;
        total += file.originalSize;
        if (total > MAX_3MF_UNZIPPED_BYTES) throw new DomainError('MESH_TOO_LARGE', 'File .3mf quá lớn để ước tính tự động.', 422);
        return true;
      },
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('INVALID_3MF_FILE', 'File không đọc được — không phải định dạng .3mf hợp lệ.', 400);
  }
  const mainPath = Object.keys(files).find((name) => name.toLowerCase() === '3d/3dmodel.model');
  if (!mainPath) throw new DomainError('MESH_EMPTY', 'Không tìm thấy mô hình trong file .3mf.', 422);

  const objects = new Map<string, ModelObject>();
  const budget = { used: 0 };
  for (const [path, data] of Object.entries(files)) parseModelFile(strFromU8(data), path, objects, budget);

  const mainXml = strFromU8(files[mainPath]);
  const unitScale = UNIT_TO_MM[(mainXml.match(/<model\b[^>]*\sunit="([^"]+)"/)?.[1] ?? 'millimeter').toLowerCase()] ?? 1;

  const memo = new Map<string, number>();
  const volumeOf = (key: string, depth: number): number => {
    if (depth > 16) throw new DomainError('MESH_INVALID', 'Cấu trúc .3mf lồng nhau quá sâu.', 422);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const object = objects.get(key);
    if (!object) return 0;
    const volume = object.volumeMm3 ?? (object.components ?? []).reduce((sum, c) => sum + volumeOf(`${c.path}#${c.objectId}`, depth + 1) * c.det, 0);
    memo.set(key, volume);
    return volume;
  };

  const buildMatch = mainXml.match(/<build\b[^>]*>([\s\S]*?)<\/build>/);
  let totalMm3 = 0;
  for (const item of (buildMatch?.[1] ?? '').matchAll(/<item\b([^>]*)\/?>/g)) {
    const objectId = attr(item[1], 'objectid');
    if (objectId) totalMm3 += volumeOf(`${mainPath}#${objectId}`, 0) * transformDet(attr(item[1], 'transform'));
  }
  const volumeCm3 = (totalMm3 * unitScale ** 3) / 1_000;
  if (!budget.used || !Number.isFinite(volumeCm3) || volumeCm3 <= 0) throw new DomainError('MESH_EMPTY', 'Không đọc được hình khối nào trong file .3mf.', 422);
  return { volumeCm3, triangles: budget.used };
}
