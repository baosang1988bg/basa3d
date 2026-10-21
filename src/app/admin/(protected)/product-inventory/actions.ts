'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { vndSchema, uuidSchema, pricingBreakdownSchema } from '@/domain/schemas';
import { updateProduct, updateVariant } from '@/services/product.service';

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
