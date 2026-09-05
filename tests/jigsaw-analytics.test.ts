import assert from 'node:assert/strict';
import test from 'node:test';
import { trackJigsawPreview, trackJigsawExportDownload, trackJigsawExportToRequest } from '../src/lib/analytics';

test('jigsaw analytics emits approved event names and piece count without the uploaded model', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window'); const dataLayer: IArguments[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dataLayer } });
  try {
    trackJigsawPreview({ pieceCount: 4 });
    trackJigsawExportDownload({ pieceCount: 4, format: '3mf' });
    trackJigsawExportToRequest({ pieceCount: 4 });
    assert.deepEqual(dataLayer.map(entry => Array.from(entry)), [
      ['event', 'tool_jigsaw_preview', { piece_count: 4 }],
      ['event', 'tool_jigsaw_export_download', { piece_count: 4, format: '3mf' }],
      ['event', 'tool_jigsaw_export_to_request', { piece_count: 4 }],
    ]);
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});
