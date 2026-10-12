# Phase — MakerWorld Print Profile Verification & Instant Quoting Flow

Kế thừa và mở rộng Phase 13 (`makerworld-resolver.ts`, `makerworld-quote-panel.tsx`, `quote.service.ts`).
Giải quyết bài toán thực tế: một model MakerWorld có nhiều Print Profiles (P1S/P2S/A1/X1C, No-AMS vs AMS, infill/layer khác nhau); hệ thống cần trích xuất chính xác Title và Thumbnail của riêng profile được chọn (thay vì ảnh bìa chung), hiển thị Card đối chiếu trực quan để User/Staff xác nhận đúng profile trước khi xem giá và tạo báo giá.

> **Status:** Đã qua Claude review (6 blockers B1–B6) và Gemini independent challenge (bổ sung B7–B11 & chốt kiến trúc Q1–Q4).
> Phase chia làm 2:
> - **Phase A (Admin-only, không migration):** Sẵn sàng giao Codex triển khai ngay.
> - **Phase B (Storefront Intake Flow):** Triển khai sau Phase A.

---

## 1. Mục tiêu (Goals)

1. **Multi-profile Extraction**: Bóc tách danh sách Print Profiles của model MakerWorld: `id`, `profileTitle` (vd `"0.2mm layer, 2 walls, 15% infill"`), `profileCoverImageUrl` (ảnh có logo NO AMS), `printerTarget` (P1S/P2S), `platesCount` (6), `printTimeMinutes` (450m / 7.5h), `netWeightGrams` (170g), `filaments`, `amsRequired`.
2. **Visual Profile Verification Card**: Card xem trước profile (thumbnail riêng của profile, title, badges: máy in, giờ in, số plate, gram, AMS/No-AMS, nguồn dữ liệu).
3. **Profile Confirmation Mechanism**: Bước xác nhận *"✓ Đã xác nhận đúng profile yêu cầu"* — **hard gate ở schema ghi mới** (`profileVerified: z.literal(true)`).
4. **2-Tier Pricing (Ráp sẵn / Kit rời)**: 2 mức giá hiển thị ở bước *ước tính*; **mỗi Quote chứa đúng 1 mức giá** (`snapshot.tier`). Giá suy ra từ `pricing_configs` — không hardcode.
5. **Snapshot & Public Quote Persistence**: Lưu profile metadata vào `QuoteModelSnapshot` v2 có `schemaVersion: 2`, trang `/quotes/[quoteNumber]` đọc an toàn cả v1 lẫn v2 qua `readQuoteModelSnapshot()`.
6. **Graceful Fallback Mode**: Khi MakerWorld chặn (403) — Admin dùng Quick-Form + "Dán đoạn thông số" trong < 15 giây.

---

## 2. Giới hạn (Non-goals)

- Không bypass Cloudflare bằng proxy/captcha solver/residential IP mạo danh.
- Không tải file 3MF/Gcode về server.
- Không lưu nhiều mức giá trong 1 Quote (`options[]`) để bảo đảm `quotes.total` bất biến và giữ mã VietQR tĩnh chuẩn Napas (ADR-0022).
- Không chạy public resolver từ datacenter IP lên Storefront ở Phase A (tránh lỗi 403 hàng loạt và DoS database connection pool).

---

## 3. Tổng hợp Blockers & Quyết định Kiến trúc (Claude + Gemini)

| # | Vấn đề | Quyết định xử lý |
|---|---|---|
| **B1** | `MakerWorldQuotePanel` nhận config và tính giá ở client $\rightarrow$ Storefront không được copy nguyên bản. | Storefront (Phase B) tính giá ở server, trả DTO public ẩn COGS/margin. Phase A chỉ chạy trong Admin (`requireAdmin()`). |
| **B2** | `coverImageUrl` không validate host $\rightarrow$ rủi ro image injection / tracking pixel. | Sanitizer `sanitizeMakerWorldImageUrl` với allowlist domain MakerWorld/Bambu Lab (`makerworld.com`, `*.makerworld.com`, `*.bambulab.com`). **Owner chốt 2026-10-12: bỏ `*.aliyuncs.com`** — mọi khách Alibaba Cloud OSS đều có subdomain này → wildcard mở lại đúng lỗ B2. CDN thật nằm ở host khác thì thêm hostname CHÍNH XÁC. |
| **B3** | Đổi input/profile sau khi apply không xoá ô giá form cha $\rightarrow$ lưu nhầm giá cũ. | Child component `key={selectedProfileId}` remount sạch state; mọi thay đổi input gọi `clearApplied()` xoá ô giá form cha và gỡ hidden inputs. |
| **B4** | 2 mức giá làm sai `quotes.total` và VietQR cọc. | 1 Quote = 1 mức giá; `snapshot.tier` ghi rõ (`ASSEMBLED` hoặc `KIT`). |
| **B5** | Lỗ hổng DoS qua DB Rate Limiter ở endpoint public. | Huỷ bỏ việc dùng `createDatabaseRateLimiter` cho public scrape endpoint; Phase B chuyển sang link intake form. |
| **B6** | Rủi ro bản quyền thương mại MakerWorld. | Tự động gắn cờ `ip_risk_flag = true` để kích hoạt gate xác nhận bản quyền Phase 29 cho mọi yêu cầu từ MakerWorld. |
| **B7** *(Mới)* | Xung đột hidden input giữa `MakerWorldQuotePanel` và `PricingCalculatorPanel` trong cùng `<ActionForm>`. | Thêm cơ chế Tabs/Radio độc quyền trên `custom-requests/[id]/page.tsx` — chỉ 1 panel được active và xuất hidden inputs vào form tại một thời điểm. |
| **B8** *(Mới)* | `acceptQuote` auto-reject toàn bộ custom request làm huỷ nhầm đơn nhiều món hoặc đơn revision. | Scope lệnh auto-reject: chỉ reject các Quote có cùng `sourceUrl` (`AND (model_snapshot->>'sourceUrl') = $sourceUrl`). |
| **B9** *(Mới)* | Zod raw `z.union([v2, v1])` bẫy lỗi parse làm che giấu lỗi thật của v2. | Dùng schema phẳng mở rộng có `schemaVersion: z.literal(2).default(2)` hoặc helper preprocess để báo lỗi chính xác `profileVerified`. |
| **B10** *(Mới)* | Thiếu server-side consistency check giữa breakdown và snapshot. | Trong `createQuoteAction`: nếu có cả breakdown và snapshot, verify rằng `printMinutes` trong breakdown khớp với `totalPrintMinutes` của snapshot ($\pm 15\%$). Bất kỳ điều chỉnh giá tay nào đều được log `MANUAL_PRICE_OVERRIDE` vào audit log. |
| **B11** *(Mới)* | Allowlist ảnh quá hẹp làm vỡ ảnh CDN thật của MakerWorld. | Mở rộng allowlist bao gồm các CDN phụ trợ chính thức của MakerWorld/Bambu Lab. |

---

## 4. Chi tiết Kỹ thuật Phase A (Admin Implementation)

### 4.1 Schema Layer (`src/domain/schemas.ts` & `src/services/quote.service.ts`)
```ts
// QuoteModelSnapshot v2 definition
export const quoteModelSnapshotV2Schema = z.object({
  schemaVersion: z.literal(2).default(2),
  sourceUrl: z.string().trim().url().max(2_000),
  title: nonEmptyText.max(300),
  coverImageUrl: z.string().trim().url().max(2_000).nullable().optional(),
  platesCount: safeInteger.nonnegative(),
  totalPrintMinutes: safeInteger.nonnegative(),
  colorsCount: safeInteger.nonnegative(),
  // Profile specific fields:
  dataSource: z.enum(['RESOLVER', 'MANUAL']).default('RESOLVER'),
  profileId: z.string().trim().max(100),
  profileTitle: nonEmptyText.max(300),
  profileCoverImageUrl: z.string().trim().url().max(2_000).nullable().optional(),
  printerTarget: z.string().trim().max(100).nullable().optional(),
  netWeightGrams: z.number().nonnegative().max(20_000),
  amsRequired: z.boolean().nullable().optional(),
  tier: z.enum(['ASSEMBLED', 'KIT']).nullable().optional(),
  profileVerified: z.literal(true),
}).strict();
```
- Helper `readQuoteModelSnapshot(raw: unknown)`: Dùng `safeParse`. Nếu lỗi: ghi `console.error('[QUOTE_SNAPSHOT_CORRUPTED]', error)` và trả `null` để bảo vệ trang thanh toán của khách.

### 4.2 Resolver Layer (`src/lib/parsers/makerworld-resolver.ts`)
- Parse toàn bộ mảng `instances`: Trả về `profiles: MakerWorldProfileItem[]` và `activeProfileId: string | null`.
- Nếu URL có hash `#profileId-...`: active profile đó. Nếu URL không có hash và có $> 1$ profile: trả `activeProfileId: null` (bắt buộc Staff chọn trên dropdown).
- Sanitize URL ảnh qua allowlist: `makerworld.com`, `*.makerworld.com`, `*.bambulab.com` (không `*.aliyuncs.com` — xem B2).
- Cap response 3 MB, timeout tổng 6s cho chuỗi redirect.

### 4.3 Fallback Parser ("Dán đoạn thông số") (`src/lib/parsers/makerworld-spec-text.ts`)
- Parser thuần regex ở client: Nhận đoạn text staff copy từ MakerWorld (vd `"7.5 h 6 plates 170g 0.2mm layer, 2 walls, 15% infill"`).
- Bóc tách tự động: `hours`, `plates`, `grams`, `title`, điền sẵn vào Quick-Form trong < 5 giây.

### 4.4 Admin Quoting Panel (`src/components/admin/makerworld-quote-panel.tsx`)
- Tách `MakerWorldProfilePricing` con với `key={selectedProfileId}`.
- Dropdown chọn profile; Card đối chiếu xanh lá (ảnh NO AMS, title, badges: Designer, 7.5h, 6 plates, 170g).
- Checkbox `[x] Đã xác nhận đúng profile khách yêu cầu` (buộc tick mới bật nút "Dùng giá này").
- Chọn tier: `ASSEMBLED` (công 50p + keo dán) vs `KIT` (công 20p).
- Hàm `clearApplied()` tự động xoá ô giá form cha (`''`) và hidden inputs khi bất kỳ input nào thay đổi.

### 4.5 Scoped Auto-Reject trong `acceptQuote` (`src/services/quote.service.ts`)
```sql
UPDATE quotes
SET status = 'REJECTED'
WHERE custom_request_id = $1
  AND id <> $2
  AND status IN ('DRAFT', 'SENT')
  AND (model_snapshot->>'sourceUrl') IS NOT NULL
  AND (model_snapshot->>'sourceUrl') = $sourceUrl;
```

---

## 5. Checklist Triển khai (Phase A)

- [x] `src/lib/parsers/makerworld-image.ts`: Hàm sanitizer URL ảnh với allowlist CDN đầy đủ.
- [x] `src/lib/parsers/makerworld-resolver.ts`: Trả về danh sách `profiles`, sanitize ảnh, cap 3 MB, deadline 6s.
- [x] `src/lib/parsers/makerworld-spec-text.ts`: Parser bóc tách text thông số profile khi dán thủ công.
- [x] `src/lib/pricing/assembly-tiers.ts`: Định nghĩa hằng số công lắp ráp và vật tư cho `ASSEMBLED` và `KIT`.
- [x] `src/domain/schemas.ts`: Cập nhật `quoteModelSnapshotSchema` hỗ trợ v1 và v2, refine URL ảnh và sourceUrl.
- [x] `src/services/quote.service.ts`:
  - Cập nhật `QuoteModelSnapshot` type từ `z.infer`.
  - Cập nhật `readQuoteModelSnapshot` có error logging.
  - Sửa `acceptQuote` auto-reject scoped theo `sourceUrl`.
- [x] `src/components/admin/makerworld-quote-panel.tsx`:
  - Dropdown chọn profile, Card đối chiếu trực quan, checkbox xác nhận.
  - Reset state qua component con `key={selectedProfileId}` và `clearApplied()`.
  - Quick-Form fallback kèm parser dán đoạn text.
- [x] `src/app/admin/(protected)/custom-requests/[id]/page.tsx`:
  - Bọc `MakerWorldQuotePanel` và `PricingCalculatorPanel` trong Tabs/Radio chọn công cụ độc quyền.
- [x] `src/app/[locale]/(storefront)/quotes/[quoteNumber]/page.tsx`:
  - Render Card profile đã xác thực cho snapshot v2, hiển thị huy hiệu máy in và thông số kỹ thuật.
- [x] Tests:
  - Unit test resolver đa profile, URL không hash, timeout, sanitize ảnh.
  - Test Zod validation v1/v2 và kiểm tra `profileVerified: true`.
  - Test scoped sibling auto-reject trong `acceptQuote`.
  - Chạy `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

---

## 6. Ghi chú triển khai Phase A (Claude implement, 2026-10-12)

- **B10 đặt ở `createQuote` (service), không ở action** — để mọi đường tạo quote đều được kiểm tra. `PricingBreakdown` không lưu `printMinutes` nên suy ngược từ `machineDepreciationVnd`/`electricityCostVnd` + `pricing_configs` (`derivePrintMinutesFromBreakdown`), lệch > ±15% (sàn 3 phút) → `QUOTE_SNAPSHOT_MISMATCH` 422. Giá sửa tay → audit `MANUAL_PRICE_OVERRIDE` (không chặn).
- **B9:** `z.preprocess` gắn `schemaVersion: 1` cho row cũ + `z.discriminatedUnion` → lỗi v2 báo đúng field (`profileVerified`). Không dùng `.default(2)` vì sẽ biến snapshot v1 cũ thành v2 thiếu field.
- **`readQuoteModelSnapshot`:** row cũ có ảnh ở host ngoài allowlist → chỉ bỏ ảnh (placeholder), không bỏ cả snapshot.
- **`sourceUrl` của snapshot = link model + `#profileId-<profile đã chọn>`** (không phải hash trong link dán) → auto-reject B8 gom đúng các tier của cùng 1 profile.
- **Stale `#profileId`:** resolver không còn throw; trả danh sách + `requestedProfileMissing: true`, `activeProfileId: null`.
- **Tier labor:** chọn tier → thời gian thao tác mặc định = `ASSEMBLY_TIERS[tier].laborMinutes` (tổng công, thay cho `plates × 15`); staff vẫn sửa được. Bản ráp sẵn có dòng "Keo/vật tư hoàn thiện" tuỳ chọn (chọn vật liệu + gram).
- **Log đo lường:** `[MAKERWORLD_RESOLVER] { outcome }` ở route admin — dùng để quyết định Phase B.
- **Đã xác minh payload thật (model 3246150, 2026-10-12):** dữ liệu ở `props.pageProps.design` (Phase 13 giả định sai `designDetail`), `#profileId` = `instances[].id`, `prediction` tính bằng giây, ảnh ở `makerworld.bblmw.com`, license mặc định "Standard Digital File License" (cấm in để bán). Chi tiết: ADR-0031.
- **Review độc lập (subagent) — đã sửa:** deadlock khi accept 2 tier cùng lúc (khoá `custom_requests` trước), chặn accept sibling sau khi 1 tier đã ACCEPTED, B10 thêm kiểm tra gram, profile thiếu số liệu (`dataIncomplete`) không được tính giá, allowlist ảnh chỉ còn host chính xác (bỏ `*.bambulab.com`/`*.makerworld.com` vì forum/wiki chứa ảnh người dùng upload), parser hiểu "1,170 g", license không cho thương mại → bắt buộc `licenseAcknowledged` (ADR-0032).
- **E2E:** `e2e/makerworld-quote.spec.ts` (mock route resolver) + sửa `e2e/pricing.spec.ts` chọn tab "Công cụ tính giá" (B7 đổi tool mặc định). Chưa chạy được trong môi trường của Claude (cần Supabase local).
- **Edge case thực tế:** model 3246150 có profile phụ "bolts" (1 plate, 1g) — mẫu hoàn chỉnh có thể cần in thêm profile phụ; staff tự cộng hoặc tạo dòng riêng.
- **Chưa làm (follow-up):** upload screenshot lên Supabase cho Quick-Form (cần bucket public → migration, ngoài phạm vi "zero migration"); B6 phần Storefront (auto `ip_risk_flag`) thuộc Phase B.
