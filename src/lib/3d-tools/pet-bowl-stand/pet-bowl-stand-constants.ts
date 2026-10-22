/**
 * ADR-0050 — Pet bowl stand inputs. Single source for the engine (feature /tools/pet-bowl-stand).
 *
 * Every value tagged `CHƯA ĐO` / `CHƯA CHỐT` / `CHƯA DUYỆT` is a TEMPORARY placeholder: the owner has
 * not supplied the real measurement or decision yet. They are deliberately NOT taken from the Print Paws
 * reference (phase 47). The tool stays behind NEXT_PUBLIC_PET_BOWL_ENABLED=false until
 * PET_BOWL_UNCONFIRMED is empty.
 */
import { PRINTER_PROFILES, type PrinterProfileId } from '@/lib/pricing/printer-profiles';

export type PetSpecies = 'dog' | 'cat';

/** One stainless bowl BaSa3D sells. All diameters are outer measurements in mm. */
export type BowlSize = {
  id: 'S' | 'M';
  /** Ø miệng ngoài (outer rim). */
  rimOuterDiameterMm: number;
  /** Ø vành/gờ — the flange that rests on the stand's ledge. */
  lipDiameterMm: number;
  /** Ø thân ngay dưới gờ — what passes through the hole. */
  bodyBelowLipDiameterMm: number;
  depthMm: number;
  capacityMl: number;
  /** Empty bowl mass, for the full-bowl stability check. */
  emptyMassG: number;
  measured: boolean;
};

// CHƯA ĐO — xem ADR-0050 (owner chưa đo bát thật; số dưới đây chỉ để engine chạy được).
export const BOWL_SIZES: readonly BowlSize[] = [
  { id: 'S', rimOuterDiameterMm: 150, lipDiameterMm: 150, bodyBelowLipDiameterMm: 130, depthMm: 50, capacityMl: 450, emptyMassG: 120, measured: false },
  { id: 'M', rimOuterDiameterMm: 200, lipDiameterMm: 200, bodyBelowLipDiameterMm: 175, depthMm: 60, capacityMl: 1000, emptyMassG: 200, measured: false },
];

/** Hole Ø = bodyBelowLipDiameterMm + HOLE_CLEARANCE_MM. */
export const HOLE_CLEARANCE_MM = 1.0; // CHƯA ĐO — dung sai lỗ ôm bát, xem ADR-0050
/** The lip must overhang the hole by at least this much on each side, else the bowl is blocked. */
export const MIN_LEDGE_WIDTH_MM = 3; // CHƯA ĐO — xem ADR-0050
/** Gap kept between the bowl bottom and the floor/plate under it. */
export const BOWL_FLOOR_CLEARANCE_MM = 5; // CHƯA CHỐT — xem ADR-0050

/** Stand height H = clamp(k × shoulder height, min, max), then H ≥ bowl depth + floor clearance. */
export type HeightRule = { k: number; minMm: number; maxMm: number };
// CHƯA CHỐT — công thức chiều cao, xem ADR-0050 (cố ý KHÔNG dùng hệ số của trang tham khảo).
export const HEIGHT_RULES: Record<PetSpecies, HeightRule> = {
  dog: { k: 0.25, minMm: 60, maxMm: 200 },
  cat: { k: 0.25, minMm: 60, maxMm: 120 },
};
export const SHOULDER_HEIGHT_RANGE_MM = { min: 150, max: 800, step: 5 } as const; // CHƯA CHỐT — xem ADR-0050

/** Stability (ADR-0050 §4): both checks must pass, else export is blocked. */
export const MIN_BASE_TO_HEIGHT_RATIO = 1.0; // CHƯA CHỐT — Ø đáy / H tối thiểu
export const MIN_TIP_ANGLE_DEG = 20; // CHƯA CHỐT — góc nghiêng tối thiểu trước khi đổ, khi bát đầy
export const WATER_DENSITY_G_PER_ML = 1; // giả định: bát đầy nước (nặng hơn thức ăn khô)
export const PLA_DENSITY_G_PER_CM3 = 1.24; // = src/lib/pricing/mesh-estimator.ts

/** Printability (ADR-0050 §5). */
export const MAX_OVERHANG_DEG = 45;
export const MIN_WALL_MM = 1.6; // CHƯA CHỐT — 4 đường 0,4 mm
export const BED_MARGIN_MM = 5; // khoảng chừa mỗi cạnh bàn in

/**
 * Bed check uses the smallest build volume of every printer profile (OWNER 2026-10-22), so a stand that
 * passes fits whichever machine prints it. Read from printer-profiles.ts — never hard-coded.
 */
export function petBowlBuildVolumeMm(profiles = Object.values(PRINTER_PROFILES)): { x: number; y: number; z: number } {
  return {
    x: Math.min(...profiles.map(p => p.buildVolumeMm.x)),
    y: Math.min(...profiles.map(p => p.buildVolumeMm.y)),
    z: Math.min(...profiles.map(p => p.buildVolumeMm.z)),
  };
}
/** Machine the stand is mainly printed on — informs slicer notes only, not the bed check. */
export const PET_BOWL_MAIN_PRINTER_ID: PrinterProfileId | null = null; // CHƯA CHỐT — Snapmaker U1 hay Bambu P2S, xem ADR-0050

/** Always shown for dogs (ADR-0050 §6). */
export const GDV_WARNING = {
  // CHƯA DUYỆT — owner chưa duyệt nội dung cảnh báo, xem ADR-0050
  vi: 'Giá nâng cao có thể không phù hợp với mọi chú chó. Hãy hỏi bác sĩ thú y trước khi dùng, nhất là với giống chó lớn, ngực sâu.',
  en: 'A raised feeder may not suit every dog. Ask your veterinarian before use, especially for large, deep-chested breeds.',
} as const;

/** Values still awaiting the owner. The flag must stay false while this list is non-empty. */
export const PET_BOWL_UNCONFIRMED = [
  'BOWL_SIZES (đo bát thật: Ø miệng, Ø gờ, Ø thân dưới gờ, sâu, dung tích, khối lượng)',
  'HOLE_CLEARANCE_MM',
  'MIN_LEDGE_WIDTH_MM',
  'BOWL_FLOOR_CLEARANCE_MM',
  'HEIGHT_RULES (k, min, max theo loài)',
  'SHOULDER_HEIGHT_RANGE_MM',
  'MIN_BASE_TO_HEIGHT_RATIO',
  'MIN_TIP_ANGLE_DEG',
  'MIN_WALL_MM',
  'PET_BOWL_MAIN_PRINTER_ID (máy in chính)',
  'GDV_WARNING (VI/EN)',
] as const;
