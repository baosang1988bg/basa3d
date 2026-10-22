// Admin pricing calculator: turns a staff-uploaded .3mf into the panel's draft inputs.
//   sliced   (slice_info.config)   → exact plates / minutes / grams per filament, as before (Phase 9).
//   unsliced (project settings)    → geometry-based model grams + the target printer's purge or prime
//                                    tower and color-change minutes (Phase 40 estimate), so staff no
//                                    longer get 3MF_MISSING_SLICE_INFO for a typical MakerWorld project.
// Pure (no DB) — the route only adds auth + size limits.
import { DomainError } from '../lib/domain-error';
import { parseThreeMfSliceInfo } from '../lib/parsers/threemf-slice-info';
import { parseThreeMfProjectInfo } from '../lib/parsers/threemf-project-info';
import { parseThreeMfMeshVolume } from '../lib/parsers/mesh-volume';
import { estimatePrintMinutes } from '../lib/pricing/mesh-estimator';
import { PRINTER_PROFILES, type PrinterProfileId, type PrinterType } from '../lib/pricing/printer-profiles';
import { MESH_FILL_RANGE, PLA_DENSITY, estimateColorPurge } from './instant-estimate.service';

export type DraftFilament = { filamentId: string; type: string | null; color: string | null; totalGrams: number; label?: string };

export type ThreeMfPricingDraft =
  | { source: 'SLICED'; plateCount: number; totalPrintMinutes: number; filaments: DraftFilament[] }
  | {
      source: 'PROJECT_ESTIMATE';
      plateCount: number;
      totalPrintMinutes: number;
      filaments: DraftFilament[];
      printer: { id: PrinterProfileId; name: string; type: PrinterType };
      modelGrams: number;
      purgeGrams: number;
      colorChanges: number;
      colorChangeMinutes: number;
    };

/** Unknown walls/infill for a raw mesh: staff get the middle of the storefront's MESH range and edit it. */
const DRAFT_FILL = (MESH_FILL_RANGE.low + MESH_FILL_RANGE.high) / 2;

export function buildThreeMfPricingDraft(bytes: Uint8Array, printerId: PrinterProfileId): ThreeMfPricingDraft {
  try {
    return { source: 'SLICED', ...parseThreeMfSliceInfo(bytes) };
  } catch (error) {
    if (!(error instanceof DomainError && error.code === '3MF_MISSING_SLICE_INFO')) throw error;
    const draft = estimateUnsliced(bytes, printerId);
    if (!draft) throw error;
    return draft;
  }
}

function estimateUnsliced(bytes: Uint8Array, printerId: PrinterProfileId): ThreeMfPricingDraft | null {
  let volumeCm3: number;
  try {
    volumeCm3 = parseThreeMfMeshVolume(bytes).volumeCm3;
  } catch (error) {
    if (error instanceof DomainError) return null;
    throw error;
  }
  const profile = PRINTER_PROFILES[printerId];
  const project = parseThreeMfProjectInfo(bytes);
  const purge = project ? estimateColorPurge(project, PLA_DENSITY, profile.id) : null;
  const modelGrams = Math.max(1, Math.round(volumeCm3 * PLA_DENSITY * DRAFT_FILL * 10) / 10);
  const purgeGrams = purge?.purgeGrams ?? 0;
  const colorChanges = purge?.colorChanges ?? 0;
  const colorChangeMinutes = purge?.extraMinutes ?? 0;
  const type = purge?.filamentTypes.length === 1 ? purge.filamentTypes[0] : null;
  const colors = purge?.colors.join(' ') || null;

  const filaments: DraftFilament[] = [
    { filamentId: 'model', type, color: colors, totalGrams: modelGrams, label: `Mô hình (ước tính hình học)${colors ? ` ${colors}` : ''}` },
  ];
  if (purgeGrams > 0) {
    const what = profile.type === 'TOOL_CHANGER' ? `Tháp mồi ${profile.shortName}` : `Nhựa xả ${profile.shortName}`;
    filaments.push({ filamentId: 'purge', type, color: null, totalGrams: purgeGrams, label: `${what} (~${colorChanges} lần đổi màu)` });
  }
  return {
    source: 'PROJECT_ESTIMATE',
    plateCount: Math.max(project?.plates.length ?? 1, 1),
    totalPrintMinutes: Math.round(estimatePrintMinutes(modelGrams + purgeGrams)) + colorChangeMinutes,
    filaments,
    printer: { id: profile.id, name: profile.name, type: profile.type },
    modelGrams,
    purgeGrams,
    colorChanges,
    colorChangeMinutes,
  };
}
