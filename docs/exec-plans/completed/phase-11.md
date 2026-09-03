# Phase 11 — Admin Operations Hub, SVG Analytics Charts & Visual Process Pipelines

> **Mục đích**: Nâng cấp toàn diện UI/UX của hệ thống Quản trị (Admin) dành riêng cho OWNER và STAFF: bổ sung biểu đồ doanh thu/sản lượng theo ngày (zero external dependency, SVG thuần), quy trình trực quan (Visual Status Steppers/Pipelines) cho đơn hàng, yêu cầu in 3D, việc in xưởng, giám sát sức khỏe kho nhựa và các bộ lọc thao tác nhanh.

---

## 1. Rà soát hiện trạng (Codebase Audit)

- **Admin Dashboard (`/admin/dashboard`)**: Hiện chỉ có 6 thẻ số liệu đơn giản (`ordersToday`, `pendingOrders`, `customRequestsOpen`, `printJobsActive`, `lowStockCount`, `revenueToday`) render trên nền tối bằng thẻ Card chữ nhật trơn, thiếu biểu đồ trực quan, thiếu phễu theo dõi tiến độ việc in xưởng và danh sách việc cần xử lý ngay.
- **Admin Navigation (`AdminNav`)**: Danh sách text đơn giản, thiếu icon minh họa, chưa có badge cảnh báo việc cần xử lý ngay (đơn mới, yêu cầu in mới, việc in đang chạy), chưa highlight route đang chọn qua `usePathname()`.
- **Chi tiết Đơn hàng / Custom Request / Việc in**: Chỉ có form `select` dropdown để đổi trạng thái, thiếu thanh quy trình trực quan (Process Timeline / Stepper) để nhìn nhanh tiến độ từng chặng.
- **Trực quan hóa Xưởng in**: Chưa có phân bổ trạng thái việc in trên máy (Farm pipeline) và biểu đồ đo lường mức tồn kho vật liệu (gram cuộn nhựa).

---

## 2. Quyết định kiến trúc & Nguyên tắc kỹ thuật (Architectural Decisions)

1. **Kiến trúc Zero Heavy Dependencies (Rule #8 AGENTS.md)**:
   - Tuyệt đối không cài đặt Recharts, Chart.js, Tremor hay Canvas library.
   - Toàn bộ biểu đồ (Bar chart, Line/Dot trend, Donut/Segmented progress) được xây dựng bằng **SVG + Tailwind CSS** thuần túy (tương tự tiền lệ `ExpenseDonutChart` và `ExpenseMonthlyBarChart` ở Phase 12).
   - Biểu đồ tương thích 100% Dark Mode (`#0B1117`, `--border`, `--chart-1`, `--chart-2`) và Light Mode, responsive co giãn mượt mà theo `viewBox`.

2. **Bảo mật & Phân quyền Server-Side Masking (Rule #5 & ADR-0011)**:
   - **OWNER**: Xem toàn bộ biểu đồ Doanh thu (VND), Sản lượng đơn, Chi phí, Doanh thu hôm nay, Doanh thu 7 ngày/14 ngày.
   - **STAFF**: Chỉ xem biểu đồ Sản lượng / Số lượng đơn hàng (Volume), Phễu xưởng in, Cảnh báo kho nhựa. Toàn bộ trường tiền tệ (`revenue`, `amount`, `total`) được loại bỏ/mask ở server-side trong `dashboard.service.ts` trước khi gửi về client.

3. **Tối ưu hóa Database Query & Performance**:
   - Sử dụng SQL Aggregations với `generate_series(current_date - interval '13 days', current_date, '1 day')` để tạo dữ liệu liên tục 14 ngày không bị khuyết ngày (zero-gap timeline).
   - Truy vấn song song qua `Promise.all` trong `getOperationalMetrics` và `getFinancialMetrics`.

4. **Visual Process Steppers chuẩn hóa**:
   - Tạo component dùng chung `ProcessStepper` nhận danh sách steps, current status, status enum mapping và hiển thị 4 trạng thái: `completed` (xanh ngọc/emerald), `current` (xanh dương/amber), `upcoming` (xám/muted), `cancelled/failed` (đỏ/destructive).

---

## 3. Kế hoạch triển khai theo từng Slice (Technical Slices)

### Slice 1: Mở rộng Data Service (`src/services/dashboard.service.ts`)

Bổ sung các kiểu dữ liệu và hàm truy vấn:

```typescript
// STAFF-safe — must never carry a revenue/money field. Kept as its own type (not one shared
// "trend point" with an optional `revenue`) specifically so getOperationalMetrics() can never
// accidentally leak money to STAFF just by returning its rows as-is (Claude review blocker #2).
export interface OrderTrendPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "01/09"
  orderCount: number;
}

// OWNER-only.
export interface RevenueTrendPoint extends OrderTrendPoint {
  revenue: number;
}

export interface ProductionPipelineStats {
  queued: number;
  printing: number;
  qc: number;
  completed: number;
  failed: number;
}

export interface CustomRequestPipelineStats {
  new: number;
  reviewing: number;
  needInfo: number;
  quoted: number;
  approved: number;
  converted: number;
}

// Reuses filament.service.ts's getFilamentInventoryStats() (Phase 12, Q5's 4-tier
// CON_NHIEU/CAN_THEO_DOI/SAP_HET/DA_HET thresholds) instead of re-deriving stock-health
// thresholds here — the Materials page and the dashboard must agree on what counts as "sắp hết"
// (Claude review blocker #1: an earlier draft used its own 15%/30% cutoffs, which would have
// disagreed with the 20%/50% tiers already shipped in Phase 12).
export interface MaterialHealthOverview {
  totalSpools: number;
  totalRemainingWeightGrams: number;
  watchCount: number;   // CAN_THEO_DOI or worse (<=50%) — from getFilamentInventoryStats()
  lowStockCount: number; // SAP_HET or worse (<=20%) — from getFilamentInventoryStats()
  emptyCount: number;    // DA_HET (0g) — from getFilamentInventoryStats()
  byMaterialType: { materialType: string; count: number; totalWeightKg: number }[];
}

export interface ActionableRecentItems {
  pendingOrders: { id: string; orderCode: string; customerName: string; total: number; status: string; createdAt: Date }[];
  openCustomRequests: { id: string; requestCode: string; customerName: string; sourceChannel: string; status: string; createdAt: Date }[];
}
```

> **Correction (final review, 2026-09-03):** the `total: number` field on `pendingOrders` above was a
> security defect — `ActionableRecentItems` is returned by `getOperationalMetrics()`, the STAFF-safe
> path called unconditionally for every admin request (`layout.tsx`'s nav badges +
> `dashboard/page.tsx`), so a money field there would violate boundary #2 (ADR-0011) regardless of
> whether the current UI happened to render it. The shipped implementation
> (`src/services/dashboard.service.ts`) does **not** select or return `total` on `pendingOrders` —
> the field was removed from the type, the SQL `SELECT`, and the mapper. Covered by
> `tests/phase-11-dashboard-analytics.test.ts` ("actionableItems.pendingOrders never carries a money
> field"). If an OWNER-only order-value display is wanted on this widget later, it must be a separate
> OWNER-gated enrichment (like `getFinancialMetrics()`), never a field on the shared operational type.

Hàm mở rộng:
- `getOperationalMetrics()` (STAFF-safe, không được chọn cột tiền tệ nào):
  - Cập nhật trả về: `ordersToday`, `pendingOrders`, `customRequestsOpen`, `printJobsActive`, `lowStockCount`, `dailyOrderTrends: OrderTrendPoint[]` (14 ngày, KHÔNG có `revenue`), `productionPipeline`, `customRequestPipeline`, `materialHealth` (gọi `getFilamentInventoryStats()` từ `filament.service.ts` + query `byMaterialType` riêng), `actionableItems`.
- `getFinancialMetrics()` (OWNER-only — enforced bởi caller, theo đúng convention hiện tại):
  - Cập nhật trả về: `revenueToday`, `revenueThisMonth`, `revenueLast14Days`, `dailyRevenueTrends: RevenueTrendPoint[]` (14 ngày, CÓ `revenue`).

SQL 14-day zero-gap trend — **hai câu riêng biệt**, không dùng chung 1 query cho cả hai hàm:

STAFF-safe (dùng trong `getOperationalMetrics().dailyOrderTrends` — không select cột tiền):
```sql
SELECT
  to_char(d.day, 'YYYY-MM-DD') as date,
  to_char(d.day, 'DD/MM') as day_label,
  count(o.id)::int as order_count
FROM generate_series(current_date - interval '13 days', current_date, '1 day'::interval) d(day)
LEFT JOIN orders o ON o.created_at::date = d.day::date
GROUP BY d.day
ORDER BY d.day ASC;
```

OWNER-only (dùng trong `getFinancialMetrics().dailyRevenueTrends`):
```sql
SELECT
  to_char(d.day, 'YYYY-MM-DD') as date,
  to_char(d.day, 'DD/MM') as day_label,
  count(o.id)::int as order_count,
  coalesce(sum(case when o.status <> 'CANCELLED' then o.total else 0 end), 0)::bigint as revenue
FROM generate_series(current_date - interval '13 days', current_date, '1 day'::interval) d(day)
LEFT JOIN orders o ON o.created_at::date = d.day::date
GROUP BY d.day
ORDER BY d.day ASC;
```

---

### Slice 2: Enhanced Admin Navigation & Shell (`src/components/admin/admin-nav.tsx`)

- Tích hợp Lucide icons:
  - Dashboard ➔ `LayoutDashboard`
  - Sản phẩm ➔ `Package`
  - Tồn kho ➔ `Boxes`
  - Kho nhựa ➔ `Layers`
  - Đơn hàng ➔ `ShoppingBag`
  - Custom request ➔ `FileEdit`
  - Việc in ➔ `Printer`
  - Blog ➔ `BookOpen`
  - Nhân viên ➔ `Users`
  - Chi tiêu ➔ `Receipt`
  - Cấu hình giá ➔ `Calculator`
  - Nhật ký ➔ `ShieldAlert`
- Dùng `usePathname()` để highlight link active: `bg-primary/10 text-primary font-medium border-l-2 border-primary`.
- Hiển thị badge số lượng công việc đang chờ xử lý theo thời gian thực (nếu > 0).

---

### Slice 3: Analytics & Chart Components (`src/components/admin/dashboard/`)

1. **`revenue-orders-chart.tsx`**:
   - Biểu đồ cột đôi/kết hợp SVG: Cột hiển thị Doanh thu (cho OWNER) hoặc Cột hiển thị Số lượng đơn (cho STAFF).
   - Đường polyline mượt mà biểu thị xu hướng đơn hàng.
   - Tương tác hover hiển thị Tooltip nổi chi tiết giá trị của từng ngày.
   - Thước đo trục Y tự tính bước (tick intervals) mượt mà.

2. **`production-pipeline.tsx`**:
   - Phễu việc in xưởng (Farm Pipeline): Thanh tiến trình phân đoạn nhiều màu (`QUEUED` vàng, `PRINTING` xanh dương, `QC` tím, `COMPLETED` xanh ngọc).
   - Phễu Custom Requests: Trực quan hóa tỷ lệ chuyển đổi từ yêu cầu mới tới chốt đơn.

3. **`material-health-card.tsx`**:
   - Đồng hồ đo lượng nhựa tiêu chuẩn và danh sách cảnh báo các cuộn nhựa `< 15%` cần thay lõi ngay.

4. **`recent-actionable-card.tsx`**:
   - Bảng truy cập nhanh 5 đơn hàng mới nhất và 5 yêu cầu in mới nhất kèm nút 1-click chuyển đến trang xử lý.

---

### Slice 4: Visual Process Stepper cho 3 trang chi tiết

1. **`src/components/admin/process-stepper.tsx`**:
   - Hỗ trợ rendering dạng timeline ngang / chevron steps trực quan với icon và timestamp.
2. Tích hợp vào:
   - `src/app/admin/(protected)/orders/[id]/page.tsx`:
     `NEW` ➔ `CONFIRMED` ➔ `PRODUCING` ➔ `READY_TO_SHIP` ➔ `SHIPPED` ➔ `COMPLETED` (hoặc `CANCELLED`).
   - `src/app/admin/(protected)/custom-requests/[id]/page.tsx`:
     `NEW` ➔ `REVIEWING` ➔ `NEED_INFO` / `QUOTED` ➔ `APPROVED` ➔ `CONVERTED` (hoặc `REJECTED`).
   - `src/app/admin/(protected)/print-jobs/[id]/page.tsx`:
     `QUEUED` ➔ `PRINTING` ➔ `QC` ➔ `COMPLETED` (hoặc `FAILED` / `REPRINT` / `CANCELLED`).

---

### Slice 5: Refactor `/admin/dashboard/page.tsx`

Cấu trúc lại layout Dashboard thành Command Center hoàn chỉnh:
- **Hero / Header**: Chào mừng Admin, hiển thị ngày giờ và vai trò (`OWNER` / `STAFF`).
- **Row 1 - KPI Grid**: 5 thẻ số liệu chính với icon màu nổi bật, viền phát sáng nhẹ, badge trạng thái.
- **Row 2 - Main Analytics**:
  - Cột 1 (2/3 width): Biểu đồ Doanh thu & Sản lượng 14 ngày (`RevenueOrdersChart`).
  - Cột 2 (1/3 width): Phễu Vận hành Xưởng (`ProductionPipelineCard`).
- **Row 3 - Action & Health**:
  - Cột 1 (1/2 width): Sức khỏe Kho Nhựa & Cảnh báo cuộn sắp hết (`MaterialHealthCard`).
  - Cột 2 (1/2 width): Danh sách Đơn & Yêu cầu cần xử lý ngay (`RecentActionableCard`).

---

### Slice 6: Status Filter Tabs trên các trang danh sách

- Bổ sung bộ lọc nhanh (All, Pending, In Progress, Completed, Cancelled) dạng tab pill vào:
  - `src/app/admin/(protected)/orders/page.tsx`
  - `src/app/admin/(protected)/custom-requests/page.tsx`
  - `src/app/admin/(protected)/print-jobs/page.tsx`

---

## 4. Checklist triển khai (Phase 11 Checklist)

### Trước khi code
- [x] Soạn thảo Implementation Plan chi tiết.
- [x] Gửi Claude Review và phê duyệt. (2 blockers found — trùng lặp ngưỡng cảnh báo kho nhựa với
  Phase 12, và rủi ro rò rỉ `revenue` sang STAFF qua kiểu `DailyTrendPoint` dùng chung — đã sửa
  trực tiếp trong plan ở trên: dùng `getFilamentInventoryStats()` và tách 2 kiểu/2 query riêng.)

### Thực hiện Code
- [x] Mở rộng `src/services/dashboard.service.ts` với đầy đủ query 14 ngày và pipeline metrics.
- [x] Nâng cấp `src/components/admin/admin-nav.tsx` với icon Lucide và `usePathname()`.
- [x] Tạo `src/components/admin/dashboard/revenue-orders-chart.tsx`.
- [x] Tạo `src/components/admin/dashboard/production-pipeline.tsx`.
- [x] Tạo `src/components/admin/dashboard/material-health-card.tsx`.
- [x] Tạo `src/components/admin/dashboard/recent-actionable-card.tsx`.
- [x] Tạo `src/components/admin/process-stepper.tsx`.
- [x] Cập nhật `src/app/admin/(protected)/dashboard/page.tsx`.
- [x] Tích hợp `ProcessStepper` vào Orders, Custom Requests, Print Jobs detail pages.
- [x] Thêm Status Filter Tabs cho 3 trang danh sách.

### Kiểm thử & Hoàn tất
- [x] Viết unit tests cho `dashboard.service.ts` (`tests/phase-11-dashboard-analytics.test.ts`).
- [x] Chạy `npm run typecheck` đạt 0 lỗi.
- [x] Chạy `npm run lint` đạt 0 lỗi.
- [x] Chạy `npm test` pass 100% (126/126, sau khi thêm test chặn money-leak bên dưới).
- [x] Verify UI qua trình duyệt thật (Playwright, `e2e/dashboard.spec.ts`) với tài khoản OWNER và
  STAFF thật — 4/4 pass. Phát hiện và sửa 2 lỗi thật trong lúc verify (xem addendum bên dưới).
- [x] Di chuyển sang `docs/exec-plans/completed/phase-11.md`.

---

## 5. Addendum — Final closing review (2026-09-03)

Browser verification (previously skipped — see the removed blocker note above) surfaced two real
bugs that unit tests alone had not caught:

1. **Money leak (security, fixed)**: `ActionableRecentItems.pendingOrders` (returned by
   `getOperationalMetrics()`, the STAFF-safe path called on every admin request via
   `layout.tsx`'s nav badges) selected and returned `total` from `orders` — a money field on a
   type explicitly documented as STAFF-safe, contradicting ADR-0011 boundary #2. The current UI
   never rendered it, so this wasn't visible in manual eyeballing, but it was a real defect in the
   server-side data contract (Rule #5, AGENTS.md: UI hiding is not security). Fixed by removing
   `total` from the type, the SQL `SELECT`, and the mapper in `dashboard.service.ts`; covered by a
   new test in `tests/phase-11-dashboard-analytics.test.ts` asserting no `total` field is ever
   present. See the correction note inline in Slice 1 above.
2. **Status filter tabs didn't work in production (correctness, fixed)**: clicking a
   `StatusFilterTabs` pill (built with `next/link`'s `<Link>`) silently did nothing in a real
   `next build && next start` browser session — the RSC fetch for the new URL succeeded (200), but
   the client-side App Router never committed the navigation (URL and DOM both stayed unchanged).
   Reproduced consistently; does **not** reproduce in `next dev`, which is why it was missed before
   real browser testing. Root-caused to Next.js's client-side soft-navigation for a same-route,
   search-param-only URL change, not application logic — confirmed by testing with `prefetch={false}`
   (no change) and with a plain `<a>` tag (fixed it immediately, full page reload per filter click).
   `src/components/admin/status-filter-tabs.tsx` now renders a plain anchor instead of `next/link`'s
   `Link`; see the comment in that file for the full repro notes. Covered by
   `e2e/dashboard.spec.ts`'s status-filter test (URL updates, filtered results correct, invalid
   filter value falls back to "Tất cả" instead of crashing).

Unrelated, out-of-scope finding recorded for visibility only: the full E2E suite run during this
review also showed `e2e/checkout.spec.ts`'s two guest-checkout flows failing (button click never
navigates to `/order-confirmation`) on the public storefront (Phase 5 scope, not Phase 11). Not
investigated or touched here — flagged in the Phase 11 closing report as a known risk for whoever
next touches checkout.
