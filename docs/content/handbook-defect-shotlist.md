# Hướng dẫn chụp ảnh lỗi in 3D (Handbook Defect Shot List)

Tài liệu quy chuẩn chụp ảnh trước/sau (*failed vs fixed*) cho 8 lỗi in trong Cẩm nang in 3D BaSa3D (`/cam-nang#xu-ly-loi`).
Tuân thủ ADR-0055 và quy chuẩn Phase 53: chỉ sử dụng ảnh thật chụp tại xưởng BaSa3D, không dùng ảnh mạng.

---

## 1. Quy chuẩn chụp và xử lý ảnh (Studio Standard)

- **Cố định vị trí máy ảnh (Tripod Lock):** Với mỗi cặp ảnh (*failed* và *fixed*), bắt buộc cố định tripod, cùng tiêu cự và khoảng cách chụp. Hai mẫu in đặt tại cùng một vị trí đánh dấu sẵn trên bàn chụp để khi người dùng chuyển đổi radio, vật thể giữ nguyên vị trí trong khung hình.
- **Phông nền (Background):** Phông nền xám trung tính (matte neutral grey #3a3a3a) hoặc tấm cao su cắt (cutting mat) mặt sau không bóng. Tránh phông trắng cháy sáng hoặc phông hoa văn.
- **Ánh sáng (Lighting):** Hai đèn LED mềm khuếch tán (diffused lights):
  - Đèn chính (Key light): góc chếch 45° từ trên xuống để tạo bóng đổ nhẹ làm nổi bật rãnh lớp (*layer lines*) và khuyết tật.
  - Đèn phụ (Fill light): góc 45° đối diện ở cường độ 30–40% để chi tiết vùng tối không bị đen đặc.
  - Không dùng đèn flash trực tiếp (sẽ gây lóa trên nhựa bóng).
- **Quy cách file xuất (Export Spec):**
  - Định dạng: **WebP** (chất lượng 82–85%).
  - Kích thước: **1600 × 1200 px** (tỷ lệ chuẩn **4:3**).
  - Dung lượng file: **≤ 180 KB** mỗi ảnh.
  - Thư mục lưu trữ: `public/images/handbook/defects/`.
  - Quy tắc đặt tên: `<defect-id>-failed.webp` và `<defect-id>-fixed.webp`.
- **Yêu cầu text mô tả (`alt`):** Tối thiểu 15 ký tự, mô tả trực tiếp chi tiết in và khuyết tật quan sát được. **Cấm** bắt đầu bằng các từ "ảnh", "hình", "photo", "image" (tuân thủ test tự động Phase 53).

---

## 2. Danh mục 8 lỗi in & Kịch bản in chụp mẫu

### 01. `bed-adhesion` (Lớp đầu không bám bàn)
- **Mô hình in:** *First Layer Calibration Sheet* (tấm phẳng 1 lớp 80 × 80 × 0.2 mm hoặc 5 hình vuông tại 4 góc và tâm bàn in).
- **Vật liệu:** PLA màu cam hoặc xanh dương đậm (dễ nhìn rõ tương phản trên bàn PEI đen).
- **Cài đặt gây lỗi (*failed*):** Bàn in bẩn có vân tay dầu mỡ, Z-offset nâng cao hơn chuẩn +0.25 mm, tắt nhiệt bàn (hoặc để 35 °C).
  - *Hiện tượng:* Sợi nhựa lớp đầu tròn vo, không ép dẹt, bị đầu phun kéo lê thành búi hoặc bung góc hoàn toàn.
- **Cài đặt khắc phục (*fixed*):** Rửa bàn in bằng nước rửa chén, lau khô; cân bàn tự động và chỉnh Z-offset ép dẹt nhẹ 0.20 mm; nhiệt bàn 60 °C, tốc độ lớp đầu 25 mm/s.
  - *Hiện tượng:* Các đường nhựa dẹt đều, dính chặt liền mạch, bề mặt nhẵn mịn không có khe hở.
- **Góc chụp:** Góc nghiêng 30° từ trên nhìn xuống mặt bàn in PEI.
- **Tên file:**
  - `public/images/handbook/defects/bed-adhesion-failed.webp`
  - `public/images/handbook/defects/bed-adhesion-fixed.webp`
- **Bản nháp text `alt`:**
  - *failed:* `"Lớp nhựa đầu tiên bị bong mép, sợi nhựa tròn không dính vào mặt bàn in PEI"` (73 ký tự)
  - *fixed:* `"Lớp nhựa đầu tiên ép dẹt đều đặn, phủ kín bề mặt và dính chặt vào bàn in"` (74 ký tự)

---

### 02. `warping` (Cong vênh góc)
- **Mô hình in:** *Warping Test Bar* (thanh hộp chữ nhật dài 120 × 25 × 20 mm đáy phẳng, góc vuông 90°).
- **Vật liệu:** ABS hoặc PETG màu xám.
- **Cài đặt gây lỗi (*failed*):** Mở toang cửa buồng in / bật quạt gió phòng hướng vào máy, quạt làm mát 80%, nhiệt bàn 70 °C (thiếu nhiệt), không có brim.
  - *Hiện tượng:* Hai đầu góc của thanh hộp bị co ngót uốn cong vểnh lên 3–5 mm khỏi mặt bàn, đáy bị cong vênh hình thuyền.
- **Cài đặt khắc phục (*fixed*):** Đóng kín cửa buồng in giữ nhiệt 45–50 °C, nhiệt bàn 100 °C (với ABS) hoặc 85 °C (PETG), quạt làm mát 10%, thêm brim 5 mm bọc quanh mép.
  - *Hiện tượng:* Đáy chi tiết phẳng lì 180°, góc vuông tiếp xúc khít 100% với mặt bàn.
- **Góc chụp:** Góc ngang mặt bàn (eye-level góc 15°) để thấy rõ khe hở giữa đáy mẫu in và mặt bàn.
- **Tên file:**
  - `public/images/handbook/defects/warping-failed.webp`
  - `public/images/handbook/defects/warping-fixed.webp`
- **Bản nháp text `alt`:**
  - *failed:* `"Góc đáy chi tiết in ABS bị co ngót uốn cong nhấc bổng khỏi mặt bàn in"` (68 ký tự)
  - *fixed:* `"Đáy chi tiết in phẳng tuyệt đối và bám chặt khít sát vào mặt bàn in"` (66 ký tự)

---

### 03. `stringing` (Kéo tơ / Mạng nhện)
- **Mô hình in:** *Stringing Test 2-Tower* (mô hình 2 trụ côn cách nhau 30 mm).
- **Vật liệu:** PETG hoặc PLA ẩm (để ngoài phòng ẩm 3 ngày).
- **Cài đặt gây lỗi (*failed*):** Nhiệt đầu phun 245 °C (quá cao cho PLA) hoặc dùng cuộn PETG ẩm, tắt rút nhựa (retraction distance = 0 mm), tắt Z-hop.
  - *Hiện tượng:* Hàng chục sợi tơ nhựa dày đặc giăng mắc giữa 2 trụ như mạng nhện, kèm hạt nhựa thừa bám quanh thân trụ.
- **Cài đặt khắc phục (*fixed*):** Nhựa sấy khô ở 65 °C trong 6 giờ; nhiệt đầu phun 225 °C; bật rút nhựa 0.8 mm (direct drive) tốc độ 40 mm/s; bật *wipe while retracting*.
  - *Hiện tượng:* Khoảng trống giữa 2 trụ sạch bong, thân trụ nhẵn bóng không có sợi tơ nào.
- **Góc chụp:** Góc chụp chính diện ngang 90° lấy nét vào khoảng không gian giữa 2 đỉnh trụ.
- **Tên file:**
  - `public/images/handbook/defects/stringing-failed.webp`
  - `public/images/handbook/defects/stringing-fixed.webp`
- **Bản nháp text `alt`:**
  - *failed:* `"Mạng nhện sợi tơ nhựa dày đặc giăng kín khoảng trống giữa hai trụ tháp"` (69 ký tự)
  - *fixed:* `"Hai trụ tháp in nhẵn mịn, sạch sẽ và không có bất kỳ sợi tơ nhựa thừa nào"` (74 ký tự)

---

### 04. `under-extrusion` (Thiếu nhựa / Tắc đầu phun)
- **Mô hình in:** *Calibration Cube 20 mm* tiêu chuẩn.
- **Vật liệu:** PLA màu xám hoặc bạc (nhìn rõ rãnh vách).
- **Cài đặt gây lỗi (*failed*):** Giảm tỷ lệ đùn *Flow ratio* xuống 70% (hoặc nhiệt đầu phun quá thấp 170 °C làm trượt bánh răng đùn).
  - *Hiện tượng:* Vách chi tiết xốp như tổ ong, có các đường rãnh hở ngắt quãng giữa các lớp, nắp trên thủng lỗ chỗ, bóp nhẹ bị vỡ vụn.
- **Cài đặt khắc phục (*fixed*):** Flow ratio chuẩn 98–100%, nhiệt đầu phun 210 °C, làm sạch đầu phun bằng phương pháp cold pull.
  - *Hiện tượng:* Vách nhựa liền khối chắc chắn, các lớp liên kết đặc khít, mặt trên đùn kín hoàn toàn.
- **Góc chụp:** Góc chụp 45° cận cảnh (macro) thấy được cả vách bên và mặt nắp trên của khối lập phương.
- **Tên file:**
  - `public/images/handbook/defects/under-extrusion-failed.webp`
  - `public/images/handbook/defects/under-extrusion-fixed.webp`
- **Bản nháp text `alt`:**
  - *failed:* `"Bề mặt vách khối lập phương bị thiếu nhựa xuất hiện nhiều khe hở xốp rỗng"` (74 ký tự)
  - *fixed:* `"Vách khối lập phương đùn nhựa đầy đặn, các lớp gắn kết chắc chắn liền mạch"` (75 ký tự)

---

### 05. `layer-shift` (Lệch lớp)
- **Mô hình in:** *Calibration Cube 20 mm* hoặc *Stepped Pyramid* (hình kim tự tháp giật cấp).
- **Vật liệu:** PLA màu nổi bật (xanh lá hoặc đỏ).
- **Cài đặt gây lỗi (*failed*):** Nới lỏng dây đai trục X hoặc chỉnh gia tốc di chuyển lên 15.000 mm/s² trên máy cơ khí thường gây trượt bước động cơ tại tầng Z = 10 mm.
  - *Hiện tượng:* Nửa trên của khối lập phương bị xô lệch hẳn sang một bên 2 mm, tạo thành bậc thang sắc cạnh.
- **Cài đặt khắc phục (*fixed*):** Tăng dây đai vừa căng (độ võng đàn hồi tốt), siết chặt ốc puly động cơ, đặt gia tốc an toàn 3.000–5.000 mm/s².
  - *Hiện tượng:* Toàn bộ khối hộp thẳng đứng tăm tắp từ đáy lên đỉnh.
- **Góc chụp:** Góc nhìn nghiêng 45° cận cảnh vị trí bậc thang bị xô lệch.
- **Tên file:**
  - `public/images/handbook/defects/layer-shift-failed.webp`
  - `public/images/handbook/defects/layer-shift-fixed.webp`
- **Bản nháp text `alt`:**
  - *failed:* `"Khối in bị trượt lệch lớp tạo thành bậc thang gồ ghề tại vị trí giữa thân"` (73 ký tự)
  - *fixed:* `"Khối in thẳng đứng đều đặn từ chân đến đỉnh không có dấu hiệu lệch lớp"` (70 ký tự)

---

### 06. `elephant-foot` (Chân voi)
- **Mô hình in:** *Calibration Cube 20 mm* (đo kiểm tra kích thước đáy).
- **Vật liệu:** PLA hoặc PETG.
- **Cài đặt gây lỗi (*failed*):** Z-offset ép quá sâu (-0.15 mm), nhiệt bàn in 75 °C duy trì liên tục cho PLA, tắt tính năng bù chân voi.
  - *Hiện tượng:* 1–2 mm đầu tiên ở đáy bị phình to bè ra xung quanh, gờ cạnh sắc nhô ra ngoài kích thước thiết kế.
- **Cài đặt khắc phục (*fixed*):** Z-offset chuẩn; hạ nhiệt bàn về 55–60 °C sau lớp đầu; bật *Elephant foot compensation* = 0.15 mm trong slicer.
  - *Hiện tượng:* Cạnh đáy thẳng đứng vuông góc 90° với mặt bàn, không có vành loe phình ra ngoài.
- **Góc chụp:** Chụp macro sát chân đáy của khối lập phương, đặt cạnh một thước kẹp điện tử hiển thị số.
- **Tên file:**
  - `public/images/handbook/defects/elephant-foot-failed.webp`
  - `public/images/handbook/defects/elephant-foot-fixed.webp`
- **Bản nháp text `alt`:**
  - *failed:* `"Chân đế mô hình in bị ép loe phình to ra xung quanh tạo thành viền gờ sắc"` (75 ký tự)
  - *fixed:* `"Cạnh chân đáy mô hình thẳng góc vuông vức và không có gờ nhựa phình rộng"` (72 ký tự)

---

### 07. `z-banding` (Gợn sóng theo tầng / Sọc lớp)
- **Mô hình in:** *Tall Thin Wall Cylinder* hoặc *20 × 20 × 60 mm Tall Tower* (tháp trụ cao).
- **Vật liệu:** PLA bóng hoặc tơ lụa (silk PLA - bắt sáng cực nhạy với vân sọc).
- **Cài đặt gây lỗi (*failed*):** Trục vít me Z bị khô dầu bám bụi kim loại, khớp nối trục Z bị cong lệch tâm, hoặc nhiệt độ đầu phun dao động biên độ ±5 °C (chưa chạy PID tuning).
  - *Hiện tượng:* Trên bề mặt thân trụ xuất hiện các đường sọc lồi lõm nằm ngang lặp đi lặp lại theo chu kỳ bước ren 8 mm.
- **Cài đặt khắc phục (*fixed*):** Vệ sinh sạch ren vít me Z và bôi mỡ PTFE; cân chỉnh khớp nối trục mềm; chạy cân chỉnh PID cho hotend giữ nhiệt độ dao động ≤ 0.5 °C; chọn layer height là bội số bước ren (0.20 mm).
  - *Hiện tượng:* Bề mặt thành trụ phẳng mịn đồng nhất, ánh sáng phản chiếu thẳng đều không bị gợn sóng ngang.
- **Góc chụp:** Ánh sáng bên (raking light / grazing light góc 15°) quét dọc theo chiều cao thân tháp để làm nổi vân gợn.
- **Tên file:**
  - `public/images/handbook/defects/z-banding-failed.webp`
  - `public/images/handbook/defects/z-banding-fixed.webp`
- **Bản nháp text `alt`:**
  - *failed:* `"Bề mặt vách đứng xuất hiện các đường gợn sóng lồi lõm lặp lại theo chiều dọc"` (76 ký tự)
  - *fixed:* `"Vách đứng của chi tiết láng mịn đồng đều, không còn sọc gợn ngang theo trục Z"` (77 ký tự)

---

### 08. `pillowing` (Nổi nốt sần / Rách nóc)
- **Mô hình in:** *Top Surface Test Tile* (khối hộp dẹt 40 × 40 × 10 mm với diện tích mặt phẳng nóc rộng).
- **Vật liệu:** PLA hoặc PETG.
- **Cài đặt gây lỗi (*failed*):** Mật độ infill lưới thưa (5–8% grid infill ô rất to), chỉ đặt 2 lớp nắp trên (*top solid layers = 2*), tắt quạt làm mát lớp nóc.
  - *Hiện tượng:* Mặt nóc bị phồng rộp nhấp nhô như chiếc gối, thủng các lỗ rách lộ rõ khoảng trống ô infill bên trong.
- **Cài đặt khắc phục (*fixed*):** Tăng số lớp mặt trên lên 5–6 lớp (độ dày nóc ≥ 1.0 mm); tăng infill lên 15–20% kiểu Gyroid; bật quạt làm mát 100% khi in cầu nối và lớp nóc.
  - *Hiện tượng:* Mặt trên cùng phẳng lì, các đường nhựa đan khít kín kẽ, không có vết phồng rộp hay lỗ thủng nào.
- **Góc chụp:** Góc nghiêng 45° từ trên nhìn xuống diện tích bề mặt nóc.
- **Tên file:**
  - `public/images/handbook/defects/pillowing-failed.webp`
  - `public/images/handbook/defects/pillowing-fixed.webp`
- **Bản nháp text `alt`:**
  - *failed:* `"Mặt phẳng nóc trên cùng bị phồng rộp lồi lõm và thủng lỗ lộ khung xương infill"` (77 ký tự)
  - *fixed:* `"Bề mặt nóc trên cùng được đùn phẳng mịn, phủ kín hoàn toàn và không tì vết"` (74 ký tự)

---

## 3. Quy trình bàn giao & Kích hoạt trên web

1. Thợ in xưởng BaSa3D in 8 cặp mẫu theo thông số cài đặt ở trên.
2. Setup studio chụp ảnh theo đúng thông số góc máy và đèn cố định.
3. Xuất file ảnh WebP đúng kích thước 1600 × 1200 px, dung lượng ≤ 180 KB vào thư mục:
   `public/images/handbook/defects/<defect-id>-failed.webp` và `...-fixed.webp`.
4. Sau khi file ảnh đã có trong thư mục `public`, tiến hành thêm trường `photos` tương ứng vào từng đối tượng trong `src/data/handbook/troubleshooting.ts`.
5. Chạy `npm test` để kiểm tra tự động tỷ lệ ảnh, kích thước và text `alt`.
