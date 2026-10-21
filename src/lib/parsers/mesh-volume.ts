// Server-side mesh volume for the storefront file estimate (instant-quote plan, ADR-0034).
// Pure, dependency-free: binary STL, ASCII STL and OBJ (triangulated as fans). Units are assumed to
// be millimetres (the de-facto convention for 3D-printing files). Never trusts sizes declared inside
// the file beyond hard caps, so a crafted file can't make the server allocate/loop unboundedly.
import { unzipSync, strFromU8 } from 'fflate';
import { DomainError } from '../domain-error';
import { MESH_MAX_TRIANGLES, MeshMetricsError, parseObjMetrics, parseStlMetrics, type MeshMetrics } from '../pricing/mesh-metrics';

// Phase 33 S3: STL/OBJ geometry now comes from the shared src/lib/pricing/mesh-metrics.ts (same
// numbers in the browser and on the server). These wrappers keep the ADR-0034 API and DomainErrors.
export { MESH_MAX_TRIANGLES } from '../pricing/mesh-metrics';

export type MeshVolumeResult = {
  volumeCm3: number;
  triangles: number;
  /** Axis-aligned bounding box in mm — shown to the customer as a sanity check of units/scale.
   * Omitted for .3mf (objects are placed with transforms; volume is exact, the box is not needed). */
  sizeMm?: { x: number; y: number; z: number };
};

function toVolumeResult(read: () => MeshMetrics): MeshVolumeResult {
  let metrics: MeshMetrics;
  try {
    metrics = read();
  } catch (error) {
    if (error instanceof MeshMetricsError) throw new DomainError(error.code, error.message, 422);
    throw error;
  }
  const volumeCm3 = metrics.volumeMm3 / 1_000;
  if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0) throw new DomainError('MESH_INVALID', 'Hình khối trong file không hợp lệ (thể tích bằng 0).', 422);
  const round = (value: number) => Math.round(value * 10) / 10;
  return { volumeCm3, triangles: metrics.triangles, sizeMm: { x: round(metrics.sizeMm.x), y: round(metrics.sizeMm.y), z: round(metrics.sizeMm.z) } };
}

export function parseStlVolume(bytes: Uint8Array): MeshVolumeResult {
  return toVolumeResult(() => parseStlMetrics(bytes));
}

export function parseObjVolume(bytes: Uint8Array): MeshVolumeResult {
  return toVolumeResult(() => parseObjMetrics(bytes));
}

// ---------------------------------------------------------------------------------------------
// Unsliced .3mf (e.g. a MakerWorld/Bambu Studio project): no print time inside, but the geometry is.
// Volume = Σ over <build><item> of the referenced object's volume × |det(transform)|, where an object
// is either a <mesh> or <components> (possibly in another .model file, Bambu's 3D/Objects/*.model).
// Copies placed on the plate count as separate items, exactly like the printer would print them.

const UNIT_TO_MM: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };
// Phase 35 D4: was 200 MB. The file can come from an anonymous upload; the whole XML becomes one JS
// string, so keep the ceiling well under the function's memory. Large legitimate projects fall back
// to a staff quote (MESH_TOO_LARGE), which is the existing behavior for oversized meshes.
export const MAX_3MF_UNZIPPED_BYTES = 100 * 1024 * 1024;
// A closed triangle mesh has roughly half as many vertices as triangles; 1:1 leaves ample headroom.
export const MESH_MAX_VERTICES = MESH_MAX_TRIANGLES;

type ModelObject = { volumeMm3?: number; components?: { path: string; objectId: string; det: number }[] };

const attrRegexCache = new Map<string, RegExp>();
export function attr(attrs: string, name: string): string | undefined {
  let pattern = attrRegexCache.get(name);
  if (!pattern) {
    pattern = new RegExp(`(?:^|\\s)${name}="([^"]*)"`);
    attrRegexCache.set(name, pattern);
  }
  return attrs.match(pattern)?.[1];
}

function transformDet(transform: string | undefined): number {
  if (!transform) return 1;
  const m = transform.trim().split(/\s+/).map(Number);
  if (m.length !== 12 || m.some((v) => !Number.isFinite(v))) return 1;
  // 3MF row-major 4x3: rows (m00 m01 m02) (m10 m11 m12) (m20 m21 m22) (translation)
  return Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]));
}

// Phase 35 D4: indexOf-bounded element scanner. The previous lazy `[\s\S]*?` regexes re-scanned
// to the end of the string from every opening tag when a closing tag was missing (O(n²) on a
// crafted file). Every step here moves forward, so a full pass is O(n).
type ScannedElement = { attrs: string; bodyStart: number; bodyEnd: number };

function findTagStart(xml: string, tag: string, from: number, end: number): number {
  let index = from;
  for (;;) {
    index = xml.indexOf(`<${tag}`, index);
    if (index < 0 || index >= end) return -1;
    const next = xml.charCodeAt(index + tag.length + 1);
    // Tag name must end here: whitespace, '>' or '/'. Rejects `<components` when looking for `<component`.
    if (next === 32 || next === 9 || next === 10 || next === 13 || next === 62 || next === 47) return index;
    index += tag.length + 1;
  }
}

export function* scanElements(xml: string, tag: string, from: number, end: number, withBody: boolean): Generator<ScannedElement> {
  let index = from;
  for (;;) {
    const start = findTagStart(xml, tag, index, end);
    if (start < 0) return;
    const gt = xml.indexOf('>', start);
    if (gt < 0 || gt >= end) return;
    const selfClosing = xml.charCodeAt(gt - 1) === 47;
    const attrs = xml.slice(start + tag.length + 1, selfClosing ? gt - 1 : gt);
    if (!withBody || selfClosing) {
      yield { attrs, bodyStart: gt + 1, bodyEnd: gt + 1 };
      index = gt + 1;
      continue;
    }
    const close = xml.indexOf(`</${tag}>`, gt + 1);
    if (close < 0 || close > end) throw new DomainError('MESH_INVALID', 'File .3mf bị hỏng (thiếu thẻ đóng).', 422);
    yield { attrs, bodyStart: gt + 1, bodyEnd: close };
    index = close + tag.length + 3;
  }
}

export function firstElement(xml: string, tag: string, from: number, end: number, withBody: boolean): ScannedElement | undefined {
  for (const element of scanElements(xml, tag, from, end, withBody)) return element;
  return undefined;
}

type ParseBudget = { triangles: number; vertices: number };

function parseModelFile(xml: string, path: string, objects: Map<string, ModelObject>, budget: ParseBudget) {
  for (const object of scanElements(xml, 'object', 0, xml.length, true)) {
    const id = attr(object.attrs, 'id');
    if (!id) continue;
    const key = `${path}#${id}`;
    const mesh = firstElement(xml, 'mesh', object.bodyStart, object.bodyEnd, true);
    if (mesh) {
      const coords: number[] = [];
      for (const v of scanElements(xml, 'vertex', mesh.bodyStart, mesh.bodyEnd, false)) {
        if (++budget.vertices > MESH_MAX_VERTICES) throw new DomainError('MESH_TOO_LARGE', 'File có quá nhiều đỉnh để ước tính tự động.', 422);
        coords.push(Number(attr(v.attrs, 'x')), Number(attr(v.attrs, 'y')), Number(attr(v.attrs, 'z')));
      }
      const vertexCount = coords.length / 3;
      let signed = 0;
      for (const t of scanElements(xml, 'triangle', mesh.bodyStart, mesh.bodyEnd, false)) {
        if (++budget.triangles > MESH_MAX_TRIANGLES) throw new DomainError('MESH_TOO_LARGE', 'File có quá nhiều tam giác để ước tính tự động.', 422);
        const ia = Number(attr(t.attrs, 'v1')); const ib = Number(attr(t.attrs, 'v2')); const ic = Number(attr(t.attrs, 'v3'));
        if (![ia, ib, ic].every((i) => Number.isInteger(i) && i >= 0 && i < vertexCount)) {
          throw new DomainError('MESH_INVALID', 'File .3mf tham chiếu đỉnh không tồn tại.', 422);
        }
        const a = ia * 3; const b = ib * 3; const c = ic * 3;
        signed += (coords[a] * (coords[b + 1] * coords[c + 2] - coords[b + 2] * coords[c + 1])
          - coords[a + 1] * (coords[b] * coords[c + 2] - coords[b + 2] * coords[c])
          + coords[a + 2] * (coords[b] * coords[c + 1] - coords[b + 1] * coords[c])) / 6;
      }
      objects.set(key, { volumeMm3: Math.abs(signed) });
      continue;
    }
    const components = [...scanElements(xml, 'component', object.bodyStart, object.bodyEnd, false)].map((c) => ({
      path: (attr(c.attrs, 'p:path') ?? path).replace(/^\//, ''),
      objectId: attr(c.attrs, 'objectid') ?? '',
      det: transformDet(attr(c.attrs, 'transform')),
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
  const budget: ParseBudget = { triangles: 0, vertices: 0 };
  for (const [path, data] of Object.entries(files)) parseModelFile(strFromU8(data), path, objects, budget);

  const mainXml = strFromU8(files[mainPath]);
  const modelElement = firstElement(mainXml, 'model', 0, mainXml.length, false);
  const unitScale = UNIT_TO_MM[(attr(modelElement?.attrs ?? '', 'unit') ?? 'millimeter').toLowerCase()] ?? 1;

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

  const build = firstElement(mainXml, 'build', 0, mainXml.length, true);
  let totalMm3 = 0;
  if (build) {
    for (const item of scanElements(mainXml, 'item', build.bodyStart, build.bodyEnd, false)) {
      const objectId = attr(item.attrs, 'objectid');
      if (objectId) totalMm3 += volumeOf(`${mainPath}#${objectId}`, 0) * transformDet(attr(item.attrs, 'transform'));
    }
  }
  const volumeCm3 = (totalMm3 * unitScale ** 3) / 1_000;
  if (!budget.triangles || !Number.isFinite(volumeCm3) || volumeCm3 <= 0) throw new DomainError('MESH_EMPTY', 'Không đọc được hình khối nào trong file .3mf.', 422);
  return { volumeCm3, triangles: budget.triangles };
}
