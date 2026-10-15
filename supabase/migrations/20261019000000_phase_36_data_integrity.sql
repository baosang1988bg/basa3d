-- Phase 36 (post-go-live-audit data integrity, docs/exec-plans/active/phase-36-data-integrity.md).
-- Idempotent and safe on hosted Supabase and on the plain-PostgreSQL test DB. No data is rewritten
-- except the one-off order_items.product_type_snapshot backfill (section 6).

-- 1. Function EXECUTE default privilege (fixes Phase 35 D7 section 4).
--    PostgreSQL grants EXECUTE to PUBLIC on every new function as a *global* built-in default. A
--    schema-scoped `alter default privileges in schema public revoke ... from public` cannot remove
--    a global default (PostgreSQL docs, ALTER DEFAULT PRIVILEGES), so Phase 35's line was a no-op and
--    any function created later — e.g. a SECURITY DEFINER RPC — would be callable through
--    /rest/v1/rpc with the public anon key. Only the global form (no IN SCHEMA) removes it.
--    Applies to functions created later by the role running migrations (postgres on Supabase).
alter default privileges revoke execute on functions from public;
revoke execute on all functions in schema public from public;

do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke execute on all functions in schema public from %I', api_role);
      execute format('alter default privileges revoke execute on functions from %I', api_role);
      -- Belt and braces for tables created after 20261012000000 (e.g. makerworld_screenshot_estimates):
      -- the app never reaches tables through PostgREST, so the API roles need no table grant at all.
      execute format('revoke all on all tables in schema public from %I', api_role);
      execute format('revoke all on all sequences in schema public from %I', api_role);
    end if;
  end loop;
end $$;

-- 2. Timestamps: `timezone('utc', now())` returns a timestamp WITHOUT time zone, which PostgreSQL
--    then reads back in the *session* TimeZone when storing into timestamptz. Hosted Supabase runs
--    in UTC so production data is correct, but any session with another TimeZone (a Homebrew test DB
--    on a Mac set to Asia/Ho_Chi_Minh, or `set timezone`) stores times 7 hours early — which made
--    the phone-number rate limits on public order/custom-request submission never trigger there.
--    `now()` is already an absolute instant; use it everywhere.
create or replace function set_updated_at() returns trigger language plpgsql set search_path = '' as
$$ begin new.updated_at = now(); return new; end; $$;

do $$
declare
  col record;
begin
  for col in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_default = 'timezone(''utc''::text, now())'
  loop
    execute format('alter table public.%I alter column %I set default now()', col.table_name, col.column_name);
  end loop;
end $$;

-- 3. pricing_configs is documented as insert-only (20260902000000 header, business-rules.md #3/#7)
--    but nothing enforced it. UPDATE and TRUNCATE are now refused. DELETE stays possible only for a
--    config nothing points at: the foreign keys from quotes/products move from SET NULL to RESTRICT,
--    so a config that priced a quote or product can never disappear (SET NULL would also have
--    violated the quotes/products pricing_snapshot_pair checks with a confusing error).
drop trigger if exists pricing_configs_no_update on pricing_configs;
create trigger pricing_configs_no_update before update on pricing_configs
  for each row execute function prevent_ledger_mutation();
drop trigger if exists pricing_configs_no_truncate on pricing_configs;
create trigger pricing_configs_no_truncate before truncate on pricing_configs
  for each statement execute function prevent_ledger_mutation();

alter table quotes drop constraint if exists quotes_pricing_config_id_fkey;
alter table quotes add constraint quotes_pricing_config_id_fkey
  foreign key (pricing_config_id) references pricing_configs(id) on delete restrict;
alter table products drop constraint if exists products_pricing_config_id_fkey;
alter table products add constraint products_pricing_config_id_fkey
  foreign key (pricing_config_id) references pricing_configs(id) on delete restrict;

-- 4. Financial/production history cannot be hard-deleted (business-rules.md #7). The app already
--    refuses (deleteCustomRequest, Phase 36 S1); this is the database backstop. Disposable test-data
--    cleanup may opt out for ONE transaction with `set local basa3d.allow_history_purge = 'on'`
--    (tests/helpers/purge-custom-request.ts) — never set it from application code.
-- One function per table: a PL/pgSQL plan caches the row type of `old`, so one shared function
-- comparing `old.status` against enum literals of two different enum types fails on the second table.
create or replace function prevent_accepted_quote_delete() returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('basa3d.allow_history_purge', true), '') <> 'on' and old.status = 'ACCEPTED' then
    raise exception 'accepted quotes are financial history and cannot be deleted' using errcode = '55000';
  end if;
  return old;
end; $$;
revoke execute on function prevent_accepted_quote_delete() from public;

create or replace function prevent_started_print_job_delete() returns trigger language plpgsql set search_path = '' as $$
begin
  -- A CANCELLED job may still have booked filament (cancelled mid-print): the ledger decides.
  if coalesce(current_setting('basa3d.allow_history_purge', true), '') <> 'on' and (
    old.status not in ('QUEUED', 'CANCELLED')
    or exists (select 1 from public.material_movements mm where mm.reference_type = 'print_job' and mm.reference_id = old.id)
  ) then
    raise exception 'started print jobs are production history and cannot be deleted' using errcode = '55000';
  end if;
  return old;
end; $$;
revoke execute on function prevent_started_print_job_delete() from public;

drop trigger if exists quotes_no_history_delete on quotes;
create trigger quotes_no_history_delete before delete on quotes
  for each row execute function prevent_accepted_quote_delete();
drop trigger if exists print_jobs_no_history_delete on print_jobs;
create trigger print_jobs_no_history_delete before delete on print_jobs
  for each row execute function prevent_started_print_job_delete();

-- 5. blog-images is public; give it the same limits as product-images (src/services/blog.service.ts:
--    JPEG/PNG/WEBP, 5 MB) so a bug or leaked upload path can never serve HTML/SVG from this origin.
update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'blog-images';

-- 6. Order lines snapshot the product type at purchase time (business-rules.md #3). PRODUCING
--    decides SALE_OUT vs print job from it; reading the live product would change that decision if
--    the product's type changed or its variant was deleted after the order was placed.
alter table order_items add column if not exists product_type_snapshot product_type;
update order_items oi set product_type_snapshot = p.product_type
  from product_variants v join products p on p.id = v.product_id
  where v.id = oi.variant_id and oi.product_type_snapshot is null;

--    The rest of the snapshot is immutable too: order lines are never edited after purchase. The one
--    allowed UPDATE is the FK's own `on delete set null` when an OWNER deletes a variant — the line
--    keeps every *_snapshot column, only the live link goes away. (DELETE is left to the orders FK /
--    test cleanup; there is no app path that deletes lines.)
create or replace function prevent_order_item_edit() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.variant_id is null and (to_jsonb(new) - 'variant_id') = (to_jsonb(old) - 'variant_id') then
    return new;
  end if;
  raise exception 'order_items rows are an immutable purchase snapshot' using errcode = '55000';
end; $$;
revoke execute on function prevent_order_item_edit() from public;

drop trigger if exists order_items_no_update on order_items;
create trigger order_items_no_update before update on order_items
  for each row execute function prevent_order_item_edit();

-- 7. Foreign keys used in lookups/deletes without an index (seq scans on every request delete).
create index if not exists print_jobs_order_id_idx on print_jobs (order_id);
create index if not exists print_jobs_custom_request_id_idx on print_jobs (custom_request_id);
create index if not exists print_jobs_spool_id_idx on print_jobs (spool_id);
create index if not exists quotes_pricing_config_id_idx on quotes (pricing_config_id);
create index if not exists products_pricing_config_id_idx on products (pricing_config_id);
create index if not exists mw_screenshot_estimates_request_idx on makerworld_screenshot_estimates (custom_request_id);

-- 8. Duplicate of rate_limit_attempts_window_expires_at_idx (20260901000002) added by Phase 34.
drop index if exists idx_rate_limit_expires_at;
