# BaSa3D — Catalog, SKU & Pricing Spec

Nguồn quyết định: Phase 0 (`docs/exec-plans/active/phase-0.md`). Category tree
và SKU rule dưới đây là đề xuất khởi điểm — cấu trúc `categories` (self-referencing
qua `parent_id`) cho phép thêm/sửa nhánh sau này mà không phá schema, nên không
cần chốt hoàn hảo ngay từ đầu.

## 1. Category tree (đề xuất)

```
Figure & Model (FIG)
├── Anime
├── Game
├── Movie
└── Original / Fan Art

Home Decor (DEC)
├── Desk
├── Wall
└── Lighting

Accessories & Gadgets (ACC)
├── Phone & Tech
├── Keychain
└── Organizer

Gifts & Personalized (GIFT)
├── Personalized Nameplate
└── Cosplay Props

Prototype & Functional Parts (PART)
```

Ghi chú:
- Đây là danh mục chung cho một shop in 3D, không gắn với sản phẩm cụ thể nào
  — chỉnh sửa/thêm nhánh tự do khi biết sản phẩm thật sẽ bán.
- `category` (để duyệt web) và `product_type` (READY_STOCK/MADE_TO_ORDER, để
  vận hành) là hai chiều độc lập trong schema — một sản phẩm trong "Figure &
  Model" có thể là READY_STOCK hoặc MADE_TO_ORDER tùy sản phẩm, không có quy
  tắc cứng category → product_type.
- Chữ viết tắt trong ngoặc (FIG, DEC, ACC, GIFT, PART) dùng làm `CATEGORY_CODE`
  cho SKU ở mục 2 — một khi đã dùng cho SKU thật, không đổi code này nữa.

## 2. Product type

Chỉ dùng hai giá trị (đã chốt ở Phase 0):
- `READY_STOCK` — có tồn kho sẵn, bán ngay.
- `MADE_TO_ORDER` — sản xuất khi có đơn, không giữ tồn kho lớn.

In 3D hoàn toàn theo yêu cầu riêng (khách gửi model/mô tả) **không** đi qua
`products` — nó là luồng `custom_requests` → `quotes` → `print_jobs` riêng.

## 3. SKU rule (đề xuất)

Format:
```
<CATEGORY_CODE>-<PRODUCT_SLUG>[-<VARIANT_CODE>]
```

- **CATEGORY_CODE**: mã 3–4 ký tự theo category cấp 1 ở mục 1 (`FIG`, `DEC`,
  `ACC`, `GIFT`, `PART`). Bất biến sau khi đã dùng cho SKU thật.
- **PRODUCT_SLUG**: viết hoa, bỏ dấu tiếng Việt, khoảng trắng → gạch ngang, tối
  đa ~15 ký tự, rút gọn từ tên sản phẩm. Trùng thì thêm số (`DRAGON`,
  `DRAGON2`).
- **VARIANT_CODE** (tuỳ chọn): viết tắt màu + size nối gạch ngang (`RED-L`,
  `BLK-S`). Bỏ qua nếu sản phẩm chỉ có một variant.

Ví dụ:
- `FIG-DRAGON-WARRIOR-RED-L`
- `DEC-DESK-ORGANIZER-BLK`
- `ACC-PHONE-STAND` (không có variant)

Quy tắc vận hành:
- SKU sinh tự động theo format trên khi tạo variant; cho phép sửa tay trước
  lần lưu đầu tiên.
- Giới hạn độ dài đề xuất: 40 ký tự (để còn đọc được trên hoá đơn/nhãn dán).
- Sau khi variant đã xuất hiện trong `order_items` hoặc `inventory_movements`,
  SKU khoá cứng — không đổi (CLAUDE.md, rule bất biến SKU).

## 4. Công thức tính giá — đã duyệt

Mô hình cost-plus, áp dụng cho cả `READY_STOCK`/`MADE_TO_ORDER` và khi báo giá
`custom_requests`.

**Bước 1 — Tính cost sản xuất:**
```
Material cost  = (khối lượng in, gram / spool_weight_gram) × cost_per_spool
Electricity    = thời gian in (giờ) × công suất máy in (kW) × giá điện (VND/kWh)
Machine dep.   = thời gian in (giờ) × (giá máy / tuổi thọ máy tính theo giờ)
Failure buffer = (Material + Electricity + Machine dep.) × % lỗi in dự phòng
Labor          = thời gian thao tác (setup + hậu kỳ + đóng gói, giờ) × đơn giá nhân công/giờ
Packaging      = chi phí đóng gói cố định/đơn

Total cost = Material + Electricity + Machine dep. + Failure buffer + Labor + Packaging
```

**Bước 2 — Ra giá bán:**
```
Price = Total cost / (1 - % margin mong muốn)
```
Ví dụ: cost 100.000đ, margin 40% → Price = 100.000 / (1 - 0.4) = 166.667đ.

**Quy tắc làm tròn giá bán (Rounding rule, ADR-0010):**
Theo quy tắc lưu trữ tiền integer (VND = 1 minor unit, `AGENTS.md`) và thông lệ bán lẻ tại Việt Nam, giá bán đề xuất tính từ công thức sẽ được làm tròn lên bội số của **1.000 VNĐ**:
`Final Price = Math.ceil(Price / 1000) * 1000`
(Ví dụ: `64.267đ → 65.000đ`, `166.667đ → 167.000đ`).

`materials.cost_per_spool` và `materials.spool_weight_gram` đã có sẵn trong
schema cho Material cost. Điện, khấu hao máy, nhân công, và % margin vẫn cần
số liệu thật từ bạn (open item ở `docs/exec-plans/active/phase-0.md`) trước
khi implement tính năng tính giá tự động — bản thân công thức đã được duyệt.

Khi có vài đơn thật, đối chiếu lại margin thực tế
(Gross Profit = Revenue − COGS) để hiệu chỉnh % margin/% lỗi in.

### Số liệu placeholder (bạn chưa có số thật, dùng tạm — thay bằng số thật khi có)

Vì chưa có hoá đơn/máy in cụ thể, đây là các con số khởi điểm tham khảo mặt
bằng chung tại Việt Nam — **không phải số của bạn**, chỉ để công thức chạy
được ngay:

| Biến | Placeholder | Ghi chú |
|---|---|---|
| Giá điện (VND/kWh) | **3.500đ** | Điện sinh hoạt bậc cao (>400kWh/tháng, tức bậc 5-6) dao động ~3.200–3.967đ chưa VAT theo biểu giá EVN hiện hành (~3.500–4.360đ có VAT); nếu đăng ký điện kinh doanh, giờ bình thường ~3.200đ nhưng giờ cao điểm có thể tới 5.466đ/kWh. Lấy số chính xác từ hoá đơn điện tháng gần nhất chia cho số kWh tiêu thụ là chuẩn nhất. |
| Giá máy in | **15.000.000đ** | Máy FDM tầm trung phổ biến (vd Bambu Lab P1S, Creality K1). Thay bằng giá máy thật bạn đang dùng. |
| Tuổi thọ máy | **10.000 giờ in** | Ước tính trước khi cần thay linh kiện lớn (hotend, nozzle, bo mạch...). Máy giá cao/thấp hơn thì tuổi thọ có thể khác. |
| Đơn giá nhân công | **35.000đ/giờ** | Cho công đoạn setup + hậu kỳ + đóng gói (không phải lương bạn sale báo giá). |
| % lỗi in dự phòng | **10%** | Mức phổ biến cho in FDM; tăng lên nếu model phức tạp/tỷ lệ lỗi thực tế cao hơn. |
| % margin mong muốn | **40%** | Điểm khởi đầu cho sản phẩm quà tặng/mô hình có tính thẩm mỹ. Nên đối chiếu với giá đối thủ và margin thực tế sau vài đơn để điều chỉnh — đây không phải con số cố định đúng cho mọi sản phẩm. |

**Ví dụ tính thử** (model 50g, in mất 3 giờ):
```
Material   = giả sử 8.000đ (tuỳ giá spool bạn nhập vào materials.cost_per_spool)
Electricity = 3 giờ × 0.2kW (máy FDM trung bình) × 3.500đ = 2.100đ
Machine dep = 3 giờ × (15.000.000 / 10.000) = 4.500đ
Subtotal    = 8.000 + 2.100 + 4.500 = 14.600đ
Failure buf = 14.600 × 10% = 1.460đ
Labor       = 0.5 giờ × 35.000đ = 17.500đ (setup + hậu kỳ + đóng gói)
Packaging   = 5.000đ (giả định)

Total cost  = 14.600 + 1.460 + 17.500 + 5.000 = 38.560đ
Price       = 38.560 / (1 - 0.4) = 64.267đ
```

Nguồn tham khảo giá điện: Quyết định 1279/QĐ-BCT (giá bán lẻ điện bình quân
2.204,0655đ/kWh, hiệu lực từ 10/05/2025) và biểu giá bậc thang sinh hoạt EVN
hiện hành.
