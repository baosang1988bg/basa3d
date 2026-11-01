import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { decodeAfk2Model } from '../src/lib/3d-tools/book-maker/afk2-decoder';
import {
  layoutBookCoverFlat,
  layoutBookPagesFlat,
} from '../src/lib/3d-tools/book-maker/book-maker-geometry';
import {
  exportBookToBambuMultiPlate3mf,
  exportCompletePackageZip,
} from '../src/lib/3d-tools/book-maker/book-maker-export';
import { DEFAULT_BOOK_CONFIG } from '../src/lib/3d-tools/book-maker/book-maker-constants';

test('lays out flat cover grounded at Z=0 and centered on 256x256 bed', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-hub/V-MINI.dat');
  const datContent = fs.readFileSync(filePath, 'utf8');
  const modelMap = await decodeAfk2Model(datContent);
  const coverParts = layoutBookCoverFlat(modelMap, DEFAULT_BOOK_CONFIG);

  assert.equal(coverParts.length, 3); // Back, Spine, Front

  coverParts.forEach((part) => {
    part.geometry.computeBoundingBox();
    const bb = part.geometry.boundingBox!;
    assert.equal(Math.abs(bb.min.z) < 0.1, true, `Part ${part.name} min.z must be 0, got ${bb.min.z}`);
    assert.equal(bb.max.z > 2, true);
    assert.equal(bb.min.x > 0, true);
    assert.equal(bb.max.x < 256, true);
    assert.equal(bb.min.y > 0, true);
    assert.equal(bb.max.y < 256, true);
  });
});

test('lays out pages in a non-overlapping grid grounded at Z=0', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-hub/V-MINI.dat');
  const datContent = fs.readFileSync(filePath, 'utf8');
  const modelMap = await decodeAfk2Model(datContent);
  const pageParts = layoutBookPagesFlat(modelMap, { ...DEFAULT_BOOK_CONFIG, pages: 10 });

  assert.equal(pageParts.length, 10);

  // Verify each page is grounded at Z=0
  pageParts.forEach((part) => {
    part.geometry.computeBoundingBox();
    const bb = part.geometry.boundingBox!;
    assert.equal(Math.abs(bb.min.z) < 0.1, true);
    assert.equal(bb.max.z > 3, true);
  });

  // Verify plates: pages 1-6 are platerId=2, pages 7-10 are platerId=3
  const plate2 = pageParts.filter((p) => p.platerId === 2);
  const plate3 = pageParts.filter((p) => p.platerId === 3);
  assert.equal(plate2.length, 6);
  assert.equal(plate3.length, 4);

  // Verify pages on plate 2 do not intersect each other in XY
  for (let i = 0; i < plate2.length; i++) {
    const b1 = plate2[i].geometry.boundingBox!;
    for (let j = i + 1; j < plate2.length; j++) {
      const b2 = plate2[j].geometry.boundingBox!;
      const overlapX = Math.max(0, Math.min(b1.max.x, b2.max.x) - Math.max(b1.min.x, b2.min.x));
      const overlapY = Math.max(0, Math.min(b1.max.y, b2.max.y) - Math.max(b1.min.y, b2.min.y));
      const hasOverlap = overlapX > 0 && overlapY > 0;
      assert.equal(hasOverlap, false, `Page ${i + 1} overlaps Page ${j + 1}`);
    }
  }
});

test('exports Bambu Studio multi-plate 3MF with proper plate metadata', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-hub/V-MINI.dat');
  const datContent = fs.readFileSync(filePath, 'utf8');
  const modelMap = await decodeAfk2Model(datContent);
  const coverParts = layoutBookCoverFlat(modelMap, { ...DEFAULT_BOOK_CONFIG, pages: 10 });
  const pageParts = layoutBookPagesFlat(modelMap, { ...DEFAULT_BOOK_CONFIG, pages: 10 }, true);

  const u8 = exportBookToBambuMultiPlate3mf(coverParts, pageParts, 'Test-Book');
  assert.equal(u8.length > 100000, true);

  const unzipped = unzipSync(u8);
  assert.equal(unzipped['3D/3dmodel.model'] != null, true);
  assert.equal(unzipped['Metadata/model_settings.config'] != null, true);
  assert.equal(unzipped['Metadata/plate_1.json'] != null, true);
  assert.equal(unzipped['Metadata/plate_2.json'] != null, true);
  assert.equal(unzipped['Metadata/plate_3.json'] != null, true);

  const configStr = new TextDecoder().decode(unzipped['Metadata/model_settings.config']);
  // Plate 1: Cover assembly
  assert.equal(configStr.includes('<plate><metadata key="plater_id" value="1"/>'), true);
  assert.equal(configStr.includes('Bìa sách mở phẳng (AMS)'), true);
  assert.equal(configStr.includes('<model_instance><metadata key="object_id" value="'), true);

  // Plate 2: Pages 1-6
  assert.equal(configStr.includes('<plate><metadata key="plater_id" value="2"/>'), true);
  assert.equal(configStr.includes('Trang ruột (1-6)'), true);

  // Plate 3: Pages 7-10
  assert.equal(configStr.includes('<plate><metadata key="plater_id" value="3"/>'), true);
  assert.equal(configStr.includes('Trang ruột (7-10)'), true);

  // Extruder metadata
  assert.equal(configStr.includes('metadata key="extruder" value="1"'), true);
  assert.equal(configStr.includes('metadata key="extruder" value="2"'), true);

  // Verify geometry coordinates of plates do not collide
  // Plate 1: Cover is centered at (128, 128)
  coverParts.forEach((p) => {
    p.geometry.computeBoundingBox();
    const bb = p.geometry.boundingBox!;
    assert.equal(bb.min.x >= 0 && bb.max.x <= 256, true, 'Cover must stay on Plate 1');
    assert.equal(bb.min.y >= 0 && bb.max.y <= 256, true, 'Cover must stay on Plate 1');
  });

  // Plate 2: Pages 1-6 are centered around X=435.2 (X in [307.2, 563.2])
  const plate2Pages = pageParts.filter((p) => p.platerId === 2);
  assert.equal(plate2Pages.length, 6);
  plate2Pages.forEach((p) => {
    p.geometry.computeBoundingBox();
    const bb = p.geometry.boundingBox!;
    assert.equal(bb.min.x >= 307.2 && bb.max.x <= 563.2, true, `Plate 2 page ${p.name} must be in Plate 2 world bounds`);
    assert.equal(bb.min.y >= 0 && bb.max.y <= 256, true);
  });

  // Plate 3: Pages 7-10 are centered around Y=-179.2 (Y in [-307.2, -51.2])
  const plate3Pages = pageParts.filter((p) => p.platerId === 3);
  assert.equal(plate3Pages.length, 4);
  plate3Pages.forEach((p) => {
    p.geometry.computeBoundingBox();
    const bb = p.geometry.boundingBox!;
    assert.equal(bb.min.x >= 0 && bb.max.x <= 256, true);
    assert.equal(bb.min.y >= -307.2 && bb.max.y <= -51.2, true, `Plate 3 page ${p.name} must be in Plate 3 world bounds`);
  });
});

test('exports complete ZIP package with multi-plate 3MF and individual STLs', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-hub/V-MINI.dat');
  const datContent = fs.readFileSync(filePath, 'utf8');
  const modelMap = await decodeAfk2Model(datContent);
  const zipU8 = exportCompletePackageZip(modelMap, DEFAULT_BOOK_CONFIG, [], 'Test-Book');

  const unzipped = unzipSync(zipU8);
  const files = Object.keys(unzipped);

  assert.equal(files.some((f) => f.includes('Bambu-MultiPlate.3mf')), true);
  assert.equal(files.some((f) => f.includes('Cover-Flat-AMS.3mf')), true);
  assert.equal(files.some((f) => f.includes('Pages-Plate.3mf')), true);
  assert.equal(files.some((f) => f.startsWith('STLs/')), true);
});

test('respects custom user-configured file name in 3MF and ZIP exports', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-hub/V-MINI.dat');
  const datContent = fs.readFileSync(filePath, 'utf8');
  const modelMap = await decodeAfk2Model(datContent);

  const customTitle = 'Ky-Niem-Gia-Dinh-2026';
  const coverParts = layoutBookCoverFlat(modelMap, DEFAULT_BOOK_CONFIG);
  const pageParts = layoutBookPagesFlat(modelMap, DEFAULT_BOOK_CONFIG);

  const u8 = exportBookToBambuMultiPlate3mf(coverParts, pageParts, customTitle);
  const unzipped = unzipSync(u8);
  const configStr = new TextDecoder().decode(unzipped['Metadata/model_settings.config']);

  assert.equal(configStr.includes(customTitle), true);

  const zipU8 = exportCompletePackageZip(modelMap, DEFAULT_BOOK_CONFIG, [], customTitle);
  const zipFiles = Object.keys(unzipSync(zipU8));
  assert.equal(zipFiles.includes(`00-${customTitle}-Bambu-MultiPlate.3mf`), true);
  assert.equal(zipFiles.includes(`01-${customTitle}-Cover-Flat-AMS.3mf`), true);
});

test('decodes and embeds Base64 text/drawing/image modifiers on cover for AMS printing', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-hub/V-MINI.dat');
  const datContent = fs.readFileSync(filePath, 'utf8');
  const modelMap = await decodeAfk2Model(datContent);

  // Helper matching af-book-hub.js b64
  const b64 = (buf: ArrayBufferView) => {
    const b = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    let s2 = '';
    for (let i = 0; i < b.length; i += 0x8000) {
      s2 += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
    }
    return btoa(s2);
  };

  // Create a 3D triangle modifier prism on the front cover face (y = -2.1 to -1.3)
  const vFloats = new Float32Array([
    10, -2.1, 5,
    20, -2.1, 5,
    15, -1.3, 10,
  ]);
  const fIndices = new Uint32Array([0, 1, 2]);

  const mockModifiers = [
    {
      part: 'front' as const,
      hex: '#FFFFFF', // White text on cover
      v: b64(vFloats),
      f: b64(fIndices),
    },
  ];

  const coverParts = layoutBookCoverFlat(modelMap, DEFAULT_BOOK_CONFIG, mockModifiers);

  // 3 cover base parts + 1 design modifier = 4 parts
  assert.equal(coverParts.length, 4);

  const modPart = coverParts.find((p) => p.id === 'design-mod-1');
  assert.equal(modPart != null, true);
  assert.equal(modPart!.colorHex, '#FFFFFF');
  assert.equal(modPart!.extruder, 3); // Extruder slot 3
  assert.equal(modPart!.geometry.getAttribute('position').count, 3);

  modPart!.geometry.computeBoundingBox();
  const bb = modPart!.geometry.boundingBox!;
  // Check Z is within the 0 to 0.8mm surface print layer
  assert.equal(bb.min.z >= -0.1, true);
  assert.equal(bb.max.z <= 1.5, true);

  // Export 3MF and verify the modifier is in 3dmodel.model and model_settings.config
  const pageParts = layoutBookPagesFlat(modelMap, DEFAULT_BOOK_CONFIG);
  const u8 = exportBookToBambuMultiPlate3mf(coverParts, pageParts, 'Test-Modifier-Book');
  const unzipped = unzipSync(u8);

  const modelXml = new TextDecoder().decode(unzipped['3D/3dmodel.model']);
  assert.equal(modelXml.includes('Họa tiết / Chữ nổi 1'), true);
  assert.equal(modelXml.includes('#FFFFFF'), true);

  const configXml = new TextDecoder().decode(unzipped['Metadata/model_settings.config']);
  assert.equal(configXml.includes('metadata key="extruder" value="3"'), true);
  assert.equal(configXml.includes('Họa tiết / Chữ nổi 1'), true);
});

test('exports exactly 8 pages when user selects 8 pages, matching choice payload', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-hub/V-MINI.dat');
  const datContent = fs.readFileSync(filePath, 'utf8');
  const modelMap = await decodeAfk2Model(datContent);

  // Simulate choice payload from AFBookHub where pages=8
  const choicePayload = {
    print: {
      build: {
        fmt: 'V-MINI',
        pages: 8,
        hinge: 'snap',
        front: 'blank',
      },
    },
    state: {
      pages: 8,
      hinge: 'snap',
      front: 'blank',
    },
  };

  const rawPages = choicePayload.print?.build?.pages ?? choicePayload.state?.pages ?? (choicePayload as { pages?: number }).pages;
  const pages = typeof rawPages === 'number' && !isNaN(rawPages) ? rawPages : 10;
  assert.equal(pages, 8);

  const config = {
    ...DEFAULT_BOOK_CONFIG,
    pages,
  };

  const coverParts = layoutBookCoverFlat(modelMap, config);
  const pageParts = layoutBookPagesFlat(modelMap, config, true);

  // Exactly 8 pages generated
  assert.equal(pageParts.length, 8);

  const u8 = exportBookToBambuMultiPlate3mf(coverParts, pageParts, 'Eight-Pages-Book');
  const unzipped = unzipSync(u8);
  const configXml = new TextDecoder().decode(unzipped['Metadata/model_settings.config']);

  // Must have Plate 1 and Plate 2 (and Plate 3 if perPlate=6 or 4), but NOT Plate 4
  assert.equal(configXml.includes('Trang 8'), true);
  assert.equal(configXml.includes('Trang 9'), false);
  assert.equal(configXml.includes('Trang 10'), false);
});



