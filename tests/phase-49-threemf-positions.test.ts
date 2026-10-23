import test from 'node:test';
import assert from 'node:assert/strict';
import { threeMfToPositions } from '../src/lib/stl-import/threemf-mesh';
import { threeMfKeycap } from './fixtures/stl-import/build-fixtures';
import { MeshMetricsError } from '../src/lib/pricing/mesh-metrics';

test('threeMfToPositions extracts valid Float32Array vertex positions from 3MF', () => {
  const bytes = threeMfKeycap();
  const positions = threeMfToPositions(bytes);
  assert.ok(positions instanceof Float32Array);
  // 12 triangles * 3 vertices * 3 coords (x, y, z) = 108 floats
  assert.equal(positions.length, 108);
});

test('threeMfToPositions throws MeshMetricsError for invalid zip or empty model', () => {
  const badBytes = new Uint8Array([1, 2, 3, 4]);
  assert.throws(
    () => threeMfToPositions(badBytes),
    (err: unknown) => err instanceof MeshMetricsError && err.code === 'MESH_INVALID'
  );
});
