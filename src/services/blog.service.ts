import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { writeAuditLog } from './audit.service';
import { blogMediaListSchema, firstSelectedImageUrl, parseStoredBlogMedia, type BlogMediaItem } from '../lib/blog-media';
import { pagination } from './product.service';

const BLOG_IMAGE_BUCKET = 'blog-images';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function listBlogCategories() {
  const result = await query<{ id: string; name: string; slug: string }>('select id, name, slug from blog_categories order by name');
  return result.rows;
}

// actorId null = system job (Phase 54.1 D3: daily AI news cron) — audit_logs.actor_id has no FK.
export async function createBlogCategory(input: { name: string; slug: string }, actorId: string | null) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>('insert into blog_categories (name, slug) values ($1,$2) returning id', [input.name, input.slug]);
    await writeAuditLog(client, { actorId, action: 'BLOG_CATEGORY_CREATED', entityType: 'blog_category', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
}

// Mirrors uploadProductImage — admin-only caller (requireAdmin at the action layer), so trusting
// input.file.type is consistent with that existing pattern (unlike the public custom-request
// attachment route, which cannot trust an anonymous caller's declared type).
export async function uploadBlogCoverImage(input: { file: Blob; fileName: string }) {
  if (!ALLOWED_IMAGE_TYPES.has(input.file.type)) throw new DomainError('INVALID_FILE_TYPE', 'Only JPEG, PNG, or WEBP images are allowed.', 400);
  if (input.file.size > MAX_IMAGE_SIZE_BYTES) throw new DomainError('FILE_TOO_LARGE', 'Image must be 5 MB or smaller.', 400);
  const extension = EXTENSION_BY_TYPE[input.file.type];
  const storagePath = `${randomUUID()}.${extension}`;

  const supabase = createSupabaseAdminClient();
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(BLOG_IMAGE_BUCKET).upload(storagePath, bytes, { contentType: input.file.type });
  if (uploadError) throw new DomainError('IMAGE_UPLOAD_FAILED', uploadError.message, 502);

  const { data: publicUrl } = supabase.storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(storagePath);
  return { url: publicUrl.publicUrl, storagePath };
}

export async function deleteBlogCoverImage(storagePath: string) {
  const { error } = await createSupabaseAdminClient().storage.from(BLOG_IMAGE_BUCKET).remove([storagePath]);
  if (error) throw new DomainError('IMAGE_DELETE_FAILED', error.message, 502);
}

export type BlogPostInput = {
  categoryId?: string | null; title: string; slug: string; excerpt?: string | null; content: string;
  tags?: string[]; seoTitle?: string | null; seoDescription?: string | null; status?: string; coverImagePath?: string | null;
  // Phase 54.2: only the AI news pipeline sets this today; admin forms never send it.
  media?: BlogMediaItem[];
};

type BlogCoverFile = { file: Blob; fileName: string } | undefined;

export async function createBlogPostWithCover(input: BlogPostInput, cover: BlogCoverFile, actorId: string) {
  const coverImagePath = cover ? (await uploadBlogCoverImage(cover)).storagePath : null;
  try {
    return await createBlogPost({ ...input, coverImagePath }, actorId);
  } catch (error) {
    if (coverImagePath) await deleteBlogCoverImage(coverImagePath).catch(() => undefined);
    throw error;
  }
}

export async function updateBlogPostWithCover(id: string, input: Partial<BlogPostInput>, cover: BlogCoverFile, actorId: string) {
  const previous = await getBlogPostById(id);
  const coverImagePath = cover ? (await uploadBlogCoverImage(cover)).storagePath : undefined;
  try {
    const result = await updateBlogPost(id, { ...input, coverImagePath }, actorId);
    if (coverImagePath && previous?.coverImagePath && previous.coverImagePath !== coverImagePath) {
      await deleteBlogCoverImage(previous.coverImagePath).catch((error) => {
        console.error('Failed to remove replaced blog cover image.', { storagePath: previous.coverImagePath, error });
      });
    }
    return result;
  } catch (error) {
    if (coverImagePath) await deleteBlogCoverImage(coverImagePath).catch(() => undefined);
    throw error;
  }
}

export async function createBlogPost(input: BlogPostInput, actorId: string | null) {
  return withTransaction(async (client) => {
    const status = input.status ?? 'DRAFT';
    // published_at is set automatically the first time a post becomes PUBLISHED — no separate
    // "schedule for later" field in this phase (phase-7.md decision #1, keep it to what the dev
    // plan actually asks for: Post/Category/Tag/Slug/Cover/SEO/Published at, not a scheduler).
    const publishedAt = status === 'PUBLISHED' ? new Date() : null;
    const result = await client.query<{ id: string }>(`
      insert into blog_posts (category_id, title, slug, excerpt, content, cover_image_path, tags, seo_title, seo_description, status, published_at, created_by, media)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) returning id`, [
      input.categoryId ?? null, input.title, input.slug, input.excerpt ?? null, input.content, input.coverImagePath ?? null,
      input.tags ?? [], input.seoTitle ?? null, input.seoDescription ?? null, status, publishedAt, actorId,
      JSON.stringify(blogMediaListSchema.parse(input.media ?? [])),
    ]);
    await writeAuditLog(client, { actorId, action: 'BLOG_POST_CREATED', entityType: 'blog_post', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
}

export async function updateBlogPost(id: string, patch: Partial<BlogPostInput>, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query<{ status: string; published_at: Date | null }>('select status, published_at from blog_posts where id = $1 for update', [id]);
    if (!before.rowCount) throw new DomainError('BLOG_POST_NOT_FOUND', 'Blog post was not found.', 404);

    const fields: Record<string, string> = {
      categoryId: 'category_id', title: 'title', slug: 'slug', excerpt: 'excerpt', content: 'content',
      coverImagePath: 'cover_image_path', tags: 'tags', seoTitle: 'seo_title', seoDescription: 'seo_description', status: 'status',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(fields)) {
      const value = (patch as Record<string, unknown>)[key];
      if (value === undefined) continue;
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
    // First transition into PUBLISHED sets published_at; later edits never move it backwards/clear it.
    if (patch.status === 'PUBLISHED' && !before.rows[0].published_at) {
      values.push(new Date());
      sets.push(`published_at = $${values.length}`);
    }
    if (!sets.length) return { id };
    values.push(id);
    const updated = await client.query(`update blog_posts set ${sets.join(', ')} where id = $${values.length} returning id, status`, values);
    await writeAuditLog(client, { actorId, action: 'BLOG_POST_UPDATED', entityType: 'blog_post', entityId: id, beforeData: before.rows[0], afterData: updated.rows[0] });
    return updated.rows[0];
  });
}

type BlogPostSummary = { id: string; title: string; slug: string; status: string; publishedAt: string | null; createdAt: string };

export async function listBlogPosts(input: { page?: number; limit?: number } = {}) {
  const { page, limit, offset } = pagination(input);
  const result = await query<BlogPostSummary>(`
    select id, title, slug, status, published_at as "publishedAt", created_at as "createdAt"
    from blog_posts order by created_at desc limit $1 offset $2`, [limit, offset]);
  return { page, limit, items: result.rows };
}

type BlogPostDetail = {
  id: string; categoryId: string | null; categoryName: string | null; title: string; slug: string; excerpt: string | null; content: string;
  coverImagePath: string | null; tags: string[]; seoTitle: string | null; seoDescription: string | null;
  status: string; publishedAt: string | null; createdAt: string;
};

export async function getBlogPostById(id: string): Promise<BlogPostDetail | null> {
  const result = await query<BlogPostDetail>(`
    select p.id, p.category_id as "categoryId", c.name as "categoryName", p.title, p.slug, p.excerpt, p.content, p.cover_image_path as "coverImagePath",
      p.tags, p.seo_title as "seoTitle", p.seo_description as "seoDescription", p.status, p.published_at as "publishedAt", p.created_at as "createdAt"
    from blog_posts p left join blog_categories c on c.id = p.category_id where p.id = $1`, [id]);
  return result.rows[0] ?? null;
}

function resolveCoverImageUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  return createSupabaseAdminClient().storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

// previewImageUrl: Phase 54.2 — cover if uploaded, else the first selected (hotlinked) source image.
type PublishedPostSummary = { id: string; title: string; slug: string; excerpt: string | null; coverImageUrl: string | null; previewImageUrl: string | null; publishedAt: string };

export async function listPublishedPosts(input: { page?: number; limit?: number } = {}) {
  const { page, limit, offset } = pagination(input);
  const result = await query<{ id: string; title: string; slug: string; excerpt: string | null; coverImagePath: string | null; publishedAt: string; media: unknown }>(`
    select id, title, slug, excerpt, cover_image_path as "coverImagePath", published_at as "publishedAt", media
    from blog_posts where status = 'PUBLISHED' and published_at <= now()
    order by published_at desc limit $1 offset $2`, [limit, offset]);
  const items: PublishedPostSummary[] = result.rows.map(({ media, ...row }) => {
    const coverImageUrl = resolveCoverImageUrl(row.coverImagePath);
    return { ...row, coverImageUrl, previewImageUrl: coverImageUrl ?? firstSelectedImageUrl(media) };
  });
  return { page, limit, items };
}

// For sitemap.ts only — every PUBLISHED post slug, unpaginated.
export async function listAllPublishedPostSlugs() {
  const result = await query<{ slug: string; publishedAt: string }>(
    `select slug, published_at as "publishedAt" from blog_posts where status = 'PUBLISHED' and published_at <= now()`,
  );
  return result.rows;
}

export async function getPublishedPostBySlug(slug: string) {
  const result = await query<BlogPostDetail & { media: unknown }>(`
    select p.id, p.category_id as "categoryId", c.name as "categoryName", p.title, p.slug, p.excerpt, p.content, p.cover_image_path as "coverImagePath",
      p.tags, p.seo_title as "seoTitle", p.seo_description as "seoDescription", p.status, p.published_at as "publishedAt", p.created_at as "createdAt",
      p.media
    from blog_posts p left join blog_categories c on c.id = p.category_id
    where p.slug = $1 and p.status = 'PUBLISHED' and p.published_at <= now()`, [slug]);
  if (!result.rowCount) return null;
  const post = result.rows[0];
  // The `published_at <= now()` filter above guarantees this is non-null for every row this query
  // can return — narrower than BlogPostDetail's general nullable type (a post can be PUBLISHED with
  // published_at unset only transiently, never reachable through this query).
  return { ...post, publishedAt: post.publishedAt as string, coverImageUrl: resolveCoverImageUrl(post.coverImagePath), media: parseStoredBlogMedia(post.media) };
}

// ---------------------------------------------------------------------------------------------
// Phase 54.2 — review queue (/admin/blog/review). ADR-0057.
// ---------------------------------------------------------------------------------------------

/** Daily AI news drafts are recognizable by their deterministic slug (ai-news.service). */
export const AI_NEWS_SLUG_PREFIX = 'diem-tin-in-3d-';

export type DraftReviewSummary = { id: string; title: string; slug: string; createdAt: string; mediaCount: number; isAiNews: boolean };

export async function listDraftPostsForReview(limit = 50): Promise<DraftReviewSummary[]> {
  const result = await query<{ id: string; title: string; slug: string; createdAt: string; mediaCount: number }>(`
    select id, title, slug, created_at as "createdAt", jsonb_array_length(media)::int as "mediaCount"
    from blog_posts where status = 'DRAFT' order by created_at desc limit $1`, [limit]);
  return result.rows.map((row) => ({ ...row, isAiNews: row.slug.startsWith(AI_NEWS_SLUG_PREFIX) }));
}

export async function countDraftPosts(): Promise<number> {
  const result = await query<{ count: string }>(`select count(*) from blog_posts where status = 'DRAFT'`);
  return Number(result.rows[0]?.count ?? 0);
}

export async function getBlogPostForReview(id: string) {
  const post = await getBlogPostById(id);
  if (!post) return null;
  const media = await query<{ media: unknown }>('select media from blog_posts where id = $1', [id]);
  return { ...post, coverImageUrl: resolveCoverImageUrl(post.coverImagePath), media: parseStoredBlogMedia(media.rows[0]?.media) };
}

async function assertDraftConflict(client: PoolClient, id: string): Promise<never> {
  const current = await client.query<{ status: string }>('select status from blog_posts where id = $1', [id]);
  if (!current.rowCount) throw new DomainError('BLOG_POST_NOT_FOUND', 'Bài viết không còn tồn tại.', 404);
  throw new DomainError('BLOG_POST_NOT_DRAFT', 'Bài viết không còn ở trạng thái nháp (có thể đã được người khác duyệt).', 409);
}

/**
 * D8: conditional transition — two reviewers clicking at once publish exactly once; the loser gets
 * BLOG_POST_NOT_DRAFT instead of a second audit entry. published_at follows the existing rule
 * (set on the first transition into PUBLISHED, never moved afterwards).
 */
export async function publishBlogPostDraft(id: string, actorId: string) {
  return withTransaction(async (client) => {
    const updated = await client.query<{ id: string; slug: string; status: string; published_at: Date }>(`
      update blog_posts set status = 'PUBLISHED', published_at = coalesce(published_at, $2)
      where id = $1 and status = 'DRAFT' returning id, slug, status, published_at`, [id, new Date()]);
    if (!updated.rowCount) return assertDraftConflict(client, id);
    await writeAuditLog(client, {
      actorId, action: 'BLOG_POST_PUBLISHED', entityType: 'blog_post', entityId: id,
      beforeData: { status: 'DRAFT' }, afterData: updated.rows[0],
    });
    return { id: updated.rows[0].id, slug: updated.rows[0].slug };
  });
}

/** D3: rejecting = deleting the DRAFT (never a published post), with an audit trail. */
export async function rejectBlogDraft(id: string, actorId: string) {
  const removed = await withTransaction(async (client) => {
    const deleted = await client.query<{ id: string; title: string; slug: string; excerpt: string | null; cover_image_path: string | null; created_by: string | null; created_at: Date }>(`
      delete from blog_posts where id = $1 and status = 'DRAFT'
      returning id, title, slug, excerpt, cover_image_path, created_by, created_at`, [id]);
    if (!deleted.rowCount) return assertDraftConflict(client, id);
    await writeAuditLog(client, { actorId, action: 'BLOG_POST_REJECTED', entityType: 'blog_post', entityId: id, beforeData: deleted.rows[0] });
    return deleted.rows[0];
  });
  if (removed.cover_image_path) {
    await deleteBlogCoverImage(removed.cover_image_path).catch((error) => {
      console.error('Failed to remove rejected draft cover image.', { storagePath: removed.cover_image_path, error });
    });
  }
  return { id: removed.id, slug: removed.slug };
}

/** Toggles which attached media are shown. Unknown ids are ignored; the media list itself never changes here. */
export async function updateBlogPostMediaSelection(id: string, selectedIds: string[], actorId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ media: unknown }>('select media from blog_posts where id = $1 for update', [id]);
    if (!current.rowCount) throw new DomainError('BLOG_POST_NOT_FOUND', 'Bài viết không còn tồn tại.', 404);
    const before = parseStoredBlogMedia(current.rows[0].media);
    const wanted = new Set(selectedIds);
    const after = before.map((item) => ({ ...item, selected: wanted.has(item.id) }));
    await client.query('update blog_posts set media = $2::jsonb where id = $1', [id, JSON.stringify(blogMediaListSchema.parse(after))]);
    await writeAuditLog(client, {
      actorId, action: 'BLOG_POST_MEDIA_UPDATED', entityType: 'blog_post', entityId: id,
      beforeData: { selected: before.filter((m) => m.selected).map((m) => m.id) },
      afterData: { selected: after.filter((m) => m.selected).map((m) => m.id) },
    });
    return { id, selectedCount: after.filter((m) => m.selected).length };
  });
}
