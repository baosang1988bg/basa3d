# Phase 32 — Model Library (giai đoạn 1: gallery ảnh preview → đặt in)

> **Mục đích**: Owner có kho ~200 GB file STL/3MF trên Google Drive (5 TB) nhưng không có ảnh minh
> hoạ. Giai đoạn 1 tự động tạo ảnh preview hàng loạt và đưa lên một **thư viện mẫu** để khách xem,
> rồi bấm "Đặt in mẫu này" để vào luồng custom request/báo giá đã có.
>
> Xem 3D tương tác (GLB + viewer) là **giai đoạn 2**, KHÔNG thuộc phase này.

Trạng thái: **draft** — Claude viết 2026-10-08 sau feasibility review (trong hội thoại). Spike bước 0
đã có code và đã chạy thử trên file mẫu: `scripts/model-library-spike/`.

---

## 1. Phase brief

- **Goal**: Khách xem được gallery ảnh các mẫu đã được admin duyệt, lọc/tìm theo tên hoặc danh mục,
  và bấm "Đặt in mẫu này" để tạo custom request có gắn sẵn mẫu.
- **Non-goals**: viewer 3D/GLB; bán mẫu như `products` (giá/variant/tồn kho); cho khách tải file
  STL/3MF; đồng bộ Drive tự động theo thời gian thực; tự xác định license.
- **Inputs**: thư mục Drive (đọc qua Google Drive for desktop trên máy Owner); file `.stl`/`.3mf`.
- **Outputs**: ảnh WebP trên Storage công khai; bảng `model_library_items`; trang admin duyệt;
  trang gallery công khai; liên kết với custom request.
- **Risks**: bản quyền (kho lẫn lộn nguồn), dung lượng/egress Storage, 3MF nhiều plate không render
  được, Drive stream chậm.
- **Definition of Done**: mục 7.

## 2. Quyết định Owner đã chốt (2026-10-08)

1. Gallery là **thư viện mẫu → đặt in**, không phải sản phẩm bán sẵn.
2. Nguồn gốc file **lẫn lộn, không rõ** → mọi mẫu **mặc định ẩn**, admin duyệt từng mẫu.
3. Giai đoạn này là **demo kiểm chứng tính khả thi**. Owner sẽ làm chi tiết và deploy trên PC.
4. Drive giữ vai trò **kho gốc private**. Khách không bao giờ gọi Drive.

## 3. Quyết định kỹ thuật (tạm thời — cần challenge trước khi giao Codex)

| # | Quyết định | Lý do | Phương án thay thế |
|---|---|---|---|
| T1 | Ảnh tạo **offline trên máy Owner** bằng script Node + Playwright, không chạy trên Vercel | Vercel giới hạn body 4.5 MB và thời gian chạy; file gốc nằm ở Drive local | Drive API + job server: phức tạp hơn, dính quota theo file |
| T2 | 3MF: ưu tiên ảnh nhúng `Metadata/plate_N.png`; ảnh `Auxiliaries/.thumbnails/*` gắn cờ `designer_cover` | Nhanh và không tốn render. Ảnh cover là tác phẩm của người khác | Luôn render (`--force-render`) |
| T3 | Bảng **riêng** `model_library_items`, không dùng `products` | Không kéo theo variant/giá/inventory (AGENTS rule 3–4); "nâng cấp thành product" để sau | Thêm cột vào `products`: sai domain |
| T4 | Storage: bucket public `model-previews` trên **Supabase**; thiết kế adapter để sau này đổi sang R2 | Tái dùng pattern `product-images`. Ảnh ~5–80 KB/file, vài nghìn file vẫn dưới 1 GB | R2 ngay từ đầu: thêm tài khoản và SDK |
| T5 | Upload từ script bằng **service-role key trên máy Owner** (bước `--publish`), không qua API route | Hàng nghìn ảnh qua route Vercel thì chậm và dễ dính rate limit | Upload từng ảnh qua admin UI |
| T6 | `custom_requests.model_library_item_id` (nullable FK) + snapshot `model_library_item_name` | Admin biết khách muốn mẫu nào; snapshot giữ đúng dữ liệu nếu mẫu bị sửa/ẩn (rule 4) | Chỉ ghi vào `description`: mất liên kết |
| T7 | Khoá idempotent: `source_key = sha1(relPath)` + `source_bytes`/`source_mtime` | Chạy lại không tạo trùng; file đổi thì cập nhật ảnh | Hash toàn file: phải đọc lại 200 GB |

## 4. Schema dự kiến (để `database-review` duyệt)

```sql
create table model_library_items (
  id uuid primary key default gen_random_uuid(),
  source_key varchar(64) not null unique,          -- sha1(relPath), idempotent re-runs
  source_rel_path text not null,                   -- đường dẫn trong Drive (chỉ admin thấy)
  source_drive_file_id varchar(128),               -- tuỳ chọn: để admin mở nhanh file gốc
  source_kind varchar(8) not null check (source_kind in ('STL','3MF')),
  source_bytes bigint not null check (source_bytes >= 0),
  source_mtime timestamptz not null,
  name varchar(200) not null check (btrim(name) <> ''),
  slug varchar(160) unique,                        -- sinh khi publish
  category_label varchar(100),                     -- lấy từ thư mục cha, admin sửa được
  preview_path text,                               -- path trong bucket model-previews
  thumbnail_source varchar(16) check (thumbnail_source in ('EMBEDDED','RENDERED')),
  designer_cover boolean not null default false,
  triangle_count integer check (triangle_count >= 0),
  bbox_mm jsonb,                                   -- {x,y,z}
  license_type varchar(50) not null default 'UNKNOWN', -- dùng chung giá trị với products + UNKNOWN
  license_source_url text,
  status varchar(16) not null default 'HIDDEN' check (status in ('HIDDEN','PUBLISHED','REJECTED')),
  process_error text,
  reviewed_by uuid references staff_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
-- Rule ở DB: chỉ PUBLISHED khi license_type <> 'UNKNOWN' và có preview, và designer_cover = false
-- (hoặc đã được admin xác nhận bằng cờ riêng — xem câu hỏi Q3).
alter table model_library_items add constraint model_library_publish_guard check (
  status <> 'PUBLISHED' or (license_type <> 'UNKNOWN' and preview_path is not null and designer_cover = false)
);
create index model_library_items_status_idx on model_library_items(status, name);
alter table custom_requests
  add column model_library_item_id uuid references model_library_items(id) on delete set null,
  add column model_library_item_name varchar(200);
```

RLS: bảng chỉ đọc/ghi qua server (service layer). Storefront đọc bằng query lọc `status = 'PUBLISHED'`.
Cột `source_rel_path` và `source_drive_file_id` **không bao giờ** trả ra API công khai.

## 5. Vertical slices

### Slice 0 — Spike offline (✅ code xong, chờ Owner chạy trên dữ liệu thật)
- [x] `scripts/model-library-spike/generate-previews.mjs` + `render-page.html` + `README.md`
- [x] Chạy thử trên file mẫu tự tạo: STL nhị phân, ASCII, 1M tam giác, 3MF có/không ảnh, file hỏng
- [x] `.model-previews/` vào `.gitignore`
- [ ] **Owner** chạy trên 1 thư mục Drive thật (50–200 file) trên Mac, ghi lại: tỉ lệ embedded/rendered/lỗi, thời gian trung bình, ảnh có "đủ đẹp để show" không
- [ ] **Owner** chạy lại trên PC Windows để xác nhận script chạy được trên cả hai máy

**Gate**: chỉ làm Slice 1+ nếu Owner thấy ảnh đủ chất lượng và tỉ lệ lỗi chấp nhận được.

### Slice 1 — DB + service
- [ ] Migration `model_library_items` + cột mới ở `custom_requests` (mục 4); bucket `model-previews` public
- [ ] Zod schema trong `src/domain/schemas.ts`
- [ ] `src/services/model-library.service.ts`: `listPublished` (phân trang, tìm kiếm), `getPublishedBySlug`, `listForAdmin` (lọc status/license/lỗi), `review` (đổi status + license, ghi audit log), `upsertFromManifest`
- [ ] Test: publish guard ở DB, idempotent upsert, API công khai không lộ `source_*`

### Slice 2 — Publish từ script
- [ ] Thêm cờ `--publish` (hoặc script riêng `publish-previews.mjs`) đọc `manifest.json` → upload WebP → upsert DB, đọc `SUPABASE_SERVICE_ROLE_KEY` từ `.env` (không bao giờ commit)
- [ ] Chỉ upload ảnh, **không bao giờ** upload file STL/3MF gốc
- [ ] Dry-run mặc định (giống `cleanup-test-data.mjs`), `--apply` mới ghi thật

### Slice 3 — Admin duyệt
- [ ] `src/app/admin/(protected)/model-library/page.tsx` + `actions.ts`: lưới ảnh, lọc HIDDEN/PUBLISHED/REJECTED/lỗi, chọn nhiều để duyệt hàng loạt, đặt `license_type`, `category_label`, tên hiển thị
- [ ] Hiện rõ cờ `designer_cover` và đường dẫn Drive để admin kiểm tra nguồn
- [ ] `requireAdmin` server-side; test route auth (STAFF/khách → 403)

### Slice 4 — Gallery công khai
- [ ] `src/app/[locale]/(storefront)/models/page.tsx` (lưới ảnh `next/image`, phân trang, tìm kiếm) + `models/[slug]/page.tsx` (ảnh lớn, kích thước bbox, nút "Đặt in mẫu này")
- [ ] Nút → `custom-print?model=<slug>` → form tự điền tên mẫu + `model_library_item_id`; server kiểm tra lại mẫu đang PUBLISHED
- [ ] i18n `messages/vi.json` + `en.json` (test parity), sitemap, link trên header/footer
- [ ] Analytics: `trackModelLibraryView`, `trackModelLibraryRequest`
- [ ] Admin custom request hiển thị mẫu đã chọn + đường dẫn Drive

### Slice 5 — Tests & docs
- [ ] Unit/integration theo từng slice; E2E: khách xem gallery → đặt in → admin thấy mẫu
- [ ] ADR mới trong `docs/architecture/decisions.md` (T1–T7), cập nhật `docs/database/schema.md`, `business-rules.md` (quy tắc publish), `runbook.md` (cách chạy batch), `roadmap.md`

## 6. Ước lượng effort

| Slice | Effort |
|---|---|
| 0 — Spike (còn lại: Owner chạy thử) | 1–2 giờ của Owner |
| 1 — DB + service + test | 1 ngày |
| 2 — Publish script | 0.5 ngày |
| 3 — Admin duyệt | 1 ngày |
| 4 — Gallery + đặt in | 1–1.5 ngày |
| 5 — E2E + docs | 0.5 ngày |
| **Tổng** | **~4–4.5 ngày** + thời gian Owner duyệt license (phụ thuộc số mẫu) |

## 7. Definition of Done

- [ ] Ít nhất 1 batch thật (≥ 100 file) đã xử lý và publish, mẫu được duyệt hiện trên gallery
- [ ] Không mẫu nào có `license_type = 'UNKNOWN'` xuất hiện công khai (DB constraint + test)
- [ ] API/HTML công khai không lộ `source_rel_path`, `source_drive_file_id`, file gốc
- [ ] Chạy lại batch không tạo bản ghi trùng
- [ ] Custom request từ gallery có `model_library_item_id` + snapshot tên
- [ ] lint, typecheck, test, E2E luồng gallery → đặt in, build đều pass

## 8. Câu hỏi mở (cần Owner trả lời trước Slice 1)

- **Q1** — Sau khi chạy spike: số file thật, tỉ lệ embedded/rendered/lỗi, ảnh có đạt chất lượng không?
- **Q2** — Danh mục: lấy theo **tên thư mục** trên Drive có ổn không, hay cần bộ danh mục riêng?
- **Q3** — Ảnh `designer_cover` (ảnh cover của tác giả MakerWorld): cấm hẳn, hay cho phép khi license
  cho phép và có ghi nguồn? Mặc định đề xuất: **cấm**, render lại bằng `--force-render`.
- **Q4** — Các giá trị `license_type` hợp lệ cho thư viện: dùng chung danh sách với `products` (Phase 29)
  + `UNKNOWN`? Các license NC (Non-Commercial) có được publish để nhận đặt in không? (Đề xuất: **không**.)
- **Q5** — Có cần lưu `source_drive_file_id` không? Drive for desktop không đưa ra file ID; nếu cần
  thì phải gọi Drive API một lần để đối chiếu.
- **Q6** — Số lượng ảnh publish dự kiến: dưới ~5.000 thì Supabase Free đủ; hơn nữa cân nhắc R2 (T4).

## 9. Bước tiếp theo theo `PHASE_START_PROTOCOL`

1. Owner chạy Slice 0 trên dữ liệu thật → trả lời Q1–Q6.
2. Chạy `gemini-challenge` cho T1–T7 (nhất là T5 service-role trên máy local và publish guard).
3. Chạy `database-review` cho mục 4.
4. `codex-handoff` cho Slice 1 → 5.
