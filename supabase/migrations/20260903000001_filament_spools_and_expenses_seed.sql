-- Phase 12 seed: real data from BaSa3D's "QUẢN LÝ KHO NHỰA" and "CHI TIÊU" Google Sheets
-- (fetched 2026-09-01). All idempotent — safe to re-run.
--
-- Data notes (deviations from the raw sheet, recorded per AGENTS.md "don't silently invent —
-- record the assumption"):
-- - The "CHI TIÊU" sheet actually has 9 expense line items, not 8 as phase-12.md's prose estimated
--   (the total ₫27,184,500 matches the sheet's own total row exactly across all 9 rows).
-- - Two DANH MỤC NHỰA rows have an inconsistent material_type in the raw sheet relative to their
--   own spool-code convention: PLA-M-L-004 was listed as "PLA LITE" (code prefix M = Matte, and
--   every other PLA-M-* row is "PLA MATTE") and PLA-M-L-005 was listed as "PLA MATE" (typo).
--   Both are normalized to "PLA MATTE" here so filtering by Dòng nhựa groups them correctly.
-- - No purchase_cost is recorded per spool in the sheet (GIÁ column is empty for all 27 rows) —
--   left null, same as the "TỔNG KHO" sheet's own empty state (all spools still at 1000g/0 used).
-- - The "Nhựa các loại" expense row has "53k ship" in the Số lượng column instead of a number
--   (an evident data-entry shift — Ghi chú was empty) — treated as quantity 1, note "53k ship".

-- Workshop warehouse — same code ('MAIN') as supabase/seed.sql's dev fixture, so this dedupes
-- naturally whether or not that dev seed has already run.
insert into warehouses (name, code)
values ('Main Workshop', 'MAIN')
on conflict (code) do nothing;

-- Materials has no natural unique constraint (unlike filament_spools.spool_code /
-- expenses.expense_code), so idempotency here is a NOT EXISTS guard rather than ON CONFLICT.
insert into materials (name, material_type, color, unit)
select v.material_type || ' - ' || v.color, v.material_type, v.color, 'GRAM'
from (values
  ('PLA LITE', 'XANH LÁ'),
  ('PLA LITE', 'XANH DƯƠNG NHẠT'),
  ('PLA LITE', 'ĐEN'),
  ('PLA LITE', 'TRẮNG'),
  ('PLA LITE', 'VÀNG'),
  ('PLA LITE', 'ĐỎ'),
  ('PLA LITE', 'CAM'),
  ('PLA MATTE', 'ĐỎ HỒNG'),
  ('PLA MATTE', 'CAM'),
  ('PLA MATTE', 'XANH LÁ'),
  ('PLA R3D', 'CAM'),
  ('PLA R3D', 'HỒNG'),
  ('PETG BASIC', 'XANH DƯƠNG'),
  ('PETG BASIC', 'ĐỎ'),
  ('PETG BASIC', 'TRẮNG'),
  ('PETG BASIC', 'XANH LÁ'),
  ('PLA LITE', 'Be'),
  ('PLA LITE', 'Nâu'),
  ('PLA LITE', 'Xanh Dương'),
  ('PLA LITE', 'Xám đậm'),
  ('PLA LITE', 'Xám'),
  ('PLA MATTE', 'Tím'),
  ('PLA MATTE', 'Yellow'),
  ('PETG BASIC', 'Đen')
) as v(material_type, color)
where not exists (
  select 1 from materials m where m.material_type = v.material_type and m.color = v.color
);

-- Q3 (phase-12.md): the material_movements PURCHASE rows must SELECT from filament_spools'
-- RETURNING clause in one CTE, not be a second independent INSERT — see the migration-contract
-- test for this file. filament_spools.spool_code is unique, so ON CONFLICT DO NOTHING on the first
-- insert means a re-run's RETURNING is empty for already-seeded spools, and the movements insert
-- that follows naturally inserts nothing for them either.
with inserted_spools as (
  insert into filament_spools (spool_code, material_id, warehouse_id, initial_weight_grams, has_spool)
  select v.spool_code, m.id, w.id, v.initial_weight_grams, v.has_spool
  from (values
    ('PLA-L-L-001', 'PLA LITE', 'XANH LÁ', 1000, true),
    ('PLA-L-L-002', 'PLA LITE', 'XANH DƯƠNG NHẠT', 1000, true),
    ('PLA-L-L-003', 'PLA LITE', 'ĐEN', 1000, true),
    ('PLA-L-L-004', 'PLA LITE', 'ĐEN', 1000, true),
    ('PLA-L-L-005', 'PLA LITE', 'TRẮNG', 1000, true),
    ('PLA-L-L-006', 'PLA LITE', 'TRẮNG', 1000, true),
    ('PLA-L-L-007', 'PLA LITE', 'VÀNG', 1000, true),
    ('PLA-L-L-008', 'PLA LITE', 'ĐỎ', 1000, true),
    ('PLA-L-KL-001', 'PLA LITE', 'XANH LÁ', 1000, false),
    ('PLA-L-KL-002', 'PLA LITE', 'CAM', 1000, false),
    ('PLA-M-L-001', 'PLA MATTE', 'ĐỎ HỒNG', 1000, true),
    ('PLA-M-L-002', 'PLA MATTE', 'CAM', 1000, true),
    ('PLA-M-L-003', 'PLA MATTE', 'XANH LÁ', 1000, true),
    ('PLA-R-L-001', 'PLA R3D', 'CAM', 1000, true),
    ('PLA-R-L-002', 'PLA R3D', 'HỒNG', 1000, true),
    ('PETG-B-KL-001', 'PETG BASIC', 'XANH DƯƠNG', 1000, false),
    ('PETG-B-KL-002', 'PETG BASIC', 'ĐỎ', 1000, false),
    ('PETG-B-KL-003', 'PETG BASIC', 'TRẮNG', 1000, false),
    ('PETG-B-KL-004', 'PETG BASIC', 'XANH LÁ', 1000, false),
    ('PLA-L-KL-003', 'PLA LITE', 'Be', 1000, false),
    ('PLA-L-KL-004', 'PLA LITE', 'Nâu', 1000, false),
    ('PLA-L-KL-005', 'PLA LITE', 'Xanh Dương', 1000, false),
    ('PLA-L-KL-006', 'PLA LITE', 'Xám đậm', 1000, false),
    ('PLA-L-L-009', 'PLA LITE', 'Xám', 1000, true),
    ('PLA-M-L-004', 'PLA MATTE', 'Tím', 1000, true),
    ('PLA-M-L-005', 'PLA MATTE', 'Yellow', 1000, true),
    ('PETG-B-L-001', 'PETG BASIC', 'Đen', 1000, true)
  ) as v(spool_code, material_type, color, initial_weight_grams, has_spool)
  join materials m on m.material_type = v.material_type and m.color = v.color
  cross join (select id from warehouses where code = 'MAIN') w
  on conflict (spool_code) do nothing
  returning id, initial_weight_grams, warehouse_id, material_id
)
insert into material_movements (warehouse_id, material_id, spool_id, movement_type, quantity, reference_type, reference_id)
select warehouse_id, material_id, id, 'PURCHASE', initial_weight_grams, 'SEED_MIGRATION', id
from inserted_spools;

insert into expenses (expense_code, title, category, amount, quantity, status, payer_name, spent_at, note)
values
  ('EXP-20260819-001', 'Bambu Lab P2S', 'EQUIPMENT', 20619000, 1, 'PAID', 'Sa', '2026-08-19', null),
  ('EXP-20260819-002', 'Nhựa PLA', 'MATERIAL', 1420000, 7, 'PAID', 'Sa', '2026-08-19', null),
  ('EXP-20260819-003', 'Nhựa PETG', 'MATERIAL', 527000, 3, 'PAID', 'Sa', '2026-08-19', null),
  ('EXP-20260819-004', 'Ổ điện', 'UTILITIES', 586500, 2, 'PAID', 'Sa', '2026-08-19', null),
  ('EXP-20260820-001', 'Nhựa PLA matte', 'MATERIAL', 749000, 3, 'PAID', 'Sa', '2026-08-20', '44k ship'),
  ('EXP-20260821-001', 'Nhựa PLA lite', 'MATERIAL', 1024000, 5, 'PAID', 'Sa', '2026-08-21', '54k ship'),
  ('EXP-20260823-001', 'Nhựa PETG basic', 'MATERIAL', 527000, 4, 'PAID', 'Sa', '2026-08-23', null),
  ('EXP-20260824-001', 'Clicker', 'ACCESSORIES', 134000, 100, 'PAID', 'Sa', '2026-08-24', null),
  ('EXP-20260825-001', 'Nhựa các loại', 'MATERIAL', 1598000, 1, 'PAID', 'Sa', '2026-08-25', '53k ship')
on conflict (expense_code) do nothing;
