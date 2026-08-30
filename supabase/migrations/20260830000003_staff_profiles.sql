-- Phase 3: internal admin roles. Keyed by Supabase Auth's auth.users(id) — Supabase Auth handles
-- credentials/session; this table is the only thing our app queries directly (via pg.Pool) to
-- resolve role/active status, per ADR-0012 (no PostgREST/RLS in the request path).
create type staff_role as enum ('OWNER', 'STAFF');

create table staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(200) not null check (btrim(full_name) <> ''),
  role staff_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger staff_profiles_set_updated_at before update on staff_profiles
  for each row execute function set_updated_at();
