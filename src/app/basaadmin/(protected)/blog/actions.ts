'use server';

import { parseActionId } from '@/lib/action-args';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { blogCategoryInputSchema, blogPostInputSchema, blogPostUpdateInputSchema } from '@/domain/schemas';
import { createBlogCategory, createBlogPostWithCover, updateBlogPostWithCover } from '@/services/blog.service';
import { claimManualNewsSync, syncDaily3DNews } from '@/services/ai-news.service';

const DAILY_NEWS_ERROR_MESSAGES: Record<string, string> = {
  GEMINI_NOT_CONFIGURED: 'Chưa cấu hình GEMINI_API_KEY trên server.',
  GEMINI_AUTH_ERROR: 'GEMINI_API_KEY không hợp lệ hoặc không có quyền truy cập model.',
  NO_NEWS_FETCHED: 'Không lấy được tin mới từ các nguồn RSS. Vui lòng thử lại sau.',
  GEMINI_BUDGET_EXHAUSTED: 'Gemini phản hồi quá chậm. Vui lòng thử lại sau.',
};

// Phase 54.1: no `force` (C1) — a second click on the same day returns SKIPPED instead of a
// unique-violation error. Cooldown (D2) protects the Gemini quota from repeated clicks.
export async function triggerDailyNewsSyncAction(): Promise<{ success: boolean; message: string; slug?: string }> {
  const { actorId } = await requireAdmin();
  const claim = await claimManualNewsSync(actorId);
  if (!claim.claimed) {
    return { success: false, message: `Vừa có lượt quét gần đây. Vui lòng thử lại sau ${Math.ceil(claim.retryAfterSeconds / 60)} phút.` };
  }
  try {
    const result = await syncDaily3DNews({ actorId });
    if (result.status === 'CREATED') revalidatePath('/basaadmin/blog');
    return { success: true, message: result.message, slug: result.slug };
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'UNKNOWN';
    console.error('[DAILY_NEWS_MANUAL_SYNC_FAILED]', { code, message: error instanceof Error ? error.message : String(error) });
    return { success: false, message: DAILY_NEWS_ERROR_MESSAGES[code] ?? `Không tạo được bài điểm tin (mã lỗi: ${code}).` };
  }
}

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readTags(formData: FormData): string[] {
  const raw = readFormValue(formData, 'tags');
  if (!raw) return [];
  return raw.split(',').map((tag) => tag.trim()).filter(Boolean);
}

export async function createBlogCategoryAction(formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = blogCategoryInputSchema.parse({ name: formData.get('name'), slug: formData.get('slug') });
  await createBlogCategory(input, actorId);
  revalidatePath('/basaadmin/blog');
}

function coverIfProvided(formData: FormData): { file: Blob; fileName: string } | undefined {
  const file = formData.get('coverImage');
  if (!(file instanceof Blob) || file.size === 0) return undefined;
  return { file, fileName: file instanceof File ? file.name : 'upload' };
}

export async function createBlogPostAction(formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = blogPostInputSchema.parse({
    categoryId: readFormValue(formData, 'categoryId') ?? null,
    title: formData.get('title'),
    slug: formData.get('slug'),
    excerpt: readFormValue(formData, 'excerpt') ?? null,
    content: formData.get('content'),
    tags: readTags(formData),
    seoTitle: readFormValue(formData, 'seoTitle') ?? null,
    seoDescription: readFormValue(formData, 'seoDescription') ?? null,
    status: readFormValue(formData, 'status') ?? 'DRAFT',
  });
  await createBlogPostWithCover(input, coverIfProvided(formData), actorId);
  revalidatePath('/basaadmin/blog');
}

export async function updateBlogPostAction(id: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  id = parseActionId(id, 'id');
  const input = blogPostUpdateInputSchema.parse({
    categoryId: readFormValue(formData, 'categoryId') ?? null,
    title: formData.get('title'),
    slug: formData.get('slug'),
    excerpt: readFormValue(formData, 'excerpt') ?? null,
    content: formData.get('content'),
    tags: readTags(formData),
    seoTitle: readFormValue(formData, 'seoTitle') ?? null,
    seoDescription: readFormValue(formData, 'seoDescription') ?? null,
    status: readFormValue(formData, 'status') ?? 'DRAFT',
  });
  await updateBlogPostWithCover(id, input, coverIfProvided(formData), actorId);
  revalidatePath('/basaadmin/blog');
  revalidatePath(`/basaadmin/blog/${id}`);
  revalidatePath('/blog');
}
