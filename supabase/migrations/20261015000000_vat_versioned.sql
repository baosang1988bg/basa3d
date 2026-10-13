-- Phase 33 S1 (plan §4A, D3, T9, T10): versioned VAT. Default OFF → behaviour of every existing
-- pricing config, quote and order is unchanged (all new columns default to false/0, which satisfies
-- the new checks for every existing row).
--
-- The VAT FORMULA (base, rounding) is deliberately NOT encoded here — it lives in
-- src/lib/pricing/vat.ts (pending accountant confirmation, O2). The DB only enforces that the total
-- includes vat_amount and that there is no VAT money without a VAT rate.

-- Fail fast instead of queueing behind a long-running read while holding ACCESS EXCLUSIVE locks
-- (every statement below rewrites no table, but the new CHECKs scan quotes/orders once each).
set local lock_timeout = '5s';

-- 4.1 pricing_configs: rate in integer basis points (800 = 8%), never numeric (ADR-0023).
alter table pricing_configs
  add column vat_enabled boolean not null default false,
  add column vat_rate_bps integer not null default 0 check (vat_rate_bps between 0 and 10000),
  add constraint pricing_configs_vat_rate_when_enabled check (not vat_enabled or vat_rate_bps > 0);

-- 4.2 quotes: VAT snapshot (ADR-0022 — a quote never changes after creation).
alter table quotes
  add column vat_rate_bps integer not null default 0 check (vat_rate_bps between 0 and 10000),
  add column vat_amount bigint not null default 0 check (vat_amount >= 0);

-- Drop the old total check WITH verification. The initial schema declared it as an inline column
-- check that references several columns, so Postgres auto-named it `quotes_check` (not
-- `quotes_total_check` as the plan assumed). Locate it by its definition instead of a guessed name
-- and fail loudly unless exactly one matches — never silently leave the old check behind (it would
-- reject every quote with vat_amount > 0).
do $$
declare
  matches text[];
begin
  select array_agg(conname) into matches
  from pg_constraint
  where conrelid = 'quotes'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%total = ((subtotal + shipping_fee) - discount)%';
  if coalesce(array_length(matches, 1), 0) <> 1 then
    raise exception 'expected exactly one quotes total check, found % — inspect \d quotes before migrating', coalesce(matches::text, '{}');
  end if;
  execute format('alter table quotes drop constraint %I', matches[1]);
end $$;

alter table quotes add constraint quotes_total_with_vat check (
  total >= 0
  and total = subtotal + shipping_fee - discount + vat_amount
  and (vat_rate_bps > 0 or vat_amount = 0)
);

-- 4.2b orders: same snapshot columns AND the total check must include vat_amount, otherwise a
-- non-zero vat_amount would sit outside total while the DB still accepted the row. No code writes
-- VAT for orders in this phase (cart is hidden) — existing inserts get 0/0 by default.
alter table orders
  add column vat_rate_bps integer not null default 0 check (vat_rate_bps between 0 and 10000),
  add column vat_amount bigint not null default 0 check (vat_amount >= 0);

do $$
declare
  matches text[];
begin
  select array_agg(conname) into matches
  from pg_constraint
  where conrelid = 'orders'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%total = (((subtotal + shipping_fee) + cod_fee) - discount)%';
  if coalesce(array_length(matches, 1), 0) <> 1 then
    raise exception 'expected exactly one orders total check, found % — inspect \d orders before migrating', coalesce(matches::text, '{}');
  end if;
  execute format('alter table orders drop constraint %I', matches[1]);
end $$;

alter table orders add constraint orders_total_with_vat check (
  total >= 0
  and total = subtotal + shipping_fee + cod_fee - discount + vat_amount
  and (vat_rate_bps > 0 or vat_amount = 0)
);
