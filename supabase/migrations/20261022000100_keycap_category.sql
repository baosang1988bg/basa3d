-- Feature 003: "Keycap" product category, the target of the KeyCap3D rule in
-- scripts/stl-import/category-map.json (skuCode KCP). Additive; an existing row (same slug) is left as is.

set local lock_timeout = '5s';

insert into categories (name, slug, is_active)
values ('Keycap', 'keycap', true)
on conflict (slug) do nothing;
