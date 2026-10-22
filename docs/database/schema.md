# BaSa3D Database — Initial Domain Map

## Core tables
- categories
- products
- product_variants
- product_images
- materials
- warehouses
- inventory_movements
- material_movements
- carts
- cart_items
- orders
- order_items
- custom_requests
- quotes
- print_jobs
- audit_logs
- staff_profiles
- rate_limit_attempts (shared DB rate limiter + Phase 36 per-resource failure budgets)
- blog_categories, blog_posts
- pricing_configs (insert-only since Phase 36)
- filament_spools, expenses (Phase 12)
- makerworld_price_presets, makerworld_resolver_cache (Phase B)
- custom_request_items (Phase 33)
- makerworld_screenshot_estimates (ADR-0039)

Phase 36 (ADR-0040/0041, migration `20261019000000`):
- Every timestamp default is `now()` (was `timezone('utc', now())`, wrong in non-UTC sessions).
- `order_items.product_type_snapshot product_type` (nullable, backfilled); order lines are
  immutable except the FK's own `variant_id → NULL` (`prevent_order_item_edit()`).
- `pricing_configs`: UPDATE/TRUNCATE refused; `quotes`/`products.pricing_config_id` FKs are
  `on delete restrict`.
- DELETE of an `ACCEPTED` quote or a started print job (not `QUEUED`/`CANCELLED`) is refused unless
  the transaction ran `set local basa3d.allow_history_purge = 'on'` (test cleanup only).
- `blog-images` bucket: 5 MB, JPEG/PNG/WEBP. New FK indexes on `print_jobs`, `quotes`, `products`,
  `makerworld_screenshot_estimates`. Function EXECUTE no longer defaults to PUBLIC.

Phase 34 adds nullable `orders.checkout_request_id uuid` and
`orders.checkout_request_hash varchar(64)`. A partial unique index on non-null request IDs makes
guest-checkout retries atomic while leaving staff-created orders unchanged. The pair check requires
both values to be null or a UUID plus a 64-character lowercase SHA-256 hash.

Phase 10 adds nullable `orders.analytics_purchase_sent_at timestamptz` as the server-side,
cross-device idempotency marker for the single GA4 `purchase` event. It does not affect order
financial state or fulfillment workflow.

Phase 33 (ADR-0035):
- `pricing_configs.vat_enabled boolean` + `vat_rate_bps integer` (basis points, 800 = 8%; check
  `pricing_configs_vat_rate_when_enabled`). Default off.
- `quotes` / `orders`: `vat_rate_bps` + `vat_amount bigint` snapshots; total checks are
  `quotes_total_with_vat` (`total = subtotal + shipping_fee - discount + vat_amount`) and
  `orders_total_with_vat` (`… + cod_fee …`), both with `vat_rate_bps > 0 or vat_amount = 0`. The VAT
  formula itself lives in `src/lib/pricing/vat.ts`, not in the DB.
- `custom_request_items` — one row per file of a multi-item `/bao-gia` request (position 1–50 since `20261015000002`,
  `attachment_path` unique, config, `verification` VERIFIED | CLIENT_REPORTED | MISMATCH | UNPRICED,
  `estimate_snapshot jsonb` validated by `customRequestItemEstimateSchema`). Immutable: trigger
  `prevent_custom_request_item_mutation()` rejects every UPDATE and any DELETE unless the session ran
  `set local basa3d.allow_item_purge = 'on'` (test cleanup / audited personal-data deletion only). RLS on.
  Such requests keep `custom_requests.attachment_path = NULL` and `quantity = Σ items`.
- `quotes.custom_request_item_id` (nullable) + composite FK `quotes_item_same_request`
  `(custom_request_item_id, custom_request_id) → custom_request_items(id, custom_request_id)`.
- Storage bucket `custom-request-attachments`: 50MB, MIME allowlist; uploads via signed URLs; daily
  orphan cleanup cron reads `storage.objects`.

## Rules
- UUID primary keys unless there is a clear reason otherwise.
- Add created_at/updated_at to mutable business tables.
- Use unique constraints for business identities such as SKU and slug.
- Use foreign keys deliberately.
- Add indexes based on real query patterns, not guesses.

## Status enums (Phase 0 decision — see ADR-0004/0005/0008/0009)

### `orders.status` — trạng thái xử lý đơn (chỉ tiến, không lùi trừ CANCELLED)
`NEW → CONFIRMED → PRODUCING → READY_TO_SHIP → SHIPPED → COMPLETED`, cộng
thêm `CANCELLED` (được phép từ NEW/CONFIRMED/PRODUCING/READY_TO_SHIP, không
lùi lại sau khi đã SHIPPED — trường hợp đó xử lý qua return riêng, không lùi
state).

### `orders.payment_status` (độc lập với `status`)
`UNPAID → DEPOSIT_PAID → PAID`, cộng `REFUNDED`. `DEPOSIT_PAID` dùng khi nhận cọc cho đơn hàng có giá trị từ 300.000 VNĐ trở lên (hoặc theo thoả thuận với khách hàng, ADR-0009).

### `orders.shipping_status` (độc lập với `status`)
`PENDING → SHIPPED → DELIVERED`, cộng `RETURNED`.

### `inventory_movements.movement_type` (Tồn kho sản phẩm `product_variants` — đếm theo cái)
`PURCHASE`, `PRODUCTION_IN`, `SALE_OUT`, `RETURN_IN`, `DAMAGE_OUT`,
`ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`.

Quy ước ghi `SALE_OUT`: ghi nhận khi `orders.status` chuyển sang `PRODUCING`
(không phải lúc tạo đơn) — thời điểm này áp dụng chung cho cả `READY_STOCK` và
`MADE_TO_ORDER` (với `READY_STOCK`, `PRODUCING` đại diện cho công đoạn soạn/chuẩn bị hàng).
Trước đó (NEW/CONFIRMED), số lượng chỉ ở trạng thái "reserved" (theo dõi riêng, không phải một movement trong ledger vì có thể bị huỷ/hết hạn).

### `material_movements.movement_type` (Tồn kho nguyên liệu `materials` — tính theo gram/cuộn, ADR-0008)
`PURCHASE`, `PRODUCTION_OUT`, `RETURN_IN`, `DAMAGE_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`.
Dùng để theo dõi nhập kho cuộn nhựa mới (`PURCHASE`) và tiêu hao nguyên liệu khi in sản phẩm (`PRODUCTION_OUT`).
Bảng `material_movements` có các cột tham chiếu: `reference_type` (varchar, nullable, ví dụ: `PRINT_JOB`, `PURCHASE_ORDER`, `ADJUSTMENT`) và `reference_id` (UUID, nullable) để gắn vết lượt tiêu hao nguyên liệu với đúng `print_job` hoặc đơn nhập hàng tương ứng (giúp đối chiếu COGS chuẩn xác).

### `custom_requests.source_channel`
`ZALO`, `FACEBOOK`, `INSTAGRAM`, `TIKTOK`, `OTHER` — thêm để biết kênh nào ra
đơn nhiều nhất (Phase 0 decision, xem ADR-0007).
Phase 4 bổ sung giá trị `WEBSITE`
(`supabase/migrations/20260831000000_public_custom_request_support.sql`) cho các
yêu cầu gửi từ form công khai trên storefront (`POST /api/public/custom-requests`).

### `custom_requests.attachment_path` (Hardening, ADR-0016)
`text`, nullable — bucket-relative path của file khách upload vào private bucket
`custom-request-attachments`. Không lưu public URL; admin lấy signed URL ngắn
hạn sau khi xác thực server-side.

### Enum bổ sung từ Phase 1 migration (Codex, chưa qua Phase 0 nhưng đã review)
Các enum sau chưa được thảo luận rõ ở Phase 0, do Codex tự quyết khi viết
migration thật (`supabase/migrations/20260830000000_initial_domain_schema.sql`).
Đã review, hợp lý, ghi lại đây để tài liệu khớp với schema thật:
- `products.status` (`product_status`): `DRAFT`, `ACTIVE`, `ARCHIVED`.
- `materials.unit` (`material_unit`): `GRAM`, `SPOOL`.
- `custom_requests.status` (`custom_request_status`): `NEW`, `REVIEWING`,
  `NEED_INFO`, `QUOTED`, `APPROVED`, `REJECTED`, `CONVERTED`.
- `quotes.status` (`quote_status`): `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`,
  `EXPIRED`.
- `print_jobs.status` (`print_job_status`): `QUEUED`, `PRINTING`, `FAILED`,
  `REPRINT`, `QC`, `COMPLETED`, `CANCELLED`.
- `product_variants.attributes` là `jsonb` (thay vì cột `color`/`size` cứng) —
  linh hoạt hơn, khớp tinh thần review ban đầu về việc tránh hard-code thuộc
  tính variant.

### `carts` / `cart_items` (Phase 0 — cố tình không dùng ở Phase 5, xem ADR-0014)
Thiết kế sẵn từ Phase 0 nhưng **chưa có service/API nào dùng** — Phase 5
(cart/checkout) chọn lưu cart hoàn toàn client-side (`localStorage`) vì MVP
chỉ có guest checkout, không có tài khoản khách hàng nên không cần cart đồng
bộ đa thiết bị. Không xoá, không migrate — nếu sau này có tài khoản khách
hàng và cần cart đa thiết bị, quay lại dùng 2 bảng này.

### `staff_profiles` (Phase 3 — xem ADR-0011 / ADR-0012)
Bảng hồ sơ phân quyền nhân viên nội bộ (liên kết 1-1 với `auth.users` của Supabase Auth):
- `id`: `uuid primary key references auth.users(id) on delete restrict` (changed from cascade by
  `20260901000001` — deleting an Auth user must not silently erase the staff/audit link)
- `full_name`: `varchar(200) not null check (btrim(full_name) <> '')`
- `role`: `staff_role not null` — no default; callers always choose (`create type staff_role as enum ('OWNER', 'STAFF')`)
- `is_active`: `boolean not null default true`
- `created_at`, `updated_at`: `timestamptz not null default now()` (Phase 36)

### `filament_spools` (Phase 12 — see ADR-0025)
Per-physical-spool filament inventory, extending `materials`/`material_movements` (ADR-0008) down
to individual spool granularity:
- `id`, `spool_code varchar(60) unique` (e.g. `PLA-L-L-001`), `material_id` / `warehouse_id` (FK,
  `on delete restrict`).
- `initial_weight_grams integer` (default 1000), `used_weight_grams integer` (cached counter,
  `check (used_weight_grams between 0 and initial_weight_grams)`), `purchase_cost bigint` (VND
  minor unit, OWNER-only via server-side masking, never sent to STAFF).
- `has_spool boolean` (true = "Có lõi", false = "Không lõi").
- `status varchar(30) check (status in ('ACTIVE', 'ARCHIVED'))` — only 2 manually-set values (Q5).
  The 4-tier UI warning (Còn nhiều/Cần theo dõi/Sắp hết/Đã hết) is always computed at query time
  from `(initial_weight_grams - used_weight_grams) / initial_weight_grams`, never stored.
- `note`, `created_at`, `updated_at`.

`material_movements.spool_id` (nullable FK, `on delete restrict`, indexed with `created_at desc`)
ties per-spool consumption into the existing immutable raw-material ledger. `print_jobs.spool_id`
(nullable FK) records which specific spool a print job consumes — nullable because jobs created
before Phase 12, or against materials with no tracked spools yet, keep using the pre-Phase-12
`lockMaterialForInventoryWrite` path unchanged.

### `expenses` (Phase 12 — see ADR-0026)
Workshop expense tracking, 100% OWNER-only:
- `id`, `expense_code varchar(40) unique` (e.g. `EXP-20260819-001`), `title`, `category varchar(50)
  check (category in ('EQUIPMENT', 'MATERIAL', 'ACCESSORIES', 'UTILITIES', 'LOGISTICS',
  'MARKETING', 'OTHER'))`.
- `amount bigint` (VND minor unit), `quantity integer` (default 1), `status varchar(30) check
  (status in ('PAID', 'PENDING', 'CANCELLED'))` (default `PAID`).
- `payer_name`, `spent_at`, `note`, `created_by uuid` (plain uuid, no FK — same convention as
  `material_movements.created_by`/`pricing_configs.created_by`; `audit_logs` is the authoritative
  actor trail), `created_at`, `updated_at`.
- `deleteExpense` is a soft-cancel (`status = 'CANCELLED'`), never a real `DELETE` (business-rules.md #7/#17).

### `product_import_items` (Feature 003 — see ADR-0049)
Staging metadata for products imported from the Drive STL library, 1–1 with `products` (`product_id unique`, FK
`on delete set null`). Server-only: RLS enabled with no policy, no grant to `anon`/`authenticated`; public queries never
select it.
- Source: `source_key varchar(40) unique` (sha1 hex of the NFC path, CHECK `^[0-9a-f]{40}$`), `source_rel_path`
  (admin-only), `source_dir` (parent folder, filter), `group_mode` (`FILE`|`FOLDER`), `source_files jsonb` (array of
  `{relPath, bytes, mtimeMs}`), `source_bytes`, `source_mtime`.
- Measurements: `bbox_mm jsonb` (`{x,y,z}`), `volume_cm3 numeric(12,3)`, `triangle_count`, `warnings jsonb` (array).
- Processing: `render_status` (`PENDING`|`RENDERED`|`ERROR`), `process_error` (≤ 2,000 chars), `needs_rerender`,
  `needs_price_review`, `source_changed_at`.
- Review: `license_reviewed` (+ `_by`/`_at`), `review_status` (`PENDING`|`APPROVED`|`REJECTED`), `reviewed_by`
  (FK `staff_profiles`, `on delete set null`), `reviewed_at`; CHECK `(review_status = 'PENDING') = (reviewed_at is null)`.
- `updated_at` maintained by `set_updated_at()` (the admin page's optimistic lock relies on it).
- Triggers: `products_import_publish_gate` (`before insert or update of status on products … when new.status = 'ACTIVE'`)
  raises `IMPORT_PUBLISH_BLOCKED:<reasons>`; `product_import_items_link_gate` refuses linking/un-approving/un-reviewing an
  item whose product is `ACTIVE` (`IMPORT_LINK_BLOCKED`). Both functions `security definer`, `search_path = ''` (the gate must see every import item regardless of the caller's grants/RLS).
- Category `chua-phan-loai` ("Chưa phân loại", `is_active = false`) is seeded by the migration.
- Category `keycap` ("Keycap", active) is seeded by `20261022000100_keycap_category.sql` — target of the `KeyCap3D` rule in `scripts/stl-import/category-map.json` (SKU `KCP`).
- `products.license_type` gains the documented value `UNKNOWN` (still no CHECK — Phase 29 decision; Zod validates).
