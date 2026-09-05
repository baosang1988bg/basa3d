/** Run: node --import tsx scripts/phase-21-fixtures.ts /tmp/phase-21-fixtures */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as opentype from 'opentype.js';
import { disposeBlocksScene, generateKeychainBlocksScene, getBlocksExportParts } from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-engine';
import { exportBlocksStlZip, write3mf } from '../src/lib/3d-tools/common/3mf-writer';
const directory=resolve(process.argv[2]??'/tmp/phase-21-fixtures');mkdirSync(directory,{recursive:true});
const bytes=readFileSync('public/fonts/Comfortaa.ttf');
const font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer);
const colors=['#ff0000','#00ff00','#0000ff','#ffff00'];
const scene=generateKeychainBlocksScene(Array.from('BASA',(char,i)=>({id:`slot-${i+1}`,char,blockColor:colors[i],glyphColor:colors[i]})),font,colors[0]);
const parts=getBlocksExportParts(scene);
try {
  writeFileSync(resolve(directory,'BASA-four-colors.3mf'),write3mf(parts));
  writeFileSync(resolve(directory,'BASA-four-colors.zip'),exportBlocksStlZip(parts));
} finally {parts.forEach(p=>p.geometry.dispose());disposeBlocksScene(scene);}
console.log(`BASA fixtures written to ${directory}`);
