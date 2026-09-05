import assert from 'node:assert/strict';
import test from 'node:test';
import { trackCarPreview, trackCarExportDownload, trackCarExportToRequest } from '../src/lib/analytics';

test('car nameplate analytics emits approved event names and dimensions without the personalized design', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window'); const dataLayer: IArguments[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dataLayer } });
  try {
    trackCarPreview({ widthMm: 90 });
    trackCarExportDownload({ widthMm: 90, format: '3mf' });
    trackCarExportToRequest({ widthMm: 90 });
    assert.deepEqual(dataLayer.map(entry => Array.from(entry)), [
      ['event', 'tool_car_preview', { width_mm: 90 }],
      ['event', 'tool_car_export_download', { width_mm: 90, format: '3mf' }],
      ['event', 'tool_car_export_to_request', { width_mm: 90 }],
    ]);
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});
