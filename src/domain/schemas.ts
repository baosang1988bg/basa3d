import { z } from 'zod';
import { isSafeMakerWorldImageUrl } from '../lib/parsers/makerworld-image';
import { classifyMakerWorldLicense, isMakerWorldModelUrl } from '../lib/parsers/makerworld-resolver';
import { PRINT_SERVICE_LICENSE_BASES } from '../lib/copyright/print-service-policy';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES_PER_REQUEST, UPLOAD_EXTENSIONS } from '../config/uploads';
import { BAO_GIA_MAX_EXTENT_MM, BAO_GIA_MAX_ITEMS } from '../config/bao-gia';
import { FDM_MATERIALS, INFILL_OPTIONS, SCALE_PERMILLE_RANGE } from '../lib/pricing/fdm-estimate-model';
import { MESH_MAX_TRIANGLES, checkMeshConsistency } from '../lib/pricing/mesh-metrics';
import { PRINTER_PROFILE_IDS } from '../lib/pricing/printer-profiles';

export const uuidSchema = z.string().uuid();
const nonEmptyText = z.string().trim().min(1);
const safeInteger = z.number().int().safe();

/** VND has no fractional minor unit; all monetary values are integer VND. */
export const vndSchema = safeInteger.nonnegative();
export const positiveQuantitySchema = safeInteger.positive();
export const movementQuantitySchema = safeInteger.refine((value) => value !== 0, {
  message: 'Movement quantity must not be zero.',
});

export const productTypeSchema = z.enum(['READY_STOCK', 'MADE_TO_ORDER']);
export const productStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export const orderStatusSchema = z.enum([
  'NEW', 'CONFIRMED', 'PRODUCING', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED',
]);
export const paymentStatusSchema = z.enum(['UNPAID', 'DEPOSIT_PAID', 'PAID', 'REFUNDED']);
export const shippingStatusSchema = z.enum(['PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED']);
export const inventoryMovementTypeSchema = z.enum([
  'PURCHASE', 'PRODUCTION_IN', 'SALE_OUT', 'RETURN_IN', 'DAMAGE_OUT',
  'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT',
]);
export const materialMovementTypeSchema = z.enum([
  'PURCHASE', 'PRODUCTION_OUT', 'RETURN_IN', 'DAMAGE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
]);
export const customRequestSourceChannelSchema = z.enum([
  'ZALO', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'OTHER',
]);
export const customRequestStatusSchema = z.enum([
  'NEW', 'REVIEWING', 'NEED_INFO', 'QUOTED', 'APPROVED', 'REJECTED', 'CONVERTED',
]);
export const quoteStatusSchema = z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']);
export const printJobStatusSchema = z.enum([
  'QUEUED', 'PRINTING', 'FAILED', 'REPRINT', 'QC', 'COMPLETED', 'CANCELLED',
]);
export const staffRoleSchema = z.enum(['OWNER', 'STAFF']);

export const categoryInputSchema = z.object({
  parentId: uuidSchema.nullable().optional(),
  name: nonEmptyText.max(160),
  slug: z.string().trim().max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2_000).nullable().optional(),
  sortOrder: safeInteger.nonnegative().default(0),
}).strict();

export const materialInputSchema = z.object({
  name: nonEmptyText.max(200),
  materialType: nonEmptyText.max(80),
  brand: z.string().trim().max(100).nullable().optional(),
  color: z.string().trim().max(100).nullable().optional(),
  unit: z.enum(['GRAM', 'SPOOL']).default('GRAM'),
  costPerSpool: vndSchema.nullable().optional(),
  spoolWeightGrams: positiveQuantitySchema.nullable().optional(),
  currentUnitCost: vndSchema.nullable().optional(),
}).strict();

// Phase 9: system-wide cost-plus pricing parameters (docs/product/catalog-spec.md §4).
// Percentages are stored as 0-100 numbers (e.g. 40 means 40%), matching pricing_configs' numeric(5,2)
// columns — never a 0-1 fraction, to avoid a silent unit mismatch between DB/service/UI.
export const pricingConfigInputSchema = z.object({
  electricityVndPerKwh: vndSchema,
  machinePriceVnd: vndSchema,
  machineLifetimeHours: positiveQuantitySchema,
  printerPowerKw: z.number().positive().max(10),
  laborVndPerHour: vndSchema,
  failureBufferPct: z.number().min(0).max(99.99),
  marginPct: z.number().min(0).max(99.99),
  packagingFeeVnd: vndSchema.default(0),
  // Phase 33 S1: VAT rate in integer basis points (800 = 8%), never a float percentage.
  vatEnabled: z.boolean().default(false),
  vatRateBps: safeInteger.min(0).max(10_000).default(0),
}).strict().refine((config) => !config.vatEnabled || config.vatRateBps > 0, {
  message: 'VAT rate must be greater than 0 when VAT is enabled.',
  path: ['vatRateBps'],
});

// Phase 9: shape of pricing.service's computed breakdown, re-validated here because it round-trips
// through the browser (preview → staff review/edit → submit) before landing on a Quote/Product —
// AGENTS.md rule #6, never trust a client-submitted payload even if this session's own server
// action produced it a moment earlier.
export const pricingBreakdownSchema = z.object({
  materialCostVnd: vndSchema,
  materialLines: z.array(z.object({
    label: z.string().trim().max(200).nullable().optional(),
    gram: z.number().nonnegative(),
    costVnd: vndSchema,
  })),
  electricityCostVnd: vndSchema,
  machineDepreciationVnd: vndSchema,
  failureBufferVnd: vndSchema,
  laborCostVnd: vndSchema,
  packagingFeeVnd: vndSchema,
  totalCostVnd: vndSchema,
  priceBeforeRoundingVnd: vndSchema,
  finalPriceVnd: vndSchema,
  /** Target printer picked in the calculator. Snapmaker U1 prices with its own machine power/price/
   * lifetime instead of the pricingConfigId row — recorded so the snapshot stays explainable. */
  printerProfileId: z.enum(PRINTER_PROFILE_IDS).optional(),
}).strict();

function validatePricingSnapshotPair(
  value: { pricingBreakdown?: unknown | null; pricingConfigId?: string | null },
  context: z.RefinementCtx,
) {
  if (Boolean(value.pricingBreakdown) !== Boolean(value.pricingConfigId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'pricingBreakdown and pricingConfigId must be provided together.',
      path: ['pricingBreakdown'],
    });
  }
}

export const warehouseInputSchema = z.object({
  name: nonEmptyText.max(160),
  code: z.string().trim().max(40).regex(/^[A-Z0-9_]+$/),
  address: z.string().trim().max(2_000).nullable().optional(),
}).strict();

// Phase 29: which license the model behind this product was made under, and where to find proof
// of it — advisory metadata for copyright/IP compliance (docs/exec-plans/active/
// phase-29-copyright-compliance.md), not enforced by any DB constraint (varchar(50) on the
// products table, not a Postgres enum, so new license types don't require a migration).
// Feature 003: UNKNOWN marks models imported from the STL library until an admin reviews them.
export const productLicenseTypeSchema = z.enum(['OWN_DESIGN', 'CC_BY', 'CC0', 'COMMERCIAL_LICENSE', 'OTHER', 'UNKNOWN']);

export const productInputSchema = z.object({
  categoryId: uuidSchema.nullable(),
  name: nonEmptyText.max(200),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  productType: productTypeSchema,
  status: productStatusSchema.default('DRAFT'),
  basePrice: vndSchema.nullable().optional(),
  costPrice: vndSchema.nullable().optional(),
  isFeatured: z.boolean().default(false),
  isCustomizable: z.boolean().default(false),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  pricingBreakdown: pricingBreakdownSchema.nullable().optional(),
  pricingConfigId: uuidSchema.nullable().optional(),
  licenseType: productLicenseTypeSchema.default('OWN_DESIGN'),
  licenseSourceUrl: z.string().trim().url().max(2_000).nullable().optional(),
  licenseProofUrl: z.string().trim().url().max(2_000).nullable().optional(),
}).strict().superRefine(validatePricingSnapshotPair);

export const productVariantInputSchema = z.object({
  productId: uuidSchema,
  sku: z.string().trim().min(1).max(40).regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
  name: nonEmptyText.max(200),
  attributes: z.record(z.string(), z.string()).default({}),
  price: vndSchema,
  costPrice: vndSchema.nullable().optional(),
  weightGrams: safeInteger.nonnegative().nullable().optional(),
  isActive: z.boolean().default(true),
}).strict();

export const cartItemInputSchema = z.object({
  variantId: uuidSchema,
  quantity: positiveQuantitySchema.max(10_000),
  selectedOptions: z.record(z.string(), z.string()).default({}),
}).strict();

export const orderItemInputSchema = z.object({
  variantId: uuidSchema,
  quantity: positiveQuantitySchema.max(10_000),
  productNameSnapshot: nonEmptyText.max(200),
  variantNameSnapshot: nonEmptyText.max(200),
  skuSnapshot: nonEmptyText.max(40),
  unitPrice: vndSchema,
}).strict();

export const orderInputSchema = z.object({
  customerName: nonEmptyText.max(200),
  customerPhone: nonEmptyText.max(30),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  shippingAddress: z.record(z.string(), z.unknown()).default({}),
  subtotal: vndSchema,
  shippingFee: vndSchema.default(0),
  discount: vndSchema.default(0),
  codFee: vndSchema.default(0),
  total: vndSchema,
  customerNote: z.string().trim().max(2_000).nullable().optional(),
}).strict().superRefine((order, context) => {
  if (order.total !== order.subtotal + order.shippingFee + order.codFee - order.discount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Total must equal subtotal + shipping fee + COD fee - discount.', path: ['total'] });
  }
});

export const inventoryMovementInputSchema = z.object({
  warehouseId: uuidSchema,
  productVariantId: uuidSchema,
  movementType: inventoryMovementTypeSchema,
  quantity: movementQuantitySchema,
  unitCost: vndSchema.nullable().optional(),
  referenceType: z.string().trim().min(1).max(50).nullable().optional(),
  referenceId: uuidSchema.nullable().optional(),
  note: z.string().trim().max(2_000).nullable().optional(),
}).strict().superRefine((movement, context) => {
  const incoming = ['PURCHASE', 'PRODUCTION_IN', 'RETURN_IN', 'ADJUSTMENT_IN', 'TRANSFER_IN'];
  if ((incoming.includes(movement.movementType) && movement.quantity < 0) ||
      (!incoming.includes(movement.movementType) && movement.quantity > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Quantity sign must match movement type.', path: ['quantity'] });
  }
});

export const materialMovementInputSchema = z.object({
  warehouseId: uuidSchema,
  materialId: uuidSchema,
  movementType: materialMovementTypeSchema,
  quantity: movementQuantitySchema,
  unitCost: vndSchema.nullable().optional(),
  referenceType: z.string().trim().min(1).max(50).nullable().optional(),
  referenceId: uuidSchema.nullable().optional(),
  note: z.string().trim().max(2_000).nullable().optional(),
}).strict().superRefine((movement, context) => {
  const incoming = ['PURCHASE', 'RETURN_IN', 'ADJUSTMENT_IN'];
  if ((incoming.includes(movement.movementType) && movement.quantity < 0) ||
      (!incoming.includes(movement.movementType) && movement.quantity > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Quantity sign must match movement type.', path: ['quantity'] });
  }
});

export const customRequestInputSchema = z.object({
  sourceChannel: customRequestSourceChannelSchema,
  customerName: nonEmptyText.max(200),
  customerPhone: nonEmptyText.max(30),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  description: nonEmptyText.max(20_000),
  quantity: positiveQuantitySchema.max(10_000),
  requestedMaterial: z.string().trim().max(100).nullable().optional(),
  requestedColor: z.string().trim().max(100).nullable().optional(),
  requestedSize: z.string().trim().max(100).nullable().optional(),
}).strict();

export const customRequestAdminUpdateSchema = z.object({
  sourceChannel: customRequestSourceChannelSchema.optional(),
  customerName: nonEmptyText.max(200).optional(),
  customerPhone: nonEmptyText.max(30).optional(),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  description: nonEmptyText.max(20_000).optional(),
  quantity: positiveQuantitySchema.max(10_000).optional(),
  requestedMaterial: z.string().trim().max(100).nullable().optional(),
  requestedColor: z.string().trim().max(100).nullable().optional(),
  requestedSize: z.string().trim().max(100).nullable().optional(),
  status: customRequestStatusSchema.optional(),
  internalNote: z.string().trim().max(2_000).nullable().optional(),
}).strict();
export type CustomRequestAdminUpdate = z.infer<typeof customRequestAdminUpdateSchema>;

// Public-facing variant of customRequestInputSchema (POST /api/public/custom-requests):
// - no sourceChannel field — the server always hardcodes 'WEBSITE', never trusts the client here.
// - adds attachmentUrl (link-only file intake per phase-4.md Non-goals — no binary upload in Phase 4).
// - adds honeypot: a hidden field real users never fill; any value on it means the submission is
//   spam (see route.ts for the fake-201 handling).
export const publicCustomRequestInputSchema = z.object({
  customerName: nonEmptyText.max(200),
  customerPhone: nonEmptyText.max(30),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  description: nonEmptyText.max(20_000),
  quantity: positiveQuantitySchema.max(10_000),
  requestedMaterial: z.string().trim().max(100).nullable().optional(),
  requestedColor: z.string().trim().max(100).nullable().optional(),
  requestedSize: z.string().trim().max(100).nullable().optional(),
  attachmentPath: z.string().trim().min(1).max(500).regex(/^requests\/[0-9a-f-]+\.(?:jpg|jpeg|png|webp|stl|step|stp|obj|3mf)$/).nullable().optional(),
  uploadClaim: z.string().trim().min(1).max(1_000).nullable().optional(),
  honeypot: z.string().trim().max(200).optional().default(''),
  // Phase 29: the customer must actively confirm they own the rights to the file/description they
  // are submitting — z.literal(true) rejects both a missing field and an unchecked (false) box.
  // tosVersion is sent by the client from a shared constant (src/lib/copyright/tos-version.ts), not
  // typed by the customer, so it records which wording of the ToS they agreed to.
  copyrightConfirmed: z.literal(true),
  tosVersion: z.string().trim().min(1).max(50),
  // Phase B (makerworld-phase-b-storefront-estimate.md §4): what the customer picked on the MakerWorld
  // intake card. Lazy because the schema is declared further down (it reuses the MakerWorld URL refine).
  makerworld: z.lazy(() => publicMakerWorldIntakeSchema).optional(),
  // ADR-0034: which option of the file estimate the customer picked. The price itself is recomputed
  // server-side from attachmentPath + requestedMaterial — never accepted from the browser.
  fileEstimateOption: z.enum(['ASSEMBLED', 'KIT', 'STANDARD']).optional(),
  // Target printer the customer priced the file for (Snapmaker U1 tool changer vs Bambu AMS). Only
  // feeds the server-side re-estimate, so the stored estimate matches what the customer saw.
  printerTarget: z.enum(PRINTER_PROFILE_IDS).optional(),
}).strict().superRefine((request, context) => {
  if (Boolean(request.attachmentPath) !== Boolean(request.uploadClaim)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'attachmentPath and uploadClaim must be provided together.', path: ['uploadClaim'] });
  }
});

// Phase 13: immutable model metadata snapshot captured from the MakerWorld resolver at "Tạo báo
// giá" time — see quote.service.ts's QuoteModelSnapshot. Re-validated here because it round-trips
// through the browser (staff review/edit) before being submitted, same rationale as
// pricingBreakdownSchema above (AGENTS.md rule #6).
//
// makerworld-profile-verification Phase A: versioned v1 | v2 (B9).
// - v1 = the Phase 13 shape. Legacy rows have NO `schemaVersion` key; the preprocess step below tags
//   them `schemaVersion: 1` so `z.discriminatedUnion` reports errors against the right branch
//   (a plain `z.union([v2, v1])` would hide the real v2 error behind a v1 "unrecognized keys" error).
// - v2 adds the verified print-profile metadata and the hard gate `profileVerified: z.literal(true)`.
// - Both versions refine `sourceUrl` to an https MakerWorld model URL and image URLs to the
//   MakerWorld/Bambu Lab allowlist (B2) — these values round-trip through the browser and are
//   rendered on the public quote page.
const makerWorldSourceUrlSchema = z.string().trim().url().max(2_000)
  .refine(isMakerWorldModelUrl, { message: 'sourceUrl must be an https makerworld.com model URL.' });
const makerWorldImageUrlSchema = z.string().trim().max(2_000)
  .refine(isSafeMakerWorldImageUrl, { message: 'Image URL must be an https MakerWorld/Bambu Lab image URL.' });

const quoteModelSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  sourceUrl: makerWorldSourceUrlSchema,
  title: nonEmptyText.max(300),
  coverImageUrl: makerWorldImageUrlSchema.nullable().optional(),
  platesCount: safeInteger.nonnegative(),
  totalPrintMinutes: safeInteger.nonnegative(),
  colorsCount: safeInteger.nonnegative(),
}).strict();

const quoteModelSnapshotV2Schema = quoteModelSnapshotV1Schema.extend({
  schemaVersion: z.literal(2),
  dataSource: z.enum(['RESOLVER', 'MANUAL']),
  profileId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  profileTitle: nonEmptyText.max(300),
  profileCoverImageUrl: makerWorldImageUrlSchema.nullable().optional(),
  printerTarget: z.string().trim().max(100).nullable().optional(),
  netWeightGrams: z.number().finite().nonnegative().max(20_000),
  amsRequired: z.boolean().nullable().optional(),
  tier: z.enum(['ASSEMBLED', 'KIT']).nullable().optional(),
  /** License name from the design page, kept for the audit trail (B6). */
  license: z.string().trim().max(200).nullable().optional(),
  /** Required true (with a `licenseBasis`) when `license` is known to forbid commercial use —
   * see superRefine below and src/lib/copyright/print-service-policy.ts. */
  licenseAcknowledged: z.boolean().optional(),
  licenseBasis: z.enum(PRINT_SERVICE_LICENSE_BASES).optional(),
  profileVerified: z.literal(true, {
    errorMap: () => ({ message: 'Cần xác nhận đúng profile khách yêu cầu trước khi tạo báo giá.' }),
  }),
}).strict();

export const quoteModelSnapshotSchema = z.preprocess(
  (raw) => (raw && typeof raw === 'object' && !Array.isArray(raw) && !('schemaVersion' in raw)
    ? { ...(raw as Record<string, unknown>), schemaVersion: 1 }
    : raw),
  z.discriminatedUnion('schemaVersion', [quoteModelSnapshotV1Schema, quoteModelSnapshotV2Schema])
    .superRefine((snapshot, context) => {
      // B6 (Phase A part): a quote for a design whose license forbids commercial use (MakerWorld's
      // default "Standard Digital File License") must record WHY the shop may still quote it.
      // Owner decision 2026-10-12: the shop-wide basis is "personal, non-commercial print-on-request"
      // (PRINT_SERVICE_POLICY) — the admin panel fills it automatically, so quoting is not blocked,
      // but a snapshot without a basis is still rejected so the audit trail can't silently go missing.
      if (snapshot.schemaVersion === 2
          && classifyMakerWorldLicense(snapshot.license ?? null) === 'NOT_ALLOWED'
          && (snapshot.licenseAcknowledged !== true || !snapshot.licenseBasis)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['licenseBasis'],
          message: 'License mẫu không cho phép thương mại — báo giá phải ghi rõ căn cứ (chính sách in giúp cá nhân, phi thương mại).',
        });
      }
    }),
);

export type QuoteModelSnapshotV1 = z.infer<typeof quoteModelSnapshotV1Schema>;
export type QuoteModelSnapshotV2 = z.infer<typeof quoteModelSnapshotV2Schema>;
export type QuoteModelSnapshotData = QuoteModelSnapshotV1 | QuoteModelSnapshotV2;

// Phase B (makerworld-phase-b-storefront-estimate.md §5, ADR-0033): a staff-approved "verified price"
// for one MakerWorld profile + tier. Only pricing INPUTS are accepted — the price itself is always
// recomputed server-side from pricing_configs + material costs, never taken from the browser.
export const makerWorldProfileSnapshotSchema = z.object({
  modelTitle: nonEmptyText.max(300),
  profileTitle: nonEmptyText.max(300),
  profileCoverImageUrl: makerWorldImageUrlSchema.nullable(),
  printerTarget: z.string().trim().max(100).nullable(),
  platesCount: safeInteger.nonnegative().max(200),
  printMinutes: safeInteger.positive().max(20_000),
  netWeightGrams: z.number().finite().positive().max(20_000),
  amsRequired: z.boolean().nullable(),
  colorsCount: safeInteger.positive().max(16),
  license: z.string().trim().max(200).nullable(),
  dataSource: z.enum(['RESOLVER', 'MANUAL']),
}).strict();

export const makerWorldPricePresetInputSchema = z.object({
  sourceUrl: makerWorldSourceUrlSchema,
  profileId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  tier: z.enum(['ASSEMBLED', 'KIT']),
  profileSnapshot: makerWorldProfileSnapshotSchema,
  materialLines: z.array(z.object({
    label: nonEmptyText.max(300),
    materialId: uuidSchema,
    materialType: nonEmptyText.max(40),
    gram: z.number().finite().positive().max(20_000),
  }).strict()).min(1).max(20),
  printMinutes: safeInteger.positive().max(20_000),
  laborMinutes: safeInteger.nonnegative().max(2_000),
  pricingConfigId: uuidSchema,
}).strict().superRefine((preset, context) => {
  if (preset.printMinutes !== preset.profileSnapshot.printMinutes) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['printMinutes'], message: 'printMinutes must match the profile snapshot.' });
  }
});
export type MakerWorldPricePresetInput = z.infer<typeof makerWorldPricePresetInputSchema>;

// What a storefront customer picked (§4). No price fields: the reference price shown is recomputed
// and stored server-side at submission time.
export const publicMakerWorldIntakeSchema = z.object({
  sourceUrl: makerWorldSourceUrlSchema,
  profileId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).nullable(),
  tier: z.enum(['ASSEMBLED', 'KIT']),
  profileConfirmed: z.literal(true),
  /** ADR-0034: spec line the customer pasted when MakerWorld couldn't be read automatically. */
  specText: z.string().trim().min(3).max(2_000).optional(),
  /** ADR-0039: id of the server-stored screenshot estimate + the server-assigned profile key. */
  screenshotEstimateId: z.string().uuid().optional(),
  profileKey: z.string().regex(/^p\d{1,2}$/).optional(),
}).strict().superRefine((intake, context) => {
  if (Boolean(intake.screenshotEstimateId) !== Boolean(intake.profileKey)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'screenshotEstimateId and profileKey must be provided together.', path: ['profileKey'] });
  }
  if (intake.screenshotEstimateId && intake.specText) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'specText and screenshotEstimateId are mutually exclusive.', path: ['specText'] });
  }
});

export const quoteInputSchema = z.object({
  customRequestId: uuidSchema,
  subtotal: vndSchema,
  shippingFee: vndSchema.default(0),
  discount: vndSchema.default(0),
  total: vndSchema,
  validUntil: z.coerce.date(),
  note: z.string().trim().max(2_000).nullable().optional(),
  pricingBreakdown: pricingBreakdownSchema.nullable().optional(),
  pricingConfigId: uuidSchema.nullable().optional(),
  modelSnapshot: quoteModelSnapshotSchema.nullable().optional(),
  // Phase 33 S7 (D2): the /bao-gia item this quote prices (1 item = 1 Quote). The DB composite FK
  // quotes_item_same_request guarantees it belongs to customRequestId.
  customRequestItemId: uuidSchema.nullable().optional(),
  // Phase 29: soft gate, not schema-level enforced — createQuote (quote.service.ts) rejects this
  // when the custom request's ip_risk_flag is true and this stays false. A normal (non-flagged)
  // request never has to send it, so the field simply defaults to false here.
  ipRiskAcknowledged: z.boolean().default(false),
}).strict().superRefine((quote, context) => {
  validatePricingSnapshotPair(quote, context);
  // Phase 33 S1: total = subtotal + shippingFee − discount + VAT, and VAT depends on the CURRENT
  // pricing config, which only the server knows — createQuote is the authority
  // (QUOTE_TOTAL_MISMATCH). Here we can only reject a total below the pre-VAT amount.
  if (quote.total < quote.subtotal + quote.shippingFee - quote.discount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Quote total must reconcile to its components.', path: ['total'] });
  }
});

export const printJobInputSchema = z.object({
  orderId: uuidSchema.nullable().optional(),
  customRequestId: uuidSchema.nullable().optional(),
  quoteId: uuidSchema.nullable().optional(),
  materialId: uuidSchema.nullable().optional(),
  printerName: z.string().trim().max(160).nullable().optional(),
  estimatedWeightGrams: safeInteger.nonnegative().nullable().optional(),
  estimatedPrintTimeMinutes: safeInteger.nonnegative().nullable().optional(),
}).strict().refine((job) => Boolean(job.orderId || job.customRequestId), {
  message: 'A print job must be linked to an order or custom request.',
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
}).strict();

export const checkoutOrderInputSchema = z.object({
  customerName: nonEmptyText.max(200),
  customerPhone: nonEmptyText.max(30),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  shippingAddress: z.record(z.string(), z.unknown()).default({}),
  shippingFee: vndSchema.default(0),
  discount: vndSchema.default(0),
  codFee: vndSchema.default(0),
  customerNote: z.string().trim().max(2_000).nullable().optional(),
  items: z.array(z.object({ variantId: uuidSchema, quantity: positiveQuantitySchema.max(10_000) }).strict()).min(1),
}).strict();

// Public-facing variant of checkoutOrderInputSchema (POST /api/public/orders), phase-5.md decision
// #2: deliberately NOT `checkoutOrderInputSchema` + honeypot — that schema lets the caller set
// `shippingFee`/`discount`/`codFee`, which a trusted STAFF actor may legitimately need but an
// anonymous public caller must never control (a large `discount` would zero out `total` while
// stock is still deducted for real). This is a field-by-field allowlist instead: no monetary
// override fields at all, `createOrder` always sees them as 0 for this path (see route.ts).
export const paymentMethodSchema = z.enum(['COD', 'BANK_TRANSFER']);
export const PUBLIC_CHECKOUT_MAX_ITEMS = 50;
export const publicCheckoutOrderInputSchema = z.object({
  checkoutRequestId: uuidSchema,
  customerName: nonEmptyText.max(200),
  customerPhone: nonEmptyText.max(30),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  shippingAddress: z.record(z.string(), z.unknown()).default({}),
  paymentMethod: paymentMethodSchema.default('COD'),
  customerNote: z.string().trim().max(2_000).nullable().optional(),
  // Phase 35 D5: bound the cart size for anonymous callers (staff schema above stays unbounded).
  items: z.array(z.object({ variantId: uuidSchema, quantity: positiveQuantitySchema.max(10_000) }).strict()).min(1).max(PUBLIC_CHECKOUT_MAX_ITEMS),
  honeypot: z.string().trim().max(200).optional().default(''),
}).strict();

export const orderStatusUpdateSchema = z.object({ status: orderStatusSchema }).strict();
export const orderAdminUpdateSchema = z.object({
  paymentStatus: paymentStatusSchema.optional(),
  shippingStatus: shippingStatusSchema.optional(),
  adminNote: z.string().trim().max(2_000).nullable().optional(),
  overrideReason: z.string().trim().min(1).max(500).optional(),
}).strict();
export const staffCreateInputSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
  fullName: nonEmptyText.max(200),
  role: staffRoleSchema,
}).strict();
export const staffUpdateInputSchema = z.object({ isActive: z.boolean() }).strict();
export const productUpdateInputSchema = z.object({
  categoryId: uuidSchema.nullable().optional(),
  name: nonEmptyText.max(200).optional(),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  status: productStatusSchema.optional(),
  basePrice: vndSchema.nullable().optional(),
  costPrice: vndSchema.nullable().optional(),
  isFeatured: z.boolean().optional(),
  isCustomizable: z.boolean().optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  pricingBreakdown: pricingBreakdownSchema.nullable().optional(),
  pricingConfigId: uuidSchema.nullable().optional(),
  licenseType: productLicenseTypeSchema.optional(),
  licenseSourceUrl: z.string().trim().url().max(2_000).nullable().optional(),
  licenseProofUrl: z.string().trim().url().max(2_000).nullable().optional(),
}).strict().superRefine(validatePricingSnapshotPair);
export const variantUpdateInputSchema = z.object({
  name: nonEmptyText.max(200).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  price: vndSchema.optional(),
  costPrice: vndSchema.nullable().optional(),
  weightGrams: safeInteger.nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();
export const customRequestStatusUpdateSchema = z.object({ status: customRequestStatusSchema, overrideReason: z.string().trim().min(1).max(500).optional() }).strict();
export const quoteAcceptSchema = z.object({ status: z.literal('ACCEPTED') }).strict();
export const printJobStatusUpdateSchema = z.object({ status: printJobStatusSchema, overrideReason: z.string().trim().min(1).max(500).optional() }).strict();

export const blogPostStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);

export const blogCategoryInputSchema = z.object({
  name: nonEmptyText.max(160),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();

export const blogPostInputSchema = z.object({
  categoryId: uuidSchema.nullable().optional(),
  title: nonEmptyText.max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().max(500).nullable().optional(),
  content: nonEmptyText.max(50_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  status: blogPostStatusSchema.default('DRAFT'),
}).strict();

export const blogPostUpdateInputSchema = z.object({
  categoryId: uuidSchema.nullable().optional(),
  title: nonEmptyText.max(200).optional(),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  excerpt: z.string().trim().max(500).nullable().optional(),
  content: nonEmptyText.max(50_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  status: blogPostStatusSchema.optional(),
}).strict();

// materialId and estimatedWeightGrams must always be assigned together (phase-6.md decision #2):
// updatePrintJobStatus checks both before allowing a PRINTING transition, so a partial assignment
// would just be rejected later with a less helpful error — required here instead of nullable.
export const assignPrintJobMaterialInputSchema = z.object({
  materialId: uuidSchema,
  estimatedWeightGrams: positiveQuantitySchema,
  spoolId: uuidSchema.nullable().optional(),
}).strict();

export const printJobActualsInputSchema = z.object({
  actualWeightGrams: safeInteger.nonnegative().nullable().optional(),
  actualPrintTimeMinutes: safeInteger.nonnegative().nullable().optional(),
}).strict();

// Phase 12: assign/change a specific spool on an already material-assigned print job.
export const assignPrintJobSpoolInputSchema = z.object({
  spoolId: uuidSchema,
}).strict();

export const filamentSpoolStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export const createFilamentSpoolInputSchema = z.object({
  spoolCode: z.string().trim().min(1).max(60),
  materialId: uuidSchema,
  warehouseId: uuidSchema,
  initialWeightGrams: positiveQuantitySchema,
  purchaseCost: vndSchema.nullable().optional(),
  hasSpool: z.boolean().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
}).strict();

export const adjustSpoolStockInputSchema = z.object({
  newRemainingGrams: safeInteger.nonnegative(),
  reason: z.string().trim().min(1).max(500),
}).strict();

export const expenseCategorySchema = z.enum(['EQUIPMENT', 'MATERIAL', 'ACCESSORIES', 'UTILITIES', 'LOGISTICS', 'MARKETING', 'OTHER']);
export const expenseStatusSchema = z.enum(['PAID', 'PENDING', 'CANCELLED']);

export const createExpenseInputSchema = z.object({
  expenseCode: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  category: expenseCategorySchema,
  amount: vndSchema,
  quantity: positiveQuantitySchema.optional(),
  status: expenseStatusSchema.optional(),
  payerName: z.string().trim().max(100).nullable().optional(),
  spentAt: z.coerce.date().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
}).strict();

export const updateExpenseInputSchema = createExpenseInputSchema.omit({ expenseCode: true }).partial();

// Spool identity/notes only. Stock corrections must use the immutable movement ledger.
export const updateFilamentSpoolInputSchema = z.object({
  spoolCode: z.string().trim().min(1).max(60),
  hasSpool: z.boolean(),
  note: z.string().trim().max(2000).nullable(),
}).strict();

// Phase 33 S2 (§6.2): request body of POST /api/public/custom-requests/upload-urls. `sizeBytes` is a
// declaration only — the real size is checked by the bucket's file_size_limit and by
// inspectUploadedObject at submit.
export const uploadUrlsRequestSchema = z.object({
  files: z.array(z.object({
    ext: z.preprocess((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value), z.enum(UPLOAD_EXTENSIONS)),
    sizeBytes: safeInteger.positive().max(MAX_UPLOAD_BYTES),
  }).strict()).min(1).max(MAX_UPLOAD_FILES_PER_REQUEST),
}).strict();

// Phase 33 S4 (§6.1, D6): POST /api/public/quote-estimate — mesh METRICS computed in the browser,
// never a price. v1 is STL/OBJ only (MESH); sliced 3MF stays on /custom-print.
const extentSchema = z.number().finite().positive().max(BAO_GIA_MAX_EXTENT_MM);
export const meshMetricsInputSchema = z.object({
  volumeMm3: z.number().finite().positive().max(BAO_GIA_MAX_EXTENT_MM ** 3),
  surfaceMm2: z.number().finite().positive().max(1e9),
  sizeMm: z.object({ x: extentSchema, y: extentSchema, z: extentSchema }).strict(),
  triangles: safeInteger.positive().max(MESH_MAX_TRIANGLES),
}).strict().superRefine((metrics, context) => {
  const check = checkMeshConsistency(metrics);
  if (!check.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: `Inconsistent mesh metrics: ${check.reason}`, path: [] });
});

export const quoteEstimateItemSchema = z.object({
  kind: z.literal('MESH'),
  metrics: meshMetricsInputSchema,
  scalePermille: safeInteger.min(SCALE_PERMILLE_RANGE.min).max(SCALE_PERMILLE_RANGE.max),
  materialType: z.enum(FDM_MATERIALS),
  infillPct: safeInteger.refine((value) => (INFILL_OPTIONS as readonly number[]).includes(value), { message: `infillPct must be one of ${INFILL_OPTIONS.join(', ')}` }),
  quantity: safeInteger.min(1).max(1000),
}).strict();

export const quoteEstimateRequestSchema = z.object({
  items: z.array(quoteEstimateItemSchema).min(1).max(BAO_GIA_MAX_ITEMS),
}).strict();

// Phase 33 S5 (§6.3, D6): multi-item request from /bao-gia. A SEPARATE strict schema (not optional
// fields on publicCustomRequestInputSchema) so the two branches are mutually exclusive by
// construction: no attachmentPath / fileEstimateOption / makerworld / quantity here, and NO price
// field anywhere — the server re-measures each stored file and prices it itself.
export const baoGiaItemInputSchema = z.object({
  attachmentPath: z.string().trim().max(500).regex(/^requests\/[0-9a-f-]+\.(?:stl|obj)$/),
  uploadClaim: z.string().trim().min(1).max(1_000),
  displayName: nonEmptyText.max(200),
  materialType: z.enum(FDM_MATERIALS),
  infillPct: safeInteger.refine((value) => (INFILL_OPTIONS as readonly number[]).includes(value), { message: `infillPct must be one of ${INFILL_OPTIONS.join(', ')}` }),
  scalePermille: safeInteger.min(SCALE_PERMILLE_RANGE.min).max(SCALE_PERMILLE_RANGE.max),
  color: z.string().trim().max(100).nullable().optional(),
  quantity: safeInteger.min(1).max(1000),
  clientMetrics: meshMetricsInputSchema,
}).strict();

export const publicBaoGiaRequestSchema = z.object({
  customerName: nonEmptyText.max(200),
  customerPhone: nonEmptyText.max(30),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  /** Optional here — the server writes "Báo giá từ /bao-gia: N file (…)" when empty. */
  description: z.string().trim().max(20_000).nullable().optional(),
  honeypot: z.string().trim().max(200).optional().default(''),
  copyrightConfirmed: z.literal(true),
  tosVersion: z.string().trim().min(1).max(50),
  items: z.array(baoGiaItemInputSchema).min(1).max(BAO_GIA_MAX_ITEMS),
}).strict().superRefine((request, context) => {
  const paths = request.items.map((item) => item.attachmentPath);
  if (new Set(paths).size !== paths.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Each file can only be used once.', path: ['items'] });
  }
});

// §4.6 — custom_request_items.estimate_snapshot (read path is tolerant; see readItemEstimateSnapshot).
const sizeSchema = z.object({ x: z.number(), y: z.number(), z: z.number() }).strict();
export const customRequestItemEstimateSchema = z.object({
  schemaVersion: z.literal(1),
  modelVersion: z.string().max(50),
  status: z.enum(['OK', 'UNPRICED', 'NO_MATERIAL_PRICE', 'NO_PRICING_CONFIG']),
  unpricedReason: z.string().max(50).nullable(),
  sizeMm: sizeSchema,
  volumeCm3: z.number().nullable(),
  surfaceCm2: z.number().nullable(),
  triangles: z.number().int().nullable(),
  grams: z.number().nullable(),
  printMinutes: z.number().int().nullable(),
  platesCount: z.number().int().nullable(),
  unitPriceVnd: vndSchema.nullable(),
  lineSubtotalVnd: vndSchema.nullable(),
  floorApplied: z.boolean(),
  vatRateBps: safeInteger.min(0).max(10_000),
  vatVnd: vndSchema,
  lineTotalVnd: vndSchema.nullable(),
  pricingConfigId: uuidSchema.nullable(),
  clientMetrics: z.object({ volumeMm3: z.number(), surfaceMm2: z.number(), sizeMm: sizeSchema, triangles: z.number().int() }).strict().optional(),
  mismatchPct: z.number().optional(),
  estimatedAt: z.string().datetime(),
}).strict();
export type CustomRequestItemEstimate = z.infer<typeof customRequestItemEstimateSchema>;

// Feature 003 — STL bulk import review page (specs/003-stl-bulk-import/contracts/admin-stl-import.md).
// updated_at travels as a microsecond UTC string: a JS Date would drop the microseconds and make
// every optimistic-lock comparison fail.
export const microsecondTimestampSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
export const stlImportStatusFilterSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ERROR']);

export const stlImportFilterSchema = z.object({
  status: stlImportStatusFilterSchema.default('PENDING'),
  categoryId: uuidSchema.optional(),
  sourceDir: z.string().max(1_000).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
}).strict();

export const stlImportQuickEditSchema = z.object({
  itemId: uuidSchema,
  productId: uuidSchema,
  expectedItemUpdatedAt: microsecondTimestampSchema,
  expectedProductUpdatedAt: microsecondTimestampSchema,
  name: nonEmptyText.max(200),
  categoryId: uuidSchema.nullable(),
  basePrice: vndSchema.nullable(),
  licenseType: productLicenseTypeSchema,
  // http(s) only: z.url() alone also accepts javascript: links.
  licenseSourceUrl: z.string().trim().url().max(2_000).regex(/^https?:\/\//i).nullable(),
  licenseReviewed: z.boolean(),
}).strict();

export const stlImportItemRefSchema = z.object({ itemId: uuidSchema, expectedItemUpdatedAt: microsecondTimestampSchema }).strict();
// A decision also pins the product version the reviewer saw: an edit on the product page meanwhile
// makes the decision STALE instead of publishing content nobody reviewed.
export const stlImportDecisionRefSchema = stlImportItemRefSchema.extend({ expectedProductUpdatedAt: microsecondTimestampSchema.nullable() }).strict();
export const stlImportBulkDecisionSchema = z.object({ items: z.array(stlImportDecisionRefSchema).min(1).max(100) }).strict();
