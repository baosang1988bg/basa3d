# Phase 44 — Đánh version cho web (dev / preview / production)

> Yêu cầu OWNER (2026-10-21): đánh version cho web, gồm bản dev và bản production.
> OWNER đồng ý hướng "một dãy version, môi trường là nhãn" và nhờ implement; chưa chọn SemVer/CalVer
> → lấy mặc định đã đề xuất: **SemVer**. Người làm: Claude. ADR-0046.

## Brief (Step 1)
- **Goal:** mọi bản build tự biết và tự nói ra nó là **version nào, build từ commit nào, chạy ở môi trường nào**;
  bản production được đánh dấu bằng git tag; có CHANGELOG.
- **Non-goals:** tự động bump version / tự sinh changelog từ commit (semantic-release, changesets — thêm dependency,
  chưa cần); version DB (migration Supabase giữ nguyên cơ chế riêng); hiện version cho khách trên storefront.
- **Inputs:** `package.json` (`0.1.0`, chưa từng dùng), nhánh `dev`/`main`, Vercel (Preview qua Git, Production qua
  `scripts/deploy/qc-deploy-vercel.mjs` = `git archive HEAD` → `vercel deploy --prod` **không có thông tin git**).
- **Outputs:** build info inline lúc build; `/api/version`; dòng version ở footer admin; badge môi trường trên bản
  non-production; deploy script truyền commit + kiểm tra đúng bản đã lên + tạo tag; `CHANGELOG.md`; runbook.

## Quyết định (freeze)
1. **SemVer, một dãy duy nhất.** `package.json.version` = **version đang chuẩn bị phát hành** (bản kế tiếp).
   Bắt đầu từ **`1.0.0`** (bản production đầu tiên có version; trước đó không đánh version — lịch sử ở `docs/roadmap.md`).
2. **Kênh (channel)** tính lúc build: `APP_CHANNEL` (ghi đè) → `VERCEL_ENV` (`production`/`preview`) → `development`.
3. **Nhãn hiển thị:** production = `1.0.0`; khác production = `1.0.0-preview.a1b2c3d` / `1.0.0-development.a1b2c3d`.
   Đúng ngữ nghĩa SemVer: pre-release `-preview…` **đứng trước** `1.0.0` — đúng là bản chưa phát hành của 1.0.0.
4. **Commit:** `APP_COMMIT_SHA` (deploy script truyền bằng `vercel deploy --build-env`) → `VERCEL_GIT_COMMIT_SHA`
   (Preview qua Git) → `git rev-parse HEAD` (máy local) → `unknown`.
5. **Inline lúc build** qua `env` trong `next.config.mjs` → giá trị cố định theo bản build, dùng được ở server và
   client, không đọc `package.json` lúc chạy (không bundle cả file vào client), không ảnh hưởng trang static.
6. **Nơi hiển thị:** footer sidebar admin (`v1.0.0 · Production · a1b2c3d`); `GET /api/version` (JSON, static
   theo bản build); `<meta name="app-version">` trên mọi trang; badge nhỏ góc trái dưới **chỉ ở preview/development**
   để không nhầm bản thử với production. Storefront production không hiện gì thêm cho khách.
7. **Production release = deploy script:** truyền commit; sau deploy gọi `/api/version` và **so commit** với HEAD
   (bắt được trường hợp alias production chưa trỏ sang bản mới); smoke xanh thì hỏi tạo **annotated tag `v<version>`**
   tại HEAD (không tự push). Version đã có tag ở commit khác → cảnh báo "chưa bump version".
8. Sau mỗi lần release: bump `package.json` trên `dev` (`npm version minor --no-git-tag-version`), thêm mục mới
   vào `CHANGELOG.md`. Quy ước bump: feature → minor, chỉ sửa lỗi → patch, đổi phá vỡ (URL/API công khai) → major.

## Rủi ro
- `/api/version` công khai lộ commit SHA (repo private) và version — không chứa bí mật; chấp nhận để tiện hỗ trợ.
- Preview qua Git integration của Vercel clone nông, không có tag → không dùng `git describe`; nhãn chỉ dựa
  `package.json` + SHA (đã đủ).
- Quên bump version sau release → bản dev mang version đã phát hành; deploy script cảnh báo khi tag đã tồn tại ở
  commit khác.

## Lát cắt
- [ ] A. `next.config.mjs` tính build info → `env`; `src/config/build-info.ts` (đọc + format nhãn).
- [ ] B. `src/app/api/version/route.ts` (force-static).
- [ ] C. Hiển thị: footer `AdminNav`, `EnvironmentBadge` + meta trong `HtmlShell`.
- [ ] D. `qc-deploy-vercel.mjs`: `--build-env APP_COMMIT_SHA`, smoke `/api/version`, cảnh báo version/tag, tạo tag.
- [ ] E. `package.json` → `1.0.0`; `CHANGELOG.md`; `docs/operations/versioning.md`; ADR-0046; roadmap.
- [ ] F. Tests `tests/phase-44-app-versioning.test.ts`.

## Definition of Done
- [ ] typecheck, lint, test (không DB) xanh; build không DB xanh, số trang static không đổi.
- [ ] `/api/version` trả đúng version/commit/channel trong 3 kịch bản build (local, preview, production giả lập).
- [ ] OWNER: lần deploy production kế tiếp chạy script mới → tag `v1.0.0` được tạo và push (`git push origin v1.0.0`).
