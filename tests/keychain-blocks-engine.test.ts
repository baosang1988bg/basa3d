import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as opentype from 'opentype.js';
import * as THREE from 'three';
import { calculateMeshVolumeCm3 } from '../src/lib/pricing/mesh-estimator';
import { buildCompactBaseMesh, buildSingleBlockMesh, disposeBlocksScene, generateKeychainBlocksScene, getBlocksExportParts, type KeychainBlockConfig } from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-engine';
import * as C from '../src/lib/3d-tools/keychain-blocks/keychain-blocks-constants';
const font = opentype.parse(readFileSync('public/fonts/BeVietnamPro-Regular.ttf').buffer as ArrayBuffer);
const block: KeychainBlockConfig = {id:'a',char:'Ấ',blockColor:'#123456',glyphColor:'#ffffff'};

test('both licensed fonts cover Vietnamese including uppercase and lowercase tone combinations',()=>{
  const vowels='aăâeêioôơuưy'; const tones=['','\u0300','\u0301','\u0303','\u0309','\u0323'];
  for(const file of Object.values(C.FONTS)) {
    const bytes=readFileSync(`public${file}`);const f=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer);
    for(const char of [...vowels].flatMap(v=>tones.flatMap(t=>[(v+t).normalize('NFC'),(v+t).normalize('NFC').toUpperCase()])).concat(['đ','Đ'])) assert.ok(f.charToGlyphIndex(char)>0,`${file}: ${char}`);
  }
});
test('all characters and curated icons produce finite positive-volume cap and glyph meshes',()=>{
  for(const char of ['A','B','0','Đ','ộ','a\u0301',...Object.keys(C.ICON_PATHS).map(id=>`icon:${id}`)]) {
    const group=buildSingleBlockMesh({...block,char},font);
    try {
      assert.equal(group.children.length,2);
      for(const object of group.children) {
        const g=(object as THREE.Mesh).geometry; const p=g.getAttribute('position');assert.ok([...p.array].every(Number.isFinite)); assert.ok(calculateMeshVolumeCm3(g)>0);
        g.computeBoundingBox(); assert.ok(g.boundingBox!.min.x>=-1e-5);assert.ok(g.boundingBox!.max.x<=C.BLOCK_WIDTH_MM+1e-5);assert.ok(g.boundingBox!.min.y>=-1e-5);assert.ok(g.boundingBox!.max.y<=C.BLOCK_DEPTH_MM+1e-5);
      }
      const cap=(group.children[0] as THREE.Mesh).geometry.boundingBox!,glyph=(group.children[1] as THREE.Mesh).geometry.boundingBox!;
      assert.ok(Math.abs(cap.max.z-cap.min.z-C.BLOCK_HEIGHT_MM)<1e-5);
      assert.ok(Math.abs(cap.min.z-(C.BASE_THICKNESS_MM-C.OVERLAP_MM))<1e-5);
      assert.ok(Math.abs(glyph.max.z-cap.max.z-C.GLYPH_EMBOSS_HEIGHT_MM)<1e-5);
      assert.ok(glyph.min.z<cap.max.z);
    } finally {disposeBlocksScene(group);}
  }
});
test('compact base dimensions, spacing, hole and max build plate envelope',()=>{
  for(const count of [1,C.MAX_BLOCKS]) {
    const group=generateKeychainBlocksScene(Array.from({length:count},(_,i)=>({...block,id:`slot-${i}`})),font);
    try {
      const base=(group.children[0] as THREE.Mesh).geometry; base.computeBoundingBox();const b=base.boundingBox!;
      assert.equal(b.min.x,-2*C.KEYRING_TAB_RADIUS_MM);assert.equal(b.max.y,C.BLOCK_DEPTH_MM);assert.equal(b.max.z,C.BASE_THICKNESS_MM);
      assert.ok(Math.abs(b.max.x-(count*C.BLOCK_WIDTH_MM+(count-1)*C.BLOCK_GAP_MM))<1e-4);
      assert.ok(b.max.x-b.min.x<220);
      for(let i=0;i<count;i++)assert.equal(group.children[i+1].position.x,i*(C.BLOCK_WIDTH_MM+C.BLOCK_GAP_MM));
      const ray=new THREE.Raycaster(new THREE.Vector3(-C.KEYRING_TAB_RADIUS_MM,C.BLOCK_DEPTH_MM/2,20),new THREE.Vector3(0,0,-1));
      assert.equal(ray.intersectObject(group.children[0]).length,0);
      ray.ray.origin.x+=C.KEYRING_HOLE_DIAMETER_MM/2+0.25;assert.ok(ray.intersectObject(group.children[0]).length>0);
      const parts=getBlocksExportParts(group);assert.equal(parts.length,1+count*2);parts.forEach(p=>p.geometry.dispose());
    } finally {disposeBlocksScene(group);}
  }
});
test('engine rejects invalid counts, unsupported characters/icons, colors and duplicate IDs',()=>{
  for(const count of [0,17,NaN,Infinity,1.5,-1])assert.throws(()=>buildCompactBaseMesh(count,'#ffffff'));
  assert.throws(()=>generateKeychainBlocksScene(Array.from({length:17},(_,i)=>({...block,id:`${i}`})),font));
  assert.throws(()=>generateKeychainBlocksScene([block,block],font));
  for(const char of ['', 'AB',' ','😀','icon:unknown','icon:__proto__','Ж'])assert.throws(()=>buildSingleBlockMesh({...block,char},font));
  for(const color of ['red','#fff','#12345678','<bad>']) {
    assert.throws(()=>buildSingleBlockMesh({...block,blockColor:color},font));assert.throws(()=>buildSingleBlockMesh({...block,glyphColor:color},font));assert.throws(()=>generateKeychainBlocksScene([block],font,color));
  }
  for(const id of ['', 'x'.repeat(65)])assert.throws(()=>buildSingleBlockMesh({...block,id},font));
});
