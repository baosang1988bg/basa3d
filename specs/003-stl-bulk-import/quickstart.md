# Quickstart — kiểm chứng 003 STL bulk import

Không chứa code triển khai; xem `contracts/` và `data-model.md` cho chi tiết.

## Chuẩn bị

1. DB test local dùng-một-lần (`TEST_DATABASE_URL`, `TEST_SUPABASE_*`) — **không** dùng DB hosted. `npm run test:db:setup`
   áp migration mới (gồm `stl_bulk_import`).
2. Thư mục mẫu nhỏ trong repo: `tests/fixtures/stl-import/` (STL binary, ASCII, rỗng, hỏng, tên có dấu, tên chỉ có số,
   thư mục nhiều part, file ở gốc). Không dùng file của bên thứ ba.
3. `scripts/stl-import/category-map.json` có ít nhất 1 ánh xạ thư mục → danh mục test.

## Kịch bản

| # | Lệnh / thao tác | Kỳ vọng |
|---|---|---|
| 1 | `npx tsx scripts/stl-import/import-stl.ts --in tests/fixtures/stl-import` | Dry-run: `.stl-import/report.html` có lưới ảnh, file rỗng/hỏng ở mục Lỗi, thống kê tỉ lệ lỗi + ms/mẫu; DB không có dòng mới |
| 2 | Như 1 + `--apply` (env test) | Mỗi mẫu hợp lệ → 1 item PENDING + 1 product DRAFT `MADE_TO_ORDER` + 1 variant + 4 ảnh; 0 `inventory_movements` mới; audit `STL_IMPORT_ITEM_CREATED` |
| 3 | Chạy lại 2 | `created = 0`, `skipped = N`; số dòng không đổi |
| 4 | Sửa tên 1 item trong admin → `touch` file nguồn → chạy lại 2 | Ảnh + metrics mới, tên admin giữ nguyên, `needs_price_review = true` |
| 5 | Duyệt item ở 4 → đổi file nguồn → chạy lại | Ảnh/giá public không đổi; `source_changed_at` có giá trị; badge "Nguồn đã đổi" |
| 6 | Admin: chọn 5 item (2 chưa tick bản quyền) → Duyệt (OWNER) | 3 approved, 2 blocked `LICENSE_NOT_REVIEWED`; 3 sản phẩm hiện ở `/products` + sitemap |
| 7 | STAFF bấm Duyệt / khách gọi action | 403 / 401, không thay đổi |
| 8 | Trang sửa sản phẩm hiện có: đặt status ACTIVE cho sản phẩm nhập chưa duyệt | Bị chặn bởi trigger (`IMPORT_PUBLISH_BLOCKED:NOT_APPROVED,…`) |
| 9 | Hai tab cùng sửa một thẻ, lưu tab 1 rồi tab 2 | Tab 2 nhận `STALE_WRITE` (409), không ghi đè |
| 10 | Giả lập lỗi DB sau upload (test) | Không còn object mới trong bucket |
| 11 | Seed `storage.objects` tổng > 800 MB | Banner trên admin; script in cảnh báo; > 950 MB ước tính → `--apply` thoát mã 3 |

## Kiểm tra tự động

- `npm test`: `tests/stl-import-*.test.ts` (naming/slug/SKU, scan + group-by, fingerprint/idempotent, gate trigger,
  service duyệt/từ chối + quyền + optimistic lock, rollback ảnh, không lộ nguồn, RLS bảng mới, bucket usage).
- `e2e/stl-import.spec.ts`: OWNER duyệt → sản phẩm hiện trên storefront (cần Supabase test — xem rủi ro trong plan).
- `npm run lint`, `npm run typecheck`, `npm run build`.

## Batch thật (OWNER, DoD)

`npx tsx scripts/stl-import/import-stl.ts --in "<Drive>/<thư mục>" --limit 120` → xem `report.html` → thêm `--apply` →
duyệt ≥ 10 mẫu → kiểm `/products`. Hướng dẫn chi tiết ở `docs/operations/runbook.md` (mục mới).
