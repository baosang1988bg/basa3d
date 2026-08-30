-- audit_logs.actor_id was nullable, unlike inventory_movements/material_movements.created_by which
-- enforce a non-null actor via CHECK for adjustments. Every write path already supplies actorId
-- (DEV_ACTOR_ID server-side constant for now, a real session actor from Phase 3), so enforce the
-- "every audit entry has an attributable actor" guarantee at the schema level too.
alter table audit_logs alter column actor_id set not null;
