import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { getPool, query } from '../src/lib/db.js';
import { createBlogPost, getPublishedPostBySlug, listPublishedPosts, updateBlogPost } from '../src/services/blog.service.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';

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
