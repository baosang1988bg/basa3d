# Phase 41 — Admin Executive Business Dashboard (Tab Kinh doanh & Tài chính)

> Yêu cầu OWNER (2026-10-21): Áp dụng giao diện dashboard dark-mode chuyên sâu cho Admin/Owner, bổ sung tab "Kinh doanh & Tài chính" bên cạnh tab "Vận hành xưởng" tại `/admin/dashboard`.
> Trạng thái: **Code xong 2026-10-21** (Slice 0–4 + review độc lập). Còn lại: OWNER kiểm tra giao diện trên `npm run dev` rồi `close-phase`.

## Phase brief
- **Goal**: Cung cấp giao diện dashboard phân tích kinh doanh 30 ngày cho riêng vai trò OWNER tại `/admin/dashboard` (thông qua tab switcher "Kinh doanh & Tài chính" vs "Vận hành xưởng"), trực quan hóa 4 KPI (Doanh thu, Đơn hàng, AOV, Nhựa đã dùng — mỗi KPI so với 30 ngày liền trước), Biểu đồ doanh thu 30 ngày (tô đậm ngày cuối tuần), Doanh thu hàng hoá theo danh mục và Tồn kho nhựa có vạch ngưỡng tối thiểu.
- **Non-goals**:
  - Không thay đổi nguyên tắc bảo mật ADR-0011: STAFF tuyệt đối không được thấy các số liệu tài chính/tiền.
  - Không cài thêm thư viện biểu đồ nặng (Recharts, Chart.js, Tremor) — giữ nguyên Rule #8 AGENTS.md (dùng SVG thuần và Tailwind CSS).
  - Không thay đổi cấu trúc bảng cơ sở dữ liệu (không cần migration DB).
  - Không tính doanh thu đơn In theo yêu cầu (quote ACCEPTED) — xem Slice 0, D1.
  - Không đổi định nghĩa doanh thu của `expense.service.ts` (báo cáo dòng tiền) — follow-up riêng.
- **Inputs**:
  - Ảnh mockup thiết kế dark mode cung cấp bởi OWNER (BASA3D Admin Dashboard).
  - Schema hiện có: `orders`, `order_items`, `product_variants`, `products`, `categories`, `material_movements`, `filament_spools`, `materials`.
  - Service hiện tại: `src/services/dashboard.service.ts`, `src/services/filament.service.ts`.
- **Outputs**:
  - Hàm thuần có test: `src/lib/executive-metrics.ts` (`pctChange`, `averageOrderValue`, `formatVndCompact`, `formatPctChange`, `niceAxisTicks`, `resolveDashboardTab`, `isFilamentBelowThreshold`).
  - Service mở rộng `src/services/dashboard.service.ts`: `getExecutiveBusinessMetrics()` (OWNER-only) + `getFilamentThresholdStock()` (STAFF-safe, không có cột tiền).
  - Bộ UI component tại `src/components/admin/dashboard/`:
    - `dashboard-tabs.tsx` (server component, chỉ gồm `<Link>`)
    - `executive-kpi-card.tsx`
    - `executive-revenue-chart.tsx` (client — hover/chạm)
    - `category-revenue-card.tsx`
    - `filament-threshold-card.tsx`
  - Tích hợp và phân quyền tại `src/app/admin/(protected)/dashboard/page.tsx`.
  - Kiểm thử: `tests/phase-41-executive-dashboard.test.ts` (hàm thuần + tích hợp DB), `tests/phase-41-dashboard-tabs.test.ts` (phân quyền page), cập nhật `tests/phase-28-dashboard-role.test.ts`.
- **Risks**:
  - *Dữ liệu kỳ trước = 0*: `pctChange` trả `null` (UI hiện "—"), không bao giờ chia cho 0 và không hiện "0%" sai nghĩa.
  - *Bảo mật vai trò (ADR-0011)*: `getExecutiveBusinessMetrics` chỉ được gọi khi `resolveDashboardTab(role, tab) === 'business'`, mà hàm này luôn trả `'operations'` cho STAFF, bất kể query param.
  - *Số liệu lệch nhau*: KPI Doanh thu (`orders.total`) ≠ tổng doanh thu danh mục (`order_items.line_total`) — có chủ đích, ghi nhãn rõ trên UI (D2).
- **Definition of Done**: Xem mục cuối file.

---

## Slice 0 — Quyết định đã chốt (OWNER, 2026-10-21)

| # | Câu hỏi | Quyết định |
|---|---------|------------|
| D1 | Doanh thu In theo yêu cầu (custom request → quote ACCEPTED) không nằm trong `orders` | **Chỉ tính đơn hàng shop** (`orders`). Nhãn UI: "Doanh thu đơn hàng shop". Doanh thu quote cần cột `quotes.accepted_at` → phase sau. |
| D2 | KPI vs danh mục | KPI Doanh thu = `sum(orders.total)` (gồm ship/COD/VAT, trừ giảm giá). Danh mục = `sum(order_items.line_total)` — "Doanh thu hàng hoá (trước giảm giá, chưa gồm phí)". Tỉ lệ % mỗi thanh tính trên tổng danh mục, không tính trên KPI. `orderCount` mỗi danh mục = `count(distinct order)` — một đơn nhiều danh mục được đếm ở mỗi danh mục. Danh mục lấy theo **hiện tại** của sản phẩm (không snapshot); thiếu variant/product/category → "Chưa phân loại". |
| D3 | Trạng thái được tính doanh thu | `status <> 'CANCELLED' AND payment_status <> 'REFUNDED'`. Áp dụng cho **toàn bộ dashboard** (tab Kinh doanh + "Doanh thu hôm nay"/biểu đồ 14 ngày của OWNER ở tab Vận hành) qua một hằng SQL dùng chung, để hai tab không lệch nhau. |
| D4 | Nguồn "Nhựa đã dùng" | Sổ kho `material_movements`, `movement_type = 'PRODUCTION_OUT'`, chỉ vật liệu `unit = 'GRAM'`, `sum(-quantity)`. Gồm cả job FAILED/REPRINT (hao hụt thật). Lưu ý: là lượng đã trừ kho (theo `estimated_weight_grams` lúc bắt đầu in), không phải lượng cân thực tế. |
| D5 | Tab Vận hành cho OWNER | **Giữ nguyên** như hiện tại (OWNER vẫn thấy "Doanh thu hôm nay" + biểu đồ doanh thu 14 ngày). STAFF không đổi gì. |
| D6 | Ngưỡng tối thiểu nhựa | Không có cột ngưỡng trong schema → tái dùng ngưỡng **SAP_HET (≤ 20%)** của `filament.service.ts`. Gom theo `materials` (loại + màu), chỉ cuộn `ACTIVE`: `capacity = sum(initial)`, `remaining = sum(initial − used)`, `threshold = 20% × capacity`, `isLow = remaining ≤ threshold`. Không có hằng số thứ hai. |
| D7 | Cửa sổ thời gian | Kỳ hiện tại = 30 ngày lịch Asia/Ho_Chi_Minh `[hôm nay − 29, hôm nay]` (gồm hôm nay đang chạy). Kỳ trước = `[hôm nay − 59, hôm nay − 30]`. Chia theo ngày địa phương của `created_at`. Lọc bằng điều kiện dùng được index (`created_at >= mốc 00:00 địa phương`). |
| D8 | Tab & phân quyền | `resolveDashboardTab(role, raw)`: STAFF → luôn `operations`; OWNER → `operations` nếu `?tab=operations`, còn lại `business`. Tab = `<Link href="?tab=…">` render phía server, mỗi lần chỉ lấy dữ liệu tab đang mở. |

## Chi tiết các thành phần giao diện (UI Specs)

### 1. Bố cục tổng thể & Điều hướng Tab
- URL hỗ trợ search param: `/admin/dashboard?tab=business` (mặc định cho OWNER) hoặc `?tab=operations`.
- Khi user là `STAFF`: không render tab switcher, chỉ render tab "Vận hành xưởng" (giao diện hiện tại); `?tab=business` bị bỏ qua.
- Khi user là `OWNER`: Hiển thị tab switcher ở đầu trang (đổi tab = điều hướng, không có client state).

### 2. Tab "Kinh doanh & Tài chính" (OWNER Only)
1. **Hàng 1 — 4 Thẻ KPI (30 ngày vs 30 ngày trước)**:
   - **Doanh thu đơn hàng shop**: `sum(total)` các đơn được tính doanh thu (D3). Định dạng rút gọn `122,6 tr₫` / `215k₫`, badge delta `+20,1%`.
   - **Đơn hàng**: số đơn được tính doanh thu.
   - **Giá trị TB / đơn (AOV)**: `round(Doanh thu / Số đơn)` (số nguyên VND); 0 đơn → 0.
   - **Nhựa đã dùng**: kg theo D4.
   - Kỳ trước = 0 → badge "—" (không có cơ sở so sánh).
2. **Hàng 2 — Biểu đồ cột Doanh thu theo ngày (30 ngày)**:
   - **SVG thuần**, responsive, trục Y theo bước 1-2-5 (`niceAxisTicks`).
   - Cột xanh dương; cột Thứ Bảy / Chủ Nhật tô đậm hơn (cờ `isWeekend` tính trong SQL bằng `isodow`).
   - Tooltip khi hover **hoặc chạm/focus** (dùng được trên điện thoại & bàn phím): ngày, thứ, doanh thu VND, số đơn.
   - Tất cả 0 → empty state.
3. **Hàng 3 — Hai widget**:
   - **Trái — Doanh thu hàng hoá theo danh mục** (D2): thanh ngang Tailwind, `31,9 tr₫ · 138 đơn`, % trên tổng danh mục.
   - **Phải — Tồn kho nhựa in** (D6): thanh tiến trình `remaining / capacity`, vạch đứt tại ngưỡng 20%, đỏ khi `isLow`, xám khi an toàn, hiển thị gram còn lại.

---

## Các lát cắt triển khai (Vertical Slices)

### Slice 1: Hàm thuần + Service Layer
- `src/lib/executive-metrics.ts` — hàm thuần, không I/O.
- `src/lib/business-time.ts` — thêm `sqlLocalDayStart(dateExpr)` (mốc 00:00 địa phương dưới dạng `timestamptz`).
- `src/services/dashboard.service.ts`:
  ```ts
  interface PeriodComparison { current: number; previous: number; pctChange: number | null }
  interface ExecutiveDailyPoint { date: string; dayLabel: string; weekdayLabel: string; isWeekend: boolean; revenue: number; orderCount: number }
  interface ExecutiveBusinessMetrics {            // OWNER-only
    revenue30d: PeriodComparison; orders30d: PeriodComparison; aov30d: PeriodComparison;
    filamentUsedGrams30d: PeriodComparison;
    dailyTrends30d: ExecutiveDailyPoint[];       // đúng 30 phần tử, không hổng ngày
    categoryRevenue: { categoryId: string | null; categoryName: string; revenue: number; orderCount: number }[];
    filamentStock: FilamentThresholdRow[];       // STAFF-safe subset, không cột tiền
  }
  interface FilamentThresholdRow { materialId: string; materialName: string; materialType: string; color: string | null; spoolCount: number; capacityGrams: number; remainingGrams: number; thresholdGrams: number; isLow: boolean }
  ```
- 4 query chạy song song (`Promise.all`), không N+1: (1) 60 ngày đơn hàng → chia 2 kỳ trong JS; (2) danh mục 30 ngày; (3) `PRODUCTION_OUT` 60 ngày; (4) tồn kho nhựa.
- Hằng `REVENUE_ORDER_FILTER` dùng chung cho `getRevenueTrends`/`getFinancialMetrics`/executive (D3).

### Slice 2: UI Components
- 5 component như mục Outputs. Màu dùng class Tailwind/token (`fill-blue-500`, `bg-red-500`, `bg-muted`), không hardcode cho từng theme.

### Slice 3: Tích hợp Dashboard Page & Phân quyền
- `page.tsx` nhận `searchParams` (Promise trong Next 15), gọi `resolveDashboardTab`.
- `business` (chỉ OWNER): chỉ gọi `getExecutiveBusinessMetrics()`.
- `operations`: như cũ — `getOperationalMetrics()` + (OWNER) `getFinancialMetrics()`.

### Slice 4: Kiểm thử
- Hàm thuần: `pctChange` (kỳ trước 0, cả hai 0, giảm), AOV, format, trục Y, `resolveDashboardTab` (STAFF + `?tab=business`, mảng, rác), ngưỡng nhựa đúng biên 20%.
- Tích hợp DB (skip khi không có DB): đơn CANCELLED/REFUNDED không được tính; đơn 40 ngày trước vào kỳ trước; 30 điểm ngày liên tục, `isWeekend` khớp `isodow`; tổng ngày = KPI; danh mục test nhận đúng `line_total`; đơn không variant → "Chưa phân loại"; `PRODUCTION_OUT` vật liệu GRAM được cộng, vật liệu SPOOL bị bỏ; ngưỡng nhựa đúng; `filamentStock` không có trường tiền.
- Page: STAFF + `?tab=business` → hàm executive được gọi 0 lần, cây render không chứa tiền & không có tab switcher; OWNER mặc định business; OWNER `?tab=operations` không gọi executive.

---

## Definition of Done (DoD)
- [x] Slice 0 chốt + ADR-0044 trong `docs/architecture/decisions.md`.
- [x] Truy vấn SQL 30 ngày chính xác, không N+1, lọc theo điều kiện dùng được index.
- [ ] (OWNER kiểm tra trên trình duyệt) Giao diện tab "Kinh doanh & Tài chính" theo mockup (tôn trọng theme hiện có).
- [x] Biểu đồ cột 30 ngày phân biệt rõ ngày cuối tuần; tooltip dùng được trên cảm ứng.
- [x] Widget danh mục và tồn kho nhựa có vạch ngưỡng đúng logic D2/D6.
- [x] Phân quyền ADR-0011 được kiểm chứng bằng test: STAFF không thể xem số liệu doanh thu, kể cả với `?tab=business`.
- [x] `npm run typecheck` và `npm run lint` xanh.
- [x] Test mới + test dashboard cũ pass (kèm DB local).
- [x] Cập nhật `docs/roadmap.md`.

## Kết quả review độc lập (2026-10-21)
Không có BLOCKER. Đã sửa: tooltip bị đóng khi chạm (Android), bảng `sr-only` cho trình đọc màn hình thay cho 30 tab-stop, SVG `min-w-[640px]` + cuộn ngang trên điện thoại, trục Y không còn dư gấp đôi, `formatVndCompact` biên 999,96 tr → "1 tỷ₫", hằng ngưỡng chuyển sang `src/lib/filament-thresholds.ts`, thêm test biên 00:00 địa phương của today−29 / today−59 cho doanh thu, danh mục và nhựa.

## Addendum — dữ liệu giả cho dev (OWNER, 2026-10-21)
- `?demo=normal|empty|first-month` trên tab Kinh doanh, chỉ khi `NODE_ENV === 'development'` **và** OWNER (`resolveDemoScenario`). Dữ liệu sinh trong code (`src/lib/executive-demo-data.ts`), không chạm DB; có băng "DỮ LIỆU GIẢ".
- Chọn fixture thay vì seed vào Supabase Development vì sổ kho `material_movements` bất biến — dữ liệu giả không xoá được. SQL thật đã có test tích hợp riêng.
- Hướng dẫn: `docs/operations/local-testing.md` (mục Phase 41).

## Follow-up (ngoài phạm vi)
- Biểu đồ 14 ngày ở tab Vận hành vẫn đếm cả đơn huỷ/hoàn trong "số đơn" (doanh thu thì đã loại) — cân nhắc đổi nhãn "đơn đặt" hoặc lọc.
- Thêm `quotes.accepted_at` (migration) để tính doanh thu In theo yêu cầu (D1).
- Thống nhất định nghĩa doanh thu (loại REFUNDED) cho `expense.service.ts`.
- Snapshot danh mục vào `order_items` nếu OWNER cần số liệu danh mục bất biến theo lịch sử.
