/**
 * Extracts physical dimensions for MakerWorld models.
 *
 * 1. extractDimensionsFromGlbZip: Ultra-fast server-side extraction from MakerWorld's
 *    official pre-rendered GLB assets (low_compression_glb). Takes ~500-800ms, parses glTF accessors
 *    directly, and returns exact physical dimensions in millimeters without downloading heavy 3MF.
 * 2. extractAuthorDimensions: Regex fallback for descriptions (strictly filters out slicer settings).
 */

import { unzipSync, strFromU8 } from 'fflate';

// Slicer terms and hardware accessories that must NEVER be confused with model dimensions
const SLICER_AND_HARDWARE_RE =
  /\b(layer|layer\s*height|line\s*height|lớp\s*in|nozzle|đầu\s*phun|wall|vỏ|shell|infill|độ\s*đặc|brim|raft|skirt|perimeters?|screw|ốc|magnet|nam\s*châm|bearing|bạc\s*đạn|pin|thẻ|bút)\b/i;

/**
 * Downloads MakerWorld's lightweight low_compression_glb zip, inspects the glTF accessors
 * for every plate, and extracts the exact physical bounding box in millimeters (dx × dy × dz mm).
 * Bounded by a 4-second timeout so it never blocks or slows down resolution.
 */
export async function extractDimensionsFromGlbZip(
  zipUrl: string,
  timeoutMs = 4000
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(zipUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const unzipped = unzipSync(buf);

    let maxDx = 0;
    let maxDy = 0;
    let maxDz = 0;
    let singlePlateDim: string | null = null;
    let plateCount = 0;

    for (const [name, uBuf] of Object.entries(unzipped)) {
      if (name.endsWith('.glb')) {
        plateCount++;
        const view = new DataView(uBuf.buffer, uBuf.byteOffset);
        if (view.getUint32(0, true) !== 0x46546c67) continue; // "glTF" binary magic
        const jsonLen = view.getUint32(12, true);
        const jsonStr = strFromU8(uBuf.subarray(20, 20 + jsonLen));
        const gltf = JSON.parse(jsonStr) as {
          accessors?: Array<{ min?: number[]; max?: number[]; type?: string }>;
        };

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (const acc of gltf.accessors || []) {
          if (
            acc.min &&
            acc.max &&
            acc.type === 'VEC3' &&
            acc.min.length === 3 &&
            acc.max.length === 3
          ) {
            minX = Math.min(minX, acc.min[0]);
            minY = Math.min(minY, acc.min[1]);
            minZ = Math.min(minZ, acc.min[2]);
            maxX = Math.max(maxX, acc.max[0]);
            maxY = Math.max(maxY, acc.max[1]);
            maxZ = Math.max(maxZ, acc.max[2]);
          }
        }
        if (Number.isFinite(minX) && Number.isFinite(maxX)) {
          // glTF coordinates are in meters; multiply by 1000 to get millimeters
          const dx = Math.round((maxX - minX) * 1000);
          const dy = Math.round((maxY - minY) * 1000);
          const dz = Math.round((maxZ - minZ) * 1000);
          const currentMaxDim = Math.max(dx, dy, dz);
          if (currentMaxDim > Math.max(maxDx, maxDy, maxDz)) {
            maxDx = dx;
            maxDy = dy;
            maxDz = dz;
          }
          if (!singlePlateDim) {
            singlePlateDim = `${dx} × ${dy} × ${dz} mm`;
          }
        }
      }
    }

    if (plateCount === 1 && singlePlateDim) {
      return singlePlateDim;
    }
    if (maxDx > 0) {
      return `${maxDx} × ${maxDy} × ${maxDz} mm`;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractAuthorDimensions(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;

  const clean = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return null;

  // Pattern 1: Explicit 3D dimensions (e.g. 150x120x80mm or 15 x 12 x 8 cm)
  const p3d = clean.match(
    /\b(\d+(?:[.,]\d+)?)\s*(?:x|×|X|\*)\s*(\d+(?:[.,]\d+)?)\s*(?:x|×|X|\*)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|inch|in)\b/i
  );
  if (p3d) {
    const d1 = parseFloat(p3d[1].replace(',', '.'));
    const d2 = parseFloat(p3d[2].replace(',', '.'));
    const d3 = parseFloat(p3d[3].replace(',', '.'));
    const unit = p3d[4].toLowerCase().startsWith('in') ? 'inch' : p3d[4].toLowerCase();
    const minVal = unit === 'mm' ? 10 : 1;
    if (d1 >= minVal && d2 >= minVal && d3 >= minVal) {
      return `${p3d[1]} × ${p3d[2]} × ${p3d[3]} ${unit}`;
    }
  }

  // Pattern 2: Explicit 2D dimensions (e.g. 150x120mm or 15 x 12 cm)
  const p2d = clean.match(
    /\b(\d+(?:[.,]\d+)?)\s*(?:x|×|X|\*)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|inch|in)\b/i
  );
  if (p2d) {
    const d1 = parseFloat(p2d[1].replace(',', '.'));
    const d2 = parseFloat(p2d[2].replace(',', '.'));
    const unit = p2d[3].toLowerCase().startsWith('in') ? 'inch' : p2d[3].toLowerCase();
    const minVal = unit === 'mm' ? 10 : 1;
    if (d1 >= minVal && d2 >= minVal) {
      return `${p2d[1]} × ${p2d[2]} ${unit}`;
    }
  }

  // Pattern 3: Number + Unit + Direction (e.g. "24 cm Height", "180mm tall")
  const pHeight = clean.match(
    /\b(\d+(?:[.,]\d+)?)\s*(mm|cm|inch)\s*(?:height|tall|high|cao)\b/i
  );
  if (pHeight) {
    const val = parseFloat(pHeight[1].replace(',', '.'));
    const unit = pHeight[2].toLowerCase();
    const minVal = unit === 'mm' ? 20 : 2;
    const start = Math.max(0, (pHeight.index ?? 0) - 25);
    const end = Math.min(clean.length, (pHeight.index ?? 0) + pHeight[0].length + 25);
    const surrounding = clean.slice(start, end);

    if (val >= minVal && !SLICER_AND_HARDWARE_RE.test(surrounding)) {
      return `${pHeight[1]} ${unit} (Cao)`;
    }
  }

  // Pattern 4: Prefix Direction + Number + Unit (e.g. "Height: 24cm", "Mẫu cao 15cm")
  const pPrefixHeight = clean.match(
    /(?:height|chiều cao|mẫu cao|cao)\s*[:=–-]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|inch)\b/i
  );
  if (pPrefixHeight) {
    const val = parseFloat(pPrefixHeight[1].replace(',', '.'));
    const unit = pPrefixHeight[2].toLowerCase();
    const minVal = unit === 'mm' ? 20 : 2;
    const start = Math.max(0, (pPrefixHeight.index ?? 0) - 20);
    const surrounding = clean.slice(start, (pPrefixHeight.index ?? 0) + pPrefixHeight[0].length + 20);

    if (val >= minVal && !SLICER_AND_HARDWARE_RE.test(surrounding)) {
      return `${pPrefixHeight[1]} ${unit} (Cao)`;
    }
  }

  return null;
}

/**
 * Formats 3D bounding box dimensions in millimeters.
 */
export function formatDimensionsMm(dim: { x: number; y: number; z: number }): string {
  const round = (val: number) => (Math.round(val * 10) / 10).toString();
  return `${round(dim.x)} × ${round(dim.y)} × ${round(dim.z)} mm`;
}

/**
 * Formats 3D bounding box dimensions in centimeters.
 */
export function formatDimensionsCm(dim: { x: number; y: number; z: number }): string {
  const round = (val: number) => (Math.round((val / 10) * 10) / 10).toFixed(1);
  return `${round(dim.x)} × ${round(dim.y)} × ${round(dim.z)} cm`;
}
