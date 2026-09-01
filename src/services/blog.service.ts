import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';

const BLOG_IMAGE_BUCKET = 'blog-images';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function listBlogCategories() {
  const result = await query<{ id: string; name: string; slug: string }>('select id, name, slug from blog_categories order by name');
  return result.rows;
}

export async function createBlogCategory(input: { name: string; slug: string }, actorId: string) {
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

type BlogPostInput = {
  categoryId?: string | null; title: string; slug: string; excerpt?: string | null; content: string;
  tags?: string[]; seoTitle?: string | null; seoDescription?: string | null; status?: string; coverImagePath?: string | null;
};

export async function createBlogPost(input: BlogPostInput, actorId: string) {
  return withTransaction(async (client) => {
    const status = input.status ?? 'DRAFT';
    // published_at is set automatically the first time a post becomes PUBLISHED — no separate
    // "schedule for later" field in this phase (phase-7.md decision #1, keep it to what the dev
    // plan actually asks for: Post/Category/Tag/Slug/Cover/SEO/Published at, not a scheduler).
    const publishedAt = status === 'PUBLISHED' ? new Date() : null;
    const result = await client.query<{ id: string }>(`
      insert into blog_posts (category_id, title, slug, excerpt, content, cover_image_path, tags, seo_title, seo_description, status, published_at, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`, [
      input.categoryId ?? null, input.title, input.slug, input.excerpt ?? null, input.content, input.coverImagePath ?? null,
      input.tags ?? [], input.seoTitle ?? null, input.seoDescription ?? null, status, publishedAt, actorId,
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
  id: string; categoryId: string | null; title: string; slug: string; excerpt: string | null; content: string;
  coverImagePath: string | null; tags: string[]; seoTitle: string | null; seoDescription: string | null;
  status: string; publishedAt: string | null; createdAt: string;
};

export async function getBlogPostById(id: string): Promise<BlogPostDetail | null> {
  const result = await query<BlogPostDetail>(`
    select id, category_id as "categoryId", title, slug, excerpt, content, cover_image_path as "coverImagePath",
      tags, seo_title as "seoTitle", seo_description as "seoDescription", status, published_at as "publishedAt", created_at as "createdAt"
    from blog_posts where id = $1`, [id]);
  return result.rows[0] ?? null;
}

function resolveCoverImageUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  return createSupabaseAdminClient().storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

type PublishedPostSummary = { id: string; title: string; slug: string; excerpt: string | null; coverImageUrl: string | null; publishedAt: string };

export async function listPublishedPosts(input: { page?: number; limit?: number } = {}) {
  const { page, limit, offset } = pagination(input);
  const result = await query<{ id: string; title: string; slug: string; excerpt: string | null; coverImagePath: string | null; publishedAt: string }>(`
    select id, title, slug, excerpt, cover_image_path as "coverImagePath", published_at as "publishedAt"
    from blog_posts where status = 'PUBLISHED' and published_at <= now()
    order by published_at desc limit $1 offset $2`, [limit, offset]);
  const items: PublishedPostSummary[] = result.rows.map((row) => ({ ...row, coverImageUrl: resolveCoverImageUrl(row.coverImagePath) }));
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
  const result = await query<BlogPostDetail>(`
    select id, category_id as "categoryId", title, slug, excerpt, content, cover_image_path as "coverImagePath",
      tags, seo_title as "seoTitle", seo_description as "seoDescription", status, published_at as "publishedAt", created_at as "createdAt"
    from blog_posts where slug = $1 and status = 'PUBLISHED' and published_at <= now()`, [slug]);
  if (!result.rowCount) return null;
  const post = result.rows[0];
  // The `published_at <= now()` filter above guarantees this is non-null for every row this query
  // can return — narrower than BlogPostDetail's general nullable type (a post can be PUBLISHED with
  // published_at unset only transiently, never reachable through this query).
  return { ...post, publishedAt: post.publishedAt as string, coverImageUrl: resolveCoverImageUrl(post.coverImagePath) };
}
