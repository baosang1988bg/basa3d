-- ADR-0039 (docs/exec-plans/active/makerworld-screenshot-estimate.md §4): a customer screenshot of a
-- MakerWorld profile, read by a vision model, bound to the link it was sent with. Single use (2 h),
-- consumed in the same transaction that creates the custom request. Never written by the browser.
create table if not exists makerworld_screenshot_estimates (
  id uuid primary key default gen_random_uuid(),
  model_id text not null check (model_id ~ '^[0-9]{1,20}$'),
  source_url text not null check (char_length(source_url) <= 2000),
  requested_profile_id text check (requested_profile_id is null or requested_profile_id ~ '^[0-9]{1,20}$'),
  attachment_path text not null unique check (attachment_path ~ '^requests/[0-9a-f-]+\.(jpg|jpeg|png|webp)$'),
  model_title_extracted text check (model_title_extracted is null or char_length(model_title_extracted) <= 300),
  match_status text not null check (match_status in ('MATCH', 'MISMATCH', 'UNKNOWN')),
  profiles jsonb not null check (jsonb_typeof(profiles) = 'array' and jsonb_array_length(profiles) between 0 and 10),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  custom_request_id uuid references custom_requests(id) on delete set null,
  check (expires_at > created_at),
  -- custom_request_id may later become null (request deleted) but a row is never un-consumed.
  check (custom_request_id is null or consumed_at is not null)
);
create index if not exists makerworld_screenshot_estimates_created_idx on makerworld_screenshot_estimates (created_at);
alter table makerworld_screenshot_estimates enable row level security;
