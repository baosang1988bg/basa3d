'use server';

// Phase 54.2 (ADR-0057): review queue actions. D4: any active staff (requireAdmin) may approve.
import { revalidatePath } from 'next/cache';
import { parseActionId } from '@/lib/action-args';
import { requireAdmin } from '@/lib/auth/require-admin';
import { DomainError } from '@/lib/domain-error';
import { publishBlogPostDraft, rejectBlogDraft, updateBlogPostMediaSelection } from '@/services/blog.service';

export type ReviewDecisionResult = { ok: true; message: string; slug?: string } | { ok: false; error: string };

function revalidateBlogViews() {
  revalidatePath('/admin/blog');
  revalidatePath('/admin/blog/review');
  revalidatePath('/blog');
}

function toResult(error: unknown): ReviewDecisionResult {
  if (error instanceof DomainError) return { ok: false, error: error.message };
  console.error('[BLOG_REVIEW_ACTION_FAILED]', error instanceof Error ? error.message : error);
  return { ok: false, error: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' };
}

export async function approveBlogPostAction(id: string): Promise<ReviewDecisionResult> {
  const { actorId } = await requireAdmin();
  try {
    const result = await publishBlogPostDraft(parseActionId(id), actorId);
    revalidateBlogViews();
    return { ok: true, message: 'Đã duyệt và đăng bài.', slug: result.slug };
  } catch (error) {
    return toResult(error);
  }
}

export async function rejectBlogDraftAction(id: string): Promise<ReviewDecisionResult> {
  const { actorId } = await requireAdmin();
  try {
    await rejectBlogDraft(parseActionId(id), actorId);
    revalidateBlogViews();
    return { ok: true, message: 'Đã từ chối và xoá bản nháp.' };
  } catch (error) {
    return toResult(error);
  }
}

const MEDIA_ID_PATTERN = /^[a-f0-9]{12}$/;

export async function updateBlogMediaSelectionAction(id: string, formData: FormData): Promise<void> {
  const { actorId } = await requireAdmin();
  const postId = parseActionId(id);
  const selected = formData.getAll('media').filter((value): value is string => typeof value === 'string' && MEDIA_ID_PATTERN.test(value));
  await updateBlogPostMediaSelection(postId, selected.slice(0, 20), actorId);
  revalidatePath('/admin/blog/review');
}
