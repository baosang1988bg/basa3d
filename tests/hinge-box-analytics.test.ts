import assert from 'node:assert/strict';
import test from 'node:test';
import { trackHingeBoxPreview, trackHingeBoxExportDownload, trackHingeBoxExportToRequest } from '../src/lib/analytics';

test('hinge box analytics emits approved event names and grid size without the personalized design', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window'); const dataLayer: IArguments[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dataLayer } });
  try {
    trackHingeBoxPreview({ rows: 2, cols: 2 });
    trackHingeBoxExportDownload({ rows: 2, cols: 2, format: '3mf' });
    trackHingeBoxExportToRequest({ rows: 2, cols: 2 });
    assert.deepEqual(dataLayer.map(entry => Array.from(entry)), [
      ['event', 'tool_hinge_box_preview', { rows: 2, cols: 2 }],
      ['event', 'tool_hinge_box_export_download', { rows: 2, cols: 2, format: '3mf' }],
      ['event', 'tool_hinge_box_export_to_request', { rows: 2, cols: 2 }],
    ]);
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});
