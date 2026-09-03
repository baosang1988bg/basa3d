# Phase 12 — Quản lý Kho Nhựa Theo Cuộn (Filament Spools) & Thống kê Chi Tiêu Xưởng (Expense Tracking & Financial Analytics)

> **Mục đích**: Xây dựng phân hệ Quản lý Kho Nhựa (chi tiết theo từng cuộn nhựa, mã cuộn, gram tiêu hao và cảnh báo sắp hết) đồng thời bổ sung phân hệ Quản lý & Thống kê Chi Tiêu Xưởng (Expense Accounting & Financial Analytics) cho OWNER dựa trên dữ liệu thực tế từ 2 Google Sheets của BaSa3D.

---

## 1. Nguồn dữ liệu thực tế & Bối cảnh

### 1.1. Dữ liệu Kho Nhựa (Google Sheet: "QUẢN LÝ KHO NHỰA")
- **Sheet 1: DANH MỤC NHỰA**: 27 mã cuộn thuộc các dòng `PLA LITE`, `PLA MATTE`, `PLA R3D`, `PETG BASIC`.
  - Quy ước mã: `PLA-L-L-xxx` (Có Lõi), `PLA-L-KL-xxx` / `PETG-B-KL-xxx` (Không Lõi).
  - Màu sắc: Xanh lá, Đen, Trắng, Cam, Đỏ hồng, Be, Nâu, Xanh dương, Xám đậm, Tím, Yellow...
- **Sheet 2: TỔNG KHO**: Theo dõi từng cuộn theo khối lượng:
  - Khối lượng ban đầu (1.000g), Đã dùng (g), Còn lại (g), % Còn lại.
  - Trạng thái tự động: *Còn nhiều* (>50%), *Cần theo dõi* (≤50%), *Sắp hết* (≤20%), *Đã hết* (0g).
  - Thống kê tổng quan: Tổng số cuộn (27), Tổng kg tồn (27kg), Đã dùng (0kg), Cuộn sắp hết (0).
- **Sheet 3: LỊCH SỬ SỬ DỤNG**: Ghi nhận tiêu hao theo từng lần in (Ngày, Mã cuộn, Sản phẩm/Đơn in, Gram, Người thao tác).

### 1.2. Dữ liệu Chi Tiêu (Google Sheet: "CHI TIÊU")
- Theo dõi 8 khoản chi đầu tư và vận hành xưởng (~27.184.500đ):
  - Máy móc / Thiết bị (Bambu Lab P2S ~20.619.000đ).
  - Nhựa in (PLA, PETG, Matte, Lite...).
  - Tiện ích / Hạ tầng điện (Ổ điện 2 cái ~586.500đ).
  - Phụ kiện sản phẩm (Clicker 100 cái ~134.000đ).
  - Chi phí vận chuyển / Vận hành xưởng.
- Trường dữ liệu: Ngày, Chi tiêu, Danh mục, Tổng chi phí (VND), Trạng thái, Người chi ("Sa"), Số lượng, Ghi chú (ship fee...).

---

## 2. Quyết định kiến trúc đã chốt sau Gemini Challenge (2026-09-01)

1. **Quan hệ `filament_spools` ↔ `material_movements` (Q1 - Đã chốt)**:
   - Thêm cột `material_movements.spool_id uuid references filament_spools(id) on delete restrict` (nullable).
   - Khi phát sinh biến động thuộc về một cuộn cụ thể (`PURCHASE`, `PRODUCTION_OUT`, `DAMAGE_OUT`, `ADJUSTMENT_IN/OUT`), điền `spool_id`.
   - Giữ nguyên `reference_type` / `reference_id` để liên kết với `PRINT_JOB` phục vụ tính COGS.
   - `filament_spools.used_weight_grams` đóng vai trò cached counter để render nhanh ở Admin, nhưng bắt buộc được cập nhật trong cùng transaction ghi ledger `material_movements`.
   - **Tích hợp bắt buộc với luồng production thật (bổ sung sau review 2026-09-01)**: `src/services/print-job.service.ts` — hàm `updatePrintJobStatus`, nhánh chuyển sang `PRINTING` (dòng ghi `PRODUCTION_OUT` hiện tại, dùng `lockMaterialForInventoryWrite` + `resolveWarehouseForMaterial`, không có `spool_id`) — **phải được sửa trong Phase 12**, không chỉ thêm bảng mới song song. Cụ thể:
     - `print_jobs` cần thêm cột `spool_id uuid references filament_spools(id) on delete restrict` (nullable — job cũ trước Phase 12 không có).
     - Trước khi cho phép chuyển `QUEUED/REPRINT → PRINTING`, nếu `material_id` đã gán, bắt buộc `spool_id` cũng phải được gán (UI print-job start dialog thêm bước chọn cuộn cụ thể trong số các cuộn `ACTIVE` cùng `material_id`).
     - Nhánh ghi `PRODUCTION_OUT` trong `updatePrintJobStatus` thay `lockMaterialForInventoryWrite(client, materialId)` bằng lock cuộn cụ thể (`SELECT id FROM filament_spools WHERE id = $1 FOR UPDATE`) rồi mới insert `material_movements` (kèm `spool_id`) và `UPDATE filament_spools SET used_weight_grams = used_weight_grams + $weight` trong cùng transaction — dùng chung 1 hàm với `recordSpoolUsage` ở Slice 2 thay vì viết logic trùng lặp.
     - Không sửa `lockMaterialForInventoryWrite`/ADR-0018 cho các bảng khác (`materials` không gắn `filament_spools`, ví dụ nguyên liệu mua rời không theo cuộn, nếu có) — chỉ áp dụng đường đi mới khi `print_jobs.material_id` có `filament_spools` tương ứng.

2. **Concurrency Lock Protocol theo cuộn (Q2 - Đã chốt, phạm vi thu hẹp lại sau review 2026-09-01)**:
   - **Phạm vi Phase 12: mỗi print job dùng đúng 1 cuộn** (`print_jobs.spool_id` đơn, không phải mảng). Xưởng hiện chưa dùng máy in AMS (multi-material cùng lúc); hỗ trợ multi-spool/AMS cho 1 job bị đẩy ra ngoài phạm vi Phase 12 — ghi rõ ở Non-Goals bên dưới, không thiết kế hạ tầng cho nó ở đây để tránh over-engineering (Rule #8/#9 AGENTS.md). Khi có nhu cầu thật, làm phase riêng: cần thêm bảng con `print_job_spool_usages` và sửa `print_jobs`.
   - Concurrency thực sự cần bảo vệ là: **nhiều print job khác nhau cùng lúc chọn trùng 1 cuộn**, hoặc kiểm kê (`adjustSpoolStock`) chạy song song với `recordSpoolUsage` trên cùng cuộn. Protocol: `SELECT id FROM filament_spools WHERE id = $1 FOR UPDATE` (khóa đúng 1 cuộn, không cần sắp thứ tự vì luôn là 1 hàng) trước khi tính `used_weight_grams` mới và insert `material_movements`. Đây là bản thu gọn của "lock-by-proxy" đã dùng ở `order.service.ts`/`print-job.service.ts`, không phải cơ chế mới.

3. **Chiến lược Seed Idempotent đồng bộ Ledger (Q3 - Đã chốt, làm rõ cách viết SQL sau review 2026-09-01)**:
   - Seed 27 cuộn từ Google Sheet bằng **1 CTE duy nhất**: `WITH inserted_spools AS (INSERT INTO filament_spools (...) VALUES (...) ON CONFLICT (spool_code) DO NOTHING RETURNING id, initial_weight_grams) INSERT INTO material_movements (..., spool_id, ...) SELECT id, ..., initial_weight_grams, ... FROM inserted_spools`. Bắt buộc theo dạng này (insert `material_movements` SELECT trực tiếp từ `RETURNING` của insert `filament_spools`, không phải 2 câu INSERT độc lập) — vì `material_movements` không có unique constraint nào tự chặn trùng, và có trigger `prevent_ledger_mutation` nên không thể sửa/xoá nếu insert sai. Nếu insert `filament_spools` bị `ON CONFLICT DO NOTHING` bỏ qua (đã seed trước đó), CTE `RETURNING` không trả dòng đó ra, nên `material_movements` insert theo sau cũng tự động không tạo dòng PURCHASE trùng — chạy lại migration an toàn cho cả 2 bảng cùng lúc.
   - `reference_type = 'SEED_MIGRATION'` cho các dòng `PURCHASE` này.
   - Seed 8 khoản chi thực tế vào `expenses` với `ON CONFLICT (expense_code) DO NOTHING`.
   - Thêm 1 test trong `tests/migration-contract.test.ts` (theo đúng pattern Phase 10 đã dùng cho `analytics_purchase_sent_at`) assert migration SQL insert `material_movements` bằng `SELECT ... FROM` join với kết quả `RETURNING` của insert `filament_spools`, không phải 2 statement độc lập.

4. **Bảo mật & Phân quyền Server-side Masking (Q4 - Đã chốt, sửa cách enforce quyền sau review 2026-09-01)**:
   - Phân hệ **Chi tiêu (`expenses`) & Thống kê Tài chính**: **100% OWNER-only**. Route `/admin/expenses` (page + mọi Server Action) gọi `requireOwner()` có sẵn ở `src/lib/auth/require-admin.ts` — **không** viết `assertOwnerRole(actorId)` riêng trong `expense.service.ts`. Đây là convention đã thống nhất toàn bộ codebase (xem comment trong `pricing-config.service.ts`: "OWNER-only is enforced by the caller (route/action) via requireOwner(), same pattern as staff.service/deleteProduct — this service itself does not check role."). `expense.service.ts` nhận `actorId`/role đã được xác thực từ caller, không tự check lại.
   - Phân hệ **Kho Nhựa (`filament_spools`)**: `STAFF` được truy cập để thực hiện tác nghiệp xưởng (xem mã cuộn, màu sắc, kiểm kê, chọn cuộn in) — dùng `requireAdmin()` (không yêu cầu `OWNER`).
   - Riêng cột `purchase_cost` (giá mua cuộn): Service layer thực hiện **Server-side Masking** (`role === 'OWNER' ? purchase_cost : null`), tuyệt đối không gửi giá mua về client của `STAFF` (tuân thủ Rule #5 "UI hiding is not security"). Đây là lần đầu codebase áp dụng field-level masking theo role (chưa có tiền lệ ở `product.service.ts`/`cost_price`) — viết thành 1 helper nhỏ dùng lại được (`maskIfNotOwner<T>(value, role)`), không lặp lại ternary ở nhiều chỗ.

5. **Ý nghĩa cột `filament_spools.status` (làm rõ sau review 2026-09-01)**:
   - `status` chỉ lưu 2 trạng thái nghiệp vụ có người/hệ thống chủ động set: `ACTIVE` (mặc định, đang dùng được) và `ARCHIVED` (ngừng dùng, set thủ công bởi Admin — ví dụ cuộn lỗi/hỏng bỏ đi dù còn gram). Bỏ `LOW_STOCK`/`EMPTY` khỏi CHECK constraint của cột `status`.
   - 4 tầng cảnh báo hiển thị ở UI (*Còn nhiều* >50%, *Cần theo dõi* ≤50%, *Sắp hết* ≤20%, *Đã hết* 0g) **tính runtime** từ `(initial_weight_grams - used_weight_grams) / initial_weight_grams`, không lưu trong cột riêng — tránh lệch dữ liệu giữa cột lưu và % thực tế mỗi khi `used_weight_grams` đổi. `getFilamentInventoryStats()` (Slice 2) và bảng danh sách (Slice 3) đều tính lại từ % mỗi lần query, không đọc `status` cho việc này.
   - Migration Slice 1 sửa: `status varchar(30) not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED'))`.

---

## 3. Goals & Non-Goals

### Goals
1. Quản lý kho nhựa chi tiết theo từng cuộn nhựa vật lý (`filament_spools`), mã cuộn, khối lượng thực tế, % tồn và cảnh báo tự động.
2. Tích hợp chặt chẽ với sổ cái nguyên liệu bất biến `material_movements` dưới row-lock an toàn.
3. Quản lý và thống kê chi tiêu xưởng in (`expenses`), báo cáo dòng tiền (Doanh thu vs Chi tiêu) cho OWNER.
4. Giao diện trực quan (thẻ KPI, bảng trạng thái màu, biểu đồ phân bổ chi phí SVG thuần).
5. Seed chính xác toàn bộ dữ liệu từ 2 Google Sheets của BaSa3D.

### Non-Goals
- Không sửa logic sổ cái tồn kho thành phẩm `inventory_movements` của Phase 2.
- Không thêm thư viện biểu đồ ngoài (Recharts/Chart.js); dùng thuần SVG + Tailwind.
- Không cấp quyền xem số liệu tài chính / chi phí cho tài khoản `STAFF`.
- **Không hỗ trợ multi-spool/AMS cho 1 print job** (xem Q2) — mỗi job vẫn dùng đúng 1 cuộn, khớp với `print_jobs.material_id` hiện tại là cột đơn. Đây là quyết định thu hẹp phạm vi, không phải thiếu sót — xưởng chưa dùng máy AMS.

---

## 4. Kế hoạch triển khai kỹ thuật theo Vertical Slices

### Slice 1: Database & Schema Migrations
- [x] **Migration `20260903000000_filament_spools_and_expenses.sql`**:
  - Tạo bảng `filament_spools`:
    - `id uuid primary key default gen_random_uuid()`
    - `spool_code varchar(60) not null unique` (ví dụ: `PLA-L-L-001`, `PLA-L-KL-002`)
    - `material_id uuid not null references materials(id) on delete restrict`
    - `warehouse_id uuid not null references warehouses(id) on delete restrict`
    - `initial_weight_grams integer not null check (initial_weight_grams > 0)` (mặc định 1000)
    - `used_weight_grams integer not null default 0 check (used_weight_grams >= 0 and used_weight_grams <= initial_weight_grams)`
    - `purchase_cost bigint check (purchase_cost >= 0)` (VND minor unit)
    - `has_spool boolean not null default true` (true: Có lõi `L`, false: Không lõi `KL`)
    - `status varchar(30) not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED'))` (xem Q5 — 4 tầng cảnh báo còn lại tính runtime từ %, không lưu ở đây)
    - `note text`
    - `created_at timestamptz not null default timezone('utc', now())`
    - `updated_at timestamptz not null default timezone('utc', now())`
  - Thêm cột `spool_id uuid references filament_spools(id) on delete restrict` vào bảng `material_movements`.
  - Tạo index `material_movements_spool_id_idx on material_movements(spool_id, created_at desc)`.
  - Thêm cột `spool_id uuid references filament_spools(id) on delete restrict` vào bảng `print_jobs` (nullable — job cũ trước Phase 12 không có; xem Q1 tích hợp với `updatePrintJobStatus`).
  - Tạo bảng `expenses`:
    - `id uuid primary key default gen_random_uuid()`
    - `expense_code varchar(40) not null unique` (ví dụ: `EXP-20260819-001`)
    - `title varchar(200) not null check (btrim(title) <> '')`
    - `category varchar(50) not null check (category in ('EQUIPMENT', 'MATERIAL', 'ACCESSORIES', 'UTILITIES', 'LOGISTICS', 'MARKETING', 'OTHER'))`
    - `amount bigint not null check (amount >= 0)` (VND minor unit)
    - `quantity integer not null default 1 check (quantity > 0)`
    - `status varchar(30) not null default 'PAID' check (status in ('PAID', 'PENDING', 'CANCELLED'))`
    - `payer_name varchar(100)` (ví dụ: "Sa")
    - `spent_at timestamptz not null default timezone('utc', now())`
    - `note text`
    - `created_by uuid` — **triển khai lệch khỏi bản kế hoạch gốc**: dùng plain `uuid`, không FK
      `references auth.users(id)`, để nhất quán với convention toàn codebase
      (`material_movements.created_by`/`pricing_configs.created_by` đều là plain uuid, `audit_logs`
      mới là nguồn "ai đã làm gì" chính thức). FK thật sẽ vỡ với mọi `ACTOR_ID` test giả lập dùng
      chung trong 6+ file test hiện có, mà không đổi lại lợi ích an toàn dữ liệu nào — xem ADR-0026.
    - `created_at timestamptz not null default timezone('utc', now())`
    - `updated_at timestamptz not null default timezone('utc', now())`
  - Trigger `updated_at` tự động cho `filament_spools` và `expenses`.
- [x] **Migration Seed Data CTE `20260903000001_filament_spools_and_expenses_seed.sql`** (1 CTE nối `RETURNING` — xem Q3, không phải 2 statement độc lập):
  - Seed 27 cuộn nhựa thật từ Sheet "QUẢN LÝ KHO NHỰA" (lấy trực tiếp từ Google Sheet, 2026-09-01)
    kèm ghi nhận 27 dòng `PURCHASE` (+1000g) vào `material_movements`, `spool_id` lấy từ `RETURNING
    id` của insert `filament_spools`. Không có `purchase_cost` — cột GIÁ trong sheet đang trống cho
    cả 27 dòng. 2 dòng (`PLA-M-L-004`, `PLA-M-L-005`) có `material_type` trong sheet gốc không khớp
    quy ước mã cuộn của chính chúng (ghi "PLA LITE"/"PLA MATE" thay vì "PLA MATTE") — đã chuẩn hoá
    thành "PLA MATTE" khi seed, ghi rõ trong comment migration.
  - Seed khoản chi tiêu thật từ Sheet "CHI TIÊU" vào `expenses` (`ON CONFLICT DO NOTHING`) —
    **thực tế là 9 dòng, không phải 8** như ước lượng ban đầu trong tài liệu này; tổng
    ₫27.184.500 khớp chính xác với dòng tổng của sheet trên cả 9 dòng.
- [x] **`tests/migration-contract.test.ts`**: assert migration insert `material_movements` bằng CTE nối `RETURNING`, không phải insert độc lập (Q3).

### Slice 2: Services & Server Actions Layer
- [x] **`src/services/filament.service.ts`**:
  - `listFilamentSpools(filters, actorRole)`: Trả về danh sách cuộn kèm % tồn kho tính runtime, badge cảnh báo (Còn nhiều/Cần theo dõi/Sắp hết/Đã hết — tính từ %, không đọc cột `status`). Tự động mask `purchaseCost = null` nếu `actorRole === 'STAFF'` (dùng chung helper `maskIfNotOwner`, xem Q4).
  - `getFilamentInventoryStats()`: Thống kê tổng số cuộn, tổng kg, số cuộn sắp hết (≤20%), số cuộn đã hết (0g) — tính runtime từ %, cùng công thức với `listFilamentSpools`.
  - `createFilamentSpool(data, actorId)`: Tạo cuộn mới và ghi `PURCHASE` vào `material_movements` trong cùng transaction.
  - `recordSpoolUsage(client, spoolId, usedGrams, referenceType, referenceId, actorId)`: nhận sẵn `client` (transaction) để dùng chung được từ cả Admin UI (tự mở transaction) lẫn `print-job.service.ts` (gọi trong transaction `updatePrintJobStatus` đã có sẵn). Lock 1 cuộn (`FOR UPDATE`, xem Q2) → kiểm tra `used_weight_grams + usedGrams <= initial_weight_grams` → tăng `used_weight_grams` → ghi `PRODUCTION_OUT` vào `material_movements` kèm `spool_id`.
  - `adjustSpoolStock(spoolId, newRemainingGrams, reason, actorId)`: Điều chỉnh tồn kho kiểm kê (`ADJUSTMENT_IN/OUT`), cùng lock protocol Q2.
- [x] **Sửa `src/services/print-job.service.ts`** (bắt buộc theo Q1, không phải việc tùy chọn):
  - `updatePrintJobStatus`, nhánh `status === 'PRINTING'`: nếu `print_jobs.spool_id` đã gán, gọi `recordSpoolUsage(client, spoolId, estimatedWeightGrams, 'print_job', id, actorId)` thay cho đoạn `lockMaterialForInventoryWrite` + insert `material_movements` thủ công hiện tại (dòng ghi `PRODUCTION_OUT` cũ). Nếu job không có `spool_id` (job tạo trước Phase 12, hoặc material không theo dõi theo cuộn), giữ nguyên đường cũ (`lockMaterialForInventoryWrite`) để không phá luồng hiện có.
  - Thêm validate: không cho chuyển sang `PRINTING` nếu `material_id` đã gán nhưng `spool_id` chưa gán (lỗi `PRINT_JOB_SPOOL_REQUIRED`) — trừ khi material đó không có cuộn nào active (fallback đường cũ ở trên).
- [x] **`src/services/expense.service.ts`**:
  - Không viết `assertOwnerRole` riêng — route/Server Action gọi `requireOwner()` có sẵn (`src/lib/auth/require-admin.ts`), theo đúng convention `pricing-config.service.ts` đang dùng (xem Q4). `expense.service.ts` chỉ nhận `actorId` đã xác thực.
  - `listExpenses(filters)`: Lấy danh sách chi tiêu có phân trang, lọc theo danh mục / thời gian / người chi.
  - `getExpenseFinancialSummary()`: Tổng chi phí theo danh mục, tính Net Operating Cash Flow (Tổng doanh thu đơn hàng `orders.status != 'CANCELLED'` - Tổng `expenses`).
  - `createExpense(data, actorId)`: Thêm khoản chi mới.
  - `updateExpense(id, data, actorId)`: Cập nhật khoản chi.
  - `deleteExpense(id, actorId)`: **Soft-cancel** — `UPDATE expenses SET status = 'CANCELLED'`, không `DELETE` hàng (Rule #7 AGENTS.md: "never delete financial/order history casually").

### Slice 3: Admin UI — Quản lý Kho Nhựa (`/admin/materials`) & tích hợp Print Job

- [x] **Giao diện Kho Nhựa**:
  - **Thẻ KPI**: Tổng số cuộn, Tổng kg tồn, Cuộn cần theo dõi (≤50%), Cuộn sắp hết (≤20%), Cuộn đã hết (0g).
  - **Bảng danh sách cuộn nhựa**:
    - Cột: Mã cuộn (`PLA-L-L-001`), Loại nhựa, Màu sắc, Loại lõi (Badge Có lõi/Không lõi), Khối lượng (Ban đầu / Đã dùng / Còn lại), Progress Bar trực quan % còn lại, Trạng thái hiển thị (Còn nhiều / Cần theo dõi / Sắp hết / Đã hết — **tính runtime từ %**, xem Q5, không phải cột `status` DB), Giá mua (chỉ hiện cho OWNER).
  - **Bộ lọc**: Lọc theo Dòng nhựa (`PLA LITE`, `PETG BASIC`...), Màu sắc, Trạng thái tồn (tính runtime, không lọc theo cột `status`).
  - **Thao tác**:
    - Dialog / Form Thêm cuộn nhựa mới.
    - Dialog Điều chỉnh gram thực tế (Kiểm kê cân nặng).
    - Dialog / Modal Xem lịch sử tiêu hao của cuộn (truy vấn từ `material_movements WHERE spool_id = $1`).
- [x] **Sửa `src/app/admin/(protected)/print-jobs/[id]/page.tsx`** (bắt buộc theo Q1): khi bắt đầu in (chuyển `PRINTING`) và job đã gán `material_id`, thêm bước chọn `spool_id` cụ thể trong số các cuộn `status = 'ACTIVE'` cùng `material_id` (dropdown/list hiện mã cuộn + % còn lại, để người thao tác không chọn nhầm cuộn sắp hết). Không thêm route/trang mới — sửa trực tiếp trang print-job đã có.

### Slice 4: Admin UI — Quản lý & Thống kê Chi Tiêu (`/admin/expenses`)
- [x] **Giao diện Thống kê Chi Tiêu & Dòng Tiền (OWNER)**:
  - **Bảo mật**: Server component kiểm tra `role === 'OWNER'`, redirect hoặc render 403 nếu `STAFF`.
  - **Thẻ Tài chính KPI**:
    - Tổng chi xưởng tích lũy.
    - Chi tiêu tháng này.
    - Doanh thu bán hàng từ Đơn hàng.
    - Dòng tiền ròng (Net Balance = Doanh thu - Chi phí).
  - **Biểu đồ phân bổ chi tiêu SVG**:
    - Biểu đồ Donut SVG phân bổ % chi phí theo nhóm (Máy in / Nhựa / Phụ kiện / Tiện ích / Vận chuyển).
    - Biểu đồ cột SVG chi tiêu theo tháng.
  - **Bảng danh sách Chi tiêu**:
    - Cột: Ngày chi, Mã phiếu, Khoản chi, Danh mục (Badge), Số lượng, Số tiền VND (format đẹp), Người chi, Ghi chú.
    - Bộ lọc theo Danh mục và Khoảng ngày.
    - Form Thêm mới / Chỉnh sửa khoản chi.

### Slice 5: Tests & Quality Gates
- [x] **Unit & Integration Tests**:
  - Test `filament_spools` calculation: % còn lại và 4 tầng cảnh báo (tính runtime, xem Q5).
  - Test concurrency: 2 transaction cùng tiêu hao 1 cuộn nhựa, lock `FOR UPDATE` theo cuộn ngăn oversell vượt `initial_weight_grams`.
  - Test `material_movements.spool_id` liên kết chính xác với `filament_spools`.
  - **Test tích hợp `updatePrintJobStatus` → `PRINTING`** (Q1): job có `spool_id` gán sẵn → chuyển `PRINTING` → `filament_spools.used_weight_grams` tăng đúng, `material_movements` có `spool_id` đúng, trong cùng transaction với update `print_jobs.status`. Test riêng job KHÔNG có `spool_id` vẫn đi được đường cũ (`lockMaterialForInventoryWrite`), không bị chặn bởi validate mới.
  - Test `expense.service.ts`: Tính toán dòng tiền — **đã có**. Test 403 thật qua `requireOwner()`
    ở tầng route/Server Action — **chưa có, gap còn lại**: `requireOwner()` đọc cookie session qua
    `next/headers`, không gọi được ngoài request scope của Next.js, và codebase hiện tại chưa có
    tiền lệ test HTTP 403 cho bất kỳ ranh giới OWNER/STAFF nào trong 4 ranh giới ADR-0011 sẵn có
    (chỉ có `tests/phase-3-auth.test.ts` test `resolveStaffSession` ở mức unit) — cần một cách tiếp
    cận mới (vd. supabase sign-in thật + cookie thật gọi qua `next test server`) áp dụng đồng loạt
    cho cả 5 ranh giới, không riêng Phase 12; để lại làm follow-up thay vì tự chế một cách kiểm thử
    lệch chuẩn chỉ cho riêng expenses.
  - Test Server-side Masking: `purchaseCost` trả về `null` cho role `STAFF`.
  - Test migration seed idempotent: chạy migration 2 lần, số dòng `filament_spools` và `material_movements` PURCHASE (`reference_type = 'SEED_MIGRATION'`) không đổi sau lần chạy thứ 2 (xem Q3).
- [x] **Chạy toàn bộ Quality Gates**:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

### Slice 6: Documentation & Handoff
- [x] Thêm `docs/architecture/decisions.md` — ADR mới cho: (a) tích hợp `filament_spools` vào luồng `print_jobs` (Q1/Q2), (b) boundary quyền thứ 5 trong ADR-0011 (Expenses OWNER-only) hoặc 1 ADR riêng tham chiếu ADR-0011.
- [x] Cập nhật `docs/database/schema.md`: thêm `filament_spools`, `expenses`, cột mới trên `material_movements`/`print_jobs`.
- [x] Cập nhật `docs/database/business-rules.md`: quy tắc theo cuộn (1 job = 1 cuộn, lock theo cuộn, không âm gram trên từng cuộn) và quy tắc `expenses` (OWNER-only, không sửa/xoá cứng — cân nhắc theo Rule #7 "never delete financial history casually", `deleteExpense` nên là soft-cancel qua `status = 'CANCELLED'` thay vì xoá hàng).
- [x] Thêm dòng `Phase 12: filament spool inventory + workshop expense accounting` vào `docs/roadmap.md`.

---

## 5. Definition of Done

1. Toàn bộ checklist các Slice 1–6 chuyển thành `[x]`.
2. Toàn bộ 27 cuộn nhựa và 9 khoản chi tiêu thật (không phải 8 như ước lượng ban đầu — xem ghi chú Slice 1) từ Google Sheets được seed chính xác vào DB, migration chạy lại an toàn (idempotent) cho cả `filament_spools` và `material_movements`.
3. Giao diện Kho Nhựa `/admin/materials` và Giao diện Chi tiêu `/admin/expenses` hoạt động mượt mà, chuẩn UI design system.
4. Ranh giới bảo mật OWNER/STAFF được bảo vệ nghiêm ngặt ở Server-side (qua `requireOwner()`/`requireAdmin()` có sẵn, không viết lại).
5. Print job bắt đầu in thật (`updatePrintJobStatus → PRINTING`) tự động cập nhật đúng `filament_spools.used_weight_grams` khi có `spool_id` — không còn là 2 hệ thống tách rời.
6. Quality gates (`lint`, `typecheck`, `test`, `build`) pass 100%.
