# Backup & Restore Runbook

A backup that has never been restored is not a verified recovery plan. Tài liệu này chuẩn hóa quy trình sao lưu và khôi phục cho 3 thành phần cốt lõi của BaSa3D: Database, Storage (Assets), và Mã nguồn.

---

## 1. Cơ sở dữ liệu (PostgreSQL / Supabase)

### 1.1. Backup tự động (Phase 51 / D1)

Supabase Free **không** có backup tự động. Workflow `.github/workflows/db-backup.yml` dump database
mỗi ngày lúc 02:30 giờ Việt Nam (19:30 UTC) và lưu thành artifact của GitHub Actions, giữ **30 ngày**.

Mỗi lần chạy tạo một artifact `basa3d-db-<YYYYMMDDTHHMMSSZ>` chứa đúng một file
`basa3d-db-<...>.tar.gz.gpg`. Giải mã và giải nén ra thư mục có:

| File | Nội dung |
|---|---|
| `roles.sql` | role tự tạo (`supabase db dump --role-only`) |
| `schema.sql` | cấu trúc bảng, function, RLS policy (`supabase db dump`) |
| `data.sql` | dữ liệu (`supabase db dump --data-only --use-copy`) |
| `SHA256SUMS` | checksum của ba file trên |

**Dump KHÔNG gồm file trong Supabase Storage** (ảnh/file đính kèm của yêu cầu in, file upload ở
`/custom-print`, `/bao-gia`). Dump chỉ có các dòng metadata trong `storage.objects`. Restore xong thì
những dòng đó trỏ tới file không còn tồn tại. Muốn giữ file thì phải tải bucket về riêng (chưa có
trong workflow này).

#### Vì sao phải mã hoá

Repo `basa3d` đang **public**. Với repo public, log của Actions ai cũng xem được, và artifact thì
mọi tài khoản GitHub đã đăng nhập đều tải được. Dump có thông tin khách hàng (tên, SĐT, địa chỉ,
đơn hàng), nên workflow mã hoá bằng GPG (AES256) trước khi upload và không in connection string
hay output của `pg_dump` ra log. Nếu sau này chuyển repo sang private thì vẫn nên giữ mã hoá.

#### Thêm secret (làm một lần)

GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**:

1. `SUPABASE_DB_URL`: connection string **Session Pooler** của database cần backup
   (`postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`,
   xem README). Dùng DB **production** khi go-live. Mật khẩu có `%` thì ghi thành `%25`.
2. `BACKUP_ENCRYPTION_PASSPHRASE`: chuỗi ngẫu nhiên dài, ít nhất 20 ký tự, ví dụ
   `openssl rand -base64 32`. **Lưu một bản ở ngoài GitHub** (password manager). GitHub không cho
   xem lại secret, nên mất passphrase thì không giải mã được backup nào.

Thiếu một trong hai secret thì workflow fail ngay ở bước "Check secrets" và không dump gì.

#### Chạy tay

- Giao diện: Actions → **DB Backup** → Run workflow → chọn branch → Run.
- CLI: `gh workflow run db-backup.yml --ref main`

Lịch `schedule` chỉ chạy từ branch mặc định (`main`). Khi workflow chưa merge vào `main` thì chỉ chạy
tay được, và phải chọn branch đang chứa file workflow.

Khi fail, log chỉ ghi bước nào hỏng (roles/schema/data), không in lỗi chi tiết (lỗi có thể chứa
host/user của DB). Muốn xem lỗi thì chạy lệnh tương ứng trên máy:
`supabase db dump --db-url "$SUPABASE_DB_URL" -f /tmp/schema.sql`.

#### Restore từ artifact

Cần: `gh`, `gpg` (macOS: `brew install gnupg`), `psql` (PostgreSQL client cùng major version với
Supabase). Luôn restore thử vào
một **project Supabase trống** (hoặc DB local) trước. Không restore đè lên production đang chạy.

```bash
# 1. Tải artifact (hoặc Actions → run → Artifacts → tải zip rồi giải nén)
gh run list --workflow db-backup.yml --limit 5
gh run download <run-id> --dir ./restore

# 2. Giải mã + giải nén (gpg hỏi passphrase)
gpg --decrypt "$(find ./restore -name '*.tar.gz.gpg' | head -1)" > backup.tar.gz
tar -xzf backup.tar.gz
cd basa3d-db-*/
sha256sum -c SHA256SUMS        # macOS: shasum -a 256 -c SHA256SUMS

# 3. Nạp vào DB đích (Session Pooler URL của project đích)
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$TARGET_DB_URL"
```

`SET session_replication_role = replica` tắt trigger và kiểm tra foreign key trong lúc nạp data,
để thứ tự bảng không làm lỗi. Sau khi restore:

- [ ] Đăng nhập admin được (user nằm trong schema `auth`; nếu không vào được thì dump data chưa có
      `auth.users` → ghi lại và xử lý riêng).
- [ ] Đếm số dòng các bảng chính (`orders`, `order_items`, `product_variants`,
      `inventory_movements`) khớp với DB gốc tại thời điểm dump.
- [ ] Trỏ một bản build (local hoặc Deploy Preview) vào DB vừa restore, mở catalog và một đơn hàng.
- [ ] Ghi ngày restore thử và người làm vào bảng ở mục 5.

---

### 1.2. Sao lưu và Khôi phục thủ công (Manual Dump & Restore)

OWNER thực hiện trước mỗi lần cập nhật lớn / chạy migration mới:

#### Xuất dữ liệu thủ công:
```bash
# Xuất toàn bộ schema và dữ liệu qua Supabase CLI:
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

# Hoặc dùng pg_dump trực tiếp với Database Connection String:
pg_dump "$DATABASE_URL" --format=custom --file="basa3d_backup_$(date +%Y%m%d).dump"
```
*Lưu trữ bản dump:* Lưu vào thư mục `BaSa3D-Backups/DB/` trên Google Drive an toàn của OWNER (không public).

#### Khôi phục thủ công:
1. Dừng các tác vụ ghi vào DB (bật chế độ bảo trì nếu cần).
2. Kiểm tra tính toàn vẹn của file dump.
3. Chạy lệnh:
```bash
# Nếu dùng file .sql:
psql "$DATABASE_URL" -f backup_YYYYMMDD_HHMMSS.sql

# Nếu dùng pg_restore (.dump):
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" basa3d_backup_YYYYMMDD.dump
```

---

## 2. Lưu trữ tệp (Storage: Ảnh & Tài liệu 3D)

### 2.1. Nguồn lưu trữ
* **Web Assets & Ảnh sản phẩm:** Supabase Storage (bucket `product-images`, `blog-images`, `custom-request-attachments`).
* **File 3D gốc xưởng in (STL/3MF/STEP):** Lưu trữ trên Google Drive xưởng (`BaSa3D-Storage/`), có bật đồng bộ Offline trên máy PC xưởng (chi tiết xem `docs/operations/storage-and-sync.md`).

### 2.2. Quy trình sao lưu ảnh Supabase Storage
Định kỳ hàng tháng hoặc trước khi dọn dẹp bucket:
```bash
# Tải toàn bộ bucket product-images về máy offline
supabase storage cp -r ss:///product-images ./backup_product_images_$(date +%Y%m%d)
```

---

## 3. Mã nguồn & Cấu hình môi trường

* **Mã nguồn:** Lưu trữ và versioning tại GitHub Repository.
* **Cấu hình môi trường (`.env.local` / Production Secrets):**
  - Tuyệt đối không commit lên git.
  - Lưu bản sao mã hóa an toàn trên trình quản lý mật khẩu (1Password / Bitwarden) hoặc file ghi chú mã hóa của OWNER.

---

## 4. Phân quyền & Trách nhiệm

* **Ai được thực hiện Restore:** Chỉ duy nhất `OWNER`.
* **Ngày kiểm tra khôi phục định kỳ (Test drill):** 6 tháng/lần trên môi trường staging / test database local.

---

## 5. Nhật ký kiểm tra khôi phục (Restore Drills)

| Ngày restore thử | Backup dùng | Người làm | Kết quả |
|---|---|---|---|
| _chưa làm_ | | | |
