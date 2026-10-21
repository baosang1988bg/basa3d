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
