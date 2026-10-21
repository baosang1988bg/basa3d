# Tasks: Thêm nút Gọi hotline vào trang 404 (NotFound)

**Input**: Design documents from `specs/002-them-nut-goi-hotline-tel-vao-trang-src-a/`

## Phase 1: Setup & i18n Dictionary Updates

- [ ] T001 [P] [US2] Thêm message keys cho `notFound` vào `messages/vi.json` (title, description, backHome, callHotline) — `messages/vi.json`
- [ ] T002 [P] [US2] Thêm message keys tương ứng cho `notFound` vào `messages/en.json` — `messages/en.json`

## Phase 2: Core Utility & Component Implementation

- [ ] T003 [P] [US1] Viết unit test cho hàm làm sạch số điện thoại hotline (cleanse phone number for `tel:` link) — `tests/not-found-hotline.test.ts`
- [ ] T004 [US1] Cập nhật trang 404 `src/app/not-found.tsx` hiển thị nút Gọi hotline với `tel:` URI chuẩn hoá từ `SITE_CONFIG.hotline`, icon `Phone`, kết hợp nút "Về trang chủ" — `src/app/not-found.tsx`

## Phase 3: Polish, Documentation & Quality Gate

- [ ] T005 [P] Cập nhật roadmap và tạo exec-plan active — `docs/roadmap.md`, `docs/exec-plans/active/feature-002-them-nut-goi-hotline-tel-vao-trang-src-a.md`
- [ ] T006 Chạy cổng chất lượng: `npm run lint` → `npm run typecheck` → `npm test` → `npm run build` — Repository root
