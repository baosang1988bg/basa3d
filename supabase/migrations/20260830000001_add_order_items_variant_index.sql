-- Supports Available Stock: order_items joined to NEW/CONFIRMED orders by variant.
create index order_items_variant_id_idx on order_items(variant_id);
