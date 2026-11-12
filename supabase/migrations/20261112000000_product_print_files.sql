-- Add internal print file locations (local D:\ path and Google Drive backup URL)
-- on both products and product_variants. Admin-only; never exposed on public storefront queries.

alter table public.products
  add column if not exists print_local_path text,
  add column if not exists print_drive_url text;

alter table public.product_variants
  add column if not exists print_local_path text,
  add column if not exists print_drive_url text;
