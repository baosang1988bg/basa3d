---
name: database-review
description: Review schema, migrations, queries, and inventory write-paths for BaSa3D before merge. Trigger on "review migration", "review schema", "check this query", or any change touching orders/inventory_movements/product_variants/order_items.
---

Read `.agents/skills/database-review/SKILL.md` at the repo root — it is the
canonical checklist (PK/FK correctness, unique constraints, nullability,
index/query alignment, transaction boundaries, concurrent writes, inventory
oversell risk, order snapshot correctness, migration safety, auditability).
Apply it, then also cross-check against `docs/database/business-rules.md`
and `CLAUDE.md`. Output BLOCKERS → IMPORTANT → SUGGESTIONS with exact
table/column/query references.
