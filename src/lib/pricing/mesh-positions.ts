// Phase 33 S6: flat xyz triangle positions for the /bao-gia 3D preview (worker-side, transferable).
// Pure; the metrics themselves always come from mesh-metrics.ts.
import { isBinaryStl, MeshMetricsError } from './mesh-metrics';

export function stlPositions(bytes: Uint8Array): Float32Array {
  if (isBinaryStl(bytes)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(80, true);
    const out = new Float32Array(count * 9);
    for (let t = 0; t < count; t += 1) {
      const o = 84 + t * 50 + 12;
      for (let k = 0; k < 9; k += 1) out[t * 9 + k] = view.getFloat32(o + k * 4, true);
    }
    return out;
  }
  const values: number[] = [];
  for (const match of new TextDecoder().decode(bytes).matchAll(/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g)) {
    values.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  return Float32Array.from(values.slice(0, values.length - (values.length % 9)));
}

export function objPositions(bytes: Uint8Array): Float32Array {
  const vertices: number[] = [];
  const out: number[] = [];
  for (const rawLine of new TextDecoder().decode(bytes).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      vertices.push(Number(x), Number(y), Number(z));
    } else if (line.startsWith('f ')) {
      const count = vertices.length / 3;
      const ids = line.split(/\s+/).slice(1).map((token) => { const raw = Number(token.split('/')[0]); return raw < 0 ? count + raw : raw - 1; });
      for (let i = 1; i + 1 < ids.length; i += 1) {
        for (const id of [ids[0], ids[i], ids[i + 1]]) {
          if (!Number.isInteger(id) || id < 0 || id >= count) throw new MeshMetricsError('MESH_INVALID', 'File OBJ tham chiếu đỉnh không tồn tại.');
          out.push(vertices[id * 3], vertices[id * 3 + 1], vertices[id * 3 + 2]);
        }
      }
    }
  }
  return Float32Array.from(out);
}
