import assert from 'node:assert/strict';
import test from 'node:test';
import { trackKeychainBlocksPreview, trackKeychainBlocksExportDownload, trackKeychainBlocksExportToRequest } from '../src/lib/analytics';

test('block tool analytics emits approved event names and counts without the personalized design',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');const dataLayer:IArguments[]=[];
  Object.defineProperty(globalThis,'window',{configurable:true,value:{dataLayer}});
  try {
    trackKeychainBlocksPreview({blockCount:4});
    trackKeychainBlocksExportDownload({blockCount:4,format:'3mf'});
    trackKeychainBlocksExportToRequest({blockCount:4,format:'stl'});
    assert.deepEqual(dataLayer.map(entry=>Array.from(entry)),[
      ['event','tool_keychain_blocks_preview',{block_count:4}],
      ['event','tool_keychain_blocks_export_download',{block_count:4,format:'3mf'}],
      ['event','tool_keychain_blocks_export_to_request',{block_count:4,format:'stl'}],
    ]);
  } finally {if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
