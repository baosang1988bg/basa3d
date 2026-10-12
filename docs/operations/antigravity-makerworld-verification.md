# Task cho Antigravity — Áp migration Dev + kiểm thử MakerWorld Phase A/B

> Giao file này cho agent (Antigravity) chạy trên máy Mac của Owner, nơi đã đăng nhập Supabase và admin BaSa3D.
> Agent **chỉ chạy, kiểm tra và báo cáo** — không sửa code, không commit, không đụng Production.

---

## 0. Luật bắt buộc

1. **Chỉ làm trên Supabase Development.** Project ref phải là `nijkumwwcayjynbswowk` **và** trùng với host trong `NEXT_PUBLIC_SUPABASE_URL` của `.env`. Nếu dashboard ghi project là "prod"/"production", hoặc không chắc → **DỪNG, hỏi Owner**.
2. Không sửa file trong repo, không `git commit`/`git push`. Chỉ được xoá thư mục build `.next` nếu dev server lỗi.
3. Không chạy `npm run build` / `npm test` **trong lúc** `npm run dev` đang chạy (dùng chung `.next` → hỏng dev server). Tắt dev trước.
4. Không in mật khẩu / connection string / key ra log hay báo cáo.
5. Gặp lỗi không nằm trong file này → dừng bước đó, ghi lại nguyên văn lỗi, làm tiếp bước độc lập khác.

---

## 1. Chuẩn bị

```bash
cd ~/Documents/AI00/BaSa3D
node -v                      # phải >= 22
git log --oneline -12        # phải thấy 35d2c07 (docs ADR-0033) và c1407b8 (intake card)
git status --short           # chỉ được thấy: next.config.mjs, src/app/layout.tsx, .claude/, src/components/dev/, 2 file prompt — KHÔNG sửa chúng
grep -o 'https://[a-z0-9]*\.supabase\.co' .env   # phải là https://nijkumwwcayjynbswowk.supabase.co
```

---

## 2. Áp 2 migration lên Supabase Development

Thứ tự **bắt buộc**:
1. `supabase/migrations/20261012000000_enable_rls_public_tables.sql` — bật RLS mọi bảng `public` + thu hồi quyền `anon`/`authenticated` (sửa cảnh báo CRITICAL "RLS Disabled in Public").
2. `supabase/migrations/20261013000000_makerworld_storefront_pricing.sql` — thêm `makerworld_price_presets`, `makerworld_resolver_cache`, cột `custom_requests.makerworld_snapshot`.
3. `supabase/migrations/20261014000000_custom_request_quote_estimate.sql` — thêm cột `custom_requests.quote_estimate_snapshot` (chạy lại được, có `if not exists`).

### 2a. Kiểm tra trước (SQL Editor của project Dev → New query → Run)

```sql
select
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity) as tables_without_rls,
  to_regclass('public.makerworld_price_presets') is not null as phase_b_tables_exist,
  exists (select 1 from information_schema.columns where table_name = 'custom_requests' and column_name = 'makerworld_snapshot') as snapshot_column_exists,
  (select count(*) from pricing_configs where effective_from <= timezone('utc', now())) as active_pricing_configs;
```

Ghi lại kết quả. Nếu `phase_b_tables_exist = true` → migration 2 đã chạy rồi, **bỏ qua** migration 2 (file đó không chạy lại được).

### 2b. Chạy migration

**Cách A (ưu tiên) — SQL Editor:** New query → dán **nguyên văn toàn bộ** file 1 → Run → phải "Success". Lặp lại lần lượt với file 2 và file 3.

**Cách B — nếu không mở được dashboard:** dùng `DATABASE_URL` trong `.env` (chỉ sau khi bước 1 xác nhận đúng project Dev):

```bash
node --env-file=.env -e '
const { Client } = require("pg"); const fs = require("fs");
const files = ["20261012000000_enable_rls_public_tables.sql", "20261013000000_makerworld_storefront_pricing.sql", "20261014000000_custom_request_quote_estimate.sql"];
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  if (!url.username.endsWith(".nijkumwwcayjynbswowk")) throw new Error("DATABASE_URL không phải project Dev nijkumwwcayjynbswowk — DỪNG");
  const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
  for (const f of files) {
    if (f.startsWith("20261013") && (await c.query("select to_regclass($$public.makerworld_price_presets$$) as t")).rows[0].t) { console.log("skip (đã có)", f); continue; }
    await c.query("begin");
    try { await c.query(fs.readFileSync("supabase/migrations/" + f, "utf8")); await c.query("commit"); console.log("OK", f); }
    catch (e) { await c.query("rollback"); console.log("FAIL", f, e.message); process.exit(1); }
  }
  await c.end();
})();'
```

### 2c. Kiểm tra sau

Chạy lại query ở 2a. Kỳ vọng: `tables_without_rls = 0`, `phase_b_tables_exist = true`, `snapshot_column_exists = true`.

Thêm 1 query xác nhận **app vẫn đọc được dữ liệu dưới RLS** (chạy bằng Cách B hoặc qua app — SQL Editor dùng role khác nên không đại diện cho app):

```bash
node --env-file=.env -e '
const { Client } = require("pg"); (async () => { const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log(await q("select current_user, (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls"));
console.log(await q("select tableowner from pg_tables where schemaname = $$public$$ and tablename = $$pricing_configs$$"));
console.log(await q("select count(*) as configs from pricing_configs"));
await c.end(); })()'
```

Kỳ vọng: `configs` > 0 nếu bảng có dữ liệu, và (`bypassrls = true` **hoặc** `tableowner = current_user`). Nếu `configs = 0` trong khi SQL Editor đếm ra > 0 → RLS đang chặn app → **DỪNG, báo Owner ngay**, tạm mở lại bằng `alter table public.pricing_configs disable row level security;` chỉ khi Owner đồng ý.

Mở Supabase → Advisors → Security: cảnh báo "RLS Disabled in Public" phải hết.

---

## 3. Chạy app + kiểm tra tự động

```bash
# tắt npm run dev nếu đang chạy (Ctrl+C)
npm run typecheck && npm run lint
node --import tsx --test tests/makerworld-pricing.test.ts tests/makerworld-profile-verification.test.ts \
  tests/makerworld-price-preset.test.ts tests/makerworld-estimate.test.ts tests/makerworld-intake.test.ts \
  tests/phase-13-makerworld-resolver.test.ts tests/domain-schemas.test.ts \
  tests/instant-estimate.test.ts tests/file-estimate.test.ts
pkill -f "next dev" ; pkill -f "next-server" ; sleep 2   # tắt MỌI dev server cũ (kể cả cái Owner đang chạy)
lsof -nP -iTCP:3000 -iTCP:3001 -sTCP:LISTEN               # phải không còn dòng nào
rm -rf .next && npm run dev                                # chỉ chạy DUY NHẤT 1 dev server
```

Lỗi `Cannot find module './vendor-chunks/…'` hoặc `'./NNNN.js'` = có 2 tiến trình Next cùng ghi `.next` (2 dev server, hoặc build/test chạy song song). Làm lại đúng 3 lệnh trên.

Các test có DB sẽ tự **skip** (chưa có `TEST_DATABASE_URL`) — bình thường. Ghi số pass/fail/skip.

Nếu trang nào báo `Internal Server Error` trơn: tắt dev → `rm -rf .next` → `npm run dev`.

---

## 4. Kiểm thử bằng trình duyệt (`http://localhost:3000`)

Điều kiện: có ít nhất 1 `pricing_configs` hiện hành (bước 2a `active_pricing_configs > 0`; nếu = 0, OWNER vào `/admin/settings/pricing` tạo 1 cấu hình với giá trị mặc định), 1 vật liệu PLA đang active có giá (`/admin/materials`), 1 custom request bất kỳ.

Đăng nhập `/admin/login` bằng tài khoản OWNER của Owner (Owner tự nhập mật khẩu — agent không nhập).

### Phase A — Admin (link thử: `https://makerworld.com/en/models/3246150`)

| # | Thao tác | Kỳ vọng | Kết quả |
|---|---|---|---|
| A1 | Mở 1 custom request → khối Báo giá → tab "Từ link MakerWorld" → dán link → "Tự động lấy dữ liệu" | Dropdown 3 profile, **chưa chọn sẵn**; dòng License "Standard Digital File License … chính sách In giúp cá nhân" — **hoặc** báo bị chặn và tự mở "Nhập tay thông số" | |
| A2 | (nếu bị chặn) dán `0.2mm layer, 2 walls, 15% infill · P1S · 7.4 h · 6 plates · 168 g · No AMS` → "Tách thông số" → "Dùng thông số này" | Các ô tự điền đúng; card profile hiện | |
| A3 | Chọn profile `0.2mm layer, 2 walls, 15% infill` | Card viền xanh: P1S · 7.4h · 6 plates · 168g · NO AMS | |
| A4 | Chọn cuộn nhựa cho từng màu, chọn "Bản kit (tự ráp)" | Hao phí mặc định 5%, thời gian thao tác 20, có "Giá đề xuất" | |
| A5 | "Dùng giá này" khi **chưa** tick xác nhận | Nút bị khoá | |
| A6 | Tick "Đã xác nhận đúng profile…" → "Dùng giá này" | Ô Tạm tính/Tổng tiền được điền | |
| A7 | Đổi sang profile khác | Ô Tạm tính/Tổng tiền **bị xoá trắng** | |
| A8 | Chọn lại profile, tính lại, điền "Hiệu lực đến" → "Tạo báo giá" | Báo giá mới trong bảng, dưới mã có tên profile + "Bản kit (tự ráp)" | |
| A9 | "Copy Zalo" → mở link trong tab ẩn danh | Trang báo giá có card "Mẫu & profile in đã xác nhận" | |
| A10 | Tạo thêm báo giá "Bản hoàn thiện" cùng profile → "Chấp nhận" 1 trong 2 | Báo giá còn lại tự `REJECTED`; chỉ 1 print job | |
| A11 | Chuyển tab "Công cụ tính giá" | Panel MakerWorld biến mất, ô giá bị xoá | |

### Phase B — Storefront

| # | Thao tác | Kỳ vọng | Kết quả |
|---|---|---|---|
| B1 | Ở panel MakerWorld: chọn "Bản kit" → Dùng giá này → **"Lưu làm giá Storefront"**; chọn "Bản hoàn thiện" → Dùng giá này → Lưu | "Đã lưu giá Storefront: …đ" mỗi lần | |
| B2 | Mở `/admin/settings/makerworld-prices` (menu "Giá MakerWorld") | 2 dòng, cột "Giá hiện tại" có số | |
| B3 | Tab ẩn danh → `/custom-print` → dán `https://makerworld.com/en/models/3246150#profileId-3678340` → "Xem giá" | Chip "Giá BaSa3D đã kiểm tra"; 2 giá **khớp** "Giá hiện tại" ở B2 | |
| B4 | Dán link mẫu khác chưa duyệt (vd `https://makerworld.com/en/models/2851863`) | Không có giá, thông báo "chưa có giá sẵn", vẫn có nút gửi yêu cầu | |
| B5 | Quay lại link B3 → "Gửi yêu cầu in mẫu này" → kiểm tra 2 ô xác nhận **không tick sẵn** → gửi khi chưa tick → báo lỗi → tick đủ, nhập tên + SĐT thử → gửi | Hiện mã `CR-…` | |
| B6 | Admin mở custom request vừa tạo | Khối xanh "Yêu cầu từ MakerWorld" + giá khách đã thấy; panel MakerWorld điền sẵn link + phương án | |
| B7 | `/admin/settings/pricing` tạo cấu hình mới (tăng giá công) → lặp lại B3 | Giá storefront đổi theo | |
| B8 | DevTools → Network khi bấm "Xem giá" ở B3 | Request body **chỉ có** `url`; response **không** có `margin`, `breakdown`, `unitCost`, `pricingConfig`, `materialId` | |

### Báo giá tức thì (spec dán tay + file) — làm theo bảng C1–C9 trong `docs/operations/local-testing.md` và điền kết quả vào báo cáo.

Dọn dẹp sau test: ở B2, OWNER có thể "Tắt" các giá thử nếu không muốn khách thấy; custom request/báo giá thử có thể chuyển trạng thái REJECTED.

---

## 5. Báo cáo trả về Owner (dán vào chat)

```
## Kết quả
- Project Dev xác nhận: <ref>, tên project: <...>
- Query 2a trước: <kết quả>   | sau: <kết quả>
- Migration 1: OK/FAIL (<lỗi nguyên văn>)
- Migration 2: OK/SKIP/FAIL (<lỗi>)
- App role dưới RLS: current_user=<...>, bypassrls=<...>, owner=<...>, configs=<...>
- Advisor "RLS Disabled in Public": còn/hết
- typecheck/lint: pass/fail ; unit tests: <pass>/<fail>/<skip>
- Migration 3: OK/FAIL
- Bảng A1–A11, B1–B8, C1–C9: điền cột Kết quả (✅ / ❌ + mô tả + ảnh chụp nếu ❌)
- Lỗi/nghi vấn khác:
```

Không deploy, không chạy gì trên Production — bước đó Owner làm theo `docs/exec-plans/active/makerworld-phase-a-release-plan.md` sau khi xem báo cáo.
