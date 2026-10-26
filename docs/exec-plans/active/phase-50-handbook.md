# Phase 50 — Cẩm nang in 3D BaSa3D (FDM Handbook & Engineering Reference)

> Yêu cầu OWNER (2026-10-26): Xây dựng chuyên trang Cẩm nang in 3D cho BaSa3D tương tự Zorva3D Handbook (`zorva3d.com/vi/handbook`), định vị thương hiệu chuyên sâu, hỗ trợ kỹ thuật thực chiến cho khách hàng và kết nối trực tiếp với bộ 3D tools & báo giá tức thì của BaSa3D.
> Định hướng kiến trúc: Code-first Static Reference Page (0 ms DB latency, 0 VND chi phí phát sinh, SSG, SEO tối đa).
>
> **Rev 2 (2026-10-26) — sau Claude review** (`phase-50-claude-review-prompt.md`): GO có điều kiện. Đã xử lý
> B1 (link tool sai/`/bao-gia` bị cờ tắt), B2 (redirect bắt nhầm + nhảy 2 lần), B3 (SSG phải được kiểm chứng).
> Bỏ JSON-LD `HowTo`, bỏ "throttle" cho IntersectionObserver.

## Brief (Step 1)
- **Goal:** Tạo trang `/cam-nang` (và redirect `/handbook`) gồm 9 chương cẩm nang kỹ thuật in 3D FDM chuẩn xưởng; có Sticky Table of Contents (Scroll Spy); Interactive Pre-flight Checklist lưu `localStorage`; bảng tra cứu nhiệt độ vật liệu và dung sai CAD; liên kết chéo (flywheel) sang `/tools/*` và `/bao-gia`.
- **Non-goals:** Không thêm bảng database mới; không thêm comment/forum; không dùng framework tài liệu nặng bên ngoài; không sửa logic của các công cụ tools có sẵn; **không dịch EN ở phase này** (nội dung chỉ tiếng Việt — `/en/cam-nang` hiển thị `UntranslatedNotice` khi EN được bật lại).
- **Inputs:** Cấu trúc 9 phần *tham khảo* từ Zorva3D Handbook (**chỉ tham khảo cấu trúc — toàn bộ câu chữ và số liệu tự viết, không dịch/chép lại**); quy chuẩn in FDM và profile vật liệu tại BaSa3D; design system Tailwind hiện có.
- **Outputs:**
  1. `src/data/handbook/` (types, 9 sections dạng block có kiểu, bảng vật liệu, dung sai, lỗi in, checklist, tool links, checklist storage helpers).
  2. `src/components/storefront/handbook/` (`handbook-toc.tsx`, `interactive-checklist.tsx`, `material-table.tsx`, `tolerance-table.tsx`, `troubleshooting-table.tsx`, `tool-bridge.tsx`, `handbook-blocks.tsx`).
  3. `src/app/[locale]/(storefront)/cam-nang/page.tsx` (SSG, JSON-LD `TechArticle` + `BreadcrumbList`).
  4. Header & Footer storefront được cập nhật liên kết; `/cam-nang` vào sitemap.
  5. Tests tự động và cập nhật roadmap/decisions.

## Quyết định kỹ thuật (Freeze Scope)
1. **Kiến trúc tĩnh (Static Code-first):** Toàn bộ nội dung lưu trong `src/data/handbook/`, render tĩnh lúc build (SSG qua `generateStaticParams` của `[locale]/layout.tsx`). Không query DB. `page.tsx` **và** `generateMetadata` đều gọi `applyRequestLocale(params)` (ADR-0045); cấm `force-dynamic`, `cookies()`, `headers()`.
2. **Nội dung là block có kiểu, không phải HTML string:** `{ type: 'p' | 'list' | 'callout' | 'materials' | 'tolerances' | 'troubleshooting' | 'checklist' | 'tool' }` — render ở server, không `dangerouslySetInnerHTML` (ngoại trừ JSON-LD qua `serializeJsonLd`).
3. **URL Routing (B2):** Đường dẫn chính `/cam-nang` (VI không prefix, `localePrefix: 'as-needed'`). Redirect 308 trong `next.config.mjs` (chạy *trước* middleware) bằng **3 rule tường minh**, không dùng `/:locale/handbook` (sẽ bắt nhầm `/products/handbook`, `/blog/handbook`):
   - `/handbook` → `/cam-nang`
   - `/vi/handbook` → `/cam-nang` (tránh nhảy qua `/vi/cam-nang` rồi next-intl redirect lần 2)
   - `/en/handbook` → `/en/cam-nang` nếu EN bật, ngược lại → `/cam-nang` (tránh nhảy qua middleware 308 lần 2)
4. **Cầu nối hệ sinh thái (B1):** Data chỉ lưu `toolId`; URL và điều kiện hiển thị được resolve ở **một chỗ duy nhất** `src/data/handbook/tool-links.ts`. `/bao-gia` lọc theo `isBaoGiaEnabled()`; khi tắt → callout rơi về `/custom-print`. Test kiểm tra mọi `href` khớp một `page.tsx` có thật.
   - Chương 03 & 08 → `/bao-gia` (fallback `/custom-print`).
   - Chương 04 → `/tools/organizer`.
   - Chương 06 → `/tools/keychain-blocks` (móc khoá nhiều màu — route `/tools/keychain` **không tồn tại**).
   - Chương 07 → `/tools/hinge-box`.
   - Chương 09 → `/custom-print`.
5. **Ranh giới Server/Client:** Chỉ 3 island `'use client'`: `HandbookToc`, `InteractiveChecklist`, `MaterialTable` (bộ lọc). Island **chỉ nhận dữ liệu qua props** từ server; cấm import `sections.ts` trong file client (test kiểm tra). Không bọc bài viết trong Context Provider.
6. **Scroll-spy:** Observe thẻ `<section>`, `rootMargin: '-112px 0px -55% 0px'`, `threshold: 0` (một ngưỡng). Active = section trên cùng đang giao cắt; không có thì giữ nguyên; chỉ `setState` khi id đổi. **Không throttle** (IO vốn async). Click TOC → set active ngay, khoá observer tới `scrollend` (fallback 800 ms). Tôn trọng `prefers-reduced-motion`. `scroll-mt-28` cho section.
7. **Mobile TOC:** thanh tab cuộn ngang `sticky top-16 z-30` (không `fixed` — `template.tsx` có animation transform; không đặt trong `<header>` vì backdrop-filter). Tab active được đưa vào khung nhìn bằng `container.scrollTo({ left })`, **không** `scrollIntoView()` (iOS kéo cả trang dọc).
8. **Interactive Checklist:** key `basa3d_preflight_checklist:v1`, lưu **id ổn định** (không index). Server render + lần hydrate đầu = tất cả chưa tick; chỉ đọc storage sau mount. `localStorage` là input bên ngoài (Rule #6): `try/catch`, parse + validate, bỏ id lạ — hàm thuần `parseChecklistState`/`serializeChecklistState` có unit test. Đồng bộ đa tab qua sự kiện `storage`. Có nút "Bắt đầu bài in mới".
9. **SEO:** JSON-LD `TechArticle` + `BreadcrumbList` (bỏ `HowTo` — Google ngừng rich result 2023; không `FAQPage` vì không có khối FAQ). `dateModified` = hằng `HANDBOOK_UPDATED_AT` (không dùng thời điểm build). `alternates` qua `localeAlternates('/cam-nang')`. Thêm vào `src/app/sitemap.ts`.

## Rủi ro & Cách khắc phục
- **Nội dung dài gây giật khi cuộn trên máy yếu:** IO một ngưỡng, không lắng nghe `scroll`, island nhỏ; phần còn lại là HTML tĩnh.
- **Khách hiểu nhầm bảng thông số là cam kết tuyệt đối:** disclaimer đầu trang: *"Mọi con số là điểm khởi đầu để hiệu chỉnh trên từng máy và cuộn nhựa cụ thể, không phải kết quả đo đơn nhất."*
- **Số liệu kỹ thuật sai làm mất uy tín (data integrity của trang):** bảng nhiệt độ/dung sai/lỗi in **phải được OWNER/thợ xưởng duyệt từng con số** trước khi deploy production.
- **Bản quyền/SEO trùng lặp với Zorva3D:** chỉ tham khảo cấu trúc chương; nội dung tự viết.

## Các lát cắt công việc (Checklist thực thi)
- [x] **Lát cắt A: Dữ liệu & Types (`src/data/handbook/`)**
  - [x] `types.ts`, `sections.ts` (9 chương, block có kiểu, `HANDBOOK_TOC` = id + số + tiêu đề — server truyền xuống TOC qua props).
  - [x] `materials.ts` (7 nhóm vật liệu), `tolerances.ts`, `troubleshooting.ts` (6 lỗi), `checklist.ts` (7 bước).
  - [x] `tool-links.ts` (resolve `toolId` → href, lọc cờ `bao-gia`).
  - [x] `src/lib/handbook/checklist-storage.ts` (parse/serialize thuần — để ngoài `src/data/handbook/` vì island client cần import giá trị từ đây).
- [x] **Lát cắt B: UI Components (`src/components/storefront/handbook/`)**
  - [x] `handbook-toc.tsx` (client), `interactive-checklist.tsx` (client), `material-table.tsx` (client, bộ lọc).
  - [x] `tolerance-table.tsx`, `troubleshooting-table.tsx`, `tool-bridge.tsx`, `handbook-blocks.tsx` (server).
- [x] **Lát cắt C: Trang Cẩm nang & Routing**
  - [x] `src/app/[locale]/(storefront)/cam-nang/page.tsx` (hero, breadcrumb, disclaimer, `UntranslatedNotice` cho EN).
  - [x] Metadata + JSON-LD `TechArticle` & `BreadcrumbList`.
  - [x] 3 redirect tường minh trong `next.config.mjs`; `/cam-nang` vào sitemap.
- [x] **Lát cắt D: Header & Footer** — key `nav.handbook` (vi/en), link trong nhóm "Liên kết" của Footer.
  - [x] **D2 (OWNER 2026-10-26): dropdown "Kiến thức in 3D ▾"** trên Header (giống Zorva3D): Cẩm nang, Tra lỗi in (`#xu-ly-loi`), Bảng vật liệu (`#vat-lieu`), Dung sai (`#dung-sai`), Công cụ, Ghi chép xưởng (Blog, theo `blogEnabled`) — mỗi mục có tiêu đề + mô tả. Cẩm nang và Blog rời khỏi thanh chính → desktop còn 6 mục. Desktop: hover (chỉ chuột) + click/Enter, Esc, click ra ngoài, rời focus đều đóng; mẫu disclosure, không phải ARIA menu. Mobile: hiện thành nhóm có tiêu đề trong drawer. Cấu hình ở `src/config/knowledge-nav.ts` (không import nội dung cẩm nang vào Header).
- [ ] **Lát cắt E: Kiểm thử & Quality Gate**
  - [x] `tests/phase-50-handbook.test.ts`: dữ liệu 9 chương, id duy nhất, href tool khớp route thật, lọc cờ `bao-gia`, parse/serialize checklist, redirect rules, guard SSG + guard import client.
  - [x] `eslint` (file đổi), `tsc --noEmit`, `tests/phase-50-handbook.test.ts` 19/19, các test liên quan (i18n parity, security headers, motion, EN-off routing) xanh; `next build` → `● /[locale]/cam-nang` 6.21 kB, `x-nextjs-cache: HIT`; `/handbook`, `/vi/handbook`, `/en/handbook` → 308 một bước tới `/cam-nang`; `/products/handbook` không bị redirect; chữ của 9 chương không có trong `.next/static` (chỉ trong HTML/RSC). *(Kiểm chứng 2026-10-26 trên bản sao sandbox Linux, Google Fonts được stub; cần chạy lại `npm test` đầy đủ có DB trên máy dev.)*
  - [ ] Kiểm tra thủ công trên thiết bị thật 375px: thanh tab sticky, scroll-spy, checklist reload.
  - [ ] OWNER duyệt số liệu kỹ thuật; cập nhật `docs/roadmap.md` và `docs/architecture/decisions.md` khi đóng phase.

## Definition of Done
1. `/cam-nang` render đủ 9 chương, không gọi API/DB; output `next build` đánh dấu `/[locale]/cam-nang` là `●` (SSG).
2. `/handbook`, `/vi/handbook`, `/en/handbook` redirect 308 **một bước** tới đúng đích; `/products/handbook` không bị redirect.
3. Mục lục tự làm nổi bật chương đang xem (desktop sidebar + mobile tab ngang) mà không giật ở 375px.
4. Checklist không lỗi hydration, giữ trạng thái khi reload, an toàn khi storage bị chặn/hỏng.
5. Mọi link tool trỏ tới route có thật; `/bao-gia` ẩn đúng khi cờ tắt.
6. `tsc`, `lint`, `test` và `build` xanh 100%.
