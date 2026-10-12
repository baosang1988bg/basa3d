-- ADR-0034 (instant quote from uploaded file): the automatic estimate the customer saw on the
-- storefront before sending a request — recomputed server-side at submission, never sent by the
-- browser. Shown to staff on the custom request page. Nullable; no data migration.
alter table custom_requests add column if not exists quote_estimate_snapshot jsonb;
