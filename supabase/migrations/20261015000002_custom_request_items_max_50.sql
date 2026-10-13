-- Phase 33 (Owner, 2026-10-13): a /bao-gia request may hold up to 50 items (was 10 — customers
-- had to split one order). Replace the inline position check (auto-named
-- custom_request_items_position_check) with a named one; located by definition and fails loudly
-- unless exactly one matches, same pattern as 20261015000000_vat_versioned.sql.
set local lock_timeout = '5s';

do $$
declare
  matches text[];
begin
  select array_agg(conname) into matches
  from pg_constraint
  where conrelid = 'custom_request_items'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%"position" >= 1%"position" <= 10)%';
  if coalesce(array_length(matches, 1), 0) <> 1 then
    raise exception 'expected exactly one custom_request_items position check, found % — inspect \d custom_request_items', coalesce(matches::text, '{}');
  end if;
  execute format('alter table custom_request_items drop constraint %I', matches[1]);
end $$;

alter table custom_request_items add constraint custom_request_items_position_range check (position between 1 and 50);
