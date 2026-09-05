import assert from 'node:assert/strict';
import test from 'node:test';
import { trackOrganizerPreview, trackOrganizerExportDownload, trackOrganizerExportToRequest } from '../src/lib/analytics';

test('organizer tool analytics emits approved event names and grid dimensions',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');const dataLayer:IArguments[]=[];
  Object.defineProperty(globalThis,'window',{configurable:true,value:{dataLayer}});
  try {
    trackOrganizerPreview({rows:3,cols:4});
    trackOrganizerExportDownload({rows:3,cols:4});
    trackOrganizerExportToRequest({rows:3,cols:4});
    assert.deepEqual(dataLayer.map(entry=>Array.from(entry)),[
      ['event','tool_organizer_preview',{rows:3,cols:4}],
      ['event','tool_organizer_export_download',{rows:3,cols:4}],
      ['event','tool_organizer_export_to_request',{rows:3,cols:4}],
    ]);
  } finally {if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
