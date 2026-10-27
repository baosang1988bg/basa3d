'use server';

import { parseActionId } from '@/lib/action-args';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PublishBlockedError } from '@/lib/stl-import/publish-gate';
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
import { generateVariantSku, publishProductIfReady } from '@/services/product-onboarding.service';
import { slugify } from '@/lib/catalog/naming';

// Feature 003: the import publish gate refuses status → ACTIVE with reasons; send the admin back to
// the page with those reasons instead of the generic error boundary.
async function updateOrExplain(productId: string, patch: Parameters<typeof updateProduct>[1], actorId: string, backTo: string) {
  try {
    await updateProduct(productId, patch, actorId);
  } catch (error) {
    if (error instanceof PublishBlockedError) redirect(`${backTo}?publishBlocked=${error.reasons.join(',')}`);
    throw error;
  }
}

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
    // Phase 29: license/source of the model this product is printed from — defaults to OWN_DESIGN
    // in the schema when the field is left unset.
    licenseType: readFormValue(formData, 'licenseType') ?? undefined,
    licenseSourceUrl: readFormValue(formData, 'licenseSourceUrl') ?? null,
    licenseProofUrl: readFormValue(formData, 'licenseProofUrl') ?? null,
  });
  await createProduct(input, actorId);
  revalidatePath('/admin/products');
}

export async function createCategoryAction(formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = categoryInputSchema.parse({
    name: formData.get('name'),
    // Phase 52: slug is optional — generated from the name when left empty.
    slug: readFormValue(formData, 'slug') ?? slugify(String(formData.get('name') ?? '')),
    parentId: readFormValue(formData, 'parentId') ?? null,
  });
  await createCategory(input, actorId);
  revalidatePath('/admin/products');
}

export async function updateProductAction(productId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  productId = parseActionId(productId, 'productId');
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
    licenseType: readFormValue(formData, 'licenseType'),
    licenseSourceUrl: readFormValue(formData, 'licenseSourceUrl') ?? null,
    licenseProofUrl: readFormValue(formData, 'licenseProofUrl') ?? null,
  });
  await updateOrExplain(productId, patch, actorId, `/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/admin/products');
}

// STAFF-allowed soft archive (ADR-0011 boundary #3) — same updateProduct call, just status.
export async function archiveProductAction(productId: string) {
  const { actorId } = await requireAdmin();
  productId = parseActionId(productId, 'productId');
  await updateProduct(productId, { status: 'ARCHIVED' }, actorId);
  revalidatePath('/admin/products');
}

export async function unarchiveProductAction(productId: string) {
  const { actorId } = await requireAdmin();
  productId = parseActionId(productId, 'productId');
  await updateOrExplain(productId, { status: 'ACTIVE' }, actorId, '/admin/products');
  revalidatePath('/admin/products');
}

// Product list "Đăng bán" (UX redesign 2026-10-27): DRAFT → ACTIVE only when nothing is missing
// (licence known, image, price, real category). Missing items / the Feature 003 gate come back as a
// notice on the list instead of the error page.
export async function publishProductFromListAction(productId: string) {
  const { actorId } = await requireAdmin();
  productId = parseActionId(productId, 'productId');
  let missing: string[] = [];
  try {
    missing = (await publishProductIfReady(productId, actorId)).reasons;
  } catch (error) {
    if (error instanceof PublishBlockedError) redirect(`/admin/products?publishBlocked=${error.reasons.join(',')}`);
    throw error;
  }
  revalidatePath('/admin/products');
  if (missing.length) redirect(`/admin/products?missing=${missing.join(',')}`);
}

// Hard delete — OWNER only (ADR-0011 boundary #3).
export async function deleteProductAction(productId: string) {
  const { actorId } = await requireOwner();
  productId = parseActionId(productId, 'productId');
  await deleteProduct(productId, actorId);
  revalidatePath('/admin/products');
}

export async function createVariantAction(productId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  productId = parseActionId(productId, 'productId');
  // Phase 52: SKU is optional — generated from the product slug + variant name when left empty.
  const typedSku = readFormValue(formData, 'sku')?.trim().toUpperCase();
  const variantName = String(formData.get('name') ?? '');
  const input = productVariantInputSchema.parse({
    productId,
    sku: typedSku || await generateVariantSku(productId, variantName),
    name: formData.get('name'),
    price: Number(formData.get('price')),
    weightGrams: readFormValue(formData, 'weightGrams') ? Number(formData.get('weightGrams')) : null,
  });
  await createVariant(input, actorId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function updateVariantAction(productId: string, variantId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  productId = parseActionId(productId, 'productId');
  variantId = parseActionId(variantId, 'variantId');
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
  productId = parseActionId(productId, 'productId');
  variantId = parseActionId(variantId, 'variantId');
  await deleteVariant(variantId, actorId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function uploadProductImageAction(productId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  productId = parseActionId(productId, 'productId');
  const file = formData.get('file');
  if (!(file instanceof Blob) || file.size === 0) return;
  await uploadProductImage({ productId, file, fileName: file instanceof File ? file.name : 'upload' }, actorId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProductImageAction(productId: string, imageId: string) {
  const { actorId } = await requireAdmin();
  productId = parseActionId(productId, 'productId');
  imageId = parseActionId(imageId, 'imageId');
  await deleteProductImage(imageId, actorId);
  revalidatePath(`/admin/products/${productId}`);
}
