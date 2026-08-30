# Operations Runbook

## Incident order mismatch
1. Stop further manual stock edits.
2. Inspect inventory movements.
3. Inspect order event/status history.
4. Identify the actor and timestamp.
5. Correct with a new auditable adjustment, not by rewriting history.

## Deployment failure
1. Check build logs.
2. Check migration status.
3. Roll back application version if safe.
4. Do not blindly roll back DB schema after destructive migrations.
