// Phase 54.2 (ADR-0057): blog review queue + source media.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import { blogMediaListSchema, firstSelectedImageUrl, parseStoredBlogMedia, selectedMedia, type BlogMediaItem } from '../src/lib/blog-media.js';
import {
  listDraftPostsForReview,
  publishBlogPostDraft,
  rejectBlogDraft,
  updateBlogPostMediaSelection,
} from '../src/services/blog.service.js';

configureTestEnvironment();
after(async () => {
  if (process.env.DATABASE_URL) await getPool().end();
});

const ACTOR_ID = '00000000-0000-4000-8000-0000000000aa';
const IMAGE: BlogMediaItem = {
  id: 'aaaaaaaaaaaa', kind: 'source_image', url: 'https://3dprintingindustry.com/a.jpg',
  sourceUrl: 'https://3dprintingindustry.com/news/a/', sourceName: '3D Printing Industry', caption: 'A', selected: true,
};
const VIDEO: BlogMediaItem = {
  id: 'bbbbbbbbbbbb', kind: 'youtube', videoId: 'SRKj_QPDHXw',
  sourceUrl: 'https://3dprintingindustry.com/news/a/', sourceName: '3D Printing Industry', selected: false,
};

test('blog media schema: https only, valid YouTube ids, bounded list', () => {
  assert.equal(blogMediaListSchema.safeParse([IMAGE, VIDEO]).success, true);
  assert.equal(blogMediaListSchema.safeParse([{ ...IMAGE, url: 'http://3dprintingindustry.com/a.jpg' }]).success, false);
  assert.equal(blogMediaListSchema.safeParse([{ ...IMAGE, url: 'javascript:alert(1)' }]).success, false);
  assert.equal(blogMediaListSchema.safeParse([{ ...VIDEO, videoId: 'x"><script>' }]).success, false);
  assert.equal(blogMediaListSchema.safeParse(Array.from({ length: 21 }, () => IMAGE)).success, false);
});

test('parseStoredBlogMedia drops malformed items instead of failing the page', () => {
  const parsed = parseStoredBlogMedia([IMAGE, { kind: 'source_image', url: 'nope' }, 'garbage', VIDEO]);
  assert.deepEqual(parsed.map((m) => m.id), [IMAGE.id, VIDEO.id]);
  assert.deepEqual(parseStoredBlogMedia(null), []);
  assert.deepEqual(selectedMedia(parsed).videos, []);
  assert.equal(firstSelectedImageUrl([VIDEO, IMAGE]), IMAGE.kind === 'source_image' ? IMAGE.url : null);
  assert.equal(firstSelectedImageUrl([{ ...IMAGE, selected: false }]), null);
});

let dbAvailable = false;
if (process.env.DATABASE_URL) {
  try {
    const client = new (await import('pg')).Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query('select 1');
    await client.end();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
}

async function insertPost(slug: string, status: 'DRAFT' | 'PUBLISHED', media: BlogMediaItem[] = []) {
  await query('delete from blog_posts where slug = $1', [slug]);
  const result = await query<{ id: string }>(
    `insert into blog_posts (title, slug, content, status, published_at, media)
     values ($1, $2, 'Nội dung', $3, case when $3 = 'PUBLISHED' then now() end, $4::jsonb) returning id`,
    [`Bài ${slug}`, slug, status, JSON.stringify(media)],
  );
  return result.rows[0].id;
}

test('publishBlogPostDraft: concurrent approvals publish once; the loser gets BLOG_POST_NOT_DRAFT', { skip: !dbAvailable }, async () => {
  const slug = 'review-test-publish';
  const id = await insertPost(slug, 'DRAFT');
  try {
    const results = await Promise.allSettled([publishBlogPostDraft(id, ACTOR_ID), publishBlogPostDraft(id, ACTOR_ID)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.equal(rejected.reason.code, 'BLOG_POST_NOT_DRAFT');
    const row = await query<{ status: string; published_at: Date | null }>('select status, published_at from blog_posts where id = $1', [id]);
    assert.equal(row.rows[0].status, 'PUBLISHED');
    assert.ok(row.rows[0].published_at);
    const audits = await query<{ n: number }>(`select count(*)::int as n from audit_logs where entity_id = $1 and action = 'BLOG_POST_PUBLISHED'`, [id]);
    assert.equal(audits.rows[0].n, 1);
  } finally {
    await query('delete from blog_posts where slug = $1', [slug]);
  }
});

test('rejectBlogDraft deletes drafts only, with an audit entry; published posts are refused', { skip: !dbAvailable }, async () => {
  const draftId = await insertPost('review-test-reject-draft', 'DRAFT');
  const publishedId = await insertPost('review-test-reject-published', 'PUBLISHED');
  try {
    await rejectBlogDraft(draftId, ACTOR_ID);
    assert.equal((await query('select 1 from blog_posts where id = $1', [draftId])).rowCount, 0);
    const audit = await query<{ before_data: { slug: string } }>(`select before_data from audit_logs where entity_id = $1 and action = 'BLOG_POST_REJECTED'`, [draftId]);
    assert.equal(audit.rows[0].before_data.slug, 'review-test-reject-draft');

    await assert.rejects(() => rejectBlogDraft(publishedId, ACTOR_ID), (err: { code?: string }) => err.code === 'BLOG_POST_NOT_DRAFT');
    assert.equal((await query('select 1 from blog_posts where id = $1', [publishedId])).rowCount, 1);
    await assert.rejects(() => rejectBlogDraft(draftId, ACTOR_ID), (err: { code?: string }) => err.code === 'BLOG_POST_NOT_FOUND');
  } finally {
    await query('delete from blog_posts where slug in ($1, $2)', ['review-test-reject-draft', 'review-test-reject-published']);
  }
});

test('updateBlogPostMediaSelection toggles selection only and ignores unknown ids', { skip: !dbAvailable }, async () => {
  const slug = 'diem-tin-in-3d-2026-02-01';
  const id = await insertPost(slug, 'DRAFT', [IMAGE, VIDEO]);
  try {
    const drafts = await listDraftPostsForReview();
    const listed = drafts.find((d) => d.id === id);
    assert.ok(listed?.isAiNews);
    assert.equal(listed?.mediaCount, 2);

    await updateBlogPostMediaSelection(id, [VIDEO.id, 'ffffffffffff'], ACTOR_ID);
    const row = await query<{ media: BlogMediaItem[] }>('select media from blog_posts where id = $1', [id]);
    assert.deepEqual(row.rows[0].media.map((m) => [m.id, m.selected]), [[IMAGE.id, false], [VIDEO.id, true]]);
  } finally {
    await query('delete from blog_posts where slug = $1', [slug]);
  }
});

test('blog_posts.media rejects non-arrays and oversized lists at the DB level', { skip: !dbAvailable }, async () => {
  const slug = 'review-test-media-check';
  await query('delete from blog_posts where slug = $1', [slug]);
  await assert.rejects(() => query(`insert into blog_posts (title, slug, content, media) values ('x', $1, 'x', '{}'::jsonb)`, [slug]));
  await assert.rejects(() => query(`insert into blog_posts (title, slug, content, media) values ('x', $1, 'x', $2::jsonb)`, [slug, JSON.stringify(Array.from({ length: 21 }, () => ({})))]));
});
