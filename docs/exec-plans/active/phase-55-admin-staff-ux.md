# Phase 55 — Admin dễ dùng cho staff: nav mobile, tìm kiếm, catalog

**Status:** đã merge vào `dev` (2026-11-17); build + test trên bản cài sạch xem cuối file — chờ OWNER chạy `npm test` đầy đủ + `npm run build` + Playwright trên macOS và xem UI thật.
**Owner:** Claude (implement theo yêu cầu OWNER 2026-11-17), OWNER (review UI, merge `dev`).
**Trigger:** review dự án 2026-11-17 — admin không dùng được trên điện thoại, menu kho gây nhầm, không tìm được đơn theo SĐT, trang chi tiết sản phẩm lệch với form "Đăng sản phẩm mới".

## Phase brief

- **Goal:** staff xưởng thao tác được trên điện thoại; tìm đơn/yêu cầu theo SĐT hoặc mã; quản lý catalog bằng ít bước hơn (nhân bản, đăng/lưu trữ hàng loạt, biết ngay còn thiếu gì và bấm tới đúng chỗ).
- **Non-goals:** MFA cho admin (cần bật ở Supabase dashboard + test thật — xem Follow-up); đổi schema/migration; đổi luồng order/inventory/quote; thêm dependency.
- **Inputs:** `admin-nav.tsx`, `orders/page.tsx`, `custom-requests/page.tsx`, `products/page.tsx`, `products/[id]/page.tsx`, `product-onboarding.service.ts`, `order.service.ts`, `custom-request.service.ts`.
- **Risks:** E2E đang dò link nav theo tên (`e2e/dashboard.spec.ts:105`); nhân bản không được chép ảnh (hai sản phẩm trỏ chung một object Storage → xoá ảnh bên này làm hỏng bên kia) và không được chép tồn kho/bản quyền.

## Quyết định

| # | Quyết định | Lý do / trade-off |
|---|---|---|
| D1 | Nav **một DOM duy nhất**: `< md` là drawer trượt + thanh trên cùng có nút menu; `≥ md` giữ sidebar cũ. Không làm thanh tab dưới. | Thanh tab dưới nhân đôi link → E2E `getByRole('link')` dính strict-mode, và hai nơi phải giữ đồng bộ. Mất: truy cập 1 chạm trên mobile (đổi lại 2 chạm). |
| D2 | Đổi nhãn nhóm kho: `Kho sản phẩm → Kho & giá` (khớp tiêu đề trang sẵn có), `Kho nhập STL → Duyệt mẫu STL`, `Tồn kho → Lịch sử kho`, `Kho nhựa → Nhựa in`. Route giữ nguyên. | 4 mục cùng chữ "kho"; nhãn mới nói việc cần làm. Tiêu đề trang đổi theo để khớp menu. |
| D3 | Tìm kiếm `?q=` ở Đơn hàng và Custom request: khớp mã, tên khách (ILIKE đã escape), và SĐT theo **chỉ chữ số** (bỏ khoảng trắng/dấu chấm ở cả hai phía). Tối đa 100 ký tự. Số đếm trên tab không đổi theo `q`. | Staff dán SĐT từ Zalo ở nhiều định dạng. Chưa thêm index (bảng nhỏ; AGENTS.md "optimize after measuring"). |
| D4 | **Nhân bản sản phẩm** → luôn `DRAFT`, tên `… (bản sao)`, slug/SKU sinh mới; chép danh mục, mô tả, hình thức bán, giá, snapshot giá, biến thể. **Không chép**: ảnh, tồn kho, SEO, "nổi bật". **Bản quyền đặt lại `UNKNOWN`**. Idempotent qua `admin_request_keys` (scope `product_onboarding`, payload `{ duplicateOf }`). | Ảnh: tránh 2 sản phẩm chung 1 object Storage. Bản quyền: giữ nguyên tắc Phase 52 D8 "không mặc định ngầm" — đổi lại staff phải chọn lại 1 ô. Dùng lại scope có sẵn để **không cần migration** (CHECK của bảng chỉ cho 2 scope). |
| D5 | **Hàng loạt** ở danh sách sản phẩm: checkbox gắn `form="…"` + 2 nút (Đăng bán / Lưu trữ), không JS client. Đăng bán đi qua `publishProductIfReady` từng món; món chưa đủ điều kiện bị bỏ qua và báo số lượng. Tối đa 100 id. | Không lách được cổng bản quyền/Feature 003. Mất: không có "chọn tất cả" (cần JS) — chấp nhận ở bản đầu. |
| D6 | Trang chi tiết sản phẩm: thêm **danh mục** và **mô tả chi tiết**; slug + SEO vào "Nâng cao"; trạng thái hiện tiếng Việt; có neo `#thong-tin #ban-quyen #bien-the #anh`; nút Nhập kho cho biến thể READY_STOCK; nút Nhân bản. | Một bố cục chung với form tạo mới; "Còn thiếu: …" ở danh sách bấm tới đúng neo. |
| D7 | **Sửa lỗi mất dữ liệu:** `updateProductAction` luôn gửi `description: null` vì form chi tiết không có ô mô tả → mỗi lần Lưu là xoá mô tả chi tiết nhập ở form tạo mới. Nay chỉ ghi `description` khi form có gửi field đó, và form đã có ô. | Data integrity (ưu tiên #1). |

## Slices

### S1 — Nav
- [x] Drawer mobile + thanh trên cùng, đóng khi đổi route / bấm nền / Esc (`admin-nav.tsx`); `layout.tsx` chừa chỗ cho thanh trên
- [x] Đổi nhãn menu + tiêu đề trang tương ứng (D2)

### S2 — Tìm kiếm
- [x] `src/lib/admin-search.ts` (thuần) + test `tests/phase-55-admin-search.test.ts`
- [x] `listOrders` / `listCustomRequests` nhận `search`; ô tìm trên hai trang, phân trang giữ `q`

### S3 — Catalog
- [x] `duplicateProduct` (service) + `duplicateProductAction` + nút ở trang chi tiết (D4)
- [x] Thao tác hàng loạt (D5) + thông báo kết quả
- [x] "Còn thiếu" thành link tới neo (D6)
- [x] Trang chi tiết: danh mục, mô tả, Nâng cao, nhãn tiếng Việt, Nhập kho (D6) + sửa lỗi D7
- [x] Test `tests/phase-55-product-duplicate.test.ts` (DB) + `tests/phase-55-product-actions.test.ts` (mock service)

## Definition of Done
- [x] lint, typecheck (không tính `.next*/types` cũ của nhánh khác), `check:arch`, test phase-55 trên PostgreSQL thật — xem "Evidence"
- [ ] `npm test` đầy đủ + `npm run build` + `npm run test:e2e` trên macOS (OWNER)
- [ ] OWNER xem UI trên điện thoại thật (390px) và desktop

## Evidence (2026-11-17, sandbox Linux arm64, Node 22.23)
- `npx tsc --noEmit`: 0 lỗi trong `src/`, `tests/`, `scripts/`. (Còn 5 lỗi `TS2307` trong `.next/types` và `.next-test/types` — file build cũ của nhánh `feat/neobox-lightbox-generator` trỏ tới `tools/lightbox-maker/page.js` không có trên `dev`; xoá `.next` + `.next-test` là hết. Có từ trước phase này.)
- `npx eslint src tests/phase-55-*.ts`: sạch. `npm run check:arch`: 6/6 rule pass.
- PostgreSQL thật (embedded-postgres, DB trắng, áp đủ 33 migration bằng `scripts/test-db-setup.ts --reset`), chạy `node --experimental-test-module-mocks --test --test-concurrency=1`:
  - `tests/phase-55-admin-search.test.ts` 6/6 (gồm 1 test DB: tìm theo mã / tên / SĐT gõ kiểu `0xxx`, `+84 xxx`, có dấu chấm; `%` và `_` là ký tự thường; kết hợp với tab trạng thái).
  - `tests/phase-55-product-duplicate.test.ts` 4/4 (nhân bản không chép ảnh/tồn/bản quyền, SKU + slug mới, audit log; bấm 2 lần chỉ 1 bản sao; khoá dùng lại cho sản phẩm khác → `IDEMPOTENCY_CONFLICT`; đăng bán hàng loạt chỉ đăng bản nháp đủ điều kiện).
  - `tests/phase-55-product-actions.test.ts` 5/5 (D7: không còn ghi `description = null`; tham số action sai định dạng không chạm service; hơn 100 id bị từ chối; `status` trả về URL chỉ nhận giá trị whitelist).
  - Chạy chung một lượt 12 file (3 file phase-55 ở trên + hồi quy `phase-52-*`, `phase-28-admin-*`, `phase-36*`, `stl-import-gate`, `stl-import-actions`, `rls-public-tables`) → 98 test, 97 pass.
  - **1 fail có từ trước, không do phase này:** `tests/phase-28-admin-pagination.test.ts:73` mong `getAdminNavBadges()` trả 3 khoá, nhưng Phase 54.2 đã thêm `blogDrafts` (`dashboard.service.ts` không bị sửa ở đây). Cần cập nhật expectation của test đó.
- **Chưa làm được trong sandbox:** `next build` (node_modules chỉ có SWC/esbuild bản macOS), `npm test` qua runner chính thức, Playwright, và **chưa nhìn UI trên trình duyệt** — nav mobile và bố cục trang chi tiết mới chỉ được kiểm bằng typecheck/lint.

## Cách OWNER kiểm nhanh (macOS)
1. `rm -rf .next .next-test && npm run check:agent && npm run build`
2. `npm run dev` → mở `/admin` ở chiều rộng 390px: thanh trên cùng + nút menu, drawer đóng khi chọn mục / bấm nền / Esc.
3. `/admin/orders` và `/admin/custom-requests`: dán một SĐT có khoảng trắng → ra đúng đơn; đổi tab vẫn giữ kết quả phân trang.
4. `/admin/products`: tick 2–3 bản nháp → Đăng bán → thông báo "đã đăng X, bỏ qua Y"; bấm chữ "ảnh"/"bản quyền" ở dòng "Còn thiếu" → nhảy đúng khối.
5. Mở một sản phẩm có mô tả chi tiết → Lưu thay đổi → mô tả **còn nguyên** (D7); bấm Nhân bản → mở bản nháp mới, không ảnh, bản quyền "Chưa xác định".

## Follow-up (chưa làm)
- **MFA (TOTP) cho OWNER** — cần bật MFA trong Supabase Auth, thêm màn enroll/challenge, và `requireOwner` kiểm `aal2`. Rủi ro tự khoá tài khoản → làm thành phase riêng, test trên project dev.
- ~~Xác nhận trước khi "Xoá hẳn sản phẩm"~~ — đã làm (`confirm-submit-button.tsx`, áp cho xoá sản phẩm và xoá biến thể).
- Trang chi tiết vẫn cho đổi trạng thái sang "Đang bán" mà không qua `publishProductIfReady` (hành vi cũ, chỉ có cổng Feature 003 cho hàng nhập STL) — nên cho select đi cùng một cổng với nút Đăng bán.
- ~~Sửa expectation `blogDrafts` ở `tests/phase-28-admin-pagination.test.ts:73`~~ — đã sửa trong Phase 56.
- "Chọn tất cả" cho thao tác hàng loạt; đổi danh mục hàng loạt.
- Index `pg_trgm` cho tìm kiếm khi số đơn lớn.

## Evidence bổ sung sau khi merge vào `dev` (2026-11-17, bản cài sạch trong sandbox)
Clone `dev` đã merge Phase 55 + 56 sang thư mục riêng, `npm ci` (binary Linux), rồi chạy:
- `npm run lint`, `npm run typecheck`, `npm run check:arch`: **xanh** (typecheck sạch hoàn toàn khi không có `.next*/types` cũ).
- `next build` với **Next 15.5.29**: **thành công**. Google Fonts bị chặn mạng trong sandbox nên build dùng font giả lập qua `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` — chỉ ảnh hưởng file font, không đụng code.
- `next start` + PostgreSQL thật, gọi thử: `/home`, `/products`, `/products?q=%25%25%25&categoryId=not-a-uuid&type=X&page=abc` (200, trước đây 500), `/blog`, `/blog/<slug không có>`, `/sitemap.xml`, `/robots.txt`, `/privacy-policy`, `/en/privacy-policy`, `/admin/dashboard` (307 → `/admin/login`), `/api/version` — không có lỗi trong log server.
- Toàn bộ 132 file test theo đúng lệnh của `tests/helpers/test-runner.ts` (server đang chạy): **962 test, 929 pass, 19 skip, 14 fail**.
- **14 fail đều có sẵn trên `dev` gốc (`223af23`)** — đã build và chạy lại đúng các file đó trên bản gốc, ra y hệt: `ai-news` (6, `syncDaily3DNews`/`claimManualNewsSync`), `blog-review` (4), `makerworld-estimate` (1, "look-alike URLs"), `phase-15-staff-notification-failure` (1), `stl-import-cli` (2). Chưa điều tra nguyên nhân; một phần có thể do sandbox không có Supabase local/Chrome.
- **Phát hiện thêm:** trên `dev` gốc `npm ci` **thất bại** (`Missing: @swc/helpers@0.5.24 from lock file`) — lockfile lệch `package.json`. Lockfile mới của Phase 56 đã đồng bộ lại, `npm ci` chạy được.
- **Vẫn chưa làm được:** Playwright E2E (cần trình duyệt + Supabase Auth) và nhìn UI bằng mắt (nav mobile, trang chi tiết sản phẩm). Admin sau đăng nhập chưa được render thử vì không có Supabase Auth trong sandbox.
