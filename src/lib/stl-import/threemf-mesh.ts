// Feature 003: a .3mf model (e.g. KeyCap3D `gengar-keycap.3mf`) → one binary STL of its build plate, so
// measuring and rendering reuse the STL path unchanged. Only the geometry (3D/**.model) is read — the
// embedded pictures (Auxiliaries/.thumbnails/*, Metadata/plate_N.png) are the author's covers and are
// never used: every product gets the same rendered 4 views.
//
// Geometry: every <build><item> with its transform, objects either a <mesh> or <components> (possibly in
// another .model file, Bambu's 3D/Objects/*.model), in the model's unit, scaled to mm. Bounded like the
// pricing parser (src/lib/parsers/mesh-volume.ts): ≤ MAX_3MF_UNZIPPED_BYTES of XML, ≤ MESH_MAX_TRIANGLES.
import { strFromU8, unzipSync } from 'fflate';
import { MAX_3MF_UNZIPPED_BYTES, attr, firstElement, scanElements } from '../parsers/mesh-volume';
import { MESH_MAX_TRIANGLES, MeshMetricsError } from '../pricing/mesh-metrics';

const UNIT_TO_MM: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };
const MAIN_MODEL = '3d/3dmodel.model';
const MAX_DEPTH = 16;

/** 3MF row-major 4×3: (m00 m01 m02) (m10 m11 m12) (m20 m21 m22) (translation); p' = p · M. */
type Mat = number[];
const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parseTransform(value: string | undefined): Mat {
  if (!value) return IDENTITY;
  const m = value.trim().split(/\s+/).map(Number);
  return m.length === 12 && m.every(Number.isFinite) ? m : IDENTITY;
}

/** `inner` applied first, then `outer`. */
function compose(inner: Mat, outer: Mat): Mat {
  const r = new Array<number>(12);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      let s = row === 3 ? outer[9 + col] : 0;
      for (let k = 0; k < 3; k += 1) s += inner[row * 3 + k] * outer[k * 3 + col];
      r[row * 3 + col] = s;
    }
  }
  return r;
}

function determinant(m: Mat): number {
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
}

type MeshObject = { vertices: Float64Array; triangles: Uint32Array };
type ModelObject = { mesh?: MeshObject; components?: { key: string; transform: Mat }[] };

function parseModelFile(xml: string, path: string, objects: Map<string, ModelObject>, budget: { triangles: number }) {
  const resources = firstElement(xml, 'resources', 0, xml.length, true);
  if (!resources) return;
  for (const object of scanElements(xml, 'object', resources.bodyStart, resources.bodyEnd, true)) {
    const id = attr(object.attrs, 'id');
    if (!id) continue;
    const mesh = firstElement(xml, 'mesh', object.bodyStart, object.bodyEnd, true);
    if (mesh) {
      const coords: number[] = [];
      for (const v of scanElements(xml, 'vertex', mesh.bodyStart, mesh.bodyEnd, false)) {
        coords.push(Number(attr(v.attrs, 'x')), Number(attr(v.attrs, 'y')), Number(attr(v.attrs, 'z')));
      }
      const vertexCount = coords.length / 3;
      const indices: number[] = [];
      for (const t of scanElements(xml, 'triangle', mesh.bodyStart, mesh.bodyEnd, false)) {
        if (++budget.triangles > MESH_MAX_TRIANGLES) throw new MeshMetricsError('MESH_TOO_LARGE', 'File .3mf có quá nhiều tam giác.');
        for (const name of ['v1', 'v2', 'v3']) {
          const index = Number(attr(t.attrs, name));
          if (!Number.isInteger(index) || index < 0 || index >= vertexCount) throw new MeshMetricsError('MESH_INVALID', 'File .3mf tham chiếu đỉnh không tồn tại.');
          indices.push(index);
        }
      }
      objects.set(`${path}#${id}`, { mesh: { vertices: Float64Array.from(coords), triangles: Uint32Array.from(indices) } });
      continue;
    }
    const components = [...scanElements(xml, 'component', object.bodyStart, object.bodyEnd, false)].map((c) => ({
      key: `${(attr(c.attrs, 'p:path') ?? path).replace(/^\//, '').toLowerCase()}#${attr(c.attrs, 'objectid') ?? ''}`,
      transform: parseTransform(attr(c.attrs, 'transform')),
    }));
    objects.set(`${path}#${id}`, { components });
  }
}

/** Binary STL (mm) of everything on the build plate. Throws MeshMetricsError for an unreadable file. */
export function threeMfToBinaryStl(bytes: Uint8Array): Uint8Array {
  let files: Record<string, Uint8Array>;
  try {
    let total = 0;
    files = unzipSync(bytes, {
      filter: (file) => {
        if (!file.name.toLowerCase().endsWith('.model')) return false;
        total += file.originalSize;
        if (total > MAX_3MF_UNZIPPED_BYTES) throw new MeshMetricsError('MESH_TOO_LARGE', 'File .3mf quá lớn.');
        return true;
      },
    });
  } catch (error) {
    if (error instanceof MeshMetricsError) throw error;
    throw new MeshMetricsError('MESH_INVALID', 'File .3mf không đọc được (không phải file zip 3MF hợp lệ).');
  }
  const xmlByPath = new Map(Object.entries(files).map(([name, data]) => [name.toLowerCase(), strFromU8(data)]));
  const mainXml = xmlByPath.get(MAIN_MODEL);
  if (!mainXml) throw new MeshMetricsError('MESH_EMPTY', 'Không tìm thấy 3D/3dmodel.model trong file .3mf.');

  const objects = new Map<string, ModelObject>();
  const budget = { triangles: 0 };
  try {
    for (const [path, xml] of xmlByPath) parseModelFile(xml, path, objects, budget);
  } catch (error) {
    if (error instanceof MeshMetricsError) throw error;
    throw new MeshMetricsError('MESH_INVALID', 'File .3mf bị hỏng (XML không đọc được).'); // e.g. a missing closing tag
  }

  const modelElement = firstElement(mainXml, 'model', 0, mainXml.length, false);
  const scale = UNIT_TO_MM[(attr(modelElement?.attrs ?? '', 'unit') ?? 'millimeter').toLowerCase()] ?? 1;
  const unit: Mat = [scale, 0, 0, 0, scale, 0, 0, 0, scale, 0, 0, 0];

  const positions: number[] = [];
  const emit = (key: string, transform: Mat, depth: number) => {
    if (depth > MAX_DEPTH) throw new MeshMetricsError('MESH_INVALID', 'Cấu trúc .3mf lồng nhau quá sâu.');
    const object = objects.get(key);
    if (!object) return;
    for (const component of object.components ?? []) emit(component.key, compose(component.transform, transform), depth + 1);
    if (!object.mesh) return;
    const { vertices, triangles } = object.mesh;
    // Instances count too: one mesh placed many times must not blow past the cap.
    if (positions.length / 9 + triangles.length / 3 > MESH_MAX_TRIANGLES) throw new MeshMetricsError('MESH_TOO_LARGE', 'File .3mf có quá nhiều tam giác.');
    // A mirroring transform flips the winding; swap two corners so the signed volume stays positive.
    const order = determinant(transform) < 0 ? [0, 2, 1] : [0, 1, 2];
    const m = transform;
    for (let t = 0; t < triangles.length; t += 3) {
      for (const k of order) {
        const v = triangles[t + k] * 3;
        const x = vertices[v], y = vertices[v + 1], z = vertices[v + 2];
        positions.push(x * m[0] + y * m[3] + z * m[6] + m[9], x * m[1] + y * m[4] + z * m[7] + m[10], x * m[2] + y * m[5] + z * m[8] + m[11]);
      }
    }
  };
  const build = firstElement(mainXml, 'build', 0, mainXml.length, true);
  if (build) {
    for (const item of scanElements(mainXml, 'item', build.bodyStart, build.bodyEnd, false)) {
      const objectId = attr(item.attrs, 'objectid');
      if (objectId) emit(`${MAIN_MODEL}#${objectId}`, compose(parseTransform(attr(item.attrs, 'transform')), unit), 0);
    }
  }
  const count = positions.length / 9;
  if (!count) throw new MeshMetricsError('MESH_EMPTY', 'Không đọc được hình khối nào trong file .3mf.');

  const out = new Uint8Array(84 + count * 50);
  const view = new DataView(out.buffer);
  view.setUint32(80, count, true);
  for (let t = 0; t < count; t += 1) {
    const offset = 84 + t * 50 + 12; // facet normal left as 0 0 0 (readers recompute it)
    for (let k = 0; k < 9; k += 1) view.setFloat32(offset + k * 4, positions[t * 9 + k], true);
  }
  return out;
}

/** Extracts flat vertex coordinates (Float32Array) from a 3MF package for direct Three.js rendering. */
export function threeMfToPositions(bytes: Uint8Array): Float32Array {
  let files: Record<string, Uint8Array>;
  try {
    let total = 0;
    files = unzipSync(bytes, {
      filter: (file) => {
        if (!file.name.toLowerCase().endsWith('.model')) return false;
        total += file.originalSize;
        if (total > MAX_3MF_UNZIPPED_BYTES) throw new MeshMetricsError('MESH_TOO_LARGE', 'File .3mf quá lớn.');
        return true;
      },
    });
  } catch (error) {
    if (error instanceof MeshMetricsError) throw error;
    throw new MeshMetricsError('MESH_INVALID', 'File .3mf không đọc được (không phải file zip 3MF hợp lệ).');
  }
  const xmlByPath = new Map(Object.entries(files).map(([name, data]) => [name.toLowerCase(), strFromU8(data)]));
  const mainXml = xmlByPath.get(MAIN_MODEL);
  if (!mainXml) throw new MeshMetricsError('MESH_EMPTY', 'Không tìm thấy 3D/3dmodel.model trong file .3mf.');

  const objects = new Map<string, ModelObject>();
  const budget = { triangles: 0 };
  try {
    for (const [path, xml] of xmlByPath) parseModelFile(xml, path, objects, budget);
  } catch (error) {
    if (error instanceof MeshMetricsError) throw error;
    throw new MeshMetricsError('MESH_INVALID', 'File .3mf bị hỏng (XML không đọc được).');
  }

  const modelElement = firstElement(mainXml, 'model', 0, mainXml.length, false);
  const scale = UNIT_TO_MM[(attr(modelElement?.attrs ?? '', 'unit') ?? 'millimeter').toLowerCase()] ?? 1;
  const unit: Mat = [scale, 0, 0, 0, scale, 0, 0, 0, scale, 0, 0, 0];

  const positions: number[] = [];
  const emit = (key: string, transform: Mat, depth: number) => {
    if (depth > MAX_DEPTH) throw new MeshMetricsError('MESH_INVALID', 'Cấu trúc .3mf lồng nhau quá sâu.');
    const object = objects.get(key);
    if (!object) return;
    for (const component of object.components ?? []) emit(component.key, compose(component.transform, transform), depth + 1);
    if (!object.mesh) return;
    const { vertices, triangles } = object.mesh;
    if (positions.length / 9 + triangles.length / 3 > MESH_MAX_TRIANGLES) throw new MeshMetricsError('MESH_TOO_LARGE', 'File .3mf có quá nhiều tam giác.');
    const order = determinant(transform) < 0 ? [0, 2, 1] : [0, 1, 2];
    const m = transform;
    for (let t = 0; t < triangles.length; t += 3) {
      for (const k of order) {
        const v = triangles[t + k] * 3;
        const x = vertices[v], y = vertices[v + 1], z = vertices[v + 2];
        positions.push(x * m[0] + y * m[3] + z * m[6] + m[9], x * m[1] + y * m[4] + z * m[7] + m[10], x * m[2] + y * m[5] + z * m[8] + m[11]);
      }
    }
  };
  const build = firstElement(mainXml, 'build', 0, mainXml.length, true);
  if (build) {
    for (const item of scanElements(mainXml, 'item', build.bodyStart, build.bodyEnd, false)) {
      const objectId = attr(item.attrs, 'objectid');
      if (objectId) emit(`${MAIN_MODEL}#${objectId}`, compose(parseTransform(attr(item.attrs, 'transform')), unit), 0);
    }
  }
  if (!positions.length) throw new MeshMetricsError('MESH_EMPTY', 'Không đọc được hình khối nào trong file .3mf.');
  return new Float32Array(positions);
}
