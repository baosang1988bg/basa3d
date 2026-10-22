# Hướng dẫn nhập KeyCap3D lên web (feature 003) — làm trên PC Windows

> Bắt đầu từ **Bước 2** (Bước 1 — kiểm tra DB Development — OWNER đã làm, kết quả đúng).
> Môi trường đích: **Supabase Development** (project ref `nijkumwwcayjynbswowk`) + **Vercel Preview**
> `https://basa3d-git-dev-ba-sa.vercel.app`. **Không** đụng Production.
>
> Cuối file có prompt sẵn cho Antigravity (mục "Giao cho Antigravity").

## Tổng quan — 6 bước

| # | Bước | Ai làm | Thời gian |
|---|---|---|---|
| 0 | Chuẩn bị PC (repo, `.env`, Node, trình duyệt render) | Bạn + Antigravity | 15 phút |
| 2 | Đưa 2 migration lên Supabase Development | **Bạn** (trên web Supabase) | 5 phút |
| 3 | Mở trang admin trên Preview | Bạn | 2 phút |
| 4 | Tải kho KeyCap3D về PC | Bạn | 10 phút |
| 5 | Chạy script: thử 10 mẫu → xem report → ghi thật | Bạn / Antigravity | 30–60 phút |
| 6 | Duyệt mẫu → keycap hiện ở `/products` | **Bạn** | 15 phút |

---

## Bước 0 — Chuẩn bị PC (một lần)

### 0.1 Lấy code mới nhất

Mở PowerShell:

```powershell
cd <thư mục chứa repo BaSa3D trên PC>     # chưa có thì: git clone git@github.com:baosang1988bg/basa3d.git BaSa3D
git checkout dev
git pull --ff-only
npm ci
```

### 0.2 Copy file `.env` từ Mac sang PC — ⚠️ KHÔNG qua git

`.env` chứa mật khẩu DB và `SUPABASE_SERVICE_ROLE_KEY` (chìa khoá toàn quyền). File này **không có trên GitHub**
(đã `.gitignore`) và **không bao giờ được commit**.

- Cách an toàn: copy qua USB, AirDrop → điện thoại → PC, hoặc trình quản lý mật khẩu (1Password/Bitwarden — secure note).
- **Không** gửi qua Zalo/Messenger/email.
- Đặt file vào **thư mục gốc repo trên PC**, tên đúng là `.env`.

Kiểm tra (chỉ đếm tên biến, không in giá trị) — phải ra **3**:

```powershell
(Select-String -Path .env -Pattern '^(DATABASE_URL|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=').Count
```

### 0.3 Trình duyệt để render ảnh

Script dùng **Google Chrome đã cài trên Windows** để render ảnh STL. Mở Chrome một lần cho chắc là đã cài.
Nếu script báo không tìm thấy Chrome: `npx playwright install chromium`.

---

## Bước 2 — Đưa 2 migration lên Supabase Development

### 2.1 Migration là gì, vì sao phải làm?

Code mới của feature 003 cần **bảng và luật mới trong database**: bảng `product_import_items` (lưu thông tin mẫu
nhập), 2 trigger chặn mẫu chưa duyệt lên web, danh mục ẩn "Chưa phân loại" và danh mục **Keycap**.

Code trên Vercel Preview **đã có** (đã push), nhưng database **chưa có** những thứ đó. Migration là file `.sql` mô tả
thay đổi DB — chạy nó một lần là DB "theo kịp" code. Giống bên mobile: app mới đọc cột mới thì phải chạy script
nâng cấp SQLite/schema trước, nếu không app crash.

Nếu bỏ qua bước này: trang `/admin/stl-import` trên Preview sẽ lỗi 500 và script nhập sẽ báo lỗi bảng không tồn tại.

Máy không cài Supabase CLI, nên ta **dán nội dung file vào SQL Editor trên web Supabase** — kết quả y hệt.

### 2.2 Chạy migration thứ nhất — `20261022000000_stl_bulk_import.sql`

1. Trên PC, mở file `supabase/migrations/20261022000000_stl_bulk_import.sql` bằng VS Code / Antigravity.
   (Hoặc trên GitHub: repo → nhánh `dev` → `supabase/migrations/` → file → nút **Raw** → copy.)
2. Bấm **Ctrl+A** (chọn hết) → **Ctrl+C** (copy).
3. Mở **supabase.com/dashboard** → chọn đúng project **`nijkumwwcayjynbswowk`**
   (nhìn URL trình duyệt: `.../project/nijkumwwcayjynbswowk/...`). ⚠️ Nếu có project Production, **đừng chọn nhầm**.
4. Menu trái → **SQL Editor** → nút **+ New query**.
5. Dán vào ô soạn (**Ctrl+V**) → bấm **Run** (góc phải dưới, hoặc **Ctrl+Enter**).
6. Nếu hiện hộp thoại *"Potential issue detected… destructive operation"* → bấm **Run this query** / xác nhận.
   Lý do: file có `drop trigger if exists` — trigger này chưa tồn tại nên không mất gì.
7. Kết quả đúng: dòng **"Success. No rows returned"**. Có chữ đỏ `ERROR` → **dừng, chụp màn hình**.

### 2.3 Chạy migration thứ hai — `20261022000100_keycap_category.sql`

Làm y hệt 2.2 với file `supabase/migrations/20261022000100_keycap_category.sql`
(**New query** mới, dán, **Run**).

Nếu thấy cảnh báo vàng *"SET LOCAL can only be used in transaction blocks"* → **bỏ qua**, vô hại.

### 2.4 Kiểm tra lại

**New query** → dán đoạn sau → **Run**:

```sql
select
  to_regclass('public.product_import_items') is not null as bang_ok,
  (select relrowsecurity from pg_class
    where oid = 'public.product_import_items'::regclass)  as rls_bat,
  (select count(*) from pg_trigger
    where tgname in ('products_import_publish_gate','product_import_items_link_gate')) as so_trigger,
  (select bool_and(prosecdef) from pg_proc
    where proname in ('enforce_import_publish_gate','enforce_import_item_link'))   as security_definer,
  (select is_active from categories where slug = 'chua-phan-loai') as chua_phan_loai_an,
  (select is_active from categories where slug = 'keycap')         as keycap_hien;
```

Kết quả phải đúng **một dòng**:

| bang_ok | rls_bat | so_trigger | security_definer | chua_phan_loai_an | keycap_hien |
|---|---|---|---|---|---|
| true | true | 2 | true | false | true |

Khác bảng này ở ô nào → **dừng, chụp màn hình gửi Cowork**.

---

## Bước 3 — Mở trang admin trên Preview

1. Vào `https://basa3d-git-dev-ba-sa.vercel.app/admin/stl-import`
   (Vercel bắt đăng nhập → dùng tài khoản Vercel của bạn).
2. Đăng nhập admin BaSa3D.
3. Thấy trang **"Kho nhập STL" trống** = đúng. Lỗi 500 → chụp gửi Cowork.

---

## Bước 4 — Tải kho KeyCap3D về PC

Script **chỉ đọc file trên ổ cứng**, không đọc được link Drive.

1. Mở link Drive thư mục `KeyCap3D` trong Chrome.
2. Thanh đường dẫn phía trên → bấm mũi tên ▾ cạnh chữ **KeyCap3D** → **Download**.
   Google nén thành một hoặc vài file `.zip` → chờ tải xong vào `Downloads`.
3. Giải nén vào **một thư mục cố định** (PowerShell):

```powershell
$LIB = "$env:USERPROFILE\STL-Library"
New-Item -ItemType Directory -Force $LIB | Out-Null
Get-ChildItem "$env:USERPROFILE\Downloads\KeyCap3D*.zip" | ForEach-Object { Expand-Archive $_.FullName -DestinationPath $LIB -Force }
Get-ChildItem "$LIB\KeyCap3D" | Select-Object -First 10 Name     # phải thấy: 2 keycaps mario, 8 Keycap Set, ...
```

> ⚠️ **Quy tắc vàng**: luôn dùng `STL-Library` làm `--in`, **không đổi tên / di chuyển**. Script nhận diện mẫu theo
> đường dẫn tương đối từ thư mục này (`KeyCap3D/8 Keycap Set`, ...). Đổi gốc ⇒ mọi mẫu bị coi là mới ⇒ sản phẩm trùng.
> Trên Mac sau này cũng giữ cấu trúc `STL-Library/KeyCap3D/...` y hệt.

---

## Bước 5 — Chạy script

Mở PowerShell tại thư mục repo.

### 5.1 Chạy thử 10 mẫu (không ghi gì vào DB)

```powershell
$LIB = "$env:USERPROFILE\STL-Library"
npx tsx --env-file=.env scripts/stl-import/import-stl.ts --in "$LIB" --only "KeyCap3D/**" --limit 10
start .stl-import\report.html
```

Xem report:

- [ ] Ảnh 4 góc rõ, keycap nằm giữa khung, không bị cắt
- [ ] Bộ nhiều keycap (vd `8 Keycap Set`, 11 STL) hiện đủ phần
- [ ] Kích thước khoảng 18 × 18 mm, không có cảnh báo "nghi sai đơn vị" hàng loạt
- [ ] Danh mục **Keycap**, SKU bắt đầu `KCP-`
- [ ] Giá ước tính hợp lý

Chưa chắc → chụp màn hình report gửi Cowork. (`.stl-import/` nằm trong `.gitignore`, không commit.)

### 5.2 Chạy thử toàn bộ kho (vẫn không ghi)

```powershell
npx tsx --env-file=.env scripts/stl-import/import-stl.ts --in "$LIB" --only "KeyCap3D/**"
start .stl-import\report.html
```

- [ ] Tỉ lệ lỗi ≤ 5%
- [ ] Thư mục chỉ có `.3mf` (vd `gengar-...`) được xử lý

### 5.3 Ghi thật

```powershell
npx tsx --env-file=.env scripts/stl-import/import-stl.ts --in "$LIB" --only "KeyCap3D/**" --apply
```

### 5.4 Kiểm tra không tạo trùng

Chạy lại **đúng lệnh 5.3** một lần nữa → report phải báo **0 CREATE**.

Mã thoát của script: `0` xong (kể cả có mẫu lỗi) · `1` lỗi cấu hình/kết nối · `2` cờ sai · `3` vượt ước tính bucket.

---

## Bước 6 — Duyệt để keycap lên trang

1. Vào `https://basa3d-git-dev-ba-sa.vercel.app/admin/stl-import` → giờ có lưới các bộ keycap.
2. **Thử chặn**: chọn 1 mẫu **chưa** tick bản quyền → **Duyệt** → phải bị chặn kèm lý do.
3. **Thử từ chối**: từ chối 1 mẫu → chạy lại lệnh 5.3 → mẫu đó không được tạo lại.
4. Với các mẫu còn lại: sửa tên gọn, xem giá, tick **"đã kiểm tra bản quyền"** → chọn nhiều → **Duyệt**.
5. Mở `https://basa3d-git-dev-ba-sa.vercel.app/products` → **keycap hiện ở đây** 🎉
6. Mở 1 trang chi tiết: có 4 ảnh, **không** thấy đường dẫn file/thư mục Drive.
7. Thử duyệt trên điện thoại, bấm giờ (mục tiêu ≤ 5 phút cho 10 mẫu).

> ⚠️ Giai đoạn test cho phép duyệt cả mẫu thương hiệu (Pokémon, Mario, Warhammer…). **Trước khi public domain**:
> archive các mẫu đó và bỏ tick bản quyền — xem cuối `docs/prompts/feature-003-test-run.md`.

---

## Giao cho Antigravity

Dán vào Antigravity (mở đúng thư mục repo trên PC):

```
Repo BaSa3D, nhánh dev. Đọc AGENTS.md và docs/prompts/feature-003-huong-dan-nhap-keycap.md.
Giúp tôi làm Bước 0, 4 và 5 trên Windows (PowerShell). Quy tắc:
- KHÔNG đọc, in, sửa hay commit file .env. Chỉ được đếm tên biến như lệnh ở 0.2.
- KHÔNG chạy migration, KHÔNG kết nối DB bằng psql, KHÔNG sửa supabase/migrations/* (Bước 2 tôi làm tay).
- KHÔNG git push, KHÔNG force-push, KHÔNG chuyển nhánh khác dev.
- Chạy 5.1 (--limit 10), mở report, rồi DỪNG chờ tôi xem. Chỉ chạy --apply (5.3) khi tôi gõ "apply".
- Script lỗi: báo mã thoát + 20 dòng log cuối, không tự sửa code.
```

Bước 2 và Bước 6 **bạn tự làm** (trên web Supabase và trang admin).
