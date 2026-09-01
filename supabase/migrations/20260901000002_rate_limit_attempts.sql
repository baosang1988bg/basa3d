-- F-01: shared public-route rate limiting for multi-instance deployments.
create table rate_limit_attempts (
  scope varchar(100) not null check (btrim(scope) <> ''),
  limiter_key varchar(255) not null check (btrim(limiter_key) <> ''),
  attempt_count integer not null check (attempt_count > 0),
  window_expires_at timestamptz not null,
  primary key (scope, limiter_key)
);

create index rate_limit_attempts_window_expires_at_idx
  on rate_limit_attempts (window_expires_at);
