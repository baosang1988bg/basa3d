import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { DomainError } from '../src/lib/domain-error.js';
import { parseThreeMfSliceInfo } from '../src/lib/parsers/threemf-slice-info.js';

function buildFixture3mf(sliceInfoXml: string | null, path = 'Metadata/slice_info.config'): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  };
  if (sliceInfoXml !== null) files[path] = strToU8(sliceInfoXml);
  return zipSync(files);
}

const TWO_PLATE_SEVEN_FILAMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="27000"/>
    <filament id="1" type="PLA" color="#FF0000FF" used_g="12.5"/>
    <filament id="2" type="PLA" color="#00FF00FF" used_g="8.2"/>
    <filament id="3" type="PLA" color="#0000FFFF" used_g="3.1"/>
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="20520"/>
    <filament id="1" type="PLA" color="#FF0000FF" used_g="14.0"/>
    <filament id="4" type="PLA" color="#FFFF00FF" used_g="5.5"/>
    <filament id="5" type="PLA" color="#FF00FFFF" used_g="2.2"/>
    <filament id="6" type="PLA" color="#00FFFFFF" used_g="1.8"/>
    <filament id="7" type="PLA" color="#000000FF" used_g="0.9"/>
  </plate>
</config>`;

const REAL_BAMBU_STUDIO_SLICE_INFO = readFileSync(
  new URL('./fixtures/bambu-studio-slice-info.config', import.meta.url),
  'utf8',
);

test('parses extracted slice_info.config from a real BambuStudio 02.05.00.66 archive', () => {
  const parsed = parseThreeMfSliceInfo(buildFixture3mf(REAL_BAMBU_STUDIO_SLICE_INFO));
  assert.equal(parsed.plateCount, 1);
  assert.equal(parsed.plates[0].index, 1);
  assert.equal(parsed.plates[0].predictionSeconds, 7745);
  assert.equal(parsed.totalPrintMinutes, 129);
  assert.deepEqual(parsed.filaments.map((line) => line.totalGrams), [23.43, 8.7]);
});

test('parses plate count, total print time, and per-filament totals across plates', () => {
  const parsed = parseThreeMfSliceInfo(buildFixture3mf(TWO_PLATE_SEVEN_FILAMENT_XML));
  assert.equal(parsed.plateCount, 2);
  // (27000 + 20520) seconds / 60 = 792 minutes.
  assert.equal(parsed.totalPrintMinutes, 792);
  // 7 distinct colors across both plates (filament id=1/color red appears on both plates and must
  // be summed, not counted twice).
  assert.equal(parsed.filaments.length, 7);
  const red = parsed.filaments.find((f) => f.color === '#FF0000FF');
  assert.ok(red);
  assert.equal(red!.totalGrams, 12.5 + 14.0);
});

test('a .3mf without Metadata/slice_info.xml (not yet sliced) fails with a specific, actionable error', () => {
  assert.throws(
    () => parseThreeMfSliceInfo(buildFixture3mf(null)),
    (error: unknown) => error instanceof DomainError && error.code === '3MF_MISSING_SLICE_INFO' && error.status === 422,
  );
});

test('a plain non-ZIP file fails with INVALID_3MF_FILE, not a raw unzip crash', () => {
  assert.throws(
    () => parseThreeMfSliceInfo(strToU8('this is not a zip file at all')),
    (error: unknown) => error instanceof DomainError && error.code === 'INVALID_3MF_FILE' && error.status === 400,
  );
});

test('slice_info.xml with no <plate> elements at all is treated the same as missing slice info', () => {
  assert.throws(
    () => parseThreeMfSliceInfo(buildFixture3mf('<?xml version="1.0"?><config></config>')),
    (error: unknown) => error instanceof DomainError && error.code === '3MF_MISSING_SLICE_INFO',
  );
});

test('a single-plate file (no array-vs-single-object XML parser quirk) still parses correctly', () => {
  const singlePlateXml = `<?xml version="1.0"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="3600"/>
    <filament id="1" type="PETG" color="#FFFFFFFF" used_g="50"/>
  </plate>
</config>`;
  const parsed = parseThreeMfSliceInfo(buildFixture3mf(singlePlateXml));
  assert.equal(parsed.plateCount, 1);
  assert.equal(parsed.totalPrintMinutes, 60);
  assert.equal(parsed.filaments.length, 1);
  assert.equal(parsed.filaments[0].totalGrams, 50);
});

test('keeps compatibility with the provisional Metadata/slice_info.xml filename', () => {
  const parsed = parseThreeMfSliceInfo(buildFixture3mf(TWO_PLATE_SEVEN_FILAMENT_XML, 'Metadata/slice_info.xml'));
  assert.equal(parsed.plateCount, 2);
});
