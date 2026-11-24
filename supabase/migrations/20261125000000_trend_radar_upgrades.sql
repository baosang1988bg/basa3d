-- Migration: 20261125000000_trend_radar_upgrades.sql (ADR-0063)
-- 1. trend_watch_items: server-computed license verdict + link to the catalog product it became.
-- 2. Publish gate: a product created from a trend item whose license is not COMMERCIAL_ALLOWED cannot be
--    ACTIVE without a license proof URL and a known license type (mirrors the STL-import gate, 20261022).
-- 3. trend_watch_snapshots: daily popularity counters for velocity ("độ nóng").
-- 4. visual_search_cache: Gemini results keyed by image SHA-256 (cost control for /api/public/search/visual-analyze).
-- All tables are server-only (RLS on, no policy, API roles revoked).

alter table public.trend_watch_items
  add column if not exists license_status varchar(32) not null default 'UNKNOWN'
    check (license_status in ('COMMERCIAL_ALLOWED', 'NON_COMMERCIAL', 'COMMERCIAL_SUBSCRIPTION', 'UNKNOWN')),
  add column if not exists license_source varchar(32) not null default 'NONE'
    check (license_source in ('PLATFORM_API', 'PAGE_DATA', 'NONE')),
  add column if not exists product_id uuid references public.products(id) on delete set null;

create unique index if not exists trend_watch_items_product_id_key on public.trend_watch_items (product_id) where product_id is not null;

-- 2a. Product side of the gate.
create or replace function public.enforce_trend_publish_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  verdict text;
begin
  select license_status into verdict from public.trend_watch_items where product_id = new.id;
  if not found or verdict = 'COMMERCIAL_ALLOWED' then
    return new;
  end if;
  if new.license_type = 'UNKNOWN' or new.license_proof_url is null or btrim(new.license_proof_url) = '' then
    raise exception 'TREND_PUBLISH_BLOCKED:LICENSE_PROOF_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists products_trend_publish_gate on public.products;
create trigger products_trend_publish_gate before insert or update of status, license_type, license_proof_url on public.products
  for each row when (new.status = 'ACTIVE') execute function public.enforce_trend_publish_gate();

-- 2b. Item side: linking a non-cleared trend item to an already ACTIVE product without proof is refused.
create or replace function public.enforce_trend_item_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.product_id is not null and new.license_status <> 'COMMERCIAL_ALLOWED'
     and exists (
       select 1 from public.products
       where id = new.product_id and status = 'ACTIVE'
         and (license_type = 'UNKNOWN' or license_proof_url is null or btrim(license_proof_url) = '')
     ) then
    raise exception 'TREND_PUBLISH_BLOCKED:LICENSE_PROOF_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trend_watch_items_link_gate on public.trend_watch_items;
create trigger trend_watch_items_link_gate before insert or update of product_id, license_status
  on public.trend_watch_items for each row execute function public.enforce_trend_item_link();

revoke execute on function public.enforce_trend_publish_gate() from public;
revoke execute on function public.enforce_trend_item_link() from public;

-- 3. Daily popularity snapshots (one row per item per UTC day; re-runs the same day overwrite).
create table if not exists public.trend_watch_snapshots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.trend_watch_items(id) on delete cascade,
  captured_on date not null default (timezone('utc', now()))::date,
  downloads integer check (downloads is null or downloads >= 0),
  likes integer check (likes is null or likes >= 0),
  prints integer check (prints is null or prints >= 0),
  created_at timestamptz not null default now(),
  unique (item_id, captured_on)
);
create index if not exists trend_watch_snapshots_item_day_idx on public.trend_watch_snapshots (item_id, captured_on desc);

-- 4. Visual search cache.
create table if not exists public.visual_search_cache (
  image_sha256 char(64) primary key check (image_sha256 ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  created_at timestamptz not null default now(),
  last_hit_at timestamptz
);
create index if not exists visual_search_cache_created_idx on public.visual_search_cache (created_at);

alter table public.trend_watch_snapshots enable row level security;
alter table public.visual_search_cache enable row level security;
do $$
declare
  api_role text;
  tbl text;
begin
  foreach tbl in array array['trend_watch_snapshots', 'visual_search_cache'] loop
    foreach api_role in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = api_role) then
        execute format('revoke all on public.%I from %I', tbl, api_role);
      end if;
    end loop;
  end loop;
end $$;
