-- Migration: 20261124000000_trend_watch_items.sql
-- Trend radar watchlist (ADR-0060, hardened by ADR-0062).
-- Server-only table: the app reads/writes it through pg.Pool (`query()`, ADR-0012) behind requireAdmin().
-- Edited in place: the first version referenced a non-existent `staff_profiles.status` column in an RLS
-- policy, so it could never apply anywhere.

create table if not exists public.trend_watch_items (
  id uuid primary key default gen_random_uuid(),
  source_url text not null check (char_length(source_url) <= 2000),
  platform varchar(32) not null check (platform in ('MAKERWORLD', 'MAKERWORLD_CN', 'PRINTABLES', 'THINGIVERSE', 'THANGS', 'DOUYIN', 'OTHER')),
  title varchar(255) not null check (btrim(title) <> ''),
  cover_url text,
  author varchar(120),
  license varchar(200),
  notes text check (notes is null or char_length(notes) <= 1000),
  estimated_grams numeric(8, 2) check (estimated_grams is null or estimated_grams >= 0),
  estimated_print_minutes integer check (estimated_print_minutes is null or estimated_print_minutes >= 0),
  plate_count integer check (plate_count is null or plate_count >= 1),
  category_tag varchar(64) not null default 'Chưa phân loại',
  status varchar(32) not null default 'WATCHING' check (status in ('WATCHING', 'PRINT_TESTING', 'CONVERTED_DRAFT', 'ARCHIVED')),
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_trend_watch_status_created on public.trend_watch_items (status, created_at desc);
-- One watchlist row per source link (case/whitespace normalised by the service before insert).
create unique index if not exists trend_watch_items_source_url_key on public.trend_watch_items (source_url);

drop trigger if exists trend_watch_items_set_updated_at on public.trend_watch_items;
create trigger trend_watch_items_set_updated_at before update on public.trend_watch_items
  for each row execute function public.set_updated_at();

-- Server-only table (pattern of 20261012000000 / Phase 36): RLS on, no policy, no API-role grant.
alter table public.trend_watch_items enable row level security;
do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke all on public.trend_watch_items from %I', api_role);
    end if;
  end loop;
end $$;
