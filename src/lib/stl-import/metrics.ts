// Feature 003 (FR-003, research R5): measure a (multi-part) model. Never throws for a bad mesh — the
// batch must keep going (FR-003), so failures come back as `{ ok: false }`.
import {
  accumulateStl, checkMeshConsistency, MESH_MAX_TRIANGLES, MeshMetricsAccumulator, MeshMetricsError, type MeshMetrics,
} from '../pricing/mesh-metrics';
import { threeMfToBinaryStl } from './threemf-mesh';

export const UNIT_TOO_SMALL_MM = 5;
export const UNIT_TOO_LARGE_MM = 400;
export const PARTS_OVERLAP_RATIO = 0.8;

export type ImportWarning = 'UNIT_TOO_SMALL' | 'UNIT_TOO_LARGE' | 'MESH_NOT_WATERTIGHT' | 'PARTS_OVERLAP' | 'UNPRICED' | 'OVERSIZE_SKIPPED_PART';

export type ModelAnalysis =
  | {
      ok: true;
      metrics: MeshMetrics;
      bboxMm: { x: number; y: number; z: number };
      volumeCm3: number;
      triangles: number;
      warnings: ImportWarning[];
    }
  | { ok: false; error: string };

type Box = { min: [number, number, number]; max: [number, number, number] };

function boxVolume(box: Box): number {
  return Math.max(0, box.max[0] - box.min[0]) * Math.max(0, box.max[1] - box.min[1]) * Math.max(0, box.max[2] - box.min[2]);
}

function overlapVolume(a: Box, b: Box): number {
  let volume = 1;
  for (let axis = 0; axis < 3; axis += 1) {
    const extent = Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
    if (extent <= 0) return 0;
    volume *= extent;
  }
  return volume;
}

function failure(relPath: string, error: unknown): string {
  const message = error instanceof MeshMetricsError ? `${error.code}: ${error.message}` : `MESH_INVALID: ${(error as Error).message}`;
  return `${relPath} — ${message}`;
}

/**
 * .3mf parts become binary STL (their build plate, in mm) so measuring and rendering share one path;
 * .stl parts pass through. An unreadable .3mf fails the model (→ process_error), never the batch.
 */
export function toStlParts<T extends { relPath: string; bytes: Uint8Array }>(parts: T[]): { ok: true; parts: T[] } | { ok: false; error: string } {
  const out: T[] = [];
  for (const part of parts) {
    if (!/\.3mf$/i.test(part.relPath)) {
      out.push(part);
      continue;
    }
    try {
      out.push({ ...part, bytes: threeMfToBinaryStl(part.bytes) });
    } catch (error) {
      return { ok: false, error: failure(part.relPath, error) };
    }
  }
  return { ok: true, parts: out };
}

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

export function analyzeModel(parts: { relPath: string; bytes: Uint8Array }[]): ModelAnalysis {
  if (!parts.length) return { ok: false, error: 'Không có file STL/3MF hợp lệ trong mẫu.' };
  const boxes: Box[] = [];
  let volumeMm3 = 0;
  let surfaceMm2 = 0;
  let triangles = 0;
  let watertight = true;
  for (const part of parts) {
    try {
      const acc = accumulateStl(part.bytes, new MeshMetricsAccumulator(MESH_MAX_TRIANGLES));
      const metrics = acc.result();
      if (!checkMeshConsistency(metrics).ok) watertight = false;
      volumeMm3 += metrics.volumeMm3;
      surfaceMm2 += metrics.surfaceMm2;
      triangles += metrics.triangles;
      boxes.push(acc.bounds());
    } catch (error) {
      return { ok: false, error: failure(part.relPath, error) };
    }
  }
  if (triangles > MESH_MAX_TRIANGLES) return { ok: false, error: 'MESH_TOO_LARGE: mẫu có quá nhiều tam giác.' };

  const union: Box = {
    min: [0, 1, 2].map((axis) => Math.min(...boxes.map((box) => box.min[axis]))) as Box['min'],
    max: [0, 1, 2].map((axis) => Math.max(...boxes.map((box) => box.max[axis]))) as Box['max'],
  };
  const sizeMm = { x: union.max[0] - union.min[0], y: union.max[1] - union.min[1], z: union.max[2] - union.min[2] };
  const warnings: ImportWarning[] = [];
  const longest = Math.max(sizeMm.x, sizeMm.y, sizeMm.z);
  if (longest < UNIT_TOO_SMALL_MM) warnings.push('UNIT_TOO_SMALL');
  if (longest > UNIT_TOO_LARGE_MM) warnings.push('UNIT_TOO_LARGE');
  if (!watertight) warnings.push('MESH_NOT_WATERTIGHT');
  if (boxes.length > 1 && boxes.some((a, i) => boxes.slice(i + 1).some((b) => {
    const smaller = Math.min(boxVolume(a), boxVolume(b));
    return smaller > 0 && overlapVolume(a, b) / smaller > PARTS_OVERLAP_RATIO;
  }))) warnings.push('PARTS_OVERLAP');

  return {
    ok: true,
    metrics: { volumeMm3, surfaceMm2, sizeMm, triangles },
    bboxMm: { x: round(sizeMm.x, 1), y: round(sizeMm.y, 1), z: round(sizeMm.z, 1) },
    volumeCm3: round(volumeMm3 / 1000, 3),
    triangles,
    warnings,
  };
}
