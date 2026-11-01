-- Phase 54.2 (docs/exec-plans/active/phase-54-2-blog-review-media.md, ADR-0057): source media
-- attached to a blog post — preview images hotlinked from the cited article (never re-hosted) and
-- YouTube embeds. Shape is validated in the app by src/lib/blog-media.ts (Zod); the DB only
-- guarantees it is a bounded array so a bad write cannot bloat every blog read.
alter table blog_posts
  add column media jsonb not null default '[]'::jsonb;

alter table blog_posts
  add constraint blog_posts_media_is_bounded_array
  check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 20);

-- Admin review queue (/admin/blog/review) lists drafts newest first.
create index blog_posts_drafts_created_idx on blog_posts (created_at desc) where status = 'DRAFT';
