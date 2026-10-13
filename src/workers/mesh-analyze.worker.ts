// Phase 33 S6 (T1): analyse an STL/OBJ in the browser, off the main thread. Returns the shared mesh
// metrics (same code the server re-runs at submit) and, for files small enough to preview, the
// triangle positions as a transferable Float32Array. Nothing is uploaded here.
import { MeshMetricsError, parseObjMetrics, parseStlMetrics, type MeshMetrics } from '../lib/pricing/mesh-metrics';
import { objPositions, stlPositions } from '../lib/pricing/mesh-positions';
import { PREVIEW_MAX_TRIANGLES } from '../config/bao-gia';

export type MeshAnalyzeRequest = { id: string; file: File };
export type MeshAnalyzeResponse =
  | { id: string; ok: true; metrics: MeshMetrics; positions: Float32Array | null }
  | { id: string; ok: false; code: string; message: string };

// Minimal typing of the worker global (the project's tsconfig uses the DOM lib, not "webworker").
type WorkerScope = {
  onmessage: ((event: MessageEvent<MeshAnalyzeRequest>) => void) | null;
  postMessage: (message: MeshAnalyzeResponse, transfer?: Transferable[]) => void;
};
const scope = self as unknown as WorkerScope;

scope.onmessage = async (event: MessageEvent<MeshAnalyzeRequest>) => {
  const { id, file } = event.data;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isObj = file.name.toLowerCase().endsWith('.obj');
    const metrics = isObj ? parseObjMetrics(bytes) : parseStlMetrics(bytes);
    const positions = metrics.triangles <= PREVIEW_MAX_TRIANGLES ? (isObj ? objPositions(bytes) : stlPositions(bytes)) : null;
    const response: MeshAnalyzeResponse = { id, ok: true, metrics, positions };
    scope.postMessage(response, positions ? [positions.buffer] : []);
  } catch (error) {
    const response: MeshAnalyzeResponse = error instanceof MeshMetricsError
      ? { id, ok: false, code: error.code, message: error.message }
      : { id, ok: false, code: 'UNREADABLE', message: 'Không đọc được file này.' };
    scope.postMessage(response);
  }
};
