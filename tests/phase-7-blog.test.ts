import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { getPool, query } from '../src/lib/db.js';
import { createSupabaseAdminClient } from '../src/lib/supabase/admin.js';
import { createBlogPost, createBlogPostWithCover, deleteBlogCoverImage, getPublishedPostBySlug, listPublishedPosts, updateBlogPost, updateBlogPostWithCover, uploadBlogCoverImage } from '../src/services/blog.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const canUseStorage = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function blogImageNames(): Promise<Set<string>> {
  const { data, error } = await createSupabaseAdminClient().storage.from('blog-images').list('', { limit: 1000 });
  if (error) throw error;
  return new Set((data ?? []).map((item) => item.name));
}

test('a DRAFT post never appears in listPublishedPosts or getPublishedPostBySlug', { skip: !process.env.DATABASE_URL }, async () => {
  const slug = `draft-post-${randomUUID().slice(0, 8)}`;
  await createBlogPost({ title: 'Draft post', slug, content: 'not published yet', status: 'DRAFT' }, ACTOR_ID);

  const found = await getPublishedPostBySlug(slug);
  assert.equal(found, null);

  const { items } = await listPublishedPosts({ limit: 100 });
  assert.equal(items.some((post) => post.slug === slug), false);
});

test('a PUBLISHED post gets published_at set automatically and is visible', { skip: !process.env.DATABASE_URL }, async () => {
  const slug = `published-post-${randomUUID().slice(0, 8)}`;
  const created = await createBlogPost({ title: 'Published post', slug, content: 'hello world', status: 'PUBLISHED' }, ACTOR_ID);

  const row = await query<{ published_at: Date | null }>('select published_at from blog_posts where id = $1', [created.id]);
  assert.ok(row.rows[0].published_at);

  const found = await getPublishedPostBySlug(slug);
  assert.ok(found);
  assert.equal(found?.title, 'Published post');
});

test('publishing a previously-DRAFT post sets published_at once and does not move it on later edits', { skip: !process.env.DATABASE_URL }, async () => {
  const slug = `publish-then-edit-${randomUUID().slice(0, 8)}`;
  const created = await createBlogPost({ title: 'Draft to publish', slug, content: 'draft body', status: 'DRAFT' }, ACTOR_ID);

  await updateBlogPost(created.id, { status: 'PUBLISHED' }, ACTOR_ID);
  const firstRead = await query<{ published_at: Date }>('select published_at from blog_posts where id = $1', [created.id]);
  const firstPublishedAt = firstRead.rows[0].published_at;
  assert.ok(firstPublishedAt);

  await new Promise((resolve) => setTimeout(resolve, 10));
  await updateBlogPost(created.id, { title: 'Draft to publish (edited)' }, ACTOR_ID);
  const secondRead = await query<{ published_at: Date }>('select published_at from blog_posts where id = $1', [created.id]);
  assert.equal(secondRead.rows[0].published_at.getTime(), firstPublishedAt.getTime());
});

test('a create DB failure after cover upload removes the newly uploaded object', { skip: !canUseStorage }, async () => {
  const slug = `blog-cover-create-rollback-${randomUUID().slice(0, 8)}`;
  await createBlogPost({ title: 'Existing slug', slug, content: 'fixture' }, ACTOR_ID);
  const before = await blogImageNames();

  await assert.rejects(() => createBlogPostWithCover(
    { title: 'Duplicate slug', slug, content: 'must fail' },
    { file: new Blob(['new-cover'], { type: 'image/png' }), fileName: 'cover.png' },
    ACTOR_ID,
  ));

  assert.deepEqual(await blogImageNames(), before);
});

test('cover replacement deletes the old object after success, while failed update preserves it and cleans the new upload', { skip: !canUseStorage }, async () => {
  const oldCover = await uploadBlogCoverImage({ file: new Blob(['old-cover'], { type: 'image/png' }), fileName: 'old.png' });
  const slug = `blog-cover-replace-${randomUUID().slice(0, 8)}`;
  const created = await createBlogPost({ title: 'Cover replace', slug, content: 'fixture', coverImagePath: oldCover.storagePath }, ACTOR_ID);
  let currentCoverPath = oldCover.storagePath;
  try {
    await updateBlogPostWithCover(created.id, { title: 'Cover replaced' }, { file: new Blob(['replacement'], { type: 'image/png' }), fileName: 'replacement.png' }, ACTOR_ID);
    const replaced = await query<{ cover_image_path: string }>('select cover_image_path from blog_posts where id = $1', [created.id]);
    currentCoverPath = replaced.rows[0].cover_image_path;
    assert.notEqual(currentCoverPath, oldCover.storagePath);
    assert.ok((await createSupabaseAdminClient().storage.from('blog-images').download(currentCoverPath)).data);
    assert.ok((await createSupabaseAdminClient().storage.from('blog-images').download(oldCover.storagePath)).error);

    const beforeFailedUpdate = await blogImageNames();
    await assert.rejects(() => updateBlogPostWithCover(
      created.id,
      { categoryId: randomUUID() },
      { file: new Blob(['must-be-cleaned'], { type: 'image/png' }), fileName: 'failed.png' },
      ACTOR_ID,
    ));
    const afterFailure = await query<{ cover_image_path: string }>('select cover_image_path from blog_posts where id = $1', [created.id]);
    assert.equal(afterFailure.rows[0].cover_image_path, currentCoverPath);
    assert.ok((await createSupabaseAdminClient().storage.from('blog-images').download(currentCoverPath)).data);
    assert.deepEqual(await blogImageNames(), beforeFailedUpdate);
  } finally {
    await query('delete from blog_posts where id = $1', [created.id]);
    await deleteBlogCoverImage(currentCoverPath).catch(() => undefined);
  }
});
