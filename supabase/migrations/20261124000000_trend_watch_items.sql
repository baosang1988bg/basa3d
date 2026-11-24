-- Migration: 20261124000000_trend_watch_items.sql
-- Description: Trend radar watchlist for Owner/Staff to capture hot 3D models and track testing before drafting into catalog.

create table if not exists trend_watch_items (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  platform varchar(32) not null check (platform in ('MAKERWORLD', 'MAKERWORLD_CN', 'PRINTABLES', 'THINGIVERSE', 'THANGS', 'DOUYIN', 'OTHER')),
  title varchar(255) not null,
  cover_url text,
  author varchar(120),
  license varchar(100),
  notes text,
  estimated_grams numeric(8, 2) check (estimated_grams is null or estimated_grams >= 0),
  estimated_print_minutes integer check (estimated_print_minutes is null or estimated_print_minutes >= 0),
  plate_count integer check (plate_count is null or plate_count >= 1),
  category_tag varchar(64) default 'Chưa phân loại',
  status varchar(32) not null default 'WATCHING' check (status in ('WATCHING', 'PRINT_TESTING', 'CONVERTED_DRAFT', 'ARCHIVED')),
  created_by uuid references staff_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_trend_watch_status_created on trend_watch_items(status, created_at desc);

-- RLS: Only authenticated staff can read and write trend watch items
alter table trend_watch_items enable row level security;

create policy "Staff can manage trend watch items"
  on trend_watch_items
  for all
  to authenticated
  using (
    exists (
      select 1 from staff_profiles
      where staff_profiles.id = auth.uid()
        and staff_profiles.status = 'ACTIVE'
    )
  )
  with check (
    exists (
      select 1 from staff_profiles
      where staff_profiles.id = auth.uid()
        and staff_profiles.status = 'ACTIVE'
    )
  );
