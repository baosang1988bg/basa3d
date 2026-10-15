# Chạy & test BaSa3D trên máy local

Có 3 mức, chọn theo việc cần làm. Mức 1 đủ để tự bấm thử tính năng MakerWorld Phase A. Mức 2–3 là test tự động.

Yêu cầu chung: **Node.js ≥ 22** (`nvm install 22 && nvm use 22`), đã chạy `npm install`.

---

## Mức 1 — Bấm thử bằng tay (nhanh nhất, ~5 phút)

Dùng Supabase **Development** mà `.env` hiện tại đang trỏ tới. MakerWorld Phase A **không có migration**, nên không cần chạy SQL gì thêm.

1. Kiểm tra `.env` có đủ:
   - `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (project Development, **không phải Production**).
   - `ORDER_CONFIRMATION_SECRET` ≥ 32 ký tự (thiếu thì link báo giá public lỗi 500). Tạo bằng `openssl rand -hex 32`.
2. `npm run dev` → mở `http://localhost:3000/admin/login`, đăng nhập tài khoản OWNER/STAFF.
3. Cần có sẵn: 1 `pricing_configs` hiện hành, ít nhất 1 vật liệu PLA đang active, 1 custom request.

### Checklist bấm thử MakerWorld Phase A

Mở 1 custom request → khối "Báo giá" → tab **Từ link MakerWorld** (mặc định).

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Dán `https://makerworld.com/en/models/3246150` (không có `#profileId`) → **Tự động lấy dữ liệu** | Dropdown có 3 profile, **chưa chọn sẵn** profile nào. Dòng license "Standard Digital File License … Báo giá theo chính sách In giúp cá nhân…" |
| 2 | Nếu bước 1 báo MakerWorld chặn (Cloudflare) | Ô **Nhập tay thông số** tự mở. Dán `0.2mm layer, 2 walls, 15% infill · P1S · 7.4 h · 6 plates · 168 g · No AMS` → **Tách thông số** → các ô được điền → **Dùng thông số này** |
| 3 | Chọn profile `0.2mm layer, 2 walls, 15% infill` | Card viền xanh: P1S · 7.4h · 6 plates · 168g · NO AMS |
| 4 | Chọn cuộn nhựa cho từng màu, chọn **Bản kit (tự ráp)** | Hao phí mặc định 5% (No-AMS), thời gian thao tác 20 phút, hiện "Giá đề xuất" |
| 5 | Bấm **Dùng giá này** khi chưa tick xác nhận | Nút bị khoá |
| 6 | Tick "Đã xác nhận đúng profile…" → **Dùng giá này** | Ô Tạm tính/Tổng tiền được điền |
| 7 | Đổi sang profile khác trong dropdown | Ô Tạm tính/Tổng tiền **bị xoá trắng** |
| 8 | Chọn lại profile, tính lại, điền "Hiệu lực đến" → **Tạo báo giá** | Báo giá mới hiện trong bảng, dưới mã có tên profile + "Bản kit (tự ráp)" |
| 9 | Copy link Zalo → mở tab ẩn danh | Trang báo giá có card "Mẫu & profile in đã xác nhận" |
| 10 | Tạo thêm báo giá **Bản hoàn thiện** cùng link → bấm **Chấp nhận** 1 trong 2 | Báo giá còn lại tự chuyển `REJECTED`, chỉ tạo 1 print job |
| 11 | Chuyển tab **Công cụ tính giá** | Panel MakerWorld biến mất, ô giá bị xoá — chỉ 1 công cụ hoạt động |

### Checklist bấm thử Phase B (Storefront)

Cần chạy migration `20261013000000_makerworld_storefront_pricing.sql` trên DB Dev trước.

| # | Thao tác | Kỳ vọng |
|---|---|---|
| B1 | Admin: báo giá 1 profile như checklist trên tới bước "Dùng giá này", chọn **Bản kit** → bấm **Lưu làm giá Storefront**; chọn **Bản ráp sẵn** → Dùng giá này → Lưu lần nữa | Hiện "Đã lưu giá Storefront: …đ" cho từng phương án |
| B2 | Mở `/admin/settings/makerworld-prices` | 2 dòng (Ráp sẵn, Kit), cột "Giá hiện tại" có số |
| B3 | Mở `/custom-print` (tab ẩn danh) → dán đúng link đó → **Xem giá** | Chip "Giá BaSa3D đã kiểm tra", card profile, 2 giá **khớp** cột "Giá hiện tại" ở B2 |
| B4 | Dán link một mẫu chưa duyệt | Không hiện giá, thông báo "chưa có giá sẵn", vẫn gửi yêu cầu được |
| B5 | Gửi yêu cầu: 2 ô xác nhận **không** được tick sẵn; thiếu tick → báo lỗi; tick đủ → gửi | Hiện mã `CR-…` |
| B6 | Admin mở custom request vừa tạo | Khối xanh "Yêu cầu từ MakerWorld" với giá khách đã thấy; panel MakerWorld đã điền sẵn link + phương án |
| B7 | Tạo cấu hình giá mới (đổi giá công) → quay lại B3 | Giá storefront đổi theo (tự cập nhật) |

### Checklist bấm thử báo giá tức thì (ADR-0034)

Cần chạy thêm migration `20261014000000_custom_request_quote_estimate.sql`.

| # | Thao tác | Kỳ vọng |
|---|---|---|
| C1 | `/custom-print` → dán link MakerWorld chưa duyệt → Xem giá | Báo không đọc được/ chưa có giá **và** hiện ô "Xem giá ngay bằng thông số profile" |
| C2 | Dán `0.2mm layer, 2 walls, 15% infill · P1S · 7.4 h · 6 plates · 168 g · No AMS` → "Tính giá từ thông số" | Chip "Giá ước tính từ thông số bạn dán", 2 giá ráp sẵn/kit dạng `~xxx.000đ` |
| C3 | Gửi yêu cầu từ C2 → admin mở request | Giá khách đã thấy ghi "ước tính từ thông số khách dán" + dòng thông số khách dán |
| C4 | Form "Tải file lên để xem giá ngay": tải 1 file **.3mf đã slice** | Hiện giờ in, gram, số plate + giá (2 phương án nếu > 1 plate); **chưa** thấy ô họ tên/SĐT |
| C5 | Tải 1 file **.stl** | Hiện kích thước mm + **khoảng giá** `a – b` |
| C6 | Tải .3mf **chưa slice** / .step / ảnh | Thông báo phù hợp, không có giá, vẫn gửi yêu cầu được |
| C7 | Đổi vật liệu sang PETG | Giá tính lại (nếu có cuộn PETG có giá; không có → "Chưa có giá tự động cho vật liệu này") |
| C8 | "Ưng giá — đặt in mẫu này" → điền liên hệ → gửi → admin mở request | Khối vàng "Giá tự động khách đã thấy (từ file)" đúng phương án/giá |
| C9 | Công cụ tạo mẫu (vd móc khoá) → "Hoàn tất yêu cầu" | Form liên hệ hiện ngay như cũ, không hiện thêm giá |

Lưu ý: gọi MakerWorld từ máy Mac của bạn (IP nhà) ít bị Cloudflare chặn hơn so với từ Vercel (IP datacenter). Kết quả "lấy được dữ liệu" ở local **không** đảm bảo Production cũng lấy được — xem log `[MAKERWORLD_RESOLVER]` sau khi deploy.

---

## Mức 2 — Test tự động với PostgreSQL local (không cần Docker)

Chạy được các test service/DB (B10, auto-reject, schema, resolver…). Không chạy được các test cần server Next + Supabase Auth (xem Mức 3).

```bash
# 1 lần: cài PostgreSQL (hoặc dùng Postgres.app)
brew install postgresql@16
brew services start postgresql@16
createdb basa3d_test
```

Thêm vào `.env` (chỉ host localhost được chấp nhận — script và test đều chặn DB online):

```
TEST_DATABASE_URL=postgresql://localhost:5432/basa3d_test
```

```bash
npm run test:db:setup -- --reset   # tạo lại DB test + chạy toàn bộ migration (có stub auth/storage)
npm run test:db:setup              # lần sau: chỉ chạy migration mới

# Test MakerWorld Phase A + các test DB liên quan
node --import tsx --test --test-concurrency=1 \
  tests/makerworld-profile-verification.test.ts \
  tests/phase-13-makerworld-resolver.test.ts \
  tests/phase-3-quote-print-job.test.ts \
  tests/pricing-snapshot-integration.test.ts \
  tests/domain-schemas.test.ts
```

Một số test DB khác (`filament-management`, `phase-28-*`, `phase-2-services` "overlapping order", `pricing-config-service`, thông báo Resend) phụ thuộc dữ liệu seed/cấu hình riêng và đang fail giống nhau trên DB local trắng **kể cả trước Phase A** — không phải lỗi do thay đổi mới.

**Phase 36 — hai nguyên nhân thật của các fail "seed" ở trên:**
- `supabase/seed.sql` phải chạy **ngay sau** migration đầu tiên (`20260830000000`), trước các migration còn lại — migration seed Phase 12 tự tạo warehouse `MAIN` với id ngẫu nhiên, nên chạy seed sau cùng sẽ lỗi trùng `code` và test thiếu warehouse `…000000000010`. Cách làm: `--reset`, áp riêng migration đầu, chạy `seed.sql`, rồi `npm run test:db:setup` cho phần còn lại.
- Postgres Homebrew lấy TimeZone của máy (`Asia/Ho_Chi_Minh`). Trước Phase 36, default `timezone('utc', now())` lưu lệch −7 giờ trong session đó → `pricing-config-service` và rate limit theo SĐT của `phase-4`/`phase-5` fail. Migration `20261019000000` sửa tận gốc (dùng `now()`).

Không chạy `npm test` ở mức này: khi có `TEST_DATABASE_URL`, `npm test` sẽ build + bật server Next, mà middleware cần Supabase Auth → server không lên được.

Typecheck/lint/build thì chạy bình thường: `npm run typecheck && npm run lint && npm run build`.

---

## Mức 3 — `npm test` đầy đủ + E2E Playwright (cần Docker Desktop)

Dùng Supabase local (Postgres + Auth + Storage thật) qua Supabase CLI.

```bash
# 1 lần
npx supabase init            # tạo supabase/config.toml (giữ nguyên thư mục migrations hiện có)
npx supabase start           # tự áp dụng supabase/migrations/*.sql
npx supabase status          # lấy API URL, anon key, service_role key, DB URL
```

Thêm vào `.env` (giá trị lấy từ `supabase status`):

```
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
TEST_SUPABASE_URL=http://127.0.0.1:54321
TEST_SUPABASE_ANON_KEY=<anon key>
TEST_SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

```bash
npm test                                      # unit + integration + route×role matrix
npx playwright install chromium               # lần đầu
npx playwright test e2e/makerworld-quote.spec.ts e2e/pricing.spec.ts
npx playwright test                           # toàn bộ E2E
npx supabase db reset                         # khi muốn DB test sạch lại
npx supabase stop                             # tắt khi xong
```

Ghi chú: Claude chưa tự chạy được Mức 3 (môi trường của Claude không có Docker). Nếu `supabase start` báo lỗi migration, gửi log lại để sửa.

---

## Test trên Vercel Preview

Muốn test trên môi trường gần Production nhất (IP datacenter, env Preview) trước khi lên Production: xem `docs/exec-plans/active/makerworld-phase-a-release-plan.md`.
