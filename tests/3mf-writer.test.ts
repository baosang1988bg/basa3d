import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { write3mf, exportBlocksStlZip } from '../src/lib/3d-tools/common/3mf-writer';
const parser=new XMLParser({ignoreAttributes:false});
test('3MF OPC package contains object-level colors and a registered assembly without triangle colors',()=>{
  const geometry=new BoxGeometry(12,12,8);
  try {
    const parts=['#ff0000','#00ff00','#0000ff','#ff0000'].map((colorHex,i)=>({geometry,colorHex,name:`slot-${i}<"&`}));
    const files=unzipSync(write3mf(parts));assert.deepEqual(Object.keys(files).sort(),['3D/3dmodel.model','[Content_Types].xml','_rels/.rels']);
    for(const file of Object.values(files))assert.equal(XMLValidator.validate(strFromU8(file)),true);
    const model=parser.parse(strFromU8(files['3D/3dmodel.model'])).model;
    assert.equal(model['@_unit'],'millimeter');assert.equal(model['@_xmlns:m'],'http://schemas.microsoft.com/3dmanufacturing/material/2015/02');
    assert.deepEqual(model.resources['m:colorgroup']['m:color'].map((c:Record<string,string>)=>c['@_color']),['#FF0000','#00FF00','#0000FF']);
    const objects=model.resources.object;assert.equal(objects.length,5);
    for(let i=0;i<4;i++) {
      assert.equal(objects[i]['@_pid'],'1');assert.equal(objects[i]['@_pindex'],String(i%3));assert.equal(objects[i]['@_name'],parts[i].name);
      assert.equal(objects[i].mesh.triangles.triangle.length,12);
      for(const triangle of objects[i].mesh.triangles.triangle)assert.deepEqual(Object.keys(triangle).sort(),['@_v1','@_v2','@_v3']);
    }
    assert.equal(objects[4].components.component.length,4);assert.equal(model.build.item['@_objectid'],objects[4]['@_id']);
    const rel=parser.parse(strFromU8(files['_rels/.rels']));assert.equal(rel.Relationships.Relationship['@_Target'],'/3D/3dmodel.model');
  } finally {geometry.dispose();}
});
test('STL zip contains base and one binary STL per block including its glyph',()=>{
  const geometry=new BoxGeometry(12,12,8);
  try {
    const files=unzipSync(exportBlocksStlZip(['compact-base','slot-1-block','slot-1-glyph','slot-2-block','slot-2-glyph'].map(name=>({geometry,colorHex:'#ffffff',name}))));
    assert.equal(Object.keys(files).length,3);
    for(const [name,bytes] of Object.entries(files)) {
      assert.match(name,/^\d{2}-(compact-base|block)\.stl$/);
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const triangles=view.getUint32(80,true);assert.equal(triangles,name.includes('base')?12:24);assert.equal(bytes.length,84+50*triangles);
    }
  } finally {geometry.dispose();}
});
test('writer rejects empty/invalid geometry, indices and colors',()=>{
  assert.throws(()=>write3mf([]));
  const geometry=new BufferGeometry();
  assert.throws(()=>write3mf([{geometry,colorHex:'#ffffff',name:'x'}]));
  geometry.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,NaN],3));
  assert.throws(()=>write3mf([{geometry,colorHex:'#ffffff',name:'x'}]));
  geometry.dispose();
  const box=new BoxGeometry();assert.throws(()=>write3mf([{geometry:box,colorHex:'red',name:'x'}]));box.setIndex([0,1,999]);assert.throws(()=>write3mf([{geometry:box,colorHex:'#ffffff',name:'x'}]));box.dispose();
});
