import type * as THREE from 'three';

/** Calculates the absolute enclosed volume of a triangle mesh. Coordinates are expected in mm. */
export function calculateMeshVolumeCm3(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize < 3) return 0;

  const index = geometry.getIndex();
  const triangleCount = index ? index.count / 3 : position.count / 3;
  let signedVolumeMm3 = 0;

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const ai = index ? index.getX(offset) : offset;
    const bi = index ? index.getX(offset + 1) : offset + 1;
    const ci = index ? index.getX(offset + 2) : offset + 2;
    const ax = position.getX(ai); const ay = position.getY(ai); const az = position.getZ(ai);
    const bx = position.getX(bi); const by = position.getY(bi); const bz = position.getZ(bi);
    const cx = position.getX(ci); const cy = position.getY(ci); const cz = position.getZ(ci);
    signedVolumeMm3 += (
      ax * (by * cz - bz * cy)
      - ay * (bx * cz - bz * cx)
      + az * (bx * cy - by * cx)
    ) / 6;
  }

  return Math.abs(signedVolumeMm3) / 1_000;
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
