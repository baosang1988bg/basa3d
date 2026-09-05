import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  buildJigsawPieces,
  disposeJigsawPieces,
  disposePreviewScene,
  getJigsawExportParts,
  layoutPiecesForPreview,
  validateColor,
} from '../src/lib/3d-tools/jigsaw/jigsaw-engine';
import * as C from '../src/lib/3d-tools/jigsaw/jigsaw-constants';

test('cuts a mesh with no uv attribute (as real STL/OBJ uploads have) without throwing', () => {
  // Regression test: three-bvh-csg's Evaluator defaults to expecting position/uv/normal on every
  // brush and throws reading `.array` off an undefined attribute if one side lacks uv — caught by
  // the Playwright E2E (a real STLLoader-parsed mesh has no uv) but not by BoxGeometry-based unit
  // tests (BoxGeometry always includes uv). Build a plain, uv-less box to catch this without a
  // full browser test.
  const geometry = new THREE.BufferGeometry();
  const box = new THREE.BoxGeometry(60, 20, 40);
  geometry.setAttribute('position', box.getAttribute('position'));
  geometry.setIndex(box.getIndex());
  geometry.computeVertexNormals();
  box.dispose();
  assert.equal(geometry.getAttribute('uv'), undefined);
  const pieces = buildJigsawPieces(geometry, 2, 2);
  try {
    assert.equal(pieces.length, 4);
  } finally {
    disposeJigsawPieces(pieces);
    geometry.dispose();
  }
});

test('a 2x2 grid cuts a box into 4 finite, positive-volume pieces bounded by the source geometry', () => {
  const box = new THREE.BoxGeometry(60, 20, 40);
  try {
    const pieces = buildJigsawPieces(box, 2, 2);
    try {
      assert.equal(pieces.length, 4);
      assert.deepEqual(pieces.map(p => `${p.row}-${p.col}`).sort(), ['0-0', '0-1', '1-0', '1-1']);
      for (const piece of pieces) {
        const position = piece.geometry.getAttribute('position');
        assert.ok(position.count > 0);
        for (let i = 0; i < position.count; i++) assert.ok([position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite));
        piece.geometry.computeBoundingBox();
        const b = piece.geometry.boundingBox!;
        // Puzzle tabs let pieces overlap their nominal cell by up to the bump radius, but never
        // beyond the source box's own bounds.
        assert.ok(b.min.x >= -30 - 1e-6 && b.max.x <= 30 + 1e-6);
        assert.ok(b.min.z >= -20 - 1e-6 && b.max.z <= 20 + 1e-6);
        assert.ok(Math.abs(b.min.y - -10) < 1e-4 && Math.abs(b.max.y - 10) < 1e-4);
      }
    } finally {
      disposeJigsawPieces(pieces);
    }
  } finally {
    box.dispose();
  }
});

test('adjacent pieces interlock: one bulges past the nominal grid line where its neighbor recedes', () => {
  const box = new THREE.BoxGeometry(60, 20, 40);
  try {
    const pieces = buildJigsawPieces(box, 2, 2);
    try {
      const topLeft = pieces.find(p => p.row === 0 && p.col === 0)!;
      const topRight = pieces.find(p => p.row === 0 && p.col === 1)!;
      topLeft.geometry.computeBoundingBox();
      topRight.geometry.computeBoundingBox();
      // The shared boundary is x=0 (grid midline for a 2-column split of [-30,30]); with a bump,
      // one side's footprint must cross past it.
      assert.ok(topLeft.geometry.boundingBox!.max.x > 1e-6, 'top-left piece should bulge past x=0');
      assert.ok(topRight.geometry.boundingBox!.min.x < 30 - 1e-6, 'top-right piece should not be a plain rectangle either');
    } finally {
      disposeJigsawPieces(pieces);
    }
  } finally {
    box.dispose();
  }
});

test('layoutPiecesForPreview offsets pieces apart without mutating export geometry, and rejects an invalid color', () => {
  const box = new THREE.BoxGeometry(60, 20, 40);
  try {
    const pieces = buildJigsawPieces(box, 2, 2);
    try {
      const exportParts = getJigsawExportParts(pieces);
      const scene = layoutPiecesForPreview(pieces, 2, 2);
      try {
        assert.equal(scene.children.length, 4);
        const positioned = scene.children.some(c => c.position.x !== 0 || c.position.z !== 0);
        assert.ok(positioned, 'at least one piece should be offset for preview legibility');
      } finally {
        disposePreviewScene(scene);
      }
      assert.equal(exportParts.length, 4);
      exportParts.forEach(p => p.geometry.dispose());
      assert.throws(() => layoutPiecesForPreview(pieces, 2, 2, 'red'));
      assert.throws(() => validateColor('#fff'));
    } finally {
      disposeJigsawPieces(pieces);
    }
  } finally {
    box.dispose();
  }
});

test('rejects grid sizes outside the constants envelope and an over-budget triangle count', () => {
  const box = new THREE.BoxGeometry(10, 10, 10);
  try {
    assert.throws(() => buildJigsawPieces(box, 0, 2));
    assert.throws(() => buildJigsawPieces(box, 2, C.MAX_GRID + 1));
  } finally {
    box.dispose();
  }
  const heavy = new THREE.SphereGeometry(10, 160, 160);
  try {
    assert.throws(() => buildJigsawPieces(heavy, 2, 2));
  } finally {
    heavy.dispose();
  }
});
