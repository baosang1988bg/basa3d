// Feature 003: self-made STL fixtures, written into a temp dir by each test (no third-party models,
// no binaries committed). Boxes only — enough for bbox/volume/naming/grouping rules.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';

type Vec = [number, number, number];

/** 12 outward-facing triangles of an axis-aligned box. */
export function boxTriangles(min: Vec, max: Vec): Vec[][] {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const v: Vec[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return faces.map((face) => face.map((index) => v[index]));
}

export function binaryStl(triangles: Vec[][]): Buffer {
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.write('basa3d fixture', 0, 'ascii');
  buffer.writeUInt32LE(triangles.length, 80);
  triangles.forEach((triangle, t) => {
    const offset = 84 + t * 50 + 12;
    triangle.forEach((vertex, k) => vertex.forEach((value, axis) => buffer.writeFloatLE(value, offset + (k * 3 + axis) * 4)));
  });
  return buffer;
}

export function asciiStl(triangles: Vec[][]): string {
  const facets = triangles.map((triangle) => `  facet normal 0 0 0\n    outer loop\n${triangle.map((v) => `      vertex ${v.join(' ')}`).join('\n')}\n    endloop\n  endfacet`);
  return `solid fixture\n${facets.join('\n')}\nendsolid fixture\n`;
}

export const FIXTURE_LAYOUT = {
  catFolder: 'Figures/Cat',
  frog: 'Figures/Ếch_xanh_v2.stl',
  numeric: 'Tools/12345.stl',
  rootCube: 'root-cube.stl',
  empty: 'Broken/empty.stl',
  garbage: 'Broken/garbage.stl',
  coin: 'Tiny/coin.stl',
} as const;

export async function buildStlFixtures(dir: string): Promise<void> {
  const write = async (relPath: string, content: string | Buffer) => {
    const absolute = path.join(dir, relPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  };
  await write('Figures/Cat/cat-body.stl', binaryStl(boxTriangles([0, 0, 0], [30, 20, 25])));
  await write('Figures/Cat/cat-tail.stl', binaryStl(boxTriangles([28, 5, 5], [45, 10, 10])));
  // NFD on purpose: macOS hands out decomposed names; the importer must normalise to NFC.
  await write('Figures/Ếch_xanh_v2.stl'.normalize('NFD'), asciiStl(boxTriangles([0, 0, 0], [20, 15, 12])));
  await write('Tools/12345.stl', binaryStl(boxTriangles([0, 0, 0], [50, 40, 10])));
  await write('root-cube.stl', binaryStl(boxTriangles([0, 0, 0], [10, 10, 10])));
  await write('Broken/empty.stl', Buffer.alloc(0));
  await write('Broken/garbage.stl', Buffer.from('this is not a mesh \u0000\u0001\u0002'));
  await write('Tiny/coin.stl', binaryStl(boxTriangles([0, 0, 0], [3, 3, 1])));
  await write('Figures/readme.txt', 'not a model');
}

/** A 3MF mesh object: the 8 corners of a box and its 12 triangles, as <object> XML. */
export function threeMfBoxObject(id: number, min: Vec, max: Vec): string {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const v: Vec[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return `<object id="${id}" type="model"><mesh><vertices>${v.map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join('')}</vertices>`
    + `<triangles>${faces.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join('')}</triangles></mesh></object>`;
}

/**
 * Zip a 3MF package. `model` is the body of 3D/3dmodel.model (<resources>…</resources><build>…</build>);
 * `extra` adds more entries (e.g. Bambu's 3D/Objects/*.model, or the embedded thumbnails the importer must ignore).
 */
export function threeMf(model: string, options: { unit?: string; extra?: Record<string, string | Uint8Array> } = {}): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><model unit="${options.unit ?? 'millimeter'}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">${model}</model>`;
  const entries: Record<string, Uint8Array> = { '[Content_Types].xml': strToU8('<Types/>'), '3D/3dmodel.model': strToU8(xml) };
  for (const [name, value] of Object.entries(options.extra ?? {})) entries[name] = typeof value === 'string' ? strToU8(value) : value;
  return Buffer.from(zipSync(entries));
}

/** A 20 × 20 × 10 mm box as a plain 3MF (with author thumbnails that must never be used). */
export function threeMfKeycap(): Buffer {
  return threeMf(`<resources>${threeMfBoxObject(1, [0, 0, 0], [20, 20, 10])}</resources><build><item objectid="1"/></build>`, {
    extra: { 'Auxiliaries/.thumbnails/thumbnail_3mf.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'Metadata/plate_1.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
  });
}

export const THREE_MF_LAYOUT = {
  mixed: 'KeyCap3D/Mixed set',
  only3mf: 'KeyCap3D/Gengar',
  broken: 'KeyCap3D/Broken 3mf',
} as const;

/** A KeyCap3D-like library: a folder mixing .stl + .3mf, a .3mf-only folder, a broken .3mf, and non-model files. */
export async function buildThreeMfFixtures(dir: string): Promise<void> {
  const write = async (relPath: string, content: string | Buffer) => {
    const absolute = path.join(dir, relPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  };
  await write('KeyCap3D/Mixed set/base.stl', binaryStl(boxTriangles([0, 0, 0], [18, 18, 8])));
  await write('KeyCap3D/Mixed set/cap.3mf', threeMf(`<resources>${threeMfBoxObject(1, [0, 0, 0], [18, 18, 6])}</resources><build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 8"/></build>`));
  await write('KeyCap3D/Gengar/gengar-keycap.3mf', threeMfKeycap());
  await write('KeyCap3D/Gengar/cover.jpg', 'jpeg');
  await write('KeyCap3D/Gengar/notes.txt', 'print at 0.12 mm');
  await write('KeyCap3D/Broken 3mf/broken.3mf', 'PK not really a zip');
  await write('KeyCap3D/Mixed set/preview.png', 'png');
}
