# Prompt — Kho STL trên Google Drive → Kho sản phẩm DRAFT trong admin → Duyệt → Lên web

> Cách dùng: dán toàn bộ phần **PROMPT** dưới đây vào Claude Code / Codex trong repo BaSa3D
> (hoặc chạy `/speckit-auto` rồi dán làm mô tả tính năng). Điền các ô `<...>` trước khi chạy.
> Prompt đã dựa trên code hiện tại (2026-10-21): `product.service.ts`, `product_images`,
> bucket `product-images`, spike `scripts/model-library-spike/`, Phase 32 draft.

---

## PROMPT

### 0. Vai trò & quy trình

Bạn là senior engineer trong repo BaSa3D. Đọc `AGENTS.md`, `CLAUDE.md`, `docs/product/catalog-spec.md`,
`docs/exec-plans/active/phase-32-model-library.md`, `scripts/model-library-spike/README.md` trước khi làm.

Làm theo Spec Kit: `/speckit-specify` → clarify → plan → tasks → analyze → implement → converge.
Tạo `specs/NNN-stl-bulk-import/` và `docs/exec-plans/active/feature-NNN-stl-bulk-import.md` theo
`PHASE_START_PROTOCOL.md`. **Dừng ở mỗi gate để tôi duyệt**, không push, không deploy.

Tính năng này **thay đổi quyết định T3 của Phase 32** (trước đây: không dùng `products`). Ghi ADR mới
trong `docs/architecture/decisions.md` giải thích lý do và cập nhật Phase 32 (supersede hoặc thu hẹp phạm vi).

### 1. Mục tiêu

Tôi có kho khoảng `<số lượng>` file STL (tổng `<dung lượng>` GB) trên Google Drive, đồng bộ về máy qua
Google Drive for desktop tại `<đường dẫn thư mục>`. Tôi muốn:

1. Một script **chạy trên máy tôi** quét thư mục, **tự render ảnh sản phẩm** từ STL, tính kích thước/thể tích,
   ước giá, rồi tạo **sản phẩm DRAFT** trong DB + upload ảnh lên Storage.
2. Một trang admin **"Kho nhập STL"** để tôi xem lưới draft, sửa thông tin, **duyệt hàng loạt** → sản phẩm
   chuyển `ACTIVE` và hiện trên trang sản phẩm công khai; hoặc **từ chối** → `ARCHIVED`.

**Non-goals**: viewer 3D trên trang sản phẩm; cho khách tải STL; đồng bộ Drive realtime; ảnh AI;
tự xác định bản quyền; nhập tồn kho.

### 2. Quyết định kỹ thuật (đề xuất — challenge nếu thấy sai)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | Đọc Drive qua **thư mục local của Drive for desktop**, không gọi Drive API | Tái dùng spike; không cần OAuth/quota. Lưu ý chế độ *Stream* sẽ tải file khi đọc → dùng `--limit` |
| D2 | Render + upload **offline bằng script Node** (mở rộng `generate-previews.mjs`), không qua API route | Vercel giới hạn body 4.5 MB và thời gian chạy |
| D3 | Script ghi DB/Storage bằng `SUPABASE_SERVICE_ROLE_KEY` từ `.env.local`, **dry-run mặc định**, `--apply` mới ghi thật | Theo pattern `cleanup-test-data.mjs`; key không bao giờ commit |
| D4 | Bảng staging **`product_import_items`** (1–1 với product) giữ metadata nguồn; **không** thêm cột nguồn vào `products` | `source_rel_path` không được lộ ra API công khai; giữ `products` sạch domain |
| D5 | Sản phẩm tạo ra: `status = DRAFT`, `product_type = MADE_TO_ORDER`, 1 variant mặc định, **không** tạo `inventory_movements` | Hàng in theo đơn, không có tồn kho; tuân thủ rule ledger bất biến |
| D6 | Ảnh lưu ở bucket `product-images` qua đúng đường `{productId}/{uuid}.webp`, ghi `product_images` | Tái dùng pipeline hiện có; WebP ≤ 5 MB |
| D7 | Khoá idempotent: `source_key = sha1(relPath)`, kèm `source_bytes` + `source_mtime` | Chạy lại không tạo trùng; file đổi → render lại ảnh, **không** ghi đè field admin đã sửa |
| D8 | Gate publish: chỉ cho `DRAFT → ACTIVE` khi import item đã `license_reviewed = true`, có ≥ 1 ảnh, giá > 0 | Kho có nguồn lẫn lộn; default `license_type = OWN_DESIGN` hiện tại là **nguy hiểm** với hàng import |

### 3. Pipeline script

`scripts/stl-import/import-stl.mjs` (tái dùng `three`, `playwright`, `fflate`, `parseStlMetrics` — không thêm dependency trừ khi giải thích rõ):

1. **Scan**: duyệt đệ quy `--in <dir>`, lấy `.stl` (tuỳ chọn `.3mf`). Bỏ file > `--max-mb`.
2. **Gom nhóm** theo `--group-by`:
   - `file` (mặc định): 1 STL = 1 sản phẩm.
   - `folder`: mọi STL trong cùng thư mục lá = 1 sản phẩm nhiều part (render chung một cảnh, tổng thể tích).
3. **Metrics**: bbox (mm), thể tích (cm³), số tam giác; phát hiện mesh hỏng / không kín → ghi `process_error`, không dừng batch.
4. **Render ảnh** (headless three.js, Z-up → Y-up, camera canh theo bbox):
   - 4 góc: chéo trước 3/4 (ảnh cover), chính diện, cạnh bên, trên xuống.
   - 1200×1200, nền sáng trung tính, bóng đổ mềm, màu vật liệu `--color` (mặc định xám PLA), WebP q≈0.85.
   - Tuỳ chọn ảnh có thước đo kích thước (overlay `X × Y × Z mm`).
5. **Tên & slug**: tên từ tên file/thư mục (bỏ `_v2`, `final`, số thứ tự, đuôi); slug kebab-case bỏ dấu tiếng Việt,
   trùng thì thêm hậu tố `-2`, `-3`. SKU theo `catalog-spec.md` §3 `<CAT>-<SLUG>`, viết hoa, cắt ≤ 40 ký tự, đúng regex.
6. **Danh mục**: map tên thư mục cha → `categories` qua file `scripts/stl-import/category-map.json`;
   không khớp → danh mục "Chưa phân loại" (tạo trong seed/migration, `is_active = false` ngoài storefront).
7. **Giá ước tính**: dùng pricing engine/`pricing_configs` hiện có theo thể tích + vật liệu mặc định;
   ghi `base_price`, `pricing_breakdown`, `pricing_config_id` **cùng lúc** (constraint hiện có). Gắn `needs_price_review = true`.
8. **Ghi kết quả**: `manifest.json` + `report.html` (lưới ảnh, lỗi, thống kê) ở `.stl-import/` (đã gitignore).
9. **`--apply`**: trong 1 transaction mỗi sản phẩm: upsert `product_import_items` → tạo/cập nhật product DRAFT +
   variant + `product_images`. Upload ảnh trước; nếu DB lỗi thì xoá ảnh đã upload (giống `uploadProductImage`).
   Ghi audit log với actor là "system import".

Cờ CLI: `--in`, `--out`, `--limit`, `--group-by`, `--color`, `--size`, `--max-mb`, `--timeout`,
`--retry-errors`, `--apply`, `--only <glob>`. Chạy được trên **Mac và Windows**.

**Tuyệt đối không** upload file STL gốc lên bất kỳ bucket nào.

### 4. Schema (gửi `database-review` trước khi viết migration)

```sql
create table product_import_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid unique references products(id) on delete set null,
  source_key varchar(64) not null unique,
  source_rel_path text not null,            -- chỉ admin thấy
  source_files jsonb not null,              -- [{relPath, bytes, mtime}] khi group-by folder
  source_bytes bigint not null check (source_bytes >= 0),
  source_mtime timestamptz not null,
  bbox_mm jsonb, volume_cm3 numeric(12,3), triangle_count integer,
  render_status varchar(16) not null default 'PENDING'
    check (render_status in ('PENDING','RENDERED','ERROR')),
  process_error text,
  needs_price_review boolean not null default true,
  license_reviewed boolean not null default false,
  review_status varchar(16) not null default 'PENDING'
    check (review_status in ('PENDING','APPROVED','REJECTED')),
  reviewed_by uuid references staff_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
```

Gate D8 enforce ở **service layer + test** (và trigger DB nếu `database-review` khuyên). RLS: chỉ server đọc/ghi.

### 5. Admin "Kho nhập STL"

`src/app/admin/(protected)/stl-import/page.tsx` + `actions.ts`, `requireAdmin()` server-side:

- Lưới thẻ: ảnh cover, tên, danh mục, kích thước, giá ước tính, badge lỗi / cần xem giá / chưa duyệt license.
- Lọc: `PENDING | APPROVED | REJECTED | ERROR`, danh mục, thư mục nguồn; tìm theo tên; phân trang.
- Sửa nhanh inline: tên, danh mục, giá, `license_type`, `license_source_url`, tick "đã kiểm tra bản quyền".
- Chọn nhiều → **Duyệt** (DRAFT → ACTIVE, kiểm tra gate D8 từng item, trả về danh sách item bị chặn + lý do)
  hoặc **Từ chối** (→ ARCHIVED). Mọi thay đổi ghi audit log.
- Hiện đường dẫn Drive để admin mở file gốc; nút "Render lại" đánh dấu item cho lần chạy script sau.
- Mobile-friendly cơ bản (tôi duyệt cả trên điện thoại).

### 6. Storefront

Không cần trang mới: product `ACTIVE` tự hiện ở trang sản phẩm hiện có. Kiểm tra:
public API/HTML **không lộ** `product_import_items.*`; ảnh hiển thị qua `next/image`; sitemap có sản phẩm mới.

### 7. Edge cases phải có test

- Chạy lại cùng thư mục → 0 bản ghi trùng; file đổi `mtime/bytes` → chỉ ảnh + metrics cập nhật, field admin đã sửa giữ nguyên.
- Item đã APPROVED mà file nguồn thay đổi → không tự đổi giá/ảnh public, chỉ gắn cờ cần xem lại.
- Slug/SKU trùng, tên tiếng Việt có dấu, tên rất dài, tên chỉ có số.
- STL ASCII, binary, rỗng, hỏng, > 1M tam giác, đơn vị inch (bbox quá nhỏ/quá lớn → cảnh báo).
- Folder nhiều part; file nằm ở root không có thư mục cha.
- Duyệt hàng loạt khi một số item không qua gate → các item hợp lệ vẫn được duyệt, item lỗi báo rõ.
- STAFF không phải admin / khách gọi action → 403.
- Upload thành công nhưng DB lỗi → không còn ảnh mồ côi.

### 8. Definition of Done

- [ ] Batch thật ≥ 100 STL chạy xong, `report.html` cho thấy tỉ lệ lỗi, thời gian trung bình/file
- [ ] Draft hiện trong admin; duyệt ≥ 10 sản phẩm → thấy trên trang sản phẩm công khai
- [ ] Không sản phẩm nào chưa `license_reviewed` lên `ACTIVE` (test)
- [ ] Không lộ thông tin nguồn ra public (test)
- [ ] lint, typecheck, `npm test`, Playwright E2E (admin duyệt → storefront hiển thị), build pass
- [ ] Cập nhật `docs/database/schema.md`, `business-rules.md`, `runbook.md` (cách chạy batch), `roadmap.md`

### 9. Câu hỏi cần tôi trả lời trong bước clarify

- Q1: 1 file = 1 sản phẩm, hay 1 thư mục = 1 sản phẩm? Kho có lẫn cả hai kiểu không?
- Q2: Vật liệu/màu mặc định để render và tính giá? Có tạo sẵn nhiều variant màu không?
- Q3: Công thức giá: dùng `pricing_configs` hiện tại hay hệ số riêng cho hàng catalog?
- Q4: License NC (non-commercial) có được bán không? (Đề xuất: **không**, auto từ chối.)
- Q5: Số ảnh dự kiến: `<số model> × 4 ảnh × ~100 KB`. Supabase Free 1 GB → nếu vượt, giảm còn 2 ảnh hoặc chuyển R2.
- Q6: Có cần mô tả sản phẩm tự sinh (từ tên + kích thước) không, hay để trống cho tôi viết?
