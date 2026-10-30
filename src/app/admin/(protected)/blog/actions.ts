'use server';

import { parseActionId } from '@/lib/action-args';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { blogCategoryInputSchema, blogPostInputSchema, blogPostUpdateInputSchema } from '@/domain/schemas';
import { createBlogCategory, createBlogPostWithCover, updateBlogPostWithCover } from '@/services/blog.service';
import { syncDaily3DNews } from '@/services/ai-news.service';

export async function triggerDailyNewsSyncAction(): Promise<{ success: boolean; message: string; slug?: string }> {
  const { actorId } = await requireAdmin();
  try {
    const result = await syncDaily3DNews({ actorId, force: true });
    revalidatePath('/admin/blog');
    revalidatePath('/blog');
    return {
      success: true,
      message: result.message || `Đã tạo bài điểm tin: ${result.slug}`,
      slug: result.slug,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message };
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
  revalidatePath('/admin/blog');
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
  revalidatePath('/admin/blog');
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
  revalidatePath('/admin/blog');
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath('/blog');
}
