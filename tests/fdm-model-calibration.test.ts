// Phase 33 S0 — the offline calibration script runs in CI on tiny synthetic fixtures (the Owner runs
// it on real sliced files locally; see scripts/fdm-model-calibration/README.md).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { measurePrintedGeometry } from '../scripts/fdm-model-calibration/geometry';
import { isSkipped, loadCalibrationSample, type CalibrationSample } from '../scripts/fdm-model-calibration/sample';
import { PLACEHOLDER_CONSTANTS, predictGrams, predictMinutes, quantile, sampleInput, type ModelConstants } from '../scripts/fdm-model-calibration/model';
import { calibrate, formatReport } from '../scripts/fdm-model-calibration/calibrate';
import { buildSyntheticSliced3mf, type SyntheticFile } from '../scripts/fdm-model-calibration/synthetic';

const run = promisify(execFile);

test('geometry: 20 mm cube scaled ×2 and translated by the build item → 40 mm cube (V 64 cm³, A 96 cm², Z 40)', () => {
  const bytes = buildSyntheticSliced3mf({
    parts: [{ boxMm: [20, 20, 20], transform: [2, 0, 0, 0, 2, 0, 0, 0, 2, 100, 100, 0] }],
    grams: 1, minutes: 1, infillPct: 15, bambuLayout: true,
  });
  const geometry = measurePrintedGeometry(unzipSync(bytes));
  assert.ok(Math.abs(geometry.volumeCm3 - 64) < 1e-9);
  assert.ok(Math.abs(geometry.surfaceCm2 - 96) < 1e-9);
  assert.deepEqual(geometry.sizeMm, { x: 40, y: 40, z: 40 });
});

test('geometry: a rotation is applied fully (box lying down has Z = its shortest edge)', () => {
  // 90° about X: y → z. Box 10 × 30 × 5 becomes 10 × 5 × 30 … rotated back the other way here:
  const bytes = buildSyntheticSliced3mf({
    parts: [{ boxMm: [10, 5, 30], transform: [1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 30, 0] }],
    grams: 1, minutes: 1, infillPct: 15,
  });
  const geometry = measurePrintedGeometry(unzipSync(bytes));
  assert.ok(Math.abs(geometry.sizeMm.z - 5) < 1e-9);
  assert.ok(Math.abs(geometry.sizeMm.y - 30) < 1e-9);
  assert.ok(Math.abs(geometry.volumeCm3 - 1.5) < 1e-9);
});

test('§5.1 sanity check from the plan: 40 mm cube, PETG, t = 0.9 mm, no support', () => {
  const c: ModelConstants = { ...PLACEHOLDER_CONSTANTS, SUPPORT_FACTOR: 0 };
  const input = { volumeCm3: 64, surfaceCm2: 96, zMm: 40, layerHeightMm: 0.2, material: 'PETG' };
  assert.equal(Math.round(predictGrams({ ...input, infill: 0.1 }, c) * 10) / 10, 18.0);
  assert.equal(Math.round(predictGrams({ ...input, infill: 0.15 }, c) * 100) / 100, 21.52);
  assert.equal(Math.round(predictGrams({ ...input, infill: 0.3 }, c) * 100) / 100, 32.06);
});

test('§5.2: a tall, thin, light part is limited by layers, not by plastic flow', () => {
  const c = PLACEHOLDER_CONSTANTS;
  const column = { volumeCm3: 10, surfaceCm2: 80, zMm: 200, infill: 0.15, layerHeightMm: 0.2, material: 'PLA' };
  const flowOnly = 6 + (10 * 0.9 * 0.85) / 0.35; // shell-dominated flow time, roughly
  assert.ok(predictMinutes(column, c) > flowOnly * 2);
});

test('multi-plate and unsliced files are skipped and reported', () => {
  const multi = loadCalibrationSample('two-plates.3mf', buildSyntheticSliced3mf({ parts: [{ boxMm: [10, 10, 10] }], grams: 5, minutes: 30, infillPct: 15, plates: 2 }));
  assert.ok(isSkipped(multi));
  assert.match(multi.reason, /multi-plate/);
  const garbage = loadCalibrationSample('not-a-zip.3mf', new TextEncoder().encode('hello'));
  assert.ok(isSkipped(garbage));
});

function syntheticDataset(truth: ModelConstants): SyntheticFile[] {
  const shapes: Array<[number, number, number]> = [
    [20, 20, 20], [40, 40, 40], [60, 30, 10], [10, 10, 120], [80, 80, 5], [30, 30, 60],
    [50, 20, 20], [15, 15, 15], [70, 40, 30], [25, 25, 90], [100, 10, 10], [45, 45, 12],
    [35, 35, 35], [12, 12, 200], [90, 60, 8], [55, 25, 40],
  ];
  const infills = [10, 15, 20, 30, 15, 50];
  return shapes.map((boxMm, index) => {
    const infillPct = infills[index % infills.length];
    const [x, y, z] = boxMm;
    const input = {
      volumeCm3: (x * y * z) / 1000, surfaceCm2: (2 * (x * y + y * z + x * z)) / 100, zMm: z,
      infill: infillPct / 100, layerHeightMm: 0.2, material: index % 3 === 0 ? 'PETG' : 'PLA',
    };
    return {
      parts: [{ boxMm }], infillPct, material: input.material,
      grams: Math.round(predictGrams(input, truth) * 100) / 100,
      minutes: predictMinutes(input, truth),
    };
  });
}

test('fit recovers synthetic ground truth generated from known constants (PASS)', () => {
  const truth: ModelConstants = { ...PLACEHOLDER_CONSTANTS, SHELL_THICKNESS_MM: 1.2, Q_WALL: 0.5, Q_INFILL: 1.4, MIN_LAYER_SECONDS: 6, T_SETUP: 4 };
  const samples = syntheticDataset(truth).map((spec, index) => loadCalibrationSample(`s${index}.3mf`, buildSyntheticSliced3mf(spec)));
  assert.ok(samples.every((s) => !isSkipped(s)));
  const report = calibrate(samples as CalibrationSample[]);
  assert.equal(report.samples, 16);
  assert.ok(report.fitted.grams.medianPct < 1, `grams median ${report.fitted.grams.medianPct}`);
  assert.ok(report.fitted.minutes.medianPct < 5, `minutes median ${report.fitted.minutes.medianPct}`);
  assert.ok(Math.abs(report.constants.SHELL_THICKNESS_MM - 1.2) < 0.05);
  assert.equal(report.acceptance.pass, true);
  assert.ok(report.fitted.grams.meanPct <= report.placeholder.grams.meanPct);
  assert.ok(report.leaveOneOut);
  const text = formatReport(report);
  assert.match(text, /Overall: PASS/);
  assert.match(text, /SHELL_THICKNESS_MM = /);
  // Each sample is fitted with its own infill from project_settings.config.
  assert.deepEqual([...new Set((samples as CalibrationSample[]).map((s) => s.settings.infill))].sort(), [0.1, 0.15, 0.2, 0.3, 0.5]);
  assert.equal(sampleInput(samples[0] as CalibrationSample).layerHeightMm, 0.2);
});

test('quantile: median and P90 by linear interpolation', () => {
  assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
  assert.ok(Math.abs(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9) - 9.1) < 1e-9);
});

test('CLI: runs on a folder, prints the report, skips multi-plate files', { timeout: 120_000 }, async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'fdm-calibration-'));
  try {
    const specs = syntheticDataset(PLACEHOLDER_CONSTANTS).slice(0, 6);
    for (const [index, spec] of specs.entries()) await writeFile(path.join(folder, `part-${index}.3mf`), buildSyntheticSliced3mf(spec));
    await writeFile(path.join(folder, 'two-plates.3mf'), buildSyntheticSliced3mf({ ...specs[0], plates: 2 }));
    const { stdout } = await run(process.execPath, ['--import', 'tsx', 'scripts/fdm-model-calibration/calibrate.ts', folder], { cwd: process.cwd() });
    assert.match(stdout, /Usable files: 6 {3}Skipped: 1/);
    assert.match(stdout, /skipped two-plates\.3mf: multi-plate/);
    assert.match(stdout, /Acceptance \(median, plan §8 S0\)/);
    assert.match(stdout, /only 6 usable files/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
