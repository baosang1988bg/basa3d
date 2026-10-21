import * as THREE from 'three';
import { write3mf, type ExportPart } from '../common/3mf-writer';
import type { MeshArrays } from './organizer-geometry';

/** Binary STL straight from indexed arrays (no three.js round trip). */
export function meshToStl(mesh: MeshArrays): Blob {
  const { positions, indices } = mesh;
  const triangles = indices.length / 3;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triangles, true);
  let offset = 84;
  const vertex = (i: number) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]] as const;
  for (let t = 0; t < triangles; t++) {
    const a = vertex(indices[t * 3]), b = vertex(indices[t * 3 + 1]), c = vertex(indices[t * 3 + 2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length; ny /= length; nz /= length;
    for (const value of [nx, ny, nz, ...a, ...b, ...c]) { view.setFloat32(offset, value, true); offset += 4; }
    view.setUint16(offset, 0, true); offset += 2;
  }
  return new Blob([buffer], { type: 'model/stl' });
}

export function meshToGeometry(mesh: MeshArrays): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function to3mf(parts: { mesh: MeshArrays; colorHex: string; name: string }[], assemblyName: string): Blob {
  const exportParts: ExportPart[] = parts.map((part) => ({ geometry: meshToGeometry(part.mesh), colorHex: part.colorHex, name: part.name }));
  try {
    return new Blob([new Uint8Array(write3mf(exportParts, assemblyName))], { type: 'model/3mf' });
  } finally {
    exportParts.forEach((part) => part.geometry.dispose());
  }
}

/** Snap-on label as two colored objects (plate + embossed text), as in the reference. */
export function labelTo3mf(label: { plate: MeshArrays; text: MeshArrays | null }, plateColor: string, textColor: string): Blob {
  const parts = [{ mesh: label.plate, colorHex: plateColor, name: 'label-plate' }];
  if (label.text) parts.push({ mesh: label.text, colorHex: textColor, name: 'label-text' });
  return to3mf(parts, 'Organizer label');
}

/** Bin + label in one 3MF for the Custom Request attachment (one file per request). */
export function binWithLabelTo3mf(bin: MeshArrays, binColor: string, label: { plate: MeshArrays; text: MeshArrays | null }, plateColor: string, textColor: string): Blob {
  const parts = [
    { mesh: bin, colorHex: binColor, name: 'bin' },
    { mesh: label.plate, colorHex: plateColor, name: 'label-plate' },
  ];
  if (label.text) parts.push({ mesh: label.text, colorHex: textColor, name: 'label-text' });
  return to3mf(parts, 'Organizer bin');
}

export function slug(text: string): string {
  return (text || 'label').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'label';
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = fileName; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
