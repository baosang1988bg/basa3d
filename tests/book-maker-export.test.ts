import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { unzipSync, strFromU8 } from 'fflate';
import { decodeAfk2Model } from '../src/lib/3d-tools/book-maker/afk2-decoder';
import { assembleBookGeometries } from '../src/lib/3d-tools/book-maker/book-maker-geometry';
import { exportBookTo3mf, exportBookToStlZip, calculateBookEstimates } from '../src/lib/3d-tools/book-maker/book-maker-export';
import { DEFAULT_BOOK_CONFIG } from '../src/lib/3d-tools/book-maker/book-maker-constants';

const xmlParser = new XMLParser({ ignoreAttributes: false });

test('assembleBookGeometries and exportBookTo3mf produce valid Bambu Studio AMS 3MF package', async () => {
  const filePath = path.join(process.cwd(), 'public/models/book-maker/V-MINI.dat');
  const text = fs.readFileSync(filePath, 'utf8');
  const modelMap = await decodeAfk2Model(text);

  const parts = assembleBookGeometries(modelMap, {
    ...DEFAULT_BOOK_CONFIG,
    pages: 4, // 4 pages for quick testing
  });

  // Verify parts count: back + spine + front + 4 pages = 7 parts
  assert.equal(parts.length, 7);

  // Export 3MF
  const zipBytes = exportBookTo3mf(parts, 'Test Album BaSa3D');
  assert.equal(zipBytes.length > 0, true);

  const files = unzipSync(zipBytes);
  const fileList = Object.keys(files).sort();

  assert.deepEqual(fileList, [
    '3D/3dmodel.model',
    'Metadata/model_settings.config',
    'Metadata/plate_1.json',
    'Metadata/plate_2.json',
    '[Content_Types].xml',
    '_rels/.rels',
  ]);

  // Validate XML
  assert.equal(XMLValidator.validate(strFromU8(files['3D/3dmodel.model'])), true);
  assert.equal(XMLValidator.validate(strFromU8(files['Metadata/model_settings.config'])), true);

  const parsedModel = xmlParser.parse(strFromU8(files['3D/3dmodel.model'])).model;
  assert.equal(parsedModel['@_unit'], 'millimeter');
  assert.equal(parsedModel.resources['m:colorgroup']['m:color'].length, 2); // coverColor + pageColor

  // Export STL Zip
  const stlZipBytes = exportBookToStlZip(parts);
  assert.equal(stlZipBytes.length > 0, true);
  const stlFiles = unzipSync(stlZipBytes);
  assert.equal(Object.keys(stlFiles).length, 7);

  // Estimates
  const estimates = calculateBookEstimates(parts);
  assert.equal(estimates.volumeCm3 > 0, true);
  assert.equal(estimates.weightGrams > 0, true);
  assert.equal(estimates.printMinutes > 0, true);

  parts.forEach((p) => p.geometry.dispose());
});
