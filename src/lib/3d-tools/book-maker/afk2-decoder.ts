import * as THREE from 'three';

export interface UnpackedMesh {
  name: string;
  positions: Float32Array; // 3 floats per vertex (x, y, z)
  indices: Uint32Array;    // 3 indices per triangle
  grid: number;
  origin: [number, number, number];
}

export type UnpackedModelMap = Record<string, UnpackedMesh>;

/**
 * Decodes the AFK2 proprietary binary format used in Book Hub 3D models.
 * Algorithm:
 * 1. Base64 decode string
 * 2. PRNG XOR stream cipher (seed 0x6B3A91C5, 3-step bitshift LFSR)
 * 3. Deflate-raw decompression
 * 4. AFK2 header parse + delta-encoded 16-bit vertex/index unpacking
 */
export async function decodeAfk2Model(base64Text: string): Promise<UnpackedModelMap> {
  const clean = base64Text.trim();
  let binaryBytes: Uint8Array;

  // 1. Base64 decode
  if (typeof atob === 'function') {
    const raw = atob(clean);
    binaryBytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      binaryBytes[i] = raw.charCodeAt(i);
    }
  } else {
    // Node.js fallback
    binaryBytes = new Uint8Array(Buffer.from(clean, 'base64'));
  }

  // 2. PRNG XOR stream cipher
  let seed = 0x6b3a91c5 | 0;
  const xorDecrypted = new Uint8Array(binaryBytes.length);
  for (let i = 0; i < binaryBytes.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    xorDecrypted[i] = binaryBytes[i] ^ (seed & 255);
  }

  // 3. Raw deflate decompression
  let buffer: ArrayBuffer;
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([xorDecrypted]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    buffer = await new Response(stream).arrayBuffer();
  } else {
    // Node.js fallback using zlib
    const zlib = await import('zlib');
    const decompressed = zlib.inflateRawSync(xorDecrypted);
    buffer = decompressed.buffer.slice(decompressed.byteOffset, decompressed.byteOffset + decompressed.byteLength);
  }

  // 4. Parse AFK2 Binary Structure
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer);

  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (magic !== 'AFK2') {
    throw new Error(`Invalid model magic signature: ${magic}, expected AFK2`);
  }

  const meshCount = dv.getUint32(8, true);
  let offset = 12;
  const result: UnpackedModelMap = {};

  for (let m = 0; m < meshCount; m++) {
    const nameLen = u8[offset];
    offset += 1;
    let name = '';
    for (let i = 0; i < nameLen; i++) {
      name += String.fromCharCode(u8[offset + i]);
    }
    offset += nameLen;

    const grid = dv.getFloat32(offset, true);
    const origin: [number, number, number] = [
      dv.getFloat32(offset + 4, true),
      dv.getFloat32(offset + 8, true),
      dv.getFloat32(offset + 12, true),
    ];
    const numVertices = dv.getUint32(offset + 16, true);
    const numTriangles = dv.getUint32(offset + 20, true);
    offset += 24;

    // Delta-encoded 16-bit positions (X, Y, Z interleaved sequentially)
    const positions = new Float32Array(numVertices * 3);
    for (let axis = 0; axis < 3; axis++) {
      let acc = 0;
      for (let i = 0; i < numVertices; i++) {
        acc = (acc + dv.getUint16(offset, true)) & 0xffff;
        offset += 2;
        positions[i * 3 + axis] = origin[axis] + acc * grid;
      }
    }

    // Delta-encoded 16-bit indices
    const indices = new Uint32Array(numTriangles * 3);
    const firstVertex = new Int32Array(numTriangles);
    let a0 = 0;
    for (let i = 0; i < numTriangles; i++) {
      a0 = (a0 + dv.getUint16(offset, true)) & 0xffff;
      offset += 2;
      firstVertex[i] = a0;
      indices[i * 3] = a0;
    }
    for (let i = 0; i < numTriangles; i++) {
      indices[i * 3 + 1] = (firstVertex[i] + dv.getUint16(offset, true)) & 0xffff;
      offset += 2;
    }
    for (let i = 0; i < numTriangles; i++) {
      indices[i * 3 + 2] = (firstVertex[i] + dv.getUint16(offset, true)) & 0xffff;
      offset += 2;
    }

    result[name] = {
      name,
      positions,
      indices,
      grid,
      origin,
    };
  }

  return result;
}

/**
 * Converts an UnpackedMesh into a standard Three.js BufferGeometry.
 */
export function meshToBufferGeometry(mesh: UnpackedMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
