-- Public storefront (Phase 4): custom-request intake gains a public, unauthenticated entry point.
--
-- FORWARD-ONLY MIGRATION — there is no clean down-migration. Two of the three statements below
-- cannot be safely reverted:
--   1. Postgres cannot drop a value from an existing enum type, so `custom_request_source_channel`
--      keeps 'WEBSITE' forever (reverting would require recreating the type and rewriting every
--      column that uses it).
--   2. `audit_logs.actor_id` cannot be re-tightened to NOT NULL once any public (actor-less) write
--      has inserted a row with a null actor_id; doing so would require deleting or backfilling
--      those audit rows, which destroys audit history.
-- Only `custom_requests.attachment_url` is trivially droppable. Roll forward, do not roll back.
-- Two additive schema changes plus one reversal:
alter table custom_requests add column attachment_url text
  check (attachment_url is null or char_length(attachment_url) <= 2000);

alter type custom_request_source_channel add value 'WEBSITE';

-- Phase 3 (20260830000002) made audit_logs.actor_id NOT NULL under the assumption every write
-- path has an authenticated actor. Phase 4 introduces the project's first unauthenticated write
-- path (POST /api/public/custom-requests) which must still leave an audit trail
-- (action = 'CUSTOM_REQUEST_CREATED_PUBLIC') so OWNER can distinguish it from staff-entered
-- requests. Reverting to nullable restores the original Phase 0 design (docs/database/schema.md);
-- every existing authenticated write path already supplies a real actorId and is unaffected.
-- See docs/architecture/decisions.md ADR-0013 addendum (2026-08-31).
alter table audit_logs alter column actor_id drop not null;
