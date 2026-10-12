# Phase B — Báo giá MakerWorld trên Storefront dựa trên phân tích giá của Admin

**Status:** draft 2026-10-12 (Claude). Kế thừa `makerworld-profile-verification-and-instant-quote.md` (Phase A đã xong: resolver đa profile, card xác nhận, tier ASSEMBLED/KIT, snapshot v2, B1–B11, ADR-0030..0032) và `makerworld-phase-a-release-plan.md`.
**Ưu tiên:** gấp. Plan chia 2 đợt release để đợt 1 lên nhanh nhưng không hy sinh độ chính xác giá.

---

## 0. Vấn đề cần giải quyết

Khách ở `/custom-print` dán link MakerWorld → thấy **giá tham khảo đáng tin** cho bản Ráp sẵn và bản Kit → gửi yêu cầu → staff báo giá chính thức trong admin.

"Đáng tin" nghĩa là: **cùng một công thức, cùng dữ liệu, ra cùng con số với panel admin** (`computePricingBreakdown`, `pricing_configs` hiện hành, giá vật liệu thật, hao phí theo AMS, công theo tier, làm tròn ADR-0010). Không có con số đoán.

### Code prototype hiện có (chưa commit) — KHÔNG đưa lên Production

`src/app/api/public/makerworld-estimate/route.ts` + `src/components/storefront/makerworld-intake-card.tsx` (tạo 2026-10-12 13:40–13:57, không qua plan):

| Vấn đề | Vi phạm |
|---|---|
| Không đọc dữ liệu MakerWorld: model 3246150 luôn = 170g/450', mọi model khác = 150g/360' | Giá bịa cho khách — trái mục tiêu "chuẩn" |
| Nhận `weightGrams`/`printMinutes` từ client | B1 — cho phép suy ngược đơn giá/margin |
| Công cứng 45'/20', hao phí cứng 5%, giá nhựa fallback 220đ/g | Lệch với admin (`ASSEMBLY_TIERS` 50'/20', hao phí theo AMS, vật liệu thật) |
| Kiểm tra URL bằng `includes()` | Lọt `evil.com/makerworld.com/en/models/1` |
| Không rate limit | B5 |
| Ô bản quyền `useState(true)` (tick sẵn) | Phase 29: khách phải tự tick |
| 503 khi DB chưa có `pricing_configs` (lỗi bạn gặp) | Đúng hành vi, nhưng UI phải nói rõ & vẫn cho gửi yêu cầu |

**Quyết định:** giữ phần giao diện (bố cục, copy) của `MakerWorldIntakeCard`, **viết lại toàn bộ logic + endpoint** theo plan này. Thay đổi `src/app/layout.tsx` (VisualAiInspector) và `next.config.mjs` (xoá comment) nằm ngoài phạm vi — tách riêng hoặc revert.

---

## 1. Kiến trúc — 3 tầng nguồn giá (theo thứ tự ưu tiên)

```
Khách dán link ──► parseMakerWorldUrl (allowlist chặt, Phase 13)
                     │
      ┌──────────────┼───────────────────────────────┐
      ▼              ▼                               ▼
 Tầng 1: GIÁ ĐÃ DUYỆT   Tầng 2: ƯỚC TÍNH TỰ ĐỘNG        Tầng 3: KHÔNG CÓ GIÁ
 (admin đã phân tích)   (resolver + cùng engine)        (chặn / thiếu số liệu)
 nhãn "Giá BaSa3D"      nhãn "Giá ước tính"             "BaSa3D sẽ báo giá trong X giờ"
      └──────────────┴───────────────┬───────────────┘
                                     ▼
                    Khách chọn profile + tier, tự tick bản quyền
                                     ▼
                    POST /api/public/custom-requests (kèm makerworld snapshot)
                                     ▼
                    Admin: panel MakerWorld điền sẵn link/profile/tier → báo giá chính thức
                                     ▼
                    (tuỳ chọn) "Lưu làm giá Storefront" ──► Tầng 1 cho khách sau
```

### Tầng 1 — Giá đã duyệt (nguồn chính, "dựa vào admin phân tích giá")
- Khi staff đã phân tích 1 profile trong panel admin (Phase A) và bấm **"Lưu làm giá Storefront"**, hệ thống lưu **đầu vào tính giá** (không chỉ con số): profile snapshot, từng dòng vật liệu (materialId + loại nhựa + gram đã gồm hao phí), phút in, phút công theo tier, dòng keo/vật tư, `pricing_config_id`.
- Khi khách tra cứu: tính lại bằng `computePricingBreakdown` với **pricing_config hiện hành + giá vật liệu hiện hành** → giá luôn cập nhật khi xưởng đổi cấu hình/giá nhựa, nhưng vẫn đúng các lựa chọn kỹ thuật staff đã duyệt (vật liệu, hao phí, công).
- Không phụ thuộc Cloudflare: chỉ đọc DB → luôn chạy được trên Vercel.
- Khách thấy danh sách **chỉ các profile đã duyệt** của model (card ảnh/tên lấy từ snapshot đã lưu). Profile khác → Tầng 2/3.

### Tầng 2 — Ước tính tự động (bật bằng cờ, mặc định TẮT)
- Server gọi resolver (Phase A, đã có SSRF guard/deadline/size cap) → profile thật → **cùng hàm tính giá dùng chung** (mục 2) với giá vật liệu = **trung vị đơn giá/gram các vật liệu active cùng loại**.
- Chỉ bật khi log `[MAKERWORLD_RESOLVER]` trên Production cho thấy tỷ lệ OK đủ cao (release plan Phase A, O5). Cờ: `MAKERWORLD_PUBLIC_RESOLVER_ENABLED=true`.
- Kết quả resolver được cache theo `modelId` 24h (bảng cache) → mỗi model gọi MakerWorld tối đa 1 lần/ngày.
- Không có giá nếu: profile `dataIncomplete`, `amsRequired === null` với nhiều màu, hoặc không có vật liệu active cùng loại.

### Tầng 3 — Không có giá
- MakerWorld chặn, link không thuộc Tầng 1, chưa có `pricing_configs`, thiếu số liệu → hiển thị thẻ profile (nếu có) + nút **Gửi yêu cầu báo giá**. Không bao giờ hiện giá đoán.

---

## 2. Hàm tính giá dùng chung (bảo đảm admin = storefront)

Tách logic tính giá ra khỏi `makerworld-quote-panel.tsx` thành hàm thuần dùng chung client/server:

```ts
// src/lib/pricing/makerworld-pricing.ts  (pure, không DB)
export type MakerWorldPricingLine = { label: string; materialType: string; netGrams: number; unitCostVndPerGram: number; wastePct: number };
export function buildMakerWorldPricingInput(input: {
  profile: Pick<MakerWorldProfileItem, 'printTimeMinutes' | 'platesCount' | 'filaments' | 'amsRequired'>;
  tier: AssemblyTier;
  unitCostFor: (filamentIndex: number) => number | null;   // admin: cuộn staff chọn; storefront: trung vị theo loại
  wastePctOverride?: (filamentIndex: number) => number | undefined;
  consumable?: { grams: number; unitCostVndPerGram: number } | null;
  laborMinutesOverride?: number;
}): PricingInput | null;   // null = không đủ dữ liệu → Tầng 3
```

- Hao phí mặc định: `defaultWasteRatioPctForProfile(colorsCount, amsRequired)`.
- Công: `ASSEMBLY_TIERS[tier].laborMinutes`.
- Admin panel chuyển sang gọi hàm này (không đổi hành vi — test so khớp số trước/sau).
- Test chốt: cùng profile + cùng giá vật liệu + cùng config ⇒ admin và storefront ra **cùng `finalPriceVnd`**.

`unitCostFor` phía server (Tầng 2): `medianUnitCostByMaterialType(materials)` — vật liệu active, `resolveMaterialUnitCostVndPerGram > 0`; không có ⇒ `null` ⇒ không báo giá (không dùng 220đ cứng).

---

## 3. API công khai (thay prototype)

`POST /api/public/makerworld-estimate`

- **Input** (`.strict()`): `{ url: string }` — **duy nhất**. Không nhận gram/phút/vật liệu từ client.
- Validate bằng `parseMakerWorldUrl` (https, đúng host, `/models/<id>`), không dùng `includes()`.
- **Output DTO** (không có breakdown, config id, đơn giá/gram, margin):
  ```ts
  type PublicMakerWorldEstimate = {
    modelId: string;
    modelTitle: string | null;
    source: 'VERIFIED' | 'AUTO' | 'NONE';
    license: string | null;
    profiles: {
      profileId: string; profileTitle: string; imageUrl: string | null; printerTarget: string | null;
      printMinutes: number; platesCount: number; netWeightGrams: number; amsRequired: boolean | null;
      prices: { ASSEMBLED: number | null; KIT: number | null };   // VERIFIED: đúng số engine; AUTO: làm tròn 5.000đ
    }[];
    selectedProfileId: string | null;   // từ #profileId nếu có trong danh sách
    reason: 'OK' | 'BLOCKED' | 'NO_PRICING_CONFIG' | 'INCOMPLETE' | 'NOT_VERIFIED' | 'DISABLED';
  };
  ```
- Không có `pricing_configs` ⇒ **200** với `source: 'NONE', reason: 'NO_PRICING_CONFIG'` (thay vì 503) — UI vẫn cho gửi yêu cầu; log cảnh báo cho staff.
- **Chống lạm dụng** (thay B5 — không dùng DB rate limiter trên đường này):
  - Vercel Firewall rule: `/api/public/makerworld-estimate` tối đa 20 req/phút/IP (cấu hình dashboard, không code). Ghi vào `docs/operations/deployment.md`.
  - Tầng 2 chỉ chạy khi cờ bật **và** cache miss; thêm ngân sách toàn cục: tối đa N lần gọi MakerWorld/giờ (đếm trong bảng cache, chỉ ghi khi cache miss → không thành DoS DB).
  - Giá Tầng 2 làm tròn 5.000đ + chỉ từ link MakerWorld (khách không điều khiển được input số) ⇒ không giải được hệ phương trình margin.

---

## 4. Gửi yêu cầu (intake)

Dùng lại `POST /api/public/custom-requests` (đã có honeypot + rate limit theo SĐT 3 lần/10 phút).

- Mở rộng `publicCustomRequestInputSchema` với `makerworld` tuỳ chọn:
  ```ts
  makerworld: z.object({
    sourceUrl: makerWorldSourceUrlSchema,          // refine parseMakerWorldUrl
    profileId: z.string().regex(/^\d{1,20}$/).nullable(),
    tier: z.enum(['ASSEMBLED', 'KIT']),
    profileConfirmed: z.literal(true),             // khách tick "Đúng profile tôi muốn in"
  }).strict().optional()
  ```
  **Không** nhận giá từ client. Server tự tính lại giá tham khảo tại thời điểm gửi và lưu kèm (để staff thấy khách đã được báo con số nào).
- `copyrightConfirmed: z.literal(true)` giữ nguyên — **bỏ tick sẵn** ở UI.
- Lưu vào cột mới `custom_requests.makerworld_snapshot jsonb` (migration, mục 6): `{ sourceUrl, modelId, profileId, profileTitle, tier, estimateSource, estimatedPriceVnd, pricingConfigId, estimatedAt }`.
- `description` tự sinh nếu khách để trống: `"[MakerWorld] <modelTitle> — <profileTitle> — <tier>"`.
- **B6 cập nhật theo quyết định Owner 2026-10-12:** không tự gắn `ip_risk_flag` cho mọi link MakerWorld (xưởng nhận in giúp cá nhân, phi thương mại; căn cứ license được ghi trên snapshot báo giá — ADR-0032). Cờ keyword Phase 29 vẫn chạy như cũ.

### Phía admin
- Trang custom request: hiện khối "Yêu cầu từ MakerWorld" (link, profile, tier, giá tham khảo đã báo khách, nguồn VERIFIED/AUTO).
- Panel MakerWorld (Phase A) nhận `initialUrl`/`initialProfileId`/`initialTier` từ snapshot → staff bấm 1 lần là có dữ liệu.
- Nếu báo giá chính thức lệch > 10% so với giá tham khảo đã báo khách → cảnh báo vàng trong panel (không chặn).

---

## 5. Thư viện giá đã duyệt (Tầng 1) — phía admin

- Trong `ProfilePricing` (panel Phase A), sau khi tính giá: nút **"Lưu làm giá Storefront cho profile này"** (lưu cho tier đang chọn; muốn cả 2 tier thì chọn tier kia rồi lưu tiếp).
- Server action `saveMakerWorldPricePresetAction` (`requireAdmin`, STAFF/OWNER), validate Zod, upsert theo `(model_id, profile_id, tier)`, audit `MAKERWORLD_PRICE_PRESET_SAVED`.
- Chỉ lưu được khi: snapshot v2 hợp lệ, `profileVerified`, `dataSource = 'RESOLVER'` **hoặc** MANUAL (cho phép — staff nhập tay từ trang MakerWorld là nguồn duy nhất khi Vercel bị chặn), mọi màu đã chọn vật liệu.
- Trang `/admin/settings/makerworld-prices`: danh sách (model, profile, tier, giá hiện tính lại, người lưu, ngày), bật/tắt `is_active`. OWNER mới được xoá/tắt.

---

## 6. Migration (1 file, đợt 1)

`supabase/migrations/2026101300000x_makerworld_storefront.sql`:

```sql
create table makerworld_price_presets (
  id uuid primary key default gen_random_uuid(),
  model_id text not null check (model_id ~ '^\d{1,20}$'),
  profile_id text not null check (profile_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  tier text not null check (tier in ('ASSEMBLED','KIT')),
  profile_snapshot jsonb not null,          -- title, image (allowlisted), printer, minutes, plates, grams, ams, license
  material_lines jsonb not null,            -- [{materialId, materialType, grams (đã gồm hao phí), label}]
  print_minutes integer not null check (print_minutes > 0),
  labor_minutes integer not null check (labor_minutes >= 0),
  pricing_config_id uuid not null references pricing_configs(id),
  final_price_vnd_at_save bigint not null check (final_price_vnd_at_save >= 0),
  is_active boolean not null default true,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index makerworld_price_presets_active_uq on makerworld_price_presets (model_id, profile_id, tier) where is_active;
alter table makerworld_price_presets enable row level security;

create table makerworld_resolver_cache (
  model_id text primary key check (model_id ~ '^\d{1,20}$'),
  resolution jsonb,                         -- MakerWorldResolution đã chuẩn hoá (KHÔNG lưu HTML thô)
  outcome text not null,                    -- OK | BLOCKED_OR_TIMEOUT | NOT_FOUND | PROFILE_NOT_FOUND
  fetched_at timestamptz not null default now()
);
alter table makerworld_resolver_cache enable row level security;

alter table custom_requests add column makerworld_snapshot jsonb;
```
- RLS bật ngay (theo `20261012000000_enable_rls_public_tables.sql`; `tests/rls-public-tables.test.ts` sẽ fail nếu quên).
- Thứ tự áp dụng: migration RLS 20261012 phải chạy **trước** (Dev rồi Prod).

---

## 7. Giao diện Storefront (`MakerWorldIntakeCard` viết lại logic)

1. Ô dán link → gọi API → trạng thái `loading` (≤ 7s, có nút huỷ).
2. Kết quả:
   - **VERIFIED:** chip "Giá BaSa3D đã kiểm tra"; danh sách profile đã duyệt (card ảnh/tên/máy/giờ/plate/gram/NO AMS — dùng lại `ProfileVerificationCard`); mỗi profile 2 giá Ráp sẵn / Kit.
   - **AUTO:** chip "Giá ước tính tự động" + câu "giá chính thức do BaSa3D xác nhận"; giá dạng "khoảng 155.000đ".
   - **NONE:** card profile nếu có, thông điệp theo `reason` (vd BLOCKED: "Chưa đọc được dữ liệu tự động — BaSa3D sẽ báo giá trong X giờ").
3. Khách chọn profile (nếu > 1 thì **không** chọn sẵn, trừ khi link có `#profileId`), chọn tier, tick **"Đúng profile tôi muốn in"** (bắt buộc), nhập tên/SĐT/số lượng/ghi chú, tick bản quyền (**không tick sẵn**).
4. Gửi → hiển thị mã yêu cầu `CR-…`.
5. Số lượng > 1: hiển thị "giá/1 sản phẩm"; không nhân tổng (in số lượng có thể ghép plate — staff báo giá chính thức).

---

## 8. Kế hoạch triển khai (vertical slices)

### Đợt 1 — lên nhanh, giá chuẩn (ước tính 1,5–2 ngày làm việc)
| Slice | Nội dung | Tiêu chí xong |
|---|---|---|
| S1 | `makerworld-pricing.ts` dùng chung + admin panel chuyển sang gọi nó | Test "admin = storefront" pass; E2E Phase A vẫn pass; số liệu panel không đổi |
| S2 | Migration mục 6 + service `makerworld-price-preset.service.ts` (save/list/lookup + tính lại theo config hiện hành) + action + nút "Lưu làm giá Storefront" + trang settings | Test DB: lưu → tra cứu ra đúng giá; đổi config → giá tra cứu đổi theo; RLS test pass |
| S3 | Endpoint mới (Tầng 1 + Tầng 3, Tầng 2 sau cờ TẮT) + DTO + Vercel Firewall rule | Test: input chỉ `{url}`; URL giả mạo bị chặn; DTO không chứa field chi phí; không config ⇒ 200 `NO_PRICING_CONFIG` |
| S4 | `MakerWorldIntakeCard` viết lại logic + mở rộng `publicCustomRequestInputSchema` + lưu `makerworld_snapshot` + khối hiển thị & điền sẵn phía admin | E2E: khách dán link đã duyệt → thấy đúng giá admin → gửi → admin thấy snapshot, panel điền sẵn |
| S5 | Gỡ prototype (route cũ), revert `layout.tsx`/`next.config.mjs` nếu không chủ đích, docs + ADR-0033 | `npm run typecheck/lint/test/build` pass; release plan cập nhật |

### Đợt 2 — sau khi có số liệu Cloudflare
- Bật Tầng 2 (`MAKERWORLD_PUBLIC_RESOLVER_ENABLED`) nếu tỷ lệ OK ≥ ~70% trong 2 tuần; cache 24h + ngân sách gọi/giờ.
- Cảnh báo lệch giá > 10% trong panel admin.

### Việc làm ngay trước Đợt 1 (bạn)
- [ ] Tạo `pricing_configs` hiện hành trên Dev (`/admin/settings/pricing`) — nguyên nhân 503 hiện tại.
- [ ] Chạy migration RLS 20261012 trên Dev → kiểm tra → Prod.
- [ ] Chọn 5–10 model MakerWorld hay được hỏi nhất → staff phân tích trong admin → "Lưu làm giá Storefront" ngay khi S2 xong ⇒ ngày ra mắt đã có Tầng 1 cho các mẫu phổ biến.

---

## 9. Tests bắt buộc

- Unit: `buildMakerWorldPricingInput` (AMS/No-AMS, tier, thiếu vật liệu ⇒ null); trung vị đơn giá; DTO allowlist.
- Parity: admin vs storefront cùng input ⇒ cùng `finalPriceVnd` (ADR-0010).
- DB: preset save/upsert/unique theo tier; tra cứu tính lại theo config mới; vật liệu đã inactive ⇒ dùng trung vị cùng loại (hoặc không báo giá nếu không có); intake lưu `makerworld_snapshot`, từ chối giá do client gửi; RLS.
- Route: `{url, weightGrams}` ⇒ 400 (strict); `evil.com/makerworld.com/en/models/1` ⇒ 400; không config ⇒ 200 `NO_PRICING_CONFIG`.
- E2E: `e2e/makerworld-storefront.spec.ts` (VERIFIED flow + NONE flow), bản quyền không tick sẵn.

## 10. Quyết định cần Owner xác nhận (đề xuất mặc định)

| # | Câu hỏi | Mặc định đề xuất |
|---|---|---|
| D1 | Khách thấy giá chính xác (VERIFIED) hay làm tròn? | Chính xác — đây là giá xưởng đã duyệt |
| D2 | Ai được "Lưu làm giá Storefront"? | STAFF + OWNER; chỉ OWNER tắt/xoá |
| D3 | Giá preset tự cập nhật theo config/giá nhựa mới? | Có (tính lại khi tra cứu) |
| D4 | Bật Tầng 2 (ước tính tự động) ngay đợt 1? | Không — chờ số liệu Cloudflare |
| D5 | Thời gian cam kết phản hồi hiển thị cho khách (Tầng 3) | "trong 2 giờ làm việc" |
