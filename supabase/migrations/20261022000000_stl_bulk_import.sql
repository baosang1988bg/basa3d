-- Feature 003 — STL bulk import (specs/003-stl-bulk-import, ADR-0049).
-- Drive STL models become DRAFT products; source metadata lives only in product_import_items
-- (1–1 with the product, never selected by public queries). A trigger on products keeps the
-- publish gate (FR-021) on every write path, not only the new admin page.
-- Additive only: one new table, two trigger functions, one hidden category, one column comment.

-- 1. Staging table ---------------------------------------------------------------------------
create table if not exists public.product_import_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid unique references public.products(id) on delete set null,
  -- sha1 hex of the NFC-normalised, '/'-joined path relative to the import root
  source_key varchar(40) not null unique check (source_key ~ '^[0-9a-f]{40}$'),
  source_rel_path text not null check (btrim(source_rel_path) <> ''),
  source_dir text not null,
  group_mode varchar(8) not null check (group_mode in ('FILE', 'FOLDER')),
  source_files jsonb not null check (jsonb_typeof(source_files) = 'array'),
  source_bytes bigint not null check (source_bytes >= 0),
  source_mtime timestamptz not null,
  bbox_mm jsonb check (bbox_mm is null or jsonb_typeof(bbox_mm) = 'object'),
  volume_cm3 numeric(12, 3) check (volume_cm3 >= 0),
  triangle_count integer check (triangle_count >= 0),
  render_status varchar(16) not null default 'PENDING' check (render_status in ('PENDING', 'RENDERED', 'ERROR')),
  process_error text check (char_length(process_error) <= 2000),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  needs_price_review boolean not null default true,
  needs_rerender boolean not null default false,
  source_changed_at timestamptz,
  license_reviewed boolean not null default false,
  license_reviewed_by uuid references public.staff_profiles(id) on delete set null,
  license_reviewed_at timestamptz,
  review_status varchar(16) not null default 'PENDING' check (review_status in ('PENDING', 'APPROVED', 'REJECTED')),
  -- reviewed_by may become null when the staff profile is deleted; the audit log keeps the history.
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_import_items_review_pair check ((review_status = 'PENDING') = (reviewed_at is null)),
  constraint product_import_items_license_pair check (license_reviewed = (license_reviewed_at is not null))
);

create index if not exists product_import_items_review_created_idx on public.product_import_items (review_status, created_at desc);
create index if not exists product_import_items_source_dir_idx on public.product_import_items (source_dir);
create index if not exists product_import_items_render_error_idx on public.product_import_items (render_status) where render_status = 'ERROR';

drop trigger if exists product_import_items_set_updated_at on public.product_import_items;
create trigger product_import_items_set_updated_at before update on public.product_import_items
  for each row execute function public.set_updated_at();

-- Server-only table (pattern of 20261012000000 / Phase 36): RLS on, no policy, no API-role grant.
alter table public.product_import_items enable row level security;
do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke all on public.product_import_items from %I', api_role);
    end if;
  end loop;
end $$;

-- 2. Hidden "Chưa phân loại" category (models whose folder matches no mapping) ----------------
insert into public.categories (name, slug, sort_order, is_active)
values ('Chưa phân loại', 'chua-phan-loai', 9999, false)
on conflict (slug) do nothing;

-- 3. license_type stays a free varchar (Phase 29 decision, R10 option A); document the values.
comment on column public.products.license_type is
  'OWN_DESIGN | CC_BY | CC0 | COMMERCIAL_LICENSE | OTHER | UNKNOWN (imported models). Validated by Zod (productLicenseTypeSchema), not by a DB constraint.';

-- 4. Publish gate: an imported product only becomes ACTIVE when it is approved, license-reviewed,
--    has an image, a price > 0 and a real category — and while ACTIVE, an edit of its price or
--    category may not break that (security review 2026-10-21). Collects every reason, raises once.
--    Deleting its images/variants after publishing is not covered (accepted, business-rules #28).
create or replace function public.enforce_import_publish_gate() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  item record;
  reasons text[] := array[]::text[];
begin
  select review_status, license_reviewed into item
  from public.product_import_items where product_id = new.id;
  if not found then
    return new;
  end if;
  if item.review_status <> 'APPROVED' then reasons := reasons || 'NOT_APPROVED'::text; end if;
  if not item.license_reviewed then reasons := reasons || 'LICENSE_NOT_REVIEWED'::text; end if;
  if not exists (select 1 from public.product_images where product_id = new.id) then
    reasons := reasons || 'NO_IMAGE'::text;
  end if;
  if new.base_price is null or new.base_price <= 0
     or not exists (select 1 from public.product_variants where product_id = new.id and is_active and price > 0) then
    reasons := reasons || 'NO_PRICE'::text;
  end if;
  -- "Chưa phân loại" is seeded inactive; any inactive category counts (survives a slug rename).
  if new.category_id is null
     or exists (select 1 from public.categories where id = new.category_id and (slug = 'chua-phan-loai' or not is_active)) then
    reasons := reasons || 'UNCATEGORIZED'::text;
  end if;
  if cardinality(reasons) > 0 then
    raise exception 'IMPORT_PUBLISH_BLOCKED:%', array_to_string(reasons, ',') using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists products_import_publish_gate on public.products;
create trigger products_import_publish_gate before insert or update of status, base_price, category_id on public.products
  for each row when (new.status = 'ACTIVE') execute function public.enforce_import_publish_gate();

-- 5. Item side of the gate: an item linked to an ACTIVE product must stay APPROVED and
--    license-reviewed (blocks "create ACTIVE product, then attach a pending item" and un-ticking
--    the license check on a published product).
create or replace function public.enforce_import_item_link() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.product_id is not null
     and (new.review_status <> 'APPROVED' or not new.license_reviewed)
     and exists (select 1 from public.products where id = new.product_id and status = 'ACTIVE') then
    raise exception 'IMPORT_LINK_BLOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists product_import_items_link_gate on public.product_import_items;
create trigger product_import_items_link_gate before insert or update of product_id, review_status, license_reviewed
  on public.product_import_items for each row execute function public.enforce_import_item_link();

revoke execute on function public.enforce_import_publish_gate() from public;
revoke execute on function public.enforce_import_item_link() from public;
