// Server-side mesh volume for the storefront file estimate (instant-quote plan, ADR-0034).
// Pure, dependency-free: binary STL, ASCII STL and OBJ (triangulated as fans). Units are assumed to
// be millimetres (the de-facto convention for 3D-printing files). Never trusts sizes declared inside
// the file beyond hard caps, so a crafted file can't make the server allocate/loop unboundedly.
import { DomainError } from '../domain-error';

export const MESH_MAX_TRIANGLES = 3_000_000;

export type MeshVolumeResult = {
  volumeCm3: number;
  triangles: number;
  /** Axis-aligned bounding box in mm — shown to the customer as a sanity check of units/scale. */
  sizeMm: { x: number; y: number; z: number };
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
