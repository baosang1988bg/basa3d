# Prompt Claude — Review Kế hoạch Phase 41 (Admin Executive Business Dashboard)

Copy toàn bộ nội dung bên dưới gửi cho Claude:

---

Bạn là Lead Architect & Security Reviewer của dự án BaSa3D (`AGENTS.md`).

Chủ xưởng (OWNER) vừa yêu cầu nâng cấp giao diện `/admin/dashboard` để bổ sung tab **"Kinh doanh & Tài chính"** (Executive Dashboard 30 ngày) bên cạnh tab **"Vận hành xưởng"** hiện tại, lấy cảm hứng từ bản thiết kế dark-mode chuyên sâu cho ngành in 3D (xem kế hoạch tại `docs/exec-plans/active/phase-41-admin-executive-dashboard.md`).

### Bối cảnh & Các quyết định sơ bộ:
1. **Phân quyền vai trò (ADR-0011)**:
   - STAFF chỉ được xem số liệu vận hành (đơn hàng, phễu việc in, cuộn nhựa cần chú ý); tuyệt đối không xem doanh thu, tiền tệ hay AOV.
   - Khi STAFF truy cập `/admin/dashboard`: Hệ thống chỉ render giao diện vận hành xưởng (không hiển thị tab switcher, chặn gọi hàm tài chính ngay cả khi cố tình truyền query param `?tab=business`).
   - Khi OWNER truy cập: Mặc định mở tab "Kinh doanh & Tài chính" với đầy đủ 4 KPI 30 ngày, biểu đồ cột 30 ngày, doanh thu theo danh mục và tồn kho nhựa theo ngưỡng tối thiểu; có tab bar để chuyển sang tab "Vận hành xưởng".
2. **Kỹ thuật đồ họa (Rule #8 AGENTS.md)**:
   - Không cài thêm thư viện charting nặng (Recharts, Chart.js...).
   - Biểu đồ cột 30 ngày dựng bằng **SVG thuần** (có cờ highlight ngày Thứ 7 / Chủ Nhật).
   - Biểu đồ ngang danh mục và tồn kho nhựa dựng bằng **Tailwind CSS + Flexbox thuần** (thanh tiến trình có vạch đứt ngưỡng tối thiểu).
3. **Cơ sở dữ liệu**:
   - Không tạo thêm bảng mới hay migration; tận dụng các bảng hiện có: `orders`, `order_items`, `products`, `categories`, `print_jobs`, `filament_spools`, `materials`.
   - Query 30 ngày dùng `generate_series` kết hợp timezone chuẩn (`sqlLocal`).

### Yêu cầu review từ Claude:
1. Đọc file kế hoạch `docs/exec-plans/active/phase-41-admin-executive-dashboard.md` và `src/services/dashboard.service.ts`.
2. **Kiểm tra ranh giới bảo mật & rò rỉ dữ liệu**: Thiết kế service `getExecutiveBusinessMetrics()` và cách chia tab tại `page.tsx` đã triệt tiêu hoàn toàn nguy cơ rò rỉ dữ liệu tiền tệ sang STAFF chưa?
3. **Kiểm tra rủi ro truy vấn & Edge cases**:
   - Xử lý chia cho 0 khi tính % MoM (nếu 30 ngày trước = 0 đơn/doanh thu).
   - Xử lý đơn Custom Request (không có `variant_id`) khi gom nhóm theo danh mục.
   - Khối lượng nhựa từ `print_jobs`: fallback `actual_weight_grams` vs `estimated_weight_grams`.
   - Hiệu năng các query 30 ngày trên Postgres.
4. **Độ phức tạp UI**: Các component đề xuất có tuân thủ tôn chỉ "boring, explicit, maintainable" cho một mobile dev chuyển sang full-stack không?
5. Đưa ra kết luận **"GO / NO-GO"** và các lưu ý/khuyến nghị cụ thể trước khi bắt đầu code lát cắt Slice 1.
