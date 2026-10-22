# Nghiên cứu: Phân loại & gắn tag sản phẩm (category + tag + facet)

> Trạng thái: **nghiên cứu** (2026-10-22). Không phải spec, không phải migration. SQL trong tài liệu là **nháp**.
> Đầu vào đã đọc: `AGENTS.md`, `CLAUDE.md`, `docs/product/catalog-spec.md`,
> `supabase/migrations/20260830000000_initial_domain_schema.sql` (categories, products),
> `20260831000002_blog.sql` (tags `text[]`), `20261015000003_keychain_category.sql`, `20261022000000_stl_bulk_import.sql`,
> `20261022000100_keycap_category.sql`, `src/domain/schemas.ts`, `src/services/product.service.ts`,
> `src/services/storefront-catalog.service.ts`, `src/app/[locale]/(storefront)/products/page.tsx`, `src/app/sitemap.ts`,
> `src/i18n/seo.ts`, `src/lib/stl-import/{category-map,naming,metrics}.ts`, `src/lib/copyright/ip-risk-keywords.ts`,
> `scripts/stl-import/category-map.json`, `docs/exec-plans/active/feature-003-stl-bulk-import.md`,
> `docs/prompts/feature-003-test-run.md`.
> Nguồn web ghi ở cuối mỗi mục; `[2ND]` = nguồn thứ cấp, `[?]` = chưa kiểm chứng được.

---

## 1. Tóm tắt (5 dòng) + khuyến nghị

1. **Category = "đây là cái gì"** (1/sản phẩm, quyết định CATEGORY_CODE của SKU); **tag = mọi chiều còn lại khách muốn lọc** (chủ đề, dịp, vị trí, phong cách); **thuộc tính variant** = màu/vật liệu/kích thước (đã có `product_variants.attributes jsonb`).
2. Cây category hiện tại trộn "loại" với "chủ đề" (FIG › Anime/Game/Movie) và "dịp" (GIFT) — đề xuất làm phẳng về 6 nhánh loại sản phẩm, chuyển chủ đề/dịp sang tag; giữ nguyên KCP/KEY/FIG/DEC/ACC.
3. Mô hình dữ liệu chọn **(b) bảng `tags` + `product_tags` có `tag_group`**, kèm `tag_aliases` (gộp tag, slug cũ không vỡ link) và cờ `visibility` để tag thương hiệu **không bao giờ** lên storefront (ép bằng CHECK ở DB).
4. Storefront: lọc tự do bằng query string (`noindex`), chỉ một số trang "sạch" được index: `/danh-muc/[slug]` và `/chu-de/[slug]` (tag đủ sản phẩm + có mô tả riêng). Mobile: bottom sheet + nút "Xem N sản phẩm" + chip đã chọn phía trên lưới.
5. Auto-tag khi nhập STL chỉ sinh **đề xuất** lưu ở `product_import_items.suggested_tags` (không ở `product_tags`), admin duyệt trong `/admin/stl-import`. **Không** dùng auto-tag để phát hiện IP: từ điển hiện tại chỉ bắt 7/45 thư mục KeyCap3D → admin bắt buộc khai "Không có IP" / "Thương hiệu: …" trước khi duyệt (mục 6.3).

**Khuyến nghị**: MVP = lát 0 → 1 → 2 → 4 (chỉ facet) ≈ 7 ngày; đủ 6 lát ≈ 12 ngày (mục 8). Trước lát 1 cần OWNER chốt Q1–Q3 (mục 9). Slug sản phẩm chứa tên thương hiệu đã tách thành việc của feature 003 ("trước khi public"); BLOCKER còn lại (CATEGORY_CODE chưa nằm trong DB) chỉ chặn lát thêm category cấp con.

---

## 2. Chiều phân loại → category / tag / thuộc tính

| Chiều | Ví dụ | Đặt ở đâu | Lý do |
|---|---|---|---|
| Loại sản phẩm | keycap, móc khoá, figure, đồ decor | **Category** (1/sản phẩm) | Loại trừ lẫn nhau; quyết định CATEGORY_CODE của SKU (bất biến); quy tắc gate import đã dựa vào category. |
| Loại con | keycap đơn / bộ keycap; chậu cây / đèn | **Category con** (tối đa cấp 2) | Vẫn là "cái gì"; chỉ thêm khi một nhánh có ≥ ~15 sản phẩm. |
| Chủ đề | anime, game, động vật, cây cối, ẩm thực, chữ/tên | **Tag** `theme` (nhiều) | Một keycap có thể vừa "game" vừa "động vật". |
| Thương hiệu / IP | Pokémon, Mario, Naruto, Warhammer | **Tag** `franchise` — **chỉ nội bộ** | Rủi ro trademark (mục 7); vẫn cần để quản trị/lọc nội bộ/archive hàng loạt. |
| Vị trí dùng | để bàn, treo tường, bàn phím, ô tô, balo/chìa khoá | **Tag** `placement` | Nhiều giá trị; "để bàn" áp cho cả figure lẫn decor. |
| Dịp | quà tặng, sinh nhật, Tết, Valentine, Giáng sinh, tốt nghiệp | **Tag** `occasion` | Thay category GIFT cũ (quà tặng không phải là "loại"). |
| Người nhận | cho game thủ, cho bé, dân văn phòng | **Tag** `audience` (giai đoạn 2) | Hữu ích cho landing quà tặng; chưa cần ngay. |
| Phong cách | dễ thương/chibi, tối giản, retro, low-poly, kinh dị | **Tag** `style` | Nhiều giá trị, mang tính biên tập. |
| Cá nhân hoá được | khắc tên | **Cột có sẵn** `products.is_customizable` | Boolean, không cần tag. |
| Sẵn hàng / làm theo đơn | READY_STOCK / MADE_TO_ORDER | **Cột có sẵn** `products.product_type` | Đã có filter `?type=`. |
| Kích thước | nhỏ < 30 mm, vừa, lớn > 150 mm; cỡ phím 1u/2u | **Thuộc tính variant** (`attributes.size`) + bucket suy ra từ bbox | Giá/khối lượng đổi theo cỡ → phải ở variant. Facet kích thước: để giai đoạn 2. |
| Vật liệu / màu | PLA, PETG, resin; đỏ/đen | **Thuộc tính variant** (`attributes.material`, `attributes.color`) | Giá/tồn kho theo variant; seed hiện có `{"color":"Black"}`. |
| Tương thích keycap | MX stem, profile | **Tag** `spec` (giai đoạn 1) → thuộc tính có kiểu nếu sau này cần | Ít giá trị, chỉ áp cho 1 category; chưa đáng làm EAV. |
| Giá | khoảng giá | **Cột có sẵn** `base_price` | Facet khoảng giá tính từ cột, không phải tag. |

Quy tắc: *nếu giá trị khác nhau giữa các variant của cùng sản phẩm → thuộc tính variant; nếu loại trừ lẫn nhau và quyết định SKU → category; còn lại → tag.*

---

## 3. Cây category đề xuất + tag khởi điểm

### 3.1 Hiện trạng (khác với catalog-spec mục 1)
- DB thật (seed + migration): `keychain` (sort 0, top-level), `accessories-gadgets`, `home-decor`, `figure-model`, `keycap`, `chua-phan-loai` (ẩn). **Không** có GIFT/PART, không có nhánh con.
- `KEY` và `KCP` không có trong catalog-spec mà chỉ có trong `category-map.json`. CATEGORY_CODE **không lưu trong DB** — chỉ nằm ở file JSON và chuỗi SKU (xem BLOCKER #1).
- Catalog-spec đặt Keychain dưới ACC, nhưng DB để `keychain` top-level với code KEY → tài liệu lệch thực tế.

### 3.2 Cây đề xuất (thay mục 1 catalog-spec)

```
Keycap (KCP)                       slug keycap            ← giữ
├── Keycap đơn (artisan)           keycap-don
└── Bộ keycap                      bo-keycap
Móc khoá (KEY)                     slug keychain          ← giữ, top-level như DB
Figure & Mô hình (FIG)             slug figure-model      ← giữ; BỎ nhánh con Anime/Game/Movie → tag theme
├── Figure nhân vật                figure-nhan-vat
└── Mô hình trưng bày              mo-hinh-trung-bay
Trang trí nhà cửa (DEC)            slug home-decor        ← giữ
├── Chậu cây                       chau-cay
├── Đèn                            den-trang-tri
└── Treo tường                     treo-tuong   (cân nhắc: đây là "vị trí" → có thể chỉ cần tag placement)
Phụ kiện & Tiện ích (ACC)          slug accessories-gadgets ← giữ
├── Phụ kiện điện thoại            phu-kien-dien-thoai
└── Organizer / khay bàn           organizer
Linh kiện chức năng (PART)         slug functional-parts  ← code đã định nghĩa, chưa dùng; chỉ tạo khi có sản phẩm
Chưa phân loại (UNC)               slug chua-phan-loai    ← ẩn, giữ nguyên (gate import)
```

- **GIFT bị loại khỏi cây**: "Quà tặng" chuyển thành tag `occasion/qua-tang`; "Nameplate cá nhân hoá" → ACC + `is_customizable`; "Cosplay props" → FIG. Code `GIFT` đánh dấu *reserved, không dùng lại* (chưa có SKU thật — xác nhận ở Q2).
- Nhánh con **không** có CATEGORY_CODE riêng: SKU luôn lấy code của tổ tiên cấp 1. Cần một quy tắc + kiểm tra ở DB (BLOCKER #1).
- Chỉ tạo nhánh con khi đủ sản phẩm; trước đó tag đã đủ để lọc.
- Đổi slug category: **không** đổi 5 slug đang có (đã nằm trong `category-map.json`, test, có thể trong link). Nếu sau này cần, dùng bảng alias như tag (mục 4).

### 3.3 Danh sách tag khởi điểm (44 tag)

`visibility`: **P** = PUBLIC (lên storefront), **I** = INTERNAL (chỉ admin). `idx` = được làm landing page indexable (khi đủ ≥ 6 sản phẩm).

| tag_group | slug | vi | en | vis | idx |
|---|---|---|---|---|---|
| theme | anime | Anime | Anime | P | ✓ |
| theme | game | Game | Gaming | P | ✓ |
| theme | retro-game | Game retro | Retro gaming | P | ✓ |
| theme | dong-vat | Động vật | Animals | P | ✓ |
| theme | meo | Mèo | Cats | P | ✓ |
| theme | cho | Chó | Dogs | P | |
| theme | khung-long | Khủng long | Dinosaurs | P | ✓ |
| theme | cay-co-hoa | Cây cỏ & hoa | Plants & flowers | P | |
| theme | do-an | Đồ ăn | Food | P | |
| theme | quai-vat | Quái vật dễ thương | Cute monsters | P | |
| theme | phim-anh | Phim ảnh | Movies | P | |
| theme | kinh-di | Kinh dị | Horror | P | |
| theme | khoa-hoc-vu-tru | Vũ trụ | Space | P | |
| theme | chu-ten | Chữ & tên | Letters & names | P | ✓ |
| theme | xe-co | Xe cộ | Vehicles | P | |
| theme | tet-viet-nam | Văn hoá Việt | Vietnamese culture | P | |
| placement | de-ban | Để bàn | Desk | P | ✓ |
| placement | ban-phim | Bàn phím | Keyboard | P | |
| placement | treo-tuong | Treo tường | Wall | P | |
| placement | o-to | Ô tô | Car | P | |
| placement | balo-chia-khoa | Balo & chìa khoá | Bag & keys | P | |
| placement | ke-sach | Kệ sách | Bookshelf | P | |
| occasion | qua-tang | Quà tặng | Gifts | P | ✓ |
| occasion | sinh-nhat | Sinh nhật | Birthday | P | ✓ |
| occasion | valentine | Valentine | Valentine's Day | P | |
| occasion | giang-sinh | Giáng sinh | Christmas | P | ✓ (mùa) |
| occasion | tet | Tết | Lunar New Year | P | ✓ (mùa) |
| occasion | tot-nghiep | Tốt nghiệp | Graduation | P | |
| occasion | qua-doanh-nghiep | Quà doanh nghiệp | Corporate gifts | P | |
| style | de-thuong | Dễ thương / chibi | Cute / chibi | P | |
| style | toi-gian | Tối giản | Minimalist | P | |
| style | low-poly | Low-poly | Low-poly | P | |
| style | retro | Retro | Retro | P | |
| style | nhieu-mau | In nhiều màu | Multicolor | P | |
| spec | mx-stem | Chân MX | MX stem | P | |
| spec | cherry-profile | Profile Cherry | Cherry profile | P | |
| spec | in-nhieu-mau-ams | In đa màu AMS | Multi-material | I | |
| franchise | pokemon | Pokémon | Pokémon | **I** | ✗ |
| franchise | mario | Mario | Mario | **I** | ✗ |
| franchise | kirby | Kirby | Kirby | **I** | ✗ |
| franchise | naruto | Naruto | Naruto | **I** | ✗ |
| franchise | dragon-ball | Dragon Ball | Dragon Ball | **I** | ✗ |
| franchise | genshin | Genshin Impact | Genshin Impact | **I** | ✗ |
| franchise | warhammer | Warhammer | Warhammer | **I** | ✗ |

(Thêm `franchise` khác từ danh sách test-run: Mandalorian/Star Wars, Toothless/HTTYD, Hollow Knight, Freddy Krueger, Scream — đều **I**.)

Gợi ý alias khởi điểm (mục 4, `tag_aliases`): `moc-khoa`, `keychain` → *(đây là category, không phải tag — alias trỏ về category landing)*; `qua`, `gift`, `present` → `qua-tang`; `cute`, `chibi`, `kawaii` → `de-thuong`; `pikachu`, `gengar`, `psyduck`, `bulbasaur` → `pokemon`; `luigi`, `yoshi`, `bowser`, `toad` → `mario`; `goku`, `vegeta` → `dragon-ball`; `40k` → `warhammer`; `dino`, `t-rex` → `khung-long`.

---

## 4. Mô hình dữ liệu

### 4.1 So sánh

| Tiêu chí | (a) `products.tags text[]` + GIN | (b) `tags` + `product_tags` (+ `tag_group`) | (c) `attribute_definitions` + `product_attribute_values` |
|---|---|---|---|
| Lọc nhiều tag (AND giữa nhóm, OR trong nhóm) | `tags @> array[...]` (AND) và `tags && array[...]` (OR); muốn theo nhóm thì phải mã hoá nhóm vào chuỗi (`theme:anime`) | `exists` theo từng nhóm trên bảng nối; index `(tag_id, product_id)` | Truy vấn EAV: mỗi facet một `exists`/join; viết đúng khó hơn |
| Đếm sản phẩm mỗi tag | `unnest(tags)` + `group by` — chạy được ở quy mô nhỏ, không có index giúp | `group by tag_id` trên bảng nối, có index | Như (b), thêm phân nhánh theo kiểu giá trị |
| Slug URL không dấu | Tự làm, trùng lặp do chuỗi tự do (`móc khoá`/`moc-khoa`) | `tags.slug unique` + CHECK regex như `categories.slug` | Như (b) cho giá trị enum |
| i18n vi/en | **Không**: giá trị là chuỗi; phải có bảng dịch riêng → thành (b) | `name_vi`, `name_en` trên dòng tag | Phải dịch cả định nghĩa lẫn giá trị |
| Đổi tên không vỡ link | `array_replace` trên mọi sản phẩm; link cũ chết | Đổi `name_*` tự do; đổi `slug` → ghi alias cũ → 301 | Như (b) |
| Tag mồ côi | Không nhìn thấy (không có "danh mục tag") | Đếm 0 → hiện ở admin; archive thay vì xoá | Như (b) |
| Ẩn tag thương hiệu | Không có chỗ để cờ | `visibility` + CHECK `franchise ⇒ INTERNAL` | Có được, phức tạp hơn |
| Quyền sửa | Gắn = sửa sản phẩm (requireAdmin) | Gắn: requireAdmin; tạo/đổi slug/gộp/xoá/công khai: requireOwner | Định nghĩa thuộc tính: requireOwner |
| Audit log | Diff mảng trong `PRODUCT_UPDATED` | `PRODUCT_TAGS_CHANGED`, `TAG_*` riêng | Nhiều loại sự kiện |
| Toàn vẹn dữ liệu | Không FK; typo tạo tag mới âm thầm | FK + unique + CHECK | FK + kiểu, nhưng EAV dễ sai kiểu/giá trị |
| Chi phí migration | 1 migration nhỏ (1 cột + GIN) — ~0,5 ngày | 1 migration (3 bảng + RLS + trigger) — ~1 ngày | 2–3 bảng + kiểu giá trị + seed định nghĩa — ~2–3 ngày |
| Ảnh hưởng test | Ít: vài test service | Test service/DB mới (gộp, alias, visibility, quyền); storefront filter; ~30–40 test | Nhiều nhất; test kiểu giá trị, ràng buộc theo category |
| Khi nào hợp | Blog (đã dùng, không cần filter — đúng như quyết định Phase 7) | Shop cần facet đa chiều, i18n, SEO landing | Catalog lớn, thuộc tính số có kiểu (vd. đường kính, watt) |

Đối chiếu thị trường: Etsy tách **attribute** (có cấu trúc, dùng làm bộ lọc) khỏi **tag** (tự do, chỉ để khớp tìm kiếm; 13 tag/listing). WooCommerce: category phân cấp, tag phẳng, attribute (`pa_*`) cho layered nav. Shopify: tag + automated collections theo luật tag; filter "tag" không dịch được, filter có kiểu cần metafield. → Phương án (b) có "tag có nhóm + dịch + ẩn/hiện" chính là thứ Shopify phải ghép tag + metafield mới có.

### 4.2 Chọn: (b), kèm 2 bổ sung

1. **`tag_aliases`** — một bảng giải quyết 3 việc: slug cũ sau đổi tên (301), gộp tag trùng, từ đồng nghĩa khi gõ/auto-tag.
2. **Đề xuất auto-tag không nằm trong `product_tags`** — nằm ở `product_import_items.suggested_tags jsonb`. `product_tags` chỉ chứa tag đã được người xác nhận, nên storefront không bao giờ cần lọc theo trạng thái (không có đường rò "tag đề xuất lên web").

Màu/vật liệu/kích thước **không** làm EAV: dùng `product_variants.attributes` đã có. Nếu sau này cần facet màu, thêm index biểu thức `((attributes->>'color'))` — không đổi kiến trúc.

### 4.3 Schema SQL nháp (KHÔNG phải migration)

```sql
-- NHÁP. Theo quy ước repo: timestamptz default now() (KHÔNG dùng timezone('utc', now()) — xem
-- 20261019000000_phase_36_data_integrity.sql: hàm đó trả timestamp không múi giờ, bị diễn giải theo
-- TimeZone của session), slug regex như categories, RLS bật, không policy public
-- (storefront đọc qua service server-side bằng pg, giống 20261012000000_enable_rls_public_tables.sql).

create table tags (
  id uuid primary key default gen_random_uuid(),
  tag_group varchar(16) not null check (tag_group in ('theme','placement','occasion','audience','style','spec','franchise')),
  slug varchar(80) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_vi varchar(80) not null check (btrim(name_vi) <> ''),
  name_en varchar(80) check (name_en is null or btrim(name_en) <> ''),
  description_vi text,          -- nội dung landing /chu-de/[slug]; thiếu → không index
  description_en text,
  visibility varchar(10) not null default 'INTERNAL' check (visibility in ('PUBLIC','INTERNAL')),
  is_indexable boolean not null default false,
  is_active boolean not null default true,      -- archive thay vì xoá
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Chính sách mục 7: tag thương hiệu không bao giờ public/indexable — ép ở DB, không chỉ ở UI.
  constraint tags_franchise_internal check (tag_group <> 'franchise' or (visibility = 'INTERNAL' and not is_indexable)),
  constraint tags_indexable_public check (not is_indexable or visibility = 'PUBLIC')
);

-- Slug cũ, tên tag đã gộp, từ đồng nghĩa. alias đã chuẩn hoá bằng slugify() (cùng hàm naming.ts).
create table tag_aliases (
  alias varchar(80) primary key check (alias ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tag_id uuid not null references tags(id) on delete cascade,
  kind varchar(12) not null check (kind in ('OLD_SLUG','MERGED','SYNONYM')),
  created_at timestamptz not null default now()
);
-- Alias không được trùng slug đang sống (kiểm tra bằng trigger hai chiều, hoặc ở service trong cùng transaction
-- có khoá tags `for update` — chọn trigger để mọi đường ghi đều đúng).

create table product_tags (
  product_id uuid not null references products(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete restrict,   -- xoá tag phải gỡ có chủ đích (OWNER, có audit)
  source varchar(12) not null default 'MANUAL' check (source in ('MANUAL','IMPORT_SUGGESTION','BULK')),
  created_by uuid,               -- như audit_logs.actor_id: không FK staff_profiles
  created_at timestamptz not null default now(),
  primary key (product_id, tag_id)
);
create index product_tags_tag_idx on product_tags (tag_id, product_id);

-- Đề xuất của auto-tag (mục 6), tách khỏi product_tags.
alter table product_import_items
  add column suggested_tags jsonb not null default '[]'::jsonb check (jsonb_typeof(suggested_tags) = 'array');
-- phần tử: {"slug":"pokemon","source":"FOLDER|FILENAME|BBOX|CATEGORY_DEFAULT","confidence":0.9,
--           "reason":"thư mục '2 keycaps mario'","status":"PENDING|ACCEPTED|REJECTED"}

-- Category: i18n + CATEGORY_CODE ở DB (BLOCKER #1 — chỉ cần trước category cấp con)
alter table categories add column name_en varchar(160);
alter table categories add column sku_code varchar(8) check (sku_code ~ '^[A-Z0-9]{1,8}$');
-- sku_code: bắt buộc cho category cấp 1, null cho cấp con; trigger chặn UPDATE sku_code khi đã khác null
-- (bất biến như SKU). category-map.json đối chiếu với cột này thay vì tự giữ skuCode.

create trigger tags_set_updated_at before update on tags for each row execute function set_updated_at();
alter table tags enable row level security;
alter table tag_aliases enable row level security;
alter table product_tags enable row level security;
```

Truy vấn lọc (AND giữa nhóm, OR trong nhóm) và đếm facet "disjunctive" (đếm của nhóm X tính với bộ lọc của **các nhóm khác**, để chọn thêm giá trị trong cùng nhóm không ra 0):

```sql
-- $1 = uuid[] tag đã chọn nhóm theme, $2 = uuid[] nhóm occasion ... (nhóm rỗng → bỏ điều kiện)
select p.id from products p
where p.status = 'ACTIVE'
  and exists (select 1 from product_tags pt where pt.product_id = p.id and pt.tag_id = any($1))
  and exists (select 1 from product_tags pt where pt.product_id = p.id and pt.tag_id = any($2));

-- Đếm cho nhóm theme: áp mọi điều kiện trừ nhóm theme; chỉ tag PUBLIC + active
select t.id, count(*) from tags t
join product_tags pt on pt.tag_id = t.id
join products p on p.id = pt.product_id and p.status = 'ACTIVE' /* + điều kiện category/type/nhóm khác */
where t.tag_group = 'theme' and t.visibility = 'PUBLIC' and t.is_active
group by t.id;
```

Ở quy mô hiện tại (vài trăm–vài nghìn sản phẩm), N+1 nhóm × một `group by` là đủ nhanh; cache qua `invalidatesStorefrontCatalog` như hiện có. Không cần search engine ngoài.

### 4.4 Quy tắc nghiệp vụ & quyền (đề xuất đưa vào `business-rules.md`)

| Hành động | Quyền | Audit action |
|---|---|---|
| Gắn/gỡ tag cho sản phẩm (đơn lẻ / hàng loạt) | `requireAdmin` (STAFF được — giống sửa sản phẩm) | `PRODUCT_TAGS_CHANGED` mỗi sản phẩm, before/after là mảng slug |
| Tạo tag mới | `requireAdmin`, nhưng **luôn tạo INTERNAL** | `TAG_CREATED` |
| Chuyển PUBLIC / bật indexable / sửa mô tả landing | `requireOwner` (ảnh hưởng SEO + URL công khai) | `TAG_UPDATED` |
| Đổi slug (ghi alias OLD_SLUG), gộp tag, archive, xoá | `requireOwner` | `TAG_SLUG_CHANGED`, `TAG_MERGED` (kèm danh sách product_id bị dời), `TAG_ARCHIVED`, `TAG_DELETED` |

- **Tag khớp từ điển IP → tự thành `franchise`**: khi tạo hoặc đổi `name_vi`/`name_en`/`slug`/alias của một tag,
  service chạy cùng bộ so khớp với `ip-risk-keywords.ts` (từ điển hợp nhất, mục 6.3). Khớp → `tag_group` bị ép thành
  `franchise` (kéo theo `INTERNAL`, không indexable nhờ CHECK) trong **cùng transaction**, audit ghi lý do
  `IP_DICTIONARY_MATCH` + từ khoá khớp. Áp cho mọi đường ghi (form, bulk, gộp, auto-tag). Lưu ý dương tính giả với từ
  phổ thông trong từ điển (vd. "frozen", "ford") → OWNER chỉ được chuyển sang nhóm `licensed` (có bằng chứng
  license) hoặc sửa từ điển, **không** được hạ thẳng về `theme`. Kiểm ở service (từ điển là code TS); CHECK ở DB vẫn
  là chốt chặn cuối cho nhóm `franchise`.
- **Gộp tag** (A → B) trong 1 transaction: khoá 2 dòng `tags` `for update` theo thứ tự id (tránh deadlock khi 2 admin gộp chéo) → `insert into product_tags … select … on conflict do nothing` → xoá dòng của A → chuyển alias của A sang B → thêm alias `MERGED` = slug A → xoá (hoặc archive) A. Idempotent nếu gọi lại.
- **Tag mồ côi**: không tự xoá. Storefront ẩn tag có 0 sản phẩm ACTIVE (facet chỉ hiện count > 0); landing `/chu-de/x` về 404 khi < ngưỡng. Admin có bộ lọc "0 sản phẩm" để archive.
- **Đồng thời**: gắn tag là `insert … on conflict do nothing` / `delete` theo khoá chính — không cần optimistic lock. Sửa thông tin tag dùng `updated_at` như feature 003.
- **Zod ở biên**: `tagInputSchema` (slug regex dùng chung `SLUG_RE`, `tag_group` enum), `productTagsPatchSchema { add: uuid[] ≤ 30, remove: uuid[] ≤ 30 }`, `bulkTagSchema { productIds ≤ 200, add, remove }`. UI chỉ gọi service, không đụng bảng.
- **Slug**: dùng lại `slugify()` của `src/lib/stl-import/naming.ts` (đã xử lý `đ/Đ`, vốn **không** tách được bằng NFD) → nên chuyển nó về `src/lib/slug.ts` dùng chung. Hiện có 4 bản chép (`naming.ts`, `ip-risk-keywords.ts`, `organizer-export.ts`, `makerworld-screenshot.ts`) — bản `ip-risk-keywords` thay `đ` *trước* NFD, đúng; giữ một bản.

---

## 5. URL / SEO / bộ lọc mobile

### 5.1 Hiện trạng cần lưu ý
- `/products?categoryId=<uuid>`: URL chứa UUID, không có trang category riêng, sitemap ghi rõ "no per-category route".
- Lọc category so `p.category_id = $1` **chính xác** → khi có cấp con, chọn cha sẽ mất sản phẩm của con (IMPORTANT #1).
- `categories.name` chỉ một ngôn ngữ; `/en/products` hiện tên tiếng Việt.
- Tìm kiếm `p.name ilike '%q%'` không bỏ dấu: gõ "moc khoa" không ra "Móc khoá".

### 5.2 Thiết kế URL

| URL | Vai trò | Index? | Canonical | Sitemap |
|---|---|---|---|---|
| `/products` | Toàn bộ catalog | ✓ | self | ✓ (đã có) |
| `/products?category=keycap&tag=anime,qua-tang&type=…&sort=…&page=…` | Lọc tự do | **noindex, follow** | `/products` (hoặc landing sạch nếu bộ lọc khớp đúng 1 landing) | ✗ |
| `/danh-muc/[slug]` (cấp 1 và cấp 2) | Landing category | ✓ khi ≥ 4 sản phẩm ACTIVE | self | ✓ |
| `/chu-de/[slug]` | Landing tag: chỉ tag `PUBLIC + is_indexable + có description_vi + ≥ 6 sản phẩm` | ✓ | self | ✓ |
| `/chu-de/[slug]` cho tag không đạt | — | 404 | — | ✗ |
| `/chu-de/[alias-cũ]`, `/products?categoryId=<uuid>` | Link cũ | 301 → URL mới | — | ✗ |
| `/en/...` | Bản EN | ✓ chỉ khi có `name_en` (+ `description_en` cho landing) | self (không canonical chéo ngôn ngữ) | ✓ khi EN bật |

Lý do:
- **Không dùng `/products/[category]`**: đụng `/products/[slug]` của sản phẩm (slug sản phẩm có thể trùng slug category, vd. "keycap").
- **`/tags/[slug]` vs `/chu-de/[slug]`**: chọn đoạn tiếng Việt cho thị trường chính (đã có tiền lệ `/bao-gia`). Có thể map sang `/en/topics/[slug]` bằng `pathnames` của next-intl — đổi sau được, nhưng nên quyết trước khi index (Q5).
- **Filter dùng slug, không UUID**; thứ tự tham số cố định, giá trị trong một nhóm sắp xếp, dùng `&` chuẩn — theo khuyến nghị Google cho faceted navigation.
- **noindex thay vì chặn robots.txt**: site nhỏ, crawl budget không phải vấn đề; `noindex` chỉ có tác dụng khi **không** bị chặn robots.txt (Google), và `follow` vẫn giúp phát hiện trang sản phẩm. Nếu sau này log thấy bot cào tổ hợp lọc quá nhiều thì chuyển sang chặn `Disallow: /*?*tag=` (khi đó bỏ noindex).
- Tổ hợp lọc rỗng: trang "Không có sản phẩm" + noindex (Google khuyên 404 cho tổ hợp vô nghĩa — áp dụng cho slug không tồn tại: bỏ qua giá trị lạ hoặc 404 landing).
- **Chống trang mỏng/trùng**: ngưỡng số sản phẩm + bắt buộc đoạn mô tả riêng; không bao giờ index tổ hợp 2 tag ("keycap + anime") trừ khi OWNER tạo landing biên tập riêng (giai đoạn sau, như "collection" của Shopify).
- hreflang: `localeAlternates()` đã đúng (vi/en tự tham chiếu); nên thêm `x-default` → bản vi (NICE TO HAVE).

### 5.3 Wireframe chữ — bộ lọc mobile

```
┌──────────────────────────────────┐
│ Trang chủ › Sản phẩm             │
│ Keycap                    (h1)   │
│ [🔍 Tìm: "moc khoa"…          ]  │
│ [⚙ Lọc (2)] [Sắp xếp: Mới ▾]    │  ← thanh dính khi cuộn
│ ┌Anime ×┐┌Quà tặng ×┐ Xoá tất cả │  ← chip đã chọn, cuộn ngang, chip cuối bị cắt
│ 24 sản phẩm                      │
│ ┌──────┐ ┌──────┐                │
│ │ ảnh  │ │ ảnh  │   lưới 2 cột   │
└──────────────────────────────────┘

Bấm [⚙ Lọc] → bottom sheet 90% chiều cao:
┌──────────────────────────────────┐
│ ━━━━  Bộ lọc              [Đóng] │
│ Danh mục                      ▾  │
│  ◉ Tất cả  ○ Keycap (24)         │
│  ○ Móc khoá (31) ○ Figure (12)   │
│ Chủ đề                        ▾  │
│  ☑ Anime (9)   ☐ Game (14)       │
│  ☐ Động vật (6) ☐ Khủng long (0) │  ← 0 = mờ, không bấm được
│  + Xem thêm 8                    │  ← cắt ở ~8–10 giá trị
│ Dịp                           ▸  │
│ Vị trí                        ▸  │
│ Phong cách                    ▸  │
│ Hàng có sẵn  [ ] chỉ hàng có sẵn │
│ Khoảng giá  [ 0 ]–[ 500.000 ]    │
├──────────────────────────────────┤
│ [Xoá lọc]   [ Xem 24 sản phẩm ]  │  ← số cập nhật khi tick; chỉ áp khi bấm
└──────────────────────────────────┘
```

- **Nút Apply** trên mobile (Baymard #1125: tự áp sau mỗi lần tick làm chậm khi chọn nhiều giá trị); desktop: sidebar trái, áp ngay.
- **Chip đã chọn ở trên lưới**, mỗi chip có ×, có "Xoá tất cả" (Baymard: không chỉ hiện "Lọc (3)").
- Số đếm cạnh mỗi giá trị, giá trị 0 bị vô hiệu (Shopify storefront filtering UX).
- **Progressive enhancement**: sheet là `<form method="get">` (giống form hiện tại) → chạy không cần JS; JS chỉ để cập nhật số "Xem N sản phẩm". Không cần thư viện mới: dùng `dialog.tsx` (Radix Dialog đã có) dạng sheet đáy. Tránh thêm `cmdk`/`vaul` trừ khi có lý do.
- Nhóm `franchise` **không bao giờ** xuất hiện ở đây.

Nguồn: Google faceted navigation https://developers.google.com/crawling/docs/faceted-navigation · https://developers.google.com/search/blog/2024/12/crawling-december-faceted-nav · noindex vs robots.txt https://developers.google.com/search/docs/crawling-indexing/block-indexing · hreflang https://developers.google.com/search/docs/specialty/international/localized-versions · Baymard #1125 https://baymard.com/guidelines/1125-apply-buttons-in-mobile-filtering-interfaces · Baymard applied filters https://baymard.com/research-articles/how-to-design-applied-filters · Shopify filtering UX https://shopify.dev/themes/navigation-search/filtering/storefront-filtering/storefront-filtering-ux · Shopify collections https://help.shopify.com/manual/products/collections/automated-collections/auto-sort · Shopify Search & Discovery filters https://help.shopify.com/en/manual/online-store/search-and-discovery/filters · Shopify tag pages & SEO [2ND] https://sherocommerce.com/blogs/insights/faceted-navigation-seo-shopify · Etsy attributes/tags https://www.etsy.com/seller-handbook/article/604203126614 · giới hạn 13 tag [2ND] https://alura.io/docs/article/etsy-tags-guide · WooCommerce cat/tag/attribute [2ND] https://tinyfrog.com/woocommerce-product-categories-tags/ · Shopee ngành hàng + thuộc tính [2ND] https://www.bigseller.com/blog/articleDetails/789.htm · Cây danh mục MakerWorld/Printables: chưa kiểm chứng được [?].

---

## 6. Auto-tag khi nhập STL (feature 003)

### 6.1 Luồng

```
scan (thư mục, file, bbox_mm, group_mode)            ← đã có
  → resolveCategory(category-map.json)               ← đã có
  → suggestTags(tag-map.json, input)  [MỚI, thuần, test được]
  → product_import_items.suggested_tags (PENDING)    ← không ghi product_tags
/admin/stl-import: chip đề xuất ✓/✗, "Nhận mọi đề xuất ≥ 0.8" cho các dòng đã chọn
  → ACCEPTED: insert product_tags(source='IMPORT_SUGGESTION') + audit PRODUCT_TAGS_CHANGED
  → REJECTED: giữ trong jsonb để lần import sau không đề xuất lại
```

- **File riêng `scripts/stl-import/tag-map.json`**, không nhét vào `category-map.json`: schema category-map đang `.strict()` và là đầu vào của gate publish; tách ra để sửa từ khoá không đụng đường publish. (Chi phí: thêm 1 file + 1 schema Zod. Nếu OWNER muốn 1 file duy nhất, thêm khoá `tagRules` vào category-map — cũng được.)
- Gate publish **không** đòi tag (tag không phải điều kiện bán) — tránh làm chậm duyệt.

```jsonc
// tag-map.json (nháp)
{
  "keywordRules": [
    // so khớp trên slugify() của từng đoạn thư mục + tên file, theo ranh giới "-"
    { "keywords": ["pokemon","pikachu","gengar","psyduck","bulbasaur","charmander","eevee"], "tags": ["pokemon","game","anime"] },
    { "keywords": ["mario","luigi","yoshi","bowser","toad","koopa"], "tags": ["mario","game","retro-game"] },
    { "keywords": ["kirby"], "tags": ["kirby","game","de-thuong"] },
    { "keywords": ["naruto","sasuke","kakashi"], "tags": ["naruto","anime"] },
    { "keywords": ["dragon-ball","goku","vegeta"], "tags": ["dragon-ball","anime"] },
    { "keywords": ["warhammer","40k","space-marine"], "tags": ["warhammer","game"] },
    { "keywords": ["cat","meo","neko"], "tags": ["meo","dong-vat"] },
    { "keywords": ["dino","dinosaur","khung-long","t-rex"], "tags": ["khung-long","dong-vat"] },
    { "keywords": ["skull","scream","freddy","horror"], "tags": ["kinh-di"] },
    { "keywords": ["christmas","xmas","noel"], "tags": ["giang-sinh"] }
  ],
  "categoryDefaults": {
    "keycap":   ["ban-phim", "de-ban", "mx-stem"],
    "keychain": ["balo-chia-khoa", "qua-tang"]
  },
  "bboxRules": [
    { "when": "category=keycap AND max(x,y) > 40", "warning": "KEYCAP_TOO_BIG" },
    { "when": "group_mode=FOLDER AND files>=4 AND category=keycap", "suggestCategory": "bo-keycap" }
  ]
}
```

### 6.2 Nguồn tín hiệu & độ tin cậy

| Nguồn | confidence | Ghi chú |
|---|---|---|
| Đoạn thư mục khớp từ khoá | 0.9 | Tên thư mục do người đặt, ít nhiễu |
| Tên file khớp từ khoá | 0.7 | Nhiễu hơn ("part_03", "body_v2") |
| `categoryDefaults` | 0.6 | Đúng cho đa số, nhưng là suy luận chung |
| bbox | chỉ **cảnh báo**, không gắn tag | Xem dưới |

**bbox không nên quyết tag/category**:
- Keycap 1u ≈ 18 × 18 × 8–15 mm, nhưng móc khoá, charm, huy hiệu cũng < 30 mm → "< 20 mm ⇒ keycap" sai nhiều.
- Với `group_mode = FOLDER`, `bbox_mm` là **hộp bao hợp nhất** của mọi file (metrics.ts `union`) → bộ 11 keycap xếp rải trên plate có thể ra 150 mm.
- File sai đơn vị (inch/cm) đã có cảnh báo riêng.
→ bbox dùng để **cảnh báo mâu thuẫn** (thư mục nói keycap mà vật > 40 mm) và gợi ý category con, không gắn tag chủ đề.

### 6.3 Đo trên KeyCap3D thật (45 thư mục — `docs/research/keycap3d-folders.txt`)

Danh sách thật có **45** thư mục cấp 1 (không phải 46), đọc từ Drive ngày 2026-10-21, chỉ có tên thư mục, không có file.

**a) `ip-risk-keywords.ts` hiện tại bắt được 7/45 thư mục.** Đo ngày 2026-10-22: chạy `detectIpRiskKeywords()` thật trên từng tên thư mục. Có 33 thư mục chắc chắn mang IP bên thứ ba, nên bộ lọc **lọt 26/33**. Hai lỗi gây lọt:

1. **Ranh giới từ.** Bộ so khớp dùng `\b`, mà `_` là ký tự "từ", nên `…_pokemon_edition`, `vaporeon_pokemon_…` và `…_dragon_ball` không khớp. Nếu đổi `_`/`-` thành khoảng trắng trước khi so thì lên **10/45**, vẫn lọt 23/33.
2. **Từ điển quá ngắn.** Phần lớn IP trong kho không có trong từ điển.

(Bản review Cowork ghi 11/45. Số đo lại ở đây là 7, hoặc 10 sau khi chuẩn hoá. Dù 7, 10 hay 11 thì kết luận không đổi.)

| Thư mục | IP (chủ sở hữu, tham khảo) | `ip-risk-keywords` |
|---|---|---|
| 2 keycaps mario | Mario (Nintendo) | **lọt** ("mario" không có trong từ điển) |
| 2 The Mandalorian Keycap | Star Wars (Disney/Lucasfilm) | **lọt** |
| 2_keycaps_chainsaw_man_and_pochita_… | Chainsaw Man | **lọt** |
| 3_Full_Metal_Alchemist_Alphonse_and_Cats_Keycaps | Fullmetal Alchemist | **lọt** |
| 3_keycaps_digi_babies_vol_i_digimon_… | Digimon (Bandai) | **lọt** |
| 4_keycaps_cyberpunk_edgerunners_… | Cyberpunk (CD Projekt) | **lọt** |
| 6_keycaps_for_mechanical_keyboard_pokemon_edition | Pokémon | **lọt** (lỗi `_`) |
| 9_keycapsgenshin-impact-keycaps-traveler | Genshin Impact (HoYoverse) | **lọt** (dính chữ "keycapsgenshin") |
| 9_Titans_attack_on_titan_keycaps_collection | Attack on Titan | **lọt** |
| Anya - Spy Family | Spy × Family | **lọt** |
| cell_keycap_3d_…_dragon_ball | Dragon Ball | **lọt** (lỗi `_`) |
| Freddy Krueger Keycaps | A Nightmare on Elm Street | **lọt** |
| Frieren - Beyond Journey's End | Frieren | **lọt** |
| gengar-pokemon-keyboard-keycap-mx-model_files | Pokémon | bắt |
| gundam-raiser-keycap-cherry | Gundam (Bandai/Sunrise) | **lọt** |
| IT Clown Keycaps | IT / Pennywise | **lọt** |
| Jason Vorhees Keycaps | Friday the 13th | **lọt** |
| KEYCAPS - Hollow Knight | Hollow Knight (Team Cherry) | **lọt** |
| KEYCAPS - Toothless | How to Train Your Dragon (DreamWorks) | **lọt** |
| KEYCAPS - Vanellope von Schweetz - Wreck it Ralph | Disney | **lọt** (tên nhân vật, không có chữ "disney") |
| Keycaps Bulbasaur / Charmander / Pikachu / Squirtle Pokemon (4) | Pokémon | bắt (4) |
| Kirby Keycaps | Kirby (Nintendo) | **lọt** |
| Maomao - Apothecary Diaries | The Apothecary Diaries | **lọt** |
| NARUTO Artisan Keycap - Sasuke's Susanoo | Naruto | bắt |
| pokemon-keycap-growlithe | Pokémon | bắt |
| RTX_3080_Keycap_for_Resin_Printers | RTX (NVIDIA — nhãn hiệu) | **lọt** |
| Sailor Moon keycap | Sailor Moon | **lọt** |
| Scream Keycaps | Scream / Ghostface | **lọt** |
| Tetris Keycap | Tetris (nhãn hiệu + trade dress) | **lọt** |
| vaporeon_pokemon_keycap_3d_… | Pokémon | **lọt** (lỗi `_`) |

- **Có thể có IP, chưa chắc (3 thư mục):** `bros_keycaps_mechanical_keyboard` (có thể là Mario Bros), `Hades keycap` (game Supergiant hoặc thần thoại?), `REBECCA keycap` (nhiều khả năng là nhân vật Cyberpunk Edgerunners). Phải mở ảnh mới biết.
- **Không thấy IP qua tên (9 thư mục):** `4 keycaps`, `4 succulents-plants-…`, `8 Keycap Set`, `12 Fantasy Keycaps`, `Carnalito Keycap`, `Frog keycap`, `Joystick_Keycap_stls`, `Skull Keycaps`, `Three Headed Hydra Keycaps`. Riêng `4 keycaps`, `8 Keycap Set` và `12 Fantasy Keycaps` có tên chung chung, nên tên **không nói gì** về nội dung bên trong.

**Kết luận (thay cho ước lượng cũ):**
1. **Không dựa vào auto-tag hay từ điển từ khoá để phát hiện IP.** Ngay cả khi từ điển được mở rộng đủ cho 45 thư mục này, mỗi lô nhập mới vẫn mang IP mới. Thêm vào đó, tên chung chung kiểu "8 Keycap Set" thì không từ điển nào bắt được. Từ điển chỉ dùng để **gợi ý** và để hiện badge.
2. **Với sản phẩm nhập STL, admin BẮT BUỘC khai IP trước khi duyệt.** Chỉ có hai lựa chọn: **"Không có IP"** hoặc **"Thương hiệu: …"** (chọn tag `franchise`, gõ được để tạo mới). Bản nháp cho feature 003:
   - thêm cột `product_import_items.ip_declaration varchar(10) not null default 'UNSET' check (ip_declaration in ('UNSET','NONE','FRANCHISE'))`, kèm `ip_declared_by` và `ip_declared_at` (cặp CHECK giống `license_reviewed`);
   - gate publish (trigger `enforce_import_publish_gate`) thêm lý do `IP_NOT_DECLARED` khi giá trị còn `UNSET`;
   - nếu chọn `FRANCHISE` thì sản phẩm phải có ít nhất 1 tag `franchise`; bước gắn tag và bước khai báo nằm trong cùng transaction;
   - việc sản phẩm `FRANCHISE` có được lên web hay không do Q4 quyết định.

   Đây là việc **độc lập với "đã kiểm tra bản quyền"** (license của file STL). Hai câu hỏi khác nhau: *file này có được phép bán bản in không?* và *hình này có phải IP của bên thứ ba không?*
3. Từ điển IP vẫn có ích làm **gợi ý mặc định** cho câu hỏi đó: khớp thì điền sẵn "Thương hiệu: Pokémon", nhưng người duyệt vẫn phải bấm xác nhận. Cần sửa lỗi ranh giới `_`/`-` (chuẩn hoá trước khi so). Đồng thời hợp nhất từ điển với alias của các tag `franchise`, để có một nguồn duy nhất cho cả quy tắc ở mục 4.4.

**Độ chính xác của auto-tag phi-IP** (vẫn là ước lượng theo tên; đo thật cần CSV `--suggest-tags-only`):

| Đề xuất | Kết quả dự kiến trên 45 thư mục |
|---|---|
| Category `keycap` | 45/45 (mọi thư mục đều nằm dưới `KeyCap3D`) |
| Category con `bo-keycap` (tên bắt đầu bằng số ≥ 2) | 13 thư mục có tiền tố số. Precision cao, nhưng recall thấp nếu có bộ không đánh số |
| `theme` từ tên | `cay-co-hoa` (succulents), `dong-vat` (frog, cats), `kinh-di` (skull, scream, freddy, jason, IT). Khoảng 8–10 thư mục có tín hiệu rõ; số còn lại cần người gán |
| `placement` / `occasion` / `style` | Chỉ có giá trị mặc định theo category (`ban-phim`, `de-ban`); không suy ra được từ tên |

---

## 7. Chính sách tag thương hiệu

> **Không phải tư vấn pháp lý.** Đây là chính sách vận hành thận trọng dựa trên nguồn công khai; trước khi bán hàng có IP bên thứ ba ở quy mô thương mại nên hỏi luật sư SHTT.

Bối cảnh rủi ro:
- Luật SHTT Việt Nam, Điều 129(1): dùng dấu hiệu trùng/tương tự nhãn hiệu được bảo hộ cho hàng hoá trùng/tương tự có khả năng gây nhầm lẫn là xâm phạm; bao gồm chào bán và quảng cáo hàng mang dấu hiệu (chi tiết Nghị định 65/2023, Điều 77) [2ND: https://lsvn.vn/hanh-vi-xam-pham-quyen-doi-voi-nhan-hieu-bi-phat-nhu-the-nao-a94915.html]. Hình dáng nhân vật còn được bảo hộ **quyền tác giả**, độc lập với nhãn hiệu — bỏ chữ "Pokémon" khỏi tag **không** làm keycap Gengar hợp pháp.
- Nintendo (2019): *không cấp phép bán vật phẩm in 3D có nhân vật của họ* [2ND: https://facfox.com/news/?p=70211]; Pokémon từng gỡ chậu cây Bulbasaur in 3D trên Shapeways [https://archive.techdirt.com/articles/20140819/10013428255/nintendo-goes-copyright-woman-making-pokemon-inspired-planters.shtml]. Games Workshop từng gây áp lực Cults3D gỡ mẫu [https://www.fauxhammer.com/?p=21598]; trang IP Guidelines chính thức không tải được [?].
- Etsy: tên thương hiệu trong title/tag là nguyên nhân gỡ listing phổ biến; "fan art" không phải lý do miễn trừ khi bán [2ND: https://www.cohnlg.com/how-to-avoid-etsy-copyright-infringement/].
- Google Ads: dùng nhãn hiệu làm **từ khoá** không bị hạn chế, nhưng trong **nội dung quảng cáo** có thể bị chặn khi chủ sở hữu khiếu nại; ngoại lệ reseller chỉ áp cho hàng chính hãng — hàng fan-made không thuộc diện này (suy luận) [https://support.google.com/adspolicy/answer/6118].
- License file: MakerWorld "Standard Digital File License" thường được hiểu là chỉ dùng cá nhân, không bán bản in [2ND: https://forum.bambulab.com/t/understanding-makerworlds-standard-digital-file-license/257609]; Printables: CC BY-NC cấm bán, CC BY/BY-SA cho bán kèm ghi công [https://all3dp.com/1/things-to-3d-print-and-sell-a-legal-guide/]. **License thương mại của file STL không bao gồm quyền với IP nhân vật.**

Chính sách đề xuất:
1. Nhóm `franchise` luôn `INTERNAL` — ép bằng CHECK ở DB (mục 4.3), không chỉ ẩn ở UI (AGENTS.md rule 5).
2. Tag `franchise` **không** xuất hiện ở: facet storefront, URL, sitemap, `alternates`, JSON-LD, nội dung quảng cáo, feed Google Merchant (nếu có sau này), event analytics `item_category`.
3. Dùng tag mô tả chung thay thế cho phần công khai: "Game retro", "Anime", "Quái vật dễ thương".
4. Mục đích nội bộ: tìm nhanh, đếm rủi ro, **archive hàng loạt trước khi mở domain** (khớp checklist "Trước khi public domain" ở `feature-003-test-run.md`).
5. **Tên & slug sản phẩm** là chỗ lộ lớn hơn tag: importer sinh slug từ tên file (vd. `gengar-pokemon-keyboard-keycap…`). Đề xuất: khi sản phẩm có tag/đề xuất `franchise`, admin phải đổi tên + slug trung tính trước khi duyệt (cảnh báo, hoặc thêm lý do vào gate publish — Q4). Đổi slug sau khi đã index cần 301 → cần bảng `product_slug_aliases` tương tự (ngoài phạm vi, ghi lại).
6. Ngoại lệ có giấy phép: chỉ OWNER, cần bằng chứng license lưu kèm; khi đó tạo tag với `tag_group` khác (vd. `licensed`) — **không** nới CHECK của `franchise`.
7. **Sản phẩm nhập STL: khai IP bắt buộc trước khi duyệt** ("Không có IP" / "Thương hiệu: …", gate `IP_NOT_DECLARED`) — từ điển chỉ là gợi ý (mục 6.3).
8. **Tag mới/đổi tên khớp từ điển IP → tự thành `franchise`** (mục 4.4), để tag thương hiệu không thể "lọt" sang nhóm public qua đường tạo tag tay.

---

## 7b. Admin UX (câu hỏi 6)

**Trên form sửa sản phẩm** (`/admin/products/[id]`):
- Ô "Tag" theo nhóm (chip có màu nhóm). Gõ → gợi ý theo `name_vi`, `name_en`, `slug`, **alias**, so khớp không dấu (`slugify(input)` → prefix match). Không cần `cmdk`: input + danh sách `<ul role="listbox">` hoặc `<datalist>` bản đầu.
- Gõ tên chưa có → "Tạo tag 'xxx' (nội bộ)" → nếu `slugify` trùng slug/alias có sẵn thì **chọn tag có sẵn** thay vì tạo mới (chặn "móc khoá"/"moc-khoa" trùng ngay từ đầu).

**Gán hàng loạt** (`/admin/products`, `/admin/stl-import`):
- Chọn nhiều dòng → "Gắn tag…" / "Gỡ tag…" → dialog xem trước: "Thêm *Anime* cho 12 sản phẩm (3 đã có) · Gỡ *Game* khỏi 5". 1 transaction, tối đa 200 sản phẩm/lần, audit mỗi sản phẩm. Phần sản phẩm không tồn tại/đã archive báo lại theo kiểu "bulk partial" như feature 003.

**Quản lý tag** (`/admin/tags`, mới):
- Bảng: tên vi/en, slug, nhóm, PUBLIC/INTERNAL, indexable, số sản phẩm (ACTIVE / tổng), alias.
- Lọc: theo nhóm, "0 sản phẩm" (mồ côi), "Nghi trùng".
- **Nghi trùng** = cùng `slugify(name_vi)`; `slugify(name_en)` trùng slug/alias tag khác (vd. "keychain" ↔ "móc khoá" có `name_en` "Keychain"); khoảng cách chỉnh sửa ≤ 2 giữa slug.
- **Gộp**: chọn tag đích → xem trước số sản phẩm bị dời + alias sẽ thêm → xác nhận (OWNER). Slug cũ tự 301.
- Lưu ý: "móc khoá"/"keychain" thực ra là **category** `keychain`; nếu ai đó tạo tag này, gộp nó thành alias trỏ về landing category (tag_aliases chỉ trỏ tag → cần quy tắc: chặn tạo tag có slug trùng slug category; Q6).

---

## 8. Vertical slices (Spec Kit) & effort

Mỗi lát là một feature Spec Kit / một PR, test được end-to-end. Effort = ngày công 1 người, gồm test.

**MVP = lát 0 → 1 → 2 → 4 (chỉ facet)** — đánh dấu ★ dưới đây. Lát 4 trong MVP chỉ gồm `?category=slug` + facet tag
+ bottom sheet + chip + noindex/canonical; landing `/danh-muc`, `/chu-de` và sitemap landing để sau MVP. Lát 0 trong MVP
chỉ cần phần gom `slugify` + `name_en`; phần `sku_code` bắt buộc trước khi thêm category cấp con (BLOCKER #1).

| # | Lát | Nội dung | Test chính | Effort |
|---|---|---|---|---|
| 0 ★ | Chuẩn bị | `categories.sku_code` + `name_en` + trigger bất biến; `category-map.json` đối chiếu DB; gom `slugify` về 1 module | DB: không UPDATE được sku_code; map lệch DB → script báo lỗi | 1 |
| 1 ★ | DB tag | `tags`, `tag_aliases`, `product_tags`, CHECK franchise, RLS, seed 44 tag | CHECK franchise; alias ≠ slug sống; FK restrict; RLS anon không đọc | 1 |
| 2 ★ | Service | `tag.service.ts`: CRUD, gán/gỡ, bulk, gộp, đếm; Zod; audit; quyền admin/owner; ép `franchise` khi khớp từ điển IP; mở rộng `listStorefrontProducts` (tag + category gồm con) | Gộp đồng thời (2 transaction), idempotent; 401/403/OWNER-only; storefront không bao giờ trả tag INTERNAL | 2 |
| 3 | Admin | Ô tag trên form sản phẩm, `/admin/tags`, gán hàng loạt | Playwright: gán tag → hiện ở storefront; gộp → URL cũ 301 | 2,5 |
| 4 ★ (chỉ facet) | Storefront + SEO | `?category=slug` (301 từ `categoryId`), facet + bottom sheet + chip, `/danh-muc/[slug]`, `/chu-de/[slug]`, noindex/canonical, sitemap, i18n tên category/tag | E2E mobile lọc 2 nhóm; sitemap không có franchise; noindex trên URL có filter | 3 |
| 5 | Auto-tag | `tag-map.json` + Zod, `suggestTags()` thuần, ghi `suggested_tags`, UI ✓/✗ trong `/admin/stl-import`, `--suggest-tags-only` CSV | Unit cho từ khoá/ranh giới/đ; re-import không đề xuất lại tag đã REJECTED | 2 |
| 6 | Docs | catalog-spec mục 1, ADR (chọn phương án b + chính sách franchise), `business-rules.md`, `schema.md`, `migrations.md` | — | 0,5 |
| | **Tổng** | | | **~12** |

MVP ★ ≈ 7 ngày. Trong MVP, tag được gán qua seed/SQL do OWNER chạy hoặc qua service script — chưa có UI admin (lát 3).
Sau MVP: 3 (admin) → 4 phần landing → 5 (auto-tag) → 6 (docs; phần ADR nên viết ngay khi bắt đầu lát 1).

Việc **khai IP bắt buộc** cho sản phẩm nhập STL (mục 6.3) không nằm trong các lát trên — thuộc feature 003, xem
"Việc chuyển sang feature 003" ở cuối tài liệu.

---

## 9. Câu hỏi mở cho OWNER

> **Trả lời của OWNER — chốt 2026-10-22** (OWNER duyệt theo đề xuất của Cowork, yêu cầu "chốt làm luôn"):
>
> | Q | Quyết định |
> |---|---|
> | Q1 | Bỏ nhánh con Anime/Game/Movie của FIG và bỏ GIFT (thành tag). Chỉ thêm cấp 2 khi một nhánh có ≥ 15 sản phẩm ACTIVE. |
> | Q2 | `GIFT`, `PART` chưa dùng cho SKU thật → **reserved**: không xoá, không tái dùng mã. |
> | Q3 | STAFF tạo tag **INTERNAL**; chỉ OWNER chuyển PUBLIC / bật indexable / đổi slug / gộp / xoá. |
> | Q4 | Giai đoạn test: cho lên Preview. **Trước khi public domain**: gate chặn sản phẩm khai IP "Thương hiệu: …" (hoặc có tag `franchise`) mà tên/slug chưa trung tính; chưa khai IP → chặn `IP_NOT_DECLARED`. |
> | Q5 | `/danh-muc/[slug]` và `/chu-de/[slug]`. |
> | Q6 | "Móc khoá" là category; **cấm** tạo tag có slug trùng slug category (kể cả qua alias). |
> | Q7 | Đồng ý đo: xuất CSV từ `docs/research/keycap3d-folders.txt`, OWNER đánh dấu đúng/sai. |
> | Q8 | Seed sẵn `name_en` cho category + 44 tag; `description_en` để trống (landing EN không index tới khi có). |

1. **Q1 — Cây category**: đồng ý bỏ nhánh con Anime/Game/Movie của FIG và bỏ GIFT khỏi cây (chuyển thành tag)? Có muốn cấp 2 ngay hay chỉ khi đủ ~15 sản phẩm?
2. **Q2 — Mã SKU**: `GIFT` và `PART` đã từng dùng cho SKU thật nào chưa (kể cả ngoài DB, vd. nhãn in)? Nếu chưa, đánh dấu reserved.
3. **Q3 — Quyền**: STAFF được tạo tag (nội bộ) hay chỉ OWNER? Đề xuất: STAFF tạo INTERNAL, OWNER công khai.
4. **Q4 — Thương hiệu**: sản phẩm có tag `franchise` có được lên web không? Nếu có, có bắt đổi tên/slug trung tính trước khi duyệt (chặn ở gate) hay chỉ cảnh báo?
5. **Q5 — URL**: chốt `/danh-muc/…` và `/chu-de/…` (tiếng Việt) hay `/categories/…`, `/topics/…`? Đổi sau khi Google đã index sẽ tốn redirect.
6. **Q6 — "Móc khoá"**: là category (như hiện tại) — đồng ý cấm tạo tag trùng slug category?
7. **Q7 — Auto-tag**: OWNER có thể dành ~30 phút gán nhãn đúng/sai cho CSV 45 thư mục KeyCap3D (`docs/research/keycap3d-folders.txt`) để đo độ chính xác không?
8. **Q8 — EN**: dịch tên tag/category sang EN ngay ở seed hay để trống (EN landing không index đến khi có bản dịch)?

---

## Review

### BLOCKERS
1. **CATEGORY_CODE không nằm trong DB** — chỉ ở `category-map.json` và trong chuỗi SKU. **Chỉ chặn lát thêm category
   cấp con** (và mọi việc đổi `parent_id`): khi đó SKU sinh ra có thể lệch category vì nhánh con không có code. Không
   chặn MVP tag (lát 1, 2, 4-facet chạy được với 6 category cấp 1 hiện tại). Làm phần `sku_code` của lát 0 trước khi
   tạo category cấp con đầu tiên.

### Việc chuyển sang feature 003 (mục "Trước khi public domain")
Không còn là BLOCKER của nghiên cứu tag — là việc riêng của feature 003, phải xong **trước khi mở domain public**,
độc lập với việc làm tag hay không:
- [ ] **Slug/tên sản phẩm nhập từ STL chứa tên thương hiệu** (vd. `gengar-pokemon-…`): đổi tên + slug trung tính hoặc
  archive (theo Q4). Ẩn tag `franchise` là vô nghĩa nếu URL, `<title>` và sitemap vẫn mang "pokemon".
- [ ] **Khai IP bắt buộc trước khi duyệt** (`ip_declaration` + lý do gate `IP_NOT_DECLARED`, mục 6.3) — vì từ điển
  chỉ bắt 7/45 thư mục KeyCap3D.
- [ ] Sửa lỗi ranh giới `_`/`-` trong `ip-risk-keywords.ts` (cũng ảnh hưởng `custom_requests.ip_risk_flag`).
Hai checkbox đầu cần được thêm vào checklist "Trước khi public domain" của `docs/prompts/feature-003-test-run.md`
(chưa sửa file đó trong lần cập nhật này).

### IMPORTANT
1. Lọc category hiện so **chính xác** `category_id` (storefront + admin) → khi có cấp con, chọn cha sẽ thiếu sản phẩm. Cần lọc theo cây (CTE đệ quy hoặc lưu `root_category_id`).
2. URL lọc dùng `categoryId` UUID; chuyển sang slug cần 301 cho link cũ.
3. `categories.name` không có EN → `/en/products` hiển thị tên Việt; cùng vấn đề với tag nếu không có `name_en`.
4. Đề xuất auto-tag phải tách khỏi `product_tags` (đề xuất ở `suggested_tags`) — nếu dồn chung bằng cột trạng thái, mọi truy vấn storefront phải nhớ lọc → dễ rò.
5. Quyền: công khai/đổi slug/gộp/xoá tag ảnh hưởng URL & SEO → `requireOwner`; gán tag → `requireAdmin`. Audit cho gộp phải ghi danh sách sản phẩm bị dời để hoàn tác được.
6. Gộp tag đồng thời: khoá 2 dòng theo thứ tự id trong transaction để tránh deadlock/mất dữ liệu.
7. Tìm kiếm `ilike` không bỏ dấu: "moc khoa" không ra "Móc khoá". Tag alias giải một phần; về lâu dài cần cột chuẩn hoá (`unaccent` — nhớ kiểm tra `đ`) hoặc so trên `slugify(name)`.
8. bbox của nhóm FOLDER là hộp bao hợp nhất → không dùng làm luật gắn tag/category.

### NICE TO HAVE
1. Gom 4 bản `slugify`/bỏ dấu về một module dùng chung; hợp nhất từ điển `ip-risk-keywords` với tag `franchise`.
2. `x-default` trong hreflang.
3. Facet màu/vật liệu bằng index biểu thức trên `product_variants.attributes` khi có dữ liệu thật.
4. Landing "collection" biên tập (tổ hợp tag) kiểu Shopify cho mùa Tết/Giáng sinh.
5. `product_slug_aliases` để đổi slug sản phẩm không vỡ link.

### RECOMMENDATION
Chọn **phương án (b)** — `tags` + `product_tags` + `tag_group` + `tag_aliases`, đề xuất auto-tag nằm riêng ở `product_import_items.suggested_tags`, tag thương hiệu bị CHECK ở DB giữ INTERNAL. Đánh đổi so với (a): thêm ~0,5 ngày migration và ~30 test, đổi lại có i18n, đổi tên/gộp không vỡ link, ẩn thương hiệu ở tầng DB. So với (c): bỏ qua tính linh hoạt kiểu dữ liệu (chưa cần — màu/vật liệu/kích thước đã ở `variant.attributes`). Nếu sau này cần thì nâng lên (c) chỉ cho nhóm `spec`, tốn 1 migration + backfill. Thứ tự: MVP lát 0 → 1 → 2 → 4 (chỉ facet), rồi 3 → landing → 5 → 6; phần `sku_code` (BLOCKER #1) trước category cấp con đầu tiên; các việc IP/slug thương hiệu đi theo feature 003 trước khi public. Nên chạy `/speckit-specify` từ mục 8 sau khi OWNER trả lời Q1–Q6.
