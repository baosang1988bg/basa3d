import { z } from 'zod';

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
}).strict();

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
  honeypot: z.string().trim().max(200).optional().default(''),
}).strict();

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
}).strict().superRefine((quote, context) => {
  validatePricingSnapshotPair(quote, context);
  if (quote.total !== quote.subtotal + quote.shippingFee - quote.discount) {
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
export const publicCheckoutOrderInputSchema = z.object({
  customerName: nonEmptyText.max(200),
  customerPhone: nonEmptyText.max(30),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  shippingAddress: z.record(z.string(), z.unknown()).default({}),
  paymentMethod: paymentMethodSchema.default('COD'),
  customerNote: z.string().trim().max(2_000).nullable().optional(),
  items: z.array(z.object({ variantId: uuidSchema, quantity: positiveQuantitySchema.max(10_000) }).strict()).min(1),
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
}).strict();

export const printJobActualsInputSchema = z.object({
  actualWeightGrams: safeInteger.nonnegative().nullable().optional(),
  actualPrintTimeMinutes: safeInteger.nonnegative().nullable().optional(),
}).strict();
