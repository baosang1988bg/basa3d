import * as THREE from 'three';
import { strToU8, zipSync } from 'fflate';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type ExportPart = { geometry: THREE.BufferGeometry; colorHex: string; name: string };
const xml = (text: string) => text.replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' })[c]!);
function validate(parts: ExportPart[]) {
  if (!parts.length) throw new RangeError('Không có hình học để xuất.');
  for (const part of parts) {
    if (!/^#[a-f\d]{6}$/i.test(part.colorHex)) throw new RangeError('Màu không hợp lệ.');
    const p=part.geometry.getAttribute('position'), index=part.geometry.getIndex();
    if (!p || p.itemSize!==3 || !p.count || (index?.count??p.count)%3) throw new RangeError('Hình học tam giác không hợp lệ.');
    for (let i=0;i<p.count;i++) if (![p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite)) throw new RangeError('Toạ độ không hữu hạn.');
    if (index) for (let i=0;i<index.count;i++) if (!Number.isInteger(index.getX(i)) || index.getX(i)<0 || index.getX(i)>=p.count) throw new RangeError('Chỉ số đỉnh không hợp lệ.');
  }
}
/**
 * ADR-0051: opt-in Bambu Studio metadata. `extruders[i]` (1-based) is the filament slot for `parts[i]`;
 * when given, Metadata/model_settings.config is added so the slicer maps each part to its AMS slot.
 * Omitted (the default) keeps the package byte-identical to the pre-ADR-0051 output.
 */
export type Write3mfOptions = { extruders?: number[] };
export const MAX_EXTRUDERS = 16;
/** One slot per distinct color, in first-seen order — the same order as the colorgroup. */
export function extrudersByColor(parts: Pick<ExportPart, 'colorHex'>[]): number[] {
  const colors=[...new Set(parts.map(p=>p.colorHex.toUpperCase()))];
  return parts.map(p=>colors.indexOf(p.colorHex.toUpperCase())+1);
}
function modelSettings(parts: ExportPart[], extruders: number[], assemblyId: number, assemblyName: string): string {
  if (extruders.length!==parts.length) throw new RangeError('Số extruder phải bằng số phần.');
  if (!extruders.every(e=>Number.isInteger(e)&&e>=1&&e<=MAX_EXTRUDERS)) throw new RangeError(`Extruder phải là số nguyên 1–${MAX_EXTRUDERS}.`);
  const partXml=parts.map((part,i)=>`<part id="${i+2}" subtype="normal_part"><metadata key="name" value="${xml(part.name)}"/><metadata key="extruder" value="${extruders[i]}"/></part>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><config><object id="${assemblyId}"><metadata key="name" value="${xml(assemblyName)}"/><metadata key="extruder" value="${extruders[0]}"/>${partXml}</object></config>`;
}
/** One colored object per solid part; one assembly keeps all parts registered on the plate. */
export function write3mf(parts: ExportPart[], assemblyName = 'Compact keychain', options: Write3mfOptions = {}): Uint8Array {
  validate(parts);
  const colors=[...new Set(parts.map(p=>p.colorHex.toUpperCase()))];
  const objects=parts.map((part,i)=>{
    const p=part.geometry.getAttribute('position'), index=part.geometry.getIndex();
    const vertices=Array.from({length:p.count},(_,v)=>`<vertex x="${p.getX(v)}" y="${p.getY(v)}" z="${p.getZ(v)}"/>`).join('');
    const triangles=Array.from({length:(index?.count??p.count)/3},(_,t)=>`<triangle v1="${index?index.getX(t*3):t*3}" v2="${index?index.getX(t*3+1):t*3+1}" v3="${index?index.getX(t*3+2):t*3+2}"/>`).join('');
    return `<object id="${i+2}" type="model" name="${xml(part.name)}" pid="1" pindex="${colors.indexOf(part.colorHex.toUpperCase())}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
  }).join('');
  const assemblyId=parts.length+2;
  const model=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"><resources><m:colorgroup id="1">${colors.map(color=>`<m:color color="${color}"/>`).join('')}</m:colorgroup>${objects}<object id="${assemblyId}" type="model" name="${xml(assemblyName)}"><components>${parts.map((_,i)=>`<component objectid="${i+2}"/>`).join('')}</components></object></resources><build><item objectid="${assemblyId}"/></build></model>`;
  const settings=options.extruders ? modelSettings(parts,options.extruders,assemblyId,assemblyName) : null;
  const override=settings ? '<Override PartName="/Metadata/model_settings.config" ContentType="text/xml"/>' : '';
  return zipSync({
    '[Content_Types].xml':strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>${override}</Types>`),
    '_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model':strToU8(model),
    ...(settings ? { 'Metadata/model_settings.config':strToU8(settings) } : {}),
  });
}
/** Base plus one STL per cap/glyph pair, retaining their assembly coordinates. */
export function exportBlocksStlZip(parts: ExportPart[]): Uint8Array {
  validate(parts); const files: Record<string,Uint8Array>={};
  const grouped = new Map<string, ExportPart[]>();
  for (const part of parts) {
    const key=part.name.replace(/-(block|glyph)$/,'');
    grouped.set(key,[...(grouped.get(key)??[]),part]);
  }
  let i=0;
  for (const group of grouped.values()) {
    const inputs=group.map(p=>p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone());
    const geometry=mergeGeometries(inputs,false); inputs.forEach(g=>g.dispose());
    if (!geometry) throw new Error('Không thể gộp STL.');
    try { const data=new STLExporter().parse(new THREE.Mesh(geometry),{binary:true}); files[`${String(i++).padStart(2,'0')}-${i===1?'compact-base':'block'}.stl`]=new Uint8Array(data.buffer,data.byteOffset,data.byteLength); }
    finally { geometry.dispose(); }
  }
  return zipSync(files);
}
