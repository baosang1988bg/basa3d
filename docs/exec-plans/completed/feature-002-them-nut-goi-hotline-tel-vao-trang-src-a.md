# Feature 002-them-nut-goi-hotline-tel-vao-trang-src-a: Thêm nút Gọi hotline (tel:) vào trang src/app/not-found.tsx, dùng SITE_CONFIG.hotline, chuỗi qua mes

> Exec-plan cầu nối sinh bởi `/speckit-auto`. Đặc tả đầy đủ: [`specs/002-them-nut-goi-hotline-tel-vao-trang-src-a/spec.md`](../../../specs/002-them-nut-goi-hotline-tel-vao-trang-src-a/spec.md) ·
> plan: [`plan.md`](../../../specs/002-them-nut-goi-hotline-tel-vao-trang-src-a/plan.md) · task: [`tasks.md`](../../../specs/002-them-nut-goi-hotline-tel-vao-trang-src-a/tasks.md).
> Đóng bằng skill `close-phase` khi DoD đạt (chuyển file này sang `completed/`).

**Nhánh**: `feature/002-them-nut-goi-hotline-tel-vao-trang-src-a` · **Trạng thái**: đã chạy xong swarm

## Phase brief & Phase Bridge (trích plan.md)

**Exec-plan cầu nối**: `docs/exec-plans/active/feature-002-them-nut-goi-hotline-tel-vao-trang-src-a.md`

**Phase brief**:
- **Goal**: Thêm nút "Gọi hotline" dạng `tel:` vào trang 404 (`src/app/not-found.tsx`), chuẩn hoá số điện thoại và cập nhật từ điển i18n `messages/{vi,en}.json`.
- **Non-goals**: Không thay đổi layout root storefront hay logic chuyển hướng 404.
- **Inputs**: `SITE_CONFIG.hotline`, `messages/vi.json`, `messages/en.json`.
- **Outputs**: Trang 404 có nút gọi hotline bấm được; bộ test i18n/phone clean pass 100%.
- **Risks**: Trình duyệt desktop không có app handler `tel:` (khắc phục bằng cách hiển thị rõ số hotline trên nút).
- **Definition of Done**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` xanh.

**Lát cắt dọc**:
- DB/migration: Không áp dụng.
- Service/API: Helper `cleansePhoneNumber` trong lib utility / config.
- UI/admin: Trang `src/app/not-found.tsx` + `messages/{vi,en}.json`.
- Tests: `tests/not-found-hotline.test.ts` & `tests/phase-18-i18n-message-parity.test.ts`.
- Docs: `docs/exec-plans/active/feature-002-them-nut-goi-hotline-tel-vao-trang-src-a.md`, `docs/roadmap.md`.

**Rủi ro theo thứ tự ưu tiên review**:
Data integrity (N/A) → Concurrency (N/A) → Bảo mật (N/A) → Khả năng test (Pass i18n parity test) → Bảo trì (Không trùng lặp code) → Đơn giản (Chỉ dùng inline styling/Tailwind và SITE_CONFIG) → UX (Responsive, rõ ràng trên di động và máy tính).

**Tài liệu phải cập nhật**:
- [x] ADR mới: Không cần (Thay đổi UI nhỏ không ảnh hưởng kiến trúc cốt lõi).
- [x] `docs/database/business-rules.md`: Không đổi.
- [x] `docs/database/schema.md` + `docs/database/migrations.md`: Không đổi.
- [x] `docs/roadmap.md`: Cập nhật trạng thái feature hotline 404.

**Cổng chất lượng**:
`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

## Definition of Done

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` (không có DB — test DB bị bỏ qua)
- [x] `npm run build`
- [x] Playwright E2E cho luồng bị ảnh hưởng — trang 404 độc lập không đổi luồng E2E
- [x] Đã cập nhật ADR / business-rules / schema / roadmap theo Phase Bridge
- [x] Người duyệt (Claude reviewer) đã review diff — BLOCKERS = 0
