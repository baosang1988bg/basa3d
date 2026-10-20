# Implementation Plan: Thêm nút Gọi hotline vào trang 404 (NotFound)

**Branch**: `feature/002-them-nut-goi-hotline-tel-vao-trang-src-a` | **Date**: 2026-10-20 | **Spec**: `specs/002-them-nut-goi-hotline-tel-vao-trang-src-a/spec.md`

## Summary

Thêm nút Gọi hotline sử dụng `tel:` link vào trang 404 (`src/app/not-found.tsx`), lấy số hotline từ `SITE_CONFIG.hotline` (`src/config/site.ts`).
Nội dung hiển thị và accessibility được bản dịch hóa qua `messages/vi.json` và `messages/en.json` (`next-intl`), đồng thời đảm bảo số điện thoại trong URI `tel:` được làm sạch (chỉ giữ chữ số và dấu `+`).

## Technical Context

**Language/Version**: TypeScript / Next.js 15 App Router + React 19  
**Primary Dependencies**: `next-intl` (đã có), `SITE_CONFIG` (`src/config/site.ts`), `lucide-react` (`Phone` icon)  
**Storage**: N/A (UI pure component)  
**Testing**: `node --test` qua tsx (`tests/phase-18-i18n-message-parity.test.ts`), unit test cho helper cleanse phone, typecheck, lint, build  
**Target Platform**: Web (Desktop & Mobile Storefront)  
**Project Type**: Next.js App Router Frontend Page  
**Performance Goals**: N/A (Trang 404 static HTML render nhanh, không tốn tài nguyên)  
**Constraints**: Không thêm npm dependency mới; Đảm bảo i18n parity giữa `vi.json` và `en.json`; Giữ thiết kế tương thích với Tailwind CSS / shadcn/ui.

## Constitution Check

- **I. Database là nguồn sự thật**: N/A (Không thay đổi DB schema).
- **II. Tồn kho & đơn hàng đúng tuyệt đối**: N/A.
- **III. Bảo mật phía server**: N/A (Không có server action hay route handler mới).
- **IV. Kiểm thử là một phần của tính năng**: Viết test kiểm tra cleansing số điện thoại hotline và kiểm tra i18n message parity cho key `notFound`.
- **V. Đơn giản & lát cắt dọc**: Thay đổi phạm vi nhỏ gọn trên UI và tệp i18n.
- **VI. Truy vết quyết định**: Cập nhật exec-plan `docs/exec-plans/active/feature-002-them-nut-goi-hotline-tel-vao-trang-src-a.md`.

## Project Structure

### Documentation (this feature)

```text
specs/002-them-nut-goi-hotline-tel-vao-trang-src-a/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── not-found.tsx                           # Sửa: Thêm nút Gọi hotline dùng SITE_CONFIG.hotline
├── config/
│   └── site.ts                                 # Đọc: SITE_CONFIG.hotline
messages/
├── vi.json                                     # Sửa: Khai báo keys notFound.callHotline, notFound.title, etc.
└── en.json                                     # Sửa: Khai báo keys tương ứng cho English

tests/
├── phase-18-i18n-message-parity.test.ts        # Đã có: Tự động verify parity giữa vi.json và en.json
└── not-found-hotline.test.ts                   # Tạo mới: Test helper cleanse phone & hotline link formatting
```

## Concurrency & Data Flow

1. Khi người dùng truy cập trang 404, `src/app/not-found.tsx` render.
2. Hàm helper `cleansePhoneNumber(SITE_CONFIG.hotline)` được gọi để loại bỏ khoảng trắng/gạch nối, tạo URI `tel:0333698638`.
3. Nhãn hiển thị sử dụng chuỗi dịch từ i18n messages (hoặc fallback chuỗi chuẩn hoá với `SITE_CONFIG.hotline`).
4. Người dùng nhấp vào nút "Gọi hotline" → Trình duyệt kích hoạt URI `tel:`.

## BaSa3D Phase Bridge

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
