-- Phase 35 (go-live hardening, docs/exec-plans/active/phase-35-golive-hardening.md D7).
-- Idempotent and safe on both hosted Supabase and the plain-PostgreSQL test DB
-- (scripts/test-db-setup.ts stubs storage.buckets with file_size_limit/allowed_mime_types).

-- 1. product-images bucket was only ever created by hand in the dashboard; a fresh Production
--    project would fail every product image upload. Public read is intended (storefront images via
--    getPublicUrl); writes go through the service-role client only. Limits mirror
--    src/services/product.service.ts (ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES = 5 MB).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'product-images';

-- 2. Row-level "before update or delete" triggers do not fire on TRUNCATE, so the immutable
--    ledgers could still be wiped in one statement. Add statement-level TRUNCATE guards.
--    prevent_ledger_mutation() only raises, so it works as a statement trigger too.
drop trigger if exists inventory_movements_no_truncate on inventory_movements;
create trigger inventory_movements_no_truncate before truncate on inventory_movements
  for each statement execute function prevent_ledger_mutation();

drop trigger if exists material_movements_no_truncate on material_movements;
create trigger material_movements_no_truncate before truncate on material_movements
  for each statement execute function prevent_ledger_mutation();

drop trigger if exists audit_logs_no_truncate on audit_logs;
create trigger audit_logs_no_truncate before truncate on audit_logs
  for each statement execute function prevent_ledger_mutation();

drop trigger if exists custom_request_items_no_truncate on custom_request_items;
create trigger custom_request_items_no_truncate before truncate on custom_request_items
  for each statement execute function prevent_ledger_mutation();

-- 3. Pin search_path on our trigger functions (Supabase Security Advisor: function_search_path_mutable).
--    Bodies only use pg_catalog built-ins (now(), timezone(), current_setting()), which are always
--    resolved even with an empty search_path.
alter function set_updated_at() set search_path = '';
alter function prevent_ledger_mutation() set search_path = '';
alter function prevent_custom_request_item_mutation() set search_path = '';

-- 4. Functions default to EXECUTE for PUBLIC. Today there are only trigger functions (not callable
--    via PostgREST), but any future SECURITY DEFINER function would be callable by anon by default.
--    Close it now and for functions created later by this role. Trigger firing does not check
--    EXECUTE, and the app connects as the owner, so nothing in the app path changes.
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke execute on all functions in schema public from %I', api_role);
      execute format('alter default privileges in schema public revoke execute on functions from %I', api_role);
    end if;
  end loop;
end $$;
