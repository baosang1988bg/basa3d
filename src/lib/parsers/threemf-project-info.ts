// Phase 40 (ADR-0043): multi-color information from an UNSLICED Bambu Studio / Orca project `.3mf`,
// used to estimate AMS purge ("nhựa xả đổi màu") and color-change time — which the plain volume
// estimate ignored, badly under-pricing small multi-color models (e.g. a 4-color keycap).
//
// Read, all optional:
//   Metadata/project_settings.config (JSON) — filament_colour / filament_type, flush_volumes_matrix,
//     flush_multiplier, layer_height, enable_prime_tower, prime_volume, printer_model
//   Metadata/model_settings.config (XML)    — per object/part `extruder`, object → plate mapping
//   3D/**.model                             — geometry + per-triangle MMU painting (`paint_color`)
//
// Output per plate: the filaments used and an estimate of color changes = Σ over layers of
// (number of filaments present in that layer − 1). Exact order/count is only known to a slicer, so
// this is an ESTIMATE; a sliced file (slice_info.config) always wins over it.
//
// Never throws: any missing/odd field degrades to "no project info" (null) or a field default, so a
// file this parser doesn't understand prices exactly as before. Bounded like the other parsers
// (Phase 35 D4): config entries ≤ 8 MB, total `.model` XML ≤ MAX_3MF_UNZIPPED_BYTES, ≤ MESH_MAX_TRIANGLES.
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { MAX_3MF_UNZIPPED_BYTES, MESH_MAX_TRIANGLES, attr, firstElement, scanElements } from './mesh-volume';

export const MAX_PROJECT_CONFIG_BYTES = 8 * 1024 * 1024;
/** Layers are bucketed on this grid when the project has no layer_height. */
export const DEFAULT_LAYER_HEIGHT_MM = 0.2;
const MAX_LAYERS = 20_000; // 400 mm at 0.02 mm — anything beyond is treated as unknown geometry
const MAX_FILAMENTS = 32;
const PROJECT_SETTINGS = 'metadata/project_settings.config';
const MODEL_SETTINGS = 'metadata/model_settings.config';

export type ThreeMfProjectPlate = {
  index: number;
  /** 1-based filament (extruder) numbers used on this plate, sorted. */
  filaments: number[];
  /** Σ over layers of (filaments present − 1). */
  colorChanges: number;
  /** Layers containing ≥ 2 filaments. */
  multiColorLayers: number;
  sizeMm: { x: number; y: number; z: number } | null;
};

export type ThreeMfProjectInfo = {
  filamentColors: string[];
  filamentTypes: string[];
  layerHeightMm: number | null;
  /** flush_volumes_matrix[from][to] in mm³ (0-based), null when absent/malformed. */
  flushMatrix: number[][] | null;
  flushMultiplier: number;
  primeTowerEnabled: boolean;
  primeVolumeMm3: number | null;
  printerModel: string | null;
  plates: ThreeMfProjectPlate[];
};

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: false });

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function firstValue(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' || typeof v === 'number' ? String(v) : undefined;
}

function num(value: unknown): number | null {
  const n = Number(firstValue(value));
  return Number.isFinite(n) ? n : null;
}

function stringList(value: unknown): string[] {
  return toArray(value as unknown[]).map((v) => String(v ?? '')).slice(0, MAX_FILAMENTS);
}

function flushMatrixOf(raw: unknown, filamentCount: number): number[][] | null {
  const flat = toArray(raw as unknown[]).map(Number);
  const n = filamentCount;
  if (n < 2 || flat.length < n * n || flat.slice(0, n * n).some((v) => !Number.isFinite(v) || v < 0)) return null;
  return Array.from({ length: n }, (_, i) => flat.slice(i * n, i * n + n));
}

/**
 * Bambu/Prusa TriangleSelector serialization: hex nibbles read from the END of the string.
 * A nibble with low 2 bits ≠ 0 is a split node (skip); a leaf nibble's high 2 bits are the state,
 * and state 3 means "3 + next nibble". State 0 = not painted (part default), k = extruder k.
 */
export function decodePaintStates(paint: string): Set<number> {
  const states = new Set<number>();
  for (let i = paint.length - 1; i >= 0; i -= 1) {
    const nibble = parseInt(paint[i], 16);
    if (Number.isNaN(nibble)) return new Set();
    if ((nibble & 0b11) !== 0) continue;
    let state = nibble >> 2;
    if (state === 3) {
      i -= 1;
      const extra = i >= 0 ? parseInt(paint[i], 16) : NaN;
      if (Number.isNaN(extra)) return states;
      state = 3 + extra;
    }
    states.add(state);
  }
  return states;
}

type Mat = number[]; // 3MF 4x3 row-major: (m00 m01 m02)(m10 m11 m12)(m20 m21 m22)(m30 m31 m32)
const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parseTransform(value: string | undefined): Mat {
  if (!value) return IDENTITY;
  const m = value.trim().split(/\s+/).map(Number);
  return m.length === 12 && m.every(Number.isFinite) ? m : IDENTITY;
}

/** a then b (row-vector convention: p' = p·A·B). */
function compose(a: Mat, b: Mat): Mat {
  const r: Mat = new Array(12).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      let s = row === 3 ? b[9 + col] : 0;
      for (let k = 0; k < 3; k += 1) s += a[row * 3 + k] * b[k * 3 + col];
      r[row * 3 + col] = s;
    }
  }
  return r;
}

function apply(m: Mat, x: number, y: number, z: number): [number, number, number] {
  return [
    x * m[0] + y * m[3] + z * m[6] + m[9],
    x * m[1] + y * m[4] + z * m[7] + m[10],
    x * m[2] + y * m[5] + z * m[8] + m[11],
  ];
}

type MeshObject = { vertices: Float64Array; triangles: { v: [number, number, number]; paint: string | null }[] };
type ComponentRef = { path: string; objectId: string; transform: Mat };
type ModelEntry = { mesh?: MeshObject; components?: ComponentRef[] };

function parseModels(files: Record<string, string>, budget: { triangles: number }): Map<string, ModelEntry> {
  const entries = new Map<string, ModelEntry>();
  for (const [path, xml] of Object.entries(files)) {
    const resources = firstElement(xml, 'resources', 0, xml.length, true);
    if (!resources) continue;
    for (const object of scanElements(xml, 'object', resources.bodyStart, resources.bodyEnd, true)) {
      const id = attr(object.attrs, 'id');
      if (!id) continue;
      const key = `${path}#${id}`;
      const mesh = firstElement(xml, 'mesh', object.bodyStart, object.bodyEnd, true);
      if (mesh) {
        const coords: number[] = [];
        for (const v of scanElements(xml, 'vertex', mesh.bodyStart, mesh.bodyEnd, false)) {
          coords.push(Number(attr(v.attrs, 'x')), Number(attr(v.attrs, 'y')), Number(attr(v.attrs, 'z')));
        }
        const triangles: MeshObject['triangles'] = [];
        for (const t of scanElements(xml, 'triangle', mesh.bodyStart, mesh.bodyEnd, false)) {
          if (++budget.triangles > MESH_MAX_TRIANGLES) throw new Error('too many triangles');
          triangles.push({
            v: [Number(attr(t.attrs, 'v1')), Number(attr(t.attrs, 'v2')), Number(attr(t.attrs, 'v3'))],
            paint: attr(t.attrs, 'paint_color') ?? attr(t.attrs, 'slic3rpe:mmu_segmentation') ?? null,
          });
        }
        entries.set(key, { mesh: { vertices: Float64Array.from(coords), triangles } });
        continue;
      }
      const components: ComponentRef[] = [];
      for (const c of scanElements(xml, 'component', object.bodyStart, object.bodyEnd, false)) {
        const objectId = attr(c.attrs, 'objectid');
        if (!objectId) continue;
        components.push({ path: (attr(c.attrs, 'p:path') ?? `/${path}`).replace(/^\//, '').toLowerCase(), objectId, transform: parseTransform(attr(c.attrs, 'transform')) });
      }
      entries.set(key, { components });
    }
  }
  return entries;
}

type ObjectSettings = { extruder: number | null; parts: Map<string, number> };

function parseModelSettings(xml: string | undefined): { objects: Map<string, ObjectSettings>; plateOf: Map<string, number> } {
  const objects = new Map<string, ObjectSettings>();
  const plateOf = new Map<string, number>();
  if (!xml) return { objects, plateOf };
  const doc = xmlParser.parse(xml) as { config?: { object?: unknown; plate?: unknown } };
  const metaValue = (meta: unknown, key: string) =>
    toArray(meta as Record<string, unknown>[]).find((m) => m?.['@_key'] === key)?.['@_value'];
  for (const object of toArray(doc.config?.object as Record<string, unknown>[])) {
    const id = String(object['@_id'] ?? '');
    if (!id) continue;
    const parts = new Map<string, number>();
    for (const part of toArray(object.part as Record<string, unknown>[])) {
      const extruder = Number(metaValue(part.metadata, 'extruder'));
      if (part['@_id'] !== undefined && Number.isInteger(extruder) && extruder > 0) parts.set(String(part['@_id']), extruder);
    }
    const extruder = Number(metaValue(object.metadata, 'extruder'));
    objects.set(id, { extruder: Number.isInteger(extruder) && extruder > 0 ? extruder : null, parts });
  }
  for (const [i, plate] of toArray(doc.config?.plate as Record<string, unknown>[]).entries()) {
    const index = Number(metaValue(plate.metadata, 'plater_id')) || i + 1;
    for (const instance of toArray(plate.model_instance as Record<string, unknown>[])) {
      const objectId = metaValue(instance.metadata, 'object_id');
      if (objectId !== undefined) plateOf.set(String(objectId), index);
    }
  }
  return { objects, plateOf };
}

type PlateAccumulator = {
  intervals: Map<number, number[]>; // filament → [zmin, zmax, zmin, zmax, …]
  min: [number, number, number];
  max: [number, number, number];
};

export function parseThreeMfProjectInfo(bytes: Uint8Array): ThreeMfProjectInfo | null {
  try {
    let modelBytes = 0;
    const raw = unzipSync(bytes, {
      filter: (file) => {
        const name = file.name.toLowerCase();
        if (name === PROJECT_SETTINGS || name === MODEL_SETTINGS) return file.originalSize <= MAX_PROJECT_CONFIG_BYTES;
        if (!name.endsWith('.model')) return false;
        modelBytes += file.originalSize;
        if (modelBytes > MAX_3MF_UNZIPPED_BYTES) throw new Error('3mf too large');
        return true;
      },
    });
    const files = new Map(Object.entries(raw).map(([name, data]) => [name.toLowerCase(), data]));
    const projectRaw = files.get(PROJECT_SETTINGS);
    if (!projectRaw) return null; // not a Bambu/Orca project → no color info, price as before
    const settings = JSON.parse(strFromU8(projectRaw)) as Record<string, unknown>;
    const filamentColors = stringList(settings.filament_colour);
    const filamentTypes = stringList(settings.filament_type).map((t) => t.trim().toUpperCase());
    const filamentCount = Math.max(filamentColors.length, filamentTypes.length, 1);
    const layerHeight = num(settings.layer_height);
    const layerHeightMm = layerHeight && layerHeight > 0 && layerHeight <= 2 ? layerHeight : null;

    const modelXml: Record<string, string> = {};
    for (const [name, data] of files) if (name.endsWith('.model')) modelXml[name] = strFromU8(data);
    const mainPath = '3d/3dmodel.model';
    const mainXml = modelXml[mainPath];
    if (!mainXml) return null;
    const models = parseModels(modelXml, { triangles: 0 });
    const { objects, plateOf } = parseModelSettings(files.get(MODEL_SETTINGS) ? strFromU8(files.get(MODEL_SETTINGS)!) : undefined);

    const plates = new Map<number, PlateAccumulator>();
    const accumulatorFor = (index: number) => {
      let acc = plates.get(index);
      if (!acc) {
        acc = { intervals: new Map(), min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
        plates.set(index, acc);
      }
      return acc;
    };

    const walk = (key: string, transform: Mat, extruder: number, settingsOf: ObjectSettings | undefined, acc: PlateAccumulator, depth: number) => {
      if (depth > 16) return;
      const entry = models.get(key);
      if (!entry) return;
      if (entry.components) {
        for (const c of entry.components) {
          const partExtruder = settingsOf?.parts.get(c.objectId) ?? extruder;
          walk(`${c.path}#${c.objectId}`, compose(c.transform, transform), partExtruder, settingsOf, acc, depth + 1);
        }
        return;
      }
      const mesh = entry.mesh!;
      for (const triangle of mesh.triangles) {
        let zmin = Infinity;
        let zmax = -Infinity;
        for (const vi of triangle.v) {
          if (!Number.isInteger(vi) || vi < 0 || vi * 3 + 2 >= mesh.vertices.length) return; // broken mesh → ignore object
          const p = apply(transform, mesh.vertices[vi * 3], mesh.vertices[vi * 3 + 1], mesh.vertices[vi * 3 + 2]);
          for (let axis = 0; axis < 3; axis += 1) {
            if (p[axis] < acc.min[axis]) acc.min[axis] = p[axis];
            if (p[axis] > acc.max[axis]) acc.max[axis] = p[axis];
          }
          if (p[2] < zmin) zmin = p[2];
          if (p[2] > zmax) zmax = p[2];
        }
        const states = triangle.paint ? decodePaintStates(triangle.paint) : new Set([0]);
        if (!states.size) states.add(0);
        for (const state of states) {
          const filament = state === 0 ? extruder : state;
          if (filament < 1 || filament > MAX_FILAMENTS) continue;
          let list = acc.intervals.get(filament);
          if (!list) acc.intervals.set(filament, (list = []));
          list.push(zmin, zmax);
        }
      }
    };

    const build = firstElement(mainXml, 'build', 0, mainXml.length, true);
    if (!build) return null;
    for (const item of scanElements(mainXml, 'item', build.bodyStart, build.bodyEnd, false)) {
      const objectId = attr(item.attrs, 'objectid');
      if (!objectId) continue;
      const settingsOf = objects.get(objectId);
      walk(`${mainPath}#${objectId}`, parseTransform(attr(item.attrs, 'transform')), settingsOf?.extruder ?? 1, settingsOf, accumulatorFor(plateOf.get(objectId) ?? 1), 0);
    }

    const grid = layerHeightMm ?? DEFAULT_LAYER_HEIGHT_MM;
    const platesOut: ThreeMfProjectPlate[] = [];
    for (const [index, acc] of [...plates.entries()].sort((a, b) => a[0] - b[0])) {
      if (!acc.intervals.size || !Number.isFinite(acc.min[2])) continue;
      const base = acc.min[2];
      const layers = Math.min(MAX_LAYERS, Math.max(1, Math.ceil((acc.max[2] - base) / grid)));
      // Difference array per filament: which layers contain that filament anywhere on the plate.
      const presence = new Int32Array(layers);
      for (const list of acc.intervals.values()) {
        const diff = new Int32Array(layers + 1);
        for (let i = 0; i < list.length; i += 2) {
          const from = Math.min(layers - 1, Math.max(0, Math.floor((list[i] - base) / grid)));
          const to = Math.min(layers - 1, Math.max(from, Math.ceil((list[i + 1] - base) / grid) - 1));
          diff[from] += 1;
          diff[to + 1] -= 1;
        }
        let running = 0;
        for (let l = 0; l < layers; l += 1) {
          running += diff[l];
          if (running > 0) presence[l] += 1;
        }
      }
      let colorChanges = 0;
      let multiColorLayers = 0;
      for (const count of presence) {
        if (count > 1) {
          colorChanges += count - 1;
          multiColorLayers += 1;
        }
      }
      const size = (axis: number) => Math.round((acc.max[axis] - acc.min[axis]) * 10) / 10;
      platesOut.push({
        index,
        filaments: [...acc.intervals.keys()].sort((a, b) => a - b),
        colorChanges,
        multiColorLayers,
        sizeMm: { x: size(0), y: size(1), z: size(2) },
      });
    }
    if (!platesOut.length) return null;

    const multiplier = num(settings.flush_multiplier);
    const primeVolume = num(settings.prime_volume);
    return {
      filamentColors,
      filamentTypes,
      layerHeightMm,
      flushMatrix: flushMatrixOf(settings.flush_volumes_matrix, filamentCount),
      flushMultiplier: multiplier && multiplier > 0 && multiplier <= 3 ? multiplier : 1,
      primeTowerEnabled: firstValue(settings.enable_prime_tower) !== '0',
      primeVolumeMm3: primeVolume !== null && primeVolume >= 0 && primeVolume <= 1000 ? primeVolume : null,
      printerModel: firstValue(settings.printer_model) ?? null,
      plates: platesOut,
    };
  } catch {
    return null; // anything unexpected → behave exactly as before (volume-only estimate)
  }
}
