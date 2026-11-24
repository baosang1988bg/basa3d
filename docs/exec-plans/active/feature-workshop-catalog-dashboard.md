# Kế hoạch phát triển: Workshop Catalog Dashboard (Tái cấu trúc Dashboard & Quản lý Mẫu in cho Xưởng)

## 1. Mục tiêu & Vấn đề giải quyết
- **Thực trạng**: BaSa3D không còn hoạt động theo mô hình sàn TMĐT phức tạp mà tập trung vào **Dịch vụ In 3D & Showroom Mẫu In Tuyển Chọn (Custom 3D Printing Service & Curated Catalog)**. Dashboard cũ hiển thị nhiều biểu đồ bán lẻ sàn ảo (AOV, chu kỳ doanh thu 30 ngày, demo data), trong khi việc quản lý sản phẩm bị phân mảnh qua nhiều trang (`/products`, `/products/new`, `/product-inventory`), thuật ngữ kỹ thuật khó hiểu (`PUBLISH_BLOCKED`, `STALE`, v.v.).
- **Giải pháp**:
  1. **Catalog-Centric Dashboard**: Biến Dashboard thành trung tâm quản lý các mẫu in xưởng đang nhận in và đăng bán. Mở web ra là thấy ngay danh sách mẫu in đang bán (`WorkshopCatalogHub`).
  2. **Thêm - Xóa - Sửa tại chỗ (1-Click Inline CRUD)**:
     - Sửa giá tại chỗ: Bấm trực tiếp vào số giá để sửa và lưu ngay tức thì.
     - Sửa tên tại chỗ: Bấm trực tiếp vào tên sản phẩm để đổi tên.
     - Bật/Tắt hiển thị: Bấm badge `[🟢 Đang bán] ↔ [⚪ Tạm ẩn]` chuyển đổi trạng thái tức thì (optimistic UI).
     - Xóa sản phẩm: Nút thùng rác với modal xác nhận an toàn, 1-click.
     - Mở in xưởng: Nút bấm copy nhanh đường dẫn file máy xưởng (`D:\...`) hoặc link Drive để thợ nạp vào slicer in.
  3. **Thống kê xưởng thiết thực**: Đếm số mẫu đang bán, mẫu nháp, yêu cầu in chờ xử lý, số cuộn nhựa còn lại.
  4. **Nút Thêm siêu tốc**: Nút `⚡ + Đăng Mẫu Mới (15s)` nổi bật ở đầu trang dẫn thẳng vào flow AI Onboarding.

---

## 2. Các lát cắt triển khai (Slices)

### Slice 1: Server Actions cho Thao Tác Nhanh (Quick CRUD)
- [x] Tái sử dụng và nâng cấp các server actions chuẩn Zod schema tại `src/app/basaadmin/(protected)/products/actions.ts`:
  - [x] `quickUpdateCatalogProductAction`: Hỗ trợ đổi trạng thái `ACTIVE` ↔ `DRAFT`, cập nhật tên, cập nhật giá bán niêm yết, đồng bộ biến thể, cập nhật đường dẫn local/drive.
  - [x] `deleteCatalogProductAction`: Xoá an toàn theo quyền OWNER.
  - [x] Tích hợp revalidation path `/basaadmin/dashboard` vào `revalidateAllCatalogPaths()`.

### Slice 2: Component `WorkshopCatalogHub` (Giao diện trung tâm)
- [x] Xây dựng component `src/components/admin/dashboard/workshop-catalog-hub.tsx`:
  - [x] Thẻ thống kê 4 ô: Đang bán, Mẫu nháp/tạm ẩn, Yêu cầu in chờ xử lý, Cuộn nhựa sẵn trong kho.
  - [x] Thanh công cụ: Bộ lọc danh mục dạng pills có icon emoji + Ô tìm kiếm tức thời theo tên & đường dẫn local + Nút `⚡ + Đăng Mẫu Mới (15s)`.
  - [x] Lưới card mẫu in (Visual Cards):
    - [x] Ảnh bìa trực quan kèm icon emoji fallback.
    - [x] Nút badge đổi trạng thái `[🟢 Đang bán]` / `[⚪ Tạm ẩn]` với optimistic UI.
    - [x] Tên mẫu in có thể click để sửa tại chỗ (inline prompt/edit).
    - [x] Giá tiền với tính năng inline edit (click số để sửa).
    - [x] Nút copy đường dẫn file máy xưởng (`📂 D:\...`) và link Drive (`☁️ Drive`).
    - [x] Nút xoá `🗑️` có modal xác nhận an toàn, không reload trang.
    - [x] Nút `Sửa chi tiết` liên kết đến `/basaadmin/products/[id]`.

### Slice 3: Cập nhật trang `/basaadmin/dashboard` & Tabs
- [x] Tích hợp `WorkshopCatalogHub` vào `src/app/basaadmin/(protected)/dashboard/page.tsx`:
  - [x] Tab mặc định `📦 Mẫu in đang bán` hiển thị `WorkshopCatalogHub`.
  - [x] Tab phụ `⚙️ Vận hành xưởng` (`?tab=operations`) hiển thị tiến độ in và pipeline.
  - [x] Tab chủ xưởng `📊 Doanh thu & Chi tiêu` (`?tab=business`) bảo toàn cho OWNER (ADR-0011 boundary #2).
  - [x] Cập nhật component `src/components/admin/dashboard/dashboard-tabs.tsx` hỗ trợ 3 tab linh hoạt.

### Slice 4: Kiểm tra chất lượng & Quality Gate
- [x] `npm run typecheck` (tsc --noEmit) passed 0 errors.
- [x] `npm run lint` (eslint .) passed 0 errors.
- [x] `npm run check:arch` (check-arch.mjs) passed 6/6 rules.
- [x] Unit tests & Smoke tests (`tests/smoke-staff-flow.test.ts`, `tests/admin-products-catalog.test.ts`, `tests/phase-41-executive-dashboard.test.ts`) passed 100%.
- [x] Cập nhật `PROGRESS.md`, commit và merge vào `dev`.
