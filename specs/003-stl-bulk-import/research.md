# Research — 003 STL bulk import

Nguồn dữ kiện: đọc code ngày 2026-10-21 (đường dẫn dưới đây là của repo tại commit `318973f`+). Mỗi mục: **Decision /
Rationale / Alternatives**.

## R1. Đọc kho Drive (D1)

- **Decision**: đọc thư mục local của Google Drive for desktop; không gọi Drive API. Đường dẫn tương đối chuẩn hoá trước
  khi băm: tách theo `path.sep`, nối bằng `/`, Unicode **NFC** (macOS trả tên file dạng NFD), bỏ `./` đầu.
- **Rationale**: tái dùng spike Phase 32 (`scripts/model-library-spike/README.md`: 47,6 MB / ~1M tam giác render 6,5 s).
  Không chuẩn hoá NFC thì cùng một file cho `source_key` khác nhau giữa Mac và Windows → tạo trùng.
- **Alternatives**: Drive API (OAuth, quota theo file) — loại; băm nội dung file (phải đọc lại ~200 GB mỗi lần, và ở chế
  độ *Stream* thì tải toàn bộ kho) — loại cho bản đầu.

## R2. Script chạy bằng `tsx`, dùng lại module thuần của repo (D2)

- **Decision**: `scripts/stl-import/import-stl.ts` chạy bằng `npx tsx` (đã là devDependency). Import trực tiếp các module
  thuần: `src/lib/pricing/mesh-metrics.ts` (`parseStlMetrics`, `MESH_MAX_TRIANGLES = 3_000_000`),
  `src/lib/pricing/fdm-estimate-model.ts` (`estimateFdmPrint`), `src/lib/pricing/makerworld-pricing.ts`
  (`priceMakerWorldLines` → `PricingBreakdown` đầy đủ), `src/services/pricing-config.service.ts`
  (`getCurrentPricingConfig`), `src/lib/db.ts` (`withTransaction`), `src/services/audit.service.ts` (`writeAuditLog`).
  Phần ghi sản phẩm nằm trong service mới `src/services/stl-import-write.service.ts` (SQL thuần, không gọi
  `next/cache`), dùng chung cho script và test.
- **Rationale**: không nhân đôi công thức giá (constitution I, V); các module trên không import `next/*`/`server-only`
  (đã kiểm). `product.service.ts` bọc mọi ghi bằng `invalidatesStorefrontCatalog` (Next cache) nên script không gọi được —
  không cần, vì sản phẩm nhập luôn là DRAFT (không ảnh hưởng storefront); cache chỉ cần làm mới khi duyệt (chạy trong Next).
- **Alternatives**: `.mjs` thuần như spike (phải chép lại `parseStlMetrics` và công thức giá) — loại; đi qua API route
  (giới hạn body 4,5 MB/thời gian chạy Vercel) — loại.

## R3. Ghi DB atomic + Storage (D3 sửa lại)

- **Decision**: **DB ghi qua `pg` + `DATABASE_URL`** trong **một transaction mỗi mẫu** (`withTransaction`). **Storage qua
  supabase-js với `SUPABASE_SERVICE_ROLE_KEY`** (chỉ để upload/xoá ảnh). Cả hai đọc từ `.env.local`
  (`node --env-file`-tương đương qua tsx). Dry-run mặc định; `--apply` mới ghi. Thứ tự mỗi mẫu:
  1. render ảnh (local) → 2. upload ảnh mới → 3. transaction: `select … for update` item → upsert item/product/variant →
  thay `product_images` → audit → commit → 4. sau commit mới xoá object ảnh **cũ**; nếu bước 3 lỗi → xoá ảnh **mới** vừa
  upload (giống `uploadProductImage`, `product.service.ts:197-225`).
- **Rationale**: brief yêu cầu "1 transaction mỗi sản phẩm"; supabase-js không có transaction nhiều câu lệnh. Mẫu
  `pg` + `DATABASE_URL` đã dùng ở `scripts/cleanup-test-data.mjs` và chính app (`src/lib/db.ts`). Xoá ảnh cũ sau commit để
  lỗi giữa chừng không làm mất ảnh đang dùng (FR-013).
- **Chống chạy song song**: `pg_try_advisory_lock(hashtext('stl-import'))` đầu mỗi lần `--apply`; không lấy được → thoát.
- **Alternatives**: RPC Postgres nhận cả mẫu (một hàm plpgsql lớn, khó test, nhân đôi logic) — loại; chỉ supabase-js (không
  atomic) — loại.

## R4. Render ảnh (FR-004)

- **Decision**: mở rộng `scripts/model-library-spike/render-page.html` thành `scripts/stl-import/render-page.html`
  (Playwright chromium + three `STLLoader`, import-map từ `node_modules`). Mặc định **4 góc** (3/4 trước = cover, chính diện,
  cạnh, trên xuống), 1200×1200, nền `#eef1f4`, bóng mềm (contact shadow), màu `--color` mặc định PLA xám `#9aa0a6`,
  WebP q=0.85 qua `canvas.toBlob('image/webp', 0.85)`. Số góc là tham số `--views 4|2` (Q2 có thể đổi). Tuỳ chọn
  `--dims-overlay` vẽ `X × Y × Z mm`. Z-up → Y-up như spike. Tái chế page mỗi 40 mẫu (như spike).
- **Chế độ thư mục (mặc định, Q3=B)**: các part giữ toạ độ gốc trong file (thường đã là cụm lắp hoặc plate). Nếu các
  bbox part chồng lên nhau > 80% thể tích → cảnh báo `PARTS_OVERLAP` (có thể là nhiều mẫu khác nhau trong 1 thư mục).
- **Rationale**: không thêm dependency (three, playwright, fflate đã có).
- **Alternatives**: render bằng three trong Node (cần `gl`/headless-gl — dependency native) — loại.

## R5. Metrics, mesh lỗi, đơn vị

- **Decision**: `parseStlMetrics` (binary + ASCII) cho bbox/thể tích/tam giác; lỗi `MeshMetricsError`
  (`MESH_TOO_LARGE | MESH_EMPTY | MESH_INVALID`) → `render_status = 'ERROR'`, `process_error`, tiếp mẫu khác.
  `checkMeshConsistency` cho mesh không kín → cảnh báo `MESH_NOT_WATERTIGHT` (vẫn tạo nháp). Cảnh báo đơn vị:
  cạnh dài nhất < 5 mm → `UNIT_TOO_SMALL` (nghi inch), > 400 mm → `UNIT_TOO_LARGE`. Lưu ở `warnings jsonb`.
- **Rationale**: spec Edge Cases; ngưỡng là mặc định có thể chỉnh bằng cờ.

## R6. Giá (FR-005, D-giá)

- **Decision**: `estimateFdmPrint({metrics, scalePermille: 1000, infillPct: 15, materialType: 'PLA'})` →
  `priceMakerWorldLines({lines, printMinutes, laborMinutes: 0, config})` với config từ `getCurrentPricingConfig()` và đơn giá
  PLA trung vị (logic như `loadPricingContext`, `instant-estimate.service.ts:134`). Ghi `base_price = finalPriceVnd`,
  `pricing_breakdown`, `pricing_config_id` **cùng một câu lệnh** (CHECK `products_pricing_snapshot_pair`). Variant mặc định
  `price = base_price`. Kết quả `UNPRICED` (ví dụ vượt 256 mm build volume) → `base_price = null`, breakdown/config null,
  cờ `needs_price_review = true` → bị gate chặn tới khi admin nhập giá.
- **Rationale**: Q3 mặc định = cấu hình giá hiện hành; `FDM_MODEL_VERSION = 'fdm-v0-uncalibrated'` nên luôn cần xem lại.

## R7. Tên, slug, SKU, danh mục (FR-006, FR-007)

- **Decision**:
  - Tên: tên thư mục lá (Q3=B) hoặc tên file; bỏ đuôi, bỏ hậu tố `_v\d+`, `final`, `(\d+)`, số thứ tự cuối, thay `_`/`-`
    bằng khoảng trắng, gọn khoảng trắng, cắt ≤ 200 ký tự; tên chỉ có số → tiền tố "Mẫu ".
  - Slug: bỏ dấu (NFD + bỏ dấu kết hợp, `đ→d`), kebab-case, khớp regex `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 160; trùng → `-2`, `-3`
    (kiểm trong DB + trong lô).
  - SKU: `<CAT>-<SLUG>` viết hoa, khớp `^[A-Z0-9]+(-[A-Z0-9]+)*$`, ≤ 40, trùng → hậu tố số. **`categories` không có cột
    `code`** → mã danh mục lấy từ `scripts/stl-import/category-map.json` (`{ "folderPattern": …, "categorySlug": …,
    "skuCode": "FIG" }`); "Chưa phân loại" dùng `skuCode: "UNC"`. SKU **chưa khoá** vì chưa có order/movement; khi admin đổi
    danh mục, SKU không tự đổi (tránh vô tình đổi sau khi có đơn).
  - Danh mục: migration tạo `chua-phan-loai` (`is_active = false`). Storefront hiện **không** lọc `categories.is_active`
    khi liệt kê sản phẩm (`storefront-catalog.service.ts:59`) → bảo vệ bằng gate (R9: không publish khi danh mục là
    "Chưa phân loại").
- **Rationale**: không có generator SKU sẵn (`products/actions.ts:117-129` nhập tay); constraint DB hiện có là nguồn sự thật.

## R8. Idempotent & thay đổi nguồn (D7, FR-010, FR-011)

- **Decision**: `source_key = sha1(normalizedRelPath)` (hex 40) — với chế độ thư mục là đường dẫn thư mục. Fingerprint
  nguồn = danh sách `{relPath, bytes, mtimeMs}` đã sắp xếp. Chạy lại:
  - item chưa có → tạo item + product DRAFT + variant + ảnh.
  - item có, fingerprint không đổi, không `needs_rerender` → bỏ qua.
  - fingerprint đổi hoặc `needs_rerender = true`:
    - `review_status = 'PENDING'` và product DRAFT → render lại ảnh + cập nhật metrics/warnings, đặt
      `needs_price_review = true`; **không** đụng tên/danh mục/giá/giấy phép/mô tả.
    - `review_status = 'APPROVED'` → **không** đổi ảnh/giá/metrics public; chỉ đặt `source_changed_at = now()`.
    - `review_status = 'REJECTED'` → bỏ qua (FR-022).
  - item có nhưng `product_id is null` (product đã bị xoá) và PENDING → tạo product mới, gắn lại.
- Đổi tên/di chuyển file = mẫu mới (giới hạn đã ghi trong spec Assumptions).

## R9. Gate lên web (FR-021) — trigger DB + service

- **Decision**: trigger `BEFORE UPDATE OF status ON products` (và `BEFORE INSERT`) gọi
  `enforce_import_publish_gate()` khi `NEW.status = 'ACTIVE'` và `OLD.status IS DISTINCT FROM 'ACTIVE'`, **chỉ nếu** có
  `product_import_items.product_id = NEW.id`. Điều kiện (tất cả phải đúng):
  1. `review_status = 'APPROVED'` (buộc mọi đường lên web đi qua service duyệt — kể cả `unarchiveProductAction`,
     `PATCH /api/products/[id]`),
  2. `license_reviewed = true`,
  3. có ≥ 1 `product_images` của sản phẩm,
  4. `NEW.base_price > 0` và có ≥ 1 variant `is_active` với `price > 0`,
  5. `NEW.category_id` không null và khác danh mục slug `chua-phan-loai`.
  Vi phạm → `raise exception 'IMPORT_PUBLISH_BLOCKED:<lý do,…>' using errcode = 'P0001'`. Service duyệt
  (`approveImportItems`) **kiểm trước** cùng các điều kiện để trả lý do từng item, rồi trong một transaction đặt
  `review_status = 'APPROVED'` và `products.status = 'ACTIVE'`; trigger là lưới an toàn cuối.
- **Thêm**: trigger trên `product_import_items` (`BEFORE INSERT OR UPDATE OF product_id`) chặn gắn item vào product đang
  ACTIVE trừ khi item đã APPROVED (tránh vòng: tạo product ACTIVE trước rồi gắn item sau).
- **Rationale**: hiện có 5 đường ghi `status` và STAFF gọi được cả 5 (`requireAdmin`) — chặn ở service mới là không đủ
  (constitution I: ràng buộc ở DB khi có thể). Q1 = C: không phân biệt loại giấy phép.
- **Alternatives**: chỉ service layer (vượt được qua trang sửa sản phẩm) — loại; CHECK constraint (không xem được bảng
  khác) — không khả thi.

## R10. `license_type = 'UNKNOWN'` (bổ sung 1) — **cần OWNER chốt ở gate**

- Thực tế: `products.license_type` là `varchar(50)` **không CHECK, cố ý** từ Phase 29 (`src/domain/schemas.ts:126-129`:
  "not enforced by any DB constraint … so new license types don't require a migration").
- **Decision đề xuất**: thêm `'UNKNOWN'` vào `productLicenseTypeSchema` (Zod) + nhãn admin "Chưa xác định"; sản phẩm nhập
  ghi `license_type = 'UNKNOWN'` tường minh; **default cột giữ `OWN_DESIGN`** cho sản phẩm tạo tay. **Không thêm CHECK**
  (giữ quyết định Phase 29), migration của feature chỉ ghi `comment on column` liệt kê giá trị.
- **Phương án B** (nếu OWNER muốn DB chặn): thêm `check (license_type in (…, 'UNKNOWN')) not valid` rồi `validate
  constraint` — đảo quyết định Phase 29, mỗi loại mới cần migration; chi phí thấp nhưng phải ghi vào ADR.

## R11. Phân quyền (bổ sung 3)

- **Decision**: xem trang + sửa nhanh + đánh dấu làm lại ảnh: `requireAdmin()` (OWNER, STAFF). **Duyệt / từ chối:
  `requireOwner()`** (`src/lib/auth/require-admin.ts`, 403 `FORBIDDEN`). Kiểm tra cả trong server action và service
  (service nhận `StaffSession`, tự kiểm role cho duyệt/từ chối).
- Hệ quả spec: FR-016/FR-020 cập nhật "duyệt/từ chối chỉ OWNER" (đã ghi vào spec).

## R12. Optimistic lock theo `updated_at` (bổ sung 4)

- **Decision**: mọi form sửa/duyệt gửi kèm `expectedUpdatedAt` của **item** và của **product**. Service:
  `select … for update`, so sánh `updated_at` dạng **chuỗi microsecond** (`to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
  hoặc `extract(epoch …)::numeric`), **không** đi qua `Date` của JS (mất micro giây → luôn lệch). Lệch → `DomainError
  ('STALE_WRITE', …, 409)`; duyệt hàng loạt báo item đó là `STALE` và tiếp các item khác. `product_import_items` có
  trigger `set_updated_at()`.
- **Rationale**: codebase hiện chỉ dùng khoá bi quan `for update`; optimistic lock chặn "mất thay đổi âm thầm" khi hai người
  sửa cùng thẻ trên hai thiết bị (spec Edge Case "Duyệt đồng thời").
- **Alternatives**: cột `row_version integer` (đơn giản hơn để so sánh) — tốt hơn về kỹ thuật, nhưng OWNER yêu cầu
  `updated_at`; ghi chú lại để xem xét ở review.

## R13. Cảnh báo dung lượng bucket > 800 MB (bổ sung 5)

- **Decision**: hàm service `getBucketUsageBytes('product-images')` = `select coalesce(sum((metadata->>'size')::bigint),0)
  from storage.objects where bucket_id = $1` qua `pg` (mẫu `orphan-upload-cleanup.service.ts:29-40`). Script in cảnh báo
  ở đầu và cuối lần chạy + trong `report.html`, và **dừng `--apply`** nếu ước tính sau lô vượt 950 MB (trừ khi
  `--allow-storage-over`); trang admin hiện banner khi > 800 MB. Ngưỡng là hằng số trong code.
- Test: stub `storage.objects` của `scripts/test-db-setup.ts:67` cần thêm cột `metadata jsonb`.

## R14. Nhật ký kiểm tra (FR-014, FR-024)

- **Decision**: không có actor "system" sẵn; theo tiền lệ (`ORDER_CREATED_PUBLIC`, `CUSTOM_REQUEST_CREATED_PUBLIC`) script
  ghi `actorId: null` với action `STL_IMPORT_ITEM_CREATED | STL_IMPORT_ITEM_RERENDERED | STL_IMPORT_SOURCE_CHANGED`, và
  `after_data.actor = 'system-import'`. Admin: `STL_IMPORT_ITEM_UPDATED | STL_IMPORT_APPROVED | STL_IMPORT_REJECTED |
  STL_IMPORT_RERENDER_REQUESTED` với `actorId` = staff, kèm `PRODUCT_UPDATED` như đường sửa sản phẩm hiện có.

## R15. Không lộ nguồn ra public (FR-027)

- Truy vấn public đều liệt kê cột tường minh (không `select *` trên products — `storefront-catalog.service.ts`), và
  `product_import_items` bật RLS không policy + revoke grant (mẫu `20261012000000`, `20261019000000:13-30`) → anon/
  authenticated không đọc được. Test: HTML `/products`, `/products/[slug]`, `GET /api/products*`, sitemap không chứa
  `source_rel_path`/tên thư mục của dữ liệu seed.

---

## Database review — schema `product_import_items` + trigger (checklist `.agents/skills/database-review`)

Phạm vi: schema trong brief (`docs/prompts/stl-drive-to-draft-products.md` §4) + trigger R9 + migration category/license.

### BLOCKERS

1. **Thiếu trigger `updated_at`** trên `product_import_items` → optimistic lock (R12) không hoạt động. Thêm
   `create trigger product_import_items_set_updated_at before update … execute function public.set_updated_at()`.
2. **Gate chỉ ở service** (brief §4) bị vượt qua bởi 5 đường ghi `products.status` hiện có
   (`products/actions.ts:30,69,102`, `api/products/route.ts`, `api/products/[id]/route.ts`) → dùng trigger R9 (đã đưa vào).
3. **"Một transaction mỗi sản phẩm" không khả thi với supabase-js** → ghi DB qua `pg` (R3).

### IMPORTANT

4. `reviewed_by … on delete restrict`: chặn xoá staff (offboarding) chỉ vì từng duyệt mẫu; lịch sử đã có trong
   `audit_logs`. Đề xuất **`on delete set null`**.
5. `product_id unique … on delete set null`: OK, nhưng phải định nghĩa hành vi khi null (R8: PENDING → tạo lại product;
   REJECTED → bỏ qua). Ghi vào business-rules.
6. Thiếu cột cho FR-011/FR-017/FR-023: thêm `source_dir text not null` (thư mục cha để lọc), `warnings jsonb not null
   default '[]'` (CHECK là mảng), `needs_rerender boolean not null default false`, `source_changed_at timestamptz`,
   `license_reviewed_by uuid … on delete set null`, `license_reviewed_at timestamptz`.
7. CHECK bổ sung: `source_key ~ '^[0-9a-f]{40}$'`; `jsonb_typeof(source_files) = 'array'`; `bbox_mm is null or
   jsonb_typeof(bbox_mm) = 'object'`; `volume_cm3 >= 0`; `triangle_count >= 0`; `(review_status = 'PENDING') =
   (reviewed_by is null and reviewed_at is null)` cho APPROVED/REJECTED phải có người/thời điểm (cho phép reviewed_by null
   sau khi staff bị xoá: dùng `reviewed_at is not null` thay vì cả hai).
8. Index theo truy vấn admin: `(review_status, created_at desc)`, `(render_status)` partial `where render_status =
   'ERROR'`, `(source_dir)`. Tìm theo tên qua `products.name ilike` (≤ ~2.000 dòng — đủ, không cần trigram).
9. Trigger function `language plpgsql set search_path = ''`, tên bảng đầy đủ `public.*`, `revoke execute … from public`
   (mẫu Phase 36). Trigger trên `products` chạy cho **mọi** chuyển sang ACTIVE → phải rẻ: một `select` theo
   `product_import_items.product_id` (unique index sẵn có) rồi thoát sớm nếu không có item.
10. Concurrency duyệt: service khoá `product_import_items` rồi `products` theo **cùng thứ tự** (`order by id`) cho cả lô
    để tránh deadlock khi hai OWNER duyệt hai lô giao nhau; script cũng khoá item trước product.
11. Migration safety: chỉ `create table`, `create function/trigger`, `insert … on conflict do nothing` cho danh mục — không
    khoá bảng `products` lâu (tạo trigger cần `SHARE ROW EXCLUSIVE` ngắn). Không backfill.

### SUGGESTIONS

12. Cân nhắc `row_version integer` thay vì so sánh `updated_at` (R12).
13. `process_error` giới hạn độ dài (ví dụ `left(…, 2000)`) để báo lỗi không phình bảng.
14. Ảnh mồ côi: `orphan-upload-cleanup` hiện dọn bucket custom-request; thêm một kiểm tra định kỳ cho `product-images`
    (object không có dòng `product_images`) — để sau.
15. Kiểm tra không còn product ACTIVE nào mất ảnh sau khi admin xoá ảnh ở trang sản phẩm: gate chỉ ở thời điểm publish —
    chấp nhận, ghi rõ trong business-rules.

Kết luận review: thiết kế trong `data-model.md` đã sửa toàn bộ BLOCKERS và IMPORTANT; còn SUGGESTIONS 12–15 để OWNER chọn.
