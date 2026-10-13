// Phase 33 S0 — turn one sliced .3mf into a calibration sample (offline only).
// Ground truth (grams, minutes) comes from the shop's own parser `parseThreeMfSliceInfo`; geometry
// from ./geometry.ts; print settings from Metadata/project_settings.config (+ per-object overrides
// in Metadata/model_settings.config).
import { strFromU8, unzipSync } from 'fflate';
import { parseThreeMfSliceInfo } from '../../src/lib/parsers/threemf-slice-info';
import { measurePrintedGeometry, type PrintedGeometry } from './geometry';

export type PrintSettings = {
  layerHeightMm: number;
  infill: number; // 0–1
  wallLoops: number | null;
  lineWidthMm: number | null;
  topShellLayers: number | null;
  bottomShellLayers: number | null;
  supportEnabled: boolean | null;
  /** Objects in this file carry different infill overrides (averaged — less reliable sample). */
  mixedInfill: boolean;
};

export type CalibrationSample = {
  file: string;
  material: string;
  colors: number;
  actualGrams: number;
  actualMinutes: number;
  geometry: PrintedGeometry;
  settings: PrintSettings;
};

export type SkippedFile = { file: string; reason: string };

function first(value: unknown): string | undefined {
  if (Array.isArray(value)) return first(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function num(value: unknown): number | null {
  const text = first(value);
  if (text === undefined) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null ? null : parsed / 100;
}

function attr(attrs: string, name: string): string | undefined {
  return attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
}

/** Per-object overrides + modifier/negative parts from Bambu/Orca's model_settings.config. */
function readModelSettings(xml: string | undefined, mainPath: string) {
  const infillOverrides: number[] = [];
  const layerOverrides: number[] = [];
  const excludedParts = new Map<string, Set<string>>();
  let objectCount = 0;
  for (const object of (xml ?? '').matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    objectCount += 1;
    const id = attr(object[1], 'id');
    const body = object[2].replace(/<part\b[\s\S]*?<\/part>/g, (part) => {
      const partId = attr(part, 'id');
      const subtype = attr(part, 'subtype') ?? 'normal_part';
      if (id && partId && subtype !== 'normal_part') {
        const key = `${mainPath}#${id}`;
        if (!excludedParts.has(key)) excludedParts.set(key, new Set());
        excludedParts.get(key)!.add(partId);
      }
      return '';
    });
    const meta = (key: string) => body.match(new RegExp(`<metadata\\s+key="${key}"\\s+value="([^"]*)"`))?.[1];
    const infill = percent(meta('sparse_infill_density'));
    if (infill !== null) infillOverrides.push(infill);
    const layer = num(meta('layer_height'));
    if (layer !== null) layerOverrides.push(layer);
  }
  return { infillOverrides, layerOverrides, excludedParts, objectCount };
}

export function loadCalibrationSample(file: string, bytes: Uint8Array): CalibrationSample | SkippedFile {
  let slice;
  try {
    slice = parseThreeMfSliceInfo(bytes);
  } catch (error) {
    return { file, reason: `not a sliced .3mf (${error instanceof Error ? error.message : String(error)})` };
  }
  if (slice.plateCount !== 1) return { file, reason: `multi-plate file (${slice.plateCount} plates) — export a single plate` };
  const actualGrams = slice.filaments.reduce((sum, f) => sum + f.totalGrams, 0);
  if (!(actualGrams > 0) || !(slice.totalPrintMinutes > 0)) return { file, reason: 'slice_info has no grams/time' };

  const files = unzipSync(bytes, { filter: (entry) => entry.name.toLowerCase().endsWith('.model') || entry.name.startsWith('Metadata/') && entry.name.endsWith('.config') });
  const mainPath = Object.keys(files).find((name) => name.toLowerCase() === '3d/3dmodel.model') ?? '3D/3dmodel.model';

  let project: Record<string, unknown> = {};
  const projectRaw = files['Metadata/project_settings.config'];
  if (projectRaw) {
    try { project = JSON.parse(strFromU8(projectRaw)) as Record<string, unknown>; } catch { return { file, reason: 'project_settings.config is not JSON' }; }
  }
  const modelSettings = readModelSettings(files['Metadata/model_settings.config'] ? strFromU8(files['Metadata/model_settings.config']) : undefined, mainPath);

  let geometry: PrintedGeometry;
  try {
    geometry = measurePrintedGeometry(files, { excludedParts: modelSettings.excludedParts });
  } catch (error) {
    return { file, reason: `geometry unreadable (${error instanceof Error ? error.message : String(error)})` };
  }

  const globalInfill = percent(project.sparse_infill_density);
  const infillValues = [...modelSettings.infillOverrides];
  // Objects without an override (or no model_settings.config at all) use the global value.
  const objectsWithoutOverride = Math.max(modelSettings.objectCount, 1) - infillValues.length;
  if (objectsWithoutOverride > 0 && globalInfill !== null) infillValues.push(globalInfill);
  if (!infillValues.length) return { file, reason: 'no sparse_infill_density in project_settings.config' };
  const infill = infillValues.reduce((a, b) => a + b, 0) / infillValues.length;
  const layerHeightMm = modelSettings.layerOverrides[0] ?? num(project.layer_height) ?? 0.2;

  const supportRaw = first(project.enable_support);
  const filamentType = slice.filaments.find((f) => f.type)?.type ?? first(project.filament_type) ?? 'PLA';
  return {
    file,
    material: filamentType.toUpperCase(),
    colors: slice.filaments.filter((f) => f.totalGrams > 0).length,
    actualGrams,
    actualMinutes: slice.totalPrintMinutes,
    geometry,
    settings: {
      layerHeightMm,
      infill,
      wallLoops: num(project.wall_loops),
      lineWidthMm: num(project.outer_wall_line_width) ?? num(project.line_width),
      topShellLayers: num(project.top_shell_layers),
      bottomShellLayers: num(project.bottom_shell_layers),
      supportEnabled: supportRaw === undefined ? null : supportRaw === '1' || supportRaw === 'true',
      mixedInfill: new Set(infillValues).size > 1,
    },
  };
}

export function isSkipped(value: CalibrationSample | SkippedFile): value is SkippedFile {
  return 'reason' in value;
}
