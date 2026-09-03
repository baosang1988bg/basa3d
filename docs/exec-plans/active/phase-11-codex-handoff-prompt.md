# Prompt giao Codex Implement — Phase 11 (Admin Operations Hub, SVG Charts & Visual Process Pipelines)

Context: You are the implementation owner for Phase 11 of BaSa3D (see AI_WORKFLOW.md — Codex implements, Claude/Gemini review). Phase 12 (Filament Spools & Expenses) and prior phases are closed — see docs/exec-plans/completed/ and docs/exec-plans/active/phase-11.md.

Read first, in this order:
1. AGENTS.md — canonical engineering rules (Zero heavy dependencies, RBAC server-side enforcement, SVG charts, Conventional Commits).
2. docs/exec-plans/active/phase-11.md — this phase's complete brief, architecture decisions, SQL queries, and Definition of Done.
3. docs/database/schema.md and docs/database/business-rules.md — current database schema and status state machines.
4. Existing reference implementations: `src/components/admin/expense-charts.tsx` (SVG chart reference) and `src/services/dashboard.service.ts`.

Task: implement Phase 11 — Admin Operations Hub, SVG Analytics Charts & Visual Process Pipelines — ONLY. Non-goals: Do NOT add Recharts/Chart.js; do NOT modify underlying state machines of orders/custom-requests/print-jobs; do NOT leak financial/revenue data to STAFF.

Scope:
- **Slice 1 (Data Service)**: Mở rộng `src/services/dashboard.service.ts`:
  - `getOperationalMetrics()`: Trả về counts hôm nay, phễu `productionPipeline` (`QUEUED`, `PRINTING`, `QC`, `COMPLETED`, `FAILED`), phễu `customRequestPipeline`, `materialHealth` (tổng số cuộn, số cuộn sắp hết <= 15%), `dailyOrderTrends` (14 ngày qua dùng `generate_series`), và `actionableItems` (5 đơn hàng & 5 yêu cầu in mới nhất).
  - `getFinancialMetrics()`: Trả về `revenueToday`, `revenueThisMonth`, `revenueLast14Days`, và `dailyRevenueTrends` (14 ngày qua).
- **Slice 2 (Admin Nav & Shell)**: Cập nhật `src/components/admin/admin-nav.tsx`:
  - Tích hợp icon Lucide cho toàn bộ danh mục menu (`LayoutDashboard`, `Package`, `Boxes`, `Layers`, `ShoppingBag`, `FileEdit`, `Printer`, `BookOpen`, `Users`, `Receipt`, `Calculator`, `ShieldAlert`).
  - Highlight active link bằng `usePathname()` với visual border/bg indicator rõ ràng.
  - Hiển thị badge số công việc chờ xử lý (pending orders, open custom requests, active print jobs).
- **Slice 3 (SVG Dashboard Charts & Cards)**:
  - Tạo `src/components/admin/dashboard/revenue-orders-chart.tsx`: Biểu đồ SVG cột kết hợp đường xu hướng đơn hàng (14 ngày), hỗ trợ tooltip hover, responsive `viewBox`, thích ứng Dark/Light theme, render chế độ OWNER (Doanh thu + Đơn) vs STAFF (chỉ Đơn).
  - Tạo `src/components/admin/dashboard/production-pipeline.tsx`: Thanh phễu tiến trình việc in và custom request đa sắc màu.
  - Tạo `src/components/admin/dashboard/material-health-card.tsx`: Giám sát tồn kho nhựa in và danh sách cuộn sắp hết.
  - Tạo `src/components/admin/dashboard/recent-actionable-card.tsx`: Bảng xử lý nhanh đơn hàng & yêu cầu in mới nhất.
- **Slice 4 (Process Stepper)**:
  - Tạo `src/components/admin/process-stepper.tsx`: Stepper hiển thị quy trình từng chặng với 4 trạng thái trực quan (`completed`, `current`, `upcoming`, `cancelled/failed`).
  - Tích hợp vào:
    - `src/app/admin/(protected)/orders/[id]/page.tsx`
    - `src/app/admin/(protected)/custom-requests/[id]/page.tsx`
    - `src/app/admin/(protected)/print-jobs/[id]/page.tsx`
- **Slice 5 (Dashboard Page Refactor)**: Cập nhật `src/app/admin/(protected)/dashboard/page.tsx` thành Command Center hoàn chỉnh kết hợp KPI Cards, Revenue/Volume Chart, Production Pipeline, Material Health và Quick Action Cards.
- **Slice 6 (Quick Filter Tabs)**: Thêm status filter pills vào các trang danh sách Orders, Custom Requests, và Print Jobs.

Before reporting done:
- Viết unit tests cho `dashboard.service.ts` trong `tests/phase-11-dashboard-analytics.test.ts`.
- Chạy `npm run typecheck` — 0 errors.
- Chạy `npm run lint` — 0 warnings/errors.
- Chạy `npm test` — all tests pass.
- Đảm bảo giao diện kiểm tra tốt ở cả Light Theme và Dark Theme.

Commit style: small commits, Conventional Commits (e.g. `feat: expand dashboard service with 14-day trends`, `feat: add zero-dependency svg revenue chart`, `feat: add visual process stepper to detail pages`, `test: cover dashboard analytics calculations`). Do not move phase-11.md to docs/exec-plans/completed/ yourself.

Report back in exactly this format (per AGENTS.md):
1. Files changed
2. Behavior
3. Tests/checks run
4. Known risks
5. Follow-up work, if any
