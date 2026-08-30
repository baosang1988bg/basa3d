# Migration Rules

- Every schema change is a committed migration.
- Never edit an old production migration after it has been applied.
- Seed data must be deterministic.
- Test migrations from a clean database regularly.
- Destructive migrations require an explicit plan for data preservation/rollback.
