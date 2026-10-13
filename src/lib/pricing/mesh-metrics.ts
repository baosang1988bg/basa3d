// Phase 33 S3 (plan T2): ONE geometry module shared by the browser (Web Worker, /bao-gia) and the
// server (re-verification at submit), so both compute the same numbers for the same file.
// Pure and dependency-free (no three.js, no Node APIs) — safe to import from a worker.
//
// Units: millimetres in, mm³ / mm² / mm out (the de-facto convention for STL/OBJ).

export const MESH_MAX_TRIANGLES = 3_000_000;

export type MeshMetrics = {
  volumeMm3: number;
  surfaceMm2: number;
  sizeMm: { x: number; y: number; z: number };
  triangles: number;
};

export class MeshMetricsError extends Error {
  constructor(public readonly code: 'MESH_TOO_LARGE' | 'MESH_EMPTY' | 'MESH_INVALID', message: string) {
    super(message);
  }
}

/** Accumulates signed volume (divergence theorem), surface area and the axis-aligned bounding box. */
export class MeshMetricsAccumulator {
  private signedMm3 = 0;
  private areaMm2 = 0;
  private readonly min = [Infinity, Infinity, Infinity];
  private readonly max = [-Infinity, -Infinity, -Infinity];
  triangles = 0;

  constructor(private readonly maxTriangles = MESH_MAX_TRIANGLES) {}

  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): void {
    if (++this.triangles > this.maxTriangles) throw new MeshMetricsError('MESH_TOO_LARGE', 'File có quá nhiều tam giác để ước tính tự động.');
    if (![ax, ay, az, bx, by, bz, cx, cy, cz].every(Number.isFinite)) throw new MeshMetricsError('MESH_INVALID', 'File chứa toạ độ không hợp lệ.');
    this.signedMm3 += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    this.areaMm2 += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
    this.extend(ax, ay, az); this.extend(bx, by, bz); this.extend(cx, cy, cz);
  }

  private extend(x: number, y: number, z: number) {
    if (x < this.min[0]) this.min[0] = x; if (x > this.max[0]) this.max[0] = x;
    if (y < this.min[1]) this.min[1] = y; if (y > this.max[1]) this.max[1] = y;
    if (z < this.min[2]) this.min[2] = z; if (z > this.max[2]) this.max[2] = z;
  }

  result(): MeshMetrics {
    if (!this.triangles) throw new MeshMetricsError('MESH_EMPTY', 'Không đọc được hình khối nào trong file.');
    return {
      volumeMm3: Math.abs(this.signedMm3),
      surfaceMm2: this.areaMm2,
      sizeMm: { x: this.max[0] - this.min[0], y: this.max[1] - this.min[1], z: this.max[2] - this.min[2] },
      triangles: this.triangles,
    };
  }
}

/** From a flat xyz position array (e.g. three.js BufferGeometry `position.array`), optionally indexed.
 * No triangle cap by default: this is for geometry already in memory (our own 3D tools, or a mesh
 * the worker already parsed) — the parsers below cap untrusted files instead. */
export function computeMeshMetrics(positions: ArrayLike<number>, index?: ArrayLike<number> | null, options: { maxTriangles?: number } = {}): MeshMetrics {
  const acc = new MeshMetricsAccumulator(options.maxTriangles ?? Infinity);
  const count = index ? index.length : positions.length / 3;
  for (let t = 0; t + 2 < count; t += 3) {
    const a = (index ? index[t] : t) * 3;
    const b = (index ? index[t + 1] : t + 1) * 3;
    const c = (index ? index[t + 2] : t + 2) * 3;
    acc.add(positions[a], positions[a + 1], positions[a + 2], positions[b], positions[b + 1], positions[b + 2], positions[c], positions[c + 1], positions[c + 2]);
  }
  return acc.result();
}

export function isBinaryStl(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 84) return false;
  const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true);
  return 84 + count * 50 === bytes.byteLength;
}

export function parseStlMetrics(bytes: Uint8Array): MeshMetrics {
  const acc = new MeshMetricsAccumulator();
  if (isBinaryStl(bytes)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(80, true);
    for (let t = 0; t < count; t += 1) {
      const o = 84 + t * 50 + 12; // skip the facet normal
      const f = (k: number) => view.getFloat32(o + k * 4, true);
      acc.add(f(0), f(1), f(2), f(3), f(4), f(5), f(6), f(7), f(8));
    }
    return acc.result();
  }
  const text = new TextDecoder().decode(bytes);
  const vertexRe = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  const tri: number[] = [];
  for (const match of text.matchAll(vertexRe)) {
    tri.push(Number(match[1]), Number(match[2]), Number(match[3]));
    if (tri.length === 9) {
      acc.add(tri[0], tri[1], tri[2], tri[3], tri[4], tri[5], tri[6], tri[7], tri[8]);
      tri.length = 0;
    }
  }
  return acc.result();
}

/** OBJ faces are triangulated as fans; negative (relative) indices are supported. */
export function parseObjMetrics(bytes: Uint8Array): MeshMetrics {
  const acc = new MeshMetricsAccumulator();
  const vertices: number[] = [];
  const text = new TextDecoder().decode(bytes);
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      vertices.push(Number(x), Number(y), Number(z));
    } else if (line.startsWith('f ')) {
      const count = vertices.length / 3;
      const indices = line.split(/\s+/).slice(1).map((token) => {
        const raw = Number(token.split('/')[0]);
        return raw < 0 ? count + raw : raw - 1;
      });
      for (let i = 1; i + 1 < indices.length; i += 1) {
        const ids = [indices[0], indices[i], indices[i + 1]];
        if (ids.some((id) => !Number.isInteger(id) || id < 0 || id >= count)) throw new MeshMetricsError('MESH_INVALID', 'File OBJ tham chiếu đỉnh không tồn tại.');
        const [a, b, c] = ids.map((id) => id * 3);
        acc.add(vertices[a], vertices[a + 1], vertices[a + 2], vertices[b], vertices[b + 1], vertices[b + 2], vertices[c], vertices[c + 1], vertices[c + 2]);
      }
    }
  }
  return acc.result();
}

/** Uniform scale (permille, 1000 = 100%): V × s³, A × s², size × s. */
export function scaleMeshMetrics(metrics: MeshMetrics, scalePermille: number): MeshMetrics {
  const s = scalePermille / 1000;
  return {
    volumeMm3: metrics.volumeMm3 * s ** 3,
    surfaceMm2: metrics.surfaceMm2 * s ** 2,
    sizeMm: { x: metrics.sizeMm.x * s, y: metrics.sizeMm.y * s, z: metrics.sizeMm.z * s },
    triangles: metrics.triangles,
  };
}

export type MeshConsistency = { ok: true } | { ok: false; reason: 'ZERO_VOLUME' | 'VOLUME_EXCEEDS_BOX' | 'AREA_TOO_SMALL' | 'NOT_FINITE' };

/**
 * Plausibility checks used by BOTH sides: by the estimator to mark a broken mesh UNPRICED, and by the
 * public endpoint to reject client metrics that no real solid can have.
 *   V ≤ x·y·z (a solid fits in its own box) and A ≥ (36π·V²)^(1/3) (isoperimetric inequality — a
 *   sphere has the least surface for a volume). 1% slack for float rounding.
 */
export function checkMeshConsistency(metrics: Pick<MeshMetrics, 'volumeMm3' | 'surfaceMm2' | 'sizeMm'>): MeshConsistency {
  const { volumeMm3: v, surfaceMm2: a, sizeMm } = metrics;
  if (![v, a, sizeMm.x, sizeMm.y, sizeMm.z].every(Number.isFinite)) return { ok: false, reason: 'NOT_FINITE' };
  if (v <= 0 || a <= 0) return { ok: false, reason: 'ZERO_VOLUME' };
  if (v > sizeMm.x * sizeMm.y * sizeMm.z * 1.01) return { ok: false, reason: 'VOLUME_EXCEEDS_BOX' };
  if (a < Math.cbrt(36 * Math.PI * v * v) * 0.99) return { ok: false, reason: 'AREA_TOO_SMALL' };
  return { ok: true };
}
