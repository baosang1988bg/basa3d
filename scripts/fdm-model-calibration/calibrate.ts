// Phase 33 S0 — calibrate the §5.1/§5.2 FDM estimate model against the shop's own sliced .3mf files.
//
//   npx tsx scripts/fdm-model-calibration/calibrate.ts <folder-with-sliced-3mf> [--json report.json]
//
// Offline only: reads local files, writes nothing unless --json is given, never touches the DB.
// See README.md in this folder.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isSkipped, loadCalibrationSample, type CalibrationSample, type SkippedFile } from './sample';
import {
  ACCEPTANCE,
  PLACEHOLDER_CONSTANTS,
  acceptance,
  evaluate,
  fitConstants,
  leaveOneOut,
  type ErrorStats,
  type ModelConstants,
} from './model';

export type CalibrationReport = {
  samples: number;
  skipped: SkippedFile[];
  placeholder: ReturnType<typeof evaluate>;
  fitted: ReturnType<typeof evaluate>;
  constants: ModelConstants;
  leaveOneOut: { grams: ErrorStats; minutes: ErrorStats } | null;
  acceptance: ReturnType<typeof acceptance>;
  warnings: string[];
};

export async function loadFolder(folder: string): Promise<{ samples: CalibrationSample[]; skipped: SkippedFile[] }> {
  const names = (await readdir(folder)).filter((name) => name.toLowerCase().endsWith('.3mf')).sort();
  const samples: CalibrationSample[] = [];
  const skipped: SkippedFile[] = [];
  for (const name of names) {
    const result = loadCalibrationSample(name, new Uint8Array(await readFile(path.join(folder, name))));
    if (isSkipped(result)) skipped.push(result); else samples.push(result);
  }
  return { samples, skipped };
}

export function calibrate(samples: CalibrationSample[], skipped: SkippedFile[] = []): CalibrationReport {
  const warnings: string[] = [];
  if (samples.length < 15) warnings.push(`only ${samples.length} usable files — the plan asks for 15–20 (solid, thin-shell, tall/slender, detailed)`);
  for (const sample of samples) {
    if (sample.colors > 1) warnings.push(`${sample.file}: ${sample.colors} filaments — slice_info grams include purge/prime tower waste`);
    if (sample.settings.mixedInfill) warnings.push(`${sample.file}: objects have different infill — averaged`);
    if (sample.settings.supportEnabled) warnings.push(`${sample.file}: supports enabled in the slicer`);
  }
  const constants = fitConstants(samples);
  const fitted = evaluate(samples, constants);
  return {
    samples: samples.length,
    skipped,
    placeholder: evaluate(samples, PLACEHOLDER_CONSTANTS),
    fitted,
    constants,
    leaveOneOut: samples.length >= 3 ? leaveOneOut(samples) : null,
    acceptance: acceptance(fitted),
    warnings,
  };
}

const pct = (value: number) => `${value.toFixed(1)}%`;
const fixed = (value: number, digits = 1) => value.toFixed(digits);

export function formatReport(report: CalibrationReport): string {
  const lines: string[] = [];
  lines.push('FDM estimate model calibration (Phase 33 S0)', '');
  lines.push(`Usable files: ${report.samples}   Skipped: ${report.skipped.length}`);
  for (const skip of report.skipped) lines.push(`  - skipped ${skip.file}: ${skip.reason}`);
  lines.push('', 'Per file (fitted constants):');
  lines.push(['file', 'g actual', 'g pred', 'g err', 'min actual', 'min pred', 'min err'].join('\t'));
  for (const row of report.fitted.rows) {
    lines.push([row.file, fixed(row.actualGrams), fixed(row.predictedGrams), pct(row.gramsErrPct), row.actualMinutes, row.predictedMinutes, pct(row.minutesErrPct)].join('\t'));
  }
  const stat = (label: string, s: ErrorStats) => `${label}: median ${pct(s.medianPct)}  P90 ${pct(s.p90Pct)}  mean ${pct(s.meanPct)}`;
  lines.push('', 'Absolute % error');
  lines.push(stat('  grams   (placeholder)', report.placeholder.grams), stat('  minutes (placeholder)', report.placeholder.minutes));
  lines.push(stat('  grams   (fitted)     ', report.fitted.grams), stat('  minutes (fitted)     ', report.fitted.minutes));
  if (report.leaveOneOut) {
    lines.push(stat('  grams   (leave-one-out)', report.leaveOneOut.grams), stat('  minutes (leave-one-out)', report.leaveOneOut.minutes));
  }
  lines.push('', 'Fitted constants (copy into src/lib/pricing/fdm-estimate-model.ts in S3):');
  for (const [key, value] of Object.entries(report.constants)) lines.push(`  ${key} = ${Number(value.toFixed(4))}`);
  lines.push('', `Acceptance (median, plan §8 S0): grams ≤ ${ACCEPTANCE.gramsMedianPct}% → ${report.acceptance.grams ? 'PASS' : 'FAIL'}; minutes ≤ ${ACCEPTANCE.minutesMedianPct}% → ${report.acceptance.minutes ? 'PASS' : 'FAIL'}`);
  lines.push(`Overall: ${report.acceptance.pass ? 'PASS' : 'FAIL'} — the Owner decides whether to proceed to S3.`);
  if (report.warnings.length) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings) lines.push(`  - ${warning}`);
  }
  return lines.join('\n');
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  const jsonIndex = args.indexOf('--json');
  const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : undefined;
  const folder = args.find((arg, index) => !arg.startsWith('--') && !(jsonIndex >= 0 && index === jsonIndex + 1));
  if (!folder) {
    console.error('Usage: npx tsx scripts/fdm-model-calibration/calibrate.ts <folder-with-sliced-3mf> [--json report.json]');
    return 2;
  }
  const { samples, skipped } = await loadFolder(folder);
  if (!samples.length) {
    console.error(`No usable single-plate sliced .3mf files in ${folder}.`);
    for (const skip of skipped) console.error(`  - ${skip.file}: ${skip.reason}`);
    return 1;
  }
  const report = calibrate(samples, skipped);
  console.log(formatReport(report));
  if (jsonPath) await writeFile(jsonPath, JSON.stringify(report, null, 2));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv).then((code) => { process.exitCode = code; }, (error) => { console.error(error); process.exitCode = 1; });
}
