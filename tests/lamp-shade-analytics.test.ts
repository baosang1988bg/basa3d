import assert from 'node:assert/strict';
import test from 'node:test';
import { trackLampPreview, trackLampExportDownload, trackLampExportToRequest } from '../src/lib/analytics';

test('lamp shade analytics emits approved event names and pattern without the full design', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window'); const dataLayer: IArguments[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dataLayer } });
  try {
    trackLampPreview({ pattern: 'circle' });
    trackLampExportDownload({ pattern: 'circle', format: '3mf' });
    trackLampExportToRequest({ pattern: 'circle' });
    assert.deepEqual(dataLayer.map(entry => Array.from(entry)), [
      ['event', 'tool_lamp_preview', { pattern: 'circle' }],
      ['event', 'tool_lamp_export_download', { pattern: 'circle', format: '3mf' }],
      ['event', 'tool_lamp_export_to_request', { pattern: 'circle' }],
    ]);
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});
