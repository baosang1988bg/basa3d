-- Phase 34: retry-safe public checkout and indexed rate-limit maintenance.
alter table orders
  add column checkout_request_id uuid,
  add column checkout_request_hash varchar(64),
  add constraint orders_checkout_request_pair check (
    (checkout_request_id is null and checkout_request_hash is null)
    or (checkout_request_id is not null and checkout_request_hash ~ '^[0-9a-f]{64}$')
  );

create unique index orders_checkout_request_id_idx
  on orders (checkout_request_id)
  where checkout_request_id is not null;

create index if not exists idx_rate_limit_expires_at
  on rate_limit_attempts (window_expires_at);

