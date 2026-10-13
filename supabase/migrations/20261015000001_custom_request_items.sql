-- Phase 33 S2 (plan §4B, D2, T4–T7): items of a multi-file custom request, item-linked quotes, and
-- Storage bucket limits for direct (signed URL) uploads. No application code reads/writes
-- custom_request_items yet (that is S5/S7) — only tests and the orphan-upload cron.

-- 4.3 One row per file + configuration + quantity.
create table custom_request_items (
  id uuid primary key default gen_random_uuid(),
  custom_request_id uuid not null references custom_requests(id) on delete restrict,
  position smallint not null check (position between 1 and 10),
  attachment_path text not null unique check (attachment_path ~ '^requests/[0-9a-f-]+\.(stl|obj|3mf)$'),
  display_name varchar(200) not null check (btrim(display_name) <> ''),   -- original file name, display only
  file_size_bytes bigint not null check (file_size_bytes > 0),
  source_kind varchar(10) not null check (source_kind in ('MESH', 'SLICED')),
  material_type varchar(20) not null,
  infill_pct smallint check (infill_pct in (10, 15, 20, 30, 50, 100)),    -- null when SLICED
  scale_permille integer not null default 1000 check (scale_permille between 100 and 10000),
  color varchar(100),
  quantity integer not null check (quantity between 1 and 1000),
  verification varchar(20) not null check (verification in ('VERIFIED', 'CLIENT_REPORTED', 'MISMATCH', 'UNPRICED')),
  estimate_snapshot jsonb not null check (jsonb_typeof(estimate_snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (custom_request_id, position),
  unique (id, custom_request_id),                                          -- target of the composite FK below
  check (source_kind = 'MESH' or (infill_pct is null and scale_permille = 1000))
);
create index custom_request_items_request_idx on custom_request_items(custom_request_id, position);

-- Project rule (20261012000000_enable_rls_public_tables.sql, tests/rls-public-tables.test.ts): every
-- public table has RLS on with no policies — the app reaches it only through the server `pg` pool.
alter table custom_request_items enable row level security;

-- T6: rows are an immutable snapshot of what the customer submitted. UPDATE is always rejected;
-- DELETE only when the session explicitly sets `set local basa3d.allow_item_purge = 'on'` (E2E
-- cleanup, and a future audited personal-data deletion). Normal application code never sets it.
create function prevent_custom_request_item_mutation() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('basa3d.allow_item_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'custom_request_items rows are immutable' using errcode = '55000';
end; $$;
create trigger custom_request_items_immutable before update or delete on custom_request_items
  for each row execute function prevent_custom_request_item_mutation();

-- 4.4 Quote per item (T5). Nullable: MakerWorld / manual quotes have no item. The composite FK is
-- MATCH SIMPLE, so it is skipped while custom_request_item_id is null, and otherwise guarantees the
-- item belongs to the SAME custom request as the quote.
-- Lock impact: ADD COLUMN (nullable, no default) is metadata-only; ADD CONSTRAINT ... FOREIGN KEY
-- validates existing rows, which is trivial because every existing row has a null item id.
alter table quotes add column custom_request_item_id uuid;
alter table quotes add constraint quotes_item_same_request
  foreign key (custom_request_item_id, custom_request_id)
  references custom_request_items(id, custom_request_id) on delete restrict;
create index quotes_custom_request_item_id_idx on quotes(custom_request_item_id);

-- 4.5 Bucket limits (T7/T8) — 50MB, the Supabase Free per-file ceiling. MIME types are declared by
-- the client, so magic bytes are still checked at submit (inspectUploadedObject). The client MUST
-- send the contentType returned by /api/public/custom-requests/upload-urls.
update storage.buckets
  set file_size_limit = 52428800,
      allowed_mime_types = array['model/stl','model/3mf','model/step','application/octet-stream','image/jpeg','image/png','image/webp']
  where id = 'custom-request-attachments';
