# 3D Printing E-commerce & Custom Printing Platform

**Version:** 2.2  
**Updated:** 2026-08-30  
**Audience:** Một lập trình viên mobile chuyển sang tự xây web/e-commerce cho startup in 3D  
**Starting point:** Chưa có website, chưa có database, chưa có admin, chưa có codebase web.  
**Primary goal:** Từ số 0 → có một website production-ready đủ để giới thiệu, bán sản phẩm, nhận đơn in 3D theo yêu cầu và quản lý dữ liệu đúng ngay từ đầu.

---

# 0. Cách dùng tài liệu này

Tài liệu này được viết để có thể **mở ra và bắt đầu làm ngay**, không cần quay lại hỏi “bây giờ làm gì?”.

Thứ tự đọc và thực hiện:

```text
PHASE 0  →  Chuẩn bị & quyết định nền tảng
PHASE 1  →  Database & domain model
PHASE 2  →  Backend / API / business rules
PHASE 3  →  Admin / quản trị dữ liệu
PHASE 4  →  Public website + sitemap + UI
PHASE 5  →  Cart / Checkout / Order
PHASE 6  →  Custom 3D Order / Quote / Production
PHASE 7  →  SEO / Content / Analytics / Launch
PHASE 8  →  Vận hành / tối ưu / scale
```

**Nguyên tắc:** Database và business rules đi trước UI. Không xây UI đẹp rồi mới nghĩ database.

---

# 1. Mục tiêu sản phẩm

Website cần phục vụ đồng thời 4 nhu cầu:

1. **Showcase** — giới thiệu thương hiệu và sản phẩm.
2. **E-commerce** — bán sản phẩm có giá cố định.
3. **Custom printing** — nhận file/ý tưởng và báo giá in 3D.
4. **Content/SEO** — viết bài về mẫu mới, công nghệ và thị trường in 3D để kéo organic traffic.

## 1.1. Hai luồng bán hàng chính

### A. Sản phẩm có sẵn

```text
Browse
→ Product Detail
→ Chọn Variant
→ Add to Cart
→ Checkout
→ Order
→ Processing
→ Shipping
→ Completed
```

### B. In 3D theo yêu cầu

```text
Customer Request
→ Review
→ Estimate
→ Quote
→ Customer Approves
→ Order
→ Print Job
→ QC
→ Shipping
→ Completed
```

---

# 2. Tư duy sản phẩm trước khi code

## 2.1. Không coi đây chỉ là “website bán hàng”

Mô hình in 3D có 3 loại tài sản cần quản lý:

```text
PRODUCT
  - thứ khách nhìn thấy và mua

MATERIAL
  - thứ bạn tiêu hao để sản xuất

PRODUCTION JOB
  - cách sản phẩm/custom order thực sự được tạo ra
```

Nếu chỉ có bảng `products(stock)` thì vài tháng sau sẽ rất khó biết:

- tồn kho hiện tại từ đâu ra;
- vì sao stock thay đổi;
- bao nhiêu vật liệu đã tiêu hao;
- một mẫu có những màu nào;
- giá vốn thật là bao nhiêu;
- đơn nào đang in;
- đơn nào đã in nhưng chưa đóng gói;
- vì sao lợi nhuận thấp.

Vì vậy hệ thống cần có **inventory ledger + order + production** ngay từ kiến trúc đầu.

---

# 3. Tech stack khuyến nghị

Bạn là mobile developer, nên ưu tiên stack có:

- TypeScript end-to-end;
- convention rõ ràng;
- ít phải tự vận hành infrastructure;
- dễ đọc và dễ debug;
- có thể scale nhưng không over-engineer.

## 3.1. Stack chính

| Layer | Chọn | Lý do |
|---|---|---|
| Language | TypeScript | Dễ chuyển từ mobile/React Native, type-safe |
| Web | Next.js | SSR/SEO + fullstack web |
| Styling | Tailwind CSS | Nhanh dựng UI |
| Components | shadcn/ui | Admin/dashboard nhanh và nhất quán |
| Database | PostgreSQL | Relational data, transaction, reporting |
| DB platform | Supabase | Managed PostgreSQL + Auth + tooling |
| File storage | Cloudflare R2 hoặc Supabase Storage | Ảnh, file upload |
| Hosting | Vercel hoặc Cloudflare | Managed deployment |
| Git | GitHub | Source + PR + Actions |
| Analytics | GA4 + Search Console | Traffic + SEO |
| Error tracking | Sentry (khi cần) | Production monitoring |
| Email | Resend/SMTP provider | Transactional email |

## 3.2. Kiến trúc tổng thể

```text
                         ┌──────────────────┐
                         │      Customer    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Next.js Web App  │
                         └────────┬─────────┘
                                  │
                     ┌────────────┴────────────┐
                     │                         │
                     ▼                         ▼
               Server/API                Admin App
                     │                         │
                     └────────────┬────────────┘
                                  ▼
                         ┌──────────────────┐
                         │   PostgreSQL     │
                         │    (Supabase)    │
                         └───────┬──────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
         File Storage        Auth/RBAC          Analytics
           R2/Storage          Supabase           GA4
```

### Google Sheets có còn dùng không?

Có, nhưng **không còn là source of truth**.

```text
PostgreSQL = source of truth
Google Sheets = import / export / reporting / temporary ops
```

---

# 4. Quy tắc kiến trúc bắt buộc

## Rule 1 — Không lưu stock bằng một field duy nhất rồi update trực tiếp

Không làm:

```text
products.stock = products.stock - 1
```

Mà dùng ledger:

```text
inventory_movements
+ quantity
+ movement_type
+ reference_type
+ reference_id
+ created_at
```

Current stock được tính hoặc materialized từ ledger.

## Rule 2 — Product và Variant phải tách

Ví dụ:

```text
Dragon Statue
├── Black / 10cm
├── White / 10cm
├── Black / 20cm
└── White / 20cm
```

SKU thuộc `product_variants`, không thuộc product chung.

## Rule 3 — Order phải snapshot dữ liệu bán hàng

Khi khách mua, không phụ thuộc hoàn toàn vào product hiện tại.

`order_items` cần lưu snapshot như:

- product_name
- sku
- unit_price
- selected options
- quantity

Để sau này sản phẩm đổi giá/tên thì lịch sử đơn vẫn đúng.

## Rule 4 — Tiền dùng integer theo đơn vị nhỏ nhất

Ví dụ VND:

```text
price = 250000
```

Không dùng float.

## Rule 5 — Mọi thay đổi quan trọng đều có audit log

Ví dụ:

```text
ADMIN_USER changed:
Product Dragon / price: 200000 → 250000
```

## Rule 6 — Business logic không nằm trong UI

Không viết logic:

```text
if stock > 0...
```

rải khắp component.

Business rule nên ở server/service/domain layer.

---

# 5. Domain model / Database Blueprint

## 5.1. Nhóm bảng

```text
CATALOG
├── categories
├── products
├── product_variants
├── product_images
├── product_tags
└── tags

INVENTORY
├── warehouses
├── materials
├── material_variants
├── inventory_items
├── inventory_movements
└── stock_reservations

CUSTOMER / ORDER
├── customers
├── addresses
├── carts
├── cart_items
├── orders
├── order_items
├── order_status_history
├── payments
└── shipments

CUSTOM PRINTING
├── custom_requests
├── custom_request_files
├── quotes
└── print_jobs

CONTENT
├── posts
├── post_categories
└── post_tags

SYSTEM
├── users
├── roles
├── audit_logs
└── app_settings
```

---

# 6. Database schema chi tiết

## 6.1. categories

```sql
id uuid primary key
gparent_id uuid null
name varchar not null
slug varchar unique not null
description text
image_url text
sort_order int default 0
is_active boolean default true
created_at timestamptz
updated_at timestamptz
```

> Lưu ý: tên field thực tế nên là `parent_id`, typo ở bản cũ phải tránh.

## 6.2. products

```sql
id uuid primary key
category_id uuid references categories(id)
name varchar not null
slug varchar unique not null
short_description text
description text
product_type varchar not null
status varchar not null
a_base_price bigint
cost_price bigint null
is_featured boolean default false
is_customizable boolean default false
seo_title varchar
seo_description text
created_at timestamptz
updated_at timestamptz
```

`product_type` ví dụ:

```text
READY_MADE
CUSTOMIZABLE
SERVICE
```

`status`:

```text
DRAFT
ACTIVE
ARCHIVED
```

## 6.3. product_variants

```sql
id uuid primary key
product_id uuid references products(id)
sku varchar unique not null
name varchar not null
attributes jsonb
price bigint not null
cost_price bigint null
weight_grams int null
is_active boolean default true
created_at timestamptz
updated_at timestamptz
```

Ví dụ `attributes`:

```json
{
  "color": "Black",
  "size": "10cm"
}
```

## 6.4. materials

```sql
id uuid primary key
name varchar not null
material_type varchar not null
brand varchar null
color varchar null
unit varchar not null
cost_per_unit bigint null
current_unit_cost bigint null
is_active boolean default true
created_at timestamptz
updated_at timestamptz
```

Ví dụ:

```text
PLA / 1kg / Black
PLA / 1kg / White
PETG / 1kg / Transparent
Resin / 1L / Grey
```

## 6.5. warehouses

```sql
id uuid primary key
name varchar not null
code varchar unique not null
address text null
is_active boolean default true
```

MVP chỉ cần 1 warehouse.

Nhưng vẫn nên tạo bảng để sau này có:

```text
MAIN
DISPLAY
OUTSOURCE
```

## 6.6. inventory_movements

Đây là bảng quan trọng nhất của inventory.

```sql
id uuid primary key
warehouse_id uuid references warehouses(id)
item_type varchar not null
item_id uuid not null
movement_type varchar not null
quantity int not null
unit_cost bigint null
reference_type varchar null
reference_id uuid null
note text null
created_by uuid null
created_at timestamptz
```

Ví dụ `movement_type`:

```text
OPENING_BALANCE
PURCHASE
PRODUCTION_IN
PRODUCTION_OUT
SALE
ADJUSTMENT_IN
ADJUSTMENT_OUT
DAMAGE
RETURN
TRANSFER_IN
TRANSFER_OUT
```

### Ví dụ

Bạn nhập 10 cuộn PLA:

```text
PURCHASE +10
```

Bán 1 sản phẩm:

```text
SALE -1
```

Hỏng 200g material:

```text
DAMAGE -200g
```

Không sửa số stock “im lặng”.

## 6.7. stock_reservations

Dùng để tránh oversell.

```sql
id uuid primary key
variant_id uuid references product_variants(id)
order_id uuid references orders(id)
quantity int not null
status varchar not null
expires_at timestamptz null
created_at timestamptz
```

Status:

```text
ACTIVE
RELEASED
COMMITTED
EXPIRED
```

---

# 7. Order model

## customers

```text
id
name
phone
email
note
created_at
updated_at
```

## carts

```text
id
customer_id nullable
session_id nullable
status
created_at
updated_at
```

## cart_items

```text
id
cart_id
variant_id
quantity
unit_price_snapshot
selected_options jsonb
```

## orders

```text
id
order_number
customer_id
status
payment_status
fulfillment_status
subtotal
shipping_fee
discount
cod_fee
total
customer_note
admin_note
created_at
updated_at
```

### Order status

```text
PENDING
CONFIRMED
IN_PRODUCTION
READY_TO_SHIP
SHIPPED
COMPLETED
CANCELLED
REFUNDED
```

### Payment status

```text
UNPAID
PENDING
PAID
FAILED
REFUNDED
```

---

# 8. Custom Printing model

## custom_requests

```text
id
request_number
customer_id nullable
name
phone
email
description
quantity
requested_material
requested_color
requested_size
status
internal_note
created_at
updated_at
```

Status:

```text
NEW
REVIEWING
NEED_INFO
QUOTED
APPROVED
REJECTED
CONVERTED
```

## custom_request_files

```text
id
custom_request_id
file_url
file_name
file_type
file_size
uploaded_at
```

## quotes

```text
id
custom_request_id
quote_number
subtotal
shipping_fee
discount
total
valid_until
status
note
created_at
updated_at
```

## print_jobs

```text
id
order_id
custom_request_id nullable
printer_name
material_id
estimated_weight_grams
actual_weight_grams
estimated_print_time_minutes
actual_print_time_minutes
status
started_at
completed_at
note
```

Status:

```text
QUEUED
PRINTING
FAILED
REPRINT
QC
COMPLETED
```

---

# 9. Sitemap tổng thể

## 9.1. Public website

```text
/
├── /products
│   ├── /category/[slug]
│   └── /[slug]
├── /cart
├── /checkout
├── /order/[orderNumber]
├── /custom-print
├── /blog
│   ├── /category/[slug]
│   └── /[slug]
├── /about
├── /contact
├── /shipping-policy
├── /return-policy
├── /privacy-policy
└── /terms
```

## 9.2. Admin

```text
/admin
├── /dashboard
├── /products
├── /products/new
├── /categories
├── /inventory
├── /materials
├── /orders
├── /custom-orders
├── /quotes
├── /print-jobs
├── /customers
├── /blog
├── /media
├── /reports
└── /settings
```

---

# 10. Homepage blueprint

```text
HEADER
├── Logo
├── Products
├── Custom Printing
├── Blog
└── Cart

HERO
├── Main value proposition
├── CTA: Shop products
└── CTA: Request custom print

FEATURED PRODUCTS

NEW PRODUCTS

CUSTOM PRINTING
├── Upload file
├── Tell us what you need
└── Get quote

HOW IT WORKS

ABOUT / TRUST

LATEST BLOG

FOOTER
```

## 10.1. Product detail

Phải có:

- gallery;
- tên;
- giá;
- SKU;
- variant;
- availability;
- mô tả;
- thông số;
- material;
- kích thước;
- thời gian chuẩn bị;
- chính sách đổi/trả;
- related products.

---

# 11. Phase-by-phase Development Plan

---

# PHASE 0 — Foundation & Product Definition

**Mục tiêu:** Có project, repository, environment và tài liệu nghiệp vụ tối thiểu.

**Ước lượng:** 1–2 ngày.

## Việc phải làm

### 0.1. Tạo repository

```bash
mkdir 3d-printing-platform
cd 3d-printing-platform
git init
```

Khuyến nghị repo:

```text
3d-printing-platform
├── apps/web
├── packages/ui
├── packages/config
└── docs
```

Nếu monorepo làm bạn chậm ở giai đoạn đầu, bắt đầu đơn giản:

```text
apps/web
```

Đừng over-engineer monorepo khi chưa cần.

### 0.2. Tạo Next.js

```bash
npx create-next-app@latest web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir
```

### 0.3. Cài foundation packages

Gợi ý:

```bash
npm install zod
npm install @supabase/supabase-js
npm install lucide-react
```

Sau đó mới thêm:

- React Hook Form;
- TanStack Query nếu thực sự cần client cache phức tạp;
- date library nếu cần;
- validation/payment libraries theo từng phase.

### 0.4. Tạo environment

```text
.env.local
.env.example
```

Không commit secret.

### 0.5. Viết Product Brief

Tạo:

```text
docs/product-brief.md
```

Nội dung tối thiểu:

```text
Brand
Target customer
Product categories
Custom printing flow
Geography
Shipping model
Payment model
Business goal
```

## Output

```text
[ ] GitHub repo
[ ] Next.js running locally
[ ] .env.example
[ ] docs/product-brief.md
[ ] README.md
```

## Definition of Done

Có thể chạy:

```bash
npm run dev
```

và mở website local.

---

# PHASE 1 — Database First

**Mục tiêu:** Có PostgreSQL schema đúng và có thể seed dữ liệu.

**Ước lượng:** 3–5 ngày.

Đây là phase quan trọng nhất.

## 1.1. Tạo Supabase project

Tạo project production-ready.

MVP có thể bắt đầu Free; khi cần automatic backups/production features có thể nâng cấp. Supabase hiện công bố Pro từ **$25/tháng**, kèm 8 GB disk/project và daily backups 7 ngày trên Pro; Free có 500 MB database và không có automatic backups. citeturn107431search1turn107431search4

## 1.2. Tạo migration structure

```text
database/
├── migrations/
├── seed/
└── README.md
```

Không phụ thuộc vào việc “click tạo table bằng UI” rồi quên schema.

Schema phải được version bằng migration.

## 1.3. Tạo các bảng theo thứ tự

```text
1. categories
2. products
3. product_variants
4. product_images
5. warehouses
6. materials
7. inventory_movements
8. customers
9. carts
10. cart_items
11. orders
12. order_items
13. custom_requests
14. custom_request_files
15. quotes
16. print_jobs
17. posts
18. users/roles
19. audit_logs
```

## 1.4. Seed data

Tạo ít nhất:

```text
3 categories
5 products
10 variants
3 materials
1 warehouse
2 test customers
3 test orders
```

Dữ liệu seed không dùng dữ liệu khách thật.

## 1.5. Tạo indexes

Ít nhất:

```text
products.slug
products.status
product_variants.sku
categories.slug
orders.order_number
orders.status
inventory_movements.item_id
inventory_movements.created_at
custom_requests.request_number
posts.slug
posts.published_at
```

## 1.6. Tạo constraints

Ví dụ:

```text
price >= 0
quantity > 0
sku unique
slug unique
order_number unique
```

## 1.7. Test inventory

Phải test các case:

```text
Opening balance
Purchase
Sale
Return
Damage
Adjustment
```

### Acceptance test

Nếu nhập:

```text
Opening = 10
Purchase = +5
Sale = -2
Damage = -1
```

thì available stock = 12.

## Output

```text
database/
├── migrations/
├── seed/
└── schema.md
```

## Definition of Done

Có thể xoá database dev và rebuild từ migration + seed mà hệ thống vẫn chạy.

Đây là tiêu chuẩn bắt buộc.

---

# PHASE 2 — Backend / Domain Services

**Mục tiêu:** Business logic tồn tại độc lập với UI.

**Ước lượng:** 3–5 ngày.

## Services cần có

```text
ProductService
CategoryService
InventoryService
CartService
OrderService
CustomerService
CustomRequestService
QuoteService
PrintJobService
```

## API/domain actions tối thiểu

```text
GET products
GET product by slug
GET categories
GET inventory
CREATE order
RESERVE stock
RELEASE stock
COMMIT stock
CREATE custom request
CREATE quote
APPROVE quote
CREATE print job
```

## Business rules quan trọng

### Stock reservation

```text
Order created
→ reserve stock
→ payment/order confirmed
→ commit stock
```

Nếu order hết hạn/cancel:

```text
release reservation
```

### Không cho âm stock

Transaction phải bảo vệ tình huống:

```text
Customer A buys 5
Customer B buys 5
Available = 5
```

Không được để cả hai cùng thành công.

## Output

```text
src/
├── domain/
├── services/
├── repositories/
├── validators/
└── lib/
```

## Definition of Done

Business logic có thể unit test mà không cần render UI.

---

# PHASE 3 — Admin / Back Office

**Mục tiêu:** Bạn không còn phải quản lý business bằng code hoặc SQL.

**Ước lượng:** 5–8 ngày.

Đây là phần ưu tiên cao hơn nhiều UI marketing.

## 3.1. Admin Dashboard

Hiển thị:

```text
Orders today
Revenue today
Pending orders
Low-stock items
Custom requests
Print jobs
```

## 3.2. Product Management

Phải làm được:

```text
Create
Edit
Archive
Add variant
Upload image
Change price
Set featured
```

## 3.3. Inventory Management

Phải làm được:

```text
View stock
Receive purchase
Manual adjustment
View movement history
```

## 3.4. Order Management

Phải làm được:

```text
View order
Change status
Add admin note
View customer
View payment
View shipping
```

## 3.5. Custom Orders

Phải làm được:

```text
List request
Open request
Download uploaded file
Add quote
Change status
Convert to order
```

## 3.6. Role-based access

MVP:

```text
OWNER
STAFF
```

OWNER:

- all access.

STAFF:

- products;
- inventory;
- orders;
- custom requests.

Không cần RBAC 20 role ngay từ đầu.

## Definition of Done

Bạn có thể **điều hành business trong một ngày mà không phải mở database console**.

---

# PHASE 4 — Public Website / UI

**Mục tiêu:** Website công khai có trải nghiệm đủ tốt để giới thiệu thương hiệu.

**Ước lượng:** 5–10 ngày.

## Sprint 4.1 — Layout

Làm:

```text
Header
Footer
Responsive container
Typography
Button
Card
Badge
Modal
Form
```

## Sprint 4.2 — Homepage

Theo blueprint ở phần 10.

## Sprint 4.3 — Product listing

Làm:

```text
Category
Search
Sort
Filter
Pagination
```

MVP filter chỉ cần:

```text
Category
Price
Availability
```

## Sprint 4.4 — Product detail

Làm:

```text
Gallery
Variant selector
Price
Stock state
Description
Technical info
Related products
```

## Sprint 4.5 — Custom printing landing page

Trang:

```text
/custom-print
```

Có:

```text
How it works
What files we accept
Supported materials
Request form
Upload
FAQ
```

## Definition of Done

Mobile-first.

Test ít nhất:

```text
iPhone width
Android width
iPad/tablet
Desktop
```

---

# PHASE 5 — Cart / Checkout / Order

**Mục tiêu:** Có thể thực sự nhận đơn.

**Ước lượng:** 4–7 ngày.

## 5.1. Cart

```text
Add item
Update quantity
Remove item
Subtotal
```

## 5.2. Checkout

MVP chưa cần user account.

Cho phép guest checkout:

```text
Name
Phone
Email optional
Address
Note
Payment method
```

## 5.3. Payment MVP

Ưu tiên:

```text
COD
Bank transfer
```

Tích hợp gateway sau khi có transaction.

## 5.4. Order confirmation

Sau khi đặt:

```text
ORD-20260830-0001
```

Khách nhận được:

```text
Order number
Items
Total
Contact
Status
```

## 5.5. Admin notification

MVP có thể:

```text
new order
→ email / Telegram / internal notification
```

Không cần xây notification center phức tạp.

## Definition of Done

Từ thiết bị khách:

```text
Product
→ Cart
→ Checkout
→ Order created
→ Admin sees order
```

Không cần thao tác thủ công trong database.

---

# PHASE 6 — Custom Printing / Quote / Production

**Mục tiêu:** biến lợi thế “in theo yêu cầu” thành workflow thực sự.

**Ước lượng:** 5–10 ngày.

## 6.1. Request form

Fields:

```text
Name
Phone
Email
What do you need?
Quantity
Material
Color
Size
Deadline
Budget (optional)
File upload
Reference image
```

## 6.2. Request inbox

Admin:

```text
NEW
→ REVIEWING
→ NEED_INFO
→ QUOTED
```

## 6.3. Quote

Admin nhập:

```text
Printing cost
Material cost
Post-processing
Design fee
Shipping
Discount
```

System tính:

```text
Total
```

## 6.4. Convert quote → order

Không tạo lại dữ liệu bằng tay.

```text
Quote APPROVED
→ Order created
→ Print Job created
```

## 6.5. Production

Admin theo dõi:

```text
QUEUED
PRINTING
FAILED
REPRINT
QC
COMPLETED
```

## Definition of Done

Bạn có thể nhận một file STL → báo giá → khách duyệt → tạo order → tạo print job mà không cần Excel/Google Sheets.

---

# PHASE 7 — Content / SEO / Analytics / Launch

**Ước lượng:** 3–5 ngày + liên tục.

## 7.1. Blog

Tối thiểu:

```text
Post
Category
Tag
Slug
Cover image
SEO title
SEO description
Published at
```

## 7.2. Content strategy

Ba nhóm nội dung:

```text
PRODUCT
- New model
- Product release
- Custom product showcase

KNOWLEDGE
- PLA vs PETG
- Resin vs FDM
- How 3D printing works
- How to choose material

MARKET
- 3D printing trends
- New printers
- New materials
- Vietnam market
```

## 7.3. SEO checklist

```text
[ ] sitemap.xml
[ ] robots.txt
[ ] canonical URL
[ ] metadata
[ ] OG image
[ ] schema.org Product
[ ] schema.org Article
[ ] clean slug
[ ] image alt
[ ] Search Console
[ ] GA4
```

## 7.4. Launch checklist

```text
[ ] production DB
[ ] backup
[ ] domain
[ ] SSL
[ ] environment variables
[ ] error tracking
[ ] analytics
[ ] order test
[ ] mobile test
[ ] 404 page
[ ] legal pages
[ ] shipping policy
[ ] return policy
[ ] privacy policy
```

---

# PHASE 8 — Operations & Scale

Phase này bắt đầu **sau khi có khách thật**.

Không xây từ đầu.

## Khi nào cần làm?

### Signal A

> > 50–100 orders/tháng

Bắt đầu đầu tư:

- reporting;
- customer segments;
- better inventory dashboard.

### Signal B

> nhiều custom orders

Thêm:

- automated quote templates;
- production scheduling;
- material consumption calculation.

### Signal C

> > 500–1,000 orders/tháng

Xem xét:

- queue/background jobs;
- advanced caching;
- dedicated search;
- warehouse features;
- advanced observability.

Không cần microservices chỉ vì website đã “có quy mô”.

---

# 12. Timeline đề xuất cho solo developer

## Tuần 1

```text
Day 1
- repo
- Next.js
- docs
- environment

Day 2–4
- Supabase
- schema
- migrations
- seed

Day 5
- inventory tests
```

## Tuần 2

```text
- services
- validation
- auth
- admin foundation
```

## Tuần 3

```text
- product admin
- category admin
- inventory admin
```

## Tuần 4

```text
- order admin
- custom order admin
- dashboard
```

## Tuần 5–6

```text
- homepage
- catalog
- product detail
- custom print landing
```

## Tuần 7

```text
- cart
- checkout
- orders
```

## Tuần 8

```text
- quote
- print jobs
- notifications
```

## Tuần 9

```text
- blog
- SEO
- analytics
```

## Tuần 10

```text
- security
- performance
- end-to-end tests
- launch
```

**MVP thực tế:** 8–10 tuần full-time hoặc khoảng 12–16 tuần part-time.

---

# 13. Backlog theo độ ưu tiên

## MUST HAVE

```text
[ ] Database
[ ] Product
[ ] Variant
[ ] Inventory
[ ] Admin
[ ] Product listing
[ ] Product detail
[ ] Cart
[ ] Checkout
[ ] Order
[ ] Custom order
[ ] Quote
[ ] Responsive UI
[ ] SEO basic
[ ] Analytics
[ ] Backup
```

## SHOULD HAVE

```text
[ ] Blog
[ ] Order tracking
[ ] Email notifications
[ ] Search
[ ] Product reviews
[ ] Sales reports
[ ] Customer history
```

## LATER

```text
[ ] Online payment
[ ] Coupon
[ ] Loyalty
[ ] Wishlist
[ ] AI recommendation
[ ] Multi-warehouse
[ ] Advanced production planning
[ ] Customer accounts
[ ] Marketplace integration
[ ] Mobile app
```

---

# 14. Cost model

## 14.1. Development cost

Nếu tự phát triển:

```text
Tiền code thuê = 0
```

Nhưng “chi phí” thực tế là thời gian.

Nếu quy đổi 100–150 giờ cho MVP và giả định giá trị giờ dev nội bộ, bạn có thể tự tính opportunity cost.

## 14.2. Infrastructure — mức khởi đầu

### Scenario A — Lean / validation

```text
Hosting: Free tier
Database: Supabase Free
Object storage: R2 free tier / low usage
Analytics: Free
GitHub: Free
Domain: trả theo năm

≈ rất thấp, phù hợp giai đoạn test thị trường
```

### Scenario B — Production nhỏ

```text
Supabase Pro: $25/month
Object storage: thường vài USD hoặc thấp hơn khi dữ liệu nhỏ
Hosting: tùy provider/traffic
Domain: theo năm
Email: tùy volume

Ngân sách an toàn: khoảng $30–70/month + domain/payment fees
```

Supabase hiện niêm yết Pro từ $25/tháng; Pro gồm 8 GB disk/project, 250 GB egress và daily backups 7 ngày. citeturn107431search1turn107431search4

Cloudflare R2 hiện có 10 GB-month storage miễn phí, 1 triệu Class A và 10 triệu Class B operations/tháng miễn phí; standard storage vượt mức là $0.015/GB-month và không tính egress Internet. citeturn107431search0turn107431search2

### Scenario C — Có traction

Khi traffic/file upload/order tăng thì xem lại:

```text
Database tier
File storage
CDN/cache
Email
Monitoring
Search
Payment fees
Shipping integration
```

Không scale theo cảm giác; scale khi có metrics.

---

# 15. Tính khả thi

## 15.1. Technical feasibility

**Cao.**

Một developer có thể triển khai MVP vì:

- Next.js xử lý frontend + server logic;
- PostgreSQL xử lý relational data;
- Supabase giảm workload infrastructure;
- R2/Storage xử lý file;
- không cần microservices;
- không cần Kubernetes;
- không cần app mobile ở giai đoạn đầu.

## 15.2. Business feasibility

Có tính khả thi nếu bạn không cạnh tranh chỉ bằng:

> “chúng tôi bán sản phẩm in 3D”.

Nên cạnh tranh bằng:

```text
Unique designs
Customization
Fast turnaround
Quality
Small-batch production
Local convenience
```

## 15.3. Biggest risks

### Risk 1 — Dành quá nhiều thời gian code

Mitigation:

```text
MVP first
Admin early
No unnecessary features
```

### Risk 2 — Website đẹp nhưng không có traffic

Mitigation:

```text
Content + SEO + social channels
```

### Risk 3 — Inventory sai

Mitigation:

```text
Ledger
Transactions
Audit log
```

### Risk 4 — Custom order quá thủ công

Mitigation:

```text
Request
→ Quote
→ Approval
→ Order
→ Print Job
```

---

# 16. Testing strategy

## Unit tests

Test:

```text
pricing
stock calculation
stock reservation
quote total
order total
```

## Integration tests

Test:

```text
create order
reserve stock
cancel order
release stock
convert quote to order
```

## E2E

Test critical flow:

```text
Customer opens product
→ adds cart
→ checkout
→ order exists in admin
```

Custom flow:

```text
Customer uploads file
→ admin sees request
→ quote
→ approve
→ order
→ print job
```

---

# 17. Security checklist

```text
[ ] Never expose service-role key to browser
[ ] Validate all server inputs
[ ] Validate file type
[ ] Validate file size
[ ] Protect admin routes
[ ] RBAC
[ ] Rate-limit custom upload/order endpoint
[ ] Sanitize rendered rich text
[ ] Use signed/private file URLs for sensitive files
[ ] Audit admin changes
[ ] Backup DB
[ ] Do not log secrets
```

---

# 18. AI-assisted development workflow

Bạn muốn dùng **Codex + Claude + Gemini**. Nên phân vai, không cho cả ba cùng “code một thứ”.

## Codex — Implementation agent

Dùng cho:

```text
- code
- refactor
- migration
- tests
- bug fixing
- repo-wide changes
```

Prompt mẫu:

```text
You are the implementation engineer.
Read docs/product-brief.md and docs/architecture.md first.
Implement only Phase X task Y.
Do not change unrelated files.
Write tests for business-critical logic.
Before changing schema, explain migration impact.
At the end, report:
1. files changed
2. behavior changed
3. tests run
4. known risks
```

## Claude — Architecture / reviewer

Dùng để:

```text
- review architecture
- review database model
- identify edge cases
- code review
- UX/product critique
```

Prompt:

```text
Act as a senior system architect.
Review this proposal/code against the project docs.
Focus on:
- data integrity
- concurrency
- inventory correctness
- maintainability
- unnecessary complexity
Return blocking issues first, then improvements.
```

## Gemini — Alternative / research / UX angle

Dùng để:

```text
- alternative architecture
- UX ideas
- competitor research
- SEO/content ideas
- edge-case brainstorming
```

Prompt:

```text
Act as an independent reviewer.
Do not assume the current design is correct.
Find a simpler or safer alternative.
Compare trade-offs and recommend one approach.
```

## Rule

```text
Claude/Gemini = challenge the design
Codex = implement the approved design
```

Không để AI tự ý thay database schema giữa chừng mà không cập nhật migration/documentation.

---

# 19. Git workflow

Mỗi phase nên có branch:

```text
main
├── feat/database-foundation
├── feat/backend-services
├── feat/admin-products
├── feat/admin-orders
├── feat/public-catalog
├── feat/cart-checkout
└── feat/custom-printing
```

Commit theo feature nhỏ:

```text
feat(db): add product schema
feat(db): add inventory ledger
feat(admin): add product management
feat(order): create checkout flow
fix(inventory): prevent negative stock
```

---

# 20. Documentation cần duy trì

Tạo folder:

```text
docs/
├── product-brief.md
├── architecture.md
├── database.md
├── api.md
├── business-rules.md
├── deployment.md
├── operations.md
└── decisions/
```

Mỗi quyết định lớn ghi vào ADR:

```text
docs/decisions/001-postgresql.md
```

Template:

```text
# ADR-001

## Context

## Decision

## Alternatives

## Consequences
```

---

# 21. Việc phải làm ngay — Day 1 checklist

Đây là checklist bạn có thể bắt đầu ngay sau khi đọc tài liệu.

```text
[ ] 1. Tạo GitHub repository

[ ] 2. Tạo Next.js TypeScript project

[ ] 3. Chạy local thành công

[ ] 4. Tạo Supabase project DEV

[ ] 5. Tạo docs/product-brief.md

[ ] 6. Tạo docs/architecture.md

[ ] 7. Tạo docs/database.md

[ ] 8. Tạo database/migrations

[ ] 9. Viết migration categories

[ ] 10. Viết migration products

[ ] 11. Viết migration product_variants

[ ] 12. Viết migration materials

[ ] 13. Viết migration warehouses

[ ] 14. Viết migration inventory_movements

[ ] 15. Viết migration customers/orders

[ ] 16. Viết seed data

[ ] 17. Test reset DB + migration + seed

[ ] 18. Commit: feat(db): initial domain schema
```

**Không bắt đầu bằng homepage.**

Trang chủ có thể thay đổi 10 lần. Database sai thì phải trả giá bằng dữ liệu thật.

---

# 22. Definition of MVP hoàn chỉnh

MVP được coi là hoàn thành khi bạn có thể làm toàn bộ workflow sau mà không cần mở SQL console:

## Product

```text
Admin tạo product
→ tạo variant
→ upload ảnh
→ publish
```

## Inventory

```text
Admin nhập hàng
→ stock tăng
→ movement được ghi
```

## Sale

```text
Customer mua
→ cart
→ checkout
→ order
→ reservation
→ fulfillment
```

## Custom

```text
Customer upload STL
→ request
→ admin quote
→ customer approve
→ order
→ print job
```

## Reporting

```text
Dashboard
→ orders
→ revenue
→ stock
→ custom jobs
```

---

# 23. Những thứ KHÔNG làm trong 90 ngày đầu

```text
❌ Mobile app
❌ Microservices
❌ Kubernetes
❌ AI recommendation engine
❌ Loyalty points
❌ Complex coupon engine
❌ Marketplace sync
❌ Multi-country tax engine
❌ Multi-warehouse optimization
❌ Real-time 3D configurator nếu chưa có demand
```

Chỉ xây khi business chứng minh cần.

---

# 24. Quyết định kiến trúc cuối cùng

## Recommended MVP

```text
Next.js
+ TypeScript
+ Tailwind
+ shadcn/ui
+ Supabase/PostgreSQL
+ R2 or Supabase Storage
+ GitHub
+ Vercel/Cloudflare
+ GA4
```

## Source of Truth

```text
PostgreSQL
```

## Business priority

```text
1. Data integrity
2. Inventory
3. Order workflow
4. Admin
5. Product UX
6. Custom printing
7. SEO/content
8. Advanced automation
```

---

# 25. Kết luận

Với background mobile developer, việc khó nhất không phải là học Next.js.

Phần khó nhất là **chuyển từ tư duy “app screen” sang tư duy “business system”**.

Hãy luôn suy nghĩ theo chuỗi:

```text
Business event
→ domain entity
→ database change
→ business rule
→ API/service
→ UI
```

Ví dụ:

```text
Customer buys 2 Black Dragon
```

Không bắt đầu từ:

```text
Button Add to Cart
```

Mà bắt đầu từ:

```text
Order Item
→ Variant
→ Reservation
→ Inventory
→ Payment
→ Fulfillment
```

Đây sẽ là tư duy giúp hệ thống của bạn sống được khi business lớn lên.

---

# 26. Recommended immediate next artifact

Sau tài liệu này, artifact nên được tạo tiếp theo là:

```text
docs/database.md
```

Nội dung cần có:

```text
ERD
Table definitions
Enums
Indexes
Constraints
Inventory rules
Order rules
RLS strategy
Migration order
Seed data
Example queries
```

Sau đó mới bắt đầu code database.

---

**END OF DOCUMENT**

---

# 13. BRAND DIRECTION — BaSa3D

## 13.1. Tên thương hiệu đề xuất

### Tên hiện tại

**BaSa3D**

Nguồn gốc:

```text
Bảo Sang → BaSa
3D printing → 3D

BaSa + 3D → BaSa3D
```

Đây là một tên **có lợi thế về tính cá nhân, dễ giải thích và có câu chuyện founder**. Với một startup cá nhân, đây là điểm mạnh hơn nhiều so với một cái tên 3D chung chung.

### Đánh giá

| Tiêu chí | BaSa3D |
|---|---:|
| Cá nhân hoá | ⭐⭐⭐⭐⭐ |
| Dễ nhớ | ⭐⭐⭐⭐ |
| Gắn với 3D | ⭐⭐⭐⭐⭐ |
| Có thể mở rộng | ⭐⭐⭐⭐ |
| Phù hợp founder IT | ⭐⭐⭐⭐⭐ |
| Có câu chuyện thương hiệu | ⭐⭐⭐⭐⭐ |

**Khuyến nghị:** Giữ **BaSa3D** làm tên chính cho MVP thay vì đổi tên liên tục.

Tên có thể được viết theo hierarchy:

```text
BA SA 3D
BaSa3D
BASA3D
```

Trong logo, ưu tiên `BaSa3D`; domain/technical identifier có thể dùng `basa3d`.

> Lưu ý: kiểm tra domain, social handle và trademark tại thị trường mục tiêu trước khi đăng ký chính thức. Tìm kiếm sơ bộ cho thấy có các thương hiệu 3D có tên gần như BA 3D Printing, Bau3D và Bassen3D, dù không đồng nghĩa với việc “BaSa3D” đã bị đăng ký hay không. citeturn910290search0turn910290search1turn910290search4

---

## 13.2. Một số phương án tên khác

Không nên đổi chỉ vì “nghe hay hơn”. Chỉ đổi nếu có lý do chiến lược.

### Nhóm cá nhân — ưu tiên cao

```text
BaSa3D
BaSa Print
BaSa Studio
BaSa Maker
BaSa Lab
BaSa Works
```

**BaSa3D** mạnh nhất nếu định vị chính là 3D printing.

**BaSa Lab** mạnh nếu sau này muốn đi hướng design + engineering + prototyping.

**BaSa Works** mạnh nếu muốn mở rộng từ 3D printing sang các sản phẩm maker/technology.

### Nhóm hiện đại / tech

```text
BaSaLab
BaSaForge
BaSaWorks
BaSaCraft
BaSaForm
BaSaPrint
```

### Nhóm chuyên nghiệp / manufacturing

```text
BaSa Manufacturing
BaSa Additive
BaSa Fabrication
BaSa3D Studio
BaSa Digital Fabrication
```

### Kết luận naming

**Top 3:**

```text
1. BaSa3D       ← khuyên dùng hiện tại
2. BaSa Lab     ← tốt nếu muốn xây thương hiệu kỹ thuật lâu dài
3. BaSa Works   ← tốt nếu muốn mở rộng sản phẩm sau này
```

Không nên sử dụng tên quá generic kiểu `Vietnam3D`, `Print3D`, `3DShop`, `3DStore` vì khó tạo tài sản thương hiệu riêng.

---

# 14. BRAND PERSONALITY

BaSa3D nên đứng ở giao điểm:

```text
TECH          MAKER          FRIENDLY
  │             │               │
IT mindset   Hands-on       Dễ tiếp cận
Precision     Creativity     Không quá corporate
```

## 14.1. Tính cách

BaSa3D nên có cảm giác:

- kỹ thuật nhưng không khô khan;
- hiện đại nhưng không lạnh;
- maker nhưng sạch sẽ;
- đáng tin nhưng vẫn có cá tính;
- “build thật, print thật”.

Không nên đi theo hướng:

- quá công nghiệp ngay từ đầu;
- quá trẻ con;
- quá “gaming RGB”; 
- dùng quá nhiều biểu tượng máy in 3D cliché.

---

# 15. SLOGAN / TAGLINE

Không cần chọn slogan cuối cùng ngay ở MVP. Có thể dùng một tagline tạm thời rồi test với khách hàng.

## Nhóm 1 — dễ hiểu, thương mại

> **Ý tưởng thành sản phẩm.**

> **Từ ý tưởng đến vật thật.**

> **Bạn nghĩ. BaSa3D in.**

> **Biến ý tưởng thành vật thật.**

## Nhóm 2 — maker / creative

> **Make it real.**

> **Think. Design. Print.**

> **From idea to object.**

> **Your idea, printed.**

## Nhóm 3 — có cá tính founder

> **Built by curiosity. Printed by BaSa3D.**

> **Code it. Design it. Print it.**

> **From code to creation.**

### Tagline mình đề xuất cho MVP

**BaSa3D — Từ ý tưởng đến vật thật.**

Phần tiếng Anh có thể dùng:

**BaSa3D — From Idea to Reality.**

Không cần dịch slogan từng chữ giữa tiếng Việt và tiếng Anh; mục tiêu là giữ cùng một ý niệm.

---

# 16. BRAND STORY

Đây là câu chuyện thương hiệu nền để sau này dùng trong About, social bio và pitch.

> BaSa3D bắt đầu từ một người làm IT và niềm yêu thích tạo ra những thứ có thể chạm, sử dụng và nhìn thấy ngoài đời thực. Từ thế giới của code và những sản phẩm số, BaSa3D hướng tới một bước tiếp theo: biến ý tưởng thành vật thật bằng thiết kế và công nghệ in 3D.
>
> BaSa3D không chỉ muốn bán những món đồ được in sẵn. Mục tiêu là giúp mọi người biến những ý tưởng nhỏ, những món đồ khó tìm hay những thiết kế riêng thành sản phẩm có thể cầm trên tay.

### Brand promise

```text
Bạn có ý tưởng.
BaSa3D giúp biến nó thành vật thật.
```

---

# 17. LOGO DIRECTION

## 17.1. Không cần thuê thiết kế logo ngay

Ở phase 0, chỉ cần tạo một **temporary logo system** có thể dùng cho:

- website;
- GitHub README;
- favicon;
- social avatar;
- packaging mockup.

Sau khi có sản phẩm và feedback khách hàng mới đầu tư logo chuyên nghiệp.

## 17.2. Concept A — Wordmark

```text
BaSa3D
```

Tập trung vào typography.

Đây là lựa chọn mình khuyên dùng đầu tiên vì:

- dễ triển khai;
- dễ scale;
- ít cliché;
- không khóa thương hiệu vào hình chiếc máy in.

## 17.3. Concept B — B/S monogram

Dùng chữ:

```text
B + S + 3D
```

Có thể tạo hình bằng các layer/góc cạnh giống concept 3D.

## 17.4. Concept C — Layer / extrusion

Logo thể hiện một đường layer hoặc object được “extrude” dần lên.

Không nên vẽ máy in 3D trực tiếp trừ khi cần icon riêng.

---

# 18. COLOR SYSTEM

Chưa cần khóa màu thương hiệu vĩnh viễn. Tạm thời dùng một hệ thống có tính tech/maker.

## Phương án A — Graphite + Lime

```text
Primary:   #18181B
Secondary: #27272A
Accent:    #A3E635
Background:#FAFAF9
```

Cảm giác:

```text
TECH + MAKER + MODERN
```

## Phương án B — Graphite + Blue

```text
Primary:   #18181B
Secondary: #27272A
Accent:    #3B82F6
Background:#F8FAFC
```

Cảm giác:

```text
TECH + TRUST + CLEAN
```

## Phương án C — Black + Orange

```text
Primary:   #18181B
Secondary: #27272A
Accent:    #F97316
Background:#FAFAF9
```

Cảm giác:

```text
MAKER + ENERGY + WORKSHOP
```

### Recommendation

MVP nên bắt đầu với:

**Graphite + Lime**

vì khác biệt hơn giao diện SaaS màu xanh thông thường và phù hợp chất “maker”.

Không cần sử dụng màu accent ở mọi nơi. Dùng accent cho:

- CTA;
- active state;
- badges;
- link;
- highlights.

---

# 19. TYPOGRAPHY

MVP nên ưu tiên font dễ đọc và hỗ trợ tiếng Việt tốt.

Gợi ý:

```text
UI / Body: Inter
Heading:   Inter / Geist
Code:      JetBrains Mono
```

Không nên dùng quá 2 font family.

---

# 20. PROJECT NAMING

Đừng đặt tên project chỉ là `3d-web` hoặc `website-3d`.

Nên phân biệt:

```text
Brand      = BaSa3D
Repository = technical project name
App        = customer-facing product
Package    = npm/package naming
Database   = technical DB name
```

## 20.1. Khuyến nghị chính

Repository:

```text
basa3d-web
```

hoặc nếu muốn rõ domain hơn:

```text
basa3d-platform
```

### Mình khuyên:

**`basa3d-web`** cho phase đầu.

Lý do:

- ngắn;
- dễ nhớ;
- đúng scope;
- không khóa app vào architecture;
- GitHub URL đẹp.

## 20.2. Tên monorepo sau này

Nếu phát triển thêm worker/admin/shared package:

```text
basa3d
├── apps/
│   ├── web/
│   ├── admin/
│   └── worker/
├── packages/
│   ├── ui/
│   ├── db/
│   ├── config/
│   └── types/
└── docs/
```

Chỉ chuyển sang monorepo khi thực sự cần. **Không over-engineer ở ngày đầu tiên.**

---

# 21. LOCAL DEVELOPMENT NAMING

Khuyến nghị thống nhất:

```text
Project:
  basa3d-web

Directory:
  ~/Projects/basa3d-web

GitHub:
  basa3d-web

App name:
  BaSa3D

Database:
  basa3d

Supabase project:
  basa3d-production
  basa3d-staging   (khi cần)

Environment:
  development
  staging
  production
```

## 21.1. Branch naming

```text
main

develop

feat/product-catalog
feat/inventory
feat/cart
feat/custom-order
fix/order-validation
chore/database-migration
```

## 21.2. Commit convention

```text
feat: add product schema
feat: add inventory ledger
feat: implement product listing
fix: prevent overselling reserved stock
chore: setup supabase
refactor: extract product repository
```

---

# 22. AI DEVELOPMENT STRATEGY — CODEX / CLAUDE / GEMINI

Bạn không nên giao cùng một task cho cả 3 AI rồi lấy code của cả 3 ghép lại.

Thay vào đó, mỗi AI có một vai trò.

## Codex — Implementation / Repo Agent

Dùng cho:

- code implementation;
- migration;
- refactor;
- test;
- đọc repository;
- sửa bug;
- tạo PR/commit.

Prompt pattern:

```text
Read the repository first.
Do not change architecture unless necessary.
Implement only the requested scope.
Add tests for business-critical behavior.
Report changed files and assumptions.
```

## Claude — Architecture / Review

Dùng cho:

- review architecture;
- review schema;
- edge cases;
- API contracts;
- UX critique;
- refactoring proposal.

## Gemini — Alternative Research / Product & Content

Dùng cho:

- alternative implementation;
- SEO/content ideas;
- UX research;
- market research;
- compare technical approaches;
- brainstorm product catalog.

## Golden rule

```text
Human = owner
Claude/Gemini = reviewers / advisors
Codex = implementation agent
Git = source of truth
```

Không để AI tự quyết định business rule quan trọng mà không ghi vào `/docs`.

---

# 23. AI CONTEXT FILES

Ngay khi tạo repository, tạo:

```text
AGENTS.md
CLAUDE.md
GEMINI.md
README.md
```

Các file này không phải 4 bộ rule khác nhau.

Nội dung cốt lõi phải thống nhất:

```text
/docs
  architecture.md
  database.md
  business-rules.md
  product-requirements.md
  roadmap.md
```

AI nào cũng phải đọc các file này trước khi code.

## Suggested AGENTS.md

```md
# BaSa3D Engineering Rules

## Product
BaSa3D is a 3D printing e-commerce and custom printing platform.

## Stack
- Next.js
- TypeScript
- PostgreSQL / Supabase
- Tailwind CSS
- shadcn/ui

## Rules
- Database is the source of truth.
- Money uses integer values.
- Inventory changes use inventory movements.
- Order items snapshot selling information.
- Business rules must be tested.
- Never bypass server-side authorization.
- Read /docs before changing domain architecture.
```

---

# 24. PROJECT INITIALIZATION — DO THIS FIRST

Khi bắt đầu code, dùng tên project:

```bash
npx create-next-app@latest basa3d-web
```

Sau đó cấu trúc tối thiểu:

```text
basa3d-web/
├── app/
├── components/
├── lib/
├── public/
├── tests/
├── docs/
├── .env.example
├── AGENTS.md
├── CLAUDE.md
├── GEMINI.md
├── README.md
└── package.json
```

## First commit

```text
chore: initialize BaSa3D web project
```

## Sau first commit

Không code product UI ngay.

Làm tiếp:

```text
1. docs/product-requirements.md
2. docs/business-rules.md
3. docs/database.md
4. Supabase project
5. Initial migrations
6. Seed data
7. Product repository
```

---

# 25. BRAND MVP CHECKLIST

## Must Have trước launch

```text
[ ] Brand name = BaSa3D
[ ] Temporary wordmark
[ ] Favicon
[ ] Primary/secondary/accent color
[ ] Typography
[ ] Slogan tạm thời
[ ] Social bio
[ ] Domain candidate
[ ] GitHub organization/repository
```

## Không cần làm ngay

```text
[ ] Full visual identity guideline
[ ] Professional logo package
[ ] Packaging guideline
[ ] Brand book 50 pages
[ ] Motion identity
```

---

# 26. BA SA 3D — SHORT BIO OPTIONS

## Vietnamese

> BaSa3D — In 3D, thiết kế và biến ý tưởng thành vật thật.

## More technical

> BaSa3D — 3D Printing • Custom Design • Prototyping

## Personal maker

> BaSa3D — Từ một người làm IT đến những sản phẩm có thể cầm trên tay.

## English

> BaSa3D — 3D Printing, Custom Design & Making.

---

# 27. FINAL BRAND DECISION FOR MVP

Trừ khi có lý do mạnh để thay đổi, hãy bắt đầu với:

```text
Brand:
  BaSa3D

Brand meaning:
  Bảo Sang + 3D

Tagline:
  Từ ý tưởng đến vật thật.

English:
  From Idea to Reality.

Visual direction:
  Modern Maker / Tech

Color:
  Graphite + Lime

Primary repository:
  basa3d-web

Database:
  basa3d

Product/app name:
  BaSa3D
```

Đây là **MVP brand system**, chưa phải brand identity cuối cùng. Mục tiêu của nó là giúp dự án có một bộ nhận diện nhất quán để bắt đầu xây ngay, sau đó cải tiến dựa trên sản phẩm thật và phản hồi khách hàng.

---

# 20. AI-Assisted Development: Cách dùng Codex + Claude + Gemini mà không làm project rối

Đây là phần dành riêng cho workflow solo developer. Mục tiêu không phải cài càng nhiều agent/skill càng tốt, mà là tạo **một source of truth cho con người + AI**.

## 20.1. Nguyên tắc số 1: Repository là source of truth

Không để kiến thức quan trọng chỉ nằm trong chat với Codex, Claude hoặc Gemini.

Mọi quyết định quan trọng phải được đưa về repository:

```text
AGENTS.md
CLAUDE.md
GEMINI.md
README.md
docs/
```

OpenAI khuyến nghị dùng `AGENTS.md` để cung cấp context bền vững cho Codex; Codex đọc các file này theo scope của thư mục. OpenAI cũng khuyến nghị không biến `AGENTS.md` thành một “cuốn sách 1.000 trang”, mà dùng nó như mục lục trỏ tới knowledge base trong `docs/`. citeturn903341search0turn903341search2turn903341search3

Claude Code hỗ trợ `CLAUDE.md` làm project memory và tự load file này khi khởi động session. citeturn836804search7

Gemini CLI sử dụng `GEMINI.md` làm context workspace; Agent Skills là lớp kiến thức theo nhu cầu, giúp tránh nhồi tất cả instruction vào context ở mọi session. citeturn628014search1turn628014search5

## 20.2. Cấu trúc repository khuyến nghị

Ngay khi tạo project, tạo cấu trúc này:

```text
basa3d-web/
├── AGENTS.md
├── CLAUDE.md
├── GEMINI.md
├── README.md
├── package.json
├── .env.example
├── .gitignore
│
├── docs/
│   ├── README.md
│   ├── product/
│   │   ├── vision.md
│   │   ├── requirements.md
│   │   └── roadmap.md
│   ├── architecture/
│   │   ├── architecture.md
│   │   ├── decisions.md
│   │   └── api-conventions.md
│   ├── database/
│   │   ├── schema.md
│   │   ├── erd.md
│   │   ├── business-rules.md
│   │   └── migrations.md
│   ├── operations/
│   │   ├── deployment.md
│   │   ├── backup-restore.md
│   │   └── runbook.md
│   └── exec-plans/
│       ├── active/
│       └── completed/
│
├── .agents/
│   └── skills/
│       ├── database-review/
│       ├── security-review/
│       ├── e2e-testing/
│       └── release-check/
│
├── src/
├── supabase/
│   ├── migrations/
│   └── seed.sql
└── tests/
```

## 20.3. Không nên cài agent/skill hàng loạt

**Khuyến nghị:** bắt đầu với 4 skill project-specific, không hơn.

### Skill 1 — `database-review`

Mục đích:

- review migration;
- kiểm tra FK/index/unique constraint;
- kiểm tra transaction;
- kiểm tra inventory race condition;
- phát hiện query có nguy cơ N+1;
- kiểm tra dữ liệu snapshot trong order.

### Skill 2 — `security-review`

Mục đích:

- kiểm tra auth/RBAC;
- RLS nếu dùng Supabase;
- secret leakage;
- upload file;
- input validation;
- server action/API authorization;
- dependency risk.

### Skill 3 — `e2e-testing`

Mục đích:

- tạo test Playwright;
- kiểm tra product → cart → checkout;
- kiểm tra custom order;
- kiểm tra admin inventory;
- test mobile viewport vì bạn xuất thân mobile.

### Skill 4 — `release-check`

Mục đích:

- typecheck;
- lint;
- unit tests;
- integration tests;
- e2e smoke tests;
- migration check;
- build production;
- kiểm tra env;
- kiểm tra git diff.

Gemini CLI hiện hỗ trợ Agent Skills ở workspace (`.gemini/skills/` hoặc alias `.agents/skills/`) và có thể discover/enable/disable bằng CLI. Skills là on-demand và được khuyến nghị để đóng gói workflow chuyên biệt. citeturn628014search1turn628014search3

**Vì vậy nên đặt skill dùng chung ở `.agents/skills/`** để tối đa khả năng tái sử dụng giữa toolchain agent khác nhau, đồng thời Gemini CLI có alias tương thích cho thư mục này. citeturn628014search1

## 20.4. Vai trò của từng AI

Không giao cùng một task cho 3 AI cùng lúc.

### Codex — Primary Implementer

Dùng cho:

- tạo feature;
- sửa code;
- migration;
- test;
- refactor;
- debug;
- chạy command;
- kiểm tra diff.

OpenAI mô tả Codex phù hợp với task có scope rõ, tương tự một GitHub issue/PR, và hiệu quả khi repository có môi trường chạy/test đáng tin cậy. citeturn903341search1

### Claude — Architect / Reviewer

Dùng cho:

- design database;
- review architecture;
- review PR/diff;
- tìm edge case;
- review business rule;
- review UX flow phức tạp;
- phân tích trade-off.

### Gemini — Research / Alternative Solver

Dùng cho:

- tìm phương án thay thế;
- research framework/API;
- benchmark/compare library;
- content/SEO draft;
- kiểm tra documentation mới;
- đề xuất cách đơn giản hơn.

**Quy tắc quan trọng:** chỉ một agent là “owner” của mỗi change.

```text
Claude/Gemini
      ↓
Review / Proposal
      ↓
Bạn quyết định
      ↓
Codex implement
      ↓
Codex test
      ↓
Claude review diff
      ↓
Merge
```

## 20.5. Workflow task chuẩn

Mỗi task nên có một file trong:

```text
/docs/exec-plans/active/
```

Ví dụ:

```text
2026-09-01-inventory-ledger.md
```

Template:

```md
# Feature: Inventory Ledger

## Goal
Implement stock movement as append-only ledger.

## Non-goals
- No supplier module yet.
- No forecasting yet.

## Requirements
1. Stock movement is append-only.
2. Every movement has reference type/id.
3. Sale reservation must be atomic.

## Acceptance Criteria
- [ ] Migration created
- [ ] Service implemented
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Docs updated

## Files likely affected
- supabase/migrations/*
- src/modules/inventory/*
- tests/inventory/*
```

Sau khi hoàn thành chuyển file sang:

```text
/docs/exec-plans/completed/
```

## 20.6. Prompt chuẩn cho Codex

Không prompt kiểu:

```text
Build inventory for me.
```

Nên dùng:

```text
Read:
- AGENTS.md
- docs/database/schema.md
- docs/database/business-rules.md
- docs/exec-plans/active/2026-09-01-inventory-ledger.md

Implement ONLY the acceptance criteria in this task.

Requirements:
1. Inspect existing code first.
2. Do not redesign unrelated modules.
3. Follow existing conventions.
4. Add tests for happy path and race/edge cases.
5. Run typecheck, lint and relevant tests.
6. Summarize changed files and any remaining risk.
```

OpenAI specifically recommends shaping Codex prompts like GitHub issues with concrete scope, affected files and expected changes rather than vague requests. citeturn903341search1

## 20.7. Prompt chuẩn cho Claude

```text
Review the proposed implementation against:
- docs/database/business-rules.md
- docs/architecture/decisions.md
- current git diff

Focus on:
1. correctness
2. data integrity
3. race conditions
4. security
5. maintainability
6. unnecessary complexity

Do NOT rewrite code.
Return findings by severity:
CRITICAL / HIGH / MEDIUM / LOW
```

## 20.8. Prompt chuẩn cho Gemini

```text
Research the current best-practice options for [TOPIC].

Constraints:
- TypeScript
- Next.js
- PostgreSQL/Supabase
- solo developer
- low operational overhead

Compare 2-4 viable approaches.
For each option provide:
- pros
- cons
- cost implications
- migration risk
- implementation complexity

Do not change the repository.
```

## 20.9. Những thứ nên automation ngay từ đầu

### Pre-commit

Tối thiểu:

```text
format
lint
typecheck
```

Không cần test toàn bộ E2E ở pre-commit vì sẽ chậm.

### CI

Mỗi Pull Request:

```text
install
→ lint
→ typecheck
→ unit test
→ integration test
→ build
```

Main branch:

```text
→ migration validation
→ production build
→ smoke test
```

### Release checklist

```text
[ ] git status clean
[ ] migration reviewed
[ ] tests passed
[ ] build passed
[ ] env verified
[ ] DB backup strategy verified
[ ] rollback plan known
```

## 20.10. Không commit secret

Tạo ngay:

```text
.env.local
.env.example
```

`.env.example` chỉ chứa key name:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

Không commit giá trị thật.

Đặc biệt `SUPABASE_SERVICE_ROLE_KEY` chỉ được dùng server-side.

## 20.11. Tạo một bộ “project context” tối thiểu

### `AGENTS.md`

Chỉ nên khoảng 80–150 dòng.

Nội dung:

```text
1. Project mission
2. Architecture map
3. Commands
4. Coding conventions
5. Database rules
6. Inventory invariants
7. Testing rules
8. Security rules
9. Links to docs/
```

Không đưa schema 1.000 dòng vào đây.

### `CLAUDE.md`

Ghi:

```text
- Review before implementation for risky architecture work.
- Prefer simple solutions.
- Never change DB schema without migration.
- Never bypass tests.
- Read docs/ before making domain decisions.
```

### `GEMINI.md`

Ghi:

```text
- This is a solo-founder TypeScript project.
- Prefer current official documentation when researching.
- Do not modify code during research unless explicitly asked.
- Compare alternatives before recommending a new dependency.
```

## 20.12. Đừng dùng AI để “phát minh” business rules

Ví dụ AI không được tự quyết định:

```text
stock_available = stock_on_hand - reserved - damaged
```

hoặc:

```text
When should stock be restored after cancellation?
```

Đây là domain decision của bạn.

AI chỉ được:

```text
implement documented rule
```

Không phải:

```text
invent undocumented rule
```

## 20.13. Database-specific AI guardrails

Đối với các task database, luôn yêu cầu agent:

```text
Before changing schema:
1. Read current schema.
2. Check foreign keys.
3. Check indexes.
4. Check RLS/policies.
5. Check existing production assumptions.
6. Create migration.
7. Add rollback consideration.
8. Update docs/database/schema.md.
```

Đối với inventory:

```text
Never directly mutate current stock from UI.
Every inventory change must be attributable to a movement.
```

Đối với order:

```text
Never use current product price to reconstruct historical order totals.
```

## 20.14. Mục tiêu token/context

**Đừng đưa toàn bộ project vào context mỗi lần.**

Mỗi task chỉ cần:

```text
AGENTS.md
+ relevant docs
+ target files
+ tests
```

OpenAI ghi nhận rằng prompt/tool context lean hơn có thể giảm token và chi phí trong các evals nội bộ; quan trọng hơn là chỉ cung cấp context liên quan tới task. Đây là hướng dẫn hiệu năng có tính định hướng chứ không phải mức tiết kiệm được đảm bảo cho project của bạn. citeturn836804search2

## 20.15. Agent matrix

| Task | Codex | Claude | Gemini |
|---|---:|---:|---:|
| Implement feature | ★★★★★ | ★★★★ | ★★★ |
| Fix bug | ★★★★★ | ★★★★ | ★★★ |
| Database design | ★★★★ | ★★★★★ | ★★★★ |
| Code review | ★★★★ | ★★★★★ | ★★★ |
| Research library | ★★★ | ★★★★ | ★★★★★ |
| SEO/content research | ★★★ | ★★★★ | ★★★★★ |
| Run/test repo | ★★★★★ | ★★★★ | ★★★★ |
| Explore alternatives | ★★★★ | ★★★★★ | ★★★★★ |

Đây là **workflow recommendation**, không phải benchmark tuyệt đối.

## 20.16. Những thứ KHÔNG nên cài ở Phase 0

Chưa cần:

```text
❌ 10+ MCP servers
❌ 10+ community skills
❌ multi-agent orchestration framework
❌ autonomous deployment agent
❌ AI-generated content pipeline
❌ vector database
❌ RAG system
❌ microservices
❌ Kubernetes
```

Lý do: bạn chưa có domain ổn định. Cài automation quá sớm sẽ làm tăng cognitive load và dependency surface.

## 20.17. Khi nào mới thêm MCP

Thêm MCP khi có một action lặp lại và thật sự cần truy cập dữ liệu/tool bên ngoài.

Ví dụ về sau:

```text
Supabase MCP
Analytics MCP
GitHub MCP
Cloudflare MCP
```

Nhưng trước tiên cần ổn định workflow manual.

Gemini CLI hỗ trợ MCP như một cơ chế để expose tools/data sources; extensions có thể đóng gói MCP, context, custom commands, hooks, skills và sub-agents. citeturn628014search5turn628014search10

## 20.18. Khi nào mới tạo sub-agent

Chỉ tạo sub-agent khi một quy trình:

- lặp lại rất nhiều;
- có input/output rõ;
- ít cần quyết định business;
- có thể test độc lập.

Ví dụ tốt:

```text
security-auditor
release-checker
migration-reviewer
```

Không nên tạo:

```text
business-strategy-agent
pricing-agent
inventory-policy-agent
```

cho đến khi domain đã được xác định rõ.

Gemini CLI hiện có hỗ trợ sub-agents trong extension framework nhưng tài liệu hiện đánh dấu tính năng này là preview; vì vậy không nên thiết kế kiến trúc project phụ thuộc vào sub-agent orchestration từ Phase 0. citeturn628014search2

## 20.19. Day 0 AI setup checklist

```text
[ ] Tạo GitHub repo
[ ] Tạo AGENTS.md
[ ] Tạo CLAUDE.md
[ ] Tạo GEMINI.md
[ ] Tạo docs/
[ ] Tạo docs/exec-plans/active
[ ] Tạo docs/exec-plans/completed
[ ] Tạo .agents/skills/
[ ] Tạo .env.example
[ ] Cấu hình lint
[ ] Cấu hình formatter
[ ] Cấu hình typecheck
[ ] Cấu hình test runner
[ ] Cấu hình CI
[ ] Tạo database review skill
[ ] Tạo security review skill
[ ] Tạo e2e testing skill
[ ] Tạo release check skill
```

## 20.20. Recommendation cuối cùng cho BaSa3D

Trong 3 công cụ bạn đang dùng:

```text
                BA SA3D
                   │
         ┌─────────┼─────────┐
         │         │         │
      Claude     Gemini    Codex
         │         │         │
     Architect   Research  Implement
     Reviewer    Compare   Test/Fix
         │         │         │
         └─────────┼─────────┘
                   ↓
             Git + Docs
                   ↓
              Production
```

**Một rule cực kỳ quan trọng:** đừng để AI trở thành “người quyết định kiến trúc”. Bạn là owner của domain và architecture; AI là multiplier.

---

# 21. Cấu hình project để bắt đầu ngay

Tên repository:

```text
basa3d-web
```

Tên package:

```text
@basa3d/web
```

Tên database:

```text
basa3d
```

Tên project trong GitHub:

```text
BaSa3D Website
```

Tên docs root:

```text
BaSa3D Engineering Docs
```

## 21.1. Initial commands

```bash
mkdir basa3d-web
cd basa3d-web

git init

git branch -M main

npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

Sau đó:

```bash
mkdir -p docs/product \
  docs/architecture \
  docs/database \
  docs/operations \
  docs/exec-plans/active \
  docs/exec-plans/completed \
  .agents/skills

touch AGENTS.md CLAUDE.md GEMINI.md
```

## 21.2. First commit

Commit đầu tiên chỉ chứa:

```text
project bootstrap
+ docs structure
+ agent instructions
+ lint/typecheck/test setup
```

Không thêm ecommerce feature trong commit đầu tiên.

---

# 22. “Speed Layer” — Những thứ làm một người có thể build nhanh hơn

## 22.1. Một command cho quality gate

Tạo script:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "check": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

Tên chính xác có thể điều chỉnh theo package/tooling version thực tế.

Mục tiêu là agent chỉ cần chạy:

```bash
npm run check
```

để biết feature có đạt quality gate hay chưa.

## 22.2. Makefile hoặc justfile

Sau này có thể thêm:

```text
make check
make db-migrate
make db-reset
make db-seed
make test-e2e
```

Việc này đặc biệt hữu ích khi giao task cho AI vì command chuẩn, ngắn và khó nhầm.

## 22.3. Seed data từ sớm

Tạo data mẫu:

```text
10 products
20 variants
5 materials
5 orders
3 inventory movements
2 custom orders
```

Agent sẽ làm việc chính xác hơn rất nhiều khi có data thật để quan sát.

## 22.4. Faker + deterministic seed

Dùng deterministic seed để bug có thể reproduce.

```text
same seed
→ same dataset
→ same test
→ easier debugging
```

## 22.5. Storybook chỉ khi cần

Chưa cần Storybook ngay Phase 0.

Có thể thêm khi UI component bắt đầu nhiều và cần visual regression.

## 22.6. Không duplicate type giữa frontend/backend

Nếu fullstack cùng TypeScript:

```text
Domain type
Schema validation
API contract
```

nên có một nguồn định nghĩa chung.

Dùng schema validation (ví dụ Zod) để tránh:

```text
Frontend says price: number
Backend assumes string
```

## 22.7. Prefer vertical slices

Thay vì:

```text
Build all database
Build all API
Build all UI
```

nên làm:

```text
Product vertical slice
    DB
    API
    Admin
    Public UI
    Test
```

Sau đó mới:

```text
Inventory vertical slice
Order vertical slice
Custom Order vertical slice
```

Điều này giúp sớm có feature chạy end-to-end và giảm rủi ro architecture sai.

---

# 23. Cập nhật Roadmap: AI workflow được nhúng vào từng Phase

## Phase 0

```text
You → quyết định stack
Claude → review architecture proposal
Gemini → research alternatives
Codex → bootstrap repository
```

## Phase 1 — Database

```text
Claude → ERD/business rule review
Gemini → compare PostgreSQL/Supabase patterns
You → chốt domain rules
Codex → migration + tests
Claude → migration review
```

## Phase 2 — API

```text
Claude → API contract review
Codex → implementation
Codex → tests
Gemini → alternative validation khi có trade-off
```

## Phase 3 — Admin

```text
Codex → CRUD
Claude → UX/data-integrity review
Codex → tests
```

## Phase 4 — Storefront

```text
Gemini → SEO/content/UX research
Codex → UI implementation
Claude → architecture/accessibility review
```

## Phase 5 — Checkout

```text
Claude → payment/order state review
Codex → implementation
Codex → E2E
Claude → risk review
```

## Phase 6 — Custom Printing

```text
Claude → workflow/state-machine review
Gemini → industry workflow research
Codex → implementation
```

## Phase 7 — Launch

```text
Codex → release automation
Claude → security review
Gemini → SEO/content review
```

---

# 24. Final recommendation: đừng tối ưu tốc độ code, tối ưu tốc độ ra quyết định

Sai lầm thường gặp khi có nhiều AI:

```text
Prompt Codex
→ code
→ hỏi Claude
→ sửa
→ hỏi Gemini
→ rewrite
→ quay lại Codex
→ conflict
```

Workflow tốt hơn:

```text
1. Define problem
2. Write acceptance criteria
3. Research if necessary
4. Decide architecture
5. Implement once
6. Test
7. Review
8. Merge
```

Tốc độ thực sự đến từ:

```text
Clear docs
+ small tasks
+ deterministic tests
+ repeatable commands
+ strong database rules
+ one owner per change
```

Không phải từ số lượng agent.

---
