# Backup & Restore Runbook

A backup that has never been restored is not a verified recovery plan. Tài liệu này chuẩn hóa quy trình sao lưu và khôi phục cho 3 thành phần cốt lõi của BaSa3D: Database, Storage (Assets), và Mã nguồn.

---

## 1. Cơ sở dữ liệu (PostgreSQL / Supabase)

### 1.1. Nguồn & Tần suất
* **Tự động (Managed):** Supabase duy trì Daily Backup tự động (retention theo gói dịch vụ).
* **Chủ động (Manual Dump):** OWNER thực hiện trước mỗi lần cập nhật lớn / chạy migration mới, hoặc định kỳ hàng tuần/tháng.

### 1.2. Quy trình sao lưu thủ công (Manual Backup)
Chạy lệnh xuất file `.sql` từ máy tính cá nhân đã kết nối Supabase CLI:
```bash
# Xuất toàn bộ schema và dữ liệu
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

# Hoặc dùng pg_dump trực tiếp với Database Connection String:
pg_dump "$DATABASE_URL" --format=custom --file="basa3d_backup_$(date +%Y%m%d).dump"
```
*Lưu trữ bản dump:* Lưu vào thư mục `BaSa3D-Backups/DB/` trên Google Drive cá nhân của OWNER (không lưu public).

### 1.3. Quy trình khôi phục (Restore Procedure)
1. Dừng các tác vụ ghi vào DB (đặt banner bảo trì nếu cần).
2. Kiểm tra tính toàn vẹn của bản dump.
3. Chạy khôi phục vào database mục tiêu:
   ```bash
   # Nếu dùng file .sql:
   psql "$DATABASE_URL" -f backup_YYYYMMDD_HHMMSS.sql

   # Nếu dùng pg_restore (.dump):
   pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" basa3d_backup_YYYYMMDD.dump
   ```
4. Xác minh dữ liệu:
   - Kiểm tra số lượng bản ghi các bảng cốt lõi: `products`, `orders`, `inventory_movements`, `filament_spools`.
   - Đăng nhập thử vào `/admin/products` và `/admin/product-inventory` để kiểm tra toàn vẹn.

---

## 2. Lưu trữ tệp (Storage: Ảnh & Tài liệu)

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

* **Mã nguồn:** Lưu trữ và versioning tại GitHub Private Repository.
* **Cấu hình môi trường (`.env.local` / Production Secrets):**
  - Tuyệt đối không commit lên git.
  - Lưu bản sao mã hóa an toàn trên trình quản lý mật khẩu (1Password / Bitwarden) hoặc file ghi chú mã hóa của OWNER.

---

## 4. Bảng phân quyền & Trách nhiệm
* **Ai được thực hiện Restore:** Chỉ duy nhất `OWNER`.
* **Ngày kiểm tra khôi phục định kỳ (Test drill):** 6 tháng/lần trên môi trường staging / test database local.
