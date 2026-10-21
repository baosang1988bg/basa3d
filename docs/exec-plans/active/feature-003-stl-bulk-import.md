# Feature 003-stl-bulk-import: Kho STL trên Drive → sản phẩm DRAFT → OWNER duyệt → lên web

> Exec-plan cầu nối (làm tay bằng `/speckit-specify` + `/speckit-plan`). Đặc tả: [`specs/003-stl-bulk-import/spec.md`](../../../specs/003-stl-bulk-import/spec.md) ·
> plan: [`plan.md`](../../../specs/003-stl-bulk-import/plan.md) · research + database review: [`research.md`](../../../specs/003-stl-bulk-import/research.md) ·
> data model: [`data-model.md`](../../../specs/003-stl-bulk-import/data-model.md) · task: `tasks.md` (chưa tạo).
> Đóng bằng skill `close-phase` khi DoD đạt (chuyển file này sang `completed/`).

**Nhánh**: `dev` (chưa tạo nhánh feature — chờ OWNER) · **Trạng thái**: plan + tasks + analyze tự duyệt (uỷ quyền OWNER 2026-10-21), **chờ OWNER "OK" để implement**
· **Thay thế**: quyết định T3 của Phase 32 (ADR-0049, *Proposed*)

## Phase brief & Phase Bridge (trích plan.md)

**Phase brief**:
- **Goal**: biến kho STL trên Drive thành sản phẩm nháp có ảnh/kích thước/giá ước tính, và một trang để OWNER duyệt hàng
  loạt lên web an toàn về bản quyền.
- **Non-goals**: viewer 3D, cho khách tải STL, đồng bộ Drive realtime, ảnh AI, tự xác định bản quyền, nhập tồn kho, bỏ duyệt,
  phát hiện file bị di chuyển theo nội dung.
- **Inputs**: `docs/prompts/stl-drive-to-draft-products.md` (D1–D8, schema), spec (Q1=C, Q2=A, Q3=B), 5 bổ sung OWNER
  2026-10-21, `parseStlMetrics`, pricing engine, `uploadProductImage`, spike Phase 32.
- **Outputs**: migration `stl_bulk_import`, `src/lib/stl-import/*`, 3 service, script `scripts/stl-import/import-stl.ts`,
  trang `/admin/stl-import`, test + E2E, ADR-0049, docs.
- **Risks**: lộ nguồn ra public; sản phẩm chưa kiểm bản quyền lên web; ảnh mồ côi; vượt 1 GB Storage; render chậm/treo ở
  chế độ Stream; E2E cần Supabase test (máy hiện không có Docker/Supabase CLI).

**Quyết định chính** (chi tiết research.md): D1 Drive local (chuẩn hoá NFC) · D2 script `tsx` dùng lại module thuần ·
D3 DB qua `pg` một transaction mỗi mẫu + Storage qua service-role · D4 bảng `product_import_items` · D5 DRAFT
`MADE_TO_ORDER`, 1 variant, không movement · D6 `product-images/{productId}/{uuid}.webp` · D7 `sha1(relPath)` + fingerprint ·
D8 gate = **trigger DB** (APPROVED + license_reviewed + ảnh + giá > 0 + danh mục ≠ "Chưa phân loại") · license `UNKNOWN` ·
duyệt/từ chối **chỉ OWNER** · optimistic lock `updated_at` (so sánh chuỗi µs) · cảnh báo bucket > 800 MB, chặn > 950 MB.

**Lát cắt dọc**: (1) DB migration + trigger → (2) logic thuần → (3) service ghi từ script → (4) script CLI → (5) admin
service/action/trang → (6) kiểm tra public → (7) docs.

**Rủi ro theo thứ tự ưu tiên review**: data integrity → concurrency → phân quyền/bảo mật → khả năng test → bảo trì →
đơn giản → UX.

**Tài liệu phải cập nhật**:
- [ ] ADR-0049 — thay T3 Phase 32 (bản *Proposed* đã thêm; chốt *Accepted* khi OWNER duyệt plan)
- [ ] `docs/database/business-rules.md` — gate lên web hàng nhập, idempotent/đổi nguồn, REJECTED không tạo lại, UNKNOWN, OWNER-only duyệt
- [ ] `docs/database/schema.md` + `docs/database/migrations.md`
- [ ] `docs/operations/runbook.md` (chạy batch), `docs/roadmap.md`, `docs/exec-plans/active/phase-32-model-library.md` (thu hẹp)

**Cổng chất lượng**: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `e2e/stl-import.spec.ts` +
chạy lại `e2e/admin.spec.ts`, `e2e/copyright-compliance.spec.ts`.

## Gate plan — OWNER chốt

- [x] R10 license: **A** chỉ Zod + comment (giữ Phase 29)
- [x] R12 lock: `updated_at`
- [x] Database review SUGGESTIONS: 13 làm luôn; 12/14/15 để sau
- [x] Nhánh: `dev`, commit cục bộ; run `/speckit-auto` song song để OWNER tự dừng

## Definition of Done

- [ ] Batch thật ≥ 100 mẫu chạy xong; `report.html` có tỉ lệ lỗi + thời gian trung bình/mẫu (OWNER chạy trên máy)
- [ ] Draft hiện trong admin; OWNER duyệt ≥ 10 sản phẩm → thấy ở `/products` và sitemap
- [ ] Test: không sản phẩm nhập nào lên ACTIVE khi chưa `license_reviewed` — qua **mọi** đường (duyệt, sửa sản phẩm, unarchive, `PATCH /api/products/[id]`)
- [ ] Test: không lộ thông tin nguồn ra public (HTML, API, sitemap) + RLS bảng mới
- [ ] Test: idempotent, đổi nguồn (DRAFT vs APPROVED), rollback ảnh, quyền 401/403/OWNER-only, optimistic lock, bulk partial
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- [ ] Playwright `e2e/stl-import.spec.ts` (OWNER duyệt → storefront hiển thị) + E2E sản phẩm hiện có
- [ ] Docs theo danh sách trên; ADR-0049 *Accepted*
- [ ] Reviewer: BLOCKERS = 0
