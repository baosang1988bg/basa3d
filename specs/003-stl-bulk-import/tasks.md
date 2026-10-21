---

description: "Task list — 003 STL bulk import (Drive → DRAFT products → OWNER duyệt → lên web)"
---

# Tasks: Nhập hàng loạt kho STL thành sản phẩm nháp, duyệt rồi lên web

**Input**: `specs/003-stl-bulk-import/` — plan.md, spec.md, research.md (R1–R15 + Database review), data-model.md,
contracts/cli-import-stl.md, contracts/admin-stl-import.md, quickstart.md.

**Tests**: BẮT BUỘC (constitution IV, spec SC-003..SC-006, DoD exec-plan). Test DB chạy trên Postgres local
`TEST_DATABASE_URL` (`npm run test:db:setup`); test có DB dùng mẫu `const hasDb = Boolean(process.env.DATABASE_URL)` và
`test(..., { skip: !hasDb })` như `tests/phase-36-data-integrity.test.ts`. **Không có Supabase Storage test** → mọi ghi
Storage đi qua interface `ImageStore` (upload/remove) và test dùng bản giả trong bộ nhớ.

**Cấm trong lần chạy này**: `git push`, deploy, migration lên DB hosted, service-role key thật, chạy script với `--apply`
ngoài test, đọc/ghi `.env.local`, upload file STL. Fixture STL tự sinh trong `tests/fixtures/stl-import/`.

**Lát cắt dọc → commit**: mỗi Phase dưới đây kết thúc bằng `npm run lint && npm run typecheck && npm test` xanh rồi một
commit Conventional Commits cục bộ.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1..US4 theo spec.md

---

## Phase 1: Setup

- [X] T001 Thêm `.stl-import/` vào `.gitignore` (thư mục đầu ra mặc định của script, contracts/cli-import-stl.md `--out`)
- [X] T002 [P] Tạo fixture STL tự sinh bằng script `tests/fixtures/stl-import/build-fixtures.ts` (export hàm
  `buildStlFixtures(dir)` ghi: `Figures/Cat/cat-body.stl` + `Figures/Cat/cat-tail.stl` (binary, thư mục nhiều part),
  `Figures/Ếch_xanh_v2.stl` (ASCII, tên có dấu + hậu tố `_v2`), `Tools/12345.stl` (tên chỉ có số), `root-cube.stl` (file ở
  gốc), `Broken/empty.stl` (0 byte), `Broken/garbage.stl` (byte rác), `Tiny/coin.stl` (cạnh < 5 mm → `UNIT_TOO_SMALL`));
  test gọi hàm này vào thư mục tạm (`fs.mkdtemp`), **không** commit file nhị phân lớn

---

## Phase 2: Foundational (chặn mọi user story) — Lát 1 DB + Lát 2 logic thuần

**Lát 1 — DB**

- [X] T003 Viết migration `supabase/migrations/20261022000000_stl_bulk_import.sql` đúng data-model.md §1–§4:
  - bảng `public.product_import_items` với các cột & ràng buộc nguyên văn: `product_id uuid unique references
    public.products(id) on delete set null`; `source_key varchar(40) not null unique check (source_key ~ '^[0-9a-f]{40}$')`;
    `source_rel_path text not null`; `source_dir text not null`; `group_mode varchar(8) not null check (group_mode in
    ('FILE','FOLDER'))`; `source_files jsonb not null check (jsonb_typeof(source_files) = 'array')`; `source_bytes bigint
    not null check (source_bytes >= 0)`; `source_mtime timestamptz not null`; `bbox_mm jsonb check (bbox_mm is null or
    jsonb_typeof(bbox_mm) = 'object')`; `volume_cm3 numeric(12,3) check (volume_cm3 >= 0)`; `triangle_count integer check
    (triangle_count >= 0)`; `render_status varchar(16) not null default 'PENDING' check (render_status in
    ('PENDING','RENDERED','ERROR'))`; `process_error text check (char_length(process_error) <= 2000)`; `warnings jsonb not
    null default '[]' check (jsonb_typeof(warnings) = 'array')`; `needs_price_review boolean not null default true`;
    `needs_rerender boolean not null default false`; `source_changed_at timestamptz`; `license_reviewed boolean not null
    default false`; `license_reviewed_by uuid references public.staff_profiles(id) on delete set null`;
    `license_reviewed_at timestamptz`; `review_status varchar(16) not null default 'PENDING' check (review_status in
    ('PENDING','APPROVED','REJECTED'))`; `reviewed_by uuid references public.staff_profiles(id) on delete set null`;
    `reviewed_at timestamptz`; `check ((review_status = 'PENDING') = (reviewed_at is null))`; `created_at`/`updated_at
    timestamptz not null default timezone('utc', now())`
  - trigger `product_import_items_set_updated_at before update … execute function public.set_updated_at()`
  - index `(review_status, created_at desc)`, `(source_dir)`, partial `(render_status) where render_status = 'ERROR'`
  - `alter table … enable row level security;` không policy; `revoke all on public.product_import_items from anon,
    authenticated;` (mẫu `20261019000000_phase_36_data_integrity.sql`)
  - `insert into public.categories (name, slug, sort_order, is_active) values ('Chưa phân loại','chua-phan-loai',9999,false)
    on conflict (slug) do nothing;` (kiểm tên cột thật của `categories` trước khi viết)
  - `comment on column public.products.license_type` liệt kê `OWN_DESIGN, CC_BY, CC0, COMMERCIAL_LICENSE, OTHER, UNKNOWN`
    (R10 phương án A — **không** CHECK)
  - function `public.enforce_import_publish_gate()` (`language plpgsql security invoker set search_path = ''`), trigger
    `products_import_publish_gate before insert or update of status on public.products for each row when (new.status =
    'ACTIVE')`; thoát sớm nếu `TG_OP='UPDATE' and old.status='ACTIVE'` hoặc không có item; gom lý do
    `NOT_APPROVED, LICENSE_NOT_REVIEWED, NO_IMAGE, NO_PRICE, UNCATEGORIZED` rồi
    `raise exception 'IMPORT_PUBLISH_BLOCKED:%', array_to_string(reasons, ',') using errcode = 'P0001'`
  - function + trigger `public.enforce_import_item_link()` `before insert or update of product_id on
    public.product_import_items`: product đích `ACTIVE` và `new.review_status <> 'APPROVED'` → `IMPORT_LINK_BLOCKED`
  - `revoke execute on function … from public` cho cả hai function
- [X] T004 [P] Thêm cột `metadata jsonb` vào stub `storage.objects` trong `scripts/test-db-setup.ts` (tạo mới có cột; DB
  stub đã có thì `alter table storage.objects add column if not exists metadata jsonb` khi bảng mang comment stub)
- [X] T005 [P] Zod trong `src/domain/schemas.ts`: thêm `'UNKNOWN'` vào `productLicenseTypeSchema` (cập nhật comment Phase
  29); thêm `stlImportFilterSchema` (`status: 'PENDING'|'APPROVED'|'REJECTED'|'ERROR'` mặc định `PENDING`, `categoryId?`
  uuid, `sourceDir?` ≤ 1000, `q?` ≤ 200, `page` int ≥ 1), `stlImportQuickEditSchema` (`itemId`, `productId`,
  `expectedItemUpdatedAt`, `expectedProductUpdatedAt` dạng chuỗi µs `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$`, `name`
  ≤ 200, `categoryId` uuid|null, `basePrice` vnd|null, `licenseType`, `licenseSourceUrl` url|null, `licenseReviewed`
  boolean; `.strict()`), `stlImportBulkDecisionSchema` (`items: [{itemId, expectedItemUpdatedAt}]` min 1 max 100);
  thêm nhãn "Chưa xác định" cho `UNKNOWN` ở nơi admin map nhãn license (grep `COMMERCIAL_LICENSE` trong `src/`)
- [X] T006 Test DB cho migration trong `tests/stl-import-gate.test.ts`: (a) CHECK/unique của bảng (source_key sai định
  dạng, cặp review_status/reviewed_at), (b) `updated_at` tự tăng, (c) danh mục `chua-phan-loai` tồn tại `is_active=false`,
  (d) gate trigger: product nhập chuyển ACTIVE bị chặn với **từng** lý do riêng và gom nhiều lý do; product **không** có
  item chuyển ACTIVE bình thường; ACTIVE→ACTIVE không chạy gate; insert thẳng ACTIVE + gắn item PENDING bị
  `IMPORT_LINK_BLOCKED`; (e) mọi đường ghi status hiện có — gọi service/action cập nhật sản phẩm hiện có (đọc
  `src/app/admin/(protected)/products/actions.ts` và `src/app/api/products/[id]/route.ts` để chọn hàm service dùng chung)
  cho sản phẩm nhập chưa duyệt → bị chặn
- [X] T007 [P] Cập nhật `tests/rls-public-tables.test.ts` (nếu có danh sách bảng tường minh) và/hoặc
  `tests/migration-contract.test.ts` để bao gồm `product_import_items` (RLS bật, anon/authenticated không có grant)

**Lát 2 — logic thuần** (không import `next/*`, `server-only`, DB)

- [X] T008 [P] `src/lib/stl-import/source-key.ts`: `normalizeRelPath(rel)` (tách `\`/`/`, nối `/`, NFC, bỏ `./` đầu),
  `sourceKey(rel) = sha1 hex 40`, `fingerprint(files)` (sắp xếp `{relPath, bytes, mtimeMs}`, so sánh ổn định) +
  `tests/stl-import-source-key.test.ts` (NFD vs NFC cùng key, `\` vs `/` cùng key, fingerprint đổi khi bytes/mtime đổi)
- [X] T009 [P] `src/lib/stl-import/naming.ts`: `displayName`, `slugify`, `uniqueSlug(base, taken)`, `buildSku(catCode,
  slug, taken)` theo research R7 (bỏ `_v\d+`, `final`, `(\d+)`, số thứ tự cuối; tên chỉ số → "Mẫu …"; tên ≤ 200; slug khớp
  `^[a-z0-9]+(-[a-z0-9]+)*$` ≤ 160, `đ→d`; SKU khớp `^[A-Z0-9]+(-[A-Z0-9]+)*$` ≤ 40, trùng → hậu tố `-2`, `-3`) +
  `describeModel(bbox)` ("Mẫu in 3D, kích thước X × Y × Z mm") + `tests/stl-import-naming.test.ts` (mọi edge case tên ở spec)
- [X] T010 [P] `src/lib/stl-import/scan.ts`: `groupModels(files, mode: 'FOLDER'|'FILE', opts {maxBytes, only?})` thuần
  trên danh sách `{relPath, bytes, mtimeMs}` → `[{sourceRelPath, sourceDir, groupMode, files, oversizeSkipped[]}]`; file ở
  gốc ở chế độ FOLDER thành mẫu riêng; `walkDir(root)` (fs đệ quy, chỉ `.stl`, tuỳ chọn `.3mf`) tách riêng; glob `--only`
  dùng `path.matchesGlob` nếu Node hỗ trợ, nếu không thì so khớp `**`/`*` tự viết +
  `tests/stl-import-scan.test.ts`
- [X] T011 [P] `src/lib/stl-import/category-map.ts`: đọc/validate (Zod) `scripts/stl-import/category-map.json`
  (`{groupBy?: 'folder'|'file', rules: [{folderPattern, categorySlug, skuCode}]}`) và `resolveCategory(sourceDir)` → rule
  khớp đầu tiên theo đoạn thư mục, mặc định `{categorySlug:'chua-phan-loai', skuCode:'UNC'}` + test trong
  `tests/stl-import-naming.test.ts`
- [X] T012 [P] `src/lib/stl-import/metrics.ts`: `analyzeModel(buffers)` gộp `parseStlMetrics` (`src/lib/pricing/mesh-metrics.ts`)
  nhiều part → bbox tổng, thể tích tổng, tam giác tổng, `warnings` (`UNIT_TOO_SMALL` < 5 mm, `UNIT_TOO_LARGE` > 400 mm,
  `MESH_NOT_WATERTIGHT` qua `checkMeshConsistency` nếu có, `PARTS_OVERLAP` khi bbox part chồng > 80%); lỗi
  `MeshMetricsError` → `{error}` không throw ra ngoài + `tests/stl-import-metrics.test.ts` (dùng fixture T002)
- [X] T013 [P] `src/lib/stl-import/pricing.ts`: `estimateImportPrice(metrics, config, plaUnitCost)` → `estimateFdmPrint`
  + `priceMakerWorldLines` (R6: infill 15, PLA, scale 1000, laborMinutes 0) → `{basePrice, breakdown, configId}` hoặc
  `{unpriced: true}` + test (đọc chữ ký thật của hai hàm trước khi viết)
- [X] T014 Commit Lát 1+2: `feat(stl-import): schema, publish gate trigger, pure import logic` (sau lint/typecheck/test xanh;
  có thể tách 2 commit `feat(db)` và `feat(stl-import)`)

**Checkpoint**: migration + gate + logic thuần có test → các story bắt đầu được.

---

## Phase 3: User Story 1 — Nhập một lô mẫu thành sản phẩm nháp (P1) 🎯 MVP

**Goal**: script dry-run tạo report; `--apply` tạo item + product DRAFT + variant + ảnh, idempotent, rollback ảnh.

**Independent Test**: chạy script trên fixture → report, DB không đổi; gọi service ghi (test, ImageStore giả) → nháp có ảnh,
chạy lại không trùng, lỗi giữa chừng không để ảnh mồ côi.

**Lát 3 — service ghi từ script**

- [X] T015 [US1] `src/services/stl-import-write.service.ts` (không import `next/*`): kiểu `ImageStore { upload(path, bytes,
  contentType); remove(paths[]) }`; `importModel(client|pool, store, model, ctx)` theo R3/R8: render bytes đã có → upload ảnh
  mới `product-images/{productId}/{uuid}.webp` → `withTransaction`: `select … for update` item theo `source_key` → nhánh
  CREATE (insert product `status 'DRAFT'`, `product_type 'MADE_TO_ORDER'`, `license_type 'UNKNOWN'`, `base_price` +
  `pricing_breakdown` + `pricing_config_id` **cùng câu lệnh**, description từ `describeModel`; 1 variant `price = base_price`
  (0 nếu unpriced — kiểm CHECK `price >= 0`), `product_images` sort 0..n, item `render_status 'RENDERED'`) / SKIP
  (fingerprint không đổi và `needs_rerender=false`, hoặc REJECTED) / RERENDER (PENDING + DRAFT: thay ảnh, metrics,
  warnings, `needs_price_review=true`, `needs_rerender=false`, **không** đụng name/category/price/license/description) /
  SOURCE_CHANGED (APPROVED: chỉ `source_changed_at = now()`, không upload) / ERROR (`render_status 'ERROR'`,
  `process_error = left(msg, 2000)`); `product_id` null + PENDING → tạo lại product; audit `actorId null`, action
  `STL_IMPORT_ITEM_CREATED|STL_IMPORT_ITEM_RERENDERED|STL_IMPORT_SOURCE_CHANGED`, `after_data.actor='system-import'`;
  commit xong mới `store.remove(ảnh cũ)`; transaction lỗi → `store.remove(ảnh mới)` rồi ném lại; **không** ghi
  `inventory_movements`. Slug/SKU duy nhất: kiểm cả DB lẫn tập đã dùng trong lô. Nhận diện SKIP cần biết trước khi
  render → tách `planModel()` (đọc item, trả action) và `applyModel()`
- [X] T016 [US1] `src/services/storage-usage.service.ts`: `getBucketUsageBytes(bucket)` = `select coalesce(sum((metadata->>
  'size')::bigint),0) from storage.objects where bucket_id = $1`; hằng `STORAGE_WARN_BYTES = 800*1024**2`,
  `STORAGE_BLOCK_BYTES = 950*1024**2`
- [X] T017 [US1] `tests/stl-import-write.test.ts` (DB + ImageStore giả): CREATE tạo đúng 1 product DRAFT/MADE_TO_ORDER/
  UNKNOWN + 1 variant + N ảnh + 0 movement + audit; chạy lại = SKIP, số dòng không đổi (SC-005); slug trùng → `-2`;
  unpriced → base_price null, cặp pricing null, `needs_price_review`; lỗi trong transaction (ép bằng product slug vi phạm
  hoặc hook test) → ảnh mới đã bị `remove`, không còn dòng nào (SC-006); bucket usage đọc từ stub `storage.objects`

**Lát 4 — script CLI**

- [X] T018 [P] [US1] `scripts/stl-import/render-page.html` mở rộng từ `scripts/model-library-spike/render-page.html`: nhận
  nhiều part, `views` 4|2 (3/4 trước = cover, chính diện, cạnh, trên), 1200 px, nền `#eef1f4`, bóng mềm, màu `--color`,
  xuất WebP q 0.85, tuỳ chọn overlay kích thước
- [X] T019 [P] [US1] `scripts/stl-import/render.ts`: điều khiển Playwright chromium mở `render-page.html` (mẫu
  `generate-previews.mjs`), tái chế page mỗi 40 mẫu, timeout mỗi mẫu; trả `Buffer[]` WebP
- [X] T020 [P] [US1] `scripts/stl-import/report.ts` (HTML sinh trực tiếp + escape, không tách file template): ghi `manifest.json` đúng
  schema contracts/cli-import-stl.md và `report.html` (lưới cover, lọc lỗi/cảnh báo, thống kê số mẫu, tỉ lệ lỗi, ms TB/mẫu,
  banner dung lượng); escape HTML mọi chuỗi từ tên file
- [X] T021 [US1] `scripts/stl-import/import-stl.ts` CLI theo contracts/cli-import-stl.md: parse cờ (cờ lạ → exit 2), đọc
  `category-map.json`, `walkDir` → `groupModels` → `analyzeModel` → `estimateImportPrice` → `planModel` (DB chỉ đọc khi
  dry-run; bỏ qua DB nếu không có `DATABASE_URL`) → render (bỏ qua SKIP) → report; `--apply`: `pg_try_advisory_lock
  (hashtext('stl-import'))` (không lấy được → exit 1), kiểm dung lượng (> 950 MB ước tính và không `--allow-storage-over`
  → exit 3), tạo `ImageStore` supabase-js service-role (chỉ ở nhánh apply, không log key), `applyModel` từng mẫu; in cảnh
  báo > 800 MB đầu/cuối. Không đọc file nào ngoài `--in`; không upload STL. Thêm cờ `--no-render` để test nhanh không cần
  chromium. **Script KHÔNG tự nạp `.env`/`.env.local`** (không gọi `@next/env`/dotenv): OWNER chạy
  `npx tsx --env-file=.env.local scripts/stl-import/import-stl.ts …`; nếu `BASA3D_TEST_ENVIRONMENT=isolated` mà
  `DATABASE_URL` không phải localhost → exit 1 (chặn test chạm DB hosted — analyze H1)
- [X] T022 [P] [US1] `scripts/stl-import/category-map.json` (mẫu, `groupBy: 'folder'`, vài rule) + `scripts/stl-import/README.md`
- [X] T023 [US1] `tests/stl-import-cli.test.ts`: chạy CLI (child process `tsx`) dry-run `--no-render` trên fixture T002 với
  env DB trống → exit 0, manifest có đúng số mẫu, mẫu hỏng ở `ERROR` không làm dừng lô, `UNIT_TOO_SMALL` có mặt; cờ lạ →
  exit 2; `--apply` không có `DATABASE_URL` → exit 1 (không bao giờ chạy apply thật); child process luôn chạy với env
  tường minh `{ DATABASE_URL: '', BASA3D_TEST_ENVIRONMENT: 'isolated', PATH }` (không kế thừa key); assert mọi path
  ImageStore nhận được trong `tests/stl-import-write.test.ts` đều đuôi `.webp` (FR-012)
- [X] T024 [US1] Commit Lát 3+4: `feat(stl-import): script write service and import CLI` (lint/typecheck/test xanh)

**Checkpoint**: MVP nhập nháp chạy được trên fixture.

---

## Phase 4: User Story 2 — Duyệt hàng loạt để lên web (P1)

**Goal**: trang `/admin/stl-import`: sửa nhanh (OWNER+STAFF, optimistic lock), duyệt/từ chối (OWNER) với lý do bị chặn.

**Independent Test**: seed 5 item (2 chưa tick bản quyền) → OWNER duyệt → 3 ACTIVE, 2 blocked; STAFF → 403; hai lần sửa
cùng `expectedUpdatedAt` → lần hai `STALE_WRITE`.

**Lát 5 — admin**

- [X] T025 [US2] `src/services/stl-import.service.ts`: `listImportItems(session, filter)` (contract §Đọc; `updated_at` trả
  dạng chuỗi µs `to_char(… at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, 24/trang, cover = ảnh sort nhỏ nhất,
  `bucketUsageBytes`); `quickEditImportItem(session, input)` (yêu cầu role OWNER|STAFF; `for update` item rồi product;
  so khớp chuỗi µs → `DomainError('STALE_WRITE', …, 409)`; đổi giá → `base_price` + `pricing_breakdown=null` +
  `pricing_config_id=null` + variant mặc định `price`, `needs_price_review=false`; tick bản quyền → `license_reviewed_by/at`;
  với item **APPROVED** từ chối (409 `IMPORT_APPROVED_LOCKED`) việc bỏ tick bản quyền, đặt danh mục `chua-phan-loai`/null,
  hoặc giá null/0 (giữ điều kiện gate sau khi lên web — analyze M2);
  audit `STL_IMPORT_ITEM_UPDATED` + `PRODUCT_UPDATED`); `approveImportItems(session, input)` (**tự kiểm** `role === 'OWNER'`
  → 403; sắp items theo id; mỗi item 1 transaction; kiểm trước `NOT_PENDING|STALE|NOT_RENDERED|LICENSE_NOT_REVIEWED|
  NO_IMAGE|NO_PRICE|UNCATEGORIZED`; hợp lệ → item APPROVED + `reviewed_by/at` **trước**, rồi product ACTIVE; bắt lỗi
  `P0001 IMPORT_PUBLISH_BLOCKED:` → đưa vào `blocked`; audit `STL_IMPORT_APPROVED`); `rejectImportItems` (OWNER; **chỉ item PENDING** —
  APPROVED → `NOT_PENDING` theo contract; item REJECTED + product ARCHIVED; audit `STL_IMPORT_REJECTED`). Map lỗi trigger dùng chung: `parsePublishBlocked(error)` export
  từ service này
- [X] T026 [US2] `src/app/admin/(protected)/stl-import/actions.ts` (`'use server'`): `quickEditImportItemAction`,
  `approveImportItemsAction`, `rejectImportItemsAction` — `requireAdmin()`/`requireOwner()` trước, Zod parse, gọi service,
  trả kết quả theo contract. Làm mới cache: service gọi `invalidateStorefrontCatalog()`
  (`src/lib/cache/storefront-cache-tags.ts`) **sau commit** khi có item duyệt/từ chối (mẫu ADR-0045), không gọi
  `revalidateTag` ở action
- [X] T027 [US2] `src/app/admin/(protected)/stl-import/page.tsx` (server, `requireAdmin()`) + `import-grid.tsx` (client,
  shadcn/ui có sẵn): lưới 1 cột mobile / 2 sm / 3–4 lg, thẻ có cover `next/image`, tên, danh mục, kích thước, giá, badge cờ
  (lỗi, cần xem giá, chưa kiểm bản quyền, nguồn đã đổi, nghi sai đơn vị, license NC/UNKNOWN nổi bật), sửa nhanh inline,
  chọn nhiều + nút Duyệt/Từ chối (ẩn với STAFF nhưng server vẫn kiểm), hiển thị danh sách bị chặn + lý do tiếng Việt,
  thông báo "dữ liệu đã thay đổi" khi `STALE_WRITE`, banner > 800 MB, `source_rel_path` hiển thị cho admin; nút ≥ 44 px
- [X] T028 [P] [US2] Thêm mục "Kho nhập STL" vào `src/components/admin/admin-nav.tsx`
- [X] T029 [P] [US2] `src/app/admin/(protected)/products/*`: khi lưu/unarchive sản phẩm bị trigger chặn, hiển thị lỗi
  dễ hiểu (dùng `parsePublishBlocked`) thay vì lỗi 500 — sửa ở service/route dùng chung để `PATCH /api/products/[id]` trả
  409 `IMPORT_PUBLISH_BLOCKED` kèm `reasons`
- [X] T030 [US2] `tests/stl-import-admin.test.ts` (DB): STAFF approve/reject → `FORBIDDEN` 403, STAFF quick-edit OK; action
  khi chưa đăng nhập → 401 (theo mẫu `tests/phase-3-route-auth.test.ts`/`phase-28-admin-actions.test.ts`); bulk 5 item (2
  chưa tick) → 3 approved, 2 blocked `LICENSE_NOT_REVIEWED`; 10 item với 3 lỗi khác loại → 7/3; optimistic lock: hai
  quickEdit cùng `expectedItemUpdatedAt` → lần 2 `STALE_WRITE` và dữ liệu lần 1 giữ nguyên; reject → product ARCHIVED +
  lần import sau SKIP; audit có đủ action; unarchive sản phẩm nhập ARCHIVED chưa APPROVED bị chặn
- [X] T031 [US2] `tests/stl-import-public-exposure.test.ts`: với item APPROVED có `source_rel_path` đặc trưng, gọi
  service/route public (storefront catalog, product detail, sitemap, `GET /api/products*` — kiểm thực tế route nào public)
  → không chứa `source_rel_path`, `source_dir`, `review_status`; anon role không `select` được `product_import_items` (SC-004);
  sản phẩm APPROVED xuất hiện trong sitemap/danh sách (FR-026)
- [X] T032 [US2] Commit Lát 5: `feat(admin): STL import review page with owner-only approval`

---

## Phase 5: User Story 3 — Lọc, tìm và xử lý mẫu có vấn đề (P2)

- [X] T033 [US3] Trong `src/services/stl-import.service.ts`: `requestRerender(session, {itemId, expectedItemUpdatedAt})`
  (OWNER|STAFF, optimistic lock, `needs_rerender = true`, audit `STL_IMPORT_RERENDER_REQUESTED`) + action
  `requestRerenderAction` trong `actions.ts` + nút "Làm lại ảnh" trong `import-grid.tsx`
- [X] T034 [US3] Bộ lọc trạng thái (ERROR = `render_status 'ERROR'`), danh mục, thư mục nguồn, tìm tên `ilike`, phân trang
  (`src/components/admin/admin-pagination.tsx`, `status-filter-tabs.tsx`) trong `page.tsx`; filter qua `searchParams` +
  `stlImportFilterSchema`
- [X] T035 [US3] Test trong `tests/stl-import-admin.test.ts`: lọc ERROR/danh mục/sourceDir/q trả đúng tập + phân trang;
  `needs_rerender` → `planModel` trả RERENDER, sau `applyModel` ảnh/metrics mới, tên/giá/license admin giữ nguyên, cờ về false
- [X] T036 [US3] Commit: gộp vào commit lát 5 `feat(admin): STL import review page…` (lọc + làm lại ảnh làm cùng lúc)

---

## Phase 6: User Story 4 — File gốc thay đổi sau khi đã nhập (P2)

- [X] T037 [US4] Test trong `tests/stl-import-write.test.ts`: DRAFT đã sửa tên → đổi fingerprint → RERENDER giữ tên/danh
  mục/giá/license/mô tả, cập nhật ảnh + metrics; APPROVED → đổi fingerprint → SOURCE_CHANGED, ảnh/giá/status không đổi,
  `source_changed_at` có giá trị, không upload ảnh (FR-011)
- [X] T038 [US4] (đã có từ T027) Badge "Nguồn đã đổi — cần xem lại" trong `import-grid.tsx` khi `sourceChangedAt` khác null; sửa
  `stl-import-write.service.ts` nếu T037 lộ lỗi
- [X] T039 [US4] Commit: `test(stl-import): source change keeps admin edits and public data`

---

## Phase 7: Polish, review & docs

- [X] T040 [P] (viết xong, **chưa chạy**: máy không có Supabase test) `e2e/stl-import.spec.ts`: OWNER đăng nhập → `/admin/stl-import` → tick bản quyền + duyệt 1 item seed → thấy
  ở `/products` (theo mẫu `e2e/copyright-compliance.spec.ts`; chỉ chạy khi có Supabase test — ghi rõ skip)
- [X] T041 Chạy skill `database-review` trên migration + trigger + `stl-import-write.service.ts` + `stl-import.service.ts`;
  sửa mọi BLOCKER; ghi kết quả vào `specs/003-stl-bulk-import/research.md` (mục "Database review — implementation")
- [X] T042 Chạy skill `security-review` (quyền action/service, RLS, không lộ nguồn, service-role chỉ ở script, XSS trong
  report.html, path traversal khi đọc `--in`, Zod biên); sửa BLOCKER; ghi kết quả vào research.md
- [X] T043 [P] Docs: ADR-0049 → *Accepted* trong `docs/architecture/decisions.md`; `docs/database/business-rules.md` (gate
  lên web hàng nhập, idempotent/đổi nguồn, REJECTED không tạo lại, UNKNOWN, OWNER-only duyệt, gate chỉ tại thời điểm
  publish — SUGGESTION 15); `docs/database/schema.md`, `docs/database/migrations.md`; `docs/operations/runbook.md` (chạy
  batch, dry-run trước, apply migration); `docs/roadmap.md`; exec-plan `docs/exec-plans/active/feature-003-stl-bulk-import.md`
  (tick DoD đã đạt)
- [X] T044 Cổng cuối: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; E2E `e2e/stl-import.spec.ts`,
  `e2e/admin.spec.ts`, `e2e/copyright-compliance.spec.ts` nếu môi trường có Supabase test (nếu không: ghi rõ chưa chạy); commit `docs(stl-import): ADR-0049,
  business rules, runbook`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T003 trước T006/T007; T008–T013 song song sau T005) → US1 (T015 cần T003, T008–T013; T021 cần
  T015–T020) → US2 (T025 cần T003, T005; độc lập với script, dùng seed SQL trong test) → US3, US4 (cần US1 + US2) →
  Phase 7.
- US2 có thể làm song song US1 sau Phase 2 (seed trực tiếp bằng SQL), nhưng theo thứ tự lát dọc OWNER yêu cầu thì làm
  US1 trước.

## Parallel Examples

- Phase 2: T008, T009, T010, T011, T012, T013 cùng lúc (khác file).
- US1: T018, T019, T020, T022 song song; T021 sau cùng.
- US2: T028, T029 song song với T027.

## Implementation Strategy

MVP = Phase 1 + 2 + US1 (nhập nháp trên fixture). Sau đó US2 (cửa duyệt — bắt buộc trước khi có gì lên web), US3/US4,
rồi review + docs. Mỗi phase là một lát có commit riêng.
