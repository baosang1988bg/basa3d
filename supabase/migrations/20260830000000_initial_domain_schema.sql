-- Phase 1 initial domain schema. Apply through the Supabase migration runner.
create extension if not exists pgcrypto;

create type product_type as enum ('READY_STOCK', 'MADE_TO_ORDER');
create type product_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
create type order_status as enum ('NEW', 'CONFIRMED', 'PRODUCING', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED');
create type payment_status as enum ('UNPAID', 'DEPOSIT_PAID', 'PAID', 'REFUNDED');
create type shipping_status as enum ('PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED');
create type inventory_movement_type as enum ('PURCHASE', 'PRODUCTION_IN', 'SALE_OUT', 'RETURN_IN', 'DAMAGE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT');
create type material_movement_type as enum ('PURCHASE', 'PRODUCTION_OUT', 'RETURN_IN', 'DAMAGE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');
create type material_unit as enum ('GRAM', 'SPOOL');
create type custom_request_source_channel as enum ('ZALO', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'OTHER');
create type custom_request_status as enum ('NEW', 'REVIEWING', 'NEED_INFO', 'QUOTED', 'APPROVED', 'REJECTED', 'CONVERTED');
create type quote_status as enum ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
create type print_job_status as enum ('QUEUED', 'PRINTING', 'FAILED', 'REPRINT', 'QC', 'COMPLETED', 'CANCELLED');

create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = timezone('utc', now()); return new; end; $$;
create function prevent_ledger_mutation() returns trigger language plpgsql as $$ begin raise exception '% rows are immutable', tg_table_name using errcode = '55000'; end; $$;

create table categories (
  id uuid primary key default gen_random_uuid(), parent_id uuid references categories(id) on delete set null,
  name varchar(160) not null check (btrim(name) <> ''), slug varchar(160) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), description text,
  sort_order integer not null default 0 check (sort_order >= 0), is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table products (
  id uuid primary key default gen_random_uuid(), category_id uuid references categories(id) on delete set null,
  name varchar(200) not null check (btrim(name) <> ''), slug varchar(160) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description varchar(500), description text, product_type product_type not null, status product_status not null default 'DRAFT',
  base_price bigint check (base_price >= 0), cost_price bigint check (cost_price >= 0), is_featured boolean not null default false, is_customizable boolean not null default false,
  seo_title varchar(200), seo_description varchar(500), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references products(id) on delete restrict,
  sku varchar(40) not null unique check (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'), name varchar(200) not null check (btrim(name) <> ''),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'), price bigint not null check (price >= 0), cost_price bigint check (cost_price >= 0),
  weight_grams integer check (weight_grams >= 0), is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references products(id) on delete cascade, variant_id uuid references product_variants(id) on delete cascade,
  storage_path text not null unique check (btrim(storage_path) <> ''), alt_text varchar(200), sort_order integer not null default 0 check (sort_order >= 0), created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table materials (
  id uuid primary key default gen_random_uuid(), name varchar(200) not null check (btrim(name) <> ''), material_type varchar(80) not null check (btrim(material_type) <> ''),
  brand varchar(100), color varchar(100), unit material_unit not null default 'GRAM', cost_per_spool bigint check (cost_per_spool >= 0), spool_weight_grams integer check (spool_weight_grams > 0), current_unit_cost bigint check (current_unit_cost >= 0), is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table warehouses (
  id uuid primary key default gen_random_uuid(), name varchar(160) not null check (btrim(name) <> ''), code varchar(40) not null unique check (code ~ '^[A-Z0-9_]+$'), address text, is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table carts (
  id uuid primary key default gen_random_uuid(), session_id uuid not null unique, status varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE', 'CONVERTED', 'ABANDONED')),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table cart_items (
  id uuid primary key default gen_random_uuid(), cart_id uuid not null references carts(id) on delete cascade, variant_id uuid not null references product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0), unit_price_snapshot bigint not null check (unit_price_snapshot >= 0), selected_options jsonb not null default '{}'::jsonb check (jsonb_typeof(selected_options) = 'object'),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (cart_id, variant_id)
);
create table orders (
  id uuid primary key default gen_random_uuid(), order_number varchar(40) not null unique check (btrim(order_number) <> ''), cart_id uuid unique references carts(id) on delete set null,
  customer_name varchar(200) not null check (btrim(customer_name) <> ''), customer_phone varchar(30) not null check (btrim(customer_phone) <> ''), customer_email varchar(320),
  shipping_address jsonb not null default '{}'::jsonb check (jsonb_typeof(shipping_address) = 'object'), status order_status not null default 'NEW', payment_status payment_status not null default 'UNPAID', shipping_status shipping_status not null default 'PENDING',
  subtotal bigint not null check (subtotal >= 0), shipping_fee bigint not null default 0 check (shipping_fee >= 0), discount bigint not null default 0 check (discount >= 0), cod_fee bigint not null default 0 check (cod_fee >= 0), total bigint not null check (total >= 0 and total = subtotal + shipping_fee + cod_fee - discount),
  customer_note text, admin_note text, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id) on delete restrict, variant_id uuid references product_variants(id) on delete set null,
  product_name_snapshot varchar(200) not null check (btrim(product_name_snapshot) <> ''), variant_name_snapshot varchar(200) not null check (btrim(variant_name_snapshot) <> ''), sku_snapshot varchar(40) not null check (btrim(sku_snapshot) <> ''), attributes_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes_snapshot) = 'object'),
  quantity integer not null check (quantity > 0), unit_price bigint not null check (unit_price >= 0), line_total bigint not null check (line_total = quantity * unit_price), created_at timestamptz not null default timezone('utc', now())
);
create table custom_requests (
  id uuid primary key default gen_random_uuid(), request_number varchar(40) not null unique check (btrim(request_number) <> ''), source_channel custom_request_source_channel not null,
  customer_name varchar(200) not null check (btrim(customer_name) <> ''), customer_phone varchar(30) not null check (btrim(customer_phone) <> ''), customer_email varchar(320), description text not null check (btrim(description) <> ''), quantity integer not null check (quantity > 0), requested_material varchar(100), requested_color varchar(100), requested_size varchar(100), status custom_request_status not null default 'NEW', internal_note text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table quotes (
  id uuid primary key default gen_random_uuid(), custom_request_id uuid not null references custom_requests(id) on delete restrict, quote_number varchar(40) not null unique check (btrim(quote_number) <> ''),
  subtotal bigint not null check (subtotal >= 0), shipping_fee bigint not null default 0 check (shipping_fee >= 0), discount bigint not null default 0 check (discount >= 0), total bigint not null check (total >= 0 and total = subtotal + shipping_fee - discount), valid_until timestamptz not null, status quote_status not null default 'DRAFT', note text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table print_jobs (
  id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete restrict, custom_request_id uuid references custom_requests(id) on delete restrict, quote_id uuid references quotes(id) on delete restrict, material_id uuid references materials(id) on delete restrict,
  printer_name varchar(160), estimated_weight_grams integer check (estimated_weight_grams >= 0), actual_weight_grams integer check (actual_weight_grams >= 0), estimated_print_time_minutes integer check (estimated_print_time_minutes >= 0), actual_print_time_minutes integer check (actual_print_time_minutes >= 0), status print_job_status not null default 'QUEUED', started_at timestamptz, completed_at timestamptz, note text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), check (order_id is not null or custom_request_id is not null)
);
create table inventory_movements (
  id uuid primary key default gen_random_uuid(), warehouse_id uuid not null references warehouses(id) on delete restrict, product_variant_id uuid not null references product_variants(id) on delete restrict, movement_type inventory_movement_type not null, quantity integer not null check (quantity <> 0), unit_cost bigint check (unit_cost >= 0), reference_type varchar(50), reference_id uuid, note text, created_by uuid, created_at timestamptz not null default timezone('utc', now()),
  check ((reference_type is null) = (reference_id is null)), check ((movement_type in ('PURCHASE', 'PRODUCTION_IN', 'RETURN_IN', 'ADJUSTMENT_IN', 'TRANSFER_IN') and quantity > 0) or (movement_type in ('SALE_OUT', 'DAMAGE_OUT', 'ADJUSTMENT_OUT', 'TRANSFER_OUT') and quantity < 0)), check (movement_type not in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT') or (created_by is not null and note is not null and btrim(note) <> ''))
);
create table material_movements (
  id uuid primary key default gen_random_uuid(), warehouse_id uuid not null references warehouses(id) on delete restrict, material_id uuid not null references materials(id) on delete restrict, movement_type material_movement_type not null, quantity integer not null check (quantity <> 0), unit_cost bigint check (unit_cost >= 0), reference_type varchar(50), reference_id uuid, note text, created_by uuid, created_at timestamptz not null default timezone('utc', now()),
  check ((reference_type is null) = (reference_id is null)), check ((movement_type in ('PURCHASE', 'RETURN_IN', 'ADJUSTMENT_IN') and quantity > 0) or (movement_type in ('PRODUCTION_OUT', 'DAMAGE_OUT', 'ADJUSTMENT_OUT') and quantity < 0)), check (movement_type not in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT') or (created_by is not null and note is not null and btrim(note) <> ''))
);
create table audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid, action varchar(100) not null check (btrim(action) <> ''), entity_type varchar(100) not null check (btrim(entity_type) <> ''), entity_id uuid, before_data jsonb, after_data jsonb, created_at timestamptz not null default timezone('utc', now())
);

create index categories_parent_id_idx on categories(parent_id); create index products_category_id_idx on products(category_id); create index products_status_idx on products(status); create index product_variants_product_id_idx on product_variants(product_id); create index product_images_product_id_idx on product_images(product_id, sort_order); create index cart_items_cart_id_idx on cart_items(cart_id); create index orders_status_idx on orders(status); create index orders_created_at_idx on orders(created_at desc); create index order_items_order_id_idx on order_items(order_id); create index custom_requests_status_idx on custom_requests(status); create index quotes_custom_request_id_idx on quotes(custom_request_id); create index print_jobs_status_idx on print_jobs(status); create index inventory_movements_variant_created_at_idx on inventory_movements(product_variant_id, created_at desc); create index inventory_movements_warehouse_created_at_idx on inventory_movements(warehouse_id, created_at desc); create index material_movements_material_created_at_idx on material_movements(material_id, created_at desc); create index audit_logs_entity_idx on audit_logs(entity_type, entity_id, created_at desc);

create trigger categories_set_updated_at before update on categories for each row execute function set_updated_at(); create trigger products_set_updated_at before update on products for each row execute function set_updated_at(); create trigger product_variants_set_updated_at before update on product_variants for each row execute function set_updated_at(); create trigger product_images_set_updated_at before update on product_images for each row execute function set_updated_at(); create trigger materials_set_updated_at before update on materials for each row execute function set_updated_at(); create trigger warehouses_set_updated_at before update on warehouses for each row execute function set_updated_at(); create trigger carts_set_updated_at before update on carts for each row execute function set_updated_at(); create trigger cart_items_set_updated_at before update on cart_items for each row execute function set_updated_at(); create trigger orders_set_updated_at before update on orders for each row execute function set_updated_at(); create trigger custom_requests_set_updated_at before update on custom_requests for each row execute function set_updated_at(); create trigger quotes_set_updated_at before update on quotes for each row execute function set_updated_at(); create trigger print_jobs_set_updated_at before update on print_jobs for each row execute function set_updated_at(); create trigger inventory_movements_no_update before update or delete on inventory_movements for each row execute function prevent_ledger_mutation(); create trigger material_movements_no_update before update or delete on material_movements for each row execute function prevent_ledger_mutation(); create trigger audit_logs_no_update before update or delete on audit_logs for each row execute function prevent_ledger_mutation();
