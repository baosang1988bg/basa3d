# Migration Rules

- Every schema change is a committed migration.
- Never edit an old production migration after it has been applied.
- Seed data must be deterministic.
- Test migrations from a clean database regularly.
- Destructive migrations require an explicit plan for data preservation/rollback.

## Log (selected)

- `20261022000000_stl_bulk_import.sql` (Feature 003, ADR-0049) — additive: table `product_import_items` + 3 indexes,
  RLS on/revokes, triggers `products_import_publish_gate` and `product_import_items_link_gate`, hidden category
  `chua-phan-loai` (`on conflict do nothing`), comment on `products.license_type`. Idempotent (`if not exists`,
  `create or replace`, `drop trigger if exists`); creating the trigger takes a brief `SHARE ROW EXCLUSIVE` lock on
  `products`. No backfill. **Apply to hosted Supabase manually after review** (not done by the feature run).
- `20261027000000_quick_restock_idempotency.sql` (Phase 52) — additive: table `admin_request_keys`
  (request_key PK, scope, payload_hash, result_id, created_by, created_at; RLS on, revoked from anon/authenticated)
  and unique partial index `inventory_movements_quick_restock_key (reference_type, reference_id, product_variant_id)
  where reference_type = 'quick_restock'`. No backfill; brief `SHARE` lock on `inventory_movements` while building
  (table small, `lock_timeout 5s`). **Apply to hosted Supabase manually after review.**
