'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { DomainError } from '@/lib/domain-error';
import { productImagePublicUrl } from '@/lib/storage/product-image-url';
import { vndSchema, uuidSchema, pricingBreakdownSchema, quickRestockBatchInputSchema, quickRestockInputSchema } from '@/domain/schemas';
import { updateProduct, updateVariant } from '@/services/product.service';
import {
  getQuickRestockContext,
  recordStockEvent,
  recordStockEventBatch,
  type QuickRestockBatchResult,
  type QuickRestockContext,
  type QuickRestockResult,
} from '@/services/quick-restock.service';

// ---------------------------------------------------------------------------------------------
// Phase 52 — Nhập kho nhanh (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md, P1).
// Both actions return a result object instead of throwing so the dialog can show the Vietnamese
// message (a thrown error reaches the client as a generic message in production builds).
// ---------------------------------------------------------------------------------------------

export type QuickRestockDialogContext = QuickRestockContext & { coverUrl: string | null };
export type QuickRestockActionResult =
  | { ok: true; result: QuickRestockResult }
  | { ok: false; code: string; message: string };

export async function getQuickRestockContextAction(variantId: string): Promise<QuickRestockDialogContext | null> {
  await requireAdmin();
  const context = await getQuickRestockContext(uuidSchema.parse(variantId));
  return context ? { ...context, coverUrl: productImagePublicUrl(context.coverStoragePath) } : null;
}

// Phase 52 P4: batch ("in xong cả mẻ") — all lines in one transaction.
export async function quickRestockBatchAction(payload: unknown): Promise<{ ok: true; result: QuickRestockBatchResult } | { ok: false; code: string; message: string }> {
  const { actorId } = await requireAdmin();
  try {
    const result = await recordStockEventBatch(quickRestockBatchInputSchema.parse(payload), actorId);
    revalidatePath('/admin/product-inventory');
    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');
    return { ok: true, result };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' };
    throw error;
  }
}

export async function quickRestockAction(payload: unknown): Promise<QuickRestockActionResult> {
  const { actorId } = await requireAdmin();
  try {
    const input = quickRestockInputSchema.parse(payload);
    const result = await recordStockEvent(input, actorId);
    revalidatePath('/admin/product-inventory');
    revalidatePath('/admin/products');
    revalidatePath('/admin/inventory');
    return { ok: true, result };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' };
    throw error;
  }
}

export async function updateVariantPriceAction(variantId: string, price: number) {
  const { actorId } = await requireAdmin();
  const validVariantId = uuidSchema.parse(variantId);
  const validPrice = vndSchema.parse(price);

  await updateVariant(validVariantId, { price: validPrice }, actorId);

  revalidatePath('/admin/product-inventory');
  revalidatePath('/admin/products');
  return { success: true };
}

export async function updateProductBasePriceAction(productId: string, basePrice: number) {
  const { actorId } = await requireAdmin();
  const validProductId = uuidSchema.parse(productId);
  const validBasePrice = vndSchema.parse(basePrice);

  await updateProduct(validProductId, { basePrice: validBasePrice }, actorId);

  revalidatePath('/admin/product-inventory');
  revalidatePath('/admin/products');
  return { success: true };
}

export async function applyPricingCalculationAction(payload: {
  productId: string;
  variantId?: string;
  price: number;
  breakdown?: unknown;
  pricingConfigId?: string;
}) {
  const { actorId } = await requireAdmin();
  const validProductId = uuidSchema.parse(payload.productId);
  const validPrice = vndSchema.parse(payload.price);
  const validVariantId = payload.variantId ? uuidSchema.parse(payload.variantId) : undefined;
  const validConfigId = payload.pricingConfigId ? uuidSchema.parse(payload.pricingConfigId) : undefined;
  const validBreakdown = payload.breakdown ? pricingBreakdownSchema.parse(payload.breakdown) : undefined;

  if (validVariantId) {
    await updateVariant(validVariantId, { price: validPrice }, actorId);
  } else {
    await updateProduct(
      validProductId,
      {
        basePrice: validPrice,
        ...(validBreakdown && validConfigId
          ? { pricingBreakdown: validBreakdown, pricingConfigId: validConfigId }
          : {}),
      },
      actorId,
    );
  }

  revalidatePath('/admin/product-inventory');
  revalidatePath('/admin/products');
  return { success: true };
}
