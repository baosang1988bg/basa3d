-- Phase 12: filament spool inventory tracking + workshop expense accounting.
-- filament_spools tracks individual physical spools; material_movements.spool_id ties per-spool
-- consumption back into the existing immutable raw-material ledger (ADR-0008/ADR-0018 extended to
-- spool granularity — see docs/architecture/decisions.md Phase 12 ADR).
create table filament_spools (
  id uuid primary key default gen_random_uuid(),
  spool_code varchar(60) not null unique check (btrim(spool_code) <> ''),
  material_id uuid not null references materials(id) on delete restrict,
  warehouse_id uuid not null references warehouses(id) on delete restrict,
  initial_weight_grams integer not null default 1000 check (initial_weight_grams > 0),
  used_weight_grams integer not null default 0 check (used_weight_grams >= 0 and used_weight_grams <= initial_weight_grams),
  purchase_cost bigint check (purchase_cost >= 0),
  has_spool boolean not null default true,
  -- Only 2 business-driven statuses (Q5, docs/exec-plans/active/phase-12.md decision #5). The 4-tier
  -- warning display (Con nhieu/Can theo doi/Sap het/Da het) is computed at query time from
  -- (initial_weight_grams - used_weight_grams) / initial_weight_grams, never stored here, so it can
  -- never drift out of sync with used_weight_grams.
  status varchar(30) not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index filament_spools_material_id_idx on filament_spools(material_id);
create index filament_spools_status_idx on filament_spools(status);
create trigger filament_spools_set_updated_at before update on filament_spools for each row execute function set_updated_at();

alter table material_movements add column spool_id uuid references filament_spools(id) on delete restrict;
create index material_movements_spool_id_idx on material_movements(spool_id, created_at desc);

-- Nullable: print jobs created before Phase 12 (or against materials with no tracked spools yet)
-- have no spool_id and keep using the pre-Phase-12 lockMaterialForInventoryWrite path.
alter table print_jobs add column spool_id uuid references filament_spools(id) on delete restrict;

create table expenses (
  id uuid primary key default gen_random_uuid(),
  expense_code varchar(40) not null unique check (btrim(expense_code) <> ''),
  title varchar(200) not null check (btrim(title) <> ''),
  category varchar(50) not null check (category in ('EQUIPMENT', 'MATERIAL', 'ACCESSORIES', 'UTILITIES', 'LOGISTICS', 'MARKETING', 'OTHER')),
  amount bigint not null check (amount >= 0),
  quantity integer not null default 1 check (quantity > 0),
  status varchar(30) not null default 'PAID' check (status in ('PAID', 'PENDING', 'CANCELLED')),
  payer_name varchar(100),
  spent_at timestamptz not null default timezone('utc', now()),
  note text,
  -- Plain uuid, no FK — same convention as inventory_movements.created_by/material_movements.created_by
  -- and pricing_configs.created_by: audit_logs is the authoritative "who did this" trail, this column
  -- is metadata only (deviates from the original phase-12.md draft's `references auth.users(id)`,
  -- which would be the only actor column in the codebase with that FK and breaks every existing
  -- test's synthetic ACTOR_ID fixture for no real referential-integrity benefit).
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index expenses_category_idx on expenses(category);
create index expenses_spent_at_idx on expenses(spent_at desc);
create trigger expenses_set_updated_at before update on expenses for each row execute function set_updated_at();
