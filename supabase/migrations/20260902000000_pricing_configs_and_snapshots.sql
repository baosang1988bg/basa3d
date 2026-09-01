-- Phase 9: pricing engine config + immutable pricing snapshot on quotes/products.
-- pricing_configs is insert-only (never updated) so a Quote/Product breakdown can always be traced
-- back to the exact config that priced it (business-rules.md #3/#7). effective_from is always set
-- by the application layer to timezone('utc', now()) at insert time — the column default here is
-- only a safety net for direct SQL, not a way to back-date a config (see phase-9.md decision #3
-- guardrail).
create table pricing_configs (
  id uuid primary key default gen_random_uuid(),
  electricity_vnd_per_kwh bigint not null check (electricity_vnd_per_kwh >= 0),
  machine_price_vnd bigint not null check (machine_price_vnd >= 0),
  machine_lifetime_hours integer not null check (machine_lifetime_hours > 0),
  printer_power_kw numeric(5,2) not null check (printer_power_kw > 0),
  labor_vnd_per_hour bigint not null check (labor_vnd_per_hour >= 0),
  failure_buffer_pct numeric(5,2) not null check (failure_buffer_pct >= 0 and failure_buffer_pct < 100),
  margin_pct numeric(5,2) not null check (margin_pct >= 0 and margin_pct < 100),
  packaging_fee_vnd bigint not null default 0 check (packaging_fee_vnd >= 0),
  effective_from timestamptz not null default timezone('utc', now()),
  -- Plain uuid, no FK — same convention as inventory_movements.created_by/material_movements.created_by:
  -- audit_logs is the authoritative "who did this" trail; this column is metadata only.
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now())
);
create index pricing_configs_effective_from_created_at_idx on pricing_configs (effective_from desc, created_at desc);

-- Snapshot columns: nullable so existing manual Quote/Product creation flows are unaffected.
-- Both columns must be set together (a breakdown is meaningless without knowing which config
-- produced it) or both null (manual entry, no pricing engine involved).
alter table quotes
  add column pricing_breakdown jsonb,
  add column pricing_config_id uuid references pricing_configs(id) on delete set null,
  add constraint quotes_pricing_snapshot_pair check ((pricing_breakdown is null) = (pricing_config_id is null));

alter table products
  add column pricing_breakdown jsonb,
  add column pricing_config_id uuid references pricing_configs(id) on delete set null,
  add constraint products_pricing_snapshot_pair check ((pricing_breakdown is null) = (pricing_config_id is null));
