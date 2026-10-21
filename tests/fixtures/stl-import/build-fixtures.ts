// Feature 003: self-made STL fixtures, written into a temp dir by each test (no third-party models,
// no binaries committed). Boxes only — enough for bbox/volume/naming/grouping rules.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
