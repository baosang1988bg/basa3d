// Printer profiles and hardware characteristics for multi-color and FDM printing.
// Pure module (no DB access, no Node APIs) — safe for client & server.
//
// Key distinction:
// - SINGLE_NOZZLE_AMS (e.g. Bambu P2S / P1S / A1 + AMS): One nozzle shared by all colors.
//   Every color change requires cutting, retracting, loading, and flushing 150-600 mm³ of molten
//   filament down the poop chute (~40 s), resulting in heavy purge waste (often 10x-20x the model weight
//   on small prints like keycaps).
// - TOOL_CHANGER (e.g. Snapmaker U1 with 4 independent toolheads): Each color has its own nozzle.
//   Swapping colors only parks one toolhead and picks up the other (~10 s). Flush purge = 0 mm³.
//   Only a small prime tower/wipe (~25 mm³) is needed to maintain nozzle pressure.

export type PrinterType = 'SINGLE_NOZZLE_AMS' | 'TOOL_CHANGER' | 'SINGLE_EXTRUDER';

/** Printers a customer/staff can pick as the target machine. Validated with z.enum at every boundary. */
export const PRINTER_PROFILE_IDS = ['SNAPMAKER_U1', 'BAMBU_P2S'] as const;
export type PrinterProfileId = typeof PRINTER_PROFILE_IDS[number];

export type PrinterProfile = {
  id: PrinterProfileId;
  name: string;
  shortName: string;
  type: PrinterType;
  buildVolumeMm: { x: number; y: number; z: number };
  /** Default purge flush volume per color change in mm³. 0 for tool changers. */
  defaultFlushMm3: number;
  /** Default prime tower volume per color change in mm³. */
  defaultPrimeMm3: number;
  /** Seconds required per color change / toolhead swap. */
  colorChangeSeconds: number;
  /** Typical machine power in kW. */
  typicalPowerKw: number;
  /** Typical machine price in VND (integer, Rule #2). */
  typicalMachinePriceVnd: number;
  /** Depreciation lifetime in hours. */
  machineLifetimeHours: number;
};

export const PRINTER_PROFILES: Record<PrinterProfileId, PrinterProfile> = {
  BAMBU_P2S: {
    id: 'BAMBU_P2S',
    name: 'Bambu Lab P2S / P1S / A1 (AMS)',
    shortName: 'Bambu AMS',
    type: 'SINGLE_NOZZLE_AMS',
    buildVolumeMm: { x: 256, y: 256, z: 256 },
    defaultFlushMm3: 300,
    defaultPrimeMm3: 45,
    colorChangeSeconds: 40,
    typicalPowerKw: 0.2,
    typicalMachinePriceVnd: 15_000_000,
    machineLifetimeHours: 10_000,
  },
  SNAPMAKER_U1: {
    id: 'SNAPMAKER_U1',
    name: 'Snapmaker U1 (4 Toolheads)',
    shortName: 'Snapmaker U1',
    type: 'TOOL_CHANGER',
    buildVolumeMm: { x: 270, y: 270, z: 270 },
    defaultFlushMm3: 0, // No single-nozzle purge waste
    defaultPrimeMm3: 25, // Small prime tower or nozzle wipe only
    colorChangeSeconds: 10, // Fast toolhead swap
    typicalPowerKw: 0.25,
    typicalMachinePriceVnd: 22_000_000,
    machineLifetimeHours: 10_000,
  },
};

/** Fallback when neither the caller nor the file names a printer (conservative: AMS purge counted). */
export const DEFAULT_PRINTER_PROFILE = PRINTER_PROFILES.BAMBU_P2S;
/** Pre-selected target in the storefront form and the admin calculator (shop's recommended machine). */
export const DEFAULT_PRINTER_TARGET_ID: PrinterProfileId = 'SNAPMAKER_U1';

export function isPrinterProfileId(value: unknown): value is PrinterProfileId {
  return typeof value === 'string' && (PRINTER_PROFILE_IDS as readonly string[]).includes(value);
}

/**
 * Resolves a printer profile from an explicit target or auto-detected slicer model name.
 * e.g. "Bambu Lab A1" -> BAMBU_P2S, "Snapmaker U1" -> SNAPMAKER_U1.
 */
export function resolvePrinterProfile(nameOrModel?: string | null): PrinterProfile {
  if (!nameOrModel) return DEFAULT_PRINTER_PROFILE;
  const normalized = nameOrModel.trim().toLowerCase();
  if (normalized.includes('u1') || normalized.includes('snapmaker')) {
    return PRINTER_PROFILES.SNAPMAKER_U1;
  }
  return DEFAULT_PRINTER_PROFILE;
}

type MachineConfig = { printerPowerKw: number; machinePriceVnd: number; machineLifetimeHours: number };

/**
 * Machine cost inputs for the admin calculator. Snapmaker U1 overrides power / price / lifetime with
 * its profile values; Bambu P2S keeps the shop's saved pricing config (configured for the AMS fleet).
 */
export function applyPrinterProfileToConfig<T extends MachineConfig>(config: T, printerId: PrinterProfileId): T {
  if (printerId !== 'SNAPMAKER_U1') return config;
  const profile = PRINTER_PROFILES.SNAPMAKER_U1;
  return {
    ...config,
    printerPowerKw: profile.typicalPowerKw,
    machinePriceVnd: profile.typicalMachinePriceVnd,
    machineLifetimeHours: profile.machineLifetimeHours,
  };
}
