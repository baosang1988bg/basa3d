// Phase 9: reads Metadata/slice_info.config out of a Bambu Studio-style `.3mf` (a ZIP/OPC package) to
// auto-fill the pricing engine's plate count, print time, and per-filament consumption.
//
// Verified in the Phase 9 second-pass review against estampo/bambox's BambuStudio reference
// `tests/fixtures/reference.gcode.3mf` (BambuStudio 02.05.00.66). Bambu/Orca use the `.config`
// filename even though its contents are XML. Keep the old `.xml` path as a compatibility fallback
// for archives produced by other tooling during the provisional implementation.
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { DomainError } from '../domain-error';

const SLICE_INFO_PATHS = ['Metadata/slice_info.config', 'Metadata/slice_info.xml'] as const;

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export type ParsedFilament = { filamentId: string; type: string | null; color: string | null; usedGrams: number };
export type ParsedPlate = { index: number; predictionSeconds: number; filaments: ParsedFilament[] };
export type ParsedSliceInfo = {
  plateCount: number;
  totalPrintMinutes: number;
  plates: ParsedPlate[];
  /** Same filament id/color, summed across every plate — this is the number the pricing engine
   * actually wants (total gram consumption per color for the whole job, waste-inclusive per
   * catalog-spec.md's Phase 9 addendum). */
  filaments: { filamentId: string; type: string | null; color: string | null; totalGrams: number }[];
};

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function findMetadataValue(metadata: Record<string, unknown>[], key: string): string | undefined {
  const entry = metadata.find((item) => item['@_key'] === key);
  const value = entry?.['@_value'];
  return typeof value === 'string' ? value : undefined;
}

export function parseThreeMfSliceInfo(fileBytes: Uint8Array): ParsedSliceInfo {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(fileBytes, { filter: (file) => SLICE_INFO_PATHS.includes(file.name as typeof SLICE_INFO_PATHS[number]) });
  } catch {
    throw new DomainError('INVALID_3MF_FILE', 'File không đọc được — không phải định dạng .3mf (ZIP) hợp lệ.', 400);
  }

  const xmlBytes = SLICE_INFO_PATHS.map((path) => entries[path]).find(Boolean);
  if (!xmlBytes) {
    throw new DomainError(
      '3MF_MISSING_SLICE_INFO',
      'File .3mf này chưa qua bước Slice trong Bambu Studio/Orca Slicer (không có Metadata/slice_info.config) — hãy Slice rồi export lại, hoặc nhập thông số tay.',
      422,
    );
  }

  const xml = xmlParser.parse(strFromU8(xmlBytes)) as { config?: { plate?: unknown } };
  const rawPlates = toArray(xml.config?.plate) as Record<string, unknown>[];
  if (!rawPlates.length) {
    throw new DomainError('3MF_MISSING_SLICE_INFO', 'Không tìm thấy dữ liệu plate nào trong slice_info.xml.', 422);
  }

  const plates: ParsedPlate[] = rawPlates.map((plate, plateIndex) => {
    const metadata = toArray(plate.metadata as Record<string, unknown>[] | undefined);
    const predictionSeconds = Number(findMetadataValue(metadata, 'prediction') ?? 0);
    const index = Number(findMetadataValue(metadata, 'index') ?? plateIndex + 1);
    const filaments: ParsedFilament[] = toArray(plate.filament as Record<string, unknown>[] | undefined).map((filament) => ({
      filamentId: String(filament['@_id'] ?? ''),
      type: typeof filament['@_type'] === 'string' ? (filament['@_type'] as string) : null,
      color: typeof filament['@_color'] === 'string' ? (filament['@_color'] as string) : null,
      usedGrams: Number(filament['@_used_g'] ?? 0),
    }));
    return { index, predictionSeconds, filaments };
  });

  const totalPrintMinutes = Math.round(plates.reduce((sum, plate) => sum + plate.predictionSeconds, 0) / 60);

  const filamentTotals = new Map<string, { filamentId: string; type: string | null; color: string | null; totalGrams: number }>();
  for (const plate of plates) {
    for (const filament of plate.filaments) {
      const key = `${filament.filamentId}:${filament.color ?? ''}`;
      const existing = filamentTotals.get(key);
      if (existing) existing.totalGrams += filament.usedGrams;
      else filamentTotals.set(key, { filamentId: filament.filamentId, type: filament.type, color: filament.color, totalGrams: filament.usedGrams });
    }
  }

  return { plateCount: plates.length, totalPrintMinutes, plates, filaments: [...filamentTotals.values()] };
}
