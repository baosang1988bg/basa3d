# BaSa3D — Báo cáo User Test & Hiệu suất — 24/11/2026

> Môi trường: `http://localhost:3000` (Next.js **dev mode**, build `1.0.0-development.46eae3f`, Next 15.5.27) + Supabase. Trình duyệt: Chrome (Claude in Chrome).
> **Lưu ý đo đạc:** mọi số liệu hiệu suất lấy từ dev server (không minify, compile theo route, HMR) nên **chỉ mang tính tham khảo**; cần đo lại trên `next build && next start` hoặc UAT thật. Cửa sổ Chrome không thu nhỏ được dưới **606px**, nên "mobile" thực tế là 606×667 — chưa phải 390×844. Chưa chạy Lighthouse (không có công cụ trong phiên) — dùng Performance API (Navigation/Resource/LCP/CLS observer).

> **Đính chính sau khi đọc code (plan `docs/exec-plans/active/fix-qa-audit-2026-11-24.md`):**
> QA-001: migration fold đã có nhưng DB UAT chưa chạy. QA-004: đã có budget 10 lần sai/24h cho mỗi mã — hết lượt thì cả câu trả lời đúng cũng bị từ chối, nhưng UI không báo nên QA không thấy (mức thực tế: IMPORTANT, không phải BLOCKER). QA-005: giỏ hàng bị tắt bằng `NEXT_PUBLIC_CART_ENABLED`.

## 1. Tóm tắt điều hành

- **Điểm sẵn sàng tổng thể: 5/10.** Luồng báo giá/đặt in (lõi doanh thu) chạy tốt. Tuy nhiên tìm kiếm hỏng, admin không tạo được sản phẩm, và luồng xem báo giá có lỗ hổng bảo mật.
- **3 vấn đề nghiêm trọng nhất:**
  1. **Tìm kiếm sản phẩm hỏng toàn bộ** — API suggest trả 500. Trang `/products?q=` crash vì thiếu DB function `basa3d_search_fold` (QA-001).
  2. **Xem báo giá `/quotes/[code]` có thể dò được** — chỉ cần 4 số cuối SĐT, không rate-limit (17 lần sai liên tiếp không bị chặn), và mã nằm trong query string (QA-004). Kèm theo: SĐT không được validate (`abc123` vẫn nhận) nên khách bị khoá ngoài báo giá của chính mình (QA-003).
  3. **Admin không tạo được sản phẩm** — server action `POST /basaadmin/products/new` trả 500, UI báo sai "Mất kết nối" (QA-002).
- **3 cải thiện hiệu suất có ROI cao nhất:**
  1. Giảm JS bundle: trang báo giá tải ~5.6MB JS (dev), 3D tool ~5MB. Cần lazy-load three.js/worker chỉ khi mở preview và tách i18n messages theo route.
  2. Bỏ inline toàn bộ i18n messages vào HTML (HTML 150–240KB/trang). Chỉ gửi namespace cần dùng.
  3. Tối ưu trang admin `product-inventory` (TTFB tới 6.9s) và trang sản phẩm (45 ảnh/1 trang, request ảnh >1s). Cần paginate/aggregate query và lazy-load thumbnail biến thể.

## 2. Bảng chấm điểm theo khu vực

| Khu vực | Chức năng | UX | Hiệu suất | Ghi chú ngắn |
|---|---|---|---|---|
| Storefront | 4 | 6 | 5 | Search 500; không có giỏ hàng, đặt qua Zalo; /en không hoạt động; chỉ 1 sản phẩm đang bán |
| Báo giá / Custom | 7 | 7 | 6 | Upload STL/3MF + MakerWorld chạy tốt; chống double-submit OK; SĐT không validate; link MakerWorld nhận URL bất kỳ |
| Công cụ 3D | 8 | 7 | 6 | Preview ~2s, idle ~120fps (desktop); có validate tham số; emoji bị bỏ im lặng |
| Blog / Cẩm nang | 8 | 7 | 6 | Nội dung tốt; 1 bài blog, không ảnh cover; thiếu og:image; soft-404 |
| Admin – Đơn hàng | 6 | 6 | 6 | Workflow guard tốt; địa chỉ hiện JSON thô; trạng thái thanh toán/vận chuyển độc lập |
| Admin – Kho | 5 | 5 | 4 | Trừ kho nhựa khi PRINTING đúng; huỷ không hoàn; số liệu "hàng có sẵn" mâu thuẫn giữa các màn hình |
| Admin – Khác | 4 | 5 | 6 | Tạo sản phẩm 500; chi phí cho phép 0đ; audit log đầy đủ |
| Phân quyền / Bảo mật | 5 | – | – | Route guard + logout/Back OK; /quotes brute-force được; login không thấy lockout; chưa test Staff |

## 3. Danh sách phát hiện

### BLOCKERS

**QA-001 — Tìm kiếm sản phẩm trả lỗi 500 / crash trang**
- **Khu vực / URL:** header search (mọi trang), `/api/public/products/suggest`, `/products?q=balo`
- **Persona / Thiết bị:** P1 mobile, P2 desktop
- **Bước tái hiện:** 1. Mở `/home` → bấm kính lúp. 2. Gõ `balo` (hoặc `clicker`, `móc khóa`).
- **Mong đợi / Thực tế:** Gợi ý sản phẩm "Clicker Balo Động Vật". Thực tế UI báo "Không tìm được lúc này, vui lòng thử lại". Mọi query ≥2 ký tự → `500 {"code":"INTERNAL_ERROR"}` (query rỗng và 1 ký tự thì 200). `/products?q=balo` hiện Next error overlay: `function public.basa3d_search_fold(character varying) does not exist` tại `storefront-catalog.service.ts (74:16)`.
- **Bằng chứng:** network `GET /api/public/products/suggest?q=balo → 500`; screenshot overlay runtime error.
- **Mức ảnh hưởng:** Cao — khách không tìm được sản phẩm nào.
- **Gợi ý sửa:** Nghi môi trường local chưa chạy migration tạo function. Kiểm tra migration trên mọi môi trường và thêm health-check/test e2e cho search. Trang `/products?q=` cần error boundary thay vì crash.

**QA-002 — Admin không tạo được sản phẩm mới**
- **URL:** `/basaadmin/products/new`
- **Persona:** P3 Owner, desktop
- **Bước:** 1. Nhập tên `[QA-TEST] Móc khoá kiểm thử`, chọn danh mục "Phụ kiện & Tiện ích", giá 30000. 2. Bấm "Lưu nháp" (thử 2 lần).
- **Mong đợi / Thực tế:** Lưu nháp thành công. Thực tế `POST /basaadmin/products/new → 500` cả 2 lần, UI báo "Mất kết nối tới máy chủ. Bấm lưu lại — hệ thống sẽ không tạo trùng sản phẩm."
- **Bằng chứng:** network 2× POST 500; không có console error.
- **Mức ảnh hưởng:** Cao (vận hành) — chủ shop không đăng được sản phẩm.
- **Gợi ý sửa:** Xem server log của server action. Phân biệt lỗi mạng với lỗi server trong thông báo để không gây hiểu nhầm.

**QA-003 — SĐT khách không được validate (client lẫn server)**
- **URL:** `/bao-gia?tab=file` → form "Gửi yêu cầu cho xưởng"
- **Persona:** P2 desktop
- **Bước:** 1. Upload STL hợp lệ. 2. Nhập SĐT `abc123`, tích cam kết. 3. Gửi.
- **Mong đợi / Thực tế:** Báo lỗi định dạng SĐT VN. Thực tế `POST /api/public/custom-requests → 201`, tạo `CR-ABD4ED8CBFD5` với SĐT `abc123`. Sau đó trang `/quotes/CR-ABD4ED8CBFD5` yêu cầu "4 số cuối SĐT" (pattern chỉ nhận số) nên khách **không thể** xem báo giá của mình. Xưởng cũng không liên hệ được.
- **Bằng chứng:** admin list hiển thị `abc123`; trên trang quotes, nhập `c123` → "Please match the requested format."
- **Mức ảnh hưởng:** Cao — mất lead, sai dữ liệu khách.
- **Gợi ý sửa:** Validate và chuẩn hoá SĐT VN ở cả client và API (Zod schema dùng chung).

**QA-004 — Trang xem báo giá có thể brute-force; mã xác minh nằm trong URL**
- **URL:** `/quotes/[quoteNumber]?phoneSuffix=XXXX`
- **Persona:** khách vãng lai / kẻ tấn công
- **Bước:** 1. Mở `/quotes/CR-ABD4ED8CBFD5`. 2. Nhập sai 4 số liên tục (đã thử 17 lần: 1111, 2000–2014, 3333).
- **Mong đợi / Thực tế:** Sau vài lần sai phải bị chặn hoặc có captcha. Mã xác minh không nên đi qua query string. Thực tế lần nào cũng 200 + "Không tìm thấy báo giá khớp…", không thấy giới hạn. Mã được gửi bằng `GET ?phoneSuffix=1111`, nên lưu vào lịch sử trình duyệt, log server, và Referer. Không gian 4 chữ số chỉ có 10.000 giá trị.
- **Bằng chứng:** network `GET /quotes/CR-ABD4ED8CBFD5?phoneSuffix=1111 → 200`; 15 fetch liên tiếp đều 200.
- **Mức ảnh hưởng:** Cao — nếu lộ mã CR (qua chia sẻ screenshot/Zalo) thì báo giá và thông tin khách có thể bị xem. Mã CR 12 hex khó đoán, nên rủi ro hiện ở mức "lộ khi mã bị chia sẻ".
- **Gợi ý sửa:** Chuyển sang POST, rate-limit theo IP + mã, và ưu tiên link có token ký (đã có cơ chế "link hết hạn") thay cho 4 số cuối SĐT.

### IMPORTANT

**QA-005 — Không có giỏ hàng / đặt hàng online; link Zalo không mang ngữ cảnh**
- `/products/clicker-balo-dong-vat-v2` (P1). Chọn biến thể "Backpack Frog v9" → CTA duy nhất là "Nhắn Zalo để đặt hàng" → `https://zalo.me/84333698638` không kèm tên SP, biến thể, giá. Không có ô số lượng (vì vậy chưa test được 0/âm/vượt tồn). localStorage có key `basa3d-cart` = `[]` nhưng không có UI giỏ hàng.
- Ảnh hưởng: Cao với khách mobile lần đầu (phải tự mô tả lại món muốn mua). Gợi ý: prefill tin nhắn Zalo (tên SP + biến thể + link), hoặc form "đặt nhanh" ghi đơn vào hệ thống.

**QA-006 — Tiếng Anh không truy cập được**
- `/en`, `/en/home`, `/en/products` đều về `/home` với `lang="vi"`. Không có nút đổi ngôn ngữ trong header/menu/footer, không có `hreflang`. Gợi ý: bật routing locale và thêm switcher; nếu chưa hỗ trợ EN thì bỏ khỏi phạm vi.

**QA-007 — Số liệu "hàng có sẵn" mâu thuẫn giữa các màn hình**
- PDP Clicker hiện "Sẵn hàng", trong khi `/products?type=READY_STOCK` trả 0 sản phẩm.
- `/basaadmin/product-inventory`: tab "Hàng có sẵn **1**" nhưng danh sách "Tất cả **0**", "Không có dòng nào khớp bộ lọc".
- Dashboard "Vận hành xưởng": "Hàng có sẵn sắp hết **65**".
- Dashboard "Mẫu in": Đang bán 1 + Tạm ẩn 33 = 34 ≠ "Tất cả (50)".
- Ảnh hưởng: Cao với vận hành (quyết định in thêm sai). Gợi ý: dùng 1 nguồn sự thật (view/RPC) cho tồn kho có thể bán, và chú thích rõ các trạng thái còn lại (draft/archived).

**QA-008 — Huỷ lệnh in sau khi đã trừ nhựa không hoàn/điều chỉnh kho**
- `/basaadmin/print-jobs/ef4e2d62…`: gán PLA LITE – TRẮNG 5g, chọn cuộn PLA-L-L-005, chuyển "Đang in" → movement `PRODUCTION_OUT -5g` (đúng). Chuyển "Huỷ" → vẫn -5g, không có bước nhập khối lượng thực tế hay hoàn kho. UI ghi "Vật liệu đã được trừ kho cho lần in này — không đổi được nữa".
- Dropdown sau khi huỷ vẫn cho chọn "Trong hàng chờ" (không thử lưu).
- Gợi ý: khi huỷ/FAILED thì hỏi khối lượng thực tế đã dùng và ghi movement điều chỉnh (+). Ẩn các trạng thái không hợp lệ khỏi dropdown.

**QA-009 — Trạng thái yêu cầu / báo giá / lệnh in không đồng bộ**
- Báo giá `Q-AF5971A72D9E` đi thẳng từ **DRAFT → ACCEPTED** (bỏ qua bước gửi khách) và tự tạo print job. Nhưng yêu cầu `CR-B23193BEF9EC` vẫn ở "Đang xem xét" và vẫn được đếm trong "Yêu cầu in đang mở".
- Dữ liệu cũ: `CR-D0C64C546AE6` ở "Mới tiếp nhận" nhưng print job của nó đã "Hoàn tất".
- Gợi ý: transaction cập nhật trạng thái request khi quote accepted/print job done; chặn accept khi quote chưa gửi (hoặc ghi rõ "chấp nhận thay khách").

**QA-010 — Ô link MakerWorld nhận URL bất kỳ; mô tả hiện HTML thô**
- `/bao-gia`: dán `https://example.com/not-makerworld` → hiện "Bạn đang báo giá mẫu từ link: https://example.com/…" kèm nút "Mở trang mẫu".
- Link MakerWorld thật (#2851863, #1448056) chạy tốt (~210k / ~30k), nhưng mô tả hiển thị nguyên văn `<p><strong>…<br>`.
- Gợi ý: whitelist domain makerworld.com(.cn); sanitize và render HTML mô tả (hoặc strip tag).

**QA-011 — Doanh thu không nhất quán**
- `/basaadmin/expenses`: "Doanh thu đơn hàng **50.000đ**" (tính cả đơn `ORD-9A8155DC2E92` UNPAID/Mới), trong khi dashboard "Doanh thu & Chi tiêu" ghi 0₫. "Dòng tiền ròng" vì vậy cũng sai.
- Gợi ý: chỉ tính đơn đã thanh toán/hoàn tất, dùng chung 1 hàm tính.

**QA-012 — Chi phí chấp nhận 0đ; mã phiếu phải tự gõ**
- Tạo `QA-TEST-EXP-001` với số tiền 0 → được lưu. Số âm bị chặn (chỉ ở client, `min=0`). Mã phiếu chỉ là placeholder, bắt buộc tự nhập.
- Gợi ý: `amount > 0` ở server; tự sinh mã phiếu.

**QA-013 — Báo giá thủ công: giảm giá > tạm tính cho thông báo khó hiểu**
- Tạm tính 25.000, giảm 90.000 → "Tổng tiền" trống, lỗi "Tổng tiền không khớp (máy chủ tính -65.000đ…) — vui lòng tải lại trang". Ô số nối chuỗi thành `090000`.
- Gợi ý: validate "giảm giá không vượt tạm tính" ngay tại field; ô số nên chọn toàn bộ khi focus.

**QA-014 — Chi tiết đơn hàng: địa chỉ JSON thô; trạng thái thanh toán/vận chuyển tự do**
- `/basaadmin/orders/4ae6e65e…`: địa chỉ hiển thị `{"city":"TP.HCM","ward":"Phường Test","line1":"123 Đường Test"}`. Dropdown thanh toán cho chọn REFUNDED với đơn UNPAID; vận chuyển cho chọn DELIVERED khi đơn "Mới". (Chỉ quan sát, không lưu vì đơn không do tôi tạo.)

**QA-015 — Đăng nhập admin: không thấy cơ chế chống dò mật khẩu**
- Nhập sai mật khẩu 5 lần liên tiếp → chỉ báo "Email hoặc mật khẩu không đúng.", sau đó đăng nhập đúng được ngay. Request đi thẳng tới Supabase `auth/v1/token?grant_type=password`.
- Gợi ý: kiểm tra rate-limit Supabase Auth trên production; cân nhắc captcha/lockout cho `/basaadmin`.

**QA-016 — Google Analytics gửi dữ liệu từ localhost, kể cả trang admin**
- Event `page_view`, `form_start`, `scroll` từ `/basaadmin/*` và `/quotes/CR-…` (`form_destination` chứa mã báo giá) gửi lên `G-X3H2K5LWZ3`.
- Gợi ý: tắt GA ở dev và ở `/basaadmin`; không gửi URL có mã báo giá.

**QA-017 — SEO cơ bản thiếu trên nhiều trang**
- `title="BaSa3D"` + description tiếng Anh mặc định "3D-printing business platform" ở `/home`, `/products`, `/custom-print`, `/tools` và 7/9 công cụ.
- PDP không có meta description. Bài blog không có `og:image`. Slug không tồn tại (`/products/khong-ton-tai-xyz`, `/blog/khong-ton-tai-xyz`) hiện trang 404 nhưng HTTP **200** (soft-404, cần xác nhận lại trên prod build).
- 32/45 ảnh trên PDP thiếu `alt`.

**QA-018 — Hiệu suất (xem mục 4)**
- JS 3–5.6MB/trang (dev). Heap 190–226MB trên công cụ 3D. HTML chứa toàn bộ i18n (150–240KB). `/basaadmin/product-inventory` TTFB 6.9s (lần khác 1.0s). `/blog`, `/cam-nang` trả **500** khi tải song song nhiều route (mở riêng thì OK, nghi do dev compile; cần kiểm tra prod).

**QA-019 — Công cụ móc khoá: emoji bị bỏ im lặng; chữ dài không cảnh báo**
- `/custom-print/tao-mau-khac-ten` → redirect `/tools/keychain-generator`. "Nguyễn Thị Ỳến 😀": tiếng Việt hiển thị đúng, emoji bị bỏ khỏi mô hình nhưng vẫn nằm trong ô nhập.
- 24 ký tự → móc khoá dài 217mm mà giá gần như không đổi (25–35k), không cảnh báo kích thước.

**QA-020 — Flex Lamp: preview mặc định có dấu hiệu hình học lỗi (nghi ngờ)**
- `/tools/lamp-shade` mặc định (18×9, ô 12mm): các vòng phía trên trông tách rời, có đường seam chéo (screenshot zoom). Kéo slider tối đa → báo "Tổng số ô không được vượt quá 1000" (validate tốt), nhưng slider vẫn cho chọn tổ hợp không hợp lệ.
- Gợi ý: kiểm tra manifold/printability của mesh; giới hạn slider động theo tổ hợp.

**QA-021 — UX form báo giá `/bao-gia`**
- Nút "Gửi yêu cầu báo giá" bị disable mà không giải thích (do chưa tích cam kết).
- Thông báo validate là thông báo gốc của trình duyệt bằng tiếng Anh ("Please include an '@'…").
- File `.stl` giả vẫn đẩy stepper sang bước 2 (dù có báo "Không đọc được hình khối").
- "Ghi nhớ thông tin liên hệ" được tích sẵn → lưu tên, SĐT, email, địa chỉ vào localStorage (`basa3d_saved_contact:v1`).
- Trang chỉ nhận `.stl/.obj`, nhưng copy bước 3 lại nói "tự động đọc file cấu hình in (.3mf)".

### NICE TO HAVE

- **QA-022:** Modal tìm kiếm không autofocus ô nhập (gõ ngay sau khi mở thì mất ký tự).
- **QA-023:** Trang chủ: FAQ nhắc "mục Vật liệu bên trên" nhưng trang không có. Chip "Móc khoá" trỏ `/products` không lọc, và danh mục này không có trong menu (menu có Keycap, Clicker). "Sản phẩm tiêu biểu" chỉ có 1 sản phẩm.
- **QA-024:** PDP: biến thể trùng tên khác giá ("Monster Teeth v3" 35k/25k, "Cat v8", "Fox v11"); "Thông số kỹ thuật: SAMPLE"; "Combo cả bộ 16 mẫu" trong khi có 17 phân loại; danh sách 17 thẻ dài trên mobile đẩy CTA xuống xa; bấm ảnh chính không mở lightbox; biến thể không lưu vào URL; nút biến thể không lộ là button trong a11y tree.
- **QA-025:** Admin: lỗi tiếng Anh thô ("Cannot transition custom request from NEW to CONVERTED."); enum hiển thị thô (EQUIPMENT, UNPAID, radio name `SNAPMAKER_U1`/`BAMBU_P2S` trong khi nhãn là "Bambu Lab AMS"); link sidebar không có accessible name; audit log hiện actor dạng UUID; `/basaadmin/settings` 404; dropdown trạng thái liệt kê cả trạng thái không hợp lệ; lỗi "cần chọn cuộn" hiện ở khu trạng thái nhưng ô chọn cuộn nằm ở section khác bên dưới.
- **QA-026:** Thông báo thành công `/custom-print` không nằm trong viewport sau khi gửi. Trang 404 dùng theme sáng trong khi site tối. Danh sách custom-request không hiện badge "1 file" cho file upload từ `/custom-print` (chi tiết thì có).
- **QA-027:** Widget dev "🎯 Chỉ AI sửa UI" và badge Next dev hiển thị trên mọi trang kể cả login. Cần đảm bảo bị loại khỏi build production.

## 4. Số liệu hiệu suất

Đo bằng Performance API trên dev server, không throttle. INP/TBT chưa đo (không có Lighthouse). Viewport "mobile" = 606×667.

| Trang | Thiết bị | LCP | INP | CLS | TTFB | JS (KB, transfer) | #Req | Lighthouse Perf |
|---|---|---|---|---|---|---|---|---|
| A1 `/home` (cold) | mobile 606px | 3016ms ❌ | – | 0.000 | 980ms ❌ | 2952 | 25 | chưa đo |
| A1 `/home` (lần sau) | desktop | – | – | – | 4187ms* | – | – | – |
| A3 PDP Clicker | mobile 606px | 1084ms | – | 0.000 | 263ms | 3310 | 65 (45 ảnh) | chưa đo |
| A5 `/bao-gia` | desktop | 1432ms | – | 0.000 | 443ms | 5613 | 20 | chưa đo |
| A9 keychain-generator (cold) | desktop | – | – | – | 4209ms* | 4955 | 21 | heap 193MB, ~120fps idle |
| A9 lamp-shade | desktop | canvas sau 2.0s | rebuild 263ms (max params) | – | – | – | – | heap 195–226MB, ~120fps |
| B2 dashboard | desktop | 2384ms | – | 0.000 | 1768ms ❌ | 3271 | 18 | chưa đo |
| B3 orders | desktop | 2320ms | – | 0.000 | 2101ms ❌ | 3194 | 17 | chưa đo |
| B6 product-inventory | desktop | 7536ms ❌ | – | 0.000 | 6863ms / 1043ms ❌ | 3561 | 17 | chưa đo |

\* TTFB dao động mạnh do dev compile route, cần đo lại trên prod build. Console: không có error/hydration warning trên các trang đã đo. Request lỗi: chỉ `suggest` 500 (QA-001) và `products/new` 500 (QA-002). Request chậm >1s: 6 request `_next/image` trên PDP (~1.0–1.1s mỗi request).

**Top 5 nút thắt + ước lượng cải thiện:**
1. **Bundle JS lớn** (3–5.6MB dev; nghi three.js + i18n + admin code). Dynamic import three.js/canvas chỉ khi cần, kiểm tra bằng `@next/bundle-analyzer`. Ước tính giảm 30–50% JS trên trang không có 3D.
2. **Toàn bộ i18n messages inline trong HTML** (thấy cả chuỗi của tính năng "tìm bằng ảnh" trong HTML trang quotes). Chỉ truyền namespace cần cho client component. Ước tính HTML giảm 50–100KB/trang.
3. **PDP tải 45 ảnh** (thumbnail biến thể + gallery), 6 request ảnh >1s. Lazy-load thumbnail ngoài viewport, đặt `sizes` chuẩn. LCP mobile thật có thể giảm 0.5–1s.
4. **Admin query chậm** (`product-inventory` TTFB tới 6.9s, `orders` 2.1s). Cần aggregate/paginate trong DB (RPC/view) thay cho tính toán ở app. Mục tiêu TTFB <800ms.
5. **LCP trang chủ 3.0s:** ảnh banner hero cần `priority`/preload và kích thước đúng viewport. Mục tiêu ≤2.5s.

## 5. Ma trận phủ test

| Mục | Đã test? | Kết quả | Ghi chú |
|---|---|---|---|
| A1 Home / search | Có | **Fail** | Search 500 (QA-001); menu mobile OK; không có switcher vi/en |
| A2 /products | Có | Partial | Lọc danh mục/sắp xếp OK; READY_STOCK = 0; phân trang không kiểm chứng được (chỉ 1 SP); `?q=` crash |
| A3 PDP | Có | Partial | Chọn biến thể OK; không có số lượng/giỏ; 404 slug hiển thị đúng nhưng HTTP 200 |
| A4 Giỏ / đặt hàng | Không | N/A | **Chưa test** — storefront không có giỏ hàng/checkout (QA-005) |
| A5 /bao-gia | Có | Partial | STL thật/giả/.txt, cực trị SL & tỉ lệ, MakerWorld thật/giả, gửi yêu cầu OK; SĐT không validate; "ước tính từ screenshot" chưa test |
| A6 custom-print / khắc tên | Có | Pass* | 3MF upload + gửi OK; double-click chỉ tạo **1** request ✅; khắc tên có dấu OK, emoji bị bỏ |
| A7 /quotes/[code] | Có | **Fail** | Có cổng 4 số cuối SĐT (tốt) nhưng brute-force được (QA-004) |
| A8 /tools, makerworld resolve | Có | Pass | 11 route 200; resolve MakerWorld 200 |
| A9 9 công cụ 3D | Partial | Partial | Đủ 9 route trả 200; đã test sâu keychain-generator + lamp-shade; **chưa tải STL/3MF** (tải file về máy cần anh cho phép); chưa đo FPS khi xoay/throttle mobile |
| A10 Blog / Cẩm nang | Có | Pass* | Nội dung OK; thiếu og:image bài viết; 500 khi tải song song (dev) |
| A11 Chính sách | Có | Pass | Có link ở footer và ở checkbox cam kết của form |
| B1 Login | Có | Partial | Route guard + logout + Back OK; không thấy lockout sau 5 lần sai |
| B2 Dashboard | Có | Partial | Yêu cầu mới hiện đúng; số liệu kho/doanh thu mâu thuẫn |
| B3 Orders | Partial | Partial | Xem chi tiết + dropdown; **chưa test huỷ đơn → hoàn kho**: không có cách tạo đơn `[QA-TEST]`, và không sửa đơn không do mình tạo |
| B4 Custom requests | Có | Partial | Guard chuyển trạng thái OK; tạo báo giá OK; accept từ DRAFT, không sync trạng thái |
| B5 Products | Có | **Fail** | Tạo sản phẩm 500; chưa test upload ảnh/AI gợi ý |
| B6 Inventory / materials | Partial | Partial | Trừ kho nhựa đúng; huỷ không hoàn; **chưa test race 2 tab** — không có biến thể hàng sẵn nào hiển thị để sửa |
| B7 Print jobs | Có | Pass* | Guard material/spool/transition tốt; huỷ không hoàn kho |
| B8 Expenses | Có | Partial | Âm bị chặn (client), 0đ được nhận |
| B9 Blog admin | Không | – | Chỉ kiểm tra route 200; chưa soạn/duyệt bài |
| B10 stl-import / trend-hunter / voice | Không | – | Chỉ kiểm tra route 200; **không chạy** để tránh gọi AI/tác vụ tốn phí khi chưa hỏi anh |
| B11 Staff / audit / settings / phân quyền | Partial | Partial | Audit log ghi đủ hành động; `/settings` 404; **chưa test Staff** — chưa có tài khoản Staff |
| C Hiệu suất | Partial | Partial | Có số đo dev; chưa Lighthouse, INP, throttle Slow 4G + CPU 4x |
| File mẫu của anh (`Downloads/…Panda….3mf`) | Không | – | Phiên không có quyền đọc thư mục Downloads; dùng file 3MF/STL tự tạo thay thế |

## 6. Đề xuất lộ trình nâng cấp

**Sprint ngay (≤ 1 tuần)**
- Sửa search: migration `basa3d_search_fold` + test e2e search + error boundary. Lợi ích: khôi phục tìm kiếm. Công sức **S**. Rủi ro thấp.
- Sửa 500 khi tạo sản phẩm + phân biệt thông báo lỗi mạng/server. **S–M**. Rủi ro thấp.
- Validate SĐT VN dùng chung client/server. **S**. Rủi ro thấp (cần migrate dữ liệu SĐT xấu hiện có).
- `/quotes`: POST + rate-limit + token ký; bỏ `phoneSuffix` khỏi URL. **M**. Rủi ro trung bình (thay đổi link đã gửi khách).
- Tắt GA ở dev/admin. **S**.

**Ngắn hạn (2–4 tuần)**
- Hợp nhất nguồn số liệu tồn kho/doanh thu (view/RPC dùng chung cho storefront, admin, dashboard). **M**. Rủi ro trung bình.
- State machine liên thông Request ↔ Quote ↔ PrintJob trong 1 transaction, và điều chỉnh kho khi huỷ/FAILED. **M–L**. Rủi ro cao (đụng kho) → cần test concurrency.
- Đặt hàng có ngữ cảnh: prefill Zalo, hoặc form đặt nhanh ghi đơn. **M**.
- Whitelist + sanitize MakerWorld. **S**.
- SEO metadata cho mọi route, og:image blog, trả 404 status thật. **S–M**.
- Việt hoá thông báo lỗi và enum ở admin. **S**.

**Dài hạn**
- Bật i18n EN thật (routing + switcher + hreflang) hoặc bỏ khỏi phạm vi. **L**.
- Tối ưu bundle (tách three.js, i18n theo namespace), ảnh PDP, query admin. Đo lại bằng Lighthouse CI trên prod build. **M–L**.
- Giỏ hàng/checkout đầy đủ với giữ tồn kho (reservation) để tránh oversell. **L**. Rủi ro cao (tồn kho + concurrency).
- Test phân quyền Staff tự động (Playwright) cho mọi route Owner-only. **M**.

## 7. Dữ liệu test cần dọn

| Loại | ID / mã | Ghi chú |
|---|---|---|
| Custom request | `CR-ABD4ED8CBFD5` (id `965f5e81-8869-4aae-93d2-09b1517ddd6c`) | Tên `[QA-TEST] Khách Báo Giá 01`, SĐT `abc123`, file `QA-TEST-cube20.stl` |
| Custom request | `CR-B23193BEF9EC` (id `0daf93e7-9cfc-4015-8c3f-bbb33180347e`) | Tên `[QA-TEST] Khách Đặt In 02 …`, file `QA-TEST-cube20.3mf`, trạng thái "Đang xem xét" |
| Quote | `Q-AF5971A72D9E` (id `c25ad772…`) | 25.000đ, ACCEPTED |
| Print job | `ef4e2d62-b216-4f94-802b-3fca5f5617b5` | Đã huỷ |
| Material movement | `aa65b3c1…` — PRODUCTION_OUT **-5g** PLA LITE – TRẮNG, cuộn `PLA-L-L-005` | Cần điều chỉnh (+5g) nếu muốn khôi phục tồn |
| Expense | `QA-TEST-EXP-001` (id `121827df…`) | 0đ, EQUIPMENT |
| File upload (storage) | `QA-TEST-cube20.stl`, `QA-TEST-cube20.3mf` | Đính kèm 2 request trên |
| Product | — | Tạo thất bại (500), không thấy bản ghi |
| Browser localStorage | `basa3d_saved_contact:v1` | Chứa thông tin liên hệ QA trên máy này |
