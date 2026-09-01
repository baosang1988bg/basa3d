# Phase 9 — Pricing Engine & Slicer/MakerWorld Integration

Không có trong `docs/roadmap.md` gốc (roadmap dừng ở Phase 8 "operations/
optimization/scale") — đây là tính năng mới do OWNER yêu cầu bổ sung, tương tự
cách Phase 8 đã có slice ngoài roadmap gốc (`phase-8-ux-feedback-round1.md`).
Ghi rõ ở đây để không tự ý mở rộng phạm vi sau này mà không qua Phase Start
Protocol lại.

Nguồn công thức: `docs/product/catalog-spec.md` §4 (đã duyệt, ADR-0006/ADR-0010)
+ phụ lục Phase 9 vừa thêm vào cùng file (input contract cho waste/plate-time/
đơn giá vật liệu — không đổi công thức, chỉ làm rõ ý nghĩa biến đầu vào).

## Rà soát trước khi lập kế hoạch

Đã đọc code thật trước khi viết plan (không suy đoán):

- Không có `pricing.service.ts` nào trong `src/services/` — đây là service mới
  hoàn toàn.
- `materials` (migration `20260830000000_initial_domain_schema.sql:46`) đã có
  sẵn `cost_per_spool`, `spool_weight_grams`, **và `current_unit_cost`** —
  cột thứ 3 này có trong schema + `materialInputSchema`
  (`src/domain/schemas.ts:48-57`) nhưng **chưa service nào đọc/dùng**
  (`inventory.service.listMaterials` hiện chỉ select `id, name, materialType,
  unit`, bỏ qua 3 cột giá). Pricing engine là nơi đầu tiên dùng tới các cột
  này — không cần migration thêm cột giá vật liệu.
- `print_jobs.material_id` là **single FK** (`print-job.service.ts:37-46
  assignPrintJobMaterial` chỉ nhận 1 `materialId` + 1
  `estimatedWeightGrams`). Schema này **không** chịu được model đa màu thật
  (VD ví dụ 7 màu của Phase 9). Đây là giới hạn có thật, không phải do Phase 9
  gây ra — quyết định scope bên dưới xử lý bằng cách không đụng tới
  `print_jobs` (xem Non-goals #2).
- `quote.service.ts` hiện tại: `createQuote` nhận `subtotal`/`total` do staff tự
  tính, không có trường breakdown nào. `acceptQuote` mở transaction riêng để
  tạo `print_jobs` — không có chỗ nào gọi tính giá tự động.
- `product.service.ts`: `basePrice`/`costPrice` là input tay (`createProduct`,
  `updateProduct`, `createVariant`) — không có breakdown, không tính tự động.
- Không có bảng `pricing_configs`/cấu hình giá nào trong `docs/database/schema.md`
  hay migrations — điện/nhân công/máy/margin hiện là con số cứng chỉ tồn tại
  trong `catalog-spec.md` (tài liệu), không có ở DB/code.
- `package.json` chưa có lib unzip/XML nào (`fflate`, `fast-xml-parser`,
  `jszip`, ... đều chưa có) — cần thêm mới cho việc đọc `.3mf`.
- Không tìm thấy tích hợp MakerWorld nào trong code (grep toàn repo không có
  `makerworld`).

## Goal
Cho STAFF tính giá bán đề xuất (cost-plus, đúng công thức đã duyệt) trực tiếp
từ dữ liệu slicer thật (`.3mf`) hoặc nhập tay, áp dụng 1-click vào Quote
(custom request) và Product listing — có snapshot breakdown để đối chiếu sau
này, có cấu hình giá (điện/nhân công/máy/margin) lưu ở DB thay vì hard-code.

## Non-goals
- **MakerWorld URL auto-parse** — chưa xác nhận được MakerWorld có official
  API/oEmbed hay chỉ có thể scrape HTML (rủi ro WAF/anti-bot/ToS, xem Risks).
  Phase 9 (v1) chỉ cho staff **dán link MakerWorld làm ghi chú tham khảo**
  (lưu text thuần, không fetch/parse gì) trên Quote/Custom Request. Auto-parse
  thật để một phase riêng (9b) sau khi xác nhận thủ công được tính khả thi kỹ
  thuật + hợp lệ ToS.
- **Đổi schema `print_jobs` để track tiêu hao đa màu thật** (giới hạn
  `material_id` single-FK nêu ở Rà soát) — Phase 9 chỉ tạo **snapshot breakdown
  đa màu** trong `jsonb` của `quotes`/`products` (dữ liệu tính giá, không phải
  ledger tồn kho). Việc production tracking tiêu hao thật theo từng màu vẫn
  dùng `print_jobs.material_id` hiện tại (staff chọn 1 material đại diện hoặc
  tự tách nhiều print_job — không đổi ở phase này). Ghi rõ đây là giới hạn đã
  biết, không phải bug.
- **Re-price hàng loạt Quote/Product cũ khi `pricing_configs` đổi** — breakdown
  đã lưu là bất biến tại thời điểm tạo (business-rules.md #3/#7). Đổi config
  chỉ ảnh hưởng lần tính giá tiếp theo.
- **Multi-tenant/multi-currency pricing config** — chỉ 1 config "hiện hành"
  cho toàn hệ thống, không theo từng khách hàng/khu vực.
- **UI chọn máy in cụ thể (nhiều loại máy, nhiều mức giá máy)** — v1 dùng 1 bộ
  tham số máy chung trong `pricing_configs` (đúng mức chi tiết catalog-spec.md
  hiện có). Nếu OWNER có nhiều máy giá khác nhau thật, mở rộng
  `pricing_configs` thành nhiều dòng theo `machine_profile` ở phase sau.

## Quyết định đã chốt (Claude tự đề xuất theo AGENTS.md — sẽ đưa Gemini
   challenge trước khi giao Codex, xem checklist)

1. **`pricing.service.ts` là pure calculator, không tự query DB/transaction.**
   Nhận input đã resolve sẵn (`{ materials: {gram, unitCostVnd}[], printMinutes,
   laborMinutes, packagingFeeVnd, config: PricingConfig }`), trả về breakdown +
   `finalPriceVnd` (integer). Caller (`quote.service`/`product.service`/route)
   chịu trách nhiệm lấy giá vật liệu qua `inventory.service.listMaterials`
   (mở rộng để trả thêm `costPerSpool`, `spoolWeightGrams`, `currentUnitCost`)
   và `pricing-config.service` (lấy config hiện hành) rồi mới gọi
   `pricing.service`. Lý do: tách để test thuần không cần DB (yêu cầu #4 review
   trước), và tránh service mới tự ý mở transaction chồng lên transaction của
   `quote.service`/`product.service`.
2. **Đơn giá vật liệu/gram**: theo phụ lục vừa thêm vào `catalog-spec.md` —
   `unit='SPOOL'` → `cost_per_spool/spool_weight_grams`; `unit='GRAM'` →
   `current_unit_cost` thẳng. Không thêm cột mới, dùng đúng 3 cột đã có sẵn
   trong `materials` từ trước (chưa service nào đọc).
3. **Bảng mới `pricing_configs`** (insert-only, không update — mỗi lần OWNER
   sửa tham số = 1 row mới):
   ```
   id uuid pk, electricity_vnd_per_kwh bigint, machine_price_vnd bigint,
   machine_lifetime_hours integer, printer_power_kw numeric(4,2),
   labor_vnd_per_hour bigint, failure_buffer_pct numeric(5,2),
   margin_pct numeric(5,2), packaging_fee_vnd bigint,
   effective_from timestamptz not null default now(), created_by uuid
   references staff_profiles(id), created_at timestamptz not null default now()
   ```
   - "Config hiện hành" = row có `effective_from` lớn nhất `<= now()`.
   - **Guardrail (Gemini challenge):** Server luôn tự gán `effective_from = timezone('utc', now())` khi tạo config mới từ Admin UI; không cho phép nhập tay ngày giờ để triệt tiêu lỗi gõ nhầm/clock skew.
   - Thêm index `pricing_configs_effective_from_created_at_idx on pricing_configs(effective_from desc, created_at desc)`.
   - Chỉ OWNER được tạo config mới (theo ADR-0011 4-boundary RBAC — STAFF không
   có quyền sửa tham số giá gốc, chỉ dùng để tính/tạo Quote).
4. **Snapshot breakdown**: thêm `pricing_breakdown jsonb null`,
   `pricing_config_id uuid null references pricing_configs(id)` vào cả
   `quotes` và `products` (không thêm vào `product_variants` — base_price của
   `products` là nơi hiện đang nhận input giá thủ công, giữ nguyên cấp
   product). Cả 2 cột nullable — Quote/Product tạo thủ công (không qua pricing
   engine) không bị bắt buộc có breakdown, giữ tương thích ngược 100%.

   **Làm rõ sau Codex second-pass review (2026-09-01) — 2 bảng có ngữ nghĩa
   "immutable" khác nhau, không phải 1 quy tắc chung:**
   - **`quotes.pricing_breakdown`/`pricing_config_id`: bất biến thật** —
     không có `updateQuote` nào trong codebase, Quote chỉ được tạo 1 lần rồi
     chuyển trạng thái (SENT/ACCEPTED/REJECTED/EXPIRED). Bất biến ở đây là hệ
     quả của việc **không có đường update**, không phải một rule đặc biệt
     phải tự canh giữ. Nếu sau này có phase thêm "sửa Quote", quyết định này
     cần xét lại.
   - **`products.pricing_breakdown`/`pricing_config_id`: KHÔNG bất biến, và
     đúng ra không nên là "immutable"** — `updateProduct` đã cho sửa
     `basePrice` bằng tay từ trước Phase 9 (catalog listing sống, không phải
     bản ghi giao dịch). Panel tính giá trên trang edit Product **cố ý** cho
     phép staff bấm "Dùng giá này" lần nữa để ghi đè cả `basePrice` lẫn
     `pricing_breakdown`/`pricing_config_id` cùng lúc — đây là tái định giá
     chủ động (staff bấm nút, không phải side-effect ngầm), tương đương việc
     sửa tay `basePrice` như trước giờ, chỉ khác là giờ có breakdown đi kèm.
     Điều **vẫn đúng và không đổi**: tạo 1 `pricing_configs` row mới **không
     tự động** cascade update snapshot của Product/Quote cũ nào — tái định giá
     chỉ xảy ra khi staff chủ động mở lại panel và submit.
   - Bảo đảm thật cho "giá đúng tại thời điểm bán" nằm ở `order_items`
     (business-rules.md #3: đơn hàng đã snapshot tên/giá sản phẩm lúc mua) —
     không phụ thuộc `products.pricing_breakdown` hiện tại là gì. Vì vậy
     Product không cần (và không nên) có snapshot bất biến kiểu ledger.
5. **`.3mf` parsing — server-side, Route Handler mới** (không phải client,
   không phải Server Action vì cần xử lý file nhị phân lớn + trả JSON để
   review trước khi submit form). Thư viện: `fflate` (unzip, ~8KB, đọc
   `Metadata/slice_info.xml` trong `.3mf`) + `fast-xml-parser` (parse XML nhẹ,
   không cần DOM). Cả 2 lý do cụ thể theo Rule #8 AGENTS.md: không có cách nào
   đọc ZIP/XML server-side bằng code tay gọn hơn mà an toàn. Giới hạn upload
   10MB (chỉ cần đọc 1 file XML nhỏ trong ZIP, không cần giải nén mesh).
   - **Guardrail (Gemini challenge):** Xử lý rõ ràng trường hợp file `.3mf` là file mô hình 3D thô chưa qua slice (không có `Metadata/slice_info.xml`), trả về mã lỗi cụ thể và thông báo hướng dẫn staff thay vì crash.
6. **MakerWorld URL** — chỉ lưu text (xem Non-goals #1), không code fetch nào ở
   v1.
7. **UI 1-click**:
   - `/admin/custom-requests/[id]`: nút "Tính giá đề xuất" mở panel — chọn
     nguồn dữ liệu (upload `.3mf` / nhập tay), chọn material cho từng màu từ
     `listMaterials()`, xem breakdown, bấm "Tạo báo giá" → gọi
     `createQuote` với `subtotal`/`total` đã tính + `pricingBreakdown`/
     `pricingConfigId` đính kèm. Staff vẫn sửa tay `total` trước khi lưu nếu
     muốn (không khoá cứng, breakdown chỉ là đề xuất).
   - `/admin/products` (create/edit variant): panel tương tự, điền vào
     `basePrice`/variant `price` sau khi staff xác nhận.
8. **Ghi ADR**: các quyết định kiến trúc ở trên (pure service, bảng
   `pricing_configs` insert-only, snapshot jsonb, scope-out `print_jobs`) sẽ
   được ghi vào `docs/architecture/decisions.md` (ADR-0022+) ở **Step 7 của
   Phase Start Protocol — sau khi implement xong**, không ghi trước lúc này để
   tránh phải sửa lại nếu Gemini challenge đổi quyết định.

## Inputs
- `docs/product/catalog-spec.md` §4 + phụ lục Phase 9.
- `src/services/inventory.service.ts` (`listMaterials` — cần mở rộng select
  thêm `cost_per_spool`, `spool_weight_grams`, `current_unit_cost`).
- `src/services/quote.service.ts` (`createQuote` — thêm optional
  `pricingBreakdown`/`pricingConfigId` vào input).
- `src/services/product.service.ts` (`createProduct`/`updateProduct`/
  `createVariant`/`updateVariant` — thêm optional `pricingBreakdown`/
  `pricingConfigId`).
- `src/domain/schemas.ts` (pattern Zod hiện có — `vndSchema`,
  `positiveQuantitySchema` để tái dùng cho pricing config/input schema mới).
- `src/app/admin/(protected)/custom-requests/[id]/` và
  `src/app/admin/(protected)/products/` — pattern admin action/page hiện có để
  mirror panel mới.

## Outputs
- Migration mới: `pricing_configs` table; `alter table quotes add column
  pricing_breakdown jsonb, add column pricing_config_id uuid references
  pricing_configs(id)`; tương tự cho `products`.
- `src/services/pricing.service.ts` — pure calculator (không DB) + unit test.
- `src/services/pricing-config.service.ts` — `getCurrentPricingConfig`,
  `createPricingConfig` (insert-only, `requireAdmin` OWNER-only).
- `src/lib/parsers/threemf-slice-info.ts` — đọc `.3mf`, trả về
  `{ plates, totalPrintMinutes, filaments: {colorName, gram}[] }` + test dùng
  fixture file thật.
- `src/app/api/admin/pricing/parse-3mf/route.ts` (Route Handler, upload
  `.3mf` → JSON parse result, không lưu file).
- `src/domain/schemas.ts`: `pricingConfigInputSchema`.
- Mở rộng `inventory.service.listMaterials` (thêm 3 cột giá vào select).
- Mở rộng `quote.service.createQuote`, `product.service.createProduct/
  updateProduct/createVariant/updateVariant` nhận `pricingBreakdown`/
  `pricingConfigId` optional.
- UI: panel "Tính giá đề xuất" ở `/admin/custom-requests/[id]` và
  `/admin/products` (create/edit), trang `/admin/settings/pricing` (OWNER-only,
  xem lịch sử + tạo config mới).
- Dependency mới: `fflate`, `fast-xml-parser`.

## Risks
- **[ĐÃ SỬA] Bug nghiêm trọng: panel tính giá crash 100% với config/material
  thật, không phải edge case** — Codex second-pass review thêm guardrail
  `Number.isFinite`/`RangeError` vào `pricing.service.ts` (đúng và cần thiết).
  Nhưng `pricing_configs`/`materials` có cột `bigint`/`numeric`
  (`electricity_vnd_per_kwh`, `margin_pct`, `cost_per_spool`,
  `current_unit_cost`, ...) — driver `pg` trả các cột này dưới dạng **string**
  (để tránh mất độ chính xác), không phải `number` như type khai báo
  (`PricingConfigRow`, `listMaterials` return type nói dối runtime shape).
  `Number.isFinite("3500")` luôn `false` → mọi lần gọi `computePricingBreakdown`
  với config/material đọc thật từ DB đều throw ngay trong `useMemo` của
  `PricingCalculatorPanel` → React crash toàn trang ("Application error: a
  client-side exception..."). Bug này rất có thể là nguyên nhân thật khiến
  Codex's browser automation timeout trước đó (báo cáo lúc đó đoán do race
  condition khi chờ filament rows render — thực ra là crash trước khi kịp
  chọn material). Phát hiện bằng Playwright thật (`e2e/pricing.spec.ts`,
  chạy Node 22.23.2), sửa tại nguồn: `pricing-config.service.ts`
  (`toPricingConfigRow`) và `inventory.service.ts` (`listMaterials`) ép kiểu
  `Number(...)` cho mọi cột `bigint`/`numeric` trước khi trả ra ngoài. Verify
  lại bằng Playwright thật: pass.
- **`.3mf` structure đã verify bằng file thật trong second-pass review** — fixture
  `estampo/bambox tests/fixtures/reference.gcode.3mf`, tạo bởi BambuStudio
  02.05.00.66, xác nhận path thật là `Metadata/slice_info.config` (nội dung XML)
  và các field `index`, `prediction`, `used_g`. Parser/test đã được sửa theo mẫu
  thật; giữ `Metadata/slice_info.xml` làm compatibility fallback cho tooling cũ.
- **Rounding double-error**: `Price = Total/(1-margin)` có thể ra số thập phân
  dài trước khi áp `ADR-0010`; cần test riêng để tránh sai số floating-point
  làm `ceil` cộng dư 1.000đ không cần thiết (xem Tests).
- **`pricing_configs` insert-only** có thể phình bảng nếu OWNER sửa liên tục —
  chấp nhận được ở quy mô 1 xưởng, không cần optimize (Rule #10 AGENTS.md).
- **Breakdown snapshot có thể lệch nếu OWNER sửa `materials.cost_per_spool`
  sau khi đã tạo Quote/Product** — đây là hành vi đúng theo thiết kế (breakdown
  là ảnh chụp tại thời điểm tính, không tự cập nhật theo giá vật liệu/config
  mới). Với **Quote**: ảnh chụp này bất biến thật vì không có đường update.
  Với **Product**: staff có thể chủ động tái định giá (mở panel, bấm "Dùng
  giá này" lại) để thay `basePrice`+`pricing_breakdown`+`pricing_config_id`
  cùng lúc — đây là hành vi mong muốn (Product là catalog sống), không phải
  bug. Xem làm rõ ở Quyết định #4.
- **2 dependency mới** (`fflate`, `fast-xml-parser`) — nhẹ, có lý do cụ thể
  (Rule #8), nhưng vẫn tăng bundle nếu vô tình import ở client component thay
  vì chỉ dùng trong Route Handler (server-only) — cần đảm bảo import đúng
  chỗ, không leak vào client bundle.
- **MakerWorld auto-parse bị hoãn** — nếu OWNER cần gấp, đây là gap thật, cần
  Phase 9b riêng sau khi xác nhận tính khả thi kỹ thuật/ToS.

## Checklist

### Trước khi giao Codex
- [x] Rà soát code hiện có trước khi lập kế hoạch (đã làm ở trên)
- [x] Chốt input contract Material cost (waste-inclusive gram, đơn giá theo
      `unit` SPOOL/GRAM) — đã ghi vào `docs/product/catalog-spec.md` phụ lục
      Phase 9
- [x] Chốt scope: loại MakerWorld auto-parse và đổi schema `print_jobs` ra
      khỏi Phase 9 (Non-goals #1, #2)
- [x] Ask AI for challenge trước khi implement (Step 3 `PHASE_START_PROTOCOL.md`)
      — **Đã hoàn thành qua Gemini Review (2026-09-01)**: chốt giữ v1 MakerWorld plain-text,
      giữ snapshot-only JSONB, insert-only pricing_configs kèm guardrail auto-now(),
      và server-side .3mf parser kèm guardrail no-slice-info handling.
- [x] **ĐÃ GIẢI QUYẾT TRONG CODEX SECOND-PASS REVIEW (2026-09-01)** — Có ít nhất 1 file `.3mf` mẫu thật (export/tải về)
      để verify cấu trúc slice metadata. Đã unzip fixture BambuStudio reference
      công khai của `estampo/bambox` và phát hiện implementation ban đầu dùng sai
      tên `Metadata/slice_info.xml`; tên thật là `Metadata/slice_info.config`.
      Đã sửa parser, trích XML thật vào test fixture và xác nhận `prediction`,
      `index`, `used_g` đúng cấu trúc thực tế.

### Tests
- [x] Golden test `pricing.service`: khớp đúng ví dụ trong `catalog-spec.md`
      (input 50g/3h → cost 38.560đ → Price 64.267đ → Final 65.000đ).
      (`tests/pricing-service.test.ts`)
- [x] Property test rounding (ADR-0010): mọi `Price` ngẫu nhiên hợp lệ →
      `finalPriceVnd % 1000 === 0` và `finalPriceVnd >= Price`, và
      `Number.isInteger(finalPriceVnd) === true` — thêm test riêng cho double-
      rounding float-epsilon case (margin 40%, price đúng bội số 1000).
- [x] Test đa màu: N material với đơn giá/gram khác nhau → tổng Material cost
      đúng bằng tổng từng phần (không làm tròn từng phần trước khi cộng).
- [x] Test `unit='SPOOL'` vs `unit='GRAM'` chọn đúng công thức đơn giá/gram
      (mục Quyết định #2), bao gồm case thiếu field → trả 0 thay vì crash.
- [x] Test `threemf-slice-info.ts` — fixture XML thật trích từ BambuStudio
      reference archive + fixture synthetic cho multi-plate — đúng số plate,
      tổng thời gian in, gộp đúng filament trùng màu qua nhiều plate, và 3 case
      lỗi (thiếu slice_info.xml, không phải ZIP, plate rỗng).
- [x] Test `createQuote`/`createProduct` lưu đúng `pricingBreakdown`/
      `pricingConfigId` khi có, vẫn hoạt động bình thường khi không có
      (`tests/pricing-snapshot-integration.test.ts`).
- [x] Test breakdown của Quote đã ACCEPTED không đổi khi `pricing_configs` có
      row mới sau đó (regression business-rules #3/#7).
- [x] (Điều chỉnh phạm vi) Test RBAC `createPricingConfig`: **không** test qua
      HTTP/Server Action theo cùng lý do đã ghi ở `phase-7.md` (không có tiền
      lệ test Server Action kiểu này trong repo — `staff`/`custom-requests`
      admin actions cũng chưa được test cách này). Thay vào đó test xác nhận
      `createPricingConfig` luôn tự gán `effective_from` server-side bất kể
      input (`pricing-config-service.test.ts`); bảo vệ OWNER-only nằm ở
      `requireOwner()` trong `settings/pricing/actions.ts`, cùng cơ chế đã
      dùng cho `staff/actions.ts`/`deleteProductAction`, không viết lại logic
      RBAC riêng.
- [x] Chạy lại toàn bộ `npm test` (Claude tự verify lại, không tin số Codex
      báo cáo): **90-91/96 pass** tuỳ lần chạy trên Node 18 (5-6 fail là lỗi
      môi trường có sẵn từ trước — Node 18 thiếu native WebSocket cho
      `@supabase/supabase-js`, hoặc `next start` port 3411 bị process cũ
      chiếm gây `fetch failed` — cả hai loại đều tái hiện y hệt khi build từ
      `main`/`git stash`, không liên quan Phase 9); **96/96 pass** khi chạy
      trên Node 22.23.2 (không còn lỗi WebSocket). 0 test mới của Phase 9 nằm
      trong danh sách fail ở cả hai môi trường.
- [x] **Bug thật tìm thấy qua browser E2E, đã sửa** (xem chi tiết ở mục Risks
      "Bug nghiêm trọng...") — `getCurrentPricingConfig`/`listMaterials` trả
      cột `bigint`/`numeric` dưới dạng string (hành vi mặc định của `pg`),
      làm guardrail `Number.isFinite` mới của Codex crash 100% panel khi dùng
      config/material thật. Đã sửa tại nguồn (`pricing-config.service.ts`,
      `inventory.service.ts`), verify lại bằng Playwright thật.
- [x] Browser E2E mới: `e2e/pricing.spec.ts` (3 test, chạy bằng Playwright
      thật trên Node 22.23.2, `npx playwright test e2e/pricing.spec.ts`):
      OWNER tạo Quote qua calculator (nhập tay, không qua `.3mf` — path
      `.3mf` đã có test riêng ở tầng parser), OWNER reprice Product qua
      calculator (xác nhận Option A/ADR-0022), STAFF bị chặn ở
      `/admin/settings/pricing`. Cả 3 pass.

### Pre-delivery (UI mới)
- [x] Panel "Tính giá đề xuất" có trạng thái loading/error rõ ràng khi parse
      `.3mf` lỗi (file sai định dạng, quá lớn) — không treo UI.
- [x] Breakdown hiển thị đủ từng dòng chi phí (Material theo từng màu,
      Electricity, Machine dep., Failure buffer, Labor, Packaging, Final
      Price) — không chỉ hiện tổng.
- [x] Staff sửa tay được `total`/`basePrice` sau khi xem đề xuất (nút "Dùng
      giá này" chỉ điền giá trị vào input, không khoá input).
- [x] Đã test bằng browser thật (Playwright, không phải chỉ build pass) —
      xem `e2e/pricing.spec.ts`. Phát hiện + sửa 1 bug crash thật (xem trên).
- [x] `cursor-pointer`/hover state cho nút trong panel — verify bằng cách đối
      chiếu grep với convention hiện có toàn repo (`grep -rn cursor-pointer
      src/app/admin src/components/admin`): mọi trang admin khác chỉ gắn
      `cursor-pointer` cho `<label>` đi kèm checkbox/file-upload (VD
      `products/page.tsx:63`, `products/[id]/page.tsx:159`), **không** gắn
      cho `<Button>`/`<select>` (native đã có pointer cursor mặc định, không
      trang nào trong repo làm khác). `PricingCalculatorPanel` đã khớp đúng
      convention này (label upload `.3mf` có `cursor-pointer`, Button/select
      dùng mặc định) — không phải gap riêng của Phase 9.

## Definition of Done
- `pricing.service.ts` tính đúng theo công thức đã duyệt (`catalog-spec.md`
  §4 + phụ lục), pass toàn bộ golden/property test.
- Staff tạo được 1 Quote thật từ `/admin/custom-requests/[id]` bằng cách upload
  `.3mf` mẫu, xem breakdown, xác nhận, và Quote lưu đúng `pricing_breakdown`.
- Staff định giá được 1 Product/variant từ `/admin/products` qua panel tương
  tự.
- OWNER tạo/xem được lịch sử `pricing_configs` ở `/admin/settings/pricing`;
  STAFF không sửa được.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%,
  không regression Phase 0–8.
- ADR-0022+ được ghi vào `docs/architecture/decisions.md` sau khi implement
  xong (Step 7 Phase Start Protocol).
- Non-goals (MakerWorld auto-parse, đổi schema `print_jobs`) được ghi rõ là
  follow-up, không bị coi nhầm là "đã làm".
