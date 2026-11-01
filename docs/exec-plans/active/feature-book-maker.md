# Feature — Photo Book Maker (Công cụ tạo sách ảnh 3D độc lập)

> Dựa trên nghiên cứu & phân tích kỹ thuật từ mẫu tham khảo `https://www.af-inventions.com/design.html?slug=book-hub` bằng kỹ thuật REA (`rea-agents@6.7.0`).
> Xây dựng công cụ độc lập `/tools/book-maker` trên nền tảng BaSa3D (Next.js + Three.js/WebGL + 3MF Multi-material AMS).

## 1. Brief & Hợp đồng Kỹ thuật (Step 1 & 2)

- **Goal**:
  1. Xây dựng công cụ cấu hình 3D độc lập `/tools/book-maker` cho phép người dùng tùy biến album sách ảnh in 3D: chọn khổ ảnh (Instax Mini, Polaroid, 6x9, 10x15...), số trang (2–20), loại bản lề (Snap-fit hoặc cắm thanh filament), màu bìa & màu trang.
  2. Hỗ trợ tự động sinh khối modifier $0.8\text{ mm}$ (4 layer in).
  3. Xuất file `.3mf` đa màu (tương thích trực tiếp Bambu Studio / OrcaSlicer AMS) và `.stl` client-side.
  4. Tích hợp trực tiếp vào hệ sinh thái BaSa3D: tính toán thể tích nhựa, ước lượng chi phí in và nút "Gửi yêu cầu in xưởng BaSa3D".
- **Non-goals**:
  - Không sao chép các API private của bên thứ ba; toàn bộ logic giải mã và xuất file chạy độc lập client-side / server BaSa3D.
  - Không hỗ trợ in resin (SLA) trong giai đoạn này (chỉ tối ưu cho in FDM nhiều màu).
- **Inputs**:
  - 17 bộ hình học khổ sách (`.dat`) đã được bóc tách và giải mã từ định dạng nhị phân `AFK2`.
  - Bảng tham số hình học `formats.json` và cấu hình `config.json`.
  - Bộ xuất 3MF chuẩn `src/lib/3d-tools/common/3mf-writer.ts` của BaSa3D.
- **Outputs**:
  - Đường dẫn công cụ: `/tools/book-maker` (thuộc route group `(tools-fullscreen)`).
  - Thư viện engine: `src/lib/3d-tools/book-maker/`.
  - Bộ tài nguyên tĩnh phục vụ cho Next.js: `public/models/book-maker/`.
- **Risks & Mitigation**:
  - *Risk*: File mô hình nhị phân giải mã nặng gây giật lag trình duyệt.
    *Mitigation*: Sử dụng cơ chế cache trong bộ nhớ (`memoryDatCache`), chỉ tải đúng file `.dat` của khổ sách mà người dùng đang chọn (~1 MB).
  - *Risk*: Định dạng 3MF xuất ra bị lỗi màu hoặc không nhận khay AMS trên Bambu Studio.
    *Mitigation*: Sử dụng chuẩn OPC ZIP với XML `<m:colorgroup>` kết hợp file cấu hình `Metadata/model_settings.config` theo chuẩn ADR-0051 đã được kiểm chứng tại BaSa3D.
- **Definition of Done (DoD)**:
  - [x] Bộ giải mã `afk2-decoder.ts` giải mã chính xác 10 sub-mesh trong từng khổ sách.
  - [x] Công cụ `/tools/book-maker` chạy mượt mà, cho phép đổi khổ, gập/mở sách 3D, đổi màu sắc.
  - [x] Nút xuất `.3mf` tải về file mở được trên Bambu Studio với các phần màu riêng biệt.
  - [x] Tích hợp ước tính giá và liên kết gửi form đặt in xưởng BaSa3D.
  - [x] TypeScript không có lỗi (`tsc --noEmit`), chạy qua unit test.

---

## 2. Kế Hoạch Triển Khai Chi Tiết (Checklist)

### Giai đoạn 1: Chuẩn bị Dữ liệu & Bộ Giải mã Nhị phân
- [x] Tải và lưu trữ 17 file `.dat`, `config.json`, `formats.json` vào `public/models/book-maker/`.
- [x] Viết `src/lib/3d-tools/book-maker/afk2-decoder.ts` chuyển đổi nhị phân `AFK2` thành Three.js `BufferGeometry`.
- [x] Viết unit test cho bộ giải mã `tests/book-maker-afk2.test.ts`.

### Giai đoạn 2: Engine Hình Học & Xuất File 3MF
- [x] Xây dựng `src/lib/3d-tools/book-maker/book-maker-types.ts` và hằng số `src/lib/3d-tools/book-maker/book-maker-constants.ts`.
- [x] Xây dựng thuật toán ghép ráp các chi tiết sách `src/lib/3d-tools/book-maker/book-maker-geometry.ts` (bìa trước, bìa sau, gáy sách co giãn theo số trang `spineStretch`, trang sách).
- [x] Xây dựng `src/lib/3d-tools/book-maker/book-maker-export.ts` xuất `.3mf` (gán khay màu extruder) và `.stl` zip.
- [x] Viết unit test cho xuất file `tests/book-maker-export.test.ts`.

### Giai đoạn 3: Xây dựng Giao diện Workbench & Canvas 3D
- [x] Tạo Canvas 3D `src/app/[locale]/(tools-fullscreen)/tools/book-maker/book-maker-canvas.tsx` hỗ trợ OrbitControls, ánh sáng bóng đổ, mặt bàn in Bambu Lab 256x256mm, và thanh trượt gập mở sách.
- [x] Tạo Workbench `src/app/[locale]/(tools-fullscreen)/tools/book-maker/book-maker-workbench.tsx` với giao diện điều khiển (chọn khổ 17 kích thước, hướng Dọc/Ngang, số trang 2-20, loại bản lề, phối màu bìa & trang).
- [x] Tạo trang `/tools/book-maker` trong group `(tools-fullscreen)` tại `src/app/[locale]/(tools-fullscreen)/tools/book-maker/page.tsx`.

### Giai đoạn 4: Tích hợp Hệ sinh thái BaSa3D & Kiểm thử
- [x] Kết nối ước tính giá in tức thì qua `/api/public/tool-price-estimate`.
- [x] Kết nối form đặt hàng in theo yêu cầu (`CustomRequestForm` & `uploadCustomRequestFile`).
- [x] Kiểm tra toàn diện chất lượng code (`tsc --noEmit`, test runner).

### Giai đoạn 5: Tối ưu Hóa Cắt Lát (Slicing) & Đa Đĩa In (Multi-Plate PEI)
- [x] Tách biệt đĩa in chuẩn Bambu Studio & OrcaSlicer:
  - **Đĩa 1 (Plate 1)**: Khung bìa sách mở phẳng (`cover-back`, `spine`, `cover-front`) đặt tại tọa độ gốc bàn in $(128, 128)$, kèm các lớp modifier khắc nổi/chìm/ảnh/vẽ tay ($Z \in [0, 0.8\text{ mm}]$ cho in 4 lớp màu AMS).
  - **Đĩa 2 & 3 (Plate 2+)**: Toàn bộ trang ruột được tính toán chia lưới động (`cols x rows`) theo khổ thực tế, đảm bảo khoảng cách an toàn $8\text{ mm}$ và không vượt quá $240 \times 240\text{ mm}$.
  - Đặt tọa độ thế giới (world offset) cho từng đĩa (Đĩa 2 offset $+307.2\text{ mm}$ theo trục X, Đĩa 3 offset $-307.2\text{ mm}$ theo trục Y) để loại bỏ 100% va chạm hình học khi slice.
- [x] Khai báo chi tiết `<model_instance>` và `<plate>` trong `Metadata/model_settings.config` và thêm `Metadata/plate_X.json` để Bambu Studio nhận diện đúng vật thể trên từng bàn in riêng biệt.
- [x] Hỗ trợ giải mã Base64 cho text, drawing, hình ảnh và gắn đúng extruder AMS.
- [x] Tự động dùng đúng tên file người dùng tùy biến khi tải về.
- [x] Viết bộ kiểm thử cắt lát toàn diện `tests/book-maker-slicing.test.ts` (100% pass).

### Giai đoạn 6: Tinh Chỉnh SCSS & Tiếp Cận Giao Diện Chuẩn BaSa3D
- [x] Chuyển đổi toàn diện hệ màu sang Design System BaSa3D:
  - Primary Teal (`#0F766E` / hover `#115E59` / active `#0B4F49`), Accent Amber (`#D97706`).
  - Thay thế toàn bộ mã màu iOS/Apple cũ (`#0071e3`, `#1d1d1f`, `#eef2f5`, `#d2d2d7`) bằng token Slate chuẩn (`#0F172A`, `#334155`, `#E2E8F0`, `#CBD5E1`, `#F8FAFC`).
  - Phù hợp với triết lý Emil Kowalski: vi tương tác bấm nảy tức thì (`:active { transform: translateY(1px) }`), không trễ `transition: all`.
- [x] Thay đổi cách tiếp cận giao diện (UI Approach):
  - Loại bỏ hoàn toàn mô hình popup modal nổi với viền đen/padding thừa.
  - Tích hợp Studio trực tiếp thành giao diện ứng dụng tràn màn hình (Full-window Workbench) đặt dưới thanh Top Navigation BaSa3D đồng bộ.
  - Ẩn nút "X" và header lặp thừa của modal cũ. Thanh Top Header trở thành thanh điều hướng trung tâm: Breadcrumb `← Danh mục công cụ`, Icon & Title, Live Price Tag (`95.000₫ – 145.000₫`), Nút Đặt lại, Tải file 3MF và Đặt xưởng in.
  - Tích hợp nhãn giá ước tính thời gian thực và nút đặt in xưởng trực tiếp vào thanh điều khiển chân trang (`.afc-buybox`).
  - Sau khi xuất file hoặc khi bấm "Đặt xưởng in", hiển thị `Dialog` xác nhận sản xuất chuyên nghiệp với thông số tấm đĩa PEI, các tùy chọn tải rời (Bìa AMS, Trang ruột, ZIP) và form đặt in xưởng prefill `CustomRequestForm`.
