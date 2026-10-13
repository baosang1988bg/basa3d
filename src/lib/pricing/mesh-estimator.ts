import type * as THREE from 'three';
import { computeMeshMetrics } from './mesh-metrics';

/** Calculates the absolute enclosed volume of a triangle mesh. Coordinates are expected in mm.
 * Phase 33 S3: thin wrapper over the shared computeMeshMetrics (mesh-metrics.ts). */
export function calculateMeshVolumeCm3(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize < 3 || position.count === 0) return 0;
  const index = geometry.getIndex();
  let positions: ArrayLike<number> = position.array;
  // Interleaved / non-xyz-packed attributes: copy out x, y, z per vertex.
  if (position.array.length !== position.count * 3) {
    const packed = new Float64Array(position.count * 3);
    for (let i = 0; i < position.count; i += 1) {
      packed[i * 3] = position.getX(i); packed[i * 3 + 1] = position.getY(i); packed[i * 3 + 2] = position.getZ(i);
    }
    positions = packed;
  }
  return computeMeshMetrics(positions, index ? index.array : null).volumeMm3 / 1_000;
}

export function estimateMeshWeightGrams(volumeCm3: number, densityGramsPerCm3 = 1.24): number {
  if (!Number.isFinite(volumeCm3) || volumeCm3 < 0) throw new RangeError('volumeCm3 must be finite and non-negative.');
  if (!Number.isFinite(densityGramsPerCm3) || densityGramsPerCm3 <= 0) throw new RangeError('densityGramsPerCm3 must be finite and positive.');
  return volumeCm3 * densityGramsPerCm3;
}

export function estimatePrintMinutes(weightGrams: number): number {
  if (!Number.isFinite(weightGrams) || weightGrams < 0) throw new RangeError('weightGrams must be finite and non-negative.');
  return 12 + weightGrams * 1.8;
}
