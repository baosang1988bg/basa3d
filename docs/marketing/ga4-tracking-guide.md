# GA4 tracking guide — BaSa3D

> **Nguồn sự thật duy nhất (single source of truth) cho mọi việc liên quan GA4.**
> Thêm / sửa / xoá event nào thì cập nhật file này **trong cùng PR**. Reviewer từ chối PR đổi
> tracking mà không đổi file này.

Mục lục: [1. Kiến trúc](#1-kiến-trúc) · [2. Quy tắc bắt buộc](#2-quy-tắc-bắt-buộc) ·
[3. Từ điển event](#3-từ-điển-event) · [4. Screen time](#4-screen-time) ·
[5. Search & filter](#5-search--filter) · [6. MakerWorld tool](#6-makerworld-tool) ·
[7. Cấu hình GA4 Admin](#7-cấu-hình-ga4-admin) · [8. Kiểm thử](#8-kiểm-thử) ·
[9. Funnel](#9-funnel-explorations) · [10. Checklist thêm event mới](#10-checklist-thêm-event-mới) ·
[11. Giới hạn đã biết](#11-giới-hạn-đã-biết) · [12. Lịch sử thay đổi](#12-lịch-sử-thay-đổi)

---

## 1. Kiến trúc

| File | Vai trò |
| --- | --- |
| `src/components/analytics/google-analytics.tsx` | Nạp `gtag.js` (chỉ khi có `NEXT_PUBLIC_GA_ID`), `send_page_view: false`, mount `PageViewTracker` + `ScreenTimeTracker`. |
| `src/components/analytics/page-view-tracker.tsx` | `page_view` cho lần tải đầu và mỗi soft navigation (Next.js App Router). |
| `src/components/analytics/screen-time-tracker.tsx` | Nối tín hiệu trình duyệt (visibility, pagehide, input) vào dwell timer → `screen_time`. |
| `src/components/analytics/product-search-filter-tracker.tsx` | Quan sát query string của `/products` → `search`, `filter_category`. |
| `src/components/analytics/storefront-trackers.tsx` | Tracker ecommerce dạng component (`view_item_list`, …). |
| `src/lib/analytics.ts` | **Mọi** helper `track*`, `sendGAEvent`, các hàm sanitize (`sanitizeAnalyticsUrl`, `sanitizeFreeText`, `clipParam`, `toVndValue`, …). |
| `src/lib/analytics-dwell-timer.ts` | State machine thuần (clock inject) đo thời gian active. Không đụng DOM. |
| `src/lib/analytics-navigation.ts` | Phân loại thay đổi URL do user hay do reload/back/landing. |
| `tests/analytics.test.ts`, `tests/analytics-dwell-timer.test.ts` | Unit test (node:test, không cần jsdom). |

Luồng gửi: component / handler → `track*()` → `sendGAEvent()` → `window.dataLayer.push(arguments)` → gtag.js.
`sendGAEvent` là SSR-safe (no-op khi không có `window`) và tự gắn `page_location` / `page_referrer` đã sanitize.

**Không gọi `window.gtag` hay `dataLayer.push` trực tiếp ở nơi khác** — luôn đi qua helper trong `src/lib/analytics.ts`.

---

## 2. Quy tắc bắt buộc

1. **Không PII.** Không gửi tên, SĐT, email, địa chỉ, ghi chú tự do, đường dẫn file đính kèm, token.
   - URL: `sanitizeAnalyticsUrl` xoá `token`, `phoneSuffix`, `uploadClaim`, `claim` và hash. Áp dụng tự động cho `page_location`, `page_referrer`, `page_path`; với param URL khác phải gọi tay.
   - Text tự do (ô search, link dán vào): bắt buộc qua `sanitizeFreeText` (redact email → `[email]`, chuỗi ≥ 8 chữ số → `[number]`, lowercase, cắt 100 ký tự) **hoặc không gửi**.
   - Input người dùng dạng enum (`?type=`): whitelist (`toProductTypeFilter`), không gửi giá trị thô.
2. **Tiền = integer VND** (AGENTS.md #2). `125000` nghĩa là 125.000đ, **không chia 100**. Giá trị không phải số nguyên an toàn ≥ 0 thì **bỏ**, không làm tròn (`toVndValue`). Có `value` thì luôn kèm `currency: 'VND'`.
3. **Không dùng tên reserved / auto-collected của GA4.** Cấm gửi event `user_engagement`, `session_start`, `first_visit`… và cấm param `engagement_time_msec` — gtag đã tự thu; gửi tay sẽ cộng đôi "Average engagement time".
4. **Giá trị param ≤ 100 ký tự** (`clipParam`). Tên event / param: `snake_case`, ≤ 40 ký tự.
5. **Dimension phải ổn định, không phụ thuộc ngôn ngữ.** Dùng key (`nav_key: 'cart'`, `category_id`) thay vì nhãn đã dịch. Nếu cần tên hiển thị, dùng tên locale mặc định `vi`.
6. **Bắn theo kết quả, không theo ý định** khi có thể (vd. `makerworld_resolve_url` bắn sau khi API trả về, kèm `success`).
7. Ưu tiên **recommended events** của GA4 (`search`, ecommerce) trước khi tạo event custom.

---

## 3. Từ điển event

### 3.1 Điều hướng & engagement

| Event | Khi nào bắn | Tham số |
| --- | --- | --- |
| `page_view` | Tải trang đầu + mỗi soft navigation | `page_path`, `page_location` (đã sanitize), `debug_mode` (non-prod / `?debug_mode`) |
| `screen_time` | Rời route, ẩn tab, hoặc `pagehide` — xem [§4](#4-screen-time) | `page_path`, `page_location` (của **route vừa rời**), `screen_time_msec`, `page_title` |
| `navigation_click` | Click link điều hướng (header, mobile drawer) | `placement` (`header` \| `footer` \| `mobile_menu` \| `storefront`), `nav_key`, `target`, `category_id` (khi `nav_key = 'category'`) |
| `menu_open` | Mở mobile drawer | `placement` |
| `click_contact_channel` | Click kênh liên hệ | `channel` (`zalo` \| `hotline` \| `messenger` \| `email` \| `facebook` \| `tiktok` \| `instagram`), `placement` |
| `read_blog_post` | Mở bài blog đã publish | `post_title`, `post_slug`, `category` |
| `view_policy` | Mở trang chính sách | `policy_name` |

Giá trị `nav_key` hiện có: `logo`, `home`, `products`, `products_all`, `category`, `tools`, `bao_gia`, `custom_print`, `cart`, cùng các key sinh từ `navKeyFromHref(href)` (bỏ `/`, ký tự lạ → `_`).

### 3.2 Khám phá sản phẩm

| Event | Khi nào bắn | Tham số |
| --- | --- | --- |
| `search` (recommended) | User tìm kiếm trên `/products` — xem [§5](#5-search--filter) | `search_term` (đã `sanitizeFreeText`), `results_on_page` (số SP **trên trang hiện tại**, không phải tổng) |
| `filter_category` | User đổi danh mục / loại / sắp xếp trên `/products` | `category_id` (`'all'` khi bỏ lọc), `category_name` (tên `vi`), `product_type` (`READY_STOCK` \| `MADE_TO_ORDER`), `sort` (`newest` \| `price_asc` \| `price_desc`) |

### 3.3 Ecommerce (recommended events)

| Event | Khi nào bắn | Tham số |
| --- | --- | --- |
| `view_item_list` | Hiển thị danh sách sản phẩm | `item_list_id`, `item_list_name`, `items` |
| `select_item` | Chọn sản phẩm từ danh sách | list fields, `items[0]` |
| `view_item` | Xem chi tiết sản phẩm | `currency`, `value`, `items` |
| `add_to_cart` | Thêm vào giỏ thành công | `currency`, `value` (= price × qty), `items` |
| `remove_from_cart` | Xoá khỏi giỏ | `currency`, `value`, `items` |
| `view_cart` | Mở giỏ có hàng | `currency`, `value`, `items` |
| `begin_checkout` | Bấm thanh toán | `currency`, `value`, `items` |
| `purchase` | Trang xác nhận đơn (đã xác thực) claim đơn **một lần** (marker server-side) | `transaction_id`, `currency`, `value`, `shipping`, `items` |

Mỗi `items[]` có thể gồm `item_id`, `item_name`, `price`, `item_category`, `item_variant`, `quantity`, `item_list_id`, `item_list_name`.

### 3.4 Lead / báo giá

| Event | Khi nào bắn | Tham số |
| --- | --- | --- |
| `upload_3d_file` | Upload file đính kèm thành công (server) | `file_name`, `file_extension`, `file_size_mb` |
| `request_custom_quote` | Gửi yêu cầu in theo yêu cầu thành công | `technology`, `material`, `color`, `quantity`, `has_attachment` |
| `quote_file_added` | `/bao-gia`: thêm file | `file_extension`, `file_size_mb`, `file_count` |
| `quote_estimate_shown` | `/bao-gia`: hiển thị ước tính | `item_count`, `priced_count`, `currency`, `value` |
| `quote_submitted` | `/bao-gia`: gửi báo giá | `item_count`, `currency`, `value` |

### 3.5 MakerWorld tool (`/tools/makerworld-cn`) — xem [§6](#6-makerworld-tool)

| Event | Khi nào bắn | Tham số |
| --- | --- | --- |
| `makerworld_resolve_url` | Sau khi API phân tích link trả về (thành công **hoặc** lỗi) | `success`, `source_host` (`makerworld.com` \| `makerworld.com.cn` \| `other` \| `invalid`), `model_id` (khi thành công), `error_code` (khi lỗi) |
| `makerworld_download_3mf` | Tải 3MF xong / lỗi, hoặc mở trang gốc | `model_id`, `profile_id`, `model_title`, `method` (`direct` \| `external`), `success`, `error_code` |
| `makerworld_preview_3d` | Mở xem trước 3D | `model_id`, `profile_id` |
| `makerworld_order_click` | Bấm đặt in từ một profile | `model_id`, `profile_id`, `currency` + `value` (chỉ khi có giá ước tính hợp lệ) |

`error_code`: `http_<status>` khi server trả lỗi, `network` khi không nhận được response.

### 3.6 Công cụ thiết kế (`/tools/*`)

Mẫu chung: `tool_<tool>_preview`, `tool_<tool>_export_download`, `tool_<tool>_export_to_request`.

| Tool | Tham số chung | `export_download` thêm |
| --- | --- | --- |
| `keychain` | `character_count`, `has_keyring_hole` (preview / to_request) | — |
| `keychain_blocks` | `block_count`, `format?` | `format` (`stl-zip` \| `3mf` \| `stl`) |
| `organizer` | `rows`, `cols` | — |
| `dual_text` | `block_count` | `format` (`stl` \| `3mf`) |
| `car` | `width_mm` | `format` |
| `lamp` | `pattern` | `format` |
| `hinge_box` | `rows`, `cols` | `format` |
| `jigsaw` | `piece_count` | `format` (`stl-zip` \| `3mf`) |

---

## 4. Screen time

**Mục tiêu:** đo thời gian người dùng *thực sự hoạt động* trên từng màn hình (route) trong SPA.

### Cơ chế

`ScreenTimeTracker` chỉ nối tín hiệu trình duyệt; toàn bộ logic nằm ở `createDwellTimer` (thuần, test được bằng fake clock):

| Tín hiệu | Hành động |
| --- | --- |
| Đổi `pathname` | Cleanup effect cũ → `flush()` route cũ → `start()` route mới. **Cleanup là điểm flush duy nhất khi đổi route.** |
| `visibilitychange → hidden` | `hide()` + `flush()` — điểm cuối đáng tin trên mobile (iOS có thể không bắn `pagehide`). |
| `visibilitychange → visible` | `show()` — đếm tiếp cùng route. |
| `pagehide` | `hide()` + `flush()` (dự phòng cho desktop). |
| `pageshow` (`persisted`) | `show()` — khôi phục từ bfcache, thời gian bị đóng băng **không** tính. |
| `pointerdown`, `keydown`, `scroll`, `wheel`, `touchstart`, `mousemove` (passive) | `activity()` — gia hạn cửa sổ idle. |

### Ngưỡng (`DWELL_DEFAULTS`)

| Hằng số | Giá trị | Lý do |
| --- | --- | --- |
| `minMs` | 1 000 ms | Bỏ nhiễu "lướt qua" / redirect. Hệ quả: trung bình hơi lệch lên — chấp nhận được. |
| `idleMs` | 120 000 ms | Không có input trong 2 phút → ngừng đếm (chừa thời gian đọc mô tả dài). |
| `maxMs` | 30 phút | Kẹp một lần đo, chống tab bị bỏ quên. |

### Quy ước dữ liệu

- **Key theo `pathname`, không có query** → lọc/sắp xếp/phân trang trên `/products` vẫn là một màn hình.
- Một màn hình có thể sinh **nhiều** event `screen_time` (mỗi lần ẩn tab). Báo cáo phải **SUM** `screen_time_msec` theo `page_path`, không lấy count event.
- `page_location` được truyền tường minh = route **vừa rời** (lúc flush, `window.location` đã là route mới).
- `page_title` được chụp lúc mount và sau 500 ms (metadata ổn định), không đọc lúc cleanup.
- Không gửi `user_engagement` / `engagement_time_msec` (xem §2.3). Chỉ số engagement chuẩn của GA4 vẫn do gtag tự thu.

---

## 5. Search & filter

`/products` là Server Component điều khiển bằng query string (`?q=&categoryId=&type=&sort=&page=`), form tìm kiếm là `<form method="get">` thường → submit = tải lại toàn trang. Vì vậy tracker **quan sát URL**, và chỉ bắn khi thay đổi do **chính user** gây ra (`currentNavigationOrigin() === 'user'`):

| Tình huống | Origin | Bắn? |
| --- | --- | --- |
| Click chip danh mục / Link (soft navigation) | `user` | ✅ |
| Submit form search (full load, referrer cùng origin) | `user` | ✅ |
| Reload trang (`navigation.type = reload`) | `reload` | ❌ |
| Back/forward (popstate trong 5 s, hoặc `back_forward`) | `history` | ❌ |
| Vào từ Google / link chia sẻ (referrer khác origin hoặc rỗng) | `landing` | ❌ |
| Chỉ đổi `page` (phân trang) | — | ❌ |

- `search` chỉ bắn khi `q` đổi và không rỗng; `filter_category` bắn khi bộ (`categoryId`, `type`, `sort`) đổi, kể cả khi **bỏ lọc** (`category_id: 'all'`).
- Lần mount đầu không có filter / sort mặc định → không bắn.
- ⚠️ **Enhanced measurement → Site search** của GA4 mặc định tự bắn `view_search_results` khi URL có `?q=`. Event này đo *xem kết quả* (kể cả reload/landing), còn `search` của ta đo *hành động tìm*. Giữ cả hai là có chủ đích; **không** đếm chúng chung trong một chỉ số.

---

## 6. MakerWorld tool

- **Không bao giờ gửi link người dùng dán vào.** Chỉ gửi `source_host` (whitelist `makerworld.com`, `makerworld.com.cn`, subdomain của chúng; còn lại `other` / `invalid`) và `model_id` do server trả về.
- `makerworld_resolve_url` bắn **sau** khi API trả kết quả → funnel phân biệt được thành công / thất bại.
- `makerworld_download_3mf`:
  - `method: 'external'` — model quốc tế, chỉ mở `makerworld.com` ở tab mới (`success: true` = đã mở).
  - `method: 'direct'` — model CN, BaSa3D proxy file; bắn sau khi tải xong hoặc lỗi.
- `makerworld_order_click.value` = giá ước tính (integer VND) của profile; không có giá hợp lệ thì bỏ `currency`/`value`. Đây **không phải doanh thu** — đừng đánh dấu event này là key event có giá trị nếu không muốn lẫn vào báo cáo revenue.

Funnel gợi ý: `makerworld_resolve_url (success = true)` → `makerworld_preview_3d` → `makerworld_order_click` → `request_custom_quote`.

---

## 7. Cấu hình GA4 Admin

Param custom **không hiện trong báo cáo** cho tới khi đăng ký ở **Admin → Data display → Custom definitions**:

| Loại | Tên hiển thị gợi ý | Param | Scope |
| --- | --- | --- | --- |
| Custom metric | Screen time (ms) | `screen_time_msec` | Event, đơn vị *Milliseconds* |
| Custom metric | Results on page | `results_on_page` | Event, *Standard* |
| Custom dimension | Nav placement | `placement` | Event |
| Custom dimension | Nav key | `nav_key` | Event |
| Custom dimension | Nav target | `target` | Event |
| Custom dimension | Category ID | `category_id` | Event |
| Custom dimension | Category name | `category_name` | Event |
| Custom dimension | Product type | `product_type` | Event |
| Custom dimension | Sort | `sort` | Event |
| Custom dimension | MakerWorld model ID | `model_id` | Event |
| Custom dimension | MakerWorld source host | `source_host` | Event |
| Custom dimension | Download method | `method` | Event |
| Custom dimension | Success | `success` | Event |
| Custom dimension | Error code | `error_code` | Event |
| Custom dimension | Contact channel | `channel` | Event |

Lưu ý: property GA4 tiêu chuẩn giới hạn 50 custom dimension event-scope — chỉ đăng ký những gì Marketing thực sự dùng. Không đăng ký param chứa text tự do.

Key events: chỉ đánh dấu `purchase`, `request_custom_quote` (và `quote_submitted` nếu Marketing duyệt) **sau khi** đã kiểm tra ở DebugView.

---

## 8. Kiểm thử

### Unit test

```bash
npm test                                   # toàn bộ (build Next + chạy mọi tests/*.test.ts)
npx tsx --test tests/analytics.test.ts tests/analytics-dwell-timer.test.ts   # nhanh, chỉ analytics
```

Bao phủ hiện có: payload từng helper, VND integer, sanitize token/PII, không có `user_engagement`, `page_location` của route cũ, dwell timer (ẩn/hiện, flush đôi, ngưỡng, idle, cap, bfcache, đổi route), phân loại navigation origin.

### DebugView

1. Tạo GA4 property + web stream, đặt `G-...` vào `NEXT_PUBLIC_GA_ID`, restart/redeploy. Không có biến này → app không gửi gì (an toàn cho dev/local).
2. Dùng build non-production (tự bật `debug_mode`) hoặc thêm `?debug_mode=1` trên production; hoặc extension *Google Analytics Debugger*.
3. Mở **Admin → Data display → DebugView**, chọn thiết bị test.
4. Kịch bản kiểm tra:
   - **Ecommerce:** products → detail → add to cart → cart → checkout → confirmation. Kiểm tra thứ tự, `currency`, `value` integer VND, `transaction_id`, `quantity`. Reload trang xác nhận → **không** có `purchase` thứ hai (dùng đơn test mới cho lần thử sau).
   - **Screen time:** ở `/products` ~5 s → sang `/cart` → thấy `screen_time` với `page_path=/products`, `page_location` là `/products`. Chuyển tab 30 s rồi quay lại → `screen_time_msec` không gồm 30 s đó. Đứng yên > 2 phút → thời gian dừng tăng.
   - **Search/filter:** gõ tìm kiếm → 1 `search`; reload → **không** có `search` mới; Back → không có; click chip danh mục → `filter_category`; chọn "Tất cả" → `category_id = all`.
   - **MakerWorld:** dán link hợp lệ và link rác → `makerworld_resolve_url` với `success` đúng, **không** có URL trong payload.
   - **PII:** tìm `0912345678` → `search_term = [number]`. Mở trang có `?token=` → `page_location` không còn `token`.

Ad blocker / chế độ riêng tư có thể chặn event — kiểm thử trên profile trình duyệt sạch.

---

## 9. Funnel explorations

**Explore → Funnel exploration:**

- **Ecommerce:** `view_item_list` → `select_item` → `view_item` → `add_to_cart` → `view_cart` → `begin_checkout` → `purchase`. Open funnel để khám phá, closed funnel để đo tỉ lệ chuyển đổi chặt; breakdown theo device, nguồn traffic, campaign.
- **Lead:** `upload_3d_file` (tuỳ chọn) → `request_custom_quote`; breakdown theo `material`, `quantity`, `has_attachment`.
- **Khám phá:** `search` / `filter_category` → `select_item` → `add_to_cart`.
- **MakerWorld:** xem §6.
- **Engagement theo màn hình:** Free-form, dimension `Page path`, metric SUM `screen_time_msec` ÷ Users.

---

## 10. Checklist thêm event mới

- [ ] Có recommended event GA4 tương ứng không? Có thì dùng tên + param chuẩn.
- [ ] Viết helper `track*` trong `src/lib/analytics.ts` — không gọi `gtag` trực tiếp.
- [ ] Mọi param: không PII; text tự do qua `sanitizeFreeText`; URL qua `sanitizeAnalyticsUrl`; enum được whitelist; chuỗi qua `clipParam`.
- [ ] Tiền: integer VND qua `toVndValue` + `currency: 'VND'`.
- [ ] Không dùng tên reserved (`user_engagement`, `engagement_time_msec`, `session_*`, `first_*`, `ga_*`, `google_*`, `firebase_*`).
- [ ] Dimension ổn định, không phụ thuộc locale.
- [ ] Bắn theo kết quả (success/error) khi hành động có thể thất bại.
- [ ] Unit test payload trong `tests/analytics*.test.ts`.
- [ ] Cập nhật **file này**: §3 (từ điển), §7 (custom definitions nếu cần), §12 (lịch sử).
- [ ] Kiểm tra ở DebugView trước khi merge.

---

## 11. Giới hạn đã biết

- **Offline / mạng chập chờn:** gtag không có hàng đợi bền vững; event gửi khi mất mạng sẽ mất. Chấp nhận.
- **Ad blocker:** chặn cả `gtag.js` → toàn bộ event mất (thường 10–30% traffic tech-savvy).
- **Trình duyệt cũ:** Safari < 14.5 không bắn `visibilitychange` khi điều hướng đi; `pagehide` là dự phòng.
- **Tab bị OS kill khi đang ẩn:** không mất dữ liệu, vì đã flush ngay lúc `hidden`.
- **`search` qua landing link:** cố ý không đếm (xem §5); dùng `view_search_results` của enhanced measurement nếu cần.
- **`results_on_page`** chỉ là số kết quả trên trang hiện tại (API storefront chưa trả tổng).
- **Popstate window 5 s:** nếu back/forward cần > 5 s mới render xong (mạng rất chậm) có thể bị đếm nhầm là `user`.

---

## 12. Lịch sử thay đổi

| Ngày | Thay đổi |
| --- | --- |
| 2026-10-28 | Thêm `screen_time` (dwell timer thuần, idle 2 phút, cap 30 phút, flush khi `hidden`, `page_location` của route cũ, key theo pathname); **bỏ** `user_engagement` thủ công và param `engagement_time_msec` (trùng/ reserved). Thêm `search` (sanitize PII, chỉ khi user tự thao tác), `filter_category` (whitelist `product_type`, `category_id: 'all'`, tên `vi`), `navigation_click` (`nav_key` ổn định thay cho label đã dịch), `menu_open`. Thêm bộ `makerworld_*` (không gửi URL thô; `success`/`error_code`/`method`; `value` qua `toVndValue`). Bỏ `order_lookup` (chưa được gắn ở đâu — thêm lại khi có trigger thật). Tài liệu này trở thành nguồn sự thật duy nhất cho GA4. |
| Phase 33–35 | Báo giá `/bao-gia` (`quote_*`), sanitize token trong URL tập trung ở `sendGAEvent`. |
| Phase 7 | Ecommerce + lead events, `page_view` thủ công cho App Router. |
