# Trend Radar — hướng dẫn cho Owner (go-live UAT trên Vercel)

> Áp dụng cho: ADR-0060 (tính năng), ADR-0061 (deploy branch `vercel`), ADR-0062 (hardening), ADR-0063 (nâng cấp + xác minh).
> Exec plan: `docs/exec-plans/active/feature-trend-radar-model-search.md`. Cập nhật: 2026-11-25.

Checklist nhanh (làm theo thứ tự):

| # | Việc | Ai | Mục |
|---|---|---|---|
| 1 | Push `dev` + `vercel` | Owner | [§1](#1-push-và-deploy-uat) |
| 2 | Chạy 3 migration lên DB UAT (trước khi Vercel build xong) | Owner | [§2](#2-migration-lên-db-uat) |
| 3 | Kiểm tra / thêm biến môi trường trên Vercel | Owner | [§3](#3-biến-môi-trường-trên-vercel) |
| 4 | Gọi thử cron `trend-snapshots` | Owner | [§4](#4-kiểm-tra-cron-độ-nóng) |
| 5 | Chạy 16 test cần Supabase local | Owner / dev | [§5](#5-chạy-16-test-cần-supabase-local) |
| 6 | (Tuỳ chọn) Lấy `THINGIVERSE_APP_TOKEN` | Owner | [§6](#6-thingiverse-app-token-tuỳ-chọn) |
| 7 | Chốt chính sách license GPL/BSD/OCL… | Owner | [§7](#7-chốt-chính-sách-license) |
| 8 | Theo dõi MakerWorld bị Cloudflare chặn | Owner | [§8](#8-makerworld-bị-cloudflare-chặn) |
| — | Quy trình dùng hằng ngày cho nhân viên | Staff | [§9](#9-quy-trình-hằng-ngày-cho-nhân-viên) |

---

## 1. Push và deploy UAT

```bash
git checkout dev && git status          # sạch, không file lạ
git push origin dev
git push origin vercel                  # Vercel build từ nhánh vercel
```

- Agent (Claude/Gemini/Codex) **không** push/deploy — chỉ merge local (AGENTS.md).
- Vercel đang ở gói **Hobby = chỉ UAT/nội bộ** (ADR-0061). Không nhận khách thật / thanh toán VietQR thật
  trên Hobby — trước khi mở cho khách: nâng Pro hoặc quay lại Netlify (ghi ADR mới).

## 2. Migration lên DB UAT

Chạy **đúng thứ tự**, mỗi file một lần (Supabase → SQL Editor, dán nội dung file → Run; hoặc `psql`):

```bash
psql "$UAT_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261124000000_trend_watch_items.sql
psql "$UAT_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261125000000_trend_radar_upgrades.sql
psql "$UAT_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261126000000_storefront_search_fold.sql   # ADR-0064 tìm kiếm không dấu
```

Kiểm tra sau khi chạy (phải ra đủ 3 bảng, 2 trigger, cột mặc định là `now()`):

```sql
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('trend_watch_items', 'trend_watch_snapshots', 'visual_search_cache');

select tgname from pg_trigger where tgname in ('products_trend_publish_gate', 'trend_watch_items_link_gate');

select public.basa3d_search_fold('Giá Đỡ');   -- ADR-0064: phải ra 'gia do'

select table_name, column_name, column_default from information_schema.columns
 where table_schema = 'public' and column_default like 'timezone(''utc''%';   -- phải RỖNG
```

Rollback (chỉ khi cần gỡ hẳn tính năng — mất dữ liệu watchlist):

```sql
drop trigger if exists products_trend_publish_gate on public.products;
drop function if exists public.enforce_trend_publish_gate();
drop table if exists public.trend_watch_snapshots, public.visual_search_cache;
drop table if exists public.trend_watch_items cascade;
```

## 3. Biến môi trường trên Vercel

Vercel → Project → Settings → Environment Variables (Preview + Production):

| Biến | Bắt buộc? | Ghi chú |
|---|---|---|
| `CRON_SECRET` | Có (đã có) | ≥ 16 ký tự. Dùng chung cho cả 3 cron. |
| `GEMINI_API_KEY` | Có cho tìm bằng ảnh | Thiếu thì tìm bằng ảnh tự trả từ khoá gợi ý chung (không lỗi). |
| `VISUAL_SEARCH_MODEL` | Không | Mặc định `gemini-3.5-flash-lite`. **Không** dùng `gemini-2.5-flash` cho dự án mới (Google giới hạn). |
| `THINGIVERSE_APP_TOKEN` | Không | Xem §6. Không có thì mẫu Thingiverse hiện "License chưa lấy được". |

Sau khi đổi biến: Redeploy bản mới nhất của nhánh `vercel`.

## 4. Kiểm tra cron độ nóng

`vercel.json` đã có cron `/api/cron/trend-snapshots` chạy `30 3 * * *` UTC (≈ 10:30 sáng giờ VN). Gọi tay để thử:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<uat-domain>/api/cron/trend-snapshots
# → {"considered":N,"captured":N,"skipped":N,"timedOut":false,"prunedVisualCache":0}
curl -s -o /dev/null -w '%{http_code}\n' https://<uat-domain>/api/cron/trend-snapshots   # → 401 (không token)
```

- `captured` = số mẫu đã lưu số liệu hôm nay; `skipped` = nền tảng không trả số liệu (xem §8).
- Độ nóng ("+N lượt tải/ngày") chỉ hiện khi có **≥ 2 ngày** số liệu.
- Netlify (dự phòng) có sẵn `netlify/functions/trend-snapshots.mts` cùng lịch, batch nhỏ hơn (15 mẫu / 20 giây).

## 5. Chạy 16 test cần Supabase local

Sandbox của agent không có Docker nên 16 test này chưa chạy được ở đó (999 test còn lại không lỗi — 997 pass, 2 skip có chủ đích — sau khi merge `origin/dev`,
xem exec plan §6). Trên máy có **Docker Desktop**, làm theo `docs/operations/local-testing.md` → *Mức 3*:

```bash
npx supabase start
npx supabase status     # lấy URL + anon key + service_role key
# thêm TEST_DATABASE_URL / TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY vào .env
npm test
```

Các file cần xanh (đều dùng Supabase Auth admin hoặc Storage):

| File | Số test | Cần |
|---|---|---|
| `tests/phase-3-auth.test.ts` | 2 | Auth admin (tạo user) |
| `tests/phase-3-route-auth.test.ts` | 4 | Auth admin + server |
| `tests/phase-33-upload-route.test.ts` | 6 | Storage |
| `tests/phase-7-blog.test.ts` | 2 | Storage |
| `tests/phase-15-staff-notification-failure.test.ts` | 1 | Auth admin |
| `tests/phase-17-keychain-request-integration.test.ts` | 1 | Storage |

Chạy riêng nhóm này (nhanh hơn, vẫn cần `npm run build` trước cho test có server):

```bash
node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 \
  tests/phase-3-auth.test.ts tests/phase-3-route-auth.test.ts tests/phase-33-upload-route.test.ts \
  tests/phase-7-blog.test.ts tests/phase-15-staff-notification-failure.test.ts tests/phase-17-keychain-request-integration.test.ts
```

Nếu có test fail: gửi log cho agent kèm commit hash.

## 6. Thingiverse App Token (tuỳ chọn)

1. Đăng nhập Thingiverse → trang **Developers** (`https://www.thingiverse.com/developers`) → tạo app mới (loại Web App).
2. Sau khi tạo, copy **App Token** của app (không phải Client Secret).
3. Đặt vào Vercel: `THINGIVERSE_APP_TOKEN=<token>` → Redeploy.
4. Kiểm tra: trong `/basaadmin/trend-hunter` → *Bắt Mẫu URL* → dán link `https://www.thingiverse.com/thing:<id>` →
   badge license phải là tên license thật (vd. "Creative Commons - Attribution"), không còn cảnh báo "License chưa lấy được".

Token chỉ dùng phía server (`src/lib/trend/platform-sources.ts`), không bao giờ gửi xuống trình duyệt.
Giao diện trang Developers có thể đổi — nếu không thấy mục trên, xem tài liệu tại `https://www.thingiverse.com/developers/getting-started`.

## 7. Chốt chính sách license

Phân loại hiện tại (`src/lib/trend/license-safety.ts`, đã kiểm tra với **toàn bộ 23 license thật** của Printables
và mã ngắn của MakerWorld — xem test `license classifier against every live Printables license`):

| License | Kết quả hiện tại | Được bán thẳng? |
|---|---|---|
| CC0 / Public Domain | `COMMERCIAL_ALLOWED` | Có |
| CC-BY, CC-BY-SA, CC-BY-ND (MakerWorld: `BY`, `BY-SA`, `BY-ND`) | `COMMERCIAL_ALLOWED` | Có, **ghi công tác giả** |
| CC-BY-NC*, Standard Digital File License (MakerWorld mặc định) | `NON_COMMERCIAL` | Không — chỉ in gia công cá nhân |
| Printables "Commercial Use", "Commercial Use - No Derivative", Patreon/Club | `COMMERCIAL_SUBSCRIPTION` | Chỉ khi xưởng **đã mua** → cần link hoá đơn |
| GPL, LGPL, BSD, Apache-2.0, CERN-OHL, Open Community License (OCL, kể cả add-on) | `UNKNOWN` | Chưa — cần Owner quyết |

**Việc cần chốt:** nhóm cuối (`UNKNOWN`). Hệ thống hiện xử lý an toàn: vẫn tạo được sản phẩm nháp, nhưng **DB chặn
đưa lên web** cho tới khi chọn loại license + dán link bằng chứng. Nếu Owner muốn cho phép bán thẳng một license
(vd. GPL), báo agent: sửa regex trong `license-safety.ts` + đổi kỳ vọng trong test rồi ghi vào ADR-0063.

> Đây là quy tắc vận hành nội bộ, không phải tư vấn pháp lý. Khi nghi ngờ, đọc điều khoản trên trang gốc của mẫu.

## 8. MakerWorld bị Cloudflare chặn

MakerWorld chặn request server không có cookie (trả trang thử thách ~6 KB). Hệ quả trên Vercel:

- **Bắt mẫu bằng link MakerWorld** có thể báo "MakerWorld không phản hồi kịp hoặc đang chặn" → thử lại sau, hoặc nhập tay.
- **Cron độ nóng** sẽ đếm mẫu MakerWorld vào `skipped` (không lỗi). Printables / Thingiverse không bị ảnh hưởng.

Theo dõi: Vercel → Logs, lọc `[MAKERWORLD_RESOLVER]` và kết quả cron (§4). Nếu `skipped` luôn bằng số mẫu
MakerWorld trong nhiều ngày → báo agent để cân nhắc phương án khác (ghi ADR trước khi làm).

## 9. Quy trình hằng ngày cho nhân viên

1. `/basaadmin/trend-hunter` → tab **Nguồn Săn Trend**: mở các bảng xếp hạng (MW China, Douyin, Printables…).
2. Thấy mẫu hot → tab **Bắt Mẫu URL** → dán link → *Phân Tích & Bắt Mẫu* → xem badge bản quyền → **Lưu vào Watchlist**.
3. Tab **Watchlist**: chuyển trạng thái *Đang theo dõi → Đang in thử* khi in mẫu thử.
   Quy tắc chuyển: `WATCHING → PRINT_TESTING / CONVERTED_DRAFT / ARCHIVED`, `PRINT_TESTING → WATCHING / CONVERTED_DRAFT / ARCHIVED`,
   `CONVERTED_DRAFT → ARCHIVED`, `ARCHIVED → WATCHING`. Chỉ **OWNER** được xoá hẳn; nhân viên dùng *Lưu trữ*.
4. Bấm **Đăng bán** (hoặc *Bán (Cảnh báo)* nếu license chưa cho bán) → form tạo sản phẩm điền sẵn tên, giá gợi ý,
   link nguồn. Mẫu chưa được phép bán sẽ chọn sẵn **"Chưa rõ"** và hiện cảnh báo vàng.
5. Lưu nháp → mẫu trong Watchlist tự chuyển *Đã tạo SP nháp* và nút đổi thành *Đã tạo SP* (không tạo trùng được).
6. Muốn đưa lên web một mẫu chưa được phép bán: chọn **Có license** + loại license + dán **link bằng chứng**
   (hoá đơn / giấy phép). Nếu thiếu, hệ thống báo:
   *"Mẫu lấy từ Trend Radar chưa được xác nhận được phép bán…"* (mã `TREND_PUBLISH_BLOCKED`).

Mọi thao tác tạo / đổi trạng thái / xoá / chuyển thành sản phẩm đều được ghi vào **Nhật ký** (`audit_logs`,
`entity_type = 'trend_watch_item'`).

## 10. Tìm kiếm trên header (ADR-0064)

- Nút **kính lúp** trên header (desktop rộng hiện chữ "Tìm sản phẩm, mẫu 3D…", phím tắt **Ctrl/⌘ + K**). Đầu hộp có 3 bước hướng dẫn.
- Tab **Có sẵn tại BaSa3D** (mặc định): gợi ý ngay khi gõ, **không cần dấu** ("gia do" tìm được "Giá đỡ"), mọi từ phải khớp.
  Enter / "Xem tất cả" → `/products?q=…` (trang này cũng tìm không dấu).
- Không có trong shop → nút **Tìm mẫu 3D trên mạng** (giữ nguyên từ khoá) + **Gửi yêu cầu in**.
- Tab **Tìm mẫu 3D trên mạng** / **Tìm mẫu bằng ảnh**: cuối tab có ô **"Dán link vào đây để nhận báo giá"** → luôn về trang
  **Báo giá** `/bao-gia`: link MakerWorld được phân tích và ra giá ngay; link khác (Printables, Thingiverse…) mở tab *Tải file*
  kèm hướng dẫn tải STL/3MF về rồi kéo vào, hoặc gửi link qua Zalo. (Chỉ khi tắt `/bao-gia` mới quay về công cụ MakerWorld / form Đặt in.)
- Cuối hộp tìm kiếm (mọi tab) luôn có **"Chưa tìm được thứ bạn cần? Nhắn Zalo BaSa3D"** — theo dõi được trong GA4
  (`click_contact_channel`, placement `header_search_*` / `model_search_*` / `bao_gia_reference_link`).
- `/products` tìm không ra → nút **Tìm "…" trên kho mẫu 3D** mở thẳng hộp tìm kiếm.
- Admin → Dashboard → tab *Vận hành* → thẻ **Mẫu đang nóng** (top 5 mẫu Trend Radar tăng lượt tải nhanh nhất).
- Cần chạy migration `20261126000000_storefront_search_fold.sql` (§2) — thiếu thì tìm kiếm sản phẩm báo lỗi.

## 11. Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Watchlist báo "Không tải được Watchlist… migration" | Chưa chạy migration §2 | Chạy migration, tải lại trang |
| "Mẫu này đã có trong Watchlist" (409) | Link đã lưu trước đó | Tìm trong Watchlist |
| Tìm bằng ảnh luôn ra từ khoá chung | Thiếu `GEMINI_API_KEY` hoặc model không hợp lệ | §3 |
| "Bạn đã tìm bằng ảnh quá nhiều lần" (429) | Rate limit 20 lần/giờ/mạng | Đợi; ảnh đã tìm trước đó vẫn trả ngay (cache 30 ngày) |
| Cron trả 401 | Sai/thiếu `CRON_SECRET` | §3, §4 |
| Không xoá được mẫu (403) | Tài khoản STAFF | Dùng *Lưu trữ* hoặc nhờ OWNER |
| Tìm sản phẩm báo lỗi / `/products?q=` lỗi 500 | Chưa chạy migration `20261126000000_storefront_search_fold.sql` | §2 |
