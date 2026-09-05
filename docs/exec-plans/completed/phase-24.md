# Phase 24 — Flex Lamp: Chụp đèn hoa văn (ống trụ đục lỗ)

> **Mục đích**: Tool #5 trong thứ tự ưu tiên đã chốt ở Phase 19. Khách chọn kiểu hoa văn (lỗ tròn/
> lục giác/khe dọc/kim cương/sóng) + số lượng quanh vòng/hàng/kích thước ô → 1 ống trụ chụp đèn có
> hoa văn đục lỗ, lắp vừa đế bóng đèn (bộ kit ngoài, không tự in).

Owner yêu cầu làm nhanh toàn bộ roadmap còn lại — Claude tự review, không có vòng Gemini Challenge
riêng.

---

## 1. Khảo sát trực tiếp trang tham khảo (2026-09-05)

`https://flex-lamp.vunguyenhoanglong06031992.workers.dev/` (Playwright, tương tác thật):

- Trang có **2 chế độ cố định chọn 1 lần** ("Cố định cho dự án — không thể đổi về sau"):
  1. **Chụp đèn**: ống chụp có hoa văn, lắp vừa đế socket (bộ kit ngoài, "MH001").
  2. **Mô hình**: nhập mô hình 3D tuỳ ý, khoét lỗ, hàn vào socket — độ phức tạp ngang Jigsaw Studio
     (mesh tuỳ ý + boolean), **không làm ở v1** (mục 3 Non-goals).
- Chế độ **Chụp đèn**: `HOA VĂN` — Kiểu (`Hình tròn`/`Lục giác`/`Khe dọc`/`Kim cương`/`Sóng`),
  `Quanh vòng` (18), `Hàng` (9), `Kích thước ô` (12.0mm), `Xoay` (0°). `KẾT QUẢ` hiện số tam giác/
  thể tích/thời gian tính (tự cập nhật khi chỉnh, debounce). `VẬT LIỆU`: chọn sợi nhựa (PLA/PETG/
  ABS) + màu — **chỉ mang tính mô tả/tham khảo**, không đổi hình học. `XUẤT STL` / `Xuất 3MF`.
- Ảnh chụp xác nhận: 1 ống trụ hở 2 đầu, hoa văn là các lỗ tròn xuyên thành ống, xếp lưới đều theo
  chu vi × chiều cao, đặt trên 1 đế đen (linh kiện kit thật, không phải phần in).

---

## 2. Rà soát hiện trạng có thể tái dùng & Quyết định kiến trúc

### 2.1 Không cần CSG — Chốt kỹ thuật "bẻ cong tấm phẳng thành ống trụ" (Vertex Remap)
Thay vì khoét N×M lỗ bằng CSG subtract (chậm, rủi ro hiệu năng với 18×9=162 lỗ, đúng lo ngại hiệu
năng CSG mà Phase 19 mục 4.2 đã cảnh báo cho Jigsaw), dùng kỹ thuật tiêu chuẩn trong CAD tham số:
1. Dựng 1 `THREE.Shape` **phẳng** hình chữ nhật (rộng = chu vi, cao = chiều cao ống), khoét lỗ bằng
   `shape.holes.push(...)` cho từng ô trong lưới (tái dùng kỹ thuật 2D-Path-Hole, Phase 17) — mỗi
   kiểu hoa văn là 1 hàm dựng 1 hole-path khác nhau (tròn = `absarc`, lục giác/kim cương = polygon
   6/4 cạnh, khe dọc = hình chữ nhật bo tròn thon dài, sóng = hình elip thon dài — đơn giản hoá,
   không phải sóng hình sin chính xác như trang gốc, ghi rõ trong Non-goals).
2. Extrude tấm phẳng theo độ dày thành ống (`WALL_THICKNESS_MM`).
3. **Bẻ cong quanh trục Y**: map từng đỉnh `(x, y, z)` → góc `θ = x / R`, toạ độ mới
   `((R+z)·cosθ, y, (R+z)·sinθ)` với `R = chu vi / (2π)`. Đây là phép biến đổi đỉnh thuần tuý
   (không CSG), nhanh, không rủi ro hiệu năng dù lưới dày.
- **Hệ quả chấp nhận**: đường nối 0°/360° (chỗ 2 mép tấm phẳng gặp nhau) có thể không khớp hoàn hảo
  nếu chu vi không chia hết đẹp cho `Quanh vòng × Kích thước ô` — chấp nhận là giới hạn thẩm mỹ nhỏ
  (v1), không phải lỗi kỹ thuật.

### 2.2 Kích thước ống — Chốt suy ra từ tham số lưới (không nhập trực tiếp đường kính/chiều cao)
- Chu vi = `Quanh vòng × Kích thước ô` → bán kính `R = chu vi / (2π)`.
- Chiều cao = `Hàng × Kích thước ô`.
- Đúng hành vi trang tham khảo (chỉnh "Quanh vòng"/"Kích thước ô" đổi đường kính tổng thể).

### 2.3 Đế socket (kit MH001) — Chưa xác nhận được kích thước thật, dùng hằng số mặc định cần Owner xác nhận
Đế là linh kiện kit mua sẵn, **không tự in** — bài toán duy nhất là đường kính TRONG của ống chụp
phải khớp đường kính NGOÀI của đế kit thật. Không tra được thông số kỹ thuật chính xác của "MH001"
qua khảo sát DOM. Chốt: thêm hằng số `SOCKET_MIN_INNER_DIAMETER_MM` (mặc định 60mm, cỡ phổ biến đế
đèn/nến) làm giới hạn dưới cho bán kính tính từ lưới — validate và cảnh báo rõ trên UI nếu bán kính
tính ra nhỏ hơn mức này, **không chặn xuất file** (khách có thể có kit khác). Cần Owner đo/xác nhận
kích thước kit thật trước khi quảng bá tool này khớp chính xác "bộ kit MH001" cụ thể.

### 2.4 "Xoay" — Chốt: offset góc bắt đầu toàn cục (đơn giản hoá)
Không làm so le từng hàng kiểu gạch xây (brick offset) — chỉ 1 offset góc áp dụng cho toàn bộ lưới
trước khi bẻ cong. Đơn giản hơn nhưng vẫn cho khách xoay hoa văn để giấu đường nối 0°/360° ra chỗ
khuất (vd ra sau, chỗ dây điện).

---

## 3. Goal & Non-goals

### Goal
1. Khách chọn kiểu hoa văn (5 kiểu), chỉnh quanh vòng/hàng/kích thước ô/góc xoay, xem preview 3D
   ống chụp đèn có lỗ ngay trên trình duyệt.
2. Hiển thị số liệu tam giác/thể tích (giống "KẾT QUẢ" tham khảo) — tận dụng `mesh-estimator.ts`
   có sẵn thay vì tự tính lại.
3. Chọn màu (không có lựa chọn vật liệu PLA/PETG/ABS dạng dropdown riêng — quy về `requestedMaterial`
   text field có sẵn của Custom Request, không thêm cột/enum mới).
4. Xuất STL/3MF, ước tính giá, Custom Request flow, GA4 (`tool_lamp_preview`,
   `tool_lamp_export_download`, `tool_lamp_export_to_request`).

### Non-goals
- **Không làm chế độ "Mô hình"** (import mesh tuỳ ý + khoét lỗ hàn socket) — độ phức tạp ngang
  Jigsaw Studio (tool #7, chưa tới lượt), để dành phase riêng.
- **Không mô phỏng hoa văn "Sóng" dạng sin chính xác** — dùng hình elip thon dài đơn giản hoá thay
  thế, ghi rõ khác biệt thẩm mỹ so với trang tham khảo.
- **Không đảm bảo khớp chính xác đế kit "MH001" thật** — kích thước là tham số điều chỉnh được,
  chưa xác nhận thông số phần cứng thật (mục 2.3), Owner cần đo/xác nhận trước khi cam kết với
  khách "vừa khít bộ kit MH001".
- **Không làm đế/chân đèn, không làm hệ thống dây điện/đui đèn** — chỉ phần ống chụp in được.

---

## 4. Rủi ro

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| **Không khớp đế kit thật** | Trung bình, chấp nhận | Xem mục 2.3 — cảnh báo UI, không chặn xuất file, cần Owner xác nhận sau. |
| **Đường nối 0°/360° không khớp hoàn hảo** | Thấp | Chấp nhận giới hạn thẩm mỹ v1 (mục 2.1), khách xoay hoa văn để giấu đường nối. |
| **Lỗ chồng lấn khi Kích thước ô nhỏ/hoa văn lớn** | Trung bình | Giới hạn `MAX cells` tương tự Organizer (constants), validate hole không tràn ra ngoài ô lưới. |

---

## 5. Checklist

- [x] Khảo sát trực tiếp trang tham khảo bằng Playwright, tương tác đủ để thấy preview 3D thật có
      hoa văn (mục 1).
- [x] Claude self-review.
- [x] Implement: `src/lib/3d-tools/lamp-shade/{lamp-shade-constants,lamp-shade-engine}.ts` (kỹ
      thuật bẻ cong tấm phẳng thành ống — mục 2.1, không dùng CSG), workbench/canvas/page tại
      `src/app/[locale]/(tools)/tools/lamp-shade/`, GA4 (`trackLamp*`).
- [x] Tests: `tests/lamp-shade-engine.test.ts` (5 test, cả 5 kiểu hoa văn), 
      `tests/lamp-shade-analytics.test.ts`, `e2e/lamp-shade.spec.ts`.
- [x] `npm test` (208 passed — 1 lần chạy trước đó fail do lỗi DNS mạng tạm thời tới Supabase
      pooler, không liên quan code, xác nhận lại pass 100%), `npm run typecheck`, `npm run lint`,
      `npm run build` đều pass, route `/tools/lamp-shade` lên đúng cả 2 locale.
- [x] Playwright E2E `e2e/lamp-shade.spec.ts` pass.
