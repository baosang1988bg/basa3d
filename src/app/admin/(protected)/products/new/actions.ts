'use server';

// Phase 52 P2/P3 — "Đăng sản phẩm mới" (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md).
// Every action returns a result object (never throws a DomainError/ZodError to the client) so the
// form can show the Vietnamese message; production builds hide thrown error messages.
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { DomainError } from '@/lib/domain-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  productImageRegisterSchema,
  productImageUploadRequestSchema,
  productOnboardingInputSchema,
  uuidSchema,
} from '@/domain/schemas';
import {
  PRODUCT_IMAGE_BUCKET,
  PUBLISH_READINESS_MESSAGES,
  createProductImageUploadTargets,
  createProductWithVariants,
  publishProductIfReady,
  registerProductImages,
  setProductCoverImage,
  type ProductImageUploadTarget,
  type ProductOnboardingResult,
  type RegisteredImages,
} from '@/services/product-onboarding.service';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; field?: string };

const FIELD_LABELS: Record<string, string> = {
  name: 'Tên sản phẩm', categoryId: 'Danh mục', basePrice: 'Giá bán', licenseType: 'Nguồn mẫu',
  licenseSourceUrl: 'Link nguồn model', licenseProofUrl: 'Link bằng chứng license', variants: 'Màu / biến thể',
  shortDescription: 'Mô tả ngắn', seoTitle: 'SEO title', seoDescription: 'SEO description',
};

function toFailure(error: unknown): { ok: false; code: string; message: string; field?: string } {
  if (error instanceof DomainError) return { ok: false, code: error.code, message: error.message };
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.map(String)[0];
    const label = field ? FIELD_LABELS[field] : undefined;
    const message = issue?.code === 'custom' || !label ? issue?.message ?? 'Dữ liệu không hợp lệ.' : `${label}: giá trị chưa hợp lệ.`;
    return { ok: false, code: 'VALIDATION_ERROR', message, field };
  }
  throw error;
}

function revalidateCatalog(productId?: string) {
  revalidatePath('/admin/products');
  revalidatePath('/admin/product-inventory');
  if (productId) revalidatePath(`/admin/products/${productId}`);
}

export async function createProductOnboardingAction(payload: unknown): Promise<ActionResult<ProductOnboardingResult>> {
  const { actorId } = await requireAdmin();
  try {
    const result = await createProductWithVariants(productOnboardingInputSchema.parse(payload), actorId);
    revalidateCatalog(result.productId);
    return { ok: true, data: result };
  } catch (error) {
    return toFailure(error);
  }
}

export async function createProductImageUploadTargetsAction(payload: unknown): Promise<ActionResult<ProductImageUploadTarget[]>> {
  await requireAdmin();
  try {
    const input = productImageUploadRequestSchema.parse(payload);
    const storage = createSupabaseAdminClient().storage.from(PRODUCT_IMAGE_BUCKET);
    const targets = await createProductImageUploadTargets(input, async (path) => {
      const { data, error } = await storage.createSignedUploadUrl(path);
      if (error || !data) throw new DomainError('IMAGE_UPLOAD_FAILED', 'Không tạo được link tải ảnh. Thử lại sau.', 502);
      return { token: data.token, signedUrl: data.signedUrl };
    });
    return { ok: true, data: targets };
  } catch (error) {
    return toFailure(error);
  }
}

export async function registerProductImagesAction(payload: unknown): Promise<ActionResult<RegisteredImages>> {
  const { actorId } = await requireAdmin();
  try {
    const input = productImageRegisterSchema.parse(payload);
    const result = await registerProductImages(input, actorId);
    revalidateCatalog(input.productId);
    return { ok: true, data: result };
  } catch (error) {
    return toFailure(error);
  }
}

export async function publishProductAction(productId: string): Promise<ActionResult<{ published: boolean; reasons: string[] }>> {
  const { actorId } = await requireAdmin();
  try {
    const result = await publishProductIfReady(uuidSchema.parse(productId), actorId);
    revalidateCatalog(productId);
    return { ok: true, data: { published: result.published, reasons: result.reasons.map((reason) => PUBLISH_READINESS_MESSAGES[reason]) } };
  } catch (error) {
    return toFailure(error);
  }
}

export async function setProductCoverImageAction(productId: string, imageId: string): Promise<void> {
  await requireAdmin();
  const validProductId = uuidSchema.parse(productId);
  await setProductCoverImage(validProductId, uuidSchema.parse(imageId));
  revalidateCatalog(validProductId);
}
