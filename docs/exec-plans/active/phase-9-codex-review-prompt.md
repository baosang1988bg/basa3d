# Prompt giao Codex — Phase 9 review & completion (không phải implement từ đầu)

Context: Phase 9 của BaSa3D ("Pricing Engine & Slicer/.3mf Integration") đã
được Claude **implement xong** trong phiên làm việc trước (migration, services,
route, domain schemas, UI, 4 file test mới) — không phải bạn build từ đầu.
Nhiệm vụ của bạn là **review độc lập + verify + hoàn thiện phần còn thiếu**,
đúng vai trò implementer/second-pass trong AI_WORKFLOW.md, không phải chấp
nhận báo cáo của Claude là đúng mà không tự kiểm chứng.

Read first, in this order:

1. `AGENTS.md` — canonical engineering rules (đặc biệt Rule #1 DB là nguồn sự
   thật, Rule #2 tiền là integer minor unit, Rule #6 validate boundary, Rule #8
   không thêm dependency vô cớ).
2. `docs/exec-plans/active/phase-9.md` — toàn bộ brief, "Quyết định đã chốt"
   #1–#8, Risks, Checklist, Definition of Done. **Chú ý mục "Trước khi giao
   Codex" còn 1 dòng `[ ]` chưa xong**: chưa có file `.3mf` thật để verify cấu
   trúc `slice_info.xml` — xem Task 1 bên dưới, đây là việc bạn cần xử lý,
   không phải giả định đã xong.
3. `docs/product/catalog-spec.md` §4 + phần "Phụ lục Phase 9" ở cuối file —
   công thức cost-plus đã duyệt + input contract (waste-inclusive gram, quy
   tắc chọn đơn giá/gram theo `unit` SPOOL/GRAM).
4. Toàn bộ file đã tạo/sửa ở Phase 9 (danh sách đầy đủ ở Task 2 bên dưới) —
   đọc thật, không suy đoán từ tên file.

## Vì sao cần review độc lập, không chỉ chạy lại test

Claude tự báo cáo `npm test` 87/92 pass (5 fail là lỗi môi trường Node 18 có
sẵn từ trước, không liên quan Phase 9) và `tsc`/`eslint`/`build` sạch. Đó là
lời tự báo cáo của agent đã viết code — cần bạn tự chạy lại và tự đọc code để
xác nhận, không lấy con số đó làm sự thật mặc định.

## Task 1 — Giải quyết (hoặc xử lý minh bạch) rủi ro lớn nhất: `.3mf` parser chưa verify

`src/lib/parsers/threemf-slice-info.ts` được viết theo cấu trúc
`Metadata/slice_info.xml` **suy ra từ tài liệu công khai** về Bambu Studio
(dạng `<config><plate><metadata key=... value=.../><filament id=... used_g=.../>`),
**không phải verify bằng file `.3mf` thật xuất từ Bambu Studio/Orca Slicer
hoặc tải từ MakerWorld**. Test đi kèm (`tests/threemf-slice-info.test.ts`)
dùng fixture ZIP tự dựng bằng `fflate.zipSync` khớp đúng cấu trúc giả định đó
— nghĩa là test chỉ xác nhận "parser làm đúng những gì nó được viết ra để
làm", không xác nhận "cấu trúc giả định đó đúng với file thật".

Việc cần làm:

- Nếu bạn có quyền truy cập một file `.3mf` thật (export từ Bambu Studio/Orca
  Slicer, hoặc tải một model công khai từ MakerWorld) — unzip nó, đọc
  `Metadata/slice_info.xml` thật, so sánh với giả định trong
  `threemf-slice-info.ts` (tên field: `prediction`, `index`, `used_g`, cấu
  trúc `<plate>`/`<filament>`). Sửa parser nếu lệch, và **thay fixture test
  hiện tại bằng file `.3mf` thật đó** (hoặc trích xuất `slice_info.xml` thật
  từ nó làm fixture) thay vì ZIP tự dựng.
- Nếu bạn **không** có file thật để verify (không có quyền tải mạng, hoặc
  không tìm được nguồn) — đừng tự ý "coi như đã verify". Giữ nguyên cảnh báo
  trong code + `phase-9.md`, và báo lại rõ ràng trong phần "Known risks" của
  report rằng mục này **vẫn** chưa được giải quyết sau lượt review này.

## Task 2 — Review độc lập toàn bộ implementation

Danh sách file đã tạo/sửa ở Phase 9 (đọc kỹ, không chỉ lướt qua):

**Migration:** `supabase/migrations/20260902000000_pricing_configs_and_snapshots.sql`
(đã apply lên DB dev — kiểm tra bằng `select * from pricing_configs limit 1`
hoặc tương đương, đừng giả định file migration khớp DB thật nếu chưa tự
xác nhận).

**Services mới:** `src/services/pricing.service.ts`,
`src/services/pricing-config.service.ts`, `src/lib/parsers/threemf-slice-info.ts`.

**Route mới:** `src/app/api/admin/pricing/parse-3mf/route.ts`.

**Services sửa:** `src/services/inventory.service.ts` (`listMaterials`),
`src/services/quote.service.ts` (`createQuote`), `src/services/product.service.ts`
(`createProduct`, `updateProduct`), `src/domain/schemas.ts`
(`pricingConfigInputSchema`, `pricingBreakdownSchema`, mở rộng `quoteInputSchema`/
`productInputSchema`/`productUpdateInputSchema`).

**UI:** `src/components/admin/pricing-calculator-panel.tsx`,
`src/app/admin/(protected)/settings/pricing/{page.tsx,actions.ts}`,
sửa `custom-requests/[id]/page.tsx` + `actions.ts`, `products/page.tsx`,
`products/[id]/page.tsx` + `actions.ts`, `src/components/admin/admin-nav.tsx`.

**Test:** `tests/pricing-service.test.ts`, `tests/pricing-config-service.test.ts`,
`tests/threemf-slice-info.test.ts`, `tests/pricing-snapshot-integration.test.ts`.

Kiểm tra cụ thể (không chỉ "trông có vẻ ổn"):

- **Data integrity/tiền (Rule #1/#2)**: mọi field trong `PricingBreakdown` có
  thực sự luôn là integer VND không (không có đường nào lọt qua
  `toIntegerVnd`)? Rounding cuối (`Math.ceil(.../1000)*1000`) có đúng
  ADR-0010, có edge case nào (marginPct gần 100, totalCostVnd=0) làm
  `Infinity`/`NaN` lọt vào DB không?
- **Snapshot immutability**: `pricing_breakdown`/`pricing_config_id` trên
  `quotes`/`products` có thực sự bất biến sau khi lưu (không có code nào
  update lại 2 cột này ở nơi khác) — grep toàn repo để chắc chắn.
- **RBAC**: `createPricingConfigAction` có thực sự chỉ gọi được bởi OWNER
  (`requireOwner()`), và trang `/admin/settings/pricing` có enforce đúng
  không chỉ ẩn nav link (UI hiding không phải security boundary — AGENTS.md
  rule #5)?
- **Boundary validation (Rule #6)**: `pricingBreakdown` gửi từ client qua
  hidden input trong `PricingCalculatorPanel` có được `pricingBreakdownSchema`
  validate lại ở server action trước khi vào DB không, hay bị parse thẳng
  không qua Zod ở đâu đó?
- **Bundle leakage (Rule #8)**: `fflate`/`fast-xml-parser` chỉ được import ở
  `threemf-slice-info.ts` (server-only, dùng trong route handler) — xác nhận
  không component client nào import trực tiếp 2 lib này (build output không
  cho thấy rõ điều này, cần tự grep import).
- **Backward compatibility**: tạo Quote/Product **không** dùng
  `PricingCalculatorPanel` (nhập tay như cũ) có còn hoạt động y hệt trước
  Phase 9 không — test thủ công hoặc đọc lại code đường đi khi
  `pricingBreakdown`/`pricingConfigId` đều `undefined`.
- **`pricing_configs.created_by`**: cột này cố ý **không** có FK tới
  `staff_profiles` (khác với đề xuất ban đầu, đã sửa lại cho khớp convention
  `inventory_movements.created_by`/`material_movements.created_by` — plain
  `uuid`, không FK). Xác nhận migration file khớp đúng những gì đã chạy trên
  DB thật, không lệch.

Nếu tìm thấy bug/thiếu sót thật — sửa trực tiếp, đừng chỉ liệt kê ra rồi để
đó.

## Task 3 — Hoàn thiện phần Claude tự nhận là chưa test kỹ

- UI `PricingCalculatorPanel` mới chỉ qua `tsc`/`eslint`/`next build`, **chưa
  chạy thử bằng trình duyệt thật**. Chạy `npm run dev`, thử luồng thật: tạo 1
  `pricing_configs` ở `/admin/settings/pricing`, vào 1 custom request, tải
  file `.3mf` (thật nếu có, hoặc fixture test hiện có nếu không) hoặc nhập
  tay, xem breakdown hiển thị đúng, bấm "Dùng giá này", tạo Quote, xác nhận
  `quotes.pricing_breakdown` lưu đúng trong DB.
- Test tương tự cho `/admin/products` (create + edit `basePrice`).

## Before reporting done

- Tự chạy lại (không chỉ tin số cũ): `npm run typecheck`, `npm run lint`,
  `npm test`, `npm run build`. Nếu số lượng pass/fail khác với báo cáo trước
  (87/92, 5 fail môi trường Node 18 không liên quan Phase 9) — báo cáo con số
  thật bạn thấy, không copy lại con số cũ.
- Xác nhận không có regression Phase 0–8 (so sánh danh sách test fail với
  danh sách 5 test đã biết là môi trường, không phải Phase 9 — nếu có test
  khác fail, đó là regression thật cần điều tra, không phải "chắc cũng giống
  vậy").
- Chạy thử UI thật theo Task 3, không chỉ dựa vào build pass.

## Known accepted limitation (Non-goals — đừng tự ý mở rộng)

Theo `phase-9.md` Non-goals #1–#2, **không** cần làm (và không nên làm nếu
chưa quay lại Phase Start Protocol): MakerWorld URL auto-fetch/scrape (v1 chỉ
lưu text), và đổi schema `print_jobs`/`material_movements` để track tiêu hao
đa màu thật cho production (pricing breakdown chỉ là snapshot, không phải
ledger tồn kho).

Commit style: Conventional Commits, nhỏ theo từng nhóm việc thật đã sửa —
ví dụ `fix: verify 3mf slice_info structure against a real sample`,
`fix: validate pricingBreakdown at the server action boundary` (nếu tìm thấy
thiếu), `test: replace synthetic 3mf fixture with a real sample` (nếu có file
thật). Không tự chuyển `phase-9.md` sang `docs/exec-plans/completed/` — việc
đó chờ human/Claude review sau.

Report back in exactly this format (theo AGENTS.md):

1. Files changed
2. Behavior changed
3. Tests/checks run (con số thật bạn tự chạy, không copy lại số cũ)
4. Known risks (đặc biệt: mục `.3mf` ở Task 1 đã giải quyết được chưa, hay vẫn
   còn treo)
5. Follow-up work, if any
