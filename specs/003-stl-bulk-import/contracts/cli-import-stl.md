# Contract — CLI `scripts/stl-import/import-stl.ts`

Chạy: `npx tsx --env-file=.env.local scripts/stl-import/import-stl.ts --in "<thư mục kho>" [cờ…]`. Script **không** tự
nạp file env (chỉ đọc `process.env`). Mac + Windows.

## Cờ

| Cờ | Mặc định | Ý nghĩa |
|---|---|---|
| `--in <dir>` | (bắt buộc) | Thư mục gốc kho (Drive for desktop). `source_rel_path` tính tương đối từ đây |
| `--out <dir>` | `./.stl-import` | Ảnh render, `manifest.json`, `report.html` (gitignore) |
| `--group-by folder\|file` | `folder` (Q3=B; đổi được qua `STL_IMPORT_GROUP_BY` hoặc `category-map.json` `"groupBy"`) | Gom theo thư mục lá hay theo file |
| `--limit <n>` | không giới hạn | Số **mẫu** tối đa mỗi lần (chế độ Stream của Drive tải file khi đọc) |
| `--only <glob>` | — | Chỉ xử lý đường dẫn khớp glob (vd `"Figures/**"`) |
| `--views 4\|2` | `4` | Số ảnh mỗi sản phẩm (Q2 đổi được sau) |
| `--color <hex>` | `#9aa0a6` (PLA xám) | Màu vật liệu khi render |
| `--size <px>` | `1200` | Cạnh ảnh |
| `--dims-overlay` | tắt | Thêm ảnh có thước `X × Y × Z mm` |
| `--max-mb <n>` | `300` | Bỏ file lớn hơn (ghi `OVERSIZE_SKIPPED_PART`) |
| `--timeout <s>` | `120` | Thời gian tối đa mỗi mẫu |
| `--retry-errors` | tắt | Xử lý lại các item `render_status = 'ERROR'` |
| `--apply` | tắt (dry-run) | Ghi DB + upload ảnh. Không có cờ này: không kết nối Storage, DB chỉ **đọc** |
| `--allow-storage-over` | tắt | Cho phép `--apply` khi ước tính bucket sau lô > 950 MB |
| `--map <file>` | `scripts/stl-import/category-map.json` | File ánh xạ thư mục → danh mục (thêm khi implement) |
| `--no-render` | tắt | Chạy thử không mở Chromium; không dùng cùng `--apply` (exit 2) |

Cờ lạ → thoát mã 2 kèm danh sách cờ hợp lệ (mẫu `cleanup-test-data.mjs`).

## Biến môi trường

`DATABASE_URL` (đọc/ghi DB qua `pg`), `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (chỉ khi `--apply`, chỉ
upload/xoá ảnh bucket `product-images`). Không in giá trị key ra log.

## Đầu ra

- `manifest.json`: `{ runAt, mode: 'dry-run'|'apply', groupBy, totals: {items, created, rerendered, skipped, errors,
  warnings}, ignoredFiles, avgMsPerItem, bucketUsageBytesBefore, bucketUsageBytesAfterEstimate, items: [{sourceKey, sourceRelPath,
  sourceDir, action: 'CREATE'|'RERENDER'|'SOURCE_CHANGED'|'SKIP'|'ERROR', name, slug, sku, categorySlug, bboxMm, volumeCm3,
  triangles, basePrice|null, warnings[], error|null, images: [file…], ms}] }`.
- `report.html`: lưới ảnh cover kèm "Thư mục nguồn", bộ lọc Lỗi / Có cảnh báo / Nghi sai đơn vị (`UNIT_TOO_*`) /
  Nghi gộp sai (`PARTS_OVERLAP`) + lọc theo thư mục nguồn, thống kê (số mẫu, tỉ lệ lỗi, thời gian TB/mẫu, số file bỏ
  qua), banner dung lượng.
- File nguồn: `.stl` và `.3mf` (một thư mục lá trộn cả hai = một mẫu). `.3mf` chỉ đọc hình học (`3D/**.model`, theo
  `<build>` + transform + đơn vị) rồi đo/render như STL — không dùng ảnh nhúng trong 3MF. 3MF không đọc được → mẫu
  `ERROR` (`process_error`), lô chạy tiếp. File khác bị bỏ qua và chỉ được đếm (`ignoredFiles`).
- Mã thoát: `0` xong (kể cả có item lỗi), `1` lỗi cấu hình/kết nối/khóa advisory đang bị giữ, `2` cờ sai,
  `3` chặn vì dung lượng.

## Bất biến

- Không bao giờ upload file STL/3MF gốc (chỉ `.webp` render).
- `--apply`: mỗi mẫu một transaction; ảnh mới upload trước, xoá ảnh cũ **sau** commit; lỗi → xoá ảnh mới.
- Một tiến trình `--apply` tại một thời điểm (`pg_try_advisory_lock`).
