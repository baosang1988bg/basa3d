-- Phase B (docs/exec-plans/active/makerworld-phase-b-storefront-estimate.md §6, ADR-0033):
-- storefront MakerWorld estimates priced from what staff already analysed in the admin panel.
-- Requires 20261012000000_enable_rls_public_tables.sql to have run first (RLS convention).

-- Tầng 1 — verified price presets. Stores the pricing INPUTS staff approved (material lines with
-- grams incl. waste, print minutes, labor for the tier), not just a number, so a lookup can be
-- re-priced with the CURRENT pricing_configs row + material costs (owner decision D3).
create table makerworld_price_presets (
  id uuid primary key default gen_random_uuid(),
  model_id text not null check (model_id ~ '^[0-9]{1,20}$'),
  profile_id text not null check (profile_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  tier text not null check (tier in ('ASSEMBLED', 'KIT')),
  source_url text not null check (char_length(source_url) <= 2000),
  profile_snapshot jsonb not null,
  material_lines jsonb not null check (jsonb_typeof(material_lines) = 'array' and jsonb_array_length(material_lines) between 1 and 20),
  print_minutes integer not null check (print_minutes > 0),
  labor_minutes integer not null check (labor_minutes >= 0),
  pricing_config_id uuid not null references pricing_configs(id),
  final_price_vnd_at_save bigint not null check (final_price_vnd_at_save >= 0),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One active preset per (model, profile, tier); deactivated rows are kept as history.
create unique index makerworld_price_presets_active_uq
  on makerworld_price_presets (model_id, profile_id, tier) where is_active;
create index makerworld_price_presets_model_idx on makerworld_price_presets (model_id) where is_active;
alter table makerworld_price_presets enable row level security;

-- Tầng 2 — normalised resolver results (never raw HTML), cached per model so the public endpoint
-- calls MakerWorld at most once per model per TTL and can enforce a global hourly budget.
create table makerworld_resolver_cache (
  model_id text primary key check (model_id ~ '^[0-9]{1,20}$'),
  resolution jsonb,
  outcome text not null check (outcome in ('OK', 'BLOCKED_OR_TIMEOUT', 'NOT_FOUND', 'PROFILE_NOT_FOUND')),
  fetched_at timestamptz not null default now()
);
create index makerworld_resolver_cache_fetched_idx on makerworld_resolver_cache (fetched_at);
alter table makerworld_resolver_cache enable row level security;

-- What the customer picked and which reference price they were shown, for staff (§4).
alter table custom_requests add column if not exists makerworld_snapshot jsonb;
