import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { decodeAfk2Model, meshToBufferGeometry } from '../src/lib/3d-tools/book-maker/afk2-decoder';

test('decodeAfk2Model accurately decodes V-MINI.dat meshes', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-maker/V-MINI.dat');
  assert.equal(fs.existsSync(filePath), true, 'V-MINI.dat must exist in public/models/book-maker');

  const text = fs.readFileSync(filePath, 'utf8');
  const meshes = await decodeAfk2Model(text);

  // V-MINI.dat contains 10 sub-meshes: B-S, B-F, F-S-B, F-S-P, F-F-B, F-F-P, S-S, S-F, P-N, P-F
  const expectedKeys = ['B-S', 'B-F', 'F-S-B', 'F-S-P', 'F-F-B', 'F-F-P', 'S-S', 'S-F', 'P-N', 'P-F'];
  assert.equal(Object.keys(meshes).length, 10);
  for (const key of expectedKeys) {
    assert.equal(key in meshes, true, `Missing expected sub-mesh: ${key}`);
    const m = meshes[key];
    assert.equal(m.positions.length > 0, true);
    assert.equal(m.indices.length > 0, true);
    assert.equal(m.positions.length % 3, 0);
    assert.equal(m.indices.length % 3, 0);

    // Verify Three.js geometry conversion
    const geom = meshToBufferGeometry(m);
    assert.equal(geom.getAttribute('position').count, m.positions.length / 3);
    assert.equal(geom.getIndex()?.count, m.indices.length);
    geom.dispose();
  }
});
