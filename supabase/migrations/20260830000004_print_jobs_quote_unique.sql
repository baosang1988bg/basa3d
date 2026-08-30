-- DB-level backstop for the acceptQuote double-accept guard (src/services/quote.service.ts):
-- a quote should never end up with more than one print_job.
create unique index print_jobs_quote_id_unique_idx on print_jobs (quote_id) where quote_id is not null;
