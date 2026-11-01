import * as THREE from 'three';
import { strToU8, zipSync } from 'fflate';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import type { BookLayoutPart, BookDesignModifier, BookMakerConfig } from './book-maker-types';
import type { UnpackedModelMap } from './afk2-decoder';
import { layoutBookCoverFlat, layoutBookPagesFlat, type AssembledBookPart } from './book-maker-geometry';

const xmlEsc = (text: string) =>
  text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);

/**
 * Builds a multi-plate Bambu Studio & OrcaSlicer-ready 3MF project package.
 * Plate 1: Cover Assembly (flat, centered on build bed, AMS multi-color modifier meshes on layer 1-4).
 * Plate 2: Pages 1 to 6 (arranged in non-overlapping 3x2 grid).
 * Plate 3: Pages 7 to N (if pages > 6).
 */
export function exportBookToBambuMultiPlate3mf(
  coverParts: BookLayoutPart[],
  pageParts: BookLayoutPart[],
  bookTitle = 'BaSa3D Photo Book',
): Uint8Array {
  const allParts = [...coverParts, ...pageParts];
  if (!allParts.length) throw new RangeError('Không có hình học để xuất.');

  const distinctColors = [...new Set(allParts.map(p => p.colorHex.toUpperCase()))];
  const coverSubparts = coverParts.filter(p => p.isCoverSubpart);
  const coverAssemblyId = allParts.length + 2;

  // 1. Generate 3D/3dmodel.model
  const meshObjectsXml = allParts.map((part, index) => {
    const objectId = index + 2;
    const pos = part.geometry.getAttribute('position');
    const idxAttr = part.geometry.getIndex();

    const vertices = Array.from({ length: pos.count }, (_, v) =>
      `<vertex x="${pos.getX(v).toFixed(4)}" y="${pos.getY(v).toFixed(4)}" z="${pos.getZ(v).toFixed(4)}"/>`,
    ).join('');

    const triCount = (idxAttr ? idxAttr.count : pos.count) / 3;
    const triangles = Array.from({ length: triCount }, (_, t) =>
      `<triangle v1="${idxAttr ? idxAttr.getX(t * 3) : t * 3}" v2="${idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1}" v3="${idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2}"/>`,
    ).join('');

    const pindex = distinctColors.indexOf(part.colorHex.toUpperCase());
    return `<object id="${objectId}" type="model" name="${xmlEsc(part.name)}" pid="1" pindex="${pindex}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
  }).join('');

  // Cover assembly grouping Back + Spine + Front + any color modifier meshes
  const coverAssemblyXml = `<object id="${coverAssemblyId}" type="model" name="${xmlEsc(bookTitle)} - Bìa sách"><components>${coverSubparts.map((_, i) => `<component objectid="${i + 2}"/>`).join('')}</components></object>`;

  // Build items: Cover assembly on Plate 1, and each individual page on Plate 2/3
  const pageBuildItemsXml = pageParts.map((_, idx) => `<item objectid="${coverSubparts.length + idx + 2}"/>`).join('');
  const buildItemsXml = `<item objectid="${coverAssemblyId}"/>${pageBuildItemsXml}`;

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"><resources><m:colorgroup id="1">${distinctColors.map(c => `<m:color color="${c}"/>`).join('')}</m:colorgroup>${meshObjectsXml}${coverAssemblyXml}</resources><build>${buildItemsXml}</build></model>`;

  // 2. Generate Metadata/model_settings.config for Bambu Studio / OrcaSlicer plates
  const maxPlaterId = Math.max(...allParts.map(p => p.platerId), 1);
  const plateXml = Array.from({ length: maxPlaterId }, (_, i) => {
    const platerId = i + 1;
    let label = `Đĩa ${platerId} - `;
    let instancesXml = '';

    if (platerId === 1) {
      label += 'Bìa sách mở phẳng (AMS)';
      instancesXml = `<model_instance><metadata key="object_id" value="${coverAssemblyId}"/><metadata key="instance_id" value="0"/></model_instance>`;
    } else {
      const platePages = pageParts
        .map((p, idx) => ({ part: p, pageIndex: idx }))
        .filter(item => item.part.platerId === platerId);

      if (platePages.length > 0) {
        const firstNum = platePages[0].pageIndex + 1;
        const lastNum = platePages[platePages.length - 1].pageIndex + 1;
        label += firstNum === lastNum ? `Trang ruột (${firstNum})` : `Trang ruột (${firstNum}-${lastNum})`;

        instancesXml = platePages.map(item => {
          const pageObjectId = coverSubparts.length + item.pageIndex + 2;
          return `<model_instance><metadata key="object_id" value="${pageObjectId}"/><metadata key="instance_id" value="0"/></model_instance>`;
        }).join('');
      } else {
        label += 'Trang ruột';
      }
    }

    return `<plate><metadata key="plater_id" value="${platerId}"/><metadata key="plater_name" value="${xmlEsc(label)}"/><metadata key="locked" value="false"/>${instancesXml}</plate>`;
  }).join('');

  // Cover assembly object in model_settings.config
  const coverSubpartsXml = coverSubparts.map((p, i) =>
    `<part id="${i + 2}" subtype="normal_part"><metadata key="name" value="${xmlEsc(p.name)}"/><metadata key="extruder" value="${p.extruder}"/></part>`,
  ).join('');

  const coverObjectXml = `<object id="${coverAssemblyId}"><metadata key="name" value="${xmlEsc(bookTitle)} - Bìa"/><metadata key="plater_id" value="1"/><metadata key="extruder" value="${coverSubparts[0]?.extruder || 1}"/>${coverSubpartsXml}</object>`;

  // Page objects in model_settings.config
  const pageObjectsXml = pageParts.map((p, idx) => {
    const objectId = coverSubparts.length + idx + 2;
    return `<object id="${objectId}"><metadata key="name" value="${xmlEsc(p.name)}"/><metadata key="plater_id" value="${p.platerId}"/><metadata key="extruder" value="${p.extruder}"/><part id="${objectId}" subtype="normal_part"><metadata key="name" value="${xmlEsc(p.name)}"/><metadata key="extruder" value="${p.extruder}"/></part></object>`;
  }).join('');

  const settingsXml = `<?xml version="1.0" encoding="UTF-8"?><config>${plateXml}${coverObjectXml}${pageObjectsXml}</config>`;

  const zipFiles: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="json" ContentType="application/json"/><Override PartName="/Metadata/model_settings.config" ContentType="text/xml"/></Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(modelXml),
    'Metadata/model_settings.config': strToU8(settingsXml),
  };

  for (let pId = 1; pId <= maxPlaterId; pId++) {
    zipFiles[`Metadata/plate_${pId}.json`] = strToU8(JSON.stringify({
      bed_type: 'textured_plate',
      version: 2,
    }));
  }

  return zipSync(zipFiles);
}

/**
 * Exports just the Cover Assembly flat on the bed (Plate 1) with all AMS color modifiers.
 */
export function exportCoverFlat3mf(
  coverParts: BookLayoutPart[],
  bookTitle = 'BaSa3D Photo Book Cover',
): Uint8Array {
  const distinctColors = [...new Set(coverParts.map(p => p.colorHex.toUpperCase()))];
  const assemblyId = coverParts.length + 2;

  const meshObjectsXml = coverParts.map((part, index) => {
    const objectId = index + 2;
    const pos = part.geometry.getAttribute('position');
    const idxAttr = part.geometry.getIndex();

    const vertices = Array.from({ length: pos.count }, (_, v) =>
      `<vertex x="${pos.getX(v).toFixed(4)}" y="${pos.getY(v).toFixed(4)}" z="${pos.getZ(v).toFixed(4)}"/>`,
    ).join('');

    const triCount = (idxAttr ? idxAttr.count : pos.count) / 3;
    const triangles = Array.from({ length: triCount }, (_, t) =>
      `<triangle v1="${idxAttr ? idxAttr.getX(t * 3) : t * 3}" v2="${idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1}" v3="${idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2}"/>`,
    ).join('');

    const pindex = distinctColors.indexOf(part.colorHex.toUpperCase());
    return `<object id="${objectId}" type="model" name="${xmlEsc(part.name)}" pid="1" pindex="${pindex}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
  }).join('');

  const assemblyXml = `<object id="${assemblyId}" type="model" name="${xmlEsc(bookTitle)}"><components>${coverParts.map((_, i) => `<component objectid="${i + 2}"/>`).join('')}</components></object>`;

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"><resources><m:colorgroup id="1">${distinctColors.map(c => `<m:color color="${c}"/>`).join('')}</m:colorgroup>${meshObjectsXml}${assemblyXml}</resources><build><item objectid="${assemblyId}"/></build></model>`;

  const subpartsXml = coverParts.map((p, i) =>
    `<part id="${i + 2}" subtype="normal_part"><metadata key="name" value="${xmlEsc(p.name)}"/><metadata key="extruder" value="${p.extruder}"/></part>`,
  ).join('');

  const settingsXml = `<?xml version="1.0" encoding="UTF-8"?><config><plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="Bìa sách mở phẳng (AMS)"/><metadata key="locked" value="false"/><model_instance><metadata key="object_id" value="${assemblyId}"/><metadata key="instance_id" value="0"/></model_instance></plate><object id="${assemblyId}"><metadata key="name" value="${xmlEsc(bookTitle)}"/><metadata key="plater_id" value="1"/><metadata key="extruder" value="1"/>${subpartsXml}</object></config>`;

  return zipSync({
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="json" ContentType="application/json"/><Override PartName="/Metadata/model_settings.config" ContentType="text/xml"/></Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(modelXml),
    'Metadata/model_settings.config': strToU8(settingsXml),
    'Metadata/plate_1.json': strToU8(JSON.stringify({ bed_type: 'textured_plate', version: 2 })),
  });
}

/**
 * Exports just the Pages laid out in a grid on the bed (Plate 2/3).
 */
export function exportPagesPlate3mf(
  pageParts: BookLayoutPart[],
  bookTitle = 'BaSa3D Photo Book Pages',
): Uint8Array {
  const distinctColors = [...new Set(pageParts.map(p => p.colorHex.toUpperCase()))];

  const meshObjectsXml = pageParts.map((part, index) => {
    const objectId = index + 2;
    const pos = part.geometry.getAttribute('position');
    const idxAttr = part.geometry.getIndex();

    const vertices = Array.from({ length: pos.count }, (_, v) =>
      `<vertex x="${pos.getX(v).toFixed(4)}" y="${pos.getY(v).toFixed(4)}" z="${pos.getZ(v).toFixed(4)}"/>`,
    ).join('');

    const triCount = (idxAttr ? idxAttr.count : pos.count) / 3;
    const triangles = Array.from({ length: triCount }, (_, t) =>
      `<triangle v1="${idxAttr ? idxAttr.getX(t * 3) : t * 3}" v2="${idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1}" v3="${idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2}"/>`,
    ).join('');

    const pindex = distinctColors.indexOf(part.colorHex.toUpperCase());
    return `<object id="${objectId}" type="model" name="${xmlEsc(part.name)}" pid="1" pindex="${pindex}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
  }).join('');

  const buildItemsXml = pageParts.map((_, idx) => `<item objectid="${idx + 2}"/>`).join('');
  const modelXml = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"><metadata name="Title">${xmlEsc(bookTitle)}</metadata><resources><m:colorgroup id="1">${distinctColors.map(c => `<m:color color="${c}"/>`).join('')}</m:colorgroup>${meshObjectsXml}</resources><build>${buildItemsXml}</build></model>`;

  const modelInstancesXml = pageParts.map((_, idx) =>
    `<model_instance><metadata key="object_id" value="${idx + 2}"/><metadata key="instance_id" value="0"/></model_instance>`
  ).join('');

  const objectsXml = pageParts.map((p, idx) =>
    `<object id="${idx + 2}"><metadata key="name" value="${xmlEsc(p.name)}"/><metadata key="plater_id" value="1"/><metadata key="extruder" value="${p.extruder}"/><part id="${idx + 2}" subtype="normal_part"><metadata key="name" value="${xmlEsc(p.name)}"/><metadata key="extruder" value="${p.extruder}"/></part></object>`,
  ).join('');

  const settingsXml = `<?xml version="1.0" encoding="UTF-8"?><config><plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="Trang ruột"/><metadata key="locked" value="false"/>${modelInstancesXml}</plate>${objectsXml}</config>`;

  return zipSync({
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="json" ContentType="application/json"/><Override PartName="/Metadata/model_settings.config" ContentType="text/xml"/></Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(modelXml),
    'Metadata/model_settings.config': strToU8(settingsXml),
    'Metadata/plate_1.json': strToU8(JSON.stringify({ bed_type: 'textured_plate', version: 2 })),
  });
}

/**
 * Builds the complete export package containing:
 * - Multi-Plate Bambu Studio Project (.3mf)
 * - Standalone Flat Cover (.3mf)
 * - Standalone Pages (.3mf)
 * - Individual STL files for all components.
 */
export function exportCompletePackageZip(
  modelMap: UnpackedModelMap,
  config: BookMakerConfig,
  designModifiers: BookDesignModifier[] = [],
  bookTitle = 'BaSa3D Photo Book',
): Uint8Array {
  const coverParts = layoutBookCoverFlat(modelMap, config, designModifiers);
  const multiPlatePages = layoutBookPagesFlat(modelMap, config, true);
  const singlePlatePages = layoutBookPagesFlat(modelMap, config, false);

  const multiPlate3mf = exportBookToBambuMultiPlate3mf(coverParts, multiPlatePages, bookTitle);
  const coverFlat3mf = exportCoverFlat3mf(coverParts, `${bookTitle} - Bìa`);
  const pagesPlate3mf = exportPagesPlate3mf(singlePlatePages, `${bookTitle} - Trang`);

  const exporter = new STLExporter();
  const zipFiles: Record<string, Uint8Array> = {
    [`00-${bookTitle}-Bambu-MultiPlate.3mf`]: multiPlate3mf,
    [`01-${bookTitle}-Cover-Flat-AMS.3mf`]: coverFlat3mf,
    [`02-${bookTitle}-Pages-Plate.3mf`]: pagesPlate3mf,
  };

  // Add individual STLs for each part using singlePlatePages so they are centered on bed
  const allParts = [...coverParts, ...singlePlatePages];
  allParts.forEach((part, index) => {
    const mesh = new THREE.Mesh(part.geometry);
    const data = exporter.parse(mesh, { binary: true });
    const cleanIndex = String(index + 1).padStart(2, '0');
    const safeName = part.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `STLs/${cleanIndex}-${safeName}.stl`;

    const u8 = new Uint8Array(
      typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    );
    zipFiles[filename] = u8;
  });

  return zipSync(zipFiles);
}

/**
 * Legacy single-assembly 3MF export (now uses flat layout to prevent collisions).
 */
export function exportBookTo3mf(
  parts: AssembledBookPart[] | BookLayoutPart[],
  bookTitle = 'BaSa3D Photo Book',
): Uint8Array {
  // If passed BookLayoutPart[], export with Bambu multi-plate
  if (parts.length > 0 && 'extruder' in parts[0]) {
    const layoutParts = parts as BookLayoutPart[];
    const coverParts = layoutParts.filter(p => p.isCoverSubpart);
    const pageParts = layoutParts.filter(p => !p.isCoverSubpart);
    return exportBookToBambuMultiPlate3mf(coverParts, pageParts, bookTitle);
  }

  // Fallback
  const assembled = parts as AssembledBookPart[];
  const coverParts: BookLayoutPart[] = assembled.filter(p => p.isCover).map((p) => ({
    id: p.id,
    name: p.name,
    geometry: p.geometry,
    colorHex: p.colorHex,
    extruder: 1,
    platerId: 1,
    isCoverSubpart: true,
  }));
  const pageParts: BookLayoutPart[] = assembled.filter(p => !p.isCover).map((p) => ({
    id: p.id,
    name: p.name,
    geometry: p.geometry,
    colorHex: p.colorHex,
    extruder: 2,
    platerId: 2,
    isCoverSubpart: false,
  }));

  return exportBookToBambuMultiPlate3mf(coverParts, pageParts, bookTitle);
}

/**
 * Exports all book parts as individual binary STL files packaged in a ZIP archive.
 */
export function exportBookToStlZip(parts: AssembledBookPart[] | BookLayoutPart[]): Uint8Array {
  const exporter = new STLExporter();
  const zipFiles: Record<string, Uint8Array> = {};

  parts.forEach((part, index) => {
    const mesh = new THREE.Mesh(part.geometry);
    const data = exporter.parse(mesh, { binary: true });
    const cleanIndex = String(index + 1).padStart(2, '0');
    const safeName = part.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanIndex}-${safeName}.stl`;

    const u8 = new Uint8Array(
      typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    );
    zipFiles[filename] = u8;
  });

  return zipSync(zipFiles);
}

/**
 * Calculates total volume, estimated print weight (grams), and estimated print minutes.
 */
export function calculateBookEstimates(parts: (AssembledBookPart | BookLayoutPart)[]): {
  volumeCm3: number;
  weightGrams: number;
  printMinutes: number;
} {
  let totalVolume = 0;
  for (const part of parts) {
    totalVolume += calculateMeshVolumeCm3(part.geometry);
  }
  const weightGrams = estimateMeshWeightGrams(totalVolume);
  const printMinutes = estimatePrintMinutes(weightGrams);

  return {
    volumeCm3: Math.round(totalVolume * 10) / 10,
    weightGrams: Math.round(weightGrams),
    printMinutes,
  };
}
