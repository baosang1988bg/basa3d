# Keychain Blocks UX/UI Parity Implementation Plan

**Status:** implementation complete in commits `0e3770d` through `20a187b`; unit suite
passes. Manual browser smoke test and disposable-local-environment E2E remain pending.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/tools/keychain-blocks` to UX/UI parity with the reference `flex-keychain` tool (dark gridded viewport, compact per-slot controls, Base Type / Typeface-upload / Switch controls, blank/symbol slots, rotating default palette, expanded icon set) without regressing BaSa3D's existing 16-block capability, STL/3MF export, pricing estimate, or "Gửi báo giá" flow.

**Architecture:** Three layers, each touched independently: `keychain-blocks-constants.ts` (data: fonts, icons, palette, symbol/digit/letter lists), `keychain-blocks-engine.ts` (pure THREE.js geometry builders, already unit-tested in isolation), and the `keychain-blocks-workbench.tsx` / `keychain-blocks-canvas.tsx` React layer (state + rendering). Geometry changes (icons, blank slots, modular base) land first and get engine-level tests; the UI restructure lands last, once the engine already supports everything the new UI needs.

**Tech Stack:** Next.js App Router, React, three.js, opentype.js, Tailwind, Node's built-in test runner (`node:test` via `tsx`, run through `npm run test` / `tests/helpers/test-runner.ts`), Playwright for the existing e2e spec.

**Spec:** `docs/superpowers/specs/2026-09-15-keychain-blocks-parity.md`

## Global Constraints

- `MAX_BLOCKS` stays `16` — do not shrink the block cap to match the reference's fixed 4-slot demo (explicit product decision).
- Do not remove or break STL Zip export, Bambu 3MF export, the advisory price estimate, or "Gửi yêu cầu báo giá" — they have no reference equivalent and are BaSa3D-specific.
- `Bubbly`/`Bubbly V2` base sub-variants and internal switch-socket geometry are explicitly out of scope (see spec's "Explicitly out of scope").
- `basketball`, `duck`, `rugby`, `soccer` icons are explicitly out of scope (no vetted vector source yet).
- Every existing `data-testid`, form label text, and button label text that `e2e/keychain-blocks.spec.ts` already asserts on must keep working unless a step explicitly updates that spec file alongside the change.
- Follow existing file conventions: dense single/few-line component bodies (this file already reads that way — match the surrounding style, don't reformat unrelated lines).

---

### Task 1: Icon set parity + blank/symbol glyph support (constants + engine)

**Files:**
- Modify: `src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts`
- Modify: `src/lib/3d-tools/keychain-blocks/keychain-blocks-engine.ts`
- Test: `tests/keychain-blocks-engine.test.ts` (new)

**Interfaces:**
- Produces: `C.ICON_PATHS` with keys `airplane, apple, banana, cat, clover, cloud, coffee, fire, flower, grape, heart, lightning, moon, music, paw, ribbon, star` (17 keys — reference names, `car`/`smile`/`zap`/`plane`/`flame`/`paw-print` removed/renamed).
- Produces: `C.DIGIT_CHARS: string[]`, `C.LETTER_CHARS: string[]`, `C.SYMBOL_CHARS: string[]`.
- Produces: `buildGlyphShape(char, font)` now accepts `char === ''` (returns `[]`), and `validateBlock` accepts blank + symbol chars.
- Consumes: nothing new (first task).

- [x] **Step 1: Write the failing tests for icon rename/expansion + blank/symbol validation**

Create `tests/keychain-blocks-engine.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as opentype from 'opentype.js';
import { buildGlyphShape, buildSingleBlockMesh, validateColor } from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-engine';
import * as C from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-constants';

const font = opentype.parse(readFileSync('public/fonts/BeVietnamPro-Regular.ttf').buffer as ArrayBuffer);

test('icon set matches the reference tool\'s 17 sourceable icons, each a non-degenerate shape', () => {
  const expected = ['airplane', 'apple', 'banana', 'cat', 'clover', 'cloud', 'coffee', 'fire', 'flower', 'grape', 'heart', 'lightning', 'moon', 'music', 'paw', 'ribbon', 'star'];
  assert.deepEqual(Object.keys(C.ICON_PATHS).sort(), [...expected].sort());
  for (const id of expected) {
    const shapes = buildGlyphShape(`icon:${id}`, font);
    assert.ok(shapes.length > 0, id);
    for (const shape of shapes) assert.ok(shape.getPoints().length >= 3, id);
  }
});

test('a blank char produces no glyph shapes and a single-mesh (cap only) block group', () => {
  assert.deepEqual(buildGlyphShape('', font), []);
  const group = buildSingleBlockMesh({ id: 'slot-1', char: '', blockColor: '#f59e0b', glyphColor: '#ffffff' }, font);
  try {
    assert.equal(group.children.length, 1);
    assert.equal(group.children[0].name, 'slot-1-block');
  } finally {
    group.traverse(o => { if (o instanceof (globalThis as unknown as { THREE?: never }) ? false : 'geometry' in o) { /* disposed by caller in real usage */ } });
  }
});

test('symbol chars (? ! & @ $) validate and render like any other glyph', () => {
  for (const char of C.SYMBOL_CHARS) {
    const group = buildSingleBlockMesh({ id: 'slot-1', char, blockColor: '#f59e0b', glyphColor: '#ffffff' }, font);
    assert.equal(group.children.length, 2, char);
  }
});

test('rejects unsupported characters and unknown icon ids, still', () => {
  assert.throws(() => buildGlyphShape('icon:basketball', font));
  assert.throws(() => buildGlyphShape('€', font));
  assert.throws(() => validateColor('orange'));
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `ICON_PATHS` keys don't match yet, blank char throws (current `buildGlyphShape` doesn't special-case `''`), symbol chars throw (current regex is `\p{Script=Latin}|[0-9]` only).

- [x] **Step 3: Replace `ICON_PATHS` in the constants file**

In `src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts`, replace the existing `ICON_PATHS` export (keep `heart`, `star`, `cloud`, `coffee`, `music` bodies verbatim; rename `paw-print`→`paw`, `flame`→`fire`, `zap`→`lightning`, `plane`→`airplane`; drop `car` and `smile`; add `banana`, `cat`, `clover`, `flower`, `grape`, `moon`, `ribbon` with the coordinates below, sampled from `lucide-react@1.37.0`'s SVG paths with a headless-browser `getPointAtLength()` pass — verified to produce non-degenerate closed/open polylines):

```ts
export const ICON_PATHS: Record<string, number[][][]> = {
  heart: [/* unchanged from today's file */],
  star: [/* unchanged from today's file */],
  cloud: [/* unchanged from today's file */],
  coffee: [/* unchanged from today's file */],
  music: [/* unchanged from today's file */],
  paw: [/* body of today's "paw-print", unchanged */],
  fire: [/* body of today's "flame", unchanged */],
  lightning: [/* body of today's "zap", unchanged */],
  airplane: [/* body of today's "plane", unchanged */],
  apple: [/* unchanged from today's file */],
  banana: [
    [[4,13],[4.632,12.666],[5.285,12.375],[5.956,12.13],[6.643,11.934],[7.344,11.791],[8.054,11.707],[8.768,11.688],[9.481,11.739],[10.184,11.867],[10.867,12.077],[11.518,12.371],[12.125,12.747],[12.678,13.199],[13.169,13.718],[13.594,14.293],[13.954,14.91],[14.561,14.752],[15.244,14.544],[15.949,14.426],[16.663,14.401],[17.374,14.468],[18.071,14.627],[18.741,14.875],[19.373,15.208],[19.957,15.62],[20.482,16.104],[20.94,16.652],[21.324,17.255],[21.626,17.902],[21.841,18.583],[21.967,19.286],[22,20]],
    [[5.15,17.89],[6.873,17.258],[8.463,16.342],[9.865,15.159],[11.025,13.738],[11.893,12.122],[12.425,10.367],[12.589,8.54],[12.376,6.719],[11.9,4.945],[11.806,3.121],[13.03,2],[14.743,2.582],[16.014,3.896],[16.913,5.495],[17.543,7.219],[17.928,9.014],[17.976,10.847],[17.757,12.67],[17.302,14.449],[16.606,16.147],[15.665,17.723],[14.482,19.126],[13.073,20.301],[11.47,21.192],[9.725,21.76],[7.906,21.993],[6.069,21.986],[4.24,21.827],[2.544,21.173],[2.052,19.506],[3.377,18.372],[5.15,17.89]],
  ],
  cat: [
    [[12,5],[14.034,5.222],[15.646,3.929],[17.543,3.105],[19.588,2.827],[20.925,4.05],[20.827,6.117],[20.455,8.156],[20.081,10.155],[20.828,12.084],[20.966,14.142],[20.458,16.144],[19.372,17.902],[17.839,19.288],[16.012,20.26],[14.02,20.823],[11.957,21],[9.894,20.813],[7.904,20.245],[6.081,19.266],[4.561,17.865],[3.504,16.09],[3.027,14.08],[3.198,12.025],[3.953,10.098],[3.511,8.097],[3.122,6.06],[3.013,3.995],[4.393,2.822],[6.439,3.098],[8.343,3.906],[9.962,5.188],[12,5]],
    [[8,14],[8,14.5]],
    [[16,14],[16,14.5]],
    [[11.25,16.25],[12.721,16.25],[11.97,16.97],[11.25,16.25]],
  ],
  clover: [
    [[16.17,7.83],[2,22]],
    [[4.02,12],[3.012,10.028],[3.736,7.935],[5.746,7.005],[7.809,7.809],[7.004,5.805],[7.891,3.776],[9.969,3.009],[11.962,3.975],[13.913,3.017],[16.021,3.696],[16.993,5.686],[16.232,7.766],[18.136,7.004],[20.183,7.848],[20.993,9.91],[20.069,11.922],[20.977,13.854],[20.342,15.976],[18.373,16.989],[16.277,16.272],[16.995,18.077],[16.193,20.141],[14.15,20.994],[12.118,20.113],[10.205,20.97],[8.07,20.379],[7.016,18.432],[7.689,16.322],[5.95,16.916],[3.901,16.075],[3.085,14.017],[4,12]],
    [[7.83,7.83],[16.17,16.17]],
  ],
  flower: [
    [[12,16.5],[11.242,19],[9.222,20.659],[6.622,20.914],[4.318,19.682],[3.086,17.378],[3.341,14.778],[5,12.758],[7.5,12],[5,11.242],[3.341,9.222],[3.086,6.622],[4.318,4.318],[6.622,3.086],[9.222,3.341],[11.242,5],[12,7.5],[12.758,5],[14.778,3.341],[17.378,3.086],[19.682,4.318],[20.914,6.622],[20.659,9.222],[19,11.242],[16.5,12],[19,12.758],[20.659,14.778],[20.914,17.378],[19.682,19.682],[17.378,20.914],[14.778,20.659],[12.758,19],[12,16.5]],
    [[12,7.5],[12,9]],
    [[7.5,12],[9,12]],
    [[16.5,12],[15,12]],
    [[12,16.5],[12,15]],
    [[8,8],[9.88,9.88]],
    [[14.12,9.88],[16,8]],
    [[8,16],[9.88,14.12]],
    [[14.12,14.12],[16,16]],
    // pistil — sampled as a 24-point circle (cx 12, cy 12, r 3)
    [[15,12],[14.898,12.776],[14.598,13.5],[14.121,14.121],[13.5,14.598],[12.776,14.898],[12,15],[11.224,14.898],[10.5,14.598],[9.879,14.121],[9.402,13.5],[9.102,12.776],[9,12],[9.102,11.224],[9.402,10.5],[9.879,9.879],[10.5,9.402],[11.224,9.102],[12,9],[12.776,9.102],[13.5,9.402],[14.121,9.879],[14.598,10.5],[14.898,11.224],[15,12]],
  ],
  grape: [
    [[22,5],[22,4.646],[22,4.292],[22,3.938],[22,3.584],[22,3.23],[22,2.876],[22,2.522],[22,2.168],[21.868,2.132],[21.618,2.382],[21.367,2.633],[21.117,2.883],[20.867,3.133],[20.616,3.384],[20.366,3.634],[20.116,3.884],[19.865,4.135],[19.615,4.385],[19.365,4.635],[19.114,4.886],[18.864,5.136],[18.614,5.386],[18.363,5.637],[18.113,5.887],[17.862,6.138],[17.612,6.388],[17.362,6.638],[17.111,6.889],[16.861,7.139],[16.611,7.389],[16.36,7.64],[16.11,7.89]],
    // 8 grape-dot circles (cx, cy, r=3), 24-point samples each
    [[19.6,15.89],[19.498,16.666],[19.198,17.39],[18.721,18.011],[18.1,18.488],[17.376,18.788],[16.6,18.89],[15.824,18.788],[15.1,18.488],[14.479,18.011],[14.002,17.39],[13.702,16.666],[13.6,15.89],[13.702,15.114],[14.002,14.39],[14.479,13.769],[15.1,13.292],[15.824,12.992],[16.6,12.89],[17.376,12.992],[18.1,13.292],[18.721,13.769],[19.198,14.39],[19.498,15.114],[19.6,15.89]],
    [[11.11,7.4],[11.008,8.176],[10.708,8.9],[10.231,9.521],[9.61,9.998],[8.886,10.298],[8.11,10.4],[7.334,10.298],[6.61,9.998],[5.989,9.521],[5.512,8.9],[5.212,8.176],[5.11,7.4],[5.212,6.624],[5.512,5.9],[5.989,5.279],[6.61,4.802],[7.334,4.502],[8.11,4.4],[8.886,4.502],[9.61,4.802],[10.231,5.279],[10.708,5.9],[11.008,6.624],[11.11,7.4]],
    [[15.35,11.65],[15.248,12.426],[14.948,13.15],[14.471,13.771],[13.85,14.248],[13.126,14.548],[12.35,14.65],[11.574,14.548],[10.85,14.248],[10.229,13.771],[9.752,13.15],[9.452,12.426],[9.35,11.65],[9.452,10.874],[9.752,10.15],[10.229,9.529],[10.85,9.052],[11.574,8.752],[12.35,8.65],[13.126,8.752],[13.85,9.052],[14.471,9.529],[14.948,10.15],[15.248,10.874],[15.35,11.65]],
    [[16.91,5.85],[16.808,6.626],[16.508,7.35],[16.031,7.971],[15.41,8.448],[14.686,8.748],[13.91,8.85],[13.134,8.748],[12.41,8.448],[11.789,7.971],[11.312,7.35],[11.012,6.626],[10.91,5.85],[11.012,5.074],[11.312,4.35],[11.789,3.729],[12.41,3.252],[13.134,2.952],[13.91,2.85],[14.686,2.952],[15.41,3.252],[16.031,3.729],[16.508,4.35],[16.808,5.074],[16.91,5.85]],
    [[21.15,10.09],[21.048,10.866],[20.748,11.59],[20.271,12.211],[19.65,12.688],[18.926,12.988],[18.15,13.09],[17.374,12.988],[16.65,12.688],[16.029,12.211],[15.552,11.59],[15.252,10.866],[15.15,10.09],[15.252,9.314],[15.552,8.59],[16.029,7.969],[16.65,7.492],[17.374,7.192],[18.15,7.09],[18.926,7.192],[19.65,7.492],[20.271,7.969],[20.748,8.59],[21.048,9.314],[21.15,10.09]],
    [[9.56,13.2],[9.458,13.976],[9.158,14.7],[8.681,15.321],[8.06,15.798],[7.336,16.098],[6.56,16.2],[5.784,16.098],[5.06,15.798],[4.439,15.321],[3.962,14.7],[3.662,13.976],[3.56,13.2],[3.662,12.424],[3.962,11.7],[4.439,11.079],[5.06,10.602],[5.784,10.302],[6.56,10.2],[7.336,10.302],[8.06,10.602],[8.681,11.079],[9.158,11.7],[9.458,12.424],[9.56,13.2]],
    [[13.8,17.44],[13.698,18.216],[13.398,18.94],[12.921,19.561],[12.3,20.038],[11.576,20.338],[10.8,20.44],[10.024,20.338],[9.3,20.038],[8.679,19.561],[8.202,18.94],[7.902,18.216],[7.8,17.44],[7.902,16.664],[8.202,15.94],[8.679,15.319],[9.3,14.842],[10.024,14.542],[10.8,14.44],[11.576,14.542],[12.3,14.842],[12.921,15.319],[13.398,15.94],[13.698,16.664],[13.8,17.44]],
    [[8,19],[7.898,19.776],[7.598,20.5],[7.121,21.121],[6.5,21.598],[5.776,21.898],[5,22],[4.224,21.898],[3.5,21.598],[2.879,21.121],[2.402,20.5],[2.102,19.776],[2,19],[2.102,18.224],[2.402,17.5],[2.879,16.879],[3.5,16.402],[4.224,16.102],[5,16],[5.776,16.102],[6.5,16.402],[7.121,16.879],[7.598,17.5],[7.898,18.224],[8,19]],
  ],
  moon: [
    [[20.985,12.486],[20.694,14.328],[20.028,16.07],[19.016,17.636],[17.704,18.961],[16.148,19.989],[14.413,20.673],[12.575,20.983],[10.711,20.909],[8.903,20.454],[7.228,19.634],[5.758,18.487],[4.555,17.062],[3.671,15.42],[3.146,13.631],[3.001,11.772],[3.239,9.922],[3.856,8.163],[4.823,6.568],[6.096,5.206],[7.622,4.134],[9.337,3.401],[11.166,3.039],[11.705,4.179],[11.096,5.937],[11.056,7.797],[11.586,9.581],[12.638,11.115],[14.109,12.254],[15.859,12.887],[17.718,12.955],[19.509,12.449],[20.985,12.486]],
  ],
  ribbon: [
    [[12,11.22],[11.721,10.883],[11.439,10.548],[11.158,10.212],[10.884,9.871],[10.621,9.521],[10.381,9.155],[10.178,8.768],[10.04,8.353],[10.002,7.919],[10.067,7.487],[10.224,7.079],[10.467,6.716],[10.782,6.414],[11.155,6.187],[11.569,6.047],[12.003,6],[12.437,6.048],[12.851,6.189],[13.223,6.418],[13.538,6.721],[13.779,7.085],[13.935,7.493],[13.999,7.925],[13.959,8.36],[13.819,8.774],[13.616,9.161],[13.376,9.527],[13.113,9.877],[12.837,10.217],[12.555,10.552],[12.272,10.885],[11.99,11.22]],
    [[12,18],[14.57,14.5]],
    [[6.243,9.016],[6.493,8.676],[6.764,8.352],[7.053,8.045],[7.361,7.756],[7.685,7.486],[8.025,7.236],[8.38,7.007],[8.747,6.8],[9.127,6.615],[9.517,6.454],[9.916,6.316],[10.322,6.202],[10.735,6.114],[11.152,6.05],[11.572,6.012],[11.994,5.999],[12.416,6.011],[12.836,6.049],[13.254,6.112],[13.666,6.2],[14.073,6.313],[14.472,6.45],[14.862,6.611],[15.242,6.795],[15.61,7.002],[15.965,7.23],[16.305,7.479],[16.63,7.749],[16.938,8.038],[17.228,8.344],[17.499,8.668],[17.75,9.007]],
    [[9.35,14.53],[12,11.22]],
    [[9.35,14.53],[8.158,12.866],[7.074,11.13],[6.302,9.239],[6.003,7.219],[6.388,5.228],[7.603,3.598],[9.332,2.52],[11.312,2.032],[13.35,2.127],[15.272,2.808],[16.867,4.075],[17.842,5.856],[17.952,7.887],[17.476,9.872],[16.558,11.699],[15.396,13.383],[14.977,15.018],[16.241,16.627],[17.506,18.237],[18.271,20.013],[16.725,21.318],[14.908,21.847],[13.647,20.243],[12.436,18.593],[11.216,19.051],[9.992,20.693],[8.526,21.997],[6.788,20.977],[5.676,19.434],[6.842,17.767],[8.096,16.148],[9.35,14.53]],
  ],
};
```

Also add:

```ts
export const DIGIT_CHARS = Array.from('0123456789');
export const LETTER_CHARS = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
export const SYMBOL_CHARS = ['?', '!', '&', '@', '$'];
export const BLOCK_COLOR_PALETTE = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
```

(When copying `heart`/`star`/`cloud`/`coffee`/`music`/`paw`/`fire`/`lightning`/`airplane`, take the coordinate arrays verbatim from today's file under their old keys — only the key names and the two removed keys change.)

- [x] **Step 4: Update `keychain-blocks-engine.ts`'s `validateBlock`, `buildGlyphShape`, `buildSingleBlockMesh`**

```ts
function validateBlock(block: KeychainBlockConfig, font: Font) {
  if (!block.id || block.id.length > 64) throw new RangeError('ID khối không hợp lệ.');
  validateColor(block.blockColor); validateColor(block.glyphColor);
  const char = block.char.normalize('NFC');
  if (char === '') return;
  if (char.startsWith('icon:')) {
    if (!Object.hasOwn(C.ICON_PATHS, char.slice(5))) throw new RangeError('Icon không hợp lệ.');
  } else if (!/^(?:\p{Script=Latin}|[0-9]|[?!&@$])$/u.test(char) || font.charToGlyphIndex(char) === 0) {
    throw new RangeError('Mỗi khối cần một chữ Latin có dấu, chữ số, ký hiệu được hỗ trợ, hoặc để trống.');
  }
}
export function buildGlyphShape(char: string, font: Font): THREE.Shape[] {
  validateBlock({ id: 'glyph', char, blockColor: '#000000', glyphColor: '#ffffff' }, font);
  const normalized = char.normalize('NFC');
  if (normalized === '') return [];
  if (normalized.startsWith('icon:')) return C.ICON_PATHS[normalized.slice(5)].map(strokeShape);
  const shape = new THREE.ShapePath();
  for (const c of font.getPath(normalized, 0, 0, 10).commands) {
    switch (c.type) {
      case 'M': shape.moveTo(c.x, -c.y); break;
      case 'L': shape.lineTo(c.x, -c.y); break;
      case 'C': shape.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y); break;
      case 'Q': shape.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y); break;
      case 'Z': shape.currentPath?.closePath(); break;
    }
  }
  return shape.toShapes();
}
export function buildSingleBlockMesh(block: KeychainBlockConfig, font: Font): THREE.Group {
  validateBlock(block, font);
  const group = new THREE.Group(); group.name = block.id;
  const shape = buildKeycapBaseShape();
  const cap = new THREE.ExtrudeGeometry(shape, { depth: C.BLOCK_HEIGHT_MM-0.6, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 3, curveSegments: 4 });
  cap.scale(C.BLOCK_WIDTH_MM/(C.BLOCK_WIDTH_MM+0.6), C.BLOCK_DEPTH_MM/(C.BLOCK_DEPTH_MM+0.6), 1);
  cap.translate(0.3*C.BLOCK_WIDTH_MM/(C.BLOCK_WIDTH_MM+0.6), 0.3*C.BLOCK_DEPTH_MM/(C.BLOCK_DEPTH_MM+0.6), C.BASE_THICKNESS_MM-C.OVERLAP_MM+0.3);
  const capMesh = new THREE.Mesh(cap, new THREE.MeshStandardMaterial({ color: block.blockColor, roughness: 0.65 })); capMesh.name = `${block.id}-block`; group.add(capMesh);
  const char = block.char.normalize('NFC');
  if (char !== '') {
    const glyph = new THREE.ExtrudeGeometry(buildGlyphShape(char, font), { depth: C.GLYPH_EMBOSS_HEIGHT_MM+C.OVERLAP_MM, bevelEnabled: false, curveSegments: 4 });
    glyph.computeBoundingBox(); const bounds = glyph.boundingBox!;
    const size = bounds.getSize(new THREE.Vector3());
    if (size.x <= 0 || size.y <= 0) { cap.dispose(); glyph.dispose(); throw new RangeError('Không tạo được hình chữ.'); }
    const scale = Math.min(8/size.x, 8/size.y);
    glyph.translate(-bounds.min.x, -bounds.min.y, 0); glyph.scale(scale, scale, 1);
    glyph.translate((C.BLOCK_WIDTH_MM-size.x*scale)/2, (C.BLOCK_DEPTH_MM-size.y*scale)/2, C.BASE_THICKNESS_MM+C.BLOCK_HEIGHT_MM-2*C.OVERLAP_MM);
    const glyphMesh = new THREE.Mesh(glyph, new THREE.MeshStandardMaterial({ color: block.glyphColor, roughness: 0.65 })); glyphMesh.name = `${block.id}-glyph`; group.add(glyphMesh);
  }
  return group;
}
```

This replaces the old `buildSingleBlockMesh` body (the `for (const [geometry, color, name] of [...])` loop) and the old `validateBlock`/`buildGlyphShape`. Everything else in the file (`buildKeycapBaseShape`, `strokeShape`, `buildCompactBaseMesh`, `disposeBlocksScene`, `generateKeychainBlocksScene`, `getBlocksExportParts`, `mergeBlocksGeometry`) is untouched by this task.

- [x] **Step 5: Fix up the leftover test helper**

The `finally` block in the "blank char" test above is overcomplicated — simplify it now that the real behavior is known:

```ts
test('a blank char produces no glyph shapes and a single-mesh (cap only) block group', () => {
  assert.deepEqual(buildGlyphShape('', font), []);
  const group = buildSingleBlockMesh({ id: 'slot-1', char: '', blockColor: '#f59e0b', glyphColor: '#ffffff' }, font);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].name, 'slot-1-block');
});
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS (all `keychain-blocks-engine.test.ts` tests green; existing test suite unaffected).

- [x] **Step 7: Commit**

```bash
git add src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts src/lib/3d-tools/keychain-blocks/keychain-blocks-engine.ts tests/keychain-blocks-engine.test.ts
git commit -m "feat(keychain-blocks): match reference icon set, support blank/symbol slots"
```

---

### Task 2: Modular base type

**Files:**
- Modify: `src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts`
- Modify: `src/lib/3d-tools/keychain-blocks/keychain-blocks-engine.ts`
- Test: `tests/keychain-blocks-engine.test.ts`

**Interfaces:**
- Consumes: `C.BLOCK_WIDTH_MM`, `C.BLOCK_DEPTH_MM`, `C.BLOCK_GAP_MM`, `C.KEYRING_TAB_RADIUS_MM`, `C.KEYRING_HOLE_DIAMETER_MM`, `C.BASE_THICKNESS_MM` (all from Task 1's untouched constants).
- Produces: `export type BaseType = 'compact' | 'modular'` in constants; `buildModularBaseMesh(count, colorHex): THREE.Mesh` and `generateKeychainBlocksScene(blocks, font, baseColor?, baseType?)` (4th param, default `'compact'`) in the engine — later tasks (Task 7/8) call this 4-arg form.

- [x] **Step 1: Write the failing test**

Append to `tests/keychain-blocks-engine.test.ts`:

```ts
import { buildCompactBaseMesh, buildModularBaseMesh, generateKeychainBlocksScene, disposeBlocksScene, getBlocksExportParts } from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-engine';

test('modular base keeps the same footprint as compact but is a visibly different (higher-vertex) mesh', () => {
  const compact = buildCompactBaseMesh(4, '#334155');
  const modular = buildModularBaseMesh(4, '#334155');
  try {
    compact.geometry.computeBoundingBox(); modular.geometry.computeBoundingBox();
    const compactSize = compact.geometry.boundingBox!.getSize(new (Object.getPrototypeOf(compact.geometry.boundingBox!.min).constructor)());
    const modularSize = modular.geometry.boundingBox!.getSize(new (Object.getPrototypeOf(modular.geometry.boundingBox!.min).constructor)());
    assert.ok(Math.abs(compactSize.x - modularSize.x) < 1e-6);
    assert.ok(Math.abs(compactSize.y - modularSize.y) < 1e-6);
    assert.ok(modular.geometry.getAttribute('position').count > compact.geometry.getAttribute('position').count);
  } finally {
    compact.geometry.dispose(); modular.geometry.dispose();
  }
});

test('generateKeychainBlocksScene defaults to compact and accepts an explicit modular baseType', () => {
  for (const [char1] of [['A']]) {
    const sceneCompact = generateKeychainBlocksScene([{ id: 's1', char: char1, blockColor: '#f59e0b', glyphColor: '#fff' }], font, '#334155');
    const sceneModular = generateKeychainBlocksScene([{ id: 's1', char: char1, blockColor: '#f59e0b', glyphColor: '#fff' }], font, '#334155', 'modular');
    try {
      assert.equal(sceneCompact.children[0].name, 'compact-base');
      assert.equal(sceneModular.children[0].name, 'modular-base');
      getBlocksExportParts(sceneCompact).forEach(p => p.geometry.dispose());
      getBlocksExportParts(sceneModular).forEach(p => p.geometry.dispose());
    } finally {
      disposeBlocksScene(sceneCompact); disposeBlocksScene(sceneModular);
    }
  }
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `buildModularBaseMesh` and the 4-arg `generateKeychainBlocksScene` don't exist yet.

- [x] **Step 3: Add `BaseType` to constants**

In `keychain-blocks-constants.ts`, add:

```ts
export type BaseType = 'compact' | 'modular';
export const MODULAR_NOTCH_DEPTH_MM = 1.5;
```

- [x] **Step 4: Add `buildModularBaseMesh` and thread `baseType` through `generateKeychainBlocksScene`**

In `keychain-blocks-engine.ts`, right after `buildCompactBaseMesh`:

```ts
export function buildModularBaseMesh(count: number, colorHex: string): THREE.Mesh {
  validateCount(count); validateColor(colorHex);
  const width = count*C.BLOCK_WIDTH_MM+(count-1)*C.BLOCK_GAP_MM;
  const r = C.KEYRING_TAB_RADIUS_MM, cy = C.BLOCK_DEPTH_MM/2, notch = C.MODULAR_NOTCH_DEPTH_MM;
  const s = new THREE.Shape(); s.moveTo(0, 0);
  for (let i = 1; i < count; i++) {
    const gapCenter = i*C.BLOCK_WIDTH_MM + (i-0.5)*C.BLOCK_GAP_MM;
    s.lineTo(gapCenter-C.BLOCK_GAP_MM, 0); s.quadraticCurveTo(gapCenter, notch, gapCenter+C.BLOCK_GAP_MM, 0);
  }
  s.lineTo(width, 0); s.lineTo(width, C.BLOCK_DEPTH_MM);
  for (let i = count-1; i >= 1; i--) {
    const gapCenter = i*C.BLOCK_WIDTH_MM + (i-0.5)*C.BLOCK_GAP_MM;
    s.lineTo(gapCenter+C.BLOCK_GAP_MM, C.BLOCK_DEPTH_MM); s.quadraticCurveTo(gapCenter, C.BLOCK_DEPTH_MM-notch, gapCenter-C.BLOCK_GAP_MM, C.BLOCK_DEPTH_MM);
  }
  s.lineTo(0, C.BLOCK_DEPTH_MM);
  s.lineTo(0,cy+r); s.lineTo(-r,cy+r); s.absarc(-r,cy,r,Math.PI/2,3*Math.PI/2,false); s.lineTo(0,cy-r); s.closePath();
  s.holes.push(new THREE.Path().absarc(-r,cy,C.KEYRING_HOLE_DIAMETER_MM/2,0,Math.PI*2,true));
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:C.BASE_THICKNESS_MM,bevelEnabled:false,curveSegments:12}),new THREE.MeshStandardMaterial({color:colorHex,roughness:0.65})); mesh.name='modular-base'; return mesh;
}
```

Change `generateKeychainBlocksScene`'s signature and body:

```ts
export function generateKeychainBlocksScene(blocks: KeychainBlockConfig[], font: Font, baseColor = C.DEFAULT_BASE_COLOR, baseType: C.BaseType = 'compact'): THREE.Group {
  validateCount(blocks.length); validateColor(baseColor); blocks.forEach(block => validateBlock(block,font));
  if (new Set(blocks.map(block=>block.id)).size !== blocks.length) throw new RangeError('ID khối phải khác nhau.');
  const group = new THREE.Group();
  try {
    group.add(baseType === 'modular' ? buildModularBaseMesh(blocks.length,baseColor) : buildCompactBaseMesh(blocks.length,baseColor));
    blocks.forEach((block,index) => { const mesh = buildSingleBlockMesh(block,font); mesh.position.x=index*(C.BLOCK_WIDTH_MM+C.BLOCK_GAP_MM); group.add(mesh); });
    group.updateMatrixWorld(true); return group;
  } catch (error) { disposeBlocksScene(group); throw error; }
}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts src/lib/3d-tools/keychain-blocks/keychain-blocks-engine.ts tests/keychain-blocks-engine.test.ts
git commit -m "feat(keychain-blocks): add modular base type geometry"
```

---

### Task 3: Vendor the 4 missing keycap fonts

**Files:**
- Create: `public/fonts/Poppins-Regular.ttf`, `public/fonts/Bungee-Regular.ttf`, `public/fonts/TitanOne-Regular.ttf`, `public/fonts/Bangers-Regular.ttf`
- Create: `public/fonts/OFL-Poppins.txt`, `public/fonts/OFL-Bungee.txt`, `public/fonts/OFL-TitanOne.txt`, `public/fonts/OFL-Bangers.txt`
- Modify: `src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts`

**Interfaces:**
- Produces: `C.FONTS` gains 4 new entries. `BlockFont` (`keyof typeof C.FONTS`, defined in the engine) picks them up automatically — no engine change needed.

- [x] **Step 1: Download the 4 fonts and their OFL licenses (same source/pattern as the existing 5 vendored fonts)**

```bash
curl -fL -o public/fonts/Poppins-Regular.ttf https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf
curl -fL -o public/fonts/OFL-Poppins.txt https://github.com/google/fonts/raw/main/ofl/poppins/OFL.txt
curl -fL -o public/fonts/Bungee-Regular.ttf https://github.com/google/fonts/raw/main/ofl/bungee/Bungee-Regular.ttf
curl -fL -o public/fonts/OFL-Bungee.txt https://github.com/google/fonts/raw/main/ofl/bungee/OFL.txt
curl -fL -o public/fonts/TitanOne-Regular.ttf https://github.com/google/fonts/raw/main/ofl/titanone/TitanOne-Regular.ttf
curl -fL -o public/fonts/OFL-TitanOne.txt https://github.com/google/fonts/raw/main/ofl/titanone/OFL.txt
curl -fL -o public/fonts/Bangers-Regular.ttf https://github.com/google/fonts/raw/main/ofl/bangers/Bangers-Regular.ttf
curl -fL -o public/fonts/OFL-Bangers.txt https://github.com/google/fonts/raw/main/ofl/bangers/OFL.txt
```

- [x] **Step 2: Verify each download is a real TTF, not an HTML error page**

Run: `for f in public/fonts/Poppins-Regular.ttf public/fonts/Bungee-Regular.ttf public/fonts/TitanOne-Regular.ttf public/fonts/Bangers-Regular.ttf; do file "$f"; done`
Expected: each line reports a TrueType/OpenType font (e.g. `TrueType Font data`), not `HTML document text`. If any is HTML, the GitHub path for that family changed — look it up at `https://github.com/google/fonts/tree/main/ofl/<family-slug>` and retry with the correct filename.

- [x] **Step 3: Register the fonts in constants**

In `keychain-blocks-constants.ts`, change:

```ts
export const FONTS = { 'Be Vietnam Pro': '/fonts/BeVietnamPro-Regular.ttf', Comfortaa: '/fonts/Comfortaa.ttf' } as const;
```

to:

```ts
export const FONTS = {
  'Be Vietnam Pro': '/fonts/BeVietnamPro-Regular.ttf',
  Comfortaa: '/fonts/Comfortaa.ttf',
  Poppins: '/fonts/Poppins-Regular.ttf',
  Bungee: '/fonts/Bungee-Regular.ttf',
  'Titan One': '/fonts/TitanOne-Regular.ttf',
  Bangers: '/fonts/Bangers-Regular.ttf',
} as const;
```

- [x] **Step 4: Confirm the existing font-coverage engine test still passes with the new fonts loadable**

Run: `npm run test`
Expected: PASS — no existing test enumerates `C.FONTS` and asserts glyph coverage for keychain-blocks (unlike `dual-text-engine.test.ts`), so this is a smoke check that nothing else broke. If `npm run dev` is running, also manually open `/tools/keychain-blocks`, switch "Font chữ" to each new option, and confirm the preview re-renders without a console error.

- [x] **Step 5: Commit**

```bash
git add public/fonts/Poppins-Regular.ttf public/fonts/OFL-Poppins.txt public/fonts/Bungee-Regular.ttf public/fonts/OFL-Bungee.txt public/fonts/TitanOne-Regular.ttf public/fonts/OFL-TitanOne.txt public/fonts/Bangers-Regular.ttf public/fonts/OFL-Bangers.txt src/lib/3d-tools/keychain-blocks/keychain-blocks-constants.ts
git commit -m "feat(keychain-blocks): vendor Poppins/Bungee/Titan One/Bangers keycap fonts"
```

---

### Task 4: Dark gridded viewport

**Files:**
- Modify: `src/app/[locale]/(tools)/tools/keychain-blocks/keychain-blocks-canvas.tsx`
- Modify: `src/app/[locale]/(tools)/tools/keychain-blocks/keychain-blocks-workbench.tsx` (the canvas host `<div>` only)

**Interfaces:**
- Consumes: nothing new — pure rendering change, `group: THREE.Group` prop is unchanged.
- Produces: nothing consumed by later tasks (visual-only; Task 8 touches the same file for unrelated reasons and must not clobber this).

- [x] **Step 1: Change the scene background, add a grid floor, and fit the camera framing**

In `keychain-blocks-canvas.tsx`, replace the scene/camera setup:

```ts
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b1220');
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000); camera.up.set(0, 0, 1);
const bounds = new THREE.Box3().setFromObject(group);
const size = bounds.getSize(new THREE.Vector3()).length();
const center = bounds.getCenter(new THREE.Vector3());
camera.position.set(size, -size, size);
const grid = new THREE.GridHelper(size * 6, 30, 0x334155, 0x1e293b);
grid.rotation.x = Math.PI / 2;
grid.position.set(center.x, center.y, bounds.min.z);
scene.add(group, grid, new THREE.HemisphereLight(0x94a3b8, 0x0b1220, 2));
const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(100, -100, 300); scene.add(light);
```

(The rest of the effect — renderer creation, `OrbitControls`, resize observer, render loop, cleanup — is unchanged; only the block quoted above, inside the same `useEffect`, is replaced. `controls.target.copy(bounds.getCenter(...))` further down stays as-is; you can reuse the new `center` local instead of recomputing it if you want, but it's not required.)

- [x] **Step 2: Add a CSS radial-glow backdrop behind the canvas host**

In `keychain-blocks-workbench.tsx`, change the canvas host `<div>`'s className from:

```tsx
<div className="h-[50dvh] min-h-[360px] bg-slate-100 lg:h-full lg:min-h-0">
```

to:

```tsx
<div className="h-[50dvh] min-h-[360px] bg-[radial-gradient(ellipse_at_center,_#1e293b,_#020617)] lg:h-full lg:min-h-0">
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev` (if not already running), open `http://localhost:3000/tools/keychain-blocks`.
Expected: viewport is dark with a visible grid floor under the keychain model; OrbitControls (drag to orbit, scroll to zoom) still work; no console errors.

- [x] **Step 4: Commit**

```bash
git add src/app/\[locale\]/\(tools\)/tools/keychain-blocks/keychain-blocks-canvas.tsx src/app/\[locale\]/\(tools\)/tools/keychain-blocks/keychain-blocks-workbench.tsx
git commit -m "feat(keychain-blocks): dark gridded viewport to match reference"
```

---

### Task 5: Workbench UI restructure — Base Type, Typeface + upload, Switch, compact Slots list

**Files:**
- Modify: `src/app/[locale]/(tools)/tools/keychain-blocks/keychain-blocks-workbench.tsx`

**Interfaces:**
- Consumes: `C.BaseType`, `C.BLOCK_COLOR_PALETTE`, `C.DIGIT_CHARS`, `C.LETTER_CHARS`, `C.SYMBOL_CHARS`, `C.ICON_PATHS` (Tasks 1–2), `C.FONTS` (Task 3), `generateKeychainBlocksScene(blocks, font, baseColor, baseType)` (Task 2), dark canvas host (Task 4, already applied — don't revert the className from Task 4 Step 2).
- Produces: `KeychainBlocksWorkbench` renders the new control layout; `sendRequest`'s description string gains `baseType`/`switchType` text (Task 6 depends on this exact wording).

- [x] **Step 1: Update `makeBlock` to use the rotating palette and add `baseType`/`switchType`/custom-font state**

```ts
const CUSTOM_FONT_ID = '__custom__' as const;
const makeBlock = (char: string, index: number): KeychainBlockConfig => ({ id: `slot-${index+1}`, char, blockColor: C.BLOCK_COLOR_PALETTE[index % C.BLOCK_COLOR_PALETTE.length], glyphColor: C.DEFAULT_GLYPH_COLOR });
```

In the component, add:

```ts
const [baseType, setBaseType] = useState<C.BaseType>('compact');
const [switchType, setSwitchType] = useState<'physical' | '3d-printed'>('physical');
const [customFont, setCustomFont] = useState<{ value: Font } | null>(null);
const fontInputRef = useRef<HTMLInputElement>(null);
```

(`useRef` is already imported from `'react'` — confirm the import line includes it; if not, add it alongside `useEffect, useMemo, useState`.)

- [x] **Step 2: Wire custom font upload and extend the font-loading effect**

```ts
async function handleFontUpload(file: File) {
  setFontError('');
  try {
    const buffer = await file.arrayBuffer();
    const parsed = opentype.parse(buffer);
    setCustomFont({ value: parsed });
    setFontName(CUSTOM_FONT_ID as unknown as BlockFont);
  } catch {
    setFontError('Không đọc được file font. Hãy dùng file .ttf hoặc .otf hợp lệ.');
  }
}
```

Add `import * as opentype from 'opentype.js';` to the top imports (the file already imports `type { Font }` from the same package — add the namespace import alongside it).

Change the font-loading `useEffect` to special-case the custom font:

```ts
useEffect(() => {
  if ((fontName as string) === CUSTOM_FONT_ID) {
    if (customFont) setFont({ name: fontName, value: customFont.value });
    return;
  }
  let active=true; setFontError('');
  void loadBlocksFont(fontName).then(value=>{if(active)setFont({name:fontName,value});}).catch(reason=>{if(active)setFontError(reason instanceof Error?reason.message:'Không tải được font.');});
  return ()=>{active=false;};
},[fontName, customFont]);
```

- [x] **Step 3: Pass `baseType` into the scene builder and dynamic capacity caption**

Change the `result` memo:

```ts
const result=useMemo(()=>{
  if (!font || font.name!==fontName) return {group:null,error:''};
  try { return {group:generateKeychainBlocksScene(blocks,font.value,baseColor,baseType),error:''}; }
  catch(reason) { return {group:null,error:reason instanceof Error?reason.message:'Không thể dựng mẫu.'}; }
},[blocks,font,fontName,baseColor,baseType]);
```

Add a small local helper above the return statement:

```ts
const capacityLabel = `${blocks.length}-khối đế ${baseType==='modular'?'rời (Modular)':'liền (Compact)'}`;
```

- [x] **Step 4: Replace the fields JSX with the new layout**

Replace everything from `<fieldset disabled={uploading} className="space-y-3">` through its closing `</fieldset>` with:

```tsx
<fieldset disabled={uploading} className="space-y-4">
  <label className="block text-sm">Tên trên móc khoá<input className="mt-1 h-10 w-full rounded border bg-background px-2" value={name} onChange={e=>changeName(e.target.value)}/></label>
  <p className="text-xs text-muted-foreground">{capacityLabel}</p>

  <div>
    <p className="text-xs font-semibold uppercase text-muted-foreground">Kiểu đế</p>
    <div className="mt-1 inline-flex gap-1">
      {(['compact','modular'] as const).map(t => (
        <button key={t} type="button" className={storefrontButtonClasses(t===baseType?'primary':'secondary','px-3 py-1.5 text-xs')} onClick={()=>setBaseType(t)}>{t==='compact'?'Compact':'Modular'}</button>
      ))}
    </div>
  </div>

  <label className="block text-sm">Font chữ
    <select className="mt-1 h-10 w-full rounded border bg-background px-2" value={fontName} onChange={e=>setFontName(e.target.value as BlockFont)}>
      {Object.keys(C.FONTS).map(f=><option key={f}>{f}</option>)}
      {customFont ? <option value={CUSTOM_FONT_ID}>Font tuỳ chỉnh (đã tải lên)</option> : null}
    </select>
  </label>
  <input type="file" accept=".ttf,.otf" className="hidden" ref={fontInputRef} onChange={e=>{const file=e.target.files?.[0]; if(file) void handleFontUpload(file); e.target.value='';}} />
  <StorefrontButton type="button" variant="secondary" className="w-full text-sm" onClick={()=>fontInputRef.current?.click()}>Tải font lên...</StorefrontButton>

  <div>
    <p className="text-xs font-semibold uppercase text-muted-foreground">Switch</p>
    <div className="mt-1 inline-flex gap-1">
      {(['physical','3d-printed'] as const).map(t => (
        <button key={t} type="button" className={storefrontButtonClasses(t===switchType?'primary':'secondary','px-3 py-1.5 text-xs')} onClick={()=>setSwitchType(t)}>{t==='physical'?'Physical':'3D-printed'}</button>
      ))}
    </div>
  </div>

  <label className="flex items-center justify-between text-sm">Màu đế chung<input type="color" value={baseColor} onChange={e=>setBaseColor(e.target.value)}/></label>

  <div>
    <p className="text-xs font-semibold uppercase text-muted-foreground">Khối ({blocks.length})</p>
    <div className="mt-1 space-y-1.5">
      {blocks.map((block,i)=>(
        <div key={block.id} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
          <span className="w-5 shrink-0 text-center font-bold" aria-hidden>{block.char.startsWith('icon:')?'◇':block.char||'·'}</span>
          <select aria-label={`Ký tự khối ${i+1}`} className="h-8 flex-1 rounded border bg-background px-1" value={block.char} onChange={e=>changeBlock(i,{char:e.target.value})}>
            <option value="">(để trống)</option>
            <optgroup label="Số">{C.DIGIT_CHARS.map(d=><option key={d} value={d}>{d}</option>)}</optgroup>
            <optgroup label="Chữ">{C.LETTER_CHARS.map(l=><option key={l} value={l}>{l}</option>)}</optgroup>
            <optgroup label="Ký hiệu">{C.SYMBOL_CHARS.map(s=><option key={s} value={s}>{s}</option>)}</optgroup>
            <optgroup label="Icon">{Object.keys(C.ICON_PATHS).map(id=><option key={id} value={`icon:${id}`}>{id}</option>)}</optgroup>
          </select>
          <input aria-label={`Màu nền khối ${i+1}`} type="color" className="size-7 shrink-0 rounded border" value={block.blockColor} onChange={e=>changeBlock(i,{blockColor:e.target.value})}/>
          <input aria-label={`Màu chữ khối ${i+1}`} type="color" className="size-7 shrink-0 rounded border" value={block.glyphColor} onChange={e=>changeBlock(i,{glyphColor:e.target.value})}/>
        </div>
      ))}
    </div>
  </div>
</fieldset>
```

- [x] **Step 5: Confirm imports are complete**

At the top of the file, ensure these are present (add whichever are missing): `useRef` in the `react` import, `import * as opentype from 'opentype.js';`, and `import * as C from '@/lib/3d-tools/keychain-blocks/keychain-blocks-constants';` (already there). `storefrontButtonClasses` is already imported.

- [x] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. (`BlockFont` is `keyof typeof C.FONTS`; the `CUSTOM_FONT_ID as unknown as BlockFont` cast in Step 1/2 is deliberate — the custom font is a runtime-only sentinel value that doesn't need its own type-level branch.)

- [ ] **Step 7: Manual smoke test in the browser**

Run: `npm run dev`, open `/tools/keychain-blocks`.
Expected: typing a name updates the compact slot rows; switching Base Type re-renders the base (modular shows the pinched silhouette from Task 2); picking an icon from a slot's dropdown swaps its glyph; setting a slot to "(để trống)" removes its glyph; uploading a `.ttf` switches the preview to that font; Switch buttons toggle visually (no render change expected, per spec).

- [x] **Step 8: Commit**

```bash
git add "src/app/[locale]/(tools)/tools/keychain-blocks/keychain-blocks-workbench.tsx"
git commit -m "feat(keychain-blocks): compact slots list, base type, typeface upload, switch controls"
```

---

### Task 6: Carry `baseType`/`switchType` into export description + update the e2e spec

**Files:**
- Modify: `src/app/[locale]/(tools)/tools/keychain-blocks/keychain-blocks-workbench.tsx`
- Modify: `e2e/keychain-blocks.spec.ts`

**Interfaces:**
- Consumes: `baseType`, `switchType` state from Task 5.
- Produces: nothing consumed elsewhere — this is the last task.

- [x] **Step 1: Update the `sendRequest` description string**

Change:

```ts
description:`Móc khoá khối Compact: ${blocks.map(b=>b.char).join(' ')}; font ${fontName}; màu đế ${baseColor}; ${blocks.map((b,i)=>`khối ${i+1}: ${b.char}, nền ${b.blockColor}, chữ ${b.glyphColor}`).join('; ')}`
```

to:

```ts
description:`Móc khoá khối ${baseType==='modular'?'Modular':'Compact'}: ${blocks.map(b=>b.char).join(' ')}; font ${fontName}; switch ${switchType}; màu đế ${baseColor}; ${blocks.map((b,i)=>`khối ${i+1}: ${b.char}, nền ${b.blockColor}, chữ ${b.glyphColor}`).join('; ')}`
```

(Default state is `baseType='compact'`, `switchType='physical'`, so an unmodified form still produces `Móc khoá khối Compact: ... switch physical; ...` — the existing e2e regex `/Móc khoá khối Compact: B icon:heart S A; font Comfortaa/` still matches because it doesn't anchor past `font Comfortaa`.)

- [x] **Step 2: Update the e2e spec's icon-selection step for the merged dropdown**

In `e2e/keychain-blocks.spec.ts`, change:

```ts
await page.getByRole('combobox', { name: 'Icon khối 2', exact: true }).selectOption('icon:heart');
```

to:

```ts
await page.getByRole('combobox', { name: 'Ký tự khối 2', exact: true }).selectOption('icon:heart');
```

- [x] **Step 3: Run the full unit test suite once more**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Run the e2e spec if a full local environment (DATABASE_URL, Supabase env vars) is available**

Run: `npx playwright test e2e/keychain-blocks.spec.ts`
Expected: PASS. If the local environment doesn't have `DATABASE_URL`/Supabase configured, this step can't run here — note that in the task's completion summary rather than skipping silently, so a reviewer with full env access re-runs it before merge.

- [x] **Step 5: Commit**

```bash
git add "src/app/[locale]/(tools)/tools/keychain-blocks/keychain-blocks-workbench.tsx" e2e/keychain-blocks.spec.ts
git commit -m "feat(keychain-blocks): thread base/switch type into request description; update e2e selector"
```

---

## Self-Review Notes

- **Spec coverage:** viewport theme → Task 4; slot list layout → Task 5; Base Type → Task 2 (engine) + Task 5 (UI); Typeface + upload → Task 3 (fonts) + Task 5 (UI); Switch → Task 5 (UI) + Task 6 (metadata plumbing); blank/symbol slots → Task 1; default palette → Task 5 Step 1; icon parity → Task 1. All acceptance criteria in the spec map to a task.
- **Out-of-scope items** (Bubbly/Bubbly V2, switch-socket geometry, 4 missing icons) intentionally have no task — see Global Constraints.
- **Type consistency checked:** `KeychainBlockConfig` shape (`id, char, blockColor, glyphColor`) is unchanged end-to-end; `generateKeychainBlocksScene`'s new 4th parameter (`baseType: C.BaseType = 'compact'`) is additive and backward-compatible with any other caller; `BlockFont` stays `keyof typeof C.FONTS` with the custom-font path handled via a runtime sentinel rather than widening the type, avoiding a cascade of type changes through `loadBlocksFont`.
