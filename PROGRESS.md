# BaSa3D — PROGRESS (shared session state)

> File trạng thái chung cho **mọi agent** (Claude, Codex, Gemini, swarm) và Owner.
> Đọc file này ở **Session start**, cập nhật ở **Session end** (xem `AGENTS.md` → "Session lifecycle").
> Ngắn gọn: chỉ trạng thái hiện tại + việc tiếp theo. Chi tiết nằm trong `docs/exec-plans/active/*.md`.

## Current State

- Branch tích hợp: `dev` · Deploy: `netlify` / `vercel`
- Last verified: `dev` sau khi merge Phase 55 + 56 (2026-11-17, bản cài sạch Linux: `npm ci`, lint, typecheck, `check:arch`, `next build` 15.5.29 đều xanh)
- `npm test` (132 file, server chạy): 962 test, 929 pass, 14 fail — cả 14 có sẵn trên `223af23`: `ai-news` (6), `blog-review` (4), `makerworld-estimate` (1), `phase-15-staff-notification-failure` (1), `stl-import-cli` (2). Chưa chạy Playwright.
- `npm run check:arch`: passing
- Chưa merge `dev` → `netlify`: chưa có E2E và chưa ai xem UI mới (nav mobile, trang chi tiết sản phẩm).

## In Progress (WIP = 1 per agent)

Mỗi agent chỉ có **một** mục active tại một thời điểm. Ghi: agent · branch · exec-plan · bước đang làm.

| Agent | Branch | Exec-plan | Đang làm |
|---|---|---|---|
| Codex | `feat/neobox-lightbox-generator` | `active/feature-neobox-lightbox.md` | chạy `check:agent`, soát UX + xuất 3MF/STL |
| Gemini | `feat/trend-radar-model-search` | `active/feature-trend-radar-model-search.md` | Hoàn thành Slice 1, 2, 3 (Trend Radar, Visual Search, Ecosystem Hub); lint, typecheck, build xanh |
| Claude | `chore/harness-engineering` | — (harness setup) | review/verify harness |
| Claude (Cowork) | `dev` (đã merge `feat/phase-55-…` + `fix/phase-56-…`) | `active/phase-55-…md`, `active/phase-56-…md` | xong; chờ OWNER xem UI + E2E rồi merge `netlify` |

## Next Steps

1. Owner triage bảng "Active plans" bên dưới (đóng / chuyển `pending/` / giữ).
2. Merge `chore/harness-engineering` → `dev` sau khi Owner review.
3. Owner duyệt Phase 54 / 54.1 / 54.2 (KANBAN cột Review) → chạy `close-phase`.

## Blockers / Waiting on Owner

- Phase 55: chờ Owner chạy `npm run build` + Playwright trên macOS và xem nav mobile / trang chi tiết sản phẩm (sandbox không build được Next).
- `tests/phase-28-admin-pagination.test.ts:73` đang fail từ Phase 54.2 (thiếu `blogDrafts` trong expectation) — cần sửa test.
- Phase 53, 54.x: chờ Owner nghiệm thu nội dung (KANBAN → Review).
- Phase 35/36: chờ Owner chạy test trên DB disposable (xem status trong plan).
- Phase 56 (`fix/phase-56-security-legal-hardening`, plan `active/phase-56-security-legal-hardening.md`): chờ Owner `npm install` (next 15.5.29) + build, xác nhận `NEXT_PUBLIC_SITE_URL`/domain, điền `NEXT_PUBLIC_BUSINESS_*`, duyệt chính sách bảo mật.

## Active plans — triage (snapshot 2026-11-17)

`docs/exec-plans/active/` chỉ nên chứa plan **đang làm thật**. Bảng dưới là snapshot lúc dọn;
Owner quyết định từng dòng. Prompt/challenge/review đã chuyển sang `docs/exec-plans/prompts/`.

| Plan | Checkbox | Sửa lần cuối | Gợi ý |
|---|---|---|---|
| phase-54-1-ai-news-hardening | 20/20 | 11-01 | Owner review → `close-phase` |
| phase-54-2-blog-review-media | 15/15 | 11-01 | Owner review → `close-phase` |
| phase-54-daily-ai-news | 11/11 | 11-01 | Owner review → `close-phase` |
| makerworld-profile-verification-and-instant-quote | 10/10 | 10-12 | Kiểm tra đã ship chưa → `close-phase` |
| phase-52-admin-catalog-restock-ux | 23/24 | 10-27 | KANBAN ghi Done — tick nốt hoặc ghi follow-up |
| phase-50-handbook | 16/19 | 10-26 | KANBAN ghi Done — tick nốt hoặc ghi follow-up |
| phase-43-storefront-motion | 22/23 | 10-21 | Gần xong |
| phase-44-app-versioning | 9/10 | 10-21 | Gần xong |
| phase-41-admin-executive-dashboard | 8/9 | 10-21 | Gần xong |
| makerworld-screenshot-estimate | 8/9 | 10-15 | Gần xong |
| phase-34-security-hardening | 25/28 | 10-14 | Chờ test DB disposable |
| phase-42-storefront-caching | 7/9 | 10-21 | Đang dở |
| feature-003-stl-bulk-import | 14/17 | 10-22 | Đang dở |
| phase-33-bao-gia-instant-quote | 42/57 | 10-13 | KANBAN Backlog (calibration) |
| phase-53-handbook-interactive | 22/33 | 10-28 | KANBAN Review |
| phase-36-data-integrity | 6/12 | 10-15 | **Ưu tiên** (data integrity) |
| phase-29-copyright-compliance | 6/9 | 09-09 | Cũ — quyết định giữ/hoãn |
| phase-47-printpaws-rea | 8/16 | 10-22 | Đang dở |
| phase-40-multicolor-purge-transparency | 4/10 | 10-21 | Đang dở |
| phase-38-upload-500-hotfix | 4/9 | 10-21 | Hotfix — xác nhận đã fix chưa |
| phase-46-keychain-rea | 4/9 | 10-21 | Đang dở |
| phase-51-netlify-free-deploy | 10/34 | 10-26 | KANBAN Backlog |
| phase-28-admin-performance-ux | 3/13 | 09-24 | KANBAN Backlog → cân nhắc `pending/` |
| phase-32-model-library | 3/28 | 10-21 | Draft → cân nhắc `pending/` |
| phase-35-golive-hardening | 0/7 | 10-15 | Chờ Owner chạy check |
| makerworld-phase-a-release-plan | 0/16 | 10-12 | Draft → cân nhắc `pending/` |
| makerworld-phase-b-storefront-estimate | 0/3 | 10-12 | Draft → cân nhắc `pending/` |
| go-live-deployment-plan | — | 09-24 | Draft → cân nhắc `pending/` |
| pet-bowl-stand-mvp-brief | — | 10-22 | Brief → `pending/` hoặc speckit |

## Handoff log (mới nhất ở trên, tối đa ~10 dòng — cũ hơn thì xoá, git giữ lịch sử)

- 2026-11-24 · Gemini · `feat/trend-radar-model-search` · Nâng cấp toàn diện: (1) Cầu nối 1-Click Săn mẫu -> Đăng bán Catalog (`/basaadmin/products/new` tự tính giá bán từ gram/phút in và điền sẵn); (2) Tích hợp Smart Search vào trang Báo giá `/bao-gia`; (3) Nút xem bàn in & tải 3MF trực tiếp trong Trend Hunter. Lint, typecheck, arch và production build Next.js 15.5 đều xanh.

- 2026-11-17 · Claude (Cowork) · `dev` · Merge Phase 55 + 56. Phase 56: next 15.5.29, cache blog/sitemap, lọc tham số `/products`, link khách theo `NEXT_PUBLIC_SITE_URL`, chính sách bảo mật, thông tin chủ thể ở footer; lockfile đồng bộ lại (`npm ci` trước đó fail). Thêm hỏi xác nhận trước khi xoá hẳn sản phẩm/biến thể.
- 2026-11-17 · Claude (Cowork) · `feat/phase-55-admin-staff-ux` · Phase 55: nav admin dùng được trên mobile, đổi nhãn menu kho, tìm đơn/yêu cầu theo SĐT-mã-tên, nhân bản sản phẩm, đăng/lưu trữ hàng loạt, trang chi tiết có danh mục + mô tả; sửa lỗi Lưu trang chi tiết xoá mất mô tả. Chưa build/chưa xem UI (sandbox) — xem Evidence trong plan.
- 2026-11-17 · Claude · `chore/harness-engineering` · Thêm harness: PROGRESS.md, session lifecycle trong AGENTS.md, tách prompts khỏi `active/`, `.nvmrc`, `test:e2e`, `check:arch`, CI `check:agent`, pre-push hook. Đóng `feature-book-maker` (25/25).
