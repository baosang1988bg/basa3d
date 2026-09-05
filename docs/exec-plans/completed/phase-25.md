# Phase 25 — Hinge Box Studio: Hộp có bản lề liền khối (in phẳng)

> **Mục đích**: Tool #6 trong thứ tự ưu tiên đã chốt ở Phase 19. Khách nhập kích thước hộp (rộng/
> sâu/cao) + cấu hình vách ngăn (hàng/cột, tái dùng kỹ thuật lưới của Organizer) → 1 file in ra hộp
> có nắp gắn liền bằng bản lề mỏng (living hinge), in phẳng 1 lần không cần lắp ráp thêm.

Owner yêu cầu làm nhanh toàn bộ roadmap còn lại — Claude tự review, không có vòng Gemini Challenge
riêng. **Đây là 1 trong 2 tool rủi ro cao nhất còn lại** (Phase 19 mục 2 xếp hạng "Cao" — rủi ro vật
lý, không chỉ code): bản lề mỏng in sai dung sai có thể gãy/không gập được. Không có máy in 3D thật
trong môi trường triển khai để kiểm chứng — xem Risks mục 5, đây là known limitation chấp nhận được
kế thừa đúng tinh thần Phase 20/21 (rủi ro tồn đọng ghi rõ, không chặn merge).

---

## 1. Khảo sát trực tiếp trang tham khảo (2026-09-05)

`https://hinge-box-studio.vunguyenhoanglong06031992.workers.dev/` (Playwright, tương tác thật,
"Mẫu đã khoá" — chỉ 1 preset hộp mở khoá được):

- **Kích thước**: Rộng/Sâu/Cao khi đóng (mm), mặc định 100×65.5×35.
- **Vách ngăn**: Hàng × Cột (mặc định 1×1, tức không chia ngăn) + Độ dày (mặc định 1.6mm) — **y hệt
  tham số Organizer** (Phase 20), chỉ khác là vách nằm trong 1 hộp có nắp thay vì khay hở.
- **Tên & logo**: mục riêng (không mở ra xem chi tiết được vì bấm vào không expand thêm nội dung
  quan sát được qua DOM tĩnh) — suy luận là khắc chữ/logo nổi lên nắp hộp.
- **Xuất bản in**: "3MF giữ nắp, đáy và vách ngăn thành các phần riêng" — xác nhận 3MF xuất ra
  KHÔNG gộp thành 1 mesh, mỗi phần (nắp/đáy/vách) là 1 `<object>` riêng.
- 2 nút toggle: **"Phẳng để in"** (mặc định, layout nắp+đáy nằm phẳng cạnh nhau nối bằng bản lề,
  đúng tư thế đặt lên bàn in) và **"Xem lắp ráp"** (mô phỏng gập bản lề đóng lại — xem ảnh chụp: 2
  vỏ mở ra như đang gập dở, với 1 chốt nhỏ nhô lên ở giữa cạnh nối).
- Chỉ báo "Bản lề & chốt được bảo toàn" (validate hình học bản lề/chốt hợp lệ, không tự vỡ khi tính
  toán) — không rõ tiêu chí chính xác qua DOM tĩnh.

---

## 2. Rà soát hiện trạng có thể tái dùng & Quyết định kiến trúc

### 2.1 Vách ngăn — Tái dùng nguyên lý Organizer (Phase 20), không viết lại
`organizer-engine.ts`'s epsilon-overlap grid-wall technique áp dụng y hệt cho vách ngăn bên trong
đáy hộp — chỉ khác là bao ngoài là 1 vỏ hộp có nắp thay vì khay hở. Viết hàm riêng
`buildDividerWalls(...)` trong `hinge-box-engine.ts` (không import chéo từ `organizer-engine.ts` —
giữ mỗi tool 1 file engine độc lập theo đúng quy ước Phase 19 mục 4.1) nhưng **thuật toán giống hệt
đã kiểm chứng** (epsilon 0.2mm, `mergeGeometries`).

### 2.2 Bản lề liền khối (Living Hinge) — Chốt: hằng số dựa trên thực hành phổ biến, CHƯA verify in thật
- Dùng mẫu "living hinge" phổ biến nhất cho FDM PLA: 1 dải mỏng nối 2 vỏ, độ dày
  `HINGE_THICKNESS_MM = 0.8mm` (khoảng an toàn thường dùng 0.6-1.0mm cho PLA lớp 0.2mm, đủ mỏng để
  gập nhưng không quá mỏng để đứt khi in) — **đây là hằng số suy ra từ thực hành chung của cộng
  đồng in 3D, không phải số đo từ trang tham khảo (không lộ qua DOM) và chưa được kiểm chứng bằng
  in thật trong phase này**.
- Bản lề gồm nhiều dải song song ngắn (không phải 1 dải liền dài suốt cạnh) để giảm ứng suất tập
  trung — `HINGE_SEGMENT_COUNT` tỉ lệ theo chiều rộng hộp.
- In **phẳng**: đáy hộp và nắp hộp nằm cùng mặt phẳng (Z=0), nối nhau bằng dải bản lề, đúng tư thế
  layout trang tham khảo — không cần xoay/support thêm.

### 2.3 Chốt cài (Latch) — Chốt: đơn giản hoá thành 1 khối gờ nhỏ nhô lên, KHÔNG làm khớp cài đàn hồi thật
Trang tham khảo có "chốt" giữ nắp đóng — cơ chế đàn hồi (snap-fit) chính xác cần dung sai in rất
chặt (giống lý do Phase 21 loại bỏ chế độ `Physical` switch-socket). V1 chỉ làm 1 gờ nhô nhỏ + 1 hõm
tương ứng (ma sát nhẹ giữ nắp, không phải khớp cài bật/tách rõ ràng) — ghi rõ trong Non-goals, không
cam kết "chốt giữ chắc chắn" như tên gọi trang tham khảo ngụ ý.

### 2.4 "Tên & logo" — Cắt khỏi v1 (Non-goal)
Giảm phạm vi để giữ đúng tinh thần "small vertical slices" — khắc chữ nổi lên nắp có thể thêm sau
bằng cách tái dùng kỹ thuật font-to-path đã có (Phase 17/21/22/23), không phải rủi ro kỹ thuật mới,
chỉ là cắt để giao đúng phần lõi (hộp + bản lề + vách ngăn) trước.

### 2.5 "Xem lắp ráp" (mô phỏng gập) — Cắt khỏi v1 (Non-goal)
Chỉ hiện **layout phẳng để in** trong preview (đúng tư thế xuất file) — không làm animation gập
bản lề 3D (phức tạp thêm, không ảnh hưởng file xuất ra, thuần UI polish).

---

## 3. Goal & Non-goals

### Goal
1. Khách nhập rộng/sâu/cao (mm) + cấu hình vách ngăn hàng×cột + độ dày vách → preview 3D layout
   phẳng (đáy+nắp nối bản lề) ngay trên trình duyệt.
2. Xuất 3MF (đáy/nắp/vách ngăn là các object riêng, không gộp) hoặc STL (gộp 1 mesh).
3. Giá ước tính + Custom Request flow + GA4 (`tool_hinge_box_preview`,
   `tool_hinge_box_export_download`, `tool_hinge_box_export_to_request`).

### Non-goals
- **Không khắc "Tên & logo"** (mục 2.4).
- **Không mô phỏng "Xem lắp ráp"** (mục 2.5) — chỉ xem layout phẳng.
- **Không làm khớp cài (snap-fit) thật** — chỉ 1 gờ ma sát nhẹ (mục 2.3), không đảm bảo giữ chắc.
- **Không verify bản lề bằng in thật** — hằng số suy ra từ thực hành chung, chưa in thử trong môi
  trường này (không có máy in). Rủi ro tồn đọng, ghi rõ trong Risks, giống Phase 20's lỗ hổng
  chưa-in-thử.

---

## 4. Rủi ro

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| **Bản lề gãy/không gập được khi in thật** | Cao, **chưa verify** | Dùng hằng số phổ biến trong cộng đồng in 3D (0.8mm, nhiều dải ngắn); Owner cần in thử trước khi cam kết với khách hàng thật — accepted risk, giống known limitation của Phase 20. |
| **Chốt không giữ chắc** | Trung bình, chấp nhận | Ghi rõ chỉ là "gờ ma sát nhẹ", không quảng bá là khớp cài bật/tách chắc chắn. |
| **Vách ngăn** | Thấp | Thuật toán đã kiểm chứng từ Organizer (Phase 20), chỉ đổi ngữ cảnh áp dụng. |

---

## 5. Checklist

- [x] Khảo sát trực tiếp trang tham khảo bằng Playwright (mục 1).
- [x] Claude self-review.
- [x] Implement: `src/lib/3d-tools/hinge-box/{hinge-box-constants,hinge-box-engine}.ts` (đáy/nắp/
      bản lề/chốt là các mesh riêng, không CSG), workbench/canvas/page tại
      `src/app/[locale]/(tools)/tools/hinge-box/`, GA4 (`trackHingeBox*`). Phát hiện & sửa 1 lỗi
      hình học thật khi implement: `rotateX(-π/2)` làm lệch dấu trục sâu (z) giữa vỏ hộp và đáy,
      khiến 2 phần không chồng khớp — đổi sang `rotateX(+π/2)` kèm dịch chuyển bù trừ; cũng chuẩn
      hoá toàn bộ `mergeGeometries` qua 1 helper `safeMerge` (ép non-indexed nhất quán) sau khi
      phát hiện lỗi "geometries must have compatible attributes" khi trộn `ExtrudeGeometry` với
      `BoxGeometry` trực tiếp.
- [x] Tests: `tests/hinge-box-engine.test.ts` (4 test), `tests/hinge-box-analytics.test.ts`,
      `e2e/hinge-box.spec.ts`.
- [x] `npm test` (213 passed), `npm run typecheck`, `npm run lint`, `npm run build` đều pass, route
      `/tools/hinge-box` lên đúng cả 2 locale. Playwright E2E `e2e/hinge-box.spec.ts` pass.
