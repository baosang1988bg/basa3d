# Phase 20 — Flex Organizer: Công cụ chia ngăn khay đựng dụng cụ (Browser-side) → Custom Request

> **Mục đích**: Tool #1 trong thứ tự ưu tiên đã chốt ở Phase 19 (`docs/exec-plans/completed/phase-19.md`, mục 3). Khách có khay đựng dụng cụ/linh kiện cần chia ngăn theo kích thước riêng (không có sẵn khay in sẵn phù hợp), tự dựng mẫu 3D ngay trên web (kích thước khay + số ngăn/lưới), xem preview, xuất STL — tái dùng đúng flow "xuất file → gửi Custom Request kèm khoảng giá ước tính" đã chứng minh ở Phase 17. Đây là tool rủi ro kỹ thuật thấp nhất trong roadmap (không cần font, không cần CSG boolean — các ngăn là các khối hộp rời ghép cạnh nhau, không giao nhau).

Kiến trúc nền (route group, lazy-load, quy ước file) và các quyết định CSG/3MF **đã chốt ở cấp roadmap** (Phase 19, mục 4) và áp dụng thẳng cho phase này — không mở lại ở đây, trừ khi phát hiện vấn đề cụ thể khi triển khai. Phase 20 chỉ brainstorm phần **riêng của Organizer**: tham số hình học lưới ngăn, và tổng quát hoá route ước tính giá theo tool (mục 3.4).

---

## 1. Rà soát hiện trạng có thể tái dùng từ Phase 17

- **Route group & layout**: theo Phase 19 mục 4.1 — route mới nằm ở `src/app/[locale]/(tools)/tools/organizer/page.tsx`, dùng `src/app/[locale]/(tools)/layout.tsx` (Phase 20 là phase **đầu tiên** dựng layout này cho toàn bộ tools sau này).
- **Engine 3D**: `src/lib/3d-tools/organizer/organizer-engine.ts` (theo quy ước Phase 19) — thuần `THREE.BoxGeometry`/`ExtrudeGeometry` + `mergeGeometries`, **không cần** `opentype.js` (không có chữ), **không cần** CSG (các vách ngăn dùng kỹ thuật Epsilon-Overlap $0.2\text{ mm}$ ăn sâu vào đáy và thành ngoài).
- **Ước tính khối lượng/thời gian in**: `estimateMeshWeightGrams`/`estimatePrintMinutes` (Phase 17, `src/lib/pricing/mesh-estimator.ts`) — pure function nhận `THREE.BufferGeometry`, tái dùng thẳng, không viết lại.
- **Khoảng giá ước tính server-side**: route `POST /api/public/keychain-price-estimate` được clean refactor thành `POST /api/public/tool-price-estimate` dùng chung cho toàn bộ 3D tools (Keychain, Organizer, v.v.).
- **Flow Custom Request**: upload STL qua `POST /api/public/custom-requests/attachments` → prefill `custom-request-form.tsx` → submit `POST /api/public/custom-requests` — tái dùng y hệt Phase 17.
- **STL export**: `THREE.STLExporter`, xuất 1 file gộp duy nhất.

---

## 2. Goal & Non-goals

### Goal
1. Khách nhập kích thước khay (dài × rộng × cao, mm) và cấu hình lưới ngăn (số hàng/cột đều nhau, hoặc kích thước từng ngăn tuỳ chỉnh) trên trang public mới, xem preview 3D ngay trên trình duyệt, chỉnh được độ dày vách ngăn và độ dày đáy khay.
2. Xuất STL (1 file gộp toàn bộ khay + vách ngăn), với 2 lựa chọn như Phase 17: tải về máy, hoặc gửi thẳng thành Custom Request kèm khoảng giá ước tính qua endpoint `tool-price-estimate`.
3. GA4 tracking tương tự Phase 17 (`tool_organizer_preview`, `tool_organizer_export_download`, `tool_organizer_export_to_request`).

### Non-goals
- **Không hỗ trợ ngăn không đồng đều dạng tự do (freeform)** ở v1 — chỉ 2 chế độ: lưới đều (rows × cols cố định) hoặc lưới có độ rộng cột/hàng tuỳ chỉnh theo danh sách số (vd. `[20, 30, 25]` mm). Freeform để dành phase riêng nếu có nhu cầu thực tế.
- **Không tạo route group `(tools)`/layout riêng cho từng tool sau này** ngoài phần khung tối thiểu cần cho Organizer — layout dùng chung sẽ được tinh chỉnh thêm khi Phase 21+ chạy.
- **Không làm 7 tool còn lại** (Keychain block-style, Dual Text, Car, Lamp, Hinge Box, Jigsaw, Sculpt) — theo đúng thứ tự Phase 19.

---

## 3. Quyết định kỹ thuật (Đã chốt qua Gemini Challenge)

### 3.1 Tham số lưới ngăn — Chốt: 2 chế độ + Dung sai Auto-Fit ($\pm 0.5\text{ mm}$)
- **Chế độ 1 (Equal grid)**: Nhập số hàng (rows) + số cột (columns) $\rightarrow$ chia đều kích thước lọt lòng khay trừ độ dày vách.
- **Chế độ 2 (Custom sizes)**: Nhập danh sách độ rộng từng cột (mm) và từng hàng (mm).
- **Quy tắc dung sai & Auto-Fit**:
  - Cho phép dung sai lệch tổng $\le 0.5\text{ mm}$.
  - Khi render/export, hệ thống tự động gán kích thước ô cuối cùng $= \text{kích thước lọt lòng còn lại}$ (`lastCell = remainingDimension`), tránh lỗi validation khó chịu cho người dùng khi nhập số thập phân lẻ.
  - UI cung cấp nút hỗ trợ "Tự động chia đều phần còn lại (Auto-fit)".

### 3.2 Hình học vách ngăn & đáy — Chốt: `mergeGeometries` + Epsilon-Overlap ($0.2\text{ mm}$), Không dùng CSG
- **Kỹ thuật Epsilon-Overlap**: Mỗi vách ngăn được tạo lún sâu vào đáy một khoảng $\epsilon = 0.2\text{ mm}$ và ăn khớp vào thành biên ngoài $0.2\text{ mm}$ trước khi gọi `mergeGeometries`.
- **Độ an toàn cho Slicing FDM**: Với đầu phun $0.4\text{ mm}$ và layer $0.16\text{ - }0.28\text{ mm}$, các slicer hiện đại (Bambu Studio, PrusaSlicer, OrcaSlicer, Cura) tự động thực hiện phép gộp 2D planar polygon union các thể tích giao nhau thành khối đặc đồng nhất $100\%$ không tách rời.
- **Lợi ích**: Giữ hiệu năng cực nhanh, không làm đơ browser khi render $12 \times 12$ ngăn, tuân thủ `AGENTS.md` #8 (không kéo thêm dependency CSG khi chưa cần thiết).
- Hằng số: `WALL_OVERLAP_EPSILON_MM = 0.2`.

### 3.3 Giới hạn kích thước & số ngăn — Chốt: Bộ hằng số an toàn tại `organizer-constants.ts`
Tập trung toàn bộ giới hạn vào file `src/lib/3d-tools/organizer/organizer-constants.ts` phù hợp với 95% khổ máy in FDM phổ biến:
- `MAX_TRAY_WIDTH_MM = 250` (Phù hợp khổ giường in 256mm của Bambu Lab / Ender 3)
- `MAX_TRAY_DEPTH_MM = 250`
- `MAX_TRAY_HEIGHT_MM = 120`
- `MIN_TRAY_DIMENSION_MM = 30`
- `MAX_GRID_ROWS = 12`, `MAX_GRID_COLS = 12` (Tối đa 144 ngăn — tối ưu WebGL và UX mobile)
- `MIN_WALL_THICKNESS_MM = 1.0`, `MAX_WALL_THICKNESS_MM = 4.0` (Mặc định: 1.6mm)
- `MIN_BOTTOM_THICKNESS_MM = 1.2`, `MAX_BOTTOM_THICKNESS_MM = 5.0` (Mặc định: 2.0mm)

### 3.4 Ước tính giá — Chốt: Clean Refactor thành `POST /api/public/tool-price-estimate`
- **Quyết định**: Đổi tên route và generalize thành `POST /api/public/tool-price-estimate` dùng chung vĩnh viễn cho tất cả 3D tools hiện tại và tương lai.
- **Phạm vi cập nhật**: 
  - Tạo `src/app/api/public/tool-price-estimate/route.ts` (nhận `{ weightGrams, printMinutes }`).
  - Xóa route cũ `keychain-price-estimate`.
  - Cập nhật URL gọi API trong `src/components/storefront/keychain-generator.tsx`.
  - Cập nhật test suite `tests/phase-17-keychain-price-estimate.test.ts`.

### 3.5 Đơn vị & mặc định
- Đơn vị hiển thị và tính toán: **mm**.
- Kích thước mặc định khi mở trang: Khay $180 \times 120 \times 35\text{ mm}$, lưới $3 \times 4$, vách $1.6\text{ mm}$, đáy $2.0\text{ mm}$ (preview hiển thị ngay lập tức, không bắt khách phải nhập form mới thấy mẫu).

---

## 4. Kế hoạch triển khai theo Slices

### Slice 0: Route group & layout dùng chung (mới, lần đầu dựng cho toàn bộ Phase 20-27)
- [x] `src/app/[locale]/(tools)/layout.tsx` — canvas full-viewport, topbar tối giản ("Về cửa hàng", "Gửi báo giá").
- [x] Xác nhận layout này không phá vỡ middleware/i18n hiện có (route group mới trong `[locale]`) — xem `docs/exec-plans/active/phase-20-verification.md`, mục Routing.

### Slice 1: Organizer 3D Engine & Preview UI (Client-only)
- [x] `src/lib/3d-tools/organizer/organizer-constants.ts` — bộ hằng số giới hạn.
- [x] `src/lib/3d-tools/organizer/organizer-engine.ts` — build geometry lưới ngăn theo 2 chế độ với epsilon-overlap ($0.2\text{ mm}$), merge thành 1 mesh.
- [x] `src/app/[locale]/(tools)/tools/organizer/organizer-workbench.tsx` (+ `organizer-canvas.tsx`) — form nhập kích thước/lưới + canvas preview (`next/dynamic(..., { ssr: false })`), xoay/zoom, đổi chế độ lưới.
- [x] Xuất STL 1 file gộp.

### Slice 2: Ước tính & tích hợp giá dùng chung
- [x] Refactor route sang `POST /api/public/tool-price-estimate` (đổi cả hàm thuần bên trong: `tool-price-range.ts`).
- [x] Cập nhật caller tại `keychain-generator.tsx` và test suite (`tests/tool-price-estimate-route.test.ts`, `tests/phase-17-keychain-price-estimate.test.ts`, `tests/phase-17-keychain-request-integration.test.ts`).
- [x] Tích hợp tính giá ước tính vào `organizer-workbench.tsx` (tái dùng `mesh-estimator.ts`).

### Slice 3: Tích hợp Custom Request Flow
- [x] Trang `/tools/organizer` $\rightarrow$ nút tải STL / gửi yêu cầu báo giá, prefill `custom-request-form.tsx`.

### Slice 4: GA4 Analytics
- [x] 3 event theo mục Goal #3: `tool_organizer_preview`, `tool_organizer_export_download`, `tool_organizer_export_to_request` (`src/lib/analytics.ts`).

### Slice 5: Verification & Tests
- [x] Unit test `organizer-engine.ts` (kích thước/lưới hợp lệ và biên: 1x1, custom sizes lệch số dư, auto-fit) — `tests/organizer-engine.test.ts`.
- [x] Unit test `tool-price-estimate` route — `tests/tool-price-estimate-route.test.ts`.
- [x] Playwright E2E: nhập kích thước $\rightarrow$ preview $\rightarrow$ gửi báo giá $\rightarrow$ xuất hiện Admin — `e2e/organizer.spec.ts` (1 passed, xem verification doc).
- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100% (181 test pass, xác nhận lại `npm run typecheck` 2026-09-05).
- [x] (Owner) in thử 1-2 mẫu thật kiểm tra độ bền liên kết vách-đáy — **Owner chủ động chấp nhận
  rủi ro, bỏ qua bước in thử** (quyết định 2026-09-05, xem
  `docs/exec-plans/active/phase-20-followup.md`, mục "Quyết định của Owner"). Chưa có bằng chứng in
  thật xác nhận vách/đáy liền khối — rủi ro còn tồn đọng, không phải đã verify.

### Slice 6: Documentation
- [x] Cập nhật `docs/roadmap.md` + `docs/architecture/decisions.md` (mục "Phase 20 — Organizer implementation clarifications").

---

## 5. Risks & Mitigations

- **Vách ngăn tách rời đáy khi in**: Giảm thiểu bằng kỹ thuật Epsilon-Overlap $\epsilon = 0.2\text{ mm}$ ăn sâu vào đáy và thành ngoài — **chưa verify bằng in thật** (owner chấp nhận rủi ro, đóng phase không chờ in thử, xem `phase-20-followup.md`). Đây là known limitation, theo dõi tiếp nếu có phản hồi khách hàng thực tế.
- **Mesh quá nặng nếu khách nhập lưới quá dày đặc**: Đã giới hạn cứng `MAX_GRID_ROWS = 12`, `MAX_GRID_COLS = 12`, `MAX_TRAY = 250mm`.
- **Đổi tên route giá ảnh hưởng chỗ khác**: Clean refactor đồng bộ trong cùng 1 commit với full regression test.

---

## 6. Checklist

### Trước khi giao Codex
- [x] Owner & Gemini chốt tham số lưới ngăn (mục 3.1) — 2 chế độ + quy tắc auto-fit và dung sai $\pm 0.5\text{ mm}$.
- [x] Owner & Gemini chốt rủi ro watertight vách/đáy (mục 3.2) — Chốt `mergeGeometries` + Epsilon-Overlap ($0.2\text{ mm}$), không cần CSG.
- [x] Owner xác nhận giới hạn kích thước/số ngăn tối đa theo khổ máy in thực tế (mục 3.3) — Chốt hằng số $250\text{x}250\text{x}120\text{ mm}$ tại `organizer-constants.ts`.
- [x] Owner & Gemini chốt có tổng quát hoá route giá hay không (mục 3.4) — Chốt clean refactor thành `POST /api/public/tool-price-estimate`.
- [x] Ask AI for challenge (gemini-challenge skill) — Đã hoàn thành.

### Tests & Verification
- [x] Toàn bộ Slice 5 pass (trừ benchmark in thật).
- [x] Toàn bộ test suite không regression Phase 0-19 (181 test pass theo `phase-20-verification.md`).

### Definition of Done
1. [x] Khách nhập kích thước khay + cấu hình lưới $\rightarrow$ preview 3D $\rightarrow$ tải STL hoặc gửi Custom Request kèm khoảng giá ước tính.
2. [x] Route group `(tools)` và shared layout dựng xong, sẵn sàng làm nền cho Phase 21+.
3. [x] Endpoint `tool-price-estimate` dùng chung cho cả Keychain và Organizer.
4. [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
5. [x] In thử vật lý — **Owner chủ động chấp nhận rủi ro, bỏ qua** (2026-09-05, xem
   `phase-20-followup.md`). Rủi ro vách/đáy tách rời (mục 3.2) **chưa được verify bằng in thật**,
   ghi nhận là rủi ro tồn đọng đã biết (known limitation), không phải đã xác nhận an toàn.
