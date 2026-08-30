-- Deterministic, non-production seed data. Run after the initial domain migration.
insert into categories (id, name, slug, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Accessories & Gadgets', 'accessories-gadgets', 1),
  ('00000000-0000-4000-8000-000000000002', 'Home Decor', 'home-decor', 2),
  ('00000000-0000-4000-8000-000000000003', 'Figure & Model', 'figure-model', 3);
insert into warehouses (id, name, code) values ('00000000-0000-4000-8000-000000000010', 'Main Workshop', 'MAIN');
insert into materials (id, name, material_type, brand, color, unit, cost_per_spool, spool_weight_grams, current_unit_cost) values
  ('00000000-0000-4000-8000-000000000020', 'PLA Black 1kg', 'PLA', 'Sample', 'Black', 'GRAM', 250000, 1000, 250),
  ('00000000-0000-4000-8000-000000000021', 'PLA White 1kg', 'PLA', 'Sample', 'White', 'GRAM', 250000, 1000, 250),
  ('00000000-0000-4000-8000-000000000022', 'PETG Clear 1kg', 'PETG', 'Sample', 'Clear', 'GRAM', 320000, 1000, 320);
insert into products (id, category_id, name, slug, product_type, status, base_price) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Phone Stand', 'phone-stand', 'READY_STOCK', 'ACTIVE', 99000),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000002', 'Desk Organizer', 'desk-organizer', 'MADE_TO_ORDER', 'ACTIVE', 149000);
insert into product_variants (id, product_id, sku, name, attributes, price, weight_grams) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'ACC-PHONE-STAND-BLK', 'Black', '{"color":"Black"}', 99000, 80),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102', 'DEC-DESK-ORGANIZER-WHT', 'White', '{"color":"White"}', 149000, 180);
insert into carts (id, session_id) values ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000302');
insert into cart_items (cart_id, variant_id, quantity, unit_price_snapshot) values ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', 1, 99000);
insert into orders (id, order_number, cart_id, customer_name, customer_phone, shipping_address, subtotal, shipping_fee, discount, cod_fee, total) values ('00000000-0000-4000-8000-000000000401', 'ORD-DEMO-0001', '00000000-0000-4000-8000-000000000301', 'Demo Customer', '0900000000', '{"city":"Ho Chi Minh City"}', 99000, 20000, 0, 0, 119000);
insert into order_items (order_id, variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total) values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', 'Phone Stand', 'Black', 'ACC-PHONE-STAND-BLK', 1, 99000, 99000);
insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity) values ('00000000-0000-4000-8000-000000000501', 'CR-DEMO-0001', 'ZALO', 'Demo Custom Customer', '0900000001', 'A custom nameplate.', 1);
