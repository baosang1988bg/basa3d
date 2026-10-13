// Phase 33 S0 — tiny synthetic sliced .3mf files so the calibration script runs in CI without the
// Owner's real files. NOT a stand-in for real calibration data.
import { strToU8, zipSync } from 'fflate';

export type SyntheticPart = {
  /** Edge lengths of an axis-aligned box mesh, in mm (before the build-item transform). */
  boxMm: [number, number, number];
  /** 3MF build-item transform (12 numbers). Defaults to identity. */
  transform?: number[];
};

export type SyntheticFile = {
  parts: SyntheticPart[];
  grams: number;
  minutes: number;
  infillPct: number;
  layerHeightMm?: number;
  material?: string;
  plates?: number;
  /** Put the mesh in 3D/Objects/object_1.model referenced through <components> (Bambu layout). */
  bambuLayout?: boolean;
};

function boxMesh([x, y, z]: [number, number, number]): string {
  const v = [[0, 0, 0], [x, 0, 0], [x, y, 0], [0, y, 0], [0, 0, z], [x, 0, z], [x, y, z], [0, y, z]];
  const t = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 6, 2], [3, 7, 6], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  return `<mesh><vertices>${v.map((p) => `<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`).join('')}</vertices>`
    + `<triangles>${t.map((tri) => `<triangle v1="${tri[0]}" v2="${tri[1]}" v3="${tri[2]}"/>`).join('')}</triangles></mesh>`;
}

export function buildSyntheticSliced3mf(spec: SyntheticFile): Uint8Array {
  const material = spec.material ?? 'PLA';
  const plates = spec.plates ?? 1;
  const files: Record<string, Uint8Array> = {};
  const objects: string[] = [];
  const items: string[] = [];
  const subObjects: string[] = [];
  spec.parts.forEach((part, index) => {
    const id = index + 1;
    const transform = part.transform ? ` transform="${part.transform.join(' ')}"` : '';
    if (spec.bambuLayout) {
      subObjects.push(`<object id="${100 + id}" type="model">${boxMesh(part.boxMm)}</object>`);
      objects.push(`<object id="${id}" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="${100 + id}"/></components></object>`);
    } else {
      objects.push(`<object id="${id}" type="model">${boxMesh(part.boxMm)}</object>`);
    }
    items.push(`<item objectid="${id}"${transform}/>`);
  });
  const ns = 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"';
  files['3D/3dmodel.model'] = strToU8(`<?xml version="1.0"?><model unit="millimeter" ${ns}><resources>${objects.join('')}</resources><build>${items.join('')}</build></model>`);
  if (spec.bambuLayout) files['3D/Objects/object_1.model'] = strToU8(`<?xml version="1.0"?><model unit="millimeter" ${ns}><resources>${subObjects.join('')}</resources></model>`);
  const plateXml = Array.from({ length: plates }, (_, i) => `<plate><metadata key="index" value="${i + 1}"/><metadata key="prediction" value="${Math.round((spec.minutes * 60) / plates)}"/>`
    + `<filament id="1" type="${material}" color="#FFFFFF" used_m="1" used_g="${(spec.grams / plates).toFixed(2)}"/></plate>`).join('');
  files['Metadata/slice_info.config'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><config><header><header_item key="X-BBL-Client-Type" value="slicer"/></header>${plateXml}</config>`);
  files['Metadata/project_settings.config'] = strToU8(JSON.stringify({
    layer_height: String(spec.layerHeightMm ?? 0.2),
    sparse_infill_density: `${spec.infillPct}%`,
    wall_loops: '2', top_shell_layers: '5', bottom_shell_layers: '3', outer_wall_line_width: '0.42',
    enable_support: '0', filament_type: [material],
  }));
  return zipSync(files);
}
