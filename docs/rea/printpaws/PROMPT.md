# Print Paws → Pet Bowl Stand tool: prompt cho Claude Code

Trang tham khảo: https://printpaws.mam3d.workers.dev/ (chủ trang: mam3d / Print Paws, **khác** chủ các trang Flex trong `targets.md`).

## Bước 0: owner tự làm trước khi chạy prompt
- [x] Xin phép chủ Print Paws: chủ trang chia sẻ link trực tiếp, owner xác nhận ngày 2026-10-22.
- [x] Thêm dòng #8 "Print Paws" vào `docs/rea/targets.md`.
- [ ] Chưa có phép → **bỏ Prompt 1**, chỉ chạy Prompt 2 dựa trên mô tả công khai trên trang chủ (không REA, không chặn blob export).

---

## Prompt 1: khảo sát bằng REA (phase 47, chỉ khảo sát, không sửa code)

```text
Đọc AGENTS.md, docs/rea/README.md, docs/rea/targets.md, docs/exec-plans/active/phase-46-keychain-rea.md (làm khuôn mẫu).
Owner đã xác nhận chủ Print Paws cho phép phân tích hành vi ngày 2026-10-22 (chủ trang chia sẻ link trực tiếp; đã có dòng #8 trong targets.md).

Mục tiêu: dùng REA (capture_browser_scenario) quan sát công cụ thiết kế giá bát ăn thú cưng tại
https://printpaws.mam3d.workers.dev/app?p=bowl-stand-wave
để chuẩn bị tính năng /tools/pet-bowl-stand cho BaSa3D.

1. Tạo docs/rea/printpaws/scenario.json và scripts/rea/run-printpaws.sh (copy từ flex-keychain, đổi URL/actions).
   Nếu sandbox bị chặn *.workers.dev thì dùng Claude in Chrome (Evidence C-xx) và để R-xx chờ chạy trên Mac.
2. Khảo sát 3 mẫu đại diện: bowl-stand-wave (2 màu, AMS/không AMS), bowl-stand-paws (khoét xuyên thành, cần AMS),
   bowl-stand-cat-paws (chân + tai, in không support). Với mỗi mẫu:
   - Liệt kê mọi control, default, min/max, đơn vị: đường kính/cỡ bát inox, chiều cao (chiều cao vai thú cưng →
     chiều cao giá theo công thức nào?), loài chó/mèo, kiểu đường nối, màu, tên, icon/hình dán, nút xúc xắc (seed).
   - Thử input biên cho tên: rỗng, 1 ký tự, rất dài, tiếng Việt có dấu (ĐẠT, Bông Gòn), emoji, khoảng trắng.
   - Bấm mọi nút export/thêm giỏ; ghi network (API nào, có gửi tên/thiết kế lên server không, analytics).
   - Đọc cấu trúc file export trong bộ nhớ trình duyệt (không lưu ra đĩa): tên file, số object/mesh, màu,
     bbox, phiên bản AMS vs không AMS khác nhau thế nào, xếp sẵn trên bàn in hay toạ độ lắp ráp.
   - Ghi lại luồng đặt hàng: giỏ → thông tin → mã đơn tra cứu (chỉ quan sát UI, KHÔNG đặt đơn thật).
3. Đối chiếu với engine BaSa3D gần nhất: src/lib/3d-tools/lamp-shade (thân tròn xoay), organizer
   (manifold-3d trong Web Worker), keychain-blocks + common/3mf-writer.ts (text + 3MF nhiều màu),
   và luồng báo giá /api/public/tool-price-estimate + Custom Request.

Quy tắc:
- Chỉ quan sát hành vi. Không tải/commit JS bundle, STL, ảnh preview, font hay tên mẫu của trang.
- Không sao chép 24 mẫu của họ; chỉ rút ra tham số kỹ thuật (cỡ bát, công thức chiều cao, dung sai, ràng buộc in).
- Không sao chép bug của trang; ghi vào Inferences.

Đầu ra: docs/exec-plans/active/phase-47-printpaws-rea.md theo dạng Observations / Inferences / Unknowns
+ Evidence ID (C-xx, R-xx, B-xx), mục "Đề xuất lát cắt" cho MVP, và cập nhật docs/rea/targets.md.
Kết thúc bằng review theo format BLOCKERS / IMPORTANT / NICE TO HAVE / RECOMMENDATION. Chưa sửa code.
```

---

## Prompt 2: làm tính năng (sau khi owner duyệt phase 47)

```text
/speckit-auto Thêm công cụ thiết kế giá bát ăn thú cưng tại /tools/pet-bowl-stand.

Nguồn: docs/exec-plans/active/phase-47-printpaws-rea.md (nếu có), AGENTS.md, docs/database/business-rules.md.
Kiến trúc theo mẫu (tools) hiện có: engine thuần TS trong src/lib/3d-tools/pet-bowl-stand/
(constants + engine, test được không cần DOM), geometry bằng manifold-3d trong Web Worker như organizer,
preview three.js, text bằng opentype.js, export qua common/3mf-writer.ts.

MVP:
- Input: loài (chó/mèo), chiều cao vai (cm) → chiều cao giá theo công thức ghi trong ADR; đường kính bát inox
  (danh sách cỡ phổ biến + tuỳ chỉnh, dung sai lỗ ôm bát); 1 hoặc 2 bát; tên bé (hỗ trợ tiếng Việt đầy đủ,
  đếm theo grapheme, giới hạn rõ ràng có thông báo lỗi); 2 màu; 3–4 kiểu trang trí do BaSa3D tự thiết kế
  (không trùng mẫu Print Paws).
- Kiểm tra in: vừa bàn in máy mặc định, góc overhang ≤ 45° (không cần support), độ dày thành tối thiểu,
  cảnh báo khi cần AMS.
- Export: 3MF nhiều màu + STL zip, tên file theo tên bé (đã slug hoá), bản AMS và không AMS.
- Báo giá qua /api/public/tool-price-estimate, nút gửi Custom Request; VI/EN qua messages/; GA4 event tool_pet_bowl_*.
- Trạng thái UI: empty/loading/error theo .agents/skills/ui-ux; mobile-first.

Test: unit cho engine (biên chiều cao/cỡ bát/tên), test 3MF hợp lệ (số object, màu, bbox), e2e/pet-bowl-stand.spec.ts.
Ghi ADR cho công thức chiều cao + dung sai bát (giả định thì ghi rõ, không tự bịa business rule).
Không push, không deploy. Dừng ở 2 gate cho owner duyệt.
```
