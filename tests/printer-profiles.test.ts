import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import {
  DEFAULT_PRINTER_TARGET_ID,
  PRINTER_PROFILES,
  applyPrinterProfileToConfig,
  resolvePrinterProfile,
} from '../src/lib/pricing/printer-profiles.js';
import { computePricingBreakdown } from '../src/services/pricing.service.js';
import { buildThreeMfPricingDraft } from '../src/services/threemf-pricing-draft.service.js';
import { pricingBreakdownSchema, publicCustomRequestInputSchema } from '../src/domain/schemas.js';
import { DomainError } from '../src/lib/domain-error.js';
import { estimateColorPurge, type PricingContext } from '../src/services/instant-estimate.service.js';
import { estimateFileBytes } from '../src/services/file-estimate.service.js';

const ctx: PricingContext = {
  config: {
    electricityVndPerKwh: 3_500,
    machinePriceVnd: 15_000_000,
    machineLifetimeHours: 10_000,
    printerPowerKw: 0.2,
    laborVndPerHour: 35_000,
    failureBufferPct: 10,
    marginPct: 40,
    packagingFeeVnd: 5_000,
  },
  medians: new Map([['PLA', 300], ['PETG', 350]]),
};

test('resolvePrinterProfile: correctly resolves Snapmaker U1 and Bambu AMS profiles', () => {
  assert.equal(resolvePrinterProfile('Snapmaker U1').id, 'SNAPMAKER_U1');
  assert.equal(resolvePrinterProfile('snapmaker u1 0.4 nozzle').id, 'SNAPMAKER_U1');
  assert.equal(resolvePrinterProfile('U1').id, 'SNAPMAKER_U1');

  assert.equal(resolvePrinterProfile('Bambu Lab P2S').id, 'BAMBU_P2S');
  assert.equal(resolvePrinterProfile('Bambu Lab A1').id, 'BAMBU_P2S');
  assert.equal(resolvePrinterProfile(null).id, 'BAMBU_P2S');
  assert.equal(resolvePrinterProfile(undefined).id, 'BAMBU_P2S');
});

test('Snapmaker U1 profile has 0 purge flush, faster change time, and 270mm bed', () => {
  const u1 = PRINTER_PROFILES.SNAPMAKER_U1;
  assert.equal(u1.type, 'TOOL_CHANGER');
  assert.equal(u1.defaultFlushMm3, 0);
  assert.equal(u1.colorChangeSeconds, 10);
  assert.deepEqual(u1.buildVolumeMm, { x: 270, y: 270, z: 270 });

  const p2s = PRINTER_PROFILES.BAMBU_P2S;
  assert.equal(p2s.type, 'SINGLE_NOZZLE_AMS');
  assert.equal(p2s.defaultFlushMm3, 300);
  assert.equal(p2s.colorChangeSeconds, 40);
  assert.deepEqual(p2s.buildVolumeMm, { x: 256, y: 256, z: 256 });
});

test('estimateColorPurge: U1 tool changer drastically cuts purge waste & extra time vs Bambu AMS', () => {
  // Mock 4-color keycap project: 66 color changes
  const mockProject = {
    filamentColors: ['#482960', '#C12E1F', '#FFFFFF', '#000000'],
    filamentTypes: ['PLA', 'PLA', 'PLA', 'PLA'],
    layerHeightMm: 0.12,
    flushMatrix: null,
    flushMultiplier: 1,
    primeTowerEnabled: true,
    primeVolumeMm3: 25,
    printerModel: 'Bambu Lab A1',
    plates: [{
      index: 1,
      filaments: [1, 2, 3, 4],
      colorChanges: 66,
      multiColorLayers: 40,
      sizeMm: { x: 18, y: 18, z: 20.9 },
    }],
  };

  // 1. Default (Bambu Lab A1 from 3MF -> single nozzle AMS):
  const bambuEstimate = estimateColorPurge(mockProject);
  assert.ok(bambuEstimate);
  assert.equal(bambuEstimate.printerType, 'SINGLE_NOZZLE_AMS');
  // 66 changes * (300 flush + 25 prime) = 21,450 mm3 -> ~26.6g purge
  assert.ok(bambuEstimate.purgeGrams > 20, `Bambu purge should be > 20g, got ${bambuEstimate.purgeGrams}`);
  assert.equal(bambuEstimate.extraMinutes, 44); // 66 * 40s / 60 = 44 min

  // 2. Overridden with Snapmaker U1 (Tool Changer):
  const u1Estimate = estimateColorPurge(mockProject, undefined, 'Snapmaker U1');
  assert.ok(u1Estimate);
  assert.equal(u1Estimate.printerType, 'TOOL_CHANGER');
  assert.equal(u1Estimate.printerModel, 'Snapmaker U1 (4 Toolheads)');
  // 66 changes * (0 flush + 25 prime) = 1,650 mm3 -> ~2.0g prime tower only!
  assert.equal(u1Estimate.purgeGrams, 2.0);
  assert.equal(u1Estimate.extraMinutes, 11); // 66 * 10s / 60 = 11 min (reduced by 75%!)
});

test('estimateFileBytes: passes printerTarget to specs and adjusts calculations', () => {
  const gengarPath = 'scratch/gengar-keycap.3mf';
  if (!fs.existsSync(gengarPath)) return;

  const bytes = fs.readFileSync(gengarPath);

  // When priced for Snapmaker U1
  const u1Result = estimateFileBytes(ctx, {
    fileName: 'gengar-keycap.3mf',
    bytes,
    materialType: 'PLA',
    printerTarget: 'Snapmaker U1',
  });

  assert.equal(u1Result.status, 'OK');
  assert.ok(u1Result.estimate);
  assert.equal(u1Result.estimate.specs.printerType, 'TOOL_CHANGER');
  assert.equal(u1Result.estimate.specs.printerTarget, 'Snapmaker U1 (4 Toolheads)');
  assert.ok((u1Result.estimate.specs.purgeGrams ?? 0) < 5); // Prime tower only ~2-3g, not 28g!
  assert.ok((u1Result.estimate.specs.colorChangeMinutes ?? 0) <= 15); // ~11 min, not 44 min!
});

// ---------------------------------------------------------------------------------------------
// Fixtures: an unsliced 4-color Bambu/Orca project (same layout as phase-40-multicolor-purge.test.ts)
// and a sliced .3mf carrying the real BambuStudio slice_info.config fixture.
// ---------------------------------------------------------------------------------------------
const NS = 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"';

function box(id: number, [x0, y0, z0]: number[], [x1, y1, z1]: number[]) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return `<object id="${id}" type="model"><mesh><vertices>${v.map(([a, b, c]) => `<vertex x="${a}" y="${b}" z="${c}"/>`).join('')}</vertices>`
    + `<triangles>${f.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join('')}</triangles></mesh></object>`;
}

function unslicedProject(parts: { id: number; extruder: number; from: number[]; to: number[] }[]) {
  const colours = ['#FFFFFF', '#000000', '#7B2FBE', '#E53935'];
  const objects = `<?xml version="1.0"?><model unit="millimeter" ${NS}><resources>${parts.map((p) => box(p.id, p.from, p.to)).join('')}</resources><build/></model>`;
  const main = `<?xml version="1.0"?><model unit="millimeter" ${NS}><resources><object id="10" type="model"><components>`
    + parts.map((p) => `<component p:path="/3D/Objects/object_1.model" objectid="${p.id}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`).join('')
    + `</components></object></resources><build><item objectid="10" transform="1 0 0 0 1 0 0 0 1 128 128 0"/></build></model>`;
  const modelSettings = `<?xml version="1.0"?><config><object id="10"><metadata key="name" value="keycap"/><metadata key="extruder" value="1"/>`
    + parts.map((p) => `<part id="${p.id}" subtype="normal_part"><metadata key="extruder" value="${p.extruder}"/></part>`).join('')
    + `</object><plate><metadata key="plater_id" value="1"/><model_instance><metadata key="object_id" value="10"/><metadata key="instance_id" value="0"/></model_instance></plate></config>`;
  const settings = {
    filament_colour: colours, filament_type: colours.map(() => 'PLA'),
    flush_volumes_matrix: colours.flatMap((_, i) => colours.map((__, j) => (i === j ? '0' : '200'))),
    flush_multiplier: '1', layer_height: '0.2', enable_prime_tower: '1', prime_volume: '45', printer_model: 'Bambu Lab P2S',
  };
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    '3D/3dmodel.model': strToU8(main),
    '3D/Objects/object_1.model': strToU8(objects),
    'Metadata/model_settings.config': strToU8(modelSettings),
    'Metadata/project_settings.config': strToU8(JSON.stringify(settings)),
  });
}

const fourColorKeycap = unslicedProject([
  { id: 1, extruder: 1, from: [0, 0, 0], to: [18, 18, 20] },
  { id: 2, extruder: 2, from: [2, 2, 0], to: [6, 6, 20] },
  { id: 3, extruder: 3, from: [8, 8, 0], to: [12, 12, 20] },
  { id: 4, extruder: 4, from: [13, 13, 0], to: [16, 16, 20] },
]);
const sliced3mf = zipSync({
  'Metadata/slice_info.config': strToU8(fs.readFileSync(new URL('./fixtures/bambu-studio-slice-info.config', import.meta.url), 'utf8')),
  '3D/3dmodel.model': strToU8('<model/>'),
});

// --- PricingCalculatorPanel: machine config per printer target ------------------------------------

test('applyPrinterProfileToConfig: U1 fills 0.25kW / 22tr / 10.000h, P2S keeps the saved config', () => {
  assert.equal(DEFAULT_PRINTER_TARGET_ID, 'SNAPMAKER_U1');
  const u1 = applyPrinterProfileToConfig(ctx.config, 'SNAPMAKER_U1');
  assert.equal(u1.printerPowerKw, 0.25);
  assert.equal(u1.machinePriceVnd, 22_000_000);
  assert.equal(u1.machineLifetimeHours, 10_000);
  assert.equal(u1.electricityVndPerKwh, ctx.config.electricityVndPerKwh, 'non-machine fields untouched');
  assert.equal(u1.marginPct, ctx.config.marginPct);
  assert.strictEqual(applyPrinterProfileToConfig(ctx.config, 'BAMBU_P2S'), ctx.config);
});

test('computePricingBreakdown: U1 vs P2S machine costs differ and stay integer VND (Rule #2)', () => {
  const input = { materials: [{ label: 'PLA', gram: 50, unitCostVndPerGram: 300 }], printMinutes: 600, laborMinutes: 15 };
  const u1 = computePricingBreakdown({ ...input, config: applyPrinterProfileToConfig(ctx.config, 'SNAPMAKER_U1') });
  const p2s = computePricingBreakdown({ ...input, config: applyPrinterProfileToConfig(ctx.config, 'BAMBU_P2S') });
  // 10h: 22.000.000 / 10.000h = 2.200đ/h vs 1.500đ/h; 0.25kW vs 0.2kW × 3.500đ/kWh.
  assert.equal(u1.machineDepreciationVnd, 22_000);
  assert.equal(p2s.machineDepreciationVnd, 15_000);
  assert.equal(u1.electricityCostVnd, 8_750);
  assert.equal(p2s.electricityCostVnd, 7_000);
  for (const b of [u1, p2s]) {
    for (const value of [b.electricityCostVnd, b.machineDepreciationVnd, b.totalCostVnd, b.finalPriceVnd]) assert.ok(Number.isSafeInteger(value));
  }
});

test('pricingBreakdownSchema: accepts a known printerProfileId, rejects anything else', () => {
  const b = { ...computePricingBreakdown({ materials: [], printMinutes: 60, laborMinutes: 0, config: ctx.config }) };
  assert.equal(pricingBreakdownSchema.safeParse({ ...b, printerProfileId: 'SNAPMAKER_U1' }).success, true);
  assert.equal(pricingBreakdownSchema.safeParse({ ...b, printerProfileId: 'BAMBU_P2S' }).success, true);
  assert.equal(pricingBreakdownSchema.safeParse(b).success, true, 'legacy snapshots without a printer stay valid');
  assert.equal(pricingBreakdownSchema.safeParse({ ...b, printerProfileId: 'ENDER_3' }).success, false);
});

// --- Admin parse-3mf: sliced + unsliced multi-color ------------------------------------------------

test('buildThreeMfPricingDraft: sliced .3mf returns exact slice_info numbers (printer ignored)', () => {
  const draft = buildThreeMfPricingDraft(sliced3mf, 'SNAPMAKER_U1');
  assert.equal(draft.source, 'SLICED');
  assert.ok(draft.plateCount >= 1);
  assert.ok(draft.totalPrintMinutes > 0);
  assert.ok(draft.filaments.length >= 1);
  assert.deepEqual(buildThreeMfPricingDraft(sliced3mf, 'BAMBU_P2S'), draft);
});

test('buildThreeMfPricingDraft: unsliced 4-color project → U1 prime tower vs P2S AMS purge', () => {
  const u1 = buildThreeMfPricingDraft(fourColorKeycap, 'SNAPMAKER_U1');
  const p2s = buildThreeMfPricingDraft(fourColorKeycap, 'BAMBU_P2S');
  assert.equal(u1.source, 'PROJECT_ESTIMATE');
  assert.equal(p2s.source, 'PROJECT_ESTIMATE');
  if (u1.source !== 'PROJECT_ESTIMATE' || p2s.source !== 'PROJECT_ESTIMATE') return;

  assert.equal(u1.printer.id, 'SNAPMAKER_U1');
  assert.equal(u1.printer.type, 'TOOL_CHANGER');
  assert.equal(p2s.printer.type, 'SINGLE_NOZZLE_AMS');
  assert.ok(u1.colorChanges > 0);
  assert.equal(u1.colorChanges, p2s.colorChanges, 'same geometry → same number of changes');
  assert.equal(u1.modelGrams, p2s.modelGrams, 'model grams do not depend on the printer');

  // U1: 0 flush, prime tower only (45 mm³/change from the project) — P2S adds 200 mm³ flush per change.
  assert.ok(u1.purgeGrams > 0 && u1.purgeGrams < p2s.purgeGrams);
  assert.equal(u1.colorChangeMinutes, Math.round((u1.colorChanges * 10) / 60));
  assert.equal(p2s.colorChangeMinutes, Math.round((p2s.colorChanges * 40) / 60));
  assert.ok(u1.totalPrintMinutes < p2s.totalPrintMinutes);

  // Rows pre-filled into the calculator's material table.
  assert.equal(u1.filaments.length, 2);
  assert.match(u1.filaments[1].label ?? '', /^Tháp mồi Snapmaker U1/);
  assert.match(p2s.filaments[1].label ?? '', /^Nhựa xả Bambu AMS/);
  assert.equal(u1.filaments[1].totalGrams, u1.purgeGrams);
  assert.equal(u1.filaments[0].totalGrams, u1.modelGrams);
  assert.equal(u1.plateCount, 1);
});

test('buildThreeMfPricingDraft: unsliced single-color project has no purge row', () => {
  const draft = buildThreeMfPricingDraft(unslicedProject([{ id: 1, extruder: 1, from: [0, 0, 0], to: [18, 18, 20] }]), 'SNAPMAKER_U1');
  assert.equal(draft.source, 'PROJECT_ESTIMATE');
  if (draft.source !== 'PROJECT_ESTIMATE') return;
  assert.equal(draft.colorChanges, 0);
  assert.equal(draft.filaments.length, 1);
});

test('buildThreeMfPricingDraft: no slice info and no readable geometry → still 3MF_MISSING_SLICE_INFO', () => {
  assert.throws(
    () => buildThreeMfPricingDraft(zipSync({ '3D/3dmodel.model': strToU8('<model/>') }), 'SNAPMAKER_U1'),
    (error: unknown) => error instanceof DomainError && error.code === '3MF_MISSING_SLICE_INFO',
  );
});

// --- Storefront file-estimate + request schema ----------------------------------------------------

test('estimateFileBytes: unsliced multi-color .3mf splits U1 (tool changer) from P2S (AMS)', () => {
  const run = (printerTarget: string | null) => estimateFileBytes(ctx, { fileName: 'keycap.3mf', bytes: fourColorKeycap, materialType: 'PLA', printerTarget });
  const u1 = run('SNAPMAKER_U1');
  const p2s = run('BAMBU_P2S');
  assert.equal(u1.status, 'OK');
  assert.equal(p2s.status, 'OK');
  assert.equal(u1.estimate?.specs.printerType, 'TOOL_CHANGER');
  assert.equal(u1.estimate?.specs.printerTarget, PRINTER_PROFILES.SNAPMAKER_U1.name);
  assert.equal(p2s.estimate?.specs.printerType, 'SINGLE_NOZZLE_AMS');
  assert.ok((u1.estimate?.specs.purgeGrams ?? 0) < (p2s.estimate?.specs.purgeGrams ?? 0));
  assert.ok((u1.estimate?.specs.colorChangeMinutes ?? 0) < (p2s.estimate?.specs.colorChangeMinutes ?? 0));
  // No target → the file's own printer_model ("Bambu Lab P2S") decides.
  assert.equal(run(null).estimate?.specs.printerType, 'SINGLE_NOZZLE_AMS');
});

test('publicCustomRequestInputSchema: printerTarget is optional and limited to known printers', () => {
  const base = {
    customerName: 'Khách', customerPhone: '0900000000', description: 'In keycap', quantity: 2,
    copyrightConfirmed: true, tosVersion: 'v1',
  };
  assert.equal(publicCustomRequestInputSchema.safeParse(base).success, true);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, printerTarget: 'SNAPMAKER_U1' }).success, true);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, printerTarget: 'BAMBU_P2S' }).success, true);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, printerTarget: 'Snapmaker U1' }).success, false);
});
