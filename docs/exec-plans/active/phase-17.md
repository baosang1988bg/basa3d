# Phase 17 — Public 3D Text/Keychain Generator (Browser-side) → Custom Request

> **Mục đích**: Khách có ý tưởng ("khắc tên lên móc khoá") nhưng không có file STL, hiện phải tự
> mô tả bằng chữ trong form custom-request rồi chờ staff hỏi lại chi tiết. Phase 17 cho khách tự
> **dựng mẫu 3D ngay trên web** (không cài phần mềm, không cần biết CAD), xem preview, rồi xuất
> thẳng vào flow custom-request đã có ở Phase 4/13 — rút ngắn khoảng cách "có ý tưởng" → "tạo được
> yêu cầu có file đính kèm" từ nhiều ngày (tự tìm phần mềm CAD) xuống vài phút.

Nguồn cảm hứng: khảo sát 1 landing page bên thứ ba ("Flex Playground", 14 tool CAD parametric chạy
browser, miễn phí). Phase 17 **không** sao chép toàn bộ 14 tool — chỉ lấy nhóm rủi ro kỹ thuật thấp
nhất và giá trị thương mại cao nhất (text/tên khắc), theo đúng nguyên tắc "small vertical slices"
(AGENTS.md #10). Các tool còn lại (3MF Color Splitter, Organizer, v.v.) là ứng viên cho phase riêng
sau này, không nằm trong phạm vi phase này.

---

## 1. Rà soát hiện trạng

- `custom_requests` hiện là bảng thuần text/metadata (`customerName`, `customerPhone`, `description`,
  `quantity`, `requestedMaterial?`, `requestedColor?`, `requestedSize?`, `attachmentPath?`,
  `sourceChannel`) — **không có** cột volume/weight/pricing nào (`src/services/custom-request.
  service.ts` dòng 48-62). Tạo request public đã có sẵn, không cần bảng mới.
- Upload file là bước **tách riêng**: `uploadCustomRequestAttachment` (cùng file, dòng 22-38) đẩy
  lên Supabase Storage bucket `custom-request-attachments`, allowlist đuôi file gồm sẵn
  `stl/step/stp/obj/3mf`, tối đa 20MB, content-type suy từ đuôi file (không tin `file.type` từ
  client) — endpoint `POST /api/public/custom-requests/attachments` (rate-limit theo IP,
  10/giờ, vì lúc upload chưa có số điện thoại).
- Endpoint tạo request: `POST /api/public/custom-requests` — validate bằng
  `publicCustomRequestInputSchema` (`src/domain/schemas.ts:225-236`, `.strict()`,
  `attachmentPath` bị khoá regex `^requests\/[uuid]\.(ext)$`). `actorId = null` → audit log
  `CUSTOM_REQUEST_CREATED_PUBLIC`.
- Component client hiện có: `src/app/(storefront)/custom-print/custom-request-form.tsx` — upload
  file trước, nhận lại `path`, rồi submit JSON kèm `attachmentPath`. Đây chính là mẫu UI Phase 17
  sẽ tái dùng (không viết form mới từ đầu).
- Pricing engine Phase 13 (`src/lib/pricing/smart-waste-estimator.ts`,
  `src/services/pricing.service.ts::computePricingBreakdown`) là các **pure function**, không đụng
  DB, không cần file đã slice — chỉ cần `netWeightGrams` + `printMinutes` đã biết trước. Codebase
  **chưa có** hàm nào đi từ "volume mesh" → "gram vật liệu" — Phase 17 phải tự viết mới (mục 3.4).
- Tạo `quote` (bảng `quotes`, có giá chính thức) hiện là **thao tác chỉ staff làm được**
  (`quote.service.ts::createQuote` bắt buộc `actorId`) — không có entrypoint public nào tự tạo
  quote. Phase 17 giữ nguyên ranh giới này (xem Non-goals #2).
- Mẫu "trang public ẩn danh" đã có tiền lệ ở `quotes/[quoteNumber]/page.tsx` (dual verification
  token/phone-suffix) — nhưng Phase 17 không cần đọc lại dữ liệu đã tồn tại, chỉ cần **tạo mới**,
  nên không tái dùng pattern đó, chỉ tái dùng pattern "public route + rate-limit + Zod strict".

---

## 2. Goal & Non-goals

### Goal
1. Khách nhập tên/text (có dấu tiếng Việt) trên một trang public mới, xem preview 3D móc
   khoá/name-tag ngay trên trình duyệt (không cần cài phần mềm), chỉnh được vài tham số cơ bản
   (độ dày, có lỗ móc khoá hay không).
2. Khách xuất được file STL từ mẫu vừa tạo, và có 2 lựa chọn rõ ràng:
   - (a) Tải file STL về máy — không bắt buộc phải đặt hàng ở BaSa3D.
   - (b) Bấm "Gửi yêu cầu báo giá" → hệ thống tự upload file vừa tạo qua đúng
     endpoint/attachment flow đã có, rồi điền sẵn `custom-request-form` (chỉ còn nhập tên/SĐT/số
     lượng) để khách submit — khách không phải tự tải file về rồi tự upload lại thủ công.
3. Ở bước (b), hiển thị **ước tính** khoảng giá (không phải giá chốt) dựa trên
   `computePricingBreakdown` có sẵn, để khách có kỳ vọng trước khi staff báo giá chính thức.

### Non-goals
- **Không tự tạo `quote` chính thức** — pricing hiển thị cho khách chỉ là ước tính tham khảo
  (advisory), không ghi vào DB, không đi qua `quote.service.createQuote`. Việc tạo quote chính
  thức vẫn 100% do staff làm, đúng ranh giới hiện tại (mục 1).
- **Không tự sinh file 3MF/đa vật liệu cho AMS** — v1 luôn xuất **đúng 1 file STL gộp** (merge
  `BaseMesh` + `TextMesh` thành 1 mesh duy nhất trước khi export), in 1 lần bằng 1 loại vật liệu.
  Việc chọn `baseColor`/`textColor` trên UI (mục 3.1) chỉ là **mô tả ý định màu sắc của khách**,
  truyền qua trường text `requestedColor` — không sinh ra file phân tách theo màu, không phải
  multi-color/AMS thật. Staff tự quyết cách cắt lát/đổi màu thủ công dựa vào mô tả + ảnh preview
  (nếu có), không dựa vào cấu trúc file.
- **Không làm 13 tool còn lại của landing page tham khảo** (sculpt, organizer, bowl, jigsaw, hinge
  box, 3MF splitter, v.v.) — để dành cho phase riêng nếu Phase 17 chứng minh được giá trị.
- **Không làm lỗ móc khoá bằng boolean CSG phức tạp nếu rủi ro cao** — xem quyết định tentative
  mục 3.3, cần chốt trước khi giao Codex.
- **Không thay đổi bảng `custom_requests` hay `custom-request-form.tsx` theo hướng phá vỡ flow
  hiện tại** — chỉ mở rộng thêm điểm vào (entry point) mới, giữ nguyên toàn bộ validate/service
  layer đã có.

---

## 3. Quyết định kỹ thuật đã chốt (Hậu Gemini & Owner Challenge)

1. **Engine dựng hình & Multi-color Preview**:
   - Dùng `three` + `opentype.js` (MIT) chạy client-side. Chuyển glyph font thành 2D path, sau đó đùn khối bằng `THREE.ExtrudeGeometry`.
   - Scene 3D dựng thành 2 Mesh riêng biệt: `BaseMesh` (phần đế bo góc kèm tai móc khoá) và `TextMesh` (chữ nổi).
   - Giao diện hỗ trợ khách chọn trực quan 2 màu (`baseColor` và `textColor`). Khi xuất STL gửi custom request, metadata màu sắc được truyền tự động vào `requestedColor` (vd. `requestedColor: "Đế đen (#000000) - Chữ vàng (#FFD700)"`).
2. **Font tiếng Việt**:
   - Dùng font self-hosted giấy phép OFL (vd. `Be Vietnam Pro` hoặc `Noto Sans`), đặt trong `public/fonts/`.
   - Verify thủ công tập glyph tiếng Việt đầy đủ (các ký tự: `ư`, `ơ`, `đ`, dấu thanh tổ hợp).
3. **Lỗ móc khoá (Keyring Hole) — Chuẩn 2D Path Hole, KHÔNG dùng 3D CSG**:
   - Tạo lỗ móc khoá trực tiếp trên đường bao 2D của phần đế bằng `THREE.Shape` và `shape.holes.push(new THREE.Path().absarc(...))`.
   - Khi extrude, Three.js dùng thuật toán Earcut chuẩn để cắt lỗ. Đảm bảo 100% mesh sinh ra là watertight, manifold, không có lỗi tam giác đồng phẳng và không tốn thêm dependency 3D CSG nào.
4. **Ước tính khối lượng vật liệu (Grams)**:
   - Viết pure function mới `estimateMeshWeightGrams(mesh: THREE.BufferGeometry, densityGramsPerCm3 = 1.24): number`.
   - Tính Signed Volume của từng tam giác trong geometry. Với vật thể in mỏng (3–4mm), giả định 100% solid (1.24 g/cm³ cho PLA) là hoàn toàn sát với thực tế in FDM.
5. **Ước tính thời gian in (Print Minutes) & Hiển thị**:
   - Viết pure function `estimatePrintMinutes(weightGrams: number): number`.
   - Áp dụng công thức tính bù thời gian cố định (Fixed Machine Overhead):
     $$T_{\text{print}} = 12\text{ phút (setup/cân bàn/prime/layer 1)} + (\text{Weight} \times 1.8\text{ phút/g})$$
   - **Ẩn số phút in đối với khách hàng** trên giao diện public; số phút và khối lượng chi tiết chỉ phục vụ tính giá và hiển thị trong Admin view cho staff.
6. **Khoảng giá ước tính (Advisory Price Range — Không tạo Quote DB, tính SERVER-SIDE)**:
   - **[Cập nhật hậu review]** `computePricingBreakdown` cần `PricingConfigInput` thật (margin %,
     đơn giá điện, giá máy, lương nhân công...) lấy từ `getCurrentPricingConfig()`
     (`pricing-config.service.ts`) — bảng `pricing_configs` **không có RLS**, hiện chỉ được chặn ở
     tầng app qua `requireOwner()`/`requireAdmin()`. Pattern đang dùng ở
     `pricing-calculator-panel.tsx`/`makerworld-quote-panel.tsx` là truyền nguyên object config vào
     component client — chỉ an toàn vì trang đó đã nằm sau `requireAdmin`. **Không được tái dùng
     pattern đó cho trang public** — nếu chạy `computePricingBreakdown` với config thật ngay trên
     browser của khách (không đăng nhập), toàn bộ margin/chi phí vốn của xưởng sẽ lộ ra trong
     JS runtime/network payload của một trang công khai.
   - **Quyết định chốt**: thêm route mới `POST /api/public/keychain-price-estimate` — nhận
     `{ weightGrams, printMinutes }` (2 số đã tính xong ở client từ mesh, không phải config), gọi
     `getCurrentPricingConfig()` + `computePricingBreakdown()` **server-side**, trả về **chỉ**
     `{ minPriceVnd, maxPriceVnd }`. Client không bao giờ nhận `PricingConfigInput` thật. Rate-limit
     theo IP như các route public khác (tái dùng `createDatabaseRateLimiter`).
   - Hiển thị ra UI dạng **Khoảng giá ước tính** (ví dụ: `25.000đ – 45.000đ / chiếc`) kèm ghi chú rõ
     ràng: *"Giá thực tế phụ thuộc vào màu sắc, phụ kiện khoen móc và số lượng. Xưởng BaSa3D sẽ gửi
     báo giá chính xác qua SĐT/Zalo."*
   - Không tạo bản ghi `quotes` nào trong DB khi submit request; giữ vững ranh giới bảo mật Rule #5.
7. **Tích hợp vào custom-request flow**:
   - Xuất STL qua `THREE.STLExporter` $\rightarrow$ sinh `Blob` trong browser.
   - Nút "Tải STL về máy": Tải file trực tiếp về client.
   - Nút "Gửi yêu cầu báo giá": Gọi `POST /api/public/custom-requests/attachments` $\rightarrow$ nhận `attachmentPath` $\rightarrow$ điền sẵn vào `custom-request-form` (`attachmentPath`, `requestedMaterial: "PLA"`, `requestedColor`, `description: "Móc khoá khắc tên: {text}"`) $\rightarrow$ Khách nhập Tên/SĐT/Số lượng $\rightarrow$ submit `POST /api/public/custom-requests`.
8. **GA4 Tracking**:
   - Bắn các event: `tool_keychain_preview`, `tool_keychain_export_download`, `tool_keychain_export_to_request`.

---

## 4. Kế hoạch triển khai theo Slices

### Slice 1: 3D Engine & Preview UI (Client-only)
- [ ] Cài đặt `three`, `@types/three`, `opentype.js`, `@types/opentype.js`.
- [ ] Thêm file font tiếng Việt (`.ttf`/`.otf`) vào `public/fonts/`.
- [ ] Xây dựng module CAD parametric: Chuyển text $\rightarrow$ 2D shape có bo góc đế + lỗ khoen móc $\rightarrow$ `ExtrudeGeometry`.
- [ ] Component preview 3D Canvas (WebGL): Hỗ trợ xoay, zoom, đổi màu nền (`baseColor`), đổi màu chữ (`textColor`), toggle lỗ móc khoá.
- [ ] Xuất STL bằng `THREE.STLExporter` — **merge `BaseMesh` + `TextMesh` thành 1 mesh duy nhất
  trước khi export** (xem Non-goals mục 2), luôn ra đúng 1 file `.stl`.

### Slice 2: Module ước tính thể tích, thời gian & khoảng giá (Pure functions + Tests)
- [ ] Viết `src/lib/pricing/mesh-estimator.ts` (pure, chạy client, không đụng config thật):
  - `calculateMeshVolumeCm3(geometry: THREE.BufferGeometry): number`
  - `estimateMeshWeightGrams(volumeCm3: number, density?: number): number`
  - `estimatePrintMinutes(weightGrams: number): number`
- [ ] Viết route mới `POST /api/public/keychain-price-estimate` (server-side, xem mục 3.6): nhận
  `{ weightGrams, printMinutes }`, gọi `getCurrentPricingConfig()` + `computePricingBreakdown()`,
  trả về `{ minPriceVnd, maxPriceVnd }`. Rate-limit theo IP.
- [ ] Client gọi route trên để lấy khoảng giá — **không** import `computePricingBreakdown` hay bất
  kỳ `PricingConfigInput` nào vào component/module chạy trên browser.
- [ ] Unit tests đầy đủ cho `mesh-estimator.ts` (3 hàm pure) + test route mới (input hợp lệ trả
  đúng khoảng giá, input không hợp lệ bị từ chối, config thật không bao giờ xuất hiện trong response
  body).
- [ ] Tích hợp hiển thị khoảng giá và khối lượng ước tính trên UI kèm disclaimer.

### Slice 3: Tích hợp Custom Request Flow
- [ ] Tạo trang `/custom-print/tao-mau-khac-ten` (hoặc đặt component trong `/custom-print`).
- [ ] Nút "Tải STL" $\rightarrow$ Trigger download file `.stl`.
- [ ] Nút "Gửi yêu cầu báo giá" $\rightarrow$ Upload blob qua `POST /api/public/custom-requests/attachments` $\rightarrow$ Prefill vào `custom-request-form.tsx` $\rightarrow$ submit `POST /api/public/custom-requests`.
- [ ] Không làm thay đổi schema của `custom_requests` hay logic service backend.

### Slice 4: GA4 Analytics
- [ ] Tích hợp tracking 3 custom events theo chuẩn Phase 10.

### Slice 5: Verification & Tests
- [ ] Unit tests cho pure math (`mesh-estimator.test.ts`) + route `keychain-price-estimate`.
- [ ] Playwright E2E test: Nhập text $\rightarrow$ preview 3D $\rightarrow$ bấm gửi báo giá $\rightarrow$ form điền sẵn $\rightarrow$ submit thành công và xuất hiện trong Admin.
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
- [ ] **Ngoài phạm vi Codex (việc tay của Owner, làm sau khi nhận code, không phải điều kiện Codex
  tự báo cáo đã xong)**: in thử 5 mẫu thật trên Bambu Studio, so sánh cân nặng thực tế với
  `estimateMeshWeightGrams` — sai số phải ≤ 15%. Ghi kết quả vào ADR (Slice 6) sau khi đo xong.

### Slice 6: Documentation & ADR
- [ ] Cập nhật `docs/roadmap.md`.
- [ ] Viết ADR ghi nhận công thức tính thể tích mesh, overhead thời gian in, và quyết định 2D Path Hole thay vì CSG.

---

## 5. Risks & Mitigations

- **Font tiếng Việt bị lỗi dấu tổ hợp**: Verify kỹ lưỡng chuỗi test: `"Nguyễn Văn Ơn, Vũ Thị Mỹ Duyên, Đặng Quốc Trưởng"`.
- **Hiệu năng WebGL trên Mobile Webview (Zalo/Facebook)**: Tối ưu số segments của bo góc (curveSegments = 12), lazy load Three.js dynamic import (`next/dynamic` với `ssr: false`).
- **Khách hiểu nhầm giá ước tính**: UI hiển thị rõ ràng dạng KHOẢNG GIÁ và dán nhãn "Ước tính tham khảo".
- **Lộ cấu trúc chi phí/margin nội bộ** (phát hiện ở review trước khi giao Codex): `pricing_configs`
  không có RLS, chỉ được chặn ở tầng app; pattern admin hiện tại (`pricing-calculator-panel.tsx`)
  truyền nguyên `PricingConfigInput` vào component client vì trang đó đã sau `requireAdmin`. Nếu
  copy y hệt pattern đó sang trang public sẽ lộ margin %/giá vốn ra JS runtime công khai.
  Mitigation: mục 3.6 đã chốt route `POST /api/public/keychain-price-estimate` tính server-side,
  chỉ trả `{minPriceVnd, maxPriceVnd}` — không bao giờ để `PricingConfigInput` thật đi tới client.

---

## 6. Checklist

### Trước khi giao Codex
- [x] Owner & Gemini chốt hướng lỗ móc khoá: Dùng 2D Shape Holes, không dùng 3D CSG.
- [x] Owner & Gemini chốt công thức tính vật liệu/thời gian in: Volume signed $\times$ 1.24, Fixed Overhead 12p + Linear, ẩn số phút trên UI khách.
- [x] Owner & Gemini chốt cơ chế báo giá: Advisory Price Range, không tạo Quote DB.
- [x] Owner & Gemini chốt định dạng xuất: STL + UI Preview 2 màu + truyền `requestedColor` vào metadata.
- [x] Đã hoàn thành AI Challenge (Step 3 `PHASE_START_PROTOCOL.md`).
- [x] **[Bổ sung hậu review, trước khi giao Codex]** Chốt tính khoảng giá qua route server-side mới
  (`POST /api/public/keychain-price-estimate`) thay vì chạy `computePricingBreakdown` với config
  thật trên browser — tránh lộ margin/chi phí vốn ra trang public (mục 3.6, Slice 2).
- [x] **[Bổ sung hậu review]** Chốt STL xuất ra là 1 file gộp duy nhất (merge `BaseMesh` +
  `TextMesh`); màu sắc chỉ là mô tả ý định qua `requestedColor`, không phải file đa màu thật
  (Non-goals mục 2).

### Tests & Verification
- [ ] Toàn bộ Slice 5 pass (trừ benchmark in thật — xem mục riêng bên dưới).
- [ ] Toàn bộ test suite không regression Phase 0-16.
- [ ] (Việc tay của Owner, ngoài phạm vi Codex) 5 mẫu test STL in thật trên Bambu Studio không lỗi
  non-manifold và sai số cân nặng thực tế so với `estimateMeshWeightGrams` $\le 15\%$.

### Definition of Done
1. Khách nhập text tiếng Việt $\rightarrow$ preview 3D trực quan 2 màu $\rightarrow$ tải được file STL (1 file gộp) hoặc gửi thẳng thành Custom Request có đính kèm file + thông số màu mô tả trong `requestedColor`.
2. Hiển thị khoảng giá tham khảo minh bạch (tính qua route server-side, không lộ config thật), không phát sinh `quote` tự động trong DB.
3. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
