# Phase 47 — Print Paws (giá bát thú cưng): khảo sát hành vi bằng REA, chuẩn bị `/tools/pet-bowl-stand`

> Owner yêu cầu 2026-10-22. Chủ Print Paws chia sẻ link trực tiếp cho owner và cho phép quan sát hành vi;
> owner xác nhận ngày 2026-10-22 (`docs/rea/targets.md` dòng #8).
> Phạm vi: chỉ quan sát hành vi (UI, ràng buộc, network, cấu trúc file export). Không lưu hay commit bundle, asset,
> ảnh preview, font hay danh mục mẫu của trang. File export chỉ được đọc cấu trúc **trong bộ nhớ trình duyệt**,
> không ghi ra đĩa. Không đặt đơn thật: chỉ mở các bước giỏ → thông tin → tra cứu, không bấm "Thanh toán".
> Phase này là **khảo sát + đề xuất**, chưa sửa code.

## Brief (Step 1)
- **Goal:** ghi lại tham số kỹ thuật (cỡ bát, công thức chiều cao, độ ổn định, giới hạn bàn in, dung sai ghép, ràng buộc
  AMS / không AMS), cấu trúc file export và luồng đặt hàng của `https://printpaws.mam3d.workers.dev/app?p=bowl-stand-wave`
  trên 3 mẫu đại diện, rồi đối chiếu với engine BaSa3D gần nhất.
- **Non-goals:** clone geometry, mẫu, tên mẫu hay hoạ tiết của trang; sửa code trong phase này.
- **Mẫu khảo sát:** `bowl-stand-wave` (2 màu, có cả AMS và không AMS), `bowl-stand-paws` (khoét xuyên thành, chỉ in AMS),
  `bowl-stand-cat-paws` (chân + tai, không cần support).

## Cách thu evidence

| Tiền tố | Nguồn | Trạng thái |
|---|---|---|
| `R-xx` | REA `capture_browser_scenario` (rea-agents 6.7.0), Chrome headless, 2026-10-22 | **Đã chạy trên Mac.** Sandbox không bị chặn `*.workers.dev` |
| `C-xx` | Playwright 1.62 (`node_modules` của repo) điều khiển Chrome headless, 2026-10-22. Hook trong trang chặn `URL.createObjectURL` + `a.click()` để giữ blob trong bộ nhớ, rồi parse zip/3MF/STL **ngay trong trang** và chỉ trả về bản tóm tắt | Đã có. *Không dùng được Claude in Chrome/TabPilot vì Chrome đang tắt "Allow JavaScript from Apple Events".* Script probe nằm trong scratchpad của phiên, không vào repo |
| `B-xx` | Code BaSa3D (`src/...`) | Đã đọc |

- Kịch bản REA: `docs/rea/printpaws/scenario.json`, chạy bằng `./scripts/rea/run-printpaws.sh`.
- Evidence REA: `docs/rea/printpaws/evidence/scenario-20261022-150907.json` (`ev_a97406948c04…`). File này chứa cây
  accessibility của trang, nên **không commit** (xem IMPORTANT #5).
- Lần tải trang đầu qua MCP: `ev_2e86e2e18a09…` (chỉ chờ 8 s, ghi accessibility + network).
- Giới hạn của REA: download bị **huỷ**, chỉ còn `suggested_filename`. Cấu trúc file vì vậy dựa vào C-40…C-49.
  `completeness.status = incomplete` (`missing_sections: ["events"]`), nhưng mọi step S01–S29 đều `completed`.

---

## Observations (trang tham khảo)

### Khung ứng dụng
| ID | Quan sát |
|---|---|
| R-01 | Trang `/app?p=<slug>` tải ~156 request, **tất cả cùng origin** `printpaws.mam3d.workers.dev`: ES module không bundle (`/src/engines/*`, `/src/geom/*`, `/src/export/*`, `/src/order/*`), vendor `three`, `opentype`, `clipper`, `earcut`. Không có script analytics hay bên thứ ba. API gọi lúc tải: `GET /api/settings`, `GET /api/products` |
| R-01 | Header: Hoàn tác / Làm lại, "Xưởng" (thiết kế đã lưu), Lưu thiết kế, Giỏ hàng, Chụp ảnh, menu **Tải file**, VI/EN, sáng/tối, hướng dẫn, nút cài PWA. Thanh bước: Chọn mẫu → Tùy chỉnh → Kiểm tra & Báo giá → Đặt hàng → Thanh toán → Xác nhận |
| R-01 | Panel Tùy chỉnh có 6 tab: Chọn mẫu, Dáng kệ, Trang trí, Màu sắc, Kích thước bát, Phụ kiện. Có nút "Phối ngẫu nhiên". Viewport hiện kích thước, vd. `170 × 170 × 75 mm Sẵn sàng in`, và danh sách **"Lưu ý (n)"** cập nhật liên tục |
| R-01 | Chân panel ghi: "Thiết kế trên máy bạn. Tệp không được gửi lên máy chủ." |

### Control & mặc định (mẫu wave; đơn vị theo UI)
| ID | Nhóm / control | Mặc định | Ràng buộc quan sát được |
|---|---|---|---|
| C-01 | Dáng kệ → **Dáng thân** (radio tile) | Nón | 7 dáng (trụ, trống phình, lục giác, gân dọc…) |
| C-02 | Dáng kệ → **Kiểu đường nối** (đường chia 2 màu) | Sóng | 16 kiểu. Mẫu cat-paws chỉ còn 11 kiểu và 3 dáng thân (giới hạn theo mẫu) |
| C-03 | Trang trí: vành (6 lựa chọn, gồm tai), kiểu xuyên thành (8), **khe nhấc bát** (không / hai bên / sau / cả hai), hoạ tiết (~35), chân kệ (không / chân thú), đế chống kiến (không / rãnh nước liền khối) | Không có | Cat-paws thêm: kiểu tai, "mặt mèo phía trước", số chân (4 / 2 chân trước) |
| C-04 | Màu sắc: 10 bảng phối sẵn + màu nửa trên / nửa dưới (bộ chọn filament có tên màu) | Nửa trên "Xanh ngọc" `#2BB3A8`, nửa dưới "Xanh đêm" `#1F3A5F` | Cat-paws thêm màu tai, mặt mèo, lòng tai, bàn chân, đệm thịt, mỗi màu chọn được "như nửa trên / như nửa dưới / màu riêng" |
| C-05 | Kích thước bát → **Cỡ bát** | 13 cm | Tile: "Bát inox 13 cm (lỗ 116)", "Bát inox 19 cm (lỗ 174)", "Tự đặt". Giải thích: bát 13/19 cm shop bán kèm, lỗ khoét vừa sẵn; cỡ khác thì tự đo lỗ, vành, độ sâu; "nên in thử phần trên với bát thật trước" |
| C-06 | Tự đặt → Đường kính lỗ / vành bát / độ sâu bát | 140 / 152 / 45 mm | `range` 60–230 bước 0,5 / 60–320 bước 0,5 / 10–150 bước 1 |
| C-07 | **Thú cưng** `select#p-pet` | Mèo | `cat` / `dog` |
| C-08 | **Chiều cao vai** | 250 mm | `range` 120–900 bước 5. Giải thích: đo từ sàn tới đỉnh vai khi đứng; chiều cao giá "chỉ là điểm khởi đầu do thiết kế chọn, không phải chuẩn thú y" |
| C-09 | **Dùng cho** `select#p-use` | Bát ăn | `food` / `water` ("Bát nước luôn để ngang") |
| C-10 | **Nghiêng về phía thú** | 0° | `range` 0–15 bước 5 |
| C-11 | Phụ kiện: `+ Chữ`, `+ Biểu tượng`, `+ Hình vẽ`. Mặc định có 1 chữ + 1 biểu tượng | Chữ "Paws", font Baloo 2 | Mỗi phụ kiện có: kiểu Nổi / Phẳng / Lõm; vị trí quanh thân −180…180° (0° = phía thú); độ cao trên thân 0–100 %; kích thước 5–1000 % bước 5; xoay −360…360 bước 5; độ sâu 0,2–10 mm bước 0,2; viền nền 0–6 mm bước 0,2; màu. Chữ: `maxLength=60`, ~27 font Google (hỗ trợ tiếng Việt) |

### Chiều cao, độ ổn định, cỡ bát (đo trên viewport; bát 13 cm, nghiêng 0°)
| ID | Input | Kích thước giá (D × D × H) | Giá tạm tính |
|---|---|---|---|
| C-12 | Mèo, vai 120 / 200 / 250 / 300 / 320 / 330 / 340+ | H = 50 / 60 / 75 / 90 / 96 / 99 / **100** (đáy 170) | 145.000đ (không đổi) |
| C-13 | Chó, vai 120 / 200 / 250 / 300 | H = 50 / 70 / 87,5 / 105 (đáy 170) | 145k → 146k |
| C-14 | Chó, vai 340 / 360 / 400 / 450 / 480 | 178,5×119 / 189×126 / 210×140 / 236,3×157,5 / **250**×168 | 160k → 232k |
| C-15 | Chó, vai 480 | Lưu ý: "Đáy cần rộng 252 mm cho vững nhưng bàn in chỉ cho 250 mm…" | — |
| C-16 | Chó, vai **500** | **170 × 170 × 42 mm**. Lưu ý: "Chó thuộc nhóm nguy cơ xoắn dạ dày nên giá đang để thấp nhất và không nghiêng. Công thức cho 175 mm; hãy hỏi bác sĩ thú y trước khi nâng." | 145k |
| C-17 | Mọi chiều cao với chó | Lưu ý thường trực về GDV (xoắn dạ dày): bằng chứng còn ít và trái chiều, hỏi bác sĩ thú y | — |
| C-18 | Nghiêng 0 / 5 / 10 / 15° (mèo 250) | H = 75 / 81,2 / 87,3 / 93,4 | không đổi |
| C-19 | Bát nước khi nghiêng đang 10° | H trở về 75; Lưu ý "độ nghiêng không áp dụng"; slider **vẫn giữ 10°** | — |
| C-20 | Bát 19 cm (mèo 250) | 230 × 230 × 75 | 175.000đ |
| C-21 | Tự đặt mặc định (lỗ 140, vành 152) | 192 × 192 | 145k |
| C-22 | Tự đặt: lỗ 174 / 200 / 230 | đáy 214 / 240 / 250 (chạm trần bàn in) | 145k / 152k / 158k |
| C-23 | Tự đặt: vành 60 hoặc 140 (lỗ 140) → đáy 180; vành 200 → 240; vành 320 → 250 | Vành 120 < lỗ 140: Lưu ý "Vành bát phải rộng hơn lỗ, ít nhất **144 mm**…" (cảnh báo, **không chặn**) | — |
| C-24 | Tự đặt: độ sâu 10 / 45 / 80 / 150 | H 75 / 75 / **85** / **155** (đáy 232,5) | 145k → 213k |

### Phối ngẫu nhiên, lưu, hoàn tác
| ID | Quan sát |
|---|---|
| C-25 | "Phối ngẫu nhiên" đổi cùng lúc dáng thân, đường nối, trang trí vành, bảng màu và kiểu chữ (Nổi / Lõm). Kích thước và giá đổi theo (vd. 176 × 173 × 122,4 mm, 157k). **URL không đổi** (không có seed trong URL). "Hoàn tác" quay về đúng bước trước |
| C-26 | Trong 3 mẫu khảo sát không thấy nút xúc xắc riêng. Danh mục mô tả xúc xắc "xáo lại" ở một số mẫu khác (giọt kem, đồng cỏ) |
| C-27 | Lưu thiết kế → `localStorage["mam3d.designs.v1"]`; thêm giỏ → `localStorage["pp.cart.v1"]` (~16 KB / 1 món, tức là lưu snapshot thiết kế); thông tin checkout → `pp.checkout.v1` ("thông tin được lưu trên máy này"). Cookie: không có (R-02) |

### Ô chữ: input biên (mẫu wave, xuất 3MF rồi đọc object `addon-1`)
| ID | Input | Kết quả |
|---|---|---|
| C-30 | `""` hoặc `"   "` | Thẻ phụ kiện thành `1. “”` / `1. “ ”`. 3MF **không có** `addon-1`, phụ kiện bị bỏ **lặng lẽ**, không báo lỗi |
| C-31 | `"A"` | `addon-1` 228 tam giác, rộng 16,2 mm |
| C-32 | `"ĐẠT"` | 932 tam giác, rộng 51,2 mm, z 42,0–65,8 (dấu làm cao hơn chữ không dấu ≈ 2,4 mm). Hỗ trợ tiếng Việt đầy đủ |
| C-33 | `"Bông Gòn"` | 2 760 tam giác, rộng 109,4 mm |
| C-34 | `"🐶Mimi"`, `"👨‍👩‍👧"`, `"小白"` | Vẫn xuất được: 1 140 / 632 / 424 tam giác, rộng 74,3 / 51,8 / 33 mm. Không cảnh báo ký tự thiếu glyph |
| C-35 | 60 ký tự (gõ tay) | 17 052 tam giác, chữ quấn quanh thân, bbox x −77…77 (≈ 154 mm). Không cảnh báo tràn hay đè đường nối |
| C-36 | 61 ký tự (đặt bằng script, vượt `maxLength`) | Được chấp nhận và xuất ra (17 288 tam giác); giới hạn chỉ có ở client |
| C-37 | `"A\nB"` | Input `type=text` bỏ xuống dòng → `"AB"` |
| C-38 | Gõ chữ xong bấm ngay **Xuất 3MF** khi ô chữ còn focus | **Không ra file, không có thông báo** (lặp lại ở 10/10 trường hợp). Bấm Tab (blur) trước thì xuất bình thường |

### Export (đọc trong bộ nhớ, không lưu ra đĩa)
Menu **Tải file**: `#export-stl` "Xuất STL", `#export-3mf` "Xuất 3MF", `#export-noams` "3MF không AMS"
(tooltip: "Cho máy một đầu phun, không có bộ đổi nhựa…").

| ID | Quan sát |
|---|---|
| R-02 / C-40 | Tên file lấy **theo slug tên mẫu**, không theo tên bé: `gia-bat-song.stl`, `gia-bat-song.3mf`, `gia-bat-song-khong-ams.zip` (REA `download-cancelled` ở S13/S17/S22 khi chữ là "Bông Gòn"). Cat-paws: `gia-bat-meo-chan-hong.*`. Paws: `gia-bat-cua-so-dau-chan.*` |
| C-41 | STL: **1 mesh gộp**, binary, toạ độ lắp ráp tâm tại gốc (wave: x/y −85…85, z 0…75; 24 434 tam giác) |
| C-42 | 3MF (bản AMS): `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`, **`Metadata/model_settings.config`**. Namespace core 2015/02; `<metadata Application="Print Paws">`, `Title` = tên mẫu tiếng Việt |
| C-43 | Màu: `basematerials id=1000`, mỗi part **một `base` có `name` = tên part** và `displaycolor` (vd. `lower:#1F3A5FFF`, `upper:#2BB3A8FF`, `addon-1…`). Mỗi part là một `object` có `name` (`lower`, `upper`, `addon-N`, cat-paws thêm `ear-*`, `ear-inner-*`, `cat-face`, `feet-paw-*`, `feet-pads-*`; paws có `upper-wall`, `windows`) và `pid/pindex` theo object. Thêm 1 object assembly có `components`, cùng **1 build item** transform đơn vị (tâm tại gốc, chưa đặt giữa bàn in) |
| C-44 | `model_settings.config`: 1 `object` gồm các `part` có `name` + **`extruder`** (lower = 1, upper = 2, phụ kiện theo màu của nó), `mesh_stat` toàn 0. Bambu Studio vì vậy gán sẵn khay AMS theo màu |
| C-45 | Bản AMS wave: `lower` z 0–38,9 (đáy 170), `upper` z 25,85–75 (Ø158). Hai nửa **chồng nhau 13 mm** ở vùng đường nối. Chữ "Paws" (`addon-1`) z 44,5–63,3, nằm ở mặt −Y (0° = phía thú) |
| C-46 | **3MF không AMS** (wave): zip gồm `…-1-nua-duoi.3mf`, `…-2-nua-tren.3mf`, `HUONG-DAN.txt`. Mỗi 3MF chỉ 1 màu, mọi part `extruder=1`; phụ kiện được gom vào nửa chứa nó và **đổi sang màu nửa đó**. Nửa dưới in đứng (z 0–46,8); nửa trên **lật úp** (z 0–49,05, mặt đỡ bát xuống bàn, toạ độ Y đảo). 46,8 + 49,05 − 75 ⇒ phần lồng (cổ nối) ≈ 20,9 mm |
| C-47 | `HUONG-DAN.txt` (tóm tắt): in 2 nửa mỗi nửa một màu rồi lồng vào; nửa dưới in đứng, nửa trên in úp; "đặt nửa trên thẳng xuống… rồi ấn"; **khe ghép 0,2 mm**; "nên in thử một lần trước" |
| C-48 | Cat-paws: 3MF AMS có 17 part (4 chân + 4 đệm thịt z 0–33,7; 2 tai + lòng tai cao tới 101,9). Bản không AMS có thêm **file thứ 3 "chi tiết dán"** (2 tai, in đứng), hướng dẫn dán bằng keo 502 hoặc AB, tâm hai tai cách nhau 85 mm. Lưu ý: đường nối thấp hơn bàn chân thì in hai nửa sẽ cắt bằng chân, "đưa đường nối lên ít nhất 36 mm" |
| C-49 | Paws (khoét xuyên thành): `#export-noams` có **`hidden`**. Lưu ý: "chỉ in một lần nhiều màu… màu nửa dưới xuyên qua thành nên không tách được thành hai nửa". 3MF AMS có thêm `upper-wall` (34 796 tam giác) và `windows` (màu nửa dưới) |
| C-50 | Sau mỗi lần tải: modal "Đang tải file của bạn — File miễn phí", xin ủng hộ qua VietQR (nạp thêm `/src/order/vietqr.js`, `qr.js`). Không có request mạng nào khác (C-, R-02) |

### Network trong lúc thiết kế, export và đặt hàng
| ID | Quan sát |
|---|---|
| R-02 | 234 request, tất cả cùng origin; **không có request nào ngoài GET**. Chỉ gọi `/api/settings` và `/api/products` (khi tải `/app` và `/order`). Không request nào khi export, thêm giỏ, mở checkout |
| C-51 | Shape của `/api/settings` (chỉ đọc key): `materials{pla,petg}`, `prices{machinePerHour, extraColour, customText, processing, minItem, round, bulk}`, `extras{icon, drawing, bow, stl, rim, feet, windows, slots, relief, moat, sizeMediumFrom/Fee, sizeLargeFrom/Fee, floorInox13, floorInox19, floorCustom, floorBasisS/M/L}`, `shipping{standard, express, pickup}`, `schedule{depositShare, leadDays, maxDaysAhead}`, `bank{…}`, `social{…}`, `payments[5]{id, ready}`. `/api/products` = `{closed: [67 id]}`. **Giá tính hoàn toàn ở client** từ thiết kế + bảng giá này |

### Luồng đặt hàng (chỉ xem UI, không gửi đơn)
| ID | Bước | Quan sát |
|---|---|---|
| C-60 | Thêm vào giỏ | Toast "Đã thêm vào giỏ hàng.", badge giỏ = 1, không có request mạng (R-02 S24) |
| C-61 | `/order#cart` (Bước 3) | Mỗi món: kích thước, số màu, chất liệu, cách in ("Nhiều màu in liền một lần"), chữ trên sản phẩm, trang trí thêm. Chọn chất liệu PLA / PETG; số lượng 1–99; Chỉnh sửa / Xoá / Xem chi tiết giá. Phí giao 30k. SL 10 → dòng "Giảm giá số lượng −145.000đ" (10 %). Ghi chú: "Giá tạm tính… Xưởng xác nhận lại khi kiểm tra file, trước khi bạn thanh toán phần còn lại" |
| C-62 | `/order#preorder` (Bước 4) | `schedule`: Sản xuất ngay / Đặt trước giữ mẫu (cọc 30 %) / In theo lịch hẹn (cọc 30 %). Hiện ngày nhận dự kiến (vd. Thứ 3 27/10 – Thứ 5 29/10/2026 cho giao tiêu chuẩn) |
| C-63 | `/order#checkout` (Bước 5) | Trường: `customer.name`*, `customer.phone`* (tel), `customer.email` (tuỳ chọn), `ship` (tiêu chuẩn 3–5 ngày 30k / nhanh 1–2 ngày 50k / nhận tại cửa hàng 0đ), `shipping.address`*, `province`*, `district`, `ward`*, `note`; thanh toán: chỉ có VietQR, MoMo / VNPay / thẻ / COD ghi "Sắp có". Không có `pattern` hay `maxLength` cho SĐT. **Không bấm "Thanh toán".** |
| C-64 | `/order#track` (Bước 6) | Tra cứu bằng **mã đơn + số điện thoại**. Với service worker bị chặn, trang hiện "Đang ngoại tuyến: cần mạng để tra cứu đơn" |

## Observations (BaSa3D)
| ID | Nội dung | Nguồn |
|---|---|---|
| B-01 | `write3mf`: màu bằng `m:colorgroup` + `pid/pindex` theo object, object có `name`, 1 assembly + 1 build item, toạ độ lắp ráp. **Không có** `Metadata/model_settings.config` nên không gán sẵn extruder/AMS. Validate màu, toạ độ hữu hạn, chỉ số đỉnh | `src/lib/3d-tools/common/3mf-writer.ts:8-35` |
| B-02 | `exportBlocksStlZip` đặt tên theo keychain (`00-compact-base`, `NN-block`). Không tái dùng được cho giá bát | `3mf-writer.ts:37-53` |
| B-03 | Lamp-shade: uốn tấm phẳng đục lỗ thành ống (`wrapPanelIntoTube`, góc = x / r). Chỉ có thân **trụ**, không có profile xoay (cone/trống) | `lamp-shade/lamp-shade-engine.ts:~87-111` |
| B-04 | Organizer: `manifold-3d` (WASM) trong Web Worker, font qua `opentype.js` → polygon, trả typed array dạng transferable, request có `id` để bỏ reply cũ | `organizer/organizer.worker.ts:1-61` |
| B-05 | `slug()` bỏ dấu tiếng Việt và đổi `đ` → `d`. Dùng được cho tên file theo tên bé | `organizer/organizer-export.ts:61-64` |
| B-06 | `POST /api/public/tool-price-estimate`: zod strict `{weightGrams ≤ 2000, printMinutes ≤ 7 ngày}`, rate limit 60/giờ/IP, **chỉ giá PLA, một màu**, trả khoảng ±15 % | `src/app/api/public/tool-price-estimate/route.ts:11-35`, `src/lib/pricing/tool-price-range.ts:3-18` |
| B-07 | Ước lượng: khối lượng = thể tích mesh × 1,24 (đặc 100 %), phút in = 12 + 1,8 × gram | `src/lib/pricing/mesh-estimator.ts:22-31` |
| B-08 | Mẫu workbench (lamp): debounce 500 ms → estimate; tải STL / 3MF bằng blob; "gửi yêu cầu" = upload STL (`uploadCustomRequestFile`) + điền sẵn mô tả Custom Request; sự kiện GA4 `trackLamp*` | `src/app/[locale]/(tools)/tools/lamp-shade/lamp-shade-workbench.tsx:55-100` |
| B-09 | Custom Request công khai bắt buộc upload claim hợp lệ cho từng file đính kèm | `src/app/api/public/custom-requests/route.ts:55` |
| B-10 | Xử lý text hiện có: dual-text chuẩn hoá NFC; keychain-blocks đếm theo code point (phase 46 B-01). Chưa có tool nào đếm theo grapheme hay kiểm tra glyph thiếu | `dual-text/dual-text-engine.ts:36` |

---

## Inferences
- **I-1 Concept sản phẩm** (C-43…C-49): giá bát là **thân xoay 2 màu chia bởi một "đường nối" có hoạ tiết**. Có 2 cách sản xuất:
  (a) AMS: một lần in nhiều part, hai nửa chồng nhau ~13 mm ở vùng nối;
  (b) không AMS: hai nửa lồng vào nhau (cổ nối ~21 mm, khe 0,2 mm), nửa trên in úp, chi tiết nhô (tai) in rời rồi dán.
  Mẫu có lỗ khoét xuyên thành thì không tách được nên chỉ cho AMS. *Độ tin: cao (bbox, tên part, hướng dẫn).*
- **I-2 Công thức chiều cao** (C-12…C-16, C-24): khớp số đo với
  `mèo: H = clamp(0,30 × vai, 50, 100)`; `chó: H = max(50, 0,35 × vai)`; `H ≥ độ sâu bát + 5`.
  Với chó vai cao (giữa 480 và 500 mm) thì có "chốt an toàn GDV": H = 42 mm, khoá nghiêng.
  Trang tự ghi đây là lựa chọn thiết kế, không phải chuẩn thú y. *Độ tin: cao ở các điểm đo; ngưỡng GDV chính xác chưa rõ (U-2).*
  BaSa3D phải tự quyết công thức trong ADR, không lấy nguyên con số này.
- **I-3 Độ ổn định & bàn in** (C-14, C-15, C-22): `đáy = max(đáy theo cỡ bát, 1,5 × H)`, trần 250 mm (bàn in).
  Vượt trần thì chỉ cảnh báo. Đáy theo cỡ bát ≈ `max(lỗ, vành) + 40` (custom: 152 → 192, 174 → 214, 200 → 240).
  Preset 13 cm → đáy 170, 19 cm → 230. *Độ tin: cao trong khoảng đã đo.*
- **I-4 Ôm bát** (C-05, C-23): lỗ khoét nhỏ hơn cỡ danh nghĩa (13 cm → lỗ 116; 19 cm → lỗ 174), bát treo bằng vành trên một gờ.
  Quy tắc tối thiểu `vành ≥ lỗ + 4 mm`. Con số lỗ phụ thuộc bát inox cụ thể mà shop bán, nên **không áp được cho bát của BaSa3D nếu chưa đo**.
- **I-5 Nghiêng** (C-18): mỗi 5° nghiêng làm phía sau cao thêm ~6,1 mm, khớp `tan(5°) × ~70 mm`, tức là bán kính mặt đỡ bát. *Độ tin: trung bình.*
- **I-6 Giá** (C-51, C-61): giá tính ở client theo công thức giờ máy + thêm màu + chữ + phụ phí từng tính năng + giá sàn theo cỡ bát + phí size; giảm giá số lượng. Xưởng xác nhận lại trước khi thu phần còn lại. BaSa3D đang tính ở server (B-06), nên **giữ cách của BaSa3D**.
- **I-7 Quyền riêng tư** (R-02, C-27): thiết kế và giỏ chỉ nằm trong localStorage cho đến lúc gửi đơn (lúc gửi chưa quan sát, U-3). BaSa3D thì upload STL ngay khi gửi Custom Request (B-08). Cần nói rõ điều này trong UI.
- **I-8 Lỗi / hành vi của trang tham khảo — KHÔNG sao chép:**
  1. Bấm export khi ô chữ còn focus thì không ra file, cũng không thông báo (C-38).
  2. Chữ rỗng hoặc toàn khoảng trắng bị bỏ khỏi 3MF mà không báo (C-30).
  3. Emoji / CJK không có trong font vẫn xuất mà không cảnh báo; nhiều khả năng ra glyph `.notdef` (C-34; *suy luận từ số tam giác, chưa nhìn hình*).
  4. `maxLength` chỉ chặn ở client (C-36). Chữ 60 ký tự quấn ~154 mm quanh thân mà không cảnh báo tràn hay đè đường nối (C-35).
  5. Chiều cao nhảy gắt từ 168 mm (vai 480) xuống 42 mm (vai 500) trong khi slider vẫn hiện 500 mm (C-14, C-16).
  6. Bát nước giữ giá trị nghiêng trong UI nhưng âm thầm bỏ qua (C-19).
  7. Tên file theo mẫu, không theo tên bé (C-40). 3MF đặt tâm tại gốc, phải chờ slicer tự đặt lên bàn (C-43).
  8. Giỏ SL 10 hiện "10 × 145.000đ … 1.305.000đ" trong khi giá sản phẩm là 1.450.000đ (C-61/C-62, hiển thị lệch).
  9. Vành < lỗ chỉ cảnh báo, vẫn cho xuất và đặt (C-23).

## Unknowns
- **U-1** Hình học khớp nối thật ở bản AMS (vùng chồng 13 mm là bậc, côn hay ren?) và độ dày thành, gờ đỡ bát. Cần mở mesh trong slicer; ngoài phạm vi "chỉ đọc cấu trúc".
- **U-2** Ngưỡng vai chính xác kích hoạt chốt GDV (480 < ngưỡng ≤ 500 mm), và có phụ thuộc giống chó không.
- **U-3** Khi bấm "Thanh toán" thì gửi gì lên server (`/src/order/api.js`): file STL/3MF hay chỉ tham số? Có upload ảnh chụp không? Không kiểm vì không được đặt đơn thật.
- **U-4** Đổi PETG có làm đổi giá không (lần thử radio PETG không ghi nhận thay đổi; có thể do thao tác của probe).
- **U-5** Bambu Studio xử lý `model_settings.config` của trang ra sao (1 object nhiều part, gán AMS tự động, vị trí trên bàn). Cần import thủ công.
- **U-6** Nút xúc xắc / seed ở các mẫu khác có lưu được để tái tạo không (C-26).
- **U-7** Thông báo "ngoại tuyến" ở trang tra cứu khi chặn service worker là do REA/Playwright hay do trang (C-64).

## Đề xuất lát cắt (chưa làm, cần owner duyệt)
MVP cho `/tools/pet-bowl-stand` theo đúng khung tool hiện có (B-04, B-08), **không** làm giỏ hàng hay checkout riêng
(BaSa3D dùng báo giá + Custom Request):

- [ ] **0. ADR + số liệu thật (chặn mọi lát sau).** Đo bát inox BaSa3D định bán hoặc khuyến nghị (Ø danh nghĩa, Ø vành, Ø thân dưới vành, độ sâu). Chốt: công thức chiều cao theo loài, tỉ lệ đáy/chiều cao, trần bàn in theo **printer profile mặc định** (không hard-code 250), khe ghép cho bản không AMS, nội dung cảnh báo GDV (bác sĩ thú y), có làm bản không AMS ở MVP hay không.
- [ ] **1. Engine thuần TS** `src/lib/3d-tools/pet-bowl-stand/` (constants + `deriveStandDimensions()` + `collectWarnings()`), không cần DOM, unit test biên: vai min/max, chó/mèo, bát preset/tự đặt, vành < lỗ, độ sâu lớn, vượt bàn in.
- [ ] **2. Geometry trong Worker (manifold)**: thân xoay (trụ / nón, profile 2D → revolve), lỗ ôm bát + gờ, khe nhấc bát (tuỳ chọn), đường nối **thẳng + 1 kiểu sóng do BaSa3D tự thiết kế**, tách 2 part màu.
- [ ] **3. Chữ tên bé**: emboss/deboss bằng font hỗ trợ tiếng Việt; NFC + đếm **grapheme** (`Intl.Segmenter`); phát hiện glyph thiếu → lỗi rõ ràng; giới hạn theo **chiều dài cung cho phép**, không chỉ số ký tự; chặn chữ vắt qua đường nối.
- [ ] **4. Export**: mở rộng `common/3mf-writer.ts` theo hướng **tương thích ngược** (tuỳ chọn ghi `model_settings.config` + `extruder` theo màu) và có test cho 7 tool cũ. STL zip theo part. Tên file `slug(tên bé)` (B-05).
- [ ] **5. UI + báo giá + Custom Request + GA4 `tool_pet_bowl_*` + e2e**, theo `.agents/skills/ui-ux`.
- [ ] *Để sau MVP:* nghiêng, bát nước/ăn, tai / chân / mặt (chi tiết dán), khoét xuyên thành (chỉ AMS), rãnh chống kiến, bản không AMS lồng hai nửa (nếu ADR không đưa vào MVP), 3+ màu, lưu thiết kế, phối ngẫu nhiên / undo.

## Definition of Done (phase khảo sát)
- [x] Liệt kê control, default, min/max, đơn vị cho 3 mẫu (C-01…C-11, C-02/C-03/C-04 với các khác biệt của cat-paws)
- [x] Công thức chiều cao, đáy, cỡ bát, nghiêng (C-12…C-24, I-2…I-5)
- [x] Input biên cho chữ (C-30…C-38)
- [x] Bấm mọi nút export + thêm giỏ; network (R-01, R-02, C-50, C-51)
- [x] Cấu trúc STL / 3MF / zip không AMS cho 3 mẫu (C-40…C-49)
- [x] Luồng đặt hàng: giỏ → đặt hàng → thông tin → tra cứu, không gửi đơn (C-60…C-64)
- [x] Đối chiếu BaSa3D (B-01…B-10)
- [x] Evidence REA chính thức (R-01, R-02)
- [ ] Owner duyệt mục "Đề xuất lát cắt" + review cuối file

## Mapping REA
| R-ID | Evidence / step | Xác nhận cho |
|---|---|---|
| R-01 | `ev_2e86e2e18a09…` (MCP, tải `/app?p=bowl-stand-wave`, accessibility + network) | Khung UI, 6 tab, network lúc tải, 1 origin |
| R-02 | `ev_a97406948c04…` = `docs/rea/printpaws/evidence/scenario-20261022-150907.json`, S01–S29 | S04 chó, S06 bát 19 cm, S09 tên "Bông Gòn"; S13/S17/S22 `download-cancelled` (tên file, C-40); S24 thêm giỏ; S26/S28 `/order#cart`, `#checkout`; network chỉ GET cùng origin; storage keys (C-27) |
