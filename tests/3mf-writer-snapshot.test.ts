// ADR-0051: the 3MF writer gained an opt-in Bambu metadata mode. These golden SHA-256 digests were
// recorded from the writer *before* that change, so every existing tool must keep exporting the exact
// same bytes. Date and TZ are pinned because fflate stamps a DOS mtime (local time) into each entry.
process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';
import * as THREE from 'three';
import * as opentype from 'opentype.js';
import Module from 'manifold-3d';
import { write3mf, exportBlocksStlZip } from '../src/lib/3d-tools/common/3mf-writer';
import { disposeLampShadeScene, generateLampShadeScene, getLampShadeExportParts } from '../src/lib/3d-tools/lamp-shade/lamp-shade-engine';
import { generateDualTextScene, getDualTextExportParts, disposeDualTextScene } from '../src/lib/3d-tools/dual-text/dual-text-engine';
import { generateCarNameplateScene, getCarExportParts, disposeCarScene } from '../src/lib/3d-tools/car-nameplate/car-nameplate-engine';
import { generateHingeBoxScene, getHingeBoxExportParts, disposeHingeBoxScene } from '../src/lib/3d-tools/hinge-box/hinge-box-engine';
import { buildJigsawPieces, disposeJigsawPieces, getJigsawExportParts } from '../src/lib/3d-tools/jigsaw/jigsaw-engine';
import { generateKeychainBlocksScene, getBlocksExportParts, disposeBlocksScene } from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-engine';
import { buildOrganizer, type ManifoldApi } from '../src/lib/3d-tools/organizer/organizer-geometry';
import { binWithLabelTo3mf, labelTo3mf } from '../src/lib/3d-tools/organizer/organizer-export';
import { DEFAULT_LABEL_PARAMS, DEFAULT_ORGANIZER_PARAMS, normalizeOrganizerParams } from '../src/lib/3d-tools/organizer/organizer-params';

const FIXED_NOW = Date.UTC(2026, 9, 22, 8, 0, 0);
const GOLDEN: Record<string, string> = {
  'lamp-shade.3mf': 'd6e2bb86262fc725d8acf75cd145a7bf41107ae118966f3d340b39c1b840a4df',
  'dual-text.3mf': 'c5d25373ce59940adc4efeec3184aabab6349a4aba37695ec87197c6a001cdaf',
  'car-nameplate.3mf': '5e767b95678778c266e308197c61139371045075357e6da28417aee2898e903e',
  'hinge-box.3mf': '08a272a6a74682f8b53a79a85caf632772191330757ccf3ef286151f3ada945e',
  'jigsaw.3mf': 'ca64fddff534abb635ce3f0af3d25ae319a528923fdad0cefde4d4d8a1e86a9d',
  'jigsaw.zip': 'dd535c60dbdf9abab0fedd923a55823c60450f074bbd398b1e179abf7c96a706',
  'keychain-blocks-compact.3mf': '9bb89752fdabf8f22da3586f9b1c29b97b89a98408357b8ef4c3bdfd21f9d091',
  'keychain-blocks-compact.zip': 'e38e44f391e85d541a9f3e64dce6465e3712f687a6e3effe4c1a7f85e4538008',
  'keychain-blocks-modular.3mf': '413eaa1b55b56c0d7c8daf0bd3dd587071da8fe835894abd7ca4ba4eff21028e',
  'keychain-blocks-modular.zip': 'f7d910bc34e54fa0eb1ae20380a933bff0058131a57dea71fb919fae29ae8788',
  'organizer-label.3mf': 'a421282af8d138a8e91ffc0ee7fef0d569ce134eabdb6731aabfb84ee8c4d047',
  'organizer-bin.3mf': '10e9ee1f8fe0a94ff3b2092b3b48abfd5d54be16d5743525bb6436833aa76009',
};

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const loadFont = (file: string) => { const b = readFileSync(file); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); };
const anton = loadFont('public/fonts/Anton-Regular.ttf');
const beVietnam = loadFont('public/fonts/BeVietnamPro-Regular.ttf');
type Part = { geometry: THREE.BufferGeometry; colorHex: string; name: string };
const withParts = <T>(parts: Part[], fn: (parts: Part[]) => T): T => { try { return fn(parts); } finally { parts.forEach(p => p.geometry.dispose()); } };

async function digests(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const lamp = generateLampShadeScene({ pattern: 'hexagon', around: 12, rows: 6, cellSizeMm: 10 });
  out['lamp-shade.3mf'] = withParts(getLampShadeExportParts(lamp), p => sha(write3mf(p)));
  disposeLampShadeScene(lamp);

  const dual = generateDualTextScene('BA', 'SA', anton, {});
  try { out['dual-text.3mf'] = withParts(getDualTextExportParts(dual), p => sha(write3mf(p))); } finally { disposeDualTextScene(dual); }

  const car = generateCarNameplateScene('LEO', anton, { addBase: true, addKeyring: true });
  try { out['car-nameplate.3mf'] = withParts(getCarExportParts(car), p => sha(write3mf(p))); } finally { disposeCarScene(car); }

  const box = generateHingeBoxScene({ widthMm: 100, depthMm: 65.5, closedHeightMm: 35, rows: 1, cols: 1, dividerThicknessMm: 1.6 });
  try { out['hinge-box.3mf'] = withParts(getHingeBoxExportParts(box), p => sha(write3mf(p))); } finally { disposeHingeBoxScene(box); }

  const source = new THREE.BoxGeometry(60, 20, 40);
  const pieces = buildJigsawPieces(source, 2, 2);
  try {
    out['jigsaw.3mf'] = withParts(getJigsawExportParts(pieces), p => sha(write3mf(p)));
    out['jigsaw.zip'] = withParts(getJigsawExportParts(pieces), p => sha(exportBlocksStlZip(p)));
  } finally { disposeJigsawPieces(pieces); source.dispose(); }

  for (const baseType of ['compact', 'modular'] as const) {
    const scene = generateKeychainBlocksScene([
      { id: 's1', char: 'Đ', blockColor: '#f59e0b', glyphColor: '#ffffff' },
      { id: 's2', char: 'A', blockColor: '#3b82f6', glyphColor: '#ffffff' },
    ], beVietnam, '#334155', baseType);
    try {
      out[`keychain-blocks-${baseType}.3mf`] = withParts(getBlocksExportParts(scene), p => sha(write3mf(p)));
      out[`keychain-blocks-${baseType}.zip`] = withParts(getBlocksExportParts(scene), p => sha(exportBlocksStlZip(p)));
    } finally { disposeBlocksScene(scene); }
  }

  const api: ManifoldApi = await Module().then((m) => { m.setup(); return m; });
  const params = normalizeOrganizerParams(DEFAULT_ORGANIZER_PARAMS).params;
  const square: [number, number][] = [[0, 0], [4, 0], [4, 6], [0, 6]];
  const hole: [number, number][] = [[1, 1], [1, 5], [3, 5], [3, 1]];
  const organizer = buildOrganizer(api, params, { ...DEFAULT_LABEL_PARAMS, enabled: true }, [square, hole]);
  assert.ok(organizer.label);
  out['organizer-label.3mf'] = sha(new Uint8Array(await labelTo3mf(organizer.label, '#ffffff', '#111827').arrayBuffer()));
  out['organizer-bin.3mf'] = sha(new Uint8Array(await binWithLabelTo3mf(organizer.bin, '#22c55e', organizer.label, '#ffffff', '#111827').arrayBuffer()));
  return out;
}

test('existing tools export byte-identical 3MF / STL zip (ADR-0051 regression guard)', async () => {
  mock.timers.enable({ apis: ['Date'], now: FIXED_NOW });
  try {
    const actual = await digests();
    assert.deepEqual(actual, GOLDEN);
  } finally { mock.timers.reset(); }
});
