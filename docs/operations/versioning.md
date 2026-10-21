# Versioning & release (Phase 44, ADR-0046)

## Mô hình
- **Một dãy version SemVer** cho cả web. `package.json` → `version` = version **đang chuẩn bị** phát hành.
- **Môi trường là nhãn, không phải version riêng.** Cùng một version đi qua Dev → Preview → Production, giống
  một build app đi qua TestFlight rồi lên App Store.

| Kênh (`channel`) | Khi nào | Nhãn | Ví dụ |
|---|---|---|---|
| `development` | `npm run dev` / build trên máy | `<version>-development.<sha7>` | `1.1.0-development.a1b2c3d` |
| `preview` | Vercel Preview (`VERCEL_ENV=preview`) | `<version>-preview.<sha7>` | `1.1.0-preview.a1b2c3d` |
| `production` | Vercel Production (`VERCEL_ENV=production`) | `<version>` | `1.1.0` |

Theo SemVer, `1.1.0-preview.x` **xếp trước** `1.1.0`: đúng nghĩa "bản thử của 1.1.0 chưa phát hành".

## Xem bản nào đang chạy
- Storefront: cuối footer, cạnh dòng bản quyền — `v1.1.0` (Preview: `v1.1.0-preview.a1b2c3d`), chữ mờ.
- Admin: dòng cuối sidebar — `v1.1.0 · Production · a1b2c3d` (rê chuột thấy thời điểm build).
- `GET /api/version` → `{ version, channel, commit, builtAt, label }`.
- View source bất kỳ trang: `<meta name="app-version" content="…">`.
- Bản Preview/Dev có tag nhỏ góc trái dưới (`PREVIEW · 1.1.0-preview.a1b2c3d`); Production không hiện.

Nguồn dữ liệu (tính một lần lúc build trong `next.config.mjs`, code ở `src/config/resolve-build-info.mjs`):
- channel: `APP_CHANNEL` (ghi đè thủ công) → `VERCEL_ENV` → `development`.
- commit: `APP_COMMIT_SHA` (script release truyền) → `VERCEL_GIT_COMMIT_SHA` → `git rev-parse HEAD` → `unknown`.

## Quy trình release production
1. Trên `dev`: `CHANGELOG.md` có mục cho version trong `package.json`, ghi ngày release.
2. Chạy quality gate (`.agents/skills/release-check`), merge vào nhánh release như thường lệ.
3. `node scripts/deploy/qc-deploy-vercel.mjs` — script sẽ:
   - cảnh báo nếu tag `v<version>` đã tồn tại ở commit khác (= quên bump version);
   - deploy kèm `APP_COMMIT_SHA` (bản `git archive` không có `.git`);
   - smoke `/api/version`: phải là đúng version, `production`, đúng commit vừa deploy;
   - smoke xanh → hỏi tạo **annotated tag** `v<version>` tại HEAD.
4. `git push origin v<version>` (script không tự push).
5. Bump version cho chu kỳ sau trên `dev`:
   ```bash
   npm version minor --no-git-tag-version   # tính năng mới
   npm version patch --no-git-tag-version   # chỉ sửa lỗi
   npm version major --no-git-tag-version   # thay đổi phá vỡ (URL/API công khai)
   ```
   rồi thêm mục `## [x.y.z] — chưa phát hành` vào đầu `CHANGELOG.md`, commit.

Hotfix production: sửa trên nhánh release, bump **patch**, chạy lại bước 3–4, rồi merge ngược về `dev`.

## Không thuộc phạm vi
- Version DB: migration Supabase giữ cơ chế riêng (`scripts/deploy/apply-pending-migrations.mjs`).
- Tự sinh changelog/bump từ commit (semantic-release, changesets): chưa cần, thêm dependency.
