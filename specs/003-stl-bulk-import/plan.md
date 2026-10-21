# Implementation Plan: Nhập hàng loạt kho STL thành sản phẩm nháp, duyệt rồi lên web

**Branch**: `003-stl-bulk-import` (làm tay trên `dev`, chưa tạo nhánh) | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/003-stl-bulk-import/spec.md` + quyết định D1–D8 và schema của `docs/prompts/stl-drive-to-draft-products.md`
+ 5 bổ sung của OWNER (UNKNOWN license, trigger gate, phân quyền OWNER duyệt, optimistic lock, cảnh báo 800 MB).

## Summary

Script chạy trên máy OWNER (`tsx`) quét thư mục Drive local, gom mẫu theo thư mục lá (mặc định) hoặc theo file, đo bằng
`parseStlMetrics`, render 4 ảnh WebP bằng Playwright + three, ước giá bằng pricing engine hiện có, rồi (khi `--apply`) ghi
mỗi mẫu trong **một transaction `pg`**: bảng staging `product_import_items` (1–1) + product DRAFT `MADE_TO_ORDER` + 1
variant + `product_images`, ảnh upload lên bucket `product-images` qua service-role. Trang admin "Kho nhập STL" cho
OWNER/STAFF lọc và sửa nhanh (optimistic lock theo `updated_at`), còn **duyệt/từ chối chỉ OWNER**. Gate lên web được
**trigger DB** giữ cho mọi đường ghi `products.status`. Thay quyết định T3 của Phase 32 bằng ADR-0049.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 15 App Router, React 19); script chạy Node 22 qua `tsx`.

**Primary Dependencies**: có sẵn — `pg`, `@supabase/supabase-js` (Storage), `zod`, `three` (STLLoader), `@playwright/test`
(chromium render headless), `fflate` (3MF tuỳ chọn). **Không thêm dependency.**

**Storage**: PostgreSQL (Supabase) — bảng mới `product_import_items`, trigger mới trên `products`; Supabase Storage bucket
`product-images` (public, 5 MB, webp).

**Testing**: `node --test` qua `tsx` (`tests/*.test.ts`, DB test local `TEST_*`); Playwright E2E `e2e/stl-import.spec.ts`.

**Target Platform**: script trên macOS + Windows (máy OWNER); web trên Vercel (Node runtime).

**Project Type**: web application (Next.js monolith) + CLI script nội bộ.

**Performance Goals**: render ≤ ~10 s/mẫu với mesh ~1M tam giác (spike: 6,5 s); lô 100 mẫu ≤ ~20 phút; trang admin tải
24 thẻ/trang ≤ 2 s.

**Constraints**: không upload file gốc; không đi qua API route (giới hạn 4,5 MB Vercel); bucket ≤ 1 GB (Supabase Free) —
cảnh báo 800 MB, chặn `--apply` khi ước tính > 950 MB; không ghi `inventory_movements`.

**Scale/Scope**: < ~2.000 sản phẩm lên web (Q2), 4 ảnh × ~100 KB; kho nguồn ~200 GB, vài nghìn file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Ghi chú |
|---|---|---|
| I. DB là nguồn sự thật | ✅ | Migration mới; gate FR-021 bằng trigger DB; CHECK/FK/unique đầy đủ (data-model §1); tiền `bigint` VND |
| II. Tồn kho & đơn hàng | ✅ | Không tạo movement; không đụng đơn hàng. Concurrency: transaction mỗi mẫu + `for update` + advisory lock cho script + optimistic lock cho admin + thứ tự khoá cố định |
| III. Bảo mật server | ✅ | `requireAdmin`/`requireOwner` ở action **và** service; Zod ở biên; RLS deny-all bảng mới; service-role key chỉ ở máy OWNER, không log, không commit; không lộ nguồn ra public (test) |
| IV. Kiểm thử | ✅ | Test cho mọi quy tắc ở spec §Edge Cases + E2E duyệt → storefront |
| V. Đơn giản & lát dọc | ✅ (có ghi chú) | Không thêm dependency. Thêm một service ghi riêng cho script (lý do: `product.service` phụ thuộc Next cache) — xem Complexity Tracking |
| VI. Truy vết | ✅ | ADR-0049 (thay T3 Phase 32), business-rules mới, schema/migrations, roadmap, exec-plan cầu nối |

Re-check sau Phase 1 (data-model + contracts): ✅ không phát sinh vi phạm mới; database review đã xử lý mọi BLOCKER.

## Project Structure

### Documentation (this feature)

```text
specs/003-stl-bulk-import/
├── spec.md
├── plan.md              # file này
├── research.md          # R1–R15 + Database review (BLOCKERS/IMPORTANT/SUGGESTIONS)
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── cli-import-stl.md
│   └── admin-stl-import.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (chưa tạo)
```

### Source Code (repository root)

```text
supabase/migrations/20261022000000_stl_bulk_import.sql   # bảng, index, RLS, 2 trigger, danh mục "Chưa phân loại", comment license_type
src/domain/schemas.ts                                     # + 'UNKNOWN', stlImport* schemas
src/lib/stl-import/
├── naming.ts            # tên/slug/SKU (thuần, test được)
├── source-key.ts        # chuẩn hoá đường dẫn NFC + sha1 + fingerprint
├── scan.ts              # quét + group-by folder|file (thuần trên danh sách file)
└── pricing.ts           # metrics → estimateFdmPrint → priceMakerWorldLines (thuần)
src/services/
├── stl-import-write.service.ts  # ghi từ script: upsert item/product/variant/images trong withTransaction (không Next cache)
├── stl-import.service.ts        # admin: list/quickEdit/rerender/approve/reject + optimistic lock + bucket usage
└── storage-usage.service.ts     # getBucketUsageBytes (storage.objects)
src/app/admin/(protected)/stl-import/
├── page.tsx             # lưới thẻ, lọc, phân trang, banner dung lượng
├── import-grid.tsx      # client: chọn nhiều, sửa nhanh, duyệt/từ chối (shadcn/ui có sẵn)
└── actions.ts
scripts/stl-import/
├── import-stl.ts        # CLI (contracts/cli-import-stl.md)
├── render-page.html     # mở rộng từ scripts/model-library-spike/render-page.html (4 góc, bóng, 1200 px)
├── report-template.html
├── category-map.json    # ánh xạ thư mục → {categorySlug, skuCode}; "groupBy" mặc định
└── README.md
tests/
├── stl-import-naming.test.ts, stl-import-scan.test.ts, stl-import-source-key.test.ts
├── stl-import-write.test.ts        # idempotent, đổi nguồn, APPROVED không đổi public, rollback ảnh
├── stl-import-gate.test.ts         # trigger: 5 lý do + mọi đường status → ACTIVE (unarchive, PATCH API)
├── stl-import-admin.test.ts        # quyền 401/403, OWNER-only, optimistic lock, bulk partial
├── stl-import-public-exposure.test.ts
└── fixtures/stl-import/            # STL nhỏ tự tạo
e2e/stl-import.spec.ts
```

Sửa: `src/components/admin/admin-nav.tsx` (thêm mục "Kho nhập STL"), `scripts/test-db-setup.ts` (stub `storage.objects.metadata`),
`tests/rls-public-tables.test.ts` (nếu danh sách tường minh), `.gitignore` (`.stl-import/`),
`src/app/admin/(protected)/products/*` (hiển thị lỗi `IMPORT_PUBLISH_BLOCKED` dễ hiểu), docs.

**Structure Decision**: giữ monolith hiện có; logic thuần ở `src/lib/stl-import/` để script và Next cùng dùng; script ở
`scripts/stl-import/` cạnh spike Phase 32.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Service ghi riêng `stl-import-write.service.ts` song song `product.service.ts` | `product.service` bọc mọi ghi bằng `invalidatesStorefrontCatalog` (Next cache) → không chạy được trong script; sản phẩm nhập là DRAFT nên không cần làm mới cache | Gọi API route (giới hạn 4,5 MB + thời gian Vercel); chép SQL vào `.mjs` (không test được chung) |
| Hai trigger mới (gate trên `products`, link trên `product_import_items`) | 5 đường ghi `status` hiện có, STAFF gọi được — chỉ service là không đủ (BLOCKER 2) | Chỉ kiểm ở service mới — bị vượt qua bởi trang sửa sản phẩm / `PATCH /api/products/[id]` |
| Hai kênh truy cập trong script (`pg` cho DB, supabase-js cho Storage) | Cần transaction nhiều câu lệnh (BLOCKER 3) + upload Storage | Chỉ supabase-js — không atomic |

## BaSa3D Phase Bridge

**Exec-plan cầu nối**: `docs/exec-plans/active/feature-003-stl-bulk-import.md`

**Phase brief**:
- **Goal**: biến kho STL trên Drive thành sản phẩm nháp có ảnh/kích thước/giá ước tính, và một trang để OWNER duyệt hàng
  loạt lên web an toàn về bản quyền.
- **Non-goals**: viewer 3D, cho khách tải STL, đồng bộ Drive realtime, ảnh AI, tự xác định bản quyền, nhập tồn kho, bỏ duyệt
  (APPROVED → PENDING), phát hiện file bị di chuyển theo nội dung.
- **Inputs**: spec, prompt brief, `parseStlMetrics`, pricing engine, `uploadProductImage` (mẫu rollback), spike Phase 32.
- **Outputs**: migration, 3 service, script CLI, trang admin, test + E2E, ADR-0049, docs.
- **Risks**: lộ nguồn ra public; sản phẩm chưa kiểm bản quyền lên web; ảnh mồ côi; vượt 1 GB Storage; render chậm/treo ở
  chế độ Stream; E2E cần Supabase test (máy hiện không có Docker/Supabase CLI).
- **DoD**: như exec-plan (batch thật ≥ 100 mẫu, duyệt ≥ 10 lên web, gate/exposure có test, cổng chất lượng xanh, docs).

**Lát cắt dọc**:
1. **DB**: migration (bảng, index, RLS, trigger gate + link, danh mục "Chưa phân loại", comment license) → test gate + RLS.
2. **Logic thuần**: naming/slug/SKU, source-key/fingerprint, scan/group-by, pricing → unit test.
3. **Ghi từ script**: `stl-import-write.service` (transaction, rollback ảnh, audit) → test idempotent/đổi nguồn/rollback.
4. **Script CLI**: render 4 góc, report/manifest, dry-run/apply, advisory lock, cảnh báo dung lượng → chạy trên fixtures.
5. **Admin**: service list/edit/rerender/approve/reject + action + trang mobile-friendly → test quyền/lock/bulk + E2E.
6. **Public**: test không lộ nguồn, sitemap, ảnh `next/image` (đường hiện có).
7. **Docs**: ADR-0049, Phase 32 (thu hẹp), business-rules, schema/migrations, runbook, roadmap, README script.

**Rủi ro theo thứ tự ưu tiên review**: data integrity (transaction mỗi mẫu, CHECK cặp giá, không ghi đè field admin) →
concurrency (advisory lock, optimistic lock, thứ tự khoá) → phân quyền/bảo mật (OWNER-only duyệt, RLS, không lộ nguồn,
key chỉ ở máy OWNER) → khả năng test (fixtures tự tạo, DB test local) → bảo trì → đơn giản → UX (mobile).

**Tài liệu phải cập nhật**:
- [ ] ADR-0049 trong `docs/architecture/decisions.md` — thay T3 Phase 32 (đã soạn bản *Proposed*)
- [ ] `docs/database/business-rules.md` — quy tắc mới: gate lên web cho sản phẩm nhập, idempotent/đổi nguồn, REJECTED không
  tạo lại, license UNKNOWN cho hàng nhập, OWNER-only duyệt
- [ ] `docs/database/schema.md` + `docs/database/migrations.md` — bảng/trigger mới
- [ ] `docs/operations/runbook.md` — cách chạy batch; `docs/roadmap.md` — trạng thái; `docs/exec-plans/active/phase-32-model-library.md` — thu hẹp phạm vi

**Cổng chất lượng**: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · Playwright
`e2e/stl-import.spec.ts` (+ chạy lại `e2e/admin.spec.ts` và `e2e/copyright-compliance.spec.ts` vì trigger mới chạm đường sửa sản phẩm).

## Quyết định gate plan (tự duyệt 2026-10-21 theo uỷ quyền OWNER — không có BLOCKER)

1. **R10 license → A**: Zod `productLicenseTypeSchema` + `'UNKNOWN'`, migration ghi `comment on column` và sản phẩm nhập
   ghi `license_type = 'UNKNOWN'` tường minh; **không** thêm CHECK (giữ quyết định Phase 29). Đổi sang B sau chỉ tốn một
   migration `check … not valid` + `validate`.
2. **R12 lock → `updated_at`** (theo yêu cầu OWNER), so sánh chuỗi µs ở SQL.
3. **SUGGESTIONS**: 13 (cắt `process_error` ≤ 2.000) làm luôn; 12, 14, 15 để sau (ghi business-rules).
4. **Nhánh**: làm tiếp trên `dev`, commit cục bộ, không push. Worktree `/speckit-auto` song song
   (`feature/003-0-vai-tro-quy-trinh-ban-la-senior-engine`) **không** bị đụng tới — OWNER tự dừng/xoá.
