-- Public storefront (Phase 4): custom-request intake gains a public, unauthenticated entry point.
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
