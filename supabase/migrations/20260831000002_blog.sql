-- Phase 7: blog/content foundation for SEO (docs/product/requirements.md "Blog/content
-- foundation"). No blog_tags join table — tags is a plain text[] (phase-7.md decision #1,
-- deliberately avoids premature abstraction for a filter nobody has asked for yet).
create type blog_post_status as enum ('DRAFT', 'PUBLISHED');

create table blog_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null check (btrim(name) <> ''),
  slug varchar(160) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default timezone('utc', now())
);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references blog_categories(id) on delete set null,
  title varchar(200) not null check (btrim(title) <> ''),
  slug varchar(200) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt varchar(500),
  content text not null check (btrim(content) <> ''),
  cover_image_path text,
  tags text[] not null default '{}'::text[],
  seo_title varchar(200),
  seo_description varchar(500),
  status blog_post_status not null default 'DRAFT',
  published_at timestamptz,
  -- No FK to staff_profiles(id) — matches audit_logs.actor_id / inventory_movements.created_by /
  -- material_movements.created_by, none of which FK the actor column either.
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index blog_posts_published_idx on blog_posts (published_at desc) where status = 'PUBLISHED';

create trigger blog_posts_set_updated_at before update on blog_posts
  for each row execute function set_updated_at();

-- Public-read bucket, mirrors product-images/custom-request-attachments — uploads go through the
-- service-role admin client (bypasses RLS), "public" only controls anonymous read via getPublicUrl().
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;
