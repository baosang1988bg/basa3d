-- Owner-authorized removal of accumulated integration/E2E/demo fixtures, 2026-09-05.
-- Back up public tables before applying; see docs/operations/test-data-cleanup.md.
-- All statements MUST run in one transaction (migration runner or scripts/cleanup-test-data.mjs).
-- Exact fixture signatures come from tests/, e2e/ and supabase/seed.sql.
-- The fixed cutoff prevents this migration from selecting subsequently created business data.
set local lock_timeout = '10s';
set local statement_timeout = '120s';
lock table public.audit_logs, public.inventory_movements, public.material_movements,
  public.print_jobs, public.quotes, public.order_items, public.orders, public.cart_items,
  public.carts, public.product_images, public.product_variants, public.products,
  public.filament_spools, public.materials, public.warehouses, public.categories,
  public.expenses, public.blog_posts, public.pricing_configs in share row exclusive mode;
create temp table cleanup_targets (table_name text not null, id uuid not null,
  primary key (table_name, id)) on commit drop;

insert into cleanup_targets select 'orders', id from public.orders
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (customer_name in ('Test Customer','Sale Out Test','MTO Test','Cancel Test','Workflow Order','Concurrency Test','Notify Failure Customer','Playwright MTO E2E','Playwright Checkout E2E') or (id='00000000-0000-4000-8000-000000000401' and order_number='ORD-DEMO-0001'));

insert into cleanup_targets select 'custom_requests', id from public.custom_requests
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (customer_name in ('Print Job Material Test','Spool Print Job Test','Test Customer','Nguyen Van Test','Second Material Race','Workflow Test','Quote Accept Test','Pricing Snapshot Pair Test','Pricing Snapshot Immutability Test','Pricing Snapshot Test','Attachment Flow Test','Notify Failure Customer','Phase 17 Integration','E2E Pricing Custom Request','Playwright E2E Visitor') or customer_name ~ '^(Dual Text|Car Nameplate|Keychain|Jigsaw|Hinge Box|Keychain Blocks|Organizer|Lamp Shade) E2E [0-9a-f]{6}$' or (id='00000000-0000-4000-8000-000000000501' and request_number='CR-DEMO-0001'));

insert into cleanup_targets select 'products', id from public.products
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (slug ~ '^(public-order-test|concurrency|sale-out|mto|cancel|active|draft|prod-a|prod-b|featured|regular|draft-featured|pricing-test-product|manual-product|reprice-test-product|notify-failure-test|e2e-new|e2e-product|e2e-pricing-product|e2e-checkout-product|e2e-mto)-[0-9a-f]{8}$' or (id='00000000-0000-4000-8000-000000000101' and slug='phone-stand') or (id='00000000-0000-4000-8000-000000000102' and slug='desk-organizer'));

insert into cleanup_targets select 'materials', id from public.materials
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (name in ('Test PLA','Legacy PLA','Test PETG','Other Material','E2E PLA Test') or (brand='Sample' and id in ('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022')));

insert into cleanup_targets select 'warehouses', id from public.warehouses
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and ((name in ('Test Warehouse','Legacy Warehouse','Cancel Test','Catalog Test Warehouse','E2E Warehouse') and code ~ '^(TEST|LEGACY|CAN|CATTEST|E2E)[A-Za-z0-9]+$'));

insert into cleanup_targets select 'categories', id from public.categories
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (slug ~ '^cat-[ab]-[0-9a-f]{8}$');

insert into cleanup_targets select 'expenses', id from public.expenses
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and ((title in ('Test Equipment','Should be excluded','Soft cancel test') and expense_code ~ '^EXP-(TEST-|TEST-CANCEL-|SOFT-)[0-9A-Fa-f]{8}$'));

insert into cleanup_targets select 'blog_posts', id from public.blog_posts
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (slug ~ '^(draft-post|published-post|publish-then-edit|blog-cover-create-rollback|blog-cover-replace)-[0-9a-f]{8}$');

insert into cleanup_targets select 'carts', id from public.carts
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (id='00000000-0000-4000-8000-000000000301' and session_id='00000000-0000-4000-8000-000000000302');

insert into cleanup_targets select 'product_variants', id from public.product_variants
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (product_id in (select id from cleanup_targets where table_name='products'));

insert into cleanup_targets select 'product_images', id from public.product_images
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (product_id in (select id from cleanup_targets where table_name='products'));

insert into cleanup_targets select 'cart_items', id from public.cart_items
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (cart_id in (select id from cleanup_targets where table_name='carts'));

insert into cleanup_targets select 'order_items', id from public.order_items
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (order_id in (select id from cleanup_targets where table_name='orders'));

insert into cleanup_targets select 'quotes', id from public.quotes
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (custom_request_id in (select id from cleanup_targets where table_name='custom_requests'));

insert into cleanup_targets select 'print_jobs', id from public.print_jobs
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (order_id in (select id from cleanup_targets where table_name='orders') or custom_request_id in (select id from cleanup_targets where table_name='custom_requests'));

insert into cleanup_targets select 'filament_spools', id from public.filament_spools
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (material_id in (select id from cleanup_targets where table_name='materials'));

insert into cleanup_targets select 'inventory_movements', id from public.inventory_movements
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (product_variant_id in (select id from cleanup_targets where table_name='product_variants'));

insert into cleanup_targets select 'material_movements', id from public.material_movements
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (material_id in (select id from cleanup_targets where table_name='materials'));

insert into cleanup_targets select 'pricing_configs', id from public.pricing_configs
where created_at <= '2026-09-05T08:37:53.734Z'::timestamptz and (created_by='00000000-0000-4000-8000-0000000000aa' or id in (select pricing_config_id from quotes where id in (select id from cleanup_targets where table_name='quotes')) or id in (select pricing_config_id from products where id in (select id from cleanup_targets where table_name='products')));

-- Include orphaned audit records from the known automated-test actor, while preserving
-- logs for the retained Walkthrough Expense. No auth users, storage objects or rate limits touched.
insert into cleanup_targets
select 'audit_logs', a.id from public.audit_logs a
where a.created_at <= '2026-09-05T08:37:53.734Z'::timestamptz
  and (exists (select 1 from cleanup_targets t where t.id=a.entity_id)
    or (a.actor_id='00000000-0000-4000-8000-0000000000aa'
      and not exists (select 1 from public.expenses e where e.id=a.entity_id
        and e.title='Walkthrough Expense')));

-- Refuse to mutate ANY retained child, including ON DELETE SET NULL/CASCADE references.
-- Do not expand the deletion set just because a real record references a fixture.
do $$
declare fk record; has_reference boolean;
begin
  for fk in
    select child.relname as child_table, parent.relname as parent_table, a.attname as child_column
    from pg_constraint c
    join pg_class child on child.oid=c.conrelid
    join pg_class parent on parent.oid=c.confrelid
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and child.relnamespace='public'::regnamespace
      and parent.relnamespace='public'::regnamespace
  loop
    execute format('select exists (select 1 from public.%I r
      join cleanup_targets p on p.table_name=%L and p.id=r.%I
      where not exists (select 1 from cleanup_targets t where t.table_name=%L and t.id=r.id))',
      fk.child_table, fk.parent_table, fk.child_column, fk.child_table) into has_reference;
    if has_reference then
      raise exception 'Cleanup refused: retained %.% references selected %',
        fk.child_table, fk.child_column, fk.parent_table;
    end if;
  end loop;
  -- A fixture print job must never have consumed a retained, real material/spool.
  if exists (select 1 from public.material_movements m
    join cleanup_targets j on j.table_name='print_jobs' and j.id=m.reference_id
    where not exists (select 1 from cleanup_targets t where t.table_name='material_movements' and t.id=m.id)) then
    raise exception 'Cleanup refused: test print job affected retained material inventory';
  end if;
end $$;

-- Only these three immutable-history triggers are suspended, inside the locked transaction.
-- FK constraints stay enabled. Failure rolls back both the data and trigger changes.
alter table public.inventory_movements disable trigger inventory_movements_no_update;
alter table public.material_movements disable trigger material_movements_no_update;
alter table public.audit_logs disable trigger audit_logs_no_update;
delete from public.audit_logs where id in (select id from cleanup_targets where table_name='audit_logs');
delete from public.inventory_movements where id in (select id from cleanup_targets where table_name='inventory_movements');
delete from public.material_movements where id in (select id from cleanup_targets where table_name='material_movements');
delete from public.print_jobs where id in (select id from cleanup_targets where table_name='print_jobs');
delete from public.quotes where id in (select id from cleanup_targets where table_name='quotes');
delete from public.custom_requests where id in (select id from cleanup_targets where table_name='custom_requests');
delete from public.order_items where id in (select id from cleanup_targets where table_name='order_items');
delete from public.orders where id in (select id from cleanup_targets where table_name='orders');
delete from public.cart_items where id in (select id from cleanup_targets where table_name='cart_items');
delete from public.carts where id in (select id from cleanup_targets where table_name='carts');
delete from public.product_images where id in (select id from cleanup_targets where table_name='product_images');
delete from public.product_variants where id in (select id from cleanup_targets where table_name='product_variants');
delete from public.products where id in (select id from cleanup_targets where table_name='products');
delete from public.filament_spools where id in (select id from cleanup_targets where table_name='filament_spools');
delete from public.materials where id in (select id from cleanup_targets where table_name='materials');
delete from public.warehouses where id in (select id from cleanup_targets where table_name='warehouses');
delete from public.categories where id in (select id from cleanup_targets where table_name='categories');
delete from public.expenses where id in (select id from cleanup_targets where table_name='expenses');
delete from public.blog_posts where id in (select id from cleanup_targets where table_name='blog_posts');
delete from public.pricing_configs where id in (select id from cleanup_targets where table_name='pricing_configs');
alter table public.inventory_movements enable trigger inventory_movements_no_update;
alter table public.material_movements enable trigger material_movements_no_update;
alter table public.audit_logs enable trigger audit_logs_no_update;
