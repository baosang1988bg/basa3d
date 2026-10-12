-- Security fix (2026-10-12, Supabase Security Advisor: "RLS Disabled in Public", CRITICAL).
--
-- Supabase publishes every table in the `public` schema through its REST API
-- (https://<project>.supabase.co/rest/v1/<table>) to the `anon` and `authenticated` roles, and the
-- anon key is shipped to every browser (NEXT_PUBLIC_SUPABASE_ANON_KEY). With RLS disabled and
-- Supabase's default grants in place, anyone holding that public key could read — and insert/update/
-- delete — orders, customer PII, quotes, staff_profiles, audit_logs, inventory ledgers, etc.,
-- completely bypassing this app's server-side authorization (AGENTS.md rule #5).
--
-- Why this does not break the app: BaSa3D never reads or writes `public` tables through PostgREST.
-- All table access goes through the server-side `pg` pool (src/lib/db.ts, DATABASE_URL) as the
-- `postgres` role, which owns these tables and bypasses RLS. The Supabase JS client is used only for
-- Auth and Storage (separate schemas, untouched here). So RLS with NO policies = deny-all for
-- `anon`/`authenticated`, and no change for the app.
--
-- Rule for future migrations: every new table in `public` must `enable row level security`
-- (tests/rls-public-tables.test.ts fails otherwise). Add a policy only if a table is ever meant to be
-- read through the Supabase client from the browser — which no table is today.

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;

-- Defense in depth: also remove the API roles' table/sequence privileges, now and for tables created
-- later by this role. Guarded so the migration still applies on a plain PostgreSQL test database
-- (scripts/test-db-setup.ts), where the Supabase roles don't exist.
do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke all on all tables in schema public from %I', api_role);
      execute format('revoke all on all sequences in schema public from %I', api_role);
      execute format('alter default privileges in schema public revoke all on tables from %I', api_role);
      execute format('alter default privileges in schema public revoke all on sequences from %I', api_role);
    end if;
  end loop;
end $$;
