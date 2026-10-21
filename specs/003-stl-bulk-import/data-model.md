# Data model — 003 STL bulk import

Thay đổi DB trong **một migration** `supabase/migrations/20261022000000_stl_bulk_import.sql` (tên theo quy ước
`YYYYMMDDHHMMSS_snake.sql`; ngày thật lấy lúc viết). Đã qua database review (research.md §Database review).

## 1. Bảng mới `product_import_items`

| Cột | Kiểu | Ràng buộc / ghi chú |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `product_id` | uuid | `unique`, FK `products(id)` **on delete set null** |
| `source_key` | varchar(40) | `not null unique`, `check (source_key ~ '^[0-9a-f]{40}$')` — sha1 của đường dẫn chuẩn hoá NFC, `/` |
| `source_rel_path` | text | `not null` — **chỉ admin**; file (chế độ file) hoặc thư mục lá (chế độ thư mục) |
| `source_dir` | text | `not null` — thư mục cha tương đối ('' nếu ở gốc), để lọc |
| `group_mode` | varchar(8) | `not null check (group_mode in ('FILE','FOLDER'))` |
| `source_files` | jsonb | `not null`, `check (jsonb_typeof(source_files) = 'array')` — `[{relPath, bytes, mtimeMs}]` sắp xếp |
| `source_bytes` | bigint | `not null check (>= 0)` — tổng |
| `source_mtime` | timestamptz | `not null` — mtime lớn nhất |
| `bbox_mm` | jsonb | `check (bbox_mm is null or jsonb_typeof(bbox_mm) = 'object')` — `{x,y,z}` |
| `volume_cm3` | numeric(12,3) | `check (volume_cm3 >= 0)` |
| `triangle_count` | integer | `check (triangle_count >= 0)` |
| `render_status` | varchar(16) | `not null default 'PENDING' check in ('PENDING','RENDERED','ERROR')` |
| `process_error` | text | ≤ 2.000 ký tự (cắt ở service) |
| `warnings` | jsonb | `not null default '[]'`, `check (jsonb_typeof(warnings) = 'array')` — mã: `UNIT_TOO_SMALL`, `UNIT_TOO_LARGE`, `MESH_NOT_WATERTIGHT`, `PARTS_OVERLAP`, `UNPRICED`, `OVERSIZE_SKIPPED_PART` |
| `needs_price_review` | boolean | `not null default true` |
| `needs_rerender` | boolean | `not null default false` — admin bấm "Làm lại ảnh" |
| `source_changed_at` | timestamptz | đặt khi nguồn đổi sau APPROVED (FR-011) |
| `license_reviewed` | boolean | `not null default false` |
| `license_reviewed_by` | uuid | FK `staff_profiles(id)` **on delete set null** |
| `license_reviewed_at` | timestamptz | |
| `review_status` | varchar(16) | `not null default 'PENDING' check in ('PENDING','APPROVED','REJECTED')` |
| `reviewed_by` | uuid | FK `staff_profiles(id)` **on delete set null** |
| `reviewed_at` | timestamptz | `check ((review_status = 'PENDING') = (reviewed_at is null))` |
| `created_at`, `updated_at` | timestamptz | `not null default timezone('utc', now())`; trigger `set_updated_at()` |

Index: `(review_status, created_at desc)`, `(source_dir)`, partial `(render_status) where render_status = 'ERROR'`.
RLS: `enable row level security`, không policy; `revoke all … from anon, authenticated` (mẫu Phase 36). Thêm vào danh sách
kiểm của `tests/rls-public-tables.test.ts`.

## 2. Danh mục "Chưa phân loại"

`insert into categories (name, slug, sort_order, is_active) values ('Chưa phân loại', 'chua-phan-loai', 9999, false)
on conflict (slug) do nothing;`

## 3. `products` — không thêm cột

- Sản phẩm nhập: `status 'DRAFT'`, `product_type 'MADE_TO_ORDER'`, `license_type 'UNKNOWN'` (ghi tường minh),
  `base_price` + `pricing_breakdown` + `pricing_config_id` cùng câu lệnh (CHECK `products_pricing_snapshot_pair`),
  `description` tự sinh một câu.
- `license_type`: **không thêm CHECK** (R10, phương án A); `comment on column products.license_type` liệt kê giá trị gồm
  `UNKNOWN`. Zod `productLicenseTypeSchema` thêm `'UNKNOWN'`. *(Phương án B — CHECK `not valid` + `validate` — chờ OWNER.)*

## 4. Trigger gate lên web (FR-021)

`public.enforce_import_publish_gate()` — `language plpgsql security invoker set search_path = ''`.

- Gắn: `before insert or update of status on public.products for each row when (new.status = 'ACTIVE')`; trong thân: thoát
  ngay nếu `TG_OP = 'UPDATE' and old.status = 'ACTIVE'` hoặc không có item cho `new.id`.
- Kiểm (gom mọi lý do rồi raise một lần): `NOT_APPROVED` (review_status ≠ APPROVED), `LICENSE_NOT_REVIEWED`,
  `NO_IMAGE`, `NO_PRICE` (base_price null/≤0 hoặc không có variant active price > 0), `UNCATEGORIZED` (category null hoặc
  slug `chua-phan-loai`).
- Lỗi: `raise exception 'IMPORT_PUBLISH_BLOCKED:%', array_to_string(reasons, ',') using errcode = 'P0001';` → service map
  sang `DomainError('IMPORT_PUBLISH_BLOCKED', …, 409)` kèm `reasons[]`.

`public.enforce_import_item_link()` — `before insert or update of product_id on public.product_import_items`: nếu product
đích đang `ACTIVE` và `new.review_status <> 'APPROVED'` → raise `IMPORT_LINK_BLOCKED`.

## 5. Chuyển trạng thái

```
import item:  PENDING ──approve (OWNER, gate ok)──▶ APPROVED      PENDING ──reject (OWNER)──▶ REJECTED
              (render: PENDING → RENDERED | ERROR; needs_rerender → script xử lý → false)
product:      DRAFT ──(cùng transaction với APPROVED)──▶ ACTIVE    DRAFT ──(REJECTED, chỉ từ PENDING)──▶ ARCHIVED
```

- REJECTED → product `ARCHIVED`; lần nhập sau bỏ qua item.
- APPROVED + nguồn đổi → chỉ `source_changed_at`; admin xem lại thủ công.
- Bỏ duyệt (APPROVED → PENDING) **không** thuộc phạm vi; muốn gỡ khỏi web dùng "Ẩn sản phẩm" hiện có (ARCHIVED) — khi đó
  lên lại web phải qua duyệt (trigger yêu cầu APPROVED, vẫn đúng).

## 6. Zod (src/domain/schemas.ts)

- `productLicenseTypeSchema` + `'UNKNOWN'`.
- Mới: `stlImportFilterSchema` (status `PENDING|APPROVED|REJECTED|ERROR`, categoryId, sourceDir, q, page), 
  `stlImportQuickEditSchema` (itemId, productId, expectedItemUpdatedAt, expectedProductUpdatedAt, name, categoryId,
  basePrice (vnd), licenseType, licenseSourceUrl, licenseReviewed), `stlImportBulkDecisionSchema` (items:
  `[{itemId, expectedItemUpdatedAt}]`, 1–100).
