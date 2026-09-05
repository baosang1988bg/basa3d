import assert from 'node:assert/strict';
import test from 'node:test';
import { trackDualTextPreview, trackDualTextExportDownload, trackDualTextExportToRequest } from '../src/lib/analytics';

test('dual text analytics emits approved event names and counts without the personalized design', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window'); const dataLayer: IArguments[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dataLayer } });
  try {
    trackDualTextPreview({ blockCount: 4 });
    trackDualTextExportDownload({ blockCount: 4, format: '3mf' });
    trackDualTextExportToRequest({ blockCount: 4 });
    assert.deepEqual(dataLayer.map(entry => Array.from(entry)), [
      ['event', 'tool_dual_text_preview', { block_count: 4 }],
      ['event', 'tool_dual_text_export_download', { block_count: 4, format: '3mf' }],
      ['event', 'tool_dual_text_export_to_request', { block_count: 4 }],
    ]);
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});
