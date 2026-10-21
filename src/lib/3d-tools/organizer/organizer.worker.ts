/**
 * Phase 45 — Organizer geometry worker. Loads manifold-3d (WASM) once, builds on request, and posts
 * transferable typed arrays back. Requests carry an id; the client ignores stale replies.
 * Only organizer-worker-client.ts may reference this file (via `new Worker(new URL(...))`).
 */
import Module from 'manifold-3d';
import * as opentype from 'opentype.js';
import type { Font } from 'opentype.js';
import { buildOrganizer } from './organizer-geometry';
import { textToPolygons } from './organizer-label-text';
import { normalizeLabelParams, normalizeOrganizerParams, type WarningKey } from './organizer-params';
import { DEFAULT_LABEL_FONT_URL, type OrganizerWorkerRequest, type OrganizerWorkerResponse } from './organizer-worker-protocol';

// The project compiles with the DOM lib only; describe the worker global we use instead of mixing in
// the "webworker" lib (the two conflict in one program).
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<OrganizerWorkerRequest>) => void) | null;
  postMessage: (message: OrganizerWorkerResponse, transfer?: Transferable[]) => void;
};
const manifold = Module().then((module) => { module.setup(); return module; });
let customFont: Font | null = null;
let defaultFont: Promise<Font> | null = null;

function labelFont(): Promise<Font> {
  if (customFont) return Promise.resolve(customFont);
  defaultFont ??= fetch(DEFAULT_LABEL_FONT_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`font ${response.status}`);
      return response.arrayBuffer();
    })
    .then((buffer) => opentype.parse(buffer))
    .catch((error: unknown) => { defaultFont = null; throw error; });
  return defaultFont;
}

async function handle(request: OrganizerWorkerRequest) {
  if (request.type === 'font') {
    try { customFont = request.bytes ? opentype.parse(request.bytes) : null; }
    catch { customFont = null; }
    return;
  }
  try {
    const api = await manifold;
    const { params, warnings } = normalizeOrganizerParams(request.params);
    const label = request.label ? normalizeLabelParams(request.label) : null;
    let polygons: [number, number][][] | null = null;
    if (label?.enabled && label.text.trim()) polygons = textToPolygons(await labelFont(), label.text, label.fontSize);
    const result = buildOrganizer(api, params, label, polygons);
    const allWarnings: WarningKey[] = label?.enabled && !result.labelFits ? [...warnings, 'warn.labelNoFit'] : warnings;
    const transfer: Transferable[] = [];
    const add = (mesh: { positions: Float32Array; indices: Uint32Array } | null) => {
      if (mesh) transfer.push(mesh.positions.buffer as ArrayBuffer, mesh.indices.buffer as ArrayBuffer);
    };
    add(result.bin); add(result.label?.plate ?? null); add(result.label?.text ?? null);
    scope.postMessage({ id: request.id, ok: true, params, warnings: allWarnings, ...result }, transfer);
  } catch (error) {
    scope.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

scope.onmessage = (event) => { void handle(event.data); };
