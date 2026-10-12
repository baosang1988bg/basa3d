// Option 2 (ADR-0034): quote-first for uploaded files. The customer uploads (existing rate-limited
// attachments route), sees a price, and only then leaves contact details.
//   .3mf (sliced in Bambu Studio / Orca) → exact time + grams → SLICED estimate
//   .stl / .obj                          → volume only      → MESH price range
//   .3mf not sliced, .step, images       → no automatic price (staff quotes)
import { DomainError } from '../lib/domain-error';
import { parseThreeMfSliceInfo } from '../lib/parsers/threemf-slice-info';
import { parseObjVolume, parseStlVolume } from '../lib/parsers/mesh-volume';
import { downloadCustomRequestAttachment, ATTACHMENT_PATH_RE } from './custom-request.service';
import {
  estimateFromMesh,
  estimateFromSliceInfo,
  loadPricingContext,
  type InstantEstimate,
  type PricingContext,
} from './instant-estimate.service';

export type FileEstimateStatus = 'OK' | 'NOT_SLICED' | 'UNSUPPORTED' | 'UNREADABLE' | 'NO_PRICING_CONFIG' | 'NO_MATERIAL_PRICE';
export type PublicFileEstimate = { status: FileEstimateStatus; estimate: InstantEstimate | null };

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
        if (error instanceof DomainError && error.code === '3MF_MISSING_SLICE_INFO') return { status: 'NOT_SLICED', estimate: null };
        throw error;
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
  options: { download?: (path: string) => Promise<Uint8Array> } = {},
): Promise<PublicFileEstimate> {
  if (!ATTACHMENT_PATH_RE.test(attachmentPath)) throw new DomainError('INVALID_ATTACHMENT_PATH', 'Đường dẫn file không hợp lệ.', 400);
  const extension = attachmentPath.split('.').pop() ?? '';
  if (!['3mf', 'stl', 'obj'].includes(extension)) return { status: 'UNSUPPORTED', estimate: null };
  const ctx = await loadPricingContext();
  if (!ctx) return { status: 'NO_PRICING_CONFIG', estimate: null };
  const bytes = await (options.download ?? downloadCustomRequestAttachment)(attachmentPath);
  return estimateFileBytes(ctx, { fileName: attachmentPath, bytes, materialType });
}
