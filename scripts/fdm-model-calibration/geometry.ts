// Phase 33 S0 — printed geometry of a .3mf (offline calibration only, not production code).
//
// Walks <build><item> → <object> (mesh | components, possibly in 3D/Objects/*.model) applying the
// FULL 4x3 affine transforms (not just |det| like src/lib/parsers/mesh-volume.ts), so we get the
// real volume, surface area and Z height of what sits on the plate.
//
// 3MF transform "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32" maps a row vector:
//   x' = x·m00 + y·m10 + z·m20 + m30   (same for y', z' with columns 1, 2)
// A component placed inside an object placed by a build item: world = (p · C) · I  ⇒  M = C · I.
import { strFromU8 } from 'fflate';

export type Affine = readonly number[]; // 12 numbers, 3MF order

export const IDENTITY: Affine = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

export function parseTransform(value: string | undefined): Affine {
  if (!value) return IDENTITY;
  const m = value.trim().split(/\s+/).map(Number);
  return m.length === 12 && m.every(Number.isFinite) ? m : IDENTITY;
}

/** a then b (row-vector convention): p · a · b. */
export function compose(a: Affine, b: Affine): Affine {
  const r = new Array<number>(12);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      r[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  for (let col = 0; col < 3; col += 1) r[9 + col] = a[9] * b[col] + a[10] * b[3 + col] + a[11] * b[6 + col] + b[9 + col];
  return r;
}

function apply(m: Affine, x: number, y: number, z: number): [number, number, number] {
  return [
    x * m[0] + y * m[3] + z * m[6] + m[9],
    x * m[1] + y * m[4] + z * m[7] + m[10],
    x * m[2] + y * m[5] + z * m[8] + m[11],
  ];
}

type Mesh = { vertices: Float64Array; triangles: Uint32Array };
type ModelObject = { type: string; mesh?: Mesh; components?: { key: string; objectId: string; transform: Affine }[] };

export type GeometryOptions = {
  /** `objectKey` → component object ids to skip (modifier / negative / support-blocker parts). */
  excludedParts?: Map<string, Set<string>>;
};

export type PrintedGeometry = {
  volumeCm3: number;
  surfaceCm2: number;
  sizeMm: { x: number; y: number; z: number };
  triangles: number;
  meshes: number;
};

function attr(attrs: string, name: string): string | undefined {
  return attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
}

const UNIT_TO_MM: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

function parseModel(xml: string, path: string, objects: Map<string, ModelObject>): void {
  for (const objectMatch of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const id = attr(objectMatch[1], 'id');
    if (!id) continue;
    const type = attr(objectMatch[1], 'type') ?? 'model';
    const body = objectMatch[2];
    const meshMatch = body.match(/<mesh\b[\s\S]*?<\/mesh>/);
    if (meshMatch) {
      const coords: number[] = [];
      for (const v of meshMatch[0].matchAll(/<vertex\b([^>]*)\/?>/g)) {
        coords.push(Number(attr(v[1], 'x')), Number(attr(v[1], 'y')), Number(attr(v[1], 'z')));
      }
      const indices: number[] = [];
      for (const t of meshMatch[0].matchAll(/<triangle\b([^>]*)\/?>/g)) {
        indices.push(Number(attr(t[1], 'v1')), Number(attr(t[1], 'v2')), Number(attr(t[1], 'v3')));
      }
      objects.set(`${path}#${id}`, { type, mesh: { vertices: Float64Array.from(coords), triangles: Uint32Array.from(indices) } });
      continue;
    }
    const components = [...body.matchAll(/<component\b([^>]*)\/?>/g)].map((c) => ({
      key: (attr(c[1], 'p:path') ?? `/${path}`).replace(/^\//, ''),
      objectId: attr(c[1], 'objectid') ?? '',
      transform: parseTransform(attr(c[1], 'transform')),
    }));
    objects.set(`${path}#${id}`, { type, components });
  }
}

/** `files` = unzipped entries of the .3mf (only *.model files are needed). */
export function measurePrintedGeometry(files: Record<string, Uint8Array>, options: GeometryOptions = {}): PrintedGeometry {
  const mainPath = Object.keys(files).find((name) => name.toLowerCase() === '3d/3dmodel.model');
  if (!mainPath) throw new Error('no 3D/3dmodel.model');
  const objects = new Map<string, ModelObject>();
  for (const [path, data] of Object.entries(files)) {
    if (path.toLowerCase().endsWith('.model')) parseModel(strFromU8(data), path, objects);
  }
  const mainXml = strFromU8(files[mainPath]);
  const unitName = (mainXml.match(/<model\b[^>]*\sunit="([^"]+)"/)?.[1] ?? 'millimeter').toLowerCase();
  const unit = UNIT_TO_MM[unitName] ?? 1;
  const unitScale: Affine = [unit, 0, 0, 0, unit, 0, 0, 0, unit, 0, 0, 0];

  let volume = 0;
  let area = 0;
  let triangles = 0;
  let meshes = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const visit = (key: string, transform: Affine, depth: number) => {
    if (depth > 16) throw new Error('component nesting too deep');
    const object = objects.get(key);
    if (!object || (object.type !== 'model' && depth === 0)) return;
    if (object.type === 'support' || object.type === 'other') return;
    if (object.mesh) {
      meshes += 1;
      const { vertices, triangles: tri } = object.mesh;
      const world = new Float64Array(vertices.length);
      for (let i = 0; i < vertices.length; i += 3) {
        const [x, y, z] = apply(transform, vertices[i], vertices[i + 1], vertices[i + 2]);
        world[i] = x; world[i + 1] = y; world[i + 2] = z;
        if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
      }
      let signed = 0;
      for (let t = 0; t < tri.length; t += 3) {
        const a = tri[t] * 3; const b = tri[t + 1] * 3; const c = tri[t + 2] * 3;
        const ax = world[a], ay = world[a + 1], az = world[a + 2];
        const bx = world[b], by = world[b + 1], bz = world[b + 2];
        const cx = world[c], cy = world[c + 1], cz = world[c + 2];
        signed += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
      }
      // A mirrored transform flips the winding; the solid's volume is still positive.
      volume += Math.abs(signed);
      triangles += tri.length / 3;
      return;
    }
    const excluded = options.excludedParts?.get(key);
    for (const component of object.components ?? []) {
      if (excluded?.has(component.objectId)) continue;
      visit(`${component.key}#${component.objectId}`, compose(component.transform, transform), depth + 1);
    }
  };

  const build = mainXml.match(/<build\b[^>]*>([\s\S]*?)<\/build>/)?.[1] ?? '';
  for (const item of build.matchAll(/<item\b([^>]*)\/?>/g)) {
    const objectId = attr(item[1], 'objectid');
    if (!objectId) continue;
    if (attr(item[1], 'printable') === '0') continue;
    visit(`${mainPath}#${objectId}`, compose(parseTransform(attr(item[1], 'transform')), unitScale), 0);
  }
  if (!meshes || !(volume > 0)) throw new Error('no printable geometry');
  return {
    volumeCm3: volume / 1000,
    surfaceCm2: area / 100,
    sizeMm: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] },
    triangles,
    meshes,
  };
}
