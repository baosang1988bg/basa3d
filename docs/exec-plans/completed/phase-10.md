# Phase 10 — Google Analytics 4 (GA4) Full Event Tracking & Cloudflare Domain Setup

> **Mục đích**: Chuẩn hóa toàn bộ hệ thống đo lường hành vi người dùng (E-commerce + Lead gen in 3D + Content marketing) trên Google Analytics 4 (GA4) cho team Marketing, đồng thời thiết lập tên miền chính thức và bảo mật Edge qua Cloudflare.

---

## 1. Rà soát hiện trạng (Codebase Audit)

- `src/app/layout.tsx` đã nhúng `<GoogleAnalytics />` từ `src/components/analytics/google-analytics.tsx` (Phase 7).
- `src/components/analytics/google-analytics.tsx` hiện tại:
  - Chỉ load `gtag.js` cơ bản khi có `NEXT_PUBLIC_GA_ID`.
  - **Chưa có type-safe tracking helper** (`src/lib/analytics.ts`).
  - **Chưa gắn bất kỳ custom event hay e-commerce event nào** trên toàn bộ Storefront (`/products`, `/cart`, `/checkout`, `/custom-print`, `/order-confirmation`).
- File `.env.example` chưa liệt kê rõ ràng `NEXT_PUBLIC_GA_ID` và `NEXT_PUBLIC_SITE_URL` kèm hướng dẫn.
- Hiện chưa có tài liệu hướng dẫn bàn giao cho bạn Marketing (Data Dictionary / Event Schema và cách xem báo cáo GA4 DebugView / E-commerce Funnel).

---

## 2. Mục tiêu (Goals)

1. **Chuẩn hóa Module Tracking (`src/lib/analytics.ts`)**:
   - Viết helper module hỗ trợ `window.gtag` an toàn (SSR-safe, dev-mode fallback, type-safe với TypeScript).
   - Tuân thủ đúng chuẩn GA4 Recommended Events cho E-commerce và Lead Gen.
2. **Gắn đầy đủ Event Functions cho toàn bộ hệ thống BaSa3D**:
   - **Catalog & Product**: `view_item_list`, `select_item`, `view_item`, `search`.
   - **Cart & Conversion**: `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `purchase`.
   - **Custom 3D Print (Lead Generation)**: `upload_3d_file`, `request_custom_quote`.
   - **Content & Engagement**: `read_blog_post`, `click_contact_channel` (Zalo, Hotline, Messenger), `view_policy`.
3. **Cấu hình Tên miền & DNS Cloudflare**:
   - Hướng dẫn mua & kết nối domain trên Cloudflare Registrar (hoặc Registrar VN + Cloudflare DNS).
   - Thiết lập SSL/TLS Full (Strict), Edge Cache, CNAME Flattening trỏ về Vercel / Production host.
4. **Tài liệu bàn giao cho Marketing (Marketing GA4 Playbook)**:
   - Danh mục định nghĩa toàn bộ Event, Parameter và cách xem phễu chuyển đổi (Conversion Funnel) trên GA4.

---

## 3. Non-Goals (Ngoài phạm vi Phase 10)

- **Không tự động tạo tài khoản Google Analytics hoặc mua domain tự động**: Việc này cần tài khoản Google và thẻ thanh toán thực tế của OWNER / Marketing. Kế hoạch cung cấp cấu hình và tài liệu checklist từng bước.
- **Không triển khai Google Tag Manager (GTM) phức tạp**: Giữ kiến trúc Next.js native gọn gàng theo Rule #8 AGENTS.md (`gtag.js` trực tiếp, zero-dependency phụ trợ).
- **Không can thiệp vào Database / Backend Service**: Phase 10 chỉ tác động tầng Client Storefront Tracking, Scripts và Metadata/DNS.

---

## 4. Danh mục Event Function chi tiết (Event Schema cho Marketing)

| Nhóm chức năng | Tên Event chuẩn GA4 | Trigger Point (Vị trí kích hoạt) | Parameters (Tham số gửi kèm) |
| :--- | :--- | :--- | :--- |
| **Catalog** | `view_item_list` | Khách truy cập `/products` | `item_list_id`, `item_list_name`, `items: [{item_id, item_name, price, category}]` |
| **Catalog** | `select_item` | Click vào 1 sản phẩm trên danh sách | `item_list_id`, `item_id`, `item_name` |
| **Catalog** | `search` | Khách gõ tìm kiếm sản phẩm / bài viết | `search_term` |
| **Sản phẩm** | `view_item` | Khách xem trang `/products/[slug]` | `currency: 'VND'`, `value`, `items: [{item_id, item_name, price, item_variant, quantity: 1}]` |
| **Giỏ hàng** | `add_to_cart` | Bấm "Thêm vào giỏ" hoặc "Mua ngay" | `currency: 'VND'`, `value`, `items: [{item_id, item_name, price, item_variant, quantity}]` |
| **Giỏ hàng** | `remove_from_cart`| Bấm xóa sản phẩm trong `/cart` | `currency: 'VND'`, `value`, `items: [{item_id, item_name, price, quantity}]` |
| **Giỏ hàng** | `view_cart` | Khách mở trang `/cart` | `currency: 'VND'`, `value`, `items` |
| **Thanh toán** | `begin_checkout` | Bấm "Tiến hành thanh toán" hoặc vào `/checkout` | `currency: 'VND'`, `value`, `items` |
| **Đơn hàng** | `purchase` | Hoàn tất đơn tại `/order-confirmation/[orderNumber]` | `transaction_id`, `value` (tổng tiền VND), `currency: 'VND'`, `shipping`, `items` |
| **In 3D Custom** | `upload_3d_file` | Upload file `.stl`/`.3mf`/`.step` trong form | `file_name`, `file_extension`, `file_size_mb` |
| **In 3D Custom** | `request_custom_quote` | Submit form `/custom-print` thành công | `technology`, `material`, `color`, `quantity`, `has_attachment` |
| **Marketing** | `read_blog_post` | Khách đọc bài viết `/blog/[slug]` | `post_title`, `post_slug`, `category` |
| **Tương tác** | `click_contact_channel` | Click icon Zalo, gọi hotline, Messenger | `channel` (`'zalo'` \| `'hotline'` \| `'messenger'` \| `'email'`), `placement` |
| **Pháp lý/Trust**| `view_policy` | Khách xem chính sách bảo mật file/bảo hành | `policy_name` |

---

## 5. Kế hoạch triển khai kỹ thuật (Technical Plan)

### Slice 1: Xây dựng Core Tracking Module (`src/lib/analytics.ts`)
- Khai báo types: `GTagItem`, `GTagEcommerceParams`, `GTagCustomParams`.
- Triển khai các hàm tiện ích:
  - `sendGAEvent(eventName, eventParams)`: Kiểm tra `typeof window !== 'undefined' && typeof window.gtag === 'function'`; no-op (không throw, không console.error) nếu thiếu — an toàn khi chưa có `NEXT_PUBLIC_GA_ID` hoặc khi chạy trong test (`window` không tồn tại trong Jest/Vitest mặc định).
  - `trackViewItemList(items, listName)`
  - `trackSelectItem(item, listName)` — gắn vào `ProductCard` khi khách click từ danh sách sang trang chi tiết (thiếu trong bản trước, bổ sung cho đủ event `select_item` đã khai ở mục 4).
  - `trackViewItem(item)`
  - `trackAddToCart(item, quantity)`
  - `trackRemoveFromCart(item)`
  - `trackViewCart(items, totalValue)`
  - `trackBeginCheckout(items, totalValue)`
  - `trackPurchase(order)`
  - `trackCustomPrintQuote(data)`
  - `trackContactClick(channel, placement)`
- **Quy ước bắt buộc**: mọi UI component gọi `trackXxx()` từ `analytics.ts`; không component nào được gọi `window.gtag` trực tiếp. Lý do: giữ 1 điểm gửi duy nhất (`sendGAEvent`) để sau này thêm Facebook/TikTok Pixel chỉ cần sửa 1 chỗ, không phải sửa lại từng UI component.
- **Quy ước đơn vị tiền tệ (bắt buộc)**: `value`, `price`, `shipping` gửi lên GA4 phải là số nguyên VND lấy thẳng từ `orders.total` / `order_items.price` (Rule #2 AGENTS.md: VND minor unit = 1 VND). **Không chia cho 100** — khác quy ước cent của USD trong hầu hết ví dụ GA4 chính thức. Sai chỗ này làm doanh thu trên GA4 lệch 100 lần.
- Nâng cấp `GoogleAnalytics` component trong `src/components/analytics/google-analytics.tsx` để tự bắn `page_view` khi điều hướng qua `next/link` (App Router soft-navigation không tự trigger lại `gtag('config', ...)`): thêm 1 Client Component con dùng `usePathname()` + `useSearchParams()` trong `useEffect` để gọi `gtag('event', 'page_view', { page_path, page_location })` mỗi khi route đổi. `useSearchParams()` bắt buộc phải nằm trong `<Suspense>` để tránh de-opt cả layout sang client rendering.

### Slice 2: Gắn Events vào Storefront UI Components

**Lưu ý kiến trúc quan trọng**: `products/page.tsx` và `order-confirmation/[orderNumber]/page.tsx` là **Server Components** (async, fetch trực tiếp qua service layer) — không thể gọi `window.gtag`/`trackXxx()` ngay trong hàm RSC. Với 2 trang này, tạo 1 Client Component nhỏ nhận data qua props, tự `useEffect(() => trackXxx(...), [depsỔnĐịnh])` khi mount, `return null` (không render UI), ví dụ `<ViewItemListTracker items={...} />`, `<PurchaseTracker order={...} />`. Dependency array chỉ chứa id ổn định (vd `order.orderNumber`), không phải cả object, để tránh gọi lại khi re-render.

1. `src/app/(storefront)/products/[slug]/add-to-cart-form.tsx` (đã là Client Component) → Gắn `trackAddToCart`.
2. `src/app/(storefront)/products/[slug]/page.tsx` (RSC) → render `<ViewItemTracker item={...} />` (client tracker con) để gắn `trackViewItem`.
3. `src/app/(storefront)/products/page.tsx` (RSC) → render `<ViewItemListTracker items={...} />`; gắn `trackSelectItem` vào `ProductCard` khi click sang trang chi tiết.
4. `src/app/(storefront)/cart/page.tsx` → Gắn `trackViewCart`, `trackRemoveFromCart`, `trackBeginCheckout` (kiểm tra file này là Client hay Server Component trước khi chọn cách gắn — theo cùng nguyên tắc RSC/client tracker ở trên nếu là RSC).
5. `src/app/(storefront)/order-confirmation/[orderNumber]/page.tsx` (RSC) → render `<PurchaseTracker order={...} />` **chỉ khi** đơn hàng chưa từng gửi purchase event.
   - **Cơ chế chống trùng (bắt buộc là server-side, không dùng localStorage/sessionStorage)**: trang này truy cập được qua `?token=` (link email/Zalo) hoặc `?phoneSuffix=` (khách tự nhập), và có thể mở trên nhiều thiết bị khác nhau (vd: đặt hàng trên desktop, đọc link Zalo trên điện thoại) — cờ phía client không chống được trường hợp này, và **GA4 không tự dedupe `purchase` theo `transaction_id`** (khác hành vi Universal Analytics cũ).
   - Thêm cột `analytics_purchase_sent_at timestamptz null` vào bảng `orders` (migration nhỏ, review theo `.agents/skills/database-review`). Khi `order.service.ts` trả order cho trang confirmation, nếu cột này null → set giá trị `now()` (UPDATE) và cho phép render `<PurchaseTracker>`; nếu đã có giá trị → không render tracker (đơn đã được tính vào GA4 trước đó).
   - Việc này mở rộng nhẹ phạm vi Non-Goals #3 ("không can thiệp Database") — chấp nhận vì đây là hệ quả bắt buộc của việc tránh sai lệch doanh thu trên báo cáo marketing, không phải scope creep.
6. `src/app/(storefront)/custom-print/custom-request-form.tsx` (Client Component) → Gắn `upload_3d_file` (chỉ bắn khi upload server-side thành công, không bắn khi chọn file rồi hủy) và `trackCustomPrintQuote` (chỉ bắn sau khi server response thành công, không bắn optimistic).
7. `src/components/storefront/footer.tsx` (đường dẫn đúng — **không phải** `src/components/layout/storefront-footer.tsx` như bản nháp trước), `src/components/storefront/header.tsx`, `src/components/storefront/zalo-floating-button.tsx` → Gắn `trackContactClick`. `footer.tsx` hiện là Server Component (không `'use client'`) — bọc riêng các link liên hệ (Zalo/Hotline/Messenger) trong 1 Client Component nhỏ (`ContactLink`) nhận `href`/`channel`/`placement` làm props, thay vì chuyển cả `footer.tsx` thành Client Component.

### Slice 3: Hướng dẫn Cấu hình Cloudflare & Môi trường Production

**Trạng thái tại thời điểm giao Codex: domain chưa mua, chưa bật Cloudflare Proxy.** Slice này chỉ chuẩn bị *code fix* (áp dụng ngay, không phụ thuộc domain) và *tài liệu hướng dẫn* (để OWNER tự làm khi mua domain) — không có bước nào yêu cầu Codex thao tác trên Cloudflare dashboard thật.

- **Code fix bắt buộc, áp dụng ngay (không phụ thuộc domain đã mua hay chưa)**: sửa cách lấy client IP trong `src/app/api/public/orders/[orderNumber]/route.ts` và `src/app/api/public/custom-requests/attachments/route.ts` — hiện đang dùng `request.headers.get('x-forwarded-for')?.split(',')[0]`. Khi đứng sau Cloudflare Proxy, header này **có thể bị giả mạo** (Cloudflare chỉ append IP thật vào cuối chuỗi, không xóa phần client tự gửi ở đầu) — kẻ tấn công tự set `X-Forwarded-For` để bypass rate limiter. Sửa thành: ưu tiên đọc `request.headers.get('cf-connecting-ip')` (header Cloudflare tự set ở edge, client không ghi đè được), fallback về `x-forwarded-for` khi chạy không qua Cloudflare (local/dev, hoặc trước khi domain được bật Proxy). Đây là fix cần thiết ngay cả khi domain chưa mua, để không quên khi go-live.
- Cập nhật tài liệu `docs/operations/deployment.md` (dạng **checklist hướng dẫn cho OWNER**, không phải bước Codex tự thực hiện):
  - Thiết lập NameServer Cloudflare.
  - Cấu hình DNS A / CNAME trỏ về hosting (Vercel / Node server).
  - Cấu hình SSL/TLS Mode: `Full (Strict)`.
  - Bật HSTS, Automatic HTTPS Rewrites, TLS 1.3, Brotli.
  - Cấu hình Page Rules / Redirect: `http://*` → `https://*` và `www.*` → root domain.
  - Cache Rules: loại trừ (bypass cache) các route động — `/admin/*`, `/api/*`, `/cart`, `/checkout`, và `/order-confirmation/*` (chứa dữ liệu cá nhân khách hàng qua token, không được cache).
  - Ghi rõ 1 dòng cảnh báo: "Không tin `x-forwarded-for` cho mục đích bảo mật (rate limit, audit log) khi đã bật Cloudflare Proxy — dùng `cf-connecting-ip`."
- Cập nhật `.env.example` và tài liệu hướng dẫn biến môi trường (khai báo sẵn key, giá trị để trống/placeholder vì chưa có domain/GA4 property thật):
  - `NEXT_PUBLIC_GA_ID=` (để trống, comment hướng dẫn lấy từ GA4 Admin > Data Streams sau khi OWNER tạo property).
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (giữ giá trị dev mặc định; comment hướng dẫn đổi thành domain thật sau khi mua).

### Slice 4: Soạn thảo Playbook dành cho Marketing
- Tạo tài liệu `docs/marketing/ga4-tracking-guide.md`:
  - Giải thích ý nghĩa từng event và tham số.
  - Hướng dẫn dùng **Google Analytics DebugView** + tiện ích **Google Analytics Debugger** của Chrome để kiểm tra real-time event.
  - Hướng dẫn thiết lập Funnel Exploration (Phễu bán hàng & Báo giá in 3D).

---

## 6. Checklist thực hiện (Phase 10 Protocol Checklist)

### Trước khi giao Codex
- [x] Rà soát danh sách Event Functions với bạn Marketing để đảm bảo đủ dữ liệu chạy chiến dịch — OWNER xác nhận event schema đã approved (ghi trong prompt review cuối, 2026-09-01); `search` deferred có chủ đích tới khi Marketing định nghĩa search action.
- [x] Xác nhận biến môi trường `NEXT_PUBLIC_GA_ID` và `NEXT_PUBLIC_SITE_URL` — **quyết định**: domain/GA4 property chưa có, dùng placeholder rỗng/localhost (xem Slice 3), code phải an toàn khi thiếu `NEXT_PUBLIC_GA_ID`.
- [x] Hoàn thành review kiến trúc với Claude — xong (2026-09-01), các adjustment đã gộp vào Slice 1–3 ở trên. *(Review với Gemini chưa làm — không chặn scaffolding, nhưng nên làm trước khi domain thật đi live.)*

### Code & Tests
- [x] Tạo file `src/lib/analytics.ts` với đầy đủ types và helper functions.
- [x] Cập nhật `src/components/analytics/google-analytics.tsx`.
- [x] Gắn event vào Product Detail & Add to Cart.
- [x] Gắn event vào Cart & Checkout.
- [x] Gắn event vào Order Confirmation (chống trùng `purchase` bằng cột server-side `orders.analytics_purchase_sent_at`, ADR-0024 — không dùng session/local flag như bản nháp ban đầu, xem Q1/mục 5 Slice 2).
- [x] Gắn event vào Custom Print Request form & Upload file.
- [x] Gắn event vào Blog & Contact links (Zalo/Hotline/Social) — bao gồm `read_blog_post`/`view_policy` bổ sung sau review (commit `0ddeb82`).
- [x] Viết Unit test cho `src/lib/analytics.ts` (kiểm tra format data layer gửi đi) — bao gồm case queue trước khi gtag.js load (commit `779b839`).
- [x] Chạy kiểm tra: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — PASS ở lượt review cuối (2026-09-01).

### Documentation & Handoff
- [x] Cập nhật `docs/operations/deployment.md` (Cloudflare DNS & SSL setup checklist cho OWNER).
- [x] Tạo `docs/marketing/ga4-tracking-guide.md` cho Marketing.
- [x] Cập nhật `docs/roadmap.md` và `docs/architecture/decisions.md` (ADR-0024 — purchase idempotency server-side).

---

## 7. Definition of Done
1. Mọi tương tác quan trọng của khách hàng (Xem hàng, Thêm giỏ, Đặt hàng, Yêu cầu báo giá in 3D, Đọc blog, Click Zalo/Hotline) đều kích hoạt event GA4 chuẩn.
2. Helper `analytics.ts` hoạt động an toàn, không gây crash hoặc warning trên SSR / Dev mode khi chưa có `NEXT_PUBLIC_GA_ID`.
3. Có tài liệu đầy đủ để bạn Marketing có thể tự kiểm tra, cấu hình báo cáo và phễu chuyển đổi trên GA4.
4. Có tài liệu hướng dẫn chuẩn để cấu hình Domain & DNS Cloudflare trỏ về production.
5. Toàn bộ `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` đều pass 100%.
