'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { blogCategoryInputSchema, blogPostInputSchema, blogPostUpdateInputSchema } from '@/domain/schemas';
import { createBlogCategory, createBlogPost, deleteBlogCoverImage, getBlogPostById, updateBlogPost, uploadBlogCoverImage } from '@/services/blog.service';

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

async function uploadCoverIfProvided(formData: FormData): Promise<string | null | undefined> {
  const file = formData.get('coverImage');
  if (!(file instanceof Blob) || file.size === 0) return undefined;
  const { storagePath } = await uploadBlogCoverImage({ file, fileName: file instanceof File ? file.name : 'upload' });
  return storagePath;
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
  const coverImagePath = await uploadCoverIfProvided(formData);
  try {
    await createBlogPost({ ...input, coverImagePath: coverImagePath ?? null }, actorId);
  } catch (error) {
    if (coverImagePath) await deleteBlogCoverImage(coverImagePath).catch(() => undefined);
    throw error;
  }
  revalidatePath('/admin/blog');
}

export async function updateBlogPostAction(id: string, formData: FormData) {
  const { actorId } = await requireAdmin();
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
  const previous = await getBlogPostById(id);
  const coverImagePath = await uploadCoverIfProvided(formData);
  try {
    await updateBlogPost(id, { ...input, coverImagePath }, actorId);
  } catch (error) {
    if (coverImagePath) await deleteBlogCoverImage(coverImagePath).catch(() => undefined);
    throw error;
  }
  if (coverImagePath && previous?.coverImagePath && previous.coverImagePath !== coverImagePath) {
    await deleteBlogCoverImage(previous.coverImagePath).catch((error) => {
      console.error('Failed to remove replaced blog cover image.', { storagePath: previous.coverImagePath, error });
    });
  }
  revalidatePath('/admin/blog');
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath('/blog');
}
