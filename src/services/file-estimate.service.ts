// Option 2 (ADR-0034): quote-first for uploaded files. The customer uploads (existing rate-limited
// attachments route), sees a price, and only then leaves contact details.
//   .3mf (sliced in Bambu Studio / Orca) → exact time + grams → SLICED estimate
//   .stl / .obj                          → volume only      → MESH price range
//   .3mf not sliced, .step, images       → no automatic price (staff quotes)
import { DomainError } from '../lib/domain-error';
import { parseThreeMfSliceInfo } from '../lib/parsers/threemf-slice-info';
import { parseObjVolume, parseStlVolume, parseThreeMfMeshVolume } from '../lib/parsers/mesh-volume';
import {
  downloadCustomRequestAttachment,
  getCustomRequestAttachmentSize,
  ATTACHMENT_PATH_RE,
  MAX_ATTACHMENT_PARSE_BYTES,
} from './custom-request.service';
import {
  estimateFromMesh,
  estimateFromSliceInfo,
  loadPricingContext,
  type InstantEstimate,
  type PricingContext,
} from './instant-estimate.service';

/** `TOO_LARGE` (Phase 33 S2): uploads may now be up to MAX_UPLOAD_BYTES (50MB) but the instant
 * estimate only parses files up to MAX_ATTACHMENT_PARSE_BYTES (20MB) — staff quote the rest. */
export type FileEstimateStatus = 'OK' | 'NOT_SLICED' | 'UNSUPPORTED' | 'UNREADABLE' | 'NO_PRICING_CONFIG' | 'NO_MATERIAL_PRICE' | 'TOO_LARGE';
/** `SLICE_FOR_EXACT`: an unsliced .3mf priced from its geometry — slicing would give an exact price. */
export type PublicFileEstimate = { status: FileEstimateStatus; estimate: InstantEstimate | null; hint?: 'SLICE_FOR_EXACT' };

/** Materials the storefront can auto-price (FDM). RESIN and "not sure" fall back to PLA pricing only
 * when the customer didn't choose; an explicit RESIN gets no automatic price. */
const FDM_TYPES = new Set(['PLA', 'PETG', 'ABS', 'ASA', 'TPU']);

export function estimateFileBytes(ctx: PricingContext, input: { fileName: string; bytes: Uint8Array; materialType?: string | null }): PublicFileEstimate {
  const extension = input.fileName.toLowerCase().split('.').pop() ?? '';
  const requested = input.materialType?.trim().toUpperCase() || null;
  if (requested && !FDM_TYPES.has(requested)) return { status: 'UNSUPPORTED', estimate: null };
  try {
    let estimate: InstantEstimate | null = null;
    if (extension === '3mf') {
      try {
        estimate = estimateFromSliceInfo(ctx, parseThreeMfSliceInfo(input.bytes), requested);
      } catch (error) {
        if (!(error instanceof DomainError && error.code === '3MF_MISSING_SLICE_INFO')) throw error;
        // Unsliced project (typical MakerWorld download): price the geometry as a range instead of
        // giving up; fall back to NOT_SLICED only if the geometry can't be read either.
        try {
          estimate = estimateFromMesh(ctx, parseThreeMfMeshVolume(input.bytes), requested);
        } catch (meshError) {
          if (meshError instanceof DomainError) return { status: 'NOT_SLICED', estimate: null };
          throw meshError;
        }
        if (!estimate) return { status: 'NOT_SLICED', estimate: null };
        const ranged = estimate.options.some((o) => o.minVnd !== undefined);
        return ranged ? { status: 'OK', estimate, hint: 'SLICE_FOR_EXACT' } : { status: 'NO_MATERIAL_PRICE', estimate: null };
      }
    } else if (extension === 'stl') {
      estimate = estimateFromMesh(ctx, parseStlVolume(input.bytes), requested);
    } else if (extension === 'obj') {
      estimate = estimateFromMesh(ctx, parseObjVolume(input.bytes), requested);
    } else {
      return { status: 'UNSUPPORTED', estimate: null };
    }
    if (!estimate) return { status: 'UNREADABLE', estimate: null };
    const priced = estimate.options.some((o) => o.priceVnd !== null || o.minVnd !== undefined);
    return priced ? { status: 'OK', estimate } : { status: 'NO_MATERIAL_PRICE', estimate: null };
  } catch (error) {
    if (error instanceof DomainError) return { status: 'UNREADABLE', estimate: null };
    throw error;
  }
}

export async function estimateAttachment(
  attachmentPath: string,
  materialType: string | null | undefined,
  options: { download?: (path: string) => Promise<Uint8Array>; size?: (path: string) => Promise<number | null> } = {},
): Promise<PublicFileEstimate> {
  if (!ATTACHMENT_PATH_RE.test(attachmentPath)) throw new DomainError('INVALID_ATTACHMENT_PATH', 'Đường dẫn file không hợp lệ.', 400);
  const extension = attachmentPath.split('.').pop() ?? '';
  if (!['3mf', 'stl', 'obj'].includes(extension)) return { status: 'UNSUPPORTED', estimate: null };
  // Check the stored size BEFORE downloading so a 50MB upload is never pulled into the function just
  // to be rejected. (A test that injects only `download` skips this pre-check.)
  const sizeOf = options.size ?? (options.download ? null : getCustomRequestAttachmentSize);
  if (sizeOf) {
    const size = await sizeOf(attachmentPath);
    if (size === null) throw new DomainError('ATTACHMENT_NOT_FOUND', 'Không tìm thấy file đã tải lên — vui lòng tải lại.', 404);
    if (size > MAX_ATTACHMENT_PARSE_BYTES) return { status: 'TOO_LARGE', estimate: null };
  }
  const ctx = await loadPricingContext();
  if (!ctx) return { status: 'NO_PRICING_CONFIG', estimate: null };
  let bytes: Uint8Array;
  try {
    bytes = await (options.download ?? downloadCustomRequestAttachment)(attachmentPath);
  } catch (error) {
    if (error instanceof DomainError && error.code === 'FILE_TOO_LARGE') return { status: 'TOO_LARGE', estimate: null };
    throw error;
  }
  if (bytes.byteLength > MAX_ATTACHMENT_PARSE_BYTES) return { status: 'TOO_LARGE', estimate: null };
  return estimateFileBytes(ctx, { fileName: attachmentPath, bytes, materialType });
}
