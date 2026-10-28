export type SlicerPreset = {
  id: string;
  slicer: 'bambu-studio' | 'orcaslicer' | 'prusaslicer';
  kind: 'filament' | 'process';
  material: string;
  printer: string;
  nozzleMm: number;
  slicerVersion: string;
  /** File name relative to public/downloads/presets/, e.g. basa3d_pla_bambu-studio_a1-mini_0.4mm_v2026-10.json */
  file: string;
  updatedAt: string;
};

/**
 * Phase 53 (S5) — Slicer presets calibrated by BaSa3D workshop.
 * Hard constraint B3: only 'filament' and 'process' presets; never machine profiles (no custom G-code).
 * Workshop files are placed in public/downloads/presets/ with versioned, never-overwritten filenames.
 * Shipped empty until the workshop tests and exports real profile JSONs.
 */
export const HANDBOOK_PRESETS: SlicerPreset[] = [];
