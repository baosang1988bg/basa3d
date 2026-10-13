# Phase 33 — Trang Báo giá `/bao-gia`: báo giá tức thì nhiều file, 1 món = 1 Quote, VAT bật/tắt

Trạng thái: **Đã qua Gemini Challenge + Claude Final Review (2026-10-13)** — S0, S1, S2 sẵn sàng giao
Codex (xem §13 "Trước khi giao Codex" và §14 "Nhật ký cập nhật"). S3+ chờ O3/O6.
Kế thừa: ADR-0007, ADR-0010, ADR-0022, ADR-0023, ADR-0032, ADR-0034;
`docs/research/instant-quote-research.md` §1, §6, §9 (khảo sát in3dtudonghoa.com 2026-10-12).

> Chỉ học **luồng/ý tưởng** của đối thủ. Không sao chép mã, câu chữ (kể cả FAQ), hình ảnh hay nhận
> diện thương hiệu của họ.

---

## 1. Phase brief

- **Goal**: Khách vào `/bao-gia`, kéo thả 1–10 file STL/OBJ/3MF → thấy kích thước, xem 3D, chỉnh
  scale/vật liệu/infill/số lượng → thấy **một giá ước tính cho từng món** trong < 1 giây sau mỗi thay
  đổi (không upload file) → in bảng ước tính → để lại liên hệ → file upload thẳng lên Supabase
  Storage → tạo 1 `custom_request` gồm N món → staff tạo **N Quote (1 món = 1 Quote)**.
- **Non-goals** (phase này):
  - Thanh toán / đặt cọc / VietQR ở luồng `/bao-gia` (D4).
  - Voucher, phí ship, chiết khấu theo số lượng, Resin, Thiết kế 3D, Cúp/Tượng (chưa có quy tắc
    kinh doanh — `AGENTS.md`: không tự đặt ra).
  - Slicer chạy trên server (Lớp 2 của research §6.3).
  - Đổi giao diện `/custom-print` (chỉ đổi đường upload phía sau, xem S2).
  - VAT cho `orders` (giỏ hàng đang ẩn) — schema chuẩn bị sẵn cột, kích hoạt sau.
- **Inputs**: file `.stl` / `.obj` / `.3mf` (đã slice hoặc chưa) ≤ `MAX_UPLOAD_BYTES` (50MB khi
  Supabase Free).
- **Outputs**: route `/bao-gia` (vi + en); bảng `custom_request_items`; `quotes.custom_request_item_id`;
  VAT bật/tắt trong `pricing_configs` + snapshot VAT trên `quotes` & `orders`; endpoint ước tính theo metrics;
  endpoint cấp signed upload URL; màn hình admin danh sách món + tạo Quote theo món; bản in ước tính.
- **Risks**: §11.
- **Definition of Done**: §9.

## 2. Quyết định Owner đã chốt (2026-10-13)

| # | Quyết định |
|---|---|
| D1 | UI nằm ở **trang mới `/bao-gia`** (storefront, `[locale]`). `/custom-print` giữ nguyên giao diện; hai trang dùng chung service/API phía sau. |
| D2 | **1 món (file + cấu hình + số lượng) = 1 Quote** bất biến riêng. Khách nhận N link `/quotes/[quoteNumber]`, chấp nhận từng món độc lập. |
| D3 | **Chưa áp dụng VAT**, nhưng phải **bật/tắt được** (và đổi được thuế suất) mà không cần deploy code — để khi bắt đầu kê khai thuế chỉ cần bật. |
| D4 | **Chưa áp dụng cọc** ở luồng `/bao-gia`. Bước cuối chỉ là "Đã nhận yêu cầu `CR-…`" + Zalo. |
| D5 | (Từ review) Khách **không bao giờ gửi giá**; giá ràng buộc duy nhất là Quote do staff tạo (ADR-0022). |

## 3. Quyết định kỹ thuật (Đã cập nhật sau Gemini Challenge)

| # | Quyết định | Lý do | Phương án thay thế bị loại |
|---|---|---|---|
| T1 | Phân tích file **trên trình duyệt trong Web Worker**; chỉ gửi `metrics` (vài trăm byte) lên server để tính giá | Không chạm 4,5MB Vercel, không tốn băng thông/RAM server, < 1s | Upload rồi tính trên server (hiện tại): chậm, lỗi 413 trên Production |
| T2 | Một module hình học **thuần, dùng chung client + server**: `src/lib/pricing/mesh-metrics.ts` (thể tích, diện tích bề mặt, bbox, số tam giác). Gộp 2 bản trùng ở `mesh-volume.ts` và `mesh-estimator.ts` | Server kiểm tra lại cho **cùng con số** với client | Giữ 2 thuật toán: lệch số → cờ MISMATCH giả |
| T3 | Công thức gram + **thời gian in** thuần trong `src/lib/pricing/fdm-estimate-model.ts`, hằng số trong code, có **giá sàn tối thiểu `MIN_ITEM_PRICE_VND` (25.000đ) áp theo DÒNG (món × số lượng)**, không theo đơn vị | Khắc phục điểm yếu "chỉ tính gram" của đối thủ; chi phí cố định (setup/dọn bàn in) phát sinh theo lô, nên sàn theo dòng không đội giá đơn số lượng lớn | Cột mới trong `pricing_configs`: chỉ làm khi hằng số hay đổi; Không có giá sàn: rủi ro chi phí |
| T4 | Bảng con **`custom_request_items`** (thay cho ý `attachment_paths text[]` ở review). Yêu cầu từ `/bao-gia` để `custom_requests.attachment_path = NULL` | D2 cần Quote trỏ về đúng món bằng FK; không denormalize món #1 để tránh admin bỏ sót các món 2..N | Path trong JSONB: không ràng buộc; denormalize món #1: rủi ro sót đơn |
| T5 | `quotes.custom_request_item_id` + **FK kép** `(custom_request_item_id, custom_request_id)` → `custom_request_items(id, custom_request_id)` | DB tự chặn Quote trỏ tới món của yêu cầu khác | Kiểm tra trong service: lách được bằng SQL tay |
| T6 | `custom_request_items` **không UPDATE được**; DELETE chỉ được khi phiên DB đặt `basa3d.allow_item_purge = 'on'` (hàm trigger riêng `prevent_custom_request_item_mutation()`) | Snapshot lúc khách gửi phải bất biến (rule 4); vẫn có **một** đường xoá có chủ đích cho dọn dữ liệu E2E và yêu cầu xoá dữ liệu cá nhân sau này | Dùng `prevent_ledger_mutation` (chặn cả DELETE): E2E không dọn được, không xử lý được yêu cầu xoá dữ liệu |
| T7 | Upload: `POST /api/public/custom-requests/upload-urls` cấp theo lô (≤ 10 file) path ngẫu nhiên + token + `contentType`. **Token sống 2 giờ — cố định bởi Supabase** (`createSignedUploadUrl` chỉ nhận `{ upsert }`). Chống kho rác bằng: rate limit cấp URL theo IP, giới hạn bucket, magic bytes khi submit, cron dọn file mồ côi | Vượt 4,5MB, path do server quyết định, bucket vẫn private | Upload qua function: lỗi 413; bảng `upload_intents` để tự khoá 15 phút: thêm bảng, chưa cần |
| T8 | Khi submit: server kiểm tra object thật và tính lại trong ngân sách `VERIFY_BUDGET_BYTES` (20MB). Ngoài ngân sách → `CLIENT_REPORTED`. **Admin khoá pre-fill cho món `CLIENT_REPORTED`/`UNPRICED`**; nút **kiểm tra lại theo yêu cầu** (từng file, giới hạn `REVERIFY_MAX_BYTES`), kết quả **không ghi vào món** (bảng bất biến) mà ghi `audit_logs` + chỉ dùng để pre-fill form Quote | Không vượt RAM function; chặn neo tâm lý (staff anchoring) | Tính lại mọi file: timeout/OOM; ghi kết quả vào món: mâu thuẫn T6; bảng `custom_request_item_verifications`: chỉ làm khi cần thống kê |
| T9 | **VAT là cấu hình có phiên bản** trong `pricing_configs` (`vat_enabled`, `vat_rate_bps`). Quote & Order **snapshot** VAT. **Check constraint linh hoạt**: chỉ kiểm tổng + "không có tiền VAT khi thuế suất = 0" | Bật/tắt không cần deploy; không hardcode công thức thuế vào DB | Env var: phải redeploy; Check constraint cứng theo công thức: bẫy khi chính sách phí đổi |
| T10 | Thuế suất lưu **basis points nguyên** (`800` = 8%), không `numeric` | Tiền/thuế là số nguyên; tránh bẫy `numeric` → string (ADR-0023) | `numeric(5,2)`: phải nhớ ép kiểu |
| T11 | VAT tính **theo từng Quote**; bảng ước tính tính VAT từng món rồi cộng | Tổng ước tính = tổng N Quote (D2), không lệch do làm tròn | VAT trên tổng: lệch 1–2đ so với tổng N Quote |
| T12 | Xem 3D bằng `three` (đã có) + `STLLoader`/`OBJLoader`/`3MFLoader` từ `three/examples/jsm`; đọc `slice_info` bằng `fflate` (đã có). **Không thêm dependency** | Rule 8 | `unzipit`, `@react-three/fiber`: chưa cần |
| T13 | Bản in ước tính = HTML + `@media print` + `window.print()` phía client | Tiếng Việt chuẩn bằng font trình duyệt, không thêm thư viện | Puppeteer/`@react-pdf` trên server: nặng, phải nhúng font |
| T14 | Đổi **đường upload** của `/custom-print` sang T7 (UI không đổi), gỡ `/api/public/custom-requests/attachments` | Lỗi 413 hiện tại là blocker Production (research §1) | Giữ route cũ: `/custom-print` hỏng với file > 4,5MB |

## 4. Schema dự kiến (để `database-review` duyệt)

**Hai migration riêng** để S1 và S2 release độc lập.

### 4A — `supabase/migrations/2026101xxxxxxx_vat_versioned.sql` (S1)

```sql
-- 4.1 VAT có phiên bản (D3, T9, T10). Mặc định TẮT → hành vi hiện tại không đổi.
alter table pricing_configs
  add column vat_enabled boolean not null default false,
  add column vat_rate_bps integer not null default 0 check (vat_rate_bps between 0 and 10000),
  add constraint pricing_configs_vat_rate_when_enabled check (not vat_enabled or vat_rate_bps > 0);

-- 4.2 Snapshot VAT trên Quote. Quote cũ: 0/0 → thoả check mới.
alter table quotes
  add column vat_rate_bps integer not null default 0 check (vat_rate_bps between 0 and 10000),
  add column vat_amount bigint not null default 0 check (vat_amount >= 0);

-- Drop check tổng cũ CÓ KIỂM TRA: nếu không tìm thấy đúng 1 constraint thì migration lỗi to,
-- không âm thầm để lại check cũ (tên tự sinh dự kiến: quotes_total_check).
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'quotes'::regclass and conname = 'quotes_total_check') then
    raise exception 'quotes_total_check not found — inspect \d quotes before migrating';
  end if;
  alter table quotes drop constraint quotes_total_check;
end $$;
-- Ràng buộc linh hoạt (Gemini Q3): không hardcode công thức thuế; chỉ kiểm tổng + không có tiền
-- VAT khi thuế suất = 0. Công thức (cơ sở tính, làm tròn) nằm ở src/lib/pricing/vat.ts.
alter table quotes add constraint quotes_total_with_vat check (
  total >= 0
  and total = subtotal + shipping_fee - discount + vat_amount
  and (vat_rate_bps > 0 or vat_amount = 0)
);

-- 4.2b Orders: cùng cột + SỬA check tổng (nếu chỉ thêm cột, vat_amount > 0 sẽ không nằm trong total
-- mà DB vẫn chấp nhận). Đơn cũ: 0/0 → thoả. Chưa có code nào ghi VAT cho orders trong phase này.
alter table orders
  add column vat_rate_bps integer not null default 0 check (vat_rate_bps between 0 and 10000),
  add column vat_amount bigint not null default 0 check (vat_amount >= 0);
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'orders'::regclass and conname = 'orders_total_check') then
    raise exception 'orders_total_check not found — inspect \d orders before migrating';
  end if;
  alter table orders drop constraint orders_total_check;
end $$;
alter table orders add constraint orders_total_with_vat check (
  total >= 0
  and total = subtotal + shipping_fee + cod_fee - discount + vat_amount
  and (vat_rate_bps > 0 or vat_amount = 0)
);
```

### 4B — `supabase/migrations/2026101yyyyyyy_custom_request_items.sql` (S2)

```sql
-- 4.3 Món trong một yêu cầu (D2, T4, T6)
create table custom_request_items (
  id uuid primary key default gen_random_uuid(),
  custom_request_id uuid not null references custom_requests(id) on delete restrict,
  position smallint not null check (position between 1 and 10),
  attachment_path text not null unique check (attachment_path ~ '^requests/[0-9a-f-]+\.(stl|obj|3mf)$'),
  display_name varchar(200) not null check (btrim(display_name) <> ''),   -- tên file gốc, chỉ hiển thị
  file_size_bytes bigint not null check (file_size_bytes > 0),
  source_kind varchar(10) not null check (source_kind in ('MESH', 'SLICED')),
  material_type varchar(20) not null,
  infill_pct smallint check (infill_pct in (10, 15, 20, 30, 50, 100)),    -- null khi SLICED
  scale_permille integer not null default 1000 check (scale_permille between 100 and 10000),
  color varchar(100),
  quantity integer not null check (quantity between 1 and 1000),
  verification varchar(20) not null check (verification in ('VERIFIED', 'CLIENT_REPORTED', 'MISMATCH', 'UNPRICED')),
  estimate_snapshot jsonb not null check (jsonb_typeof(estimate_snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (custom_request_id, position),
  unique (id, custom_request_id),                                          -- đích của FK kép
  check (source_kind = 'MESH' or (infill_pct is null and scale_permille = 1000))
);
create index custom_request_items_request_idx on custom_request_items(custom_request_id, position);

-- T6: UPDATE luôn bị chặn; DELETE chỉ khi phiên đặt `set local basa3d.allow_item_purge = 'on'`
-- (dọn E2E, xoá dữ liệu cá nhân có audit sau này). Code ứng dụng thường KHÔNG bao giờ đặt cờ này.
create function prevent_custom_request_item_mutation() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('basa3d.allow_item_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'custom_request_items rows are immutable' using errcode = '55000';
end; $$;
create trigger custom_request_items_immutable before update or delete on custom_request_items
  for each row execute function prevent_custom_request_item_mutation();

-- 4.4 Quote theo món (T5). Nullable: Quote MakerWorld / thủ công không có món (FK MATCH SIMPLE
-- bỏ qua khi custom_request_item_id null).
alter table quotes add column custom_request_item_id uuid;
alter table quotes add constraint quotes_item_same_request
  foreign key (custom_request_item_id, custom_request_id)
  references custom_request_items(id, custom_request_id) on delete restrict;
create index quotes_custom_request_item_id_idx on quotes(custom_request_item_id);

-- 4.5 Giới hạn bucket (T7/T8). MIME do client khai → vẫn kiểm magic bytes khi submit.
-- Client PHẢI gửi đúng contentType server trả về (§6.2), vì supabase-js mặc định gửi
-- text/plain;charset=UTF-8 và Windows báo .stl là application/vnd.ms-pki.stl.
update storage.buckets
  set file_size_limit = 52428800,
      allowed_mime_types = array['model/stl','model/3mf','model/step','application/octet-stream','image/jpeg','image/png','image/webp']
  where id = 'custom-request-attachments';
```

Ghi chú:
- Yêu cầu từ `/bao-gia`: `custom_requests.attachment_path = NULL` (không denormalize món #1);
  `custom_requests.quantity` = tổng số lượng các món.
- Badge Admin `Đa món (N file)` dựa trên **số món thật**:
  `(select count(*) from custom_request_items i where i.custom_request_id = cr.id) as "itemCount"`,
  hiện khi `itemCount > 0` — **không** dựa vào `attachment_path IS NULL` (yêu cầu chỉ có mô tả hoặc
  link MakerWorld cũng NULL).
- `quote_estimate_snapshot` giữ cho luồng `/custom-print` cũ (không đổi).
- `description` bắt buộc → nếu khách bỏ trống, server tự ghép: `Báo giá từ /bao-gia: N file (…)`.
- Dọn dữ liệu E2E/integration: `begin; set local basa3d.allow_item_purge = 'on'; delete from quotes …;
  delete from custom_request_items …; delete from custom_requests …; commit;` — gom vào một helper test.
- VAT base = `subtotal + shipping_fee − discount` (trong `vat.ts`) → **chờ kế toán xác nhận (O2) trước
  khi BẬT VAT**; không chặn S1 vì mặc định tắt và DB không cứng hoá công thức.

### 4.6 `estimate_snapshot` (JSONB, Zod `customRequestItemEstimateSchema`)

```ts
{
  schemaVersion: 1,
  modelVersion: 'fdm-v1',            // phiên bản hằng số fdm-estimate-model.ts → hiệu chỉnh sau này
  sizeMm: { x, y, z },               // ĐÃ áp scale
  volumeCm3, surfaceCm2, triangles,  // ĐÃ áp scale (MESH); null khi SLICED
  grams, printMinutes, platesCount,
  unitPriceVnd, lineSubtotalVnd,     // trước VAT, làm tròn 5.000đ theo đơn vị
  vatRateBps, vatVnd, lineTotalVnd,
  pricingConfigId,
  clientMetrics?: {...},             // số liệu trình duyệt gửi, giữ lại khi MISMATCH/CLIENT_REPORTED
  mismatchPct?: number,
  estimatedAt
}
```

## 5. Công thức giá (`fdm-estimate-model.ts`, thuần, có unit test)

### 5.1 Khối lượng
```
s       = scale_permille / 1000
V = V0·s³,  A = A0·s²,  size = size0·s
t       = SHELL_THICKNESS_MM (≈ 0,9 — tường + đáy/nóc quy đổi; hiệu chỉnh ở S0)
Vshell  = min(V, A·t)
Vfill   = V − Vshell
Vsupp   = V · SUPPORT_FACTOR            (v1 cố định, ví dụ 0,10; v2: theo diện tích mặt nhô)
grams   = ρ[material] · (Vshell + Vfill·infill + Vsupp)
```
Kiểm tra nhanh với số liệu đối thủ (khối 40mm, A = 96cm², t = 0,9mm, không tính support):
PETG 10% → 1,27 × (8,64 + 55,36×0,10) = **18,0g** ✓; 15% → **21,52g** ✓; 30% → **32,06g** ✓; PLA 10% → 1,25 × 14,18 =
**17,72g** ✓. ⇒ đối thủ cộng 25% vào **giá** chứ không vào gram (cần sửa câu trong research §9).

### 5.2 Thời gian in
```
layers   = ceil(size.z / LAYER_HEIGHT_MM)                 (0,2)
Tflow    = Vshell/Q_WALL + Vfill·infill/Q_INFILL + Vsupp/Q_SUPPORT   (cm³/phút)
Tlayer   = layers · MIN_LAYER_SECONDS / 60
minutes  = T_SETUP + max(Tflow, Tlayer) + layers · LAYER_OVERHEAD_SECONDS / 60
minutes  = round(minutes · K_CALIB)
```
- `Tlayer` + `LAYER_OVERHEAD` là phần đối thủ thiếu: chi tiết cao, mảnh, ít nhựa vẫn ra nhiều giờ máy.
- Giá trị khởi điểm (**placeholder**, S0 phải fit lại): `Q_WALL 0,35`, `Q_INFILL 0,9`,
  `Q_SUPPORT 0,6`, `MIN_LAYER_SECONDS 8`, `LAYER_OVERHEAD_SECONDS 1,5`, `T_SETUP 6`, `K_CALIB 1`.
- Thay `estimatePrintMinutes(grams)` (12 + 1,8g) và `MESH_FILL_RANGE` (giá theo khoảng) cho đường
  MESH. Đường SLICED giữ nguyên (`estimateFromSliceInfo`).

### 5.3 Giá
- Mỗi món: `computePricingBreakdown` qua `priceMakerWorldLines` (như `estimateFromMesh`) với
  grams/minutes **của 1 đơn vị** → `unitPriceVnd = roundInstant(...)`;
  `lineSubtotalVnd = max(MIN_ITEM_PRICE_VND, unitPriceVnd × quantity)`.
- **Giá sàn tối thiểu (Floor Price)**: `MIN_ITEM_PRICE_VND = 25_000`đ (hằng số trong `fdm-estimate-model.ts`),
  áp **theo dòng** (món × số lượng), cho cả MESH lẫn SLICED, **chỉ cho giá ước tính** — staff vẫn tự đặt
  giá trên Quote. Lý do: chi phí cố định (setup, dọn bàn in) phát sinh theo lô; áp theo đơn vị sẽ làm
  100 móc khoá 3g thành 2,5 triệu. Khi sàn có tác dụng, UI hiện "giá tối thiểu cho mỗi món".
- Nhãn UI minh bạch: Hiển thị tiền kèm tiền tố `~` (ví dụ `~45.000đ`) và tooltip:
  *"Giá ước tính sơ bộ từ hình học. Xưởng xác nhận giá chính xác sau khi xem file."*
- VAT: `vatVnd = vat_enabled ? round(lineSubtotalVnd × vat_rate_bps / 10000) : 0` — **cùng một hàm**
  `computeVat(baseVnd, rateBps)` trong `src/lib/pricing/vat.ts`, dùng cho ước tính và `createQuote`.
- Giới hạn bàn in: `size` vượt `BUILD_VOLUME_MM` (256 × 256 × 256, P1S/P2S) → món `UNPRICED`,
  nhãn "Cần xưởng báo giá (vượt khổ máy / cần chia nhỏ)".
- Mesh nghi lỗi (V ≤ 0, V > thể tích bbox, A nhỏ hơn mức tối thiểu của V) → `UNPRICED`.

## 6. API contracts

### 6.1 `POST /api/public/quote-estimate` (mới — ước tính, không ghi DB)
- Body (Zod strict, ≤ 10 món):
  - MESH: `{ kind:'MESH', metrics:{ volumeMm3, surfaceMm2, sizeMm:{x,y,z}, triangles }, scalePermille, materialType, infillPct, quantity }`
  - SLICED: `{ kind:'SLICED', printMinutes, plates, filaments:[{ type, grams }] (≤16), materialType?, quantity }`
- Kiểm tra nhất quán: `V ≤ x·y·z`; `A ≥ (36π·V²)^(1/3)` (bất đẳng thức đẳng chu); size ≤ 2.000mm;
  triangles ≤ `MESH_MAX_TRIANGLES`; giới hạn SLICED dùng lại `SPEC_LIMITS`.
- Trả về: `{ items:[{ status, grams, printMinutes, sizeMm, unitPriceVnd, lineSubtotalVnd, vatVnd, lineTotalVnd }], totals:{ subtotalVnd, vatVnd, totalVnd }, vat:{ enabled, rateBps } }`.
  **Không** trả chi phí/margin (B1).
- Rate limit DB theo IP: 120 lần/giờ (client debounce 300ms). `cache-control: no-store`.
- Đánh đổi chấp nhận: khách có thể gửi metrics giả để xem giá thấp — cùng mức ADR-0034 (SPEC);
  không ảnh hưởng giá ràng buộc (D5).

### 6.2 `POST /api/public/custom-requests/upload-urls` (mới)
- Body: `{ files:[{ ext, sizeBytes }] }` (1–10). Đuôi hợp lệ = khoá của `CONTENT_TYPE_BY_EXTENSION` hiện
  có (ảnh + `stl/step/stp/obj/3mf`, vì `/custom-print` cũng dùng route này — T14); `sizeBytes ≤ MAX_UPLOAD_BYTES`.
- Trả: `{ uploads: [{ path: 'requests/<uuid>.<ext>', token, contentType }] }` (`createSignedUploadUrl(path)`,
  không upsert). **Token sống 2 giờ (cố định bởi Supabase, không cấu hình được).** `contentType` lấy từ
  `CONTENT_TYPE_BY_EXTENSION`; client **bắt buộc** truyền đúng giá trị này vào
  `uploadToSignedUrl(path, token, file, { contentType })`.
- Rate limit DB theo IP: 20 lần gọi/giờ (thay cho 10 file/giờ của route cũ).
- `sizeBytes` chỉ là khai báo — kích thước thật kiểm ở bước submit (§6.3) và bằng `file_size_limit` của bucket.

### 6.3 `POST /api/public/custom-requests` (sửa — thêm nhánh `items`)
- Thêm `items?: [{ attachmentPath, displayName, materialType, infillPct?, scalePermille, color?, quantity, clientMetrics }]`
  (1–10), loại trừ lẫn nhau với `attachmentPath`/`fileEstimateOption` cũ. **Không có field giá.**
- Server, theo thứ tự:
  1. Zod + honeypot + rate limit theo SĐT (giữ nguyên).
  2. Mỗi path: khớp regex, **không trùng**, object tồn tại, `size` thật ≤ giới hạn, magic bytes
     (`PK\x03\x04` cho 3mf; độ dài STL binary hoặc chữ `solid`; OBJ là text). Kiểm tra này
     (`inspectUploadedObject`, S2) cũng áp cho `attachmentPath` đơn của nhánh `/custom-print`.
  3. Tính lại trong ngân sách T8 → `VERIFIED` / `MISMATCH` (lệch thể tích > 2% → dùng số server) /
     `CLIENT_REPORTED` (vượt ngân sách → dùng số client, gắn cờ).
  4. Một transaction: insert `custom_requests` + N `custom_request_items` + audit log.
- Response giữ nguyên `{ id, requestNumber }`.

### 6.4 `createQuote` (sửa)
- Nhận thêm `customRequestItemId?`. **VAT do server tính** từ `pricing_configs` hiện hành, client
  không gửi `vatAmount`; `total` client gửi phải bằng `total` server tính, lệch → 400
  `QUOTE_TOTAL_MISMATCH`.
- Phương án anh em (ASSEMBLED/KIT của cùng một món .3mf nhiều plate): mở rộng khoá anh em trong
  `acceptQuote` = `coalesce(custom_request_item_id::text, model_snapshot->>'sourceUrl')` — chấp nhận
  1 phương án sẽ tự từ chối phương án còn lại **của cùng món**, không đụng món khác.
- (S7, nice-to-have) Quote theo món: kiểm tra nhất quán kiểu B10 — phút/gram của breakdown so với
  `estimate_snapshot` của món (±15%); lệch thì vẫn cho tạo nhưng audit `MANUAL_PRICE_OVERRIDE`.

### 6.5 Admin: kiểm tra lại một món (S7)
- Server action (STAFF/OWNER) `reverifyCustomRequestItem(itemId)`: tải **một** file, chỉ khi
  `file_size_bytes ≤ REVERIFY_MAX_BYTES` (mặc định 20MB), tính metrics + giá bằng cùng module.
- **Không ghi vào `custom_request_items`** (bảng bất biến, T6). Ghi `audit_logs`
  (`CUSTOM_REQUEST_ITEM_REVERIFIED`, `after_data` = metrics + giá + `pricingConfigId`) và trả kết quả để
  pre-fill form Quote. File vượt giới hạn → thông báo "Kiểm tra file thủ công".

## 7. UI `/bao-gia`

Route: `src/app/[locale]/(storefront)/bao-gia/page.tsx` (server component cho SEO) + các section:

1. **Hero** — cam kết minh bạch, "giá ước tính, xưởng xác nhận". Thời gian phản hồi: **chờ O4**,
   không tự hứa "30 phút".
2. **Giá tham khảo** — 3–4 ví dụ (móc khoá, hộp nhỏ, mô hình cao…) **tính trực tiếp bằng engine**
   từ metrics cố định trong `src/config/bao-gia-samples.ts` → không bao giờ lệch với giá thật.
   Không hiển thị "đ/gram" (BaSa3D tính cost-plus, không theo gram).
3. **Quote Flow** (client component, lazy) — stepper 4 bước, thanh tóm tắt dính bên phải
   (desktop) / dính đáy (mobile):
   - **B1 Tải mẫu**: kéo thả/nhiều file; Worker trả metrics; viewer 3D xoay/zoom; X/Y/Z; scale %
     hoặc nhập kích thước mm (uniform). File > `PREVIEW_MAX_TRIANGLES` (ví dụ 1,5M) hoặc mobile yếu
     → chỉ hiện kích thước, không dựng 3D. Mỗi lúc 1 viewer, `dispose()` khi đổi file, xử lý
     `webglcontextlost`.
   - **B2 Cấu hình**: vật liệu (chỉ loại có vật liệu active có giá), infill 10/15/20/30/50/100
     (mặc định 15), màu (ghi chú, không tính giá), số lượng. .3mf đã slice: khoá infill/scale, hiện
     "giá theo file đã slice".
   - **B3 Báo giá & Liên hệ**: bảng kê từng món (gram, giờ in, đơn giá, thành tiền), dòng VAT **chỉ
     hiện khi `vat.enabled`** (khi tắt: không nhắc VAT); nút **In bảng ước tính**; form Họ tên/SĐT/
     Email/Địa chỉ (ghi chú) + ô bản quyền (Phase 29, không tick sẵn) + honeypot. Bấm gửi → upload
     từng file (thanh %), rồi submit.
   - **B4 Xác nhận**: mã `CR-…`, nút **Sao chép mã**, nút **Mở Zalo** (`SITE_CONFIG.zaloUrl`) kèm
     hướng dẫn dán mã, "Xưởng sẽ gửi báo giá chính thức cho từng món". **Không QR, không cọc (D4).**
4. **FAQ** — accordion, nội dung Owner tự viết (O5).

Khác: thêm link nav + `sitemap.ts`; chuỗi trong `messages/vi.json` / `en.json`; sự kiện GA4
`quote_file_added`, `quote_estimate_shown`, `quote_submitted`; dùng `trackContactClick('zalo', 'bao-gia')`.

Bản in (T13): component `EstimatePrintSheet` chỉ hiện khi in; tiêu đề cố định **"BẢNG ƯỚC TÍNH —
không phải báo giá chính thức"**, thời điểm in, mã `CR-…` (nếu đã gửi), thông tin xưởng, bảng món.

### 7.1 Admin
- `custom-requests`: Danh sách hiển thị badge `Đa món (N file)` khi `itemCount > 0` (đếm từ
  `custom_request_items`, §4B ghi chú) — không dựa vào `attachment_path IS NULL`.
- `custom-requests/[id]`: bảng món — tên file + nút tải (signed URL 15'), kích thước, scale %,
  vật liệu/infill/màu, SL, gram, giờ in, giá ước tính, **badge xác minh** (MISMATCH hiện % lệch),
  cột "Quote" (số Quote + trạng thái).
- Quy tắc pre-fill theo `verification`: `VERIFIED` → điền sẵn; `MISMATCH` → điền sẵn (đã là số
  server) + hiện % lệch; `CLIENT_REPORTED` → **khoá** pre-fill, hiện nút **"Kiểm tra lại trên server"**
  (§6.5) — kết quả kiểm tra lại mới được dùng để điền; `UNPRICED` → không điền.
- Mỗi món có nút **Tạo báo giá cho món này** → form Quote hiện có, gắn `customRequestItemId`.
  Form hiển thị VAT (chỉ đọc, do server tính).
- Nút **Sao chép tất cả link báo giá** để gửi qua Zalo.
- `settings/pricing`: thêm công tắc VAT + thuế suất (%) → lưu thành config mới (đã có audit).
- Trang công khai `/quotes/[quoteNumber]`: hiện tên món/kích thước khi có `custom_request_item_id`;
  dòng VAT khi `vat_amount > 0`. Phần QR cọc hiện có: **chờ O1**.

## 8. Vertical slices

### S0 — Spike hiệu chỉnh công thức (0,5–1 ngày) — chặn S3
- [ ] Lấy 15–20 file .3mf đã slice thật của xưởng (đủ dạng: khối đặc, vỏ mỏng, cao mảnh, nhiều chi tiết).
- [x] Script offline `scripts/fdm-model-calibration/`: đọc `slice_info` (gram, phút) + tính metrics từ mesh trong cùng file.
- [ ] Fit `SHELL_THICKNESS_MM`, `Q_*`, `MIN_LAYER_SECONDS`, `K_CALIB`; báo cáo sai số trung vị/P90 cho gram và phút. *(Script đã làm được — fit + median/P90/leave-one-out; chờ Owner chạy trên file thật.)*
- [ ] Ngưỡng chấp nhận: gram ±15%, phút ±25% (trung vị). Không đạt → báo Owner trước khi đi tiếp. *(Script in PASS/FAIL; chờ kết quả thật.)*

### S1 — VAT (1 ngày)
- [x] Migration **4A** (§4.1, §4.2, §4.2b) với khối `DO` kiểm tra tên constraint trước khi drop.
- [x] `tests/migration-contract.test.ts`: khẳng định cột/constraint mới của `pricing_configs`, `quotes`, `orders`.
- [x] `src/lib/pricing/vat.ts` (`computeVat`) + unit test (0%, 8%, 10%, làm tròn .5, số lớn).
- [x] `pricing-config.service` + `pricingConfigInputSchema`: `vatEnabled`, `vatRateBps`.
- [x] `createQuote` tính VAT server-side; `QUOTE_TOTAL_MISMATCH`; DTO quote có `vatRateBps`, `vatAmount`.
- [x] Admin `settings/pricing`: công tắc + thuế suất; trang Quote công khai/admin hiện dòng VAT khi > 0.
- [x] Test tích hợp: tắt VAT → Quote giống hệt hiện tại; bật 8% → `vat_amount` đúng; DB chặn
      `total` không khớp và `vat_amount > 0` khi `vat_rate_bps = 0` (cả `quotes` lẫn `orders`);
      đơn hàng hiện có (`createOrder`) vẫn tạo được với VAT 0.

### S2 — Upload thẳng Storage + bảng món (1–1,5 ngày)
- [x] Migration **4B** (§4.3, §4.4, §4.5) gồm hàm trigger `prevent_custom_request_item_mutation()`.
- [x] `upload-urls` route + service theo §6.2 (trả `contentType`); hằng `MAX_UPLOAD_BYTES` trong một file cấu hình.
- [x] Helper `inspectUploadedObject(path)` → size thật + magic bytes (xác minh API `storage.info()` hay
      `list()` trên phiên bản supabase-js đang dùng); áp cho nhánh `attachmentPath` hiện có của
      `POST /api/public/custom-requests`.
- [x] Đổi uploader `/custom-print/custom-request-form.tsx` sang signed URL (UI không đổi); gỡ route
      `attachments` và cập nhật/thay `tests/phase-6-attachment-route.test.ts`, `phase-6-attachment-upload.test.ts`.
- [x] `estimateAttachment` (file-estimate, ADR-0034): file > giới hạn parse (20MB) trả **status mới
      `TOO_LARGE`** (không ném lỗi 400) → UI `/custom-print` hiện "xưởng sẽ báo giá".
- [x] Cron dọn file mồ côi > 24h (object trong bucket không được `custom_requests.attachment_path` hay
      `custom_request_items.attachment_path` tham chiếu): route `/api/cron/cleanup-orphan-uploads`,
      kiểm `Authorization: Bearer ${CRON_SECRET}`, cấu hình Vercel Cron 1 lần/ngày (`vercel.json`).
- [x] Helper test `purgeCustomRequest(client, id)` dùng `set local basa3d.allow_item_purge = 'on'`;
      test: UPDATE món bị chặn; DELETE món không cờ bị chặn; có cờ thì xoá được; FK kép chặn Quote trỏ
      món của yêu cầu khác.

### S3 — Hình học & công thức dùng chung (1 ngày)
- [x] `mesh-metrics.ts` (volume, surface, bbox, triangles; nhận `Float32Array` vị trí) — gộp `mesh-volume.ts`/`mesh-estimator.ts`, giữ export cũ làm wrapper.
- [x] `fdm-estimate-model.ts` với hằng số từ S0 *(placeholder `fdm-v0-uncalibrated` — chờ S0)*, `modelVersion: 'fdm-v1'`.
- [x] `instant-estimate.service.ts`: `estimateFromMeshMetrics(ctx, metrics, config)` (1 giá); đường `/custom-print` hiện tại có thể giữ khoảng giá cũ hoặc chuyển — **chọn ở O3**.
- [x] Unit test: khối 40mm (gram theo §5.1), cột cao 200mm/12g (phút ≫ phút theo gram), scale ×2 (V×8, A×4), mesh hở → UNPRICED, vượt khổ → UNPRICED.

### S4 — Endpoint ước tính (0,5 ngày)
- [x] `POST /api/public/quote-estimate` theo §6.1 + Zod nhất quán + rate limit.
- [x] Test: payload hợp lệ; V > bbox → 400; A quá nhỏ → 400; 11 món → 400; VAT bật/tắt.

### S5 — Gửi yêu cầu nhiều món (1 ngày)
- [x] `publicCustomRequestInputSchema` thêm `items` (loại trừ với nhánh cũ). *(Làm bằng schema riêng `publicBaoGiaRequestSchema` — strict, loại trừ theo cấu trúc.)*
- [x] Route §6.3: kiểm object, tính lại trong ngân sách, transaction insert yêu cầu + món + audit.
- [x] `createCustomRequest` nhận `items`; món đọc qua `listCustomRequestItems` (S7 dùng).
- [x] Test: path không tồn tại → 400; path trùng → 400; magic bytes sai → 400; metrics client giả → MISMATCH và giá theo server; vượt ngân sách → CLIENT_REPORTED; trigger chặn update món.

### S6 — UI `/bao-gia` (2–3 ngày)
- [x] Worker `src/workers/mesh-analyze.worker.ts` — v1 STL/OBJ → metrics + positions (D6: 3MF đi `/custom-print`).
- [x] Viewer lazy (`dynamic(..., { ssr:false })`), giới hạn tam giác, dispose, context-lost.
- [x] Các section §7, stepper, thanh tóm tắt, debounce gọi §6.1, upload có tiến trình + thử lại.
- [x] i18n vi/en (nav; nội dung trang tiếng Việt + UntranslatedNotice như `/custom-print`), nav, sitemap, GA4.
- [x] Bản in `EstimatePrintSheet`.

### S7 — Admin N Quote (1 ngày)
- [ ] Bảng món ở `custom-requests/[id]`; nút tạo Quote theo món; cột Quote.
- [ ] `acceptQuote`: khoá anh em mở rộng §6.4; test 2 món → 2 Quote → chấp nhận món 1 không đụng món 2.
- [ ] Nút sao chép tất cả link Quote.

### S8 — Kiểm thử & tài liệu (1 ngày)
- [ ] Playwright: 2 STL → đổi infill/scale → giá đổi → in → gửi → admin thấy 2 món → tạo 2 Quote → 2 trang Quote công khai; chạy thêm viewport mobile.
- [ ] Playwright: bật VAT trong admin → `/bao-gia` hiện dòng VAT, Quote mới có VAT, Quote cũ không đổi.
- [ ] Ghi ADR-0035 (§10), cập nhật `docs/database/schema.md`, `business-rules.md` (VAT, 1 món = 1 Quote), `roadmap.md`, sửa câu support 25% trong research §9.
- [ ] Full gate: lint, typecheck, unit, integration, E2E, build.

## 8b. Ước lượng

| Slice | Ngày |
|---|---|
| S0 | 0,5–1 |
| S1 | 1 |
| S2 | 1 |
| S3 | 1 |
| S4 | 0,5 |
| S5 | 1 |
| S6 | 2–3 |
| S7 | 1 |
| S8 | 1 |
| **Tổng** | **9–10,5** |

Thứ tự: S0 ∥ S1 ∥ S2 → S3 → S4 → S5 → S6 ∥ S7 → S8. S1 và S2 độc lập, release riêng được.

## 9. Definition of Done

- [ ] Khách dùng `/bao-gia` trên Production (Vercel) với file 40MB không lỗi 413; `/custom-print` cũng vậy.
- [ ] Đổi infill/scale/vật liệu/SL → giá cập nhật < 1s (đo trên mạng 4G giả lập, file đã phân tích).
- [ ] Payload submit không có field giá; test chứng minh metrics giả không đổi được giá lưu khi file trong ngân sách.
- [ ] 1 yêu cầu N món → admin tạo N Quote; DB chặn Quote trỏ tới món của yêu cầu khác.
- [ ] VAT tắt: mọi số tiền giống hệt trước phase. VAT bật: ước tính = tổng N Quote đến từng đồng; Quote cũ không đổi.
- [ ] Không có QR/cọc ở `/bao-gia`.
- [ ] Không thêm dependency mới.
- [ ] Hằng số công thức có báo cáo sai số S0 đính kèm.
- [ ] Full quality gate xanh; tài liệu §S8 cập nhật.

## 10. Bản nháp ADR-0035 (ghi vào `decisions.md` ở S8)

> **ADR-0035 — `/bao-gia`: ước tính từ metrics trên trình duyệt, 1 món = 1 Quote, VAT có phiên bản.**
> Trình duyệt gửi metrics hình học, không bao giờ gửi giá; server tính bằng engine cost-plus với
> công thức gram + thời gian (`fdm-v1`). File upload thẳng Storage bằng signed URL; khi gửi, server
> kiểm tra object và tính lại trong ngân sách, gắn `VERIFIED | MISMATCH | CLIENT_REPORTED`. Món lưu ở
> `custom_request_items` (không UPDATE; DELETE chỉ qua cờ phiên `basa3d.allow_item_purge`); mỗi Quote
> trỏ tối đa 1 món qua FK kép. VAT là `pricing_configs.vat_enabled/vat_rate_bps` (mặc định tắt),
> snapshot vào `quotes`/`orders` (`vat_rate_bps`, `vat_amount`); DB chỉ kiểm tổng tiền và "không có
> tiền VAT khi thuế suất 0" — công thức thuế nằm trong `src/lib/pricing/vat.ts`; tính theo từng Quote.
> Giá ước tính có sàn theo dòng. Token upload 2 giờ (Supabase cố định). Không thu cọc ở luồng này.

## 11. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Công thức thời gian sai nhiều với hình dạng lạ | S0 đo sai số; giá luôn là "ước tính"; staff chốt Quote; `modelVersion` để hiệu chỉnh dần (research §6.4) |
| Mobile (iOS Safari) crash khi dựng mesh lớn | Worker chỉ trả metrics; ngưỡng tam giác cho viewer; 1 viewer/lần; fallback chỉ kích thước |
| Bucket bị dùng làm kho file ẩn danh | Giới hạn bucket, kiểm magic bytes, rate limit theo lô, cron dọn file mồ côi |
| Bật VAT giữa chừng: Quote DRAFT cũ không có VAT | Đúng thiết kế (ADR-0022); staff tạo lại Quote nếu cần — ghi vào business-rules |
| Thuế suất/hình thức thuế thay đổi theo luật | Thuế suất là cấu hình, không hard-code 8% |
| Tên file gốc (`display_name`) có thể chứa dữ liệu cá nhân; bảng món không sửa được | Đường xoá duy nhất qua cờ `basa3d.allow_item_purge` (T6); quy trình xoá dữ liệu theo yêu cầu khách (có audit) là follow-up |
| Signed upload token sống 2 giờ | Rate limit cấp URL, giới hạn bucket, magic bytes, cron dọn file mồ côi |
| Khách nhận N link Quote rời rạc, khó theo dõi | Nút sao chép tất cả link; trang Quote hiện tên món (follow-up: trang gom theo `CR-…` có xác thực SĐT) |

## 12. Câu hỏi mở (trả lời trước khi giao Codex)

- **O1** Trang `/quotes/[quoteNumber]` hiện **luôn hiện QR cọc 50%**. "Chưa áp dụng cọc" có áp dụng
  cho trang này không? Đề xuất: thêm cờ env `QUOTE_DEPOSIT_ENABLED` (mặc định = hành vi hiện tại),
  Owner quyết định bật/tắt.
- **O2** Cơ sở tính VAT: `tạm tính + phí ship − giảm giá` (đề xuất) hay chỉ `tạm tính`? Hộ kinh doanh
  hay doanh nghiệp (ảnh hưởng hình thức kê khai)? → hỏi kế toán.
- **O3** `/custom-print` có chuyển từ "khoảng giá" sang "1 giá" (công thức mới) luôn không? Đề xuất: có,
  sau khi S0 đạt ngưỡng.
- **O4** Cam kết thời gian phản hồi trên Hero (ví dụ "trong giờ hành chính, ≤ 2 giờ")?
- **O5** Nội dung FAQ và 3–4 mẫu "giá tham khảo" (Owner cung cấp).
- **O6** Danh sách vật liệu mở cho khách (PLA/PETG/ABS…) và mức infill cho phép — mặc định như §7.

### 12b. Trả lời (Owner giao Claude tự quyết, ghi lại 2026-10-13 — Owner duyệt trong chat)

- **O3** `/custom-print` **giữ khoảng giá** cho tới khi S0 đạt ngưỡng; sau đó mới chuyển sang 1 giá.
- **O4** Hero dùng lại cam kết đang có trên `/custom-print`: **"trong 2 giờ làm việc"** (không tạo lời hứa mới).
- **O5** Claude viết nháp FAQ (không chép đối thủ) + 3–4 mẫu giá tham khảo tính trực tiếp bằng engine
  (`src/config/bao-gia-samples.ts`); Owner sửa câu chữ sau.
- **O6** Vật liệu: PLA/PETG/ABS/ASA/TPU, **chỉ loại đang có vật liệu active có giá** (khác → `NO_MATERIAL_PRICE`);
  Resin → xưởng báo giá. Infill 10/15/20/30/50/100, mặc định 15.
- **D6 (mới)** `/bao-gia` v1 **chỉ nhận STL/OBJ** (hình khối thuần, cùng một công thức). `.3mf` (đã slice: giá chính
  xác; chưa slice: khoảng giá) đi qua `/custom-print`, có link dẫn từ `/bao-gia`. Schema `custom_request_items`
  giữ nguyên (vẫn nhận 3mf) để mở sau: v2 đọc `slice_info` của 3MF đã slice ngay trên trình duyệt (chỉ đọc mục
  lục ZIP + entry cần, không nạp cả file).
- **D7 (mới)** S0 chưa có file thật → S3–S8 làm với hằng số placeholder (`FDM_MODEL_VERSION = 'fdm-v0-uncalibrated'`);
  `/bao-gia` nằm sau env `BAO_GIA_ENABLED` (mặc định tắt). Bật Production chỉ sau khi S0 PASS và thay hằng số
  (`fdm-v1`).

## 13. Bước tiếp theo theo `PHASE_START_PROTOCOL`

1. [x] Owner chốt các quyết định ban đầu D1–D5.
2. [x] Chạy `gemini-challenge` độc lập và cập nhật 4 nhóm khuyến nghị T3, T4, T7/T8, T9/T10 vào bản kế hoạch này (2026-10-13).
3. [x] Claude Final Review (2026-10-13): GO cho S0–S2 sau khi sửa B1–B3, I1–I7 (§14).
4. [ ] Codex: S0 (script hiệu chỉnh) + S1 (VAT) + S2 (upload/bảng món) — prompt `phase-33-codex-handoff-prompt.md`.
5. [ ] Owner chạy S0 trên 15–20 file thật; trả lời O3, O6 → handoff S3–S5.
6. [ ] O4, O5 → handoff S6–S8.

### Trước khi giao Codex (S0–S2)
- [x] Schema tách 2 migration (4A/4B), có khối `DO` kiểm tên constraint.
- [x] `orders` sửa check tổng cùng lúc thêm cột VAT; thêm `vat_rate_bps > 0 or vat_amount = 0`.
- [x] Token upload ghi đúng 2 giờ; §6.2 trả `contentType`.
- [x] Kiểm tra lại món không ghi vào bảng bất biến (§6.5, làm ở S7).
- [x] Badge "Đa món" đếm từ `custom_request_items`.
- [x] Cơ chế dọn E2E/xoá dữ liệu: cờ phiên `basa3d.allow_item_purge`.
- [x] O1, O2 không chặn S0–S2 (VAT mặc định tắt; QR cọc không đụng tới).
- [x] O3, O6 — chặn S3; O4, O5 — chặn S6. (Trả lời ở §12b.)

## 14. Nhật ký cập nhật

- **2026-10-13 — Gemini Challenge**: Q1 khoá pre-fill món `CLIENT_REPORTED`; Q2 bỏ denormalize món #1;
  Q3 nới check VAT, thêm cột VAT cho `orders`; Q4 giá sàn + dấu `~`.
- **2026-10-13 — Claude Final Review** (chấp nhận 4 thay đổi trên, sửa thêm):
  - B1: token 15 phút không khả thi (`createSignedUploadUrl` chỉ nhận `{ upsert }`, Supabase cố định 2 giờ) → ghi đúng 2 giờ.
  - B2: kiểm tra lại không ghi vào món (mâu thuẫn T6) → on-demand + `audit_logs` (§6.5).
  - B3: badge "Đa món" dựa `attachment_path IS NULL` sai → đếm món.
  - I1: `orders` thêm cột VAT nhưng không sửa check tổng → sửa check.
  - I2: thêm `vat_rate_bps > 0 or vat_amount = 0`; bỏ check `vat_amount >= 0` trùng.
  - I3: giá sàn theo dòng, không theo đơn vị.
  - I4: §6.2 trả `contentType` (supabase-js mặc định `text/plain`, Windows báo `.stl` khác).
  - I5: trigger riêng cho phép DELETE qua cờ phiên → dọn E2E + xoá dữ liệu cá nhân sau này.
  - I6: tách migration 4A/4B; `DO` block kiểm tên constraint.
  - I7: cập nhật bản nháp ADR-0035.
  - Thêm: `estimateAttachment` trả `TOO_LARGE` thay vì lỗi khi file > 20MB (vì upload mới cho tới 50MB).
