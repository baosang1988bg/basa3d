# Prompt gửi Claude Review — Phase 11 Plan (Admin Operations Hub, SVG Charts & Visual Process Pipelines)

Read `AGENTS.md` and `CLAUDE.md` first, then `docs/exec-plans/active/phase-11.md` in full.
Phase 11 nâng cấp toàn diện UI/UX của hệ thống Quản trị (Admin) dành cho OWNER và STAFF: bổ sung biểu đồ doanh thu/sản lượng theo ngày (SVG zero-dependency), quy trình trực quan (Visual Status Steppers) cho đơn hàng, yêu cầu in và việc in, thanh đo sức khỏe kho nhựa, cùng thanh điều hướng hiện đại.

---

## 1. Project & Phase Context

- **BaSa3D**: Nền tảng thương mại & dịch vụ in 3D (Next.js 15, PostgreSQL, Tailwind CSS, shadcn/ui).
- **Trọng tâm Phase 11**:
  1. Biểu đồ Doanh thu & Sản lượng 14 ngày bằng SVG thuần (không thêm thư viện Recharts/Chart.js cồng kềnh - tuân thủ Rule #8 AGENTS.md).
  2. Phân quyền RBAC nghiêm ngặt (ADR-0011 & Rule #5): Doanh thu và số tiền chỉ hiển thị cho OWNER; STAFF chỉ xem số lượng đơn và phễu kỹ thuật.
  3. Visual Steppers hiển thị tiến độ trực quan trên các trang chi tiết.
  4. Nâng cấp Admin Navigation với Lucide icons và badge công việc chờ xử lý.

---

## 2. Các điểm kỹ thuật then chốt đã chốt trong Phase 11 Plan

1. **Kiến trúc Zero Heavy Dependencies**: Biểu đồ Bar/Trend/Pipeline xây dựng bằng SVG + Tailwind CSS, scale tự động theo viewBox, hỗ trợ cả Dark Mode (`#0B1117`) và Light Mode.
2. **Server-Side Masking**: `dashboard.service.ts` tách biệt rõ `getOperationalMetrics()` (STAFF-safe) và `getFinancialMetrics()` (OWNER-only), không truyền tiền tệ xuống client của STAFF.
3. **Database Aggregation**: Dùng `generate_series` SQL để sinh timeline 14 ngày liên tục, không bị gián đoạn các ngày không có đơn hàng.
4. **Reusability**: `ProcessStepper` là component dùng chung cho cả Orders, Custom Requests và Print Jobs.

---

## 3. Required Output from Claude

1. **Review tính khả thi & tính nhất quán**:
   - Các query SQL 14 ngày trong `dashboard.service.ts` có tối ưu và khớp với schema hiện tại (`orders`, `print_jobs`, `custom_requests`, `filament_spools`) không?
   - Cấu trúc component SVG có đảm bảo responsive và tương thích dark/light mode không?
2. **Kiểm tra ranh giới bảo mật & RBAC**:
   - Đảm bảo không có rò rỉ dữ liệu doanh thu / giá trị đơn hàng sang vai trò STAFF ở cả tầng server và component render.
3. **Kiểm tra Checklist & Definition of Done**:
   - Xác nhận kế hoạch đã đầy đủ, chặt chẽ để sẵn sàng giao Codex triển khai.
