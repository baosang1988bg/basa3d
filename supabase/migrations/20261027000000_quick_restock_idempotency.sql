-- Phase 52 (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md, D3): idempotency for the new
-- admin flows ("Nhập kho nhanh", "Nhập theo mẻ", "Đăng sản phẩm mới"). Additive only, no backfill.
--
-- 1. admin_request_keys: one row per client-generated request UUID, written in the SAME transaction as
--    the work it guards. It stores a SHA-256 of the canonical request, so a retry with the same key is
--    replayed only when the payload is identical (Rule #21's contract, applied to admin writes); a
--    different payload under a used key is refused. The primary key also serialises two concurrent
--    requests with the same key, whatever variants they touch.
-- 2. A partial unique index on inventory_movements as a second line of defence: one quick-restock key
--    can write at most one ledger row per variant.
-- A plain (non-concurrent) index build takes a brief SHARE lock on inventory_movements — the table is small.

set local lock_timeout = '5s';

create table if not exists admin_request_keys (
  request_key uuid primary key,
  scope varchar(40) not null check (scope in ('quick_restock', 'product_onboarding')),
  payload_hash char(64) not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
comment on table admin_request_keys is 'Phase 52: idempotency keys for admin quick-restock / product onboarding (payload hash per key).';

-- Server-only table: same posture as the other internal tables (Phase 34/35) — RLS on, no grants to
-- the Data API roles. The app reaches it through the server-side pg pool only.
alter table admin_request_keys enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on table admin_request_keys from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on table admin_request_keys from authenticated'; end if;
end $$;

create unique index if not exists inventory_movements_quick_restock_key
  on inventory_movements (reference_type, reference_id, product_variant_id)
  where reference_type = 'quick_restock';
