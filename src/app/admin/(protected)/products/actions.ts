'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireOwner } from '@/lib/auth/require-admin';
import {
  categoryInputSchema,
  productInputSchema,
  productUpdateInputSchema,
  productVariantInputSchema,
  variantUpdateInputSchema,
} from '@/domain/schemas';
import {
  createCategory,
  createProduct,
  createVariant,
  deleteProduct,
  deleteProductImage,
  deleteVariant,
  updateProduct,
  updateVariant,
  uploadProductImage,
} from '@/services/product.service';

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function createProductAction(formData: FormData) {
  const { actorId } = await requireAdmin();
  const pricingBreakdownRaw = readFormValue(formData, 'pricingBreakdown');
  const input = productInputSchema.parse({
    categoryId: readFormValue(formData, 'categoryId') ?? null,
    name: formData.get('name'),
    slug: formData.get('slug'),
    shortDescription: readFormValue(formData, 'shortDescription') ?? null,
    description: readFormValue(formData, 'description') ?? null,
    productType: formData.get('productType'),
    status: readFormValue(formData, 'status') ?? 'DRAFT',
    basePrice: readFormValue(formData, 'basePrice') ? Number(formData.get('basePrice')) : null,
    isFeatured: formData.get('isFeatured') === 'on',
    seoTitle: readFormValue(formData, 'seoTitle') ?? null,
    seoDescription: readFormValue(formData, 'seoDescription') ?? null,
    // Phase 9: set together only when staff used the pricing calculator panel.
    pricingBreakdown: pricingBreakdownRaw ? JSON.parse(pricingBreakdownRaw) : undefined,
    pricingConfigId: readFormValue(formData, 'pricingConfigId') ?? undefined,
  });
  await createProduct(input, actorId);
  revalidatePath('/admin/products');
}

export async function createCategoryAction(formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = categoryInputSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    parentId: readFormValue(formData, 'parentId') ?? null,
  });
  await createCategory(input, actorId);
  revalidatePath('/admin/products');
}

export async function updateProductAction(productId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const pricingBreakdownRaw = readFormValue(formData, 'pricingBreakdown');
  const patch = productUpdateInputSchema.parse({
    name: readFormValue(formData, 'name'),
    slug: readFormValue(formData, 'slug'),
    shortDescription: readFormValue(formData, 'shortDescription') ?? null,
    description: readFormValue(formData, 'description') ?? null,
    status: readFormValue(formData, 'status'),
    basePrice: readFormValue(formData, 'basePrice') ? Number(formData.get('basePrice')) : null,
    isFeatured: formData.get('isFeatured') === 'on',
    seoTitle: readFormValue(formData, 'seoTitle') ?? null,
    seoDescription: readFormValue(formData, 'seoDescription') ?? null,
    pricingBreakdown: pricingBreakdownRaw ? JSON.parse(pricingBreakdownRaw) : undefined,
    pricingConfigId: readFormValue(formData, 'pricingConfigId') ?? undefined,
  });
  await updateProduct(productId, patch, actorId);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/admin/products');
}

// STAFF-allowed soft archive (ADR-0011 boundary #3) — same updateProduct call, just status.
export async function archiveProductAction(productId: string) {
  const { actorId } = await requireAdmin();
  await updateProduct(productId, { status: 'ARCHIVED' }, actorId);
  revalidatePath('/admin/products');
}

export async function unarchiveProductAction(productId: string) {
  const { actorId } = await requireAdmin();
  await updateProduct(productId, { status: 'ACTIVE' }, actorId);
  revalidatePath('/admin/products');
}

// Hard delete — OWNER only (ADR-0011 boundary #3).
export async function deleteProductAction(productId: string) {
  const { actorId } = await requireOwner();
  await deleteProduct(productId, actorId);
  revalidatePath('/admin/products');
}

export async function createVariantAction(productId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = productVariantInputSchema.parse({
    productId,
    sku: formData.get('sku'),
    name: formData.get('name'),
    price: Number(formData.get('price')),
    weightGrams: readFormValue(formData, 'weightGrams') ? Number(formData.get('weightGrams')) : null,
  });
  await createVariant(input, actorId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function updateVariantAction(productId: string, variantId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const patch = variantUpdateInputSchema.parse({
    name: readFormValue(formData, 'name'),
    price: readFormValue(formData, 'price') ? Number(formData.get('price')) : undefined,
    isActive: formData.has('isActive') ? formData.get('isActive') === 'on' : undefined,
  });
  await updateVariant(variantId, patch, actorId);
  revalidatePath(`/admin/products/${productId}`);
}

// Hard delete — OWNER only (ADR-0011 boundary #3).
export async function deleteVariantAction(productId: string, variantId: string) {
  const { actorId } = await requireOwner();
  await deleteVariant(variantId, actorId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function uploadProductImageAction(productId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const file = formData.get('file');
  if (!(file instanceof Blob) || file.size === 0) return;
  await uploadProductImage({ productId, file, fileName: file instanceof File ? file.name : 'upload' }, actorId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProductImageAction(productId: string, imageId: string) {
  const { actorId } = await requireAdmin();
  await deleteProductImage(imageId, actorId);
  revalidatePath(`/admin/products/${productId}`);
}
