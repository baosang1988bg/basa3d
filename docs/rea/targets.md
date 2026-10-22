# REA — danh sách tool tham khảo

Owner xác nhận được chủ trang cho phép phân tích (2026-10-21). Quy tắc và cách chạy xem `README.md`.

| # | Tool | URL gốc | Phase BaSa3D | Khảo sát REA | Kết quả |
|---|---|---|---|---|---|
| 0 | Trang tổng (hub) → app desktop **Flex Hub** v0.2.24 | https://landing.vunguyenhoanglong06031992.workers.dev/flex-hub/ | 19, 21, 45 | **Đã khảo sát tĩnh** (REA + trích asset Tauri, 2026-10-21) | `docs/research/flex-hub-tools.md` |
| 1 | Flex Keychain | https://flex-keychain.vunguyenhoanglong06031992.workers.dev/ | 21 | **Đã quan sát qua Chrome (C-xx)**; REA (R-xx) chờ chạy trên Mac | `docs/exec-plans/active/phase-46-keychain-rea.md` |
| 2 | Flex Dual Text | https://flex-dual-text.vunguyenhoanglong06031992.workers.dev/ | 22 | Chưa | — |
| 3 | Flex Organizer | https://flex-organizer.vunguyenhoanglong06031992.workers.dev/ | 19, 20 (+45 parity) | Chưa | — |
| 4 | Flex Car | https://flex-car.vunguyenhoanglong06031992.workers.dev/ | 23 | Chưa | — |
| 5 | Flex Lamp | https://flex-lamp.vunguyenhoanglong06031992.workers.dev/ | 24 | Chưa | — |
| 6 | Hinge Box Studio | https://hinge-box-studio.vunguyenhoanglong06031992.workers.dev/ | 25 | Chưa | — |
| 7 | Jigsaw Studio | https://jigsaw-studio.vunguyenhoanglong06031992.workers.dev/ | 26 | Chưa | — |
| 8 | Print Paws: giá bát ăn thú cưng (chủ trang khác: mam3d) | https://printpaws.mam3d.workers.dev/ | 47 | **Đã khảo sát** (REA R-01/R-02 + Playwright C-xx, 2026-10-22; 3 mẫu wave / paws / cat-paws) | `docs/exec-plans/active/phase-47-printpaws-rea.md` |

Ghi chú #8: chủ Print Paws chia sẻ link trực tiếp cho owner; owner xác nhận được phép quan sát hành vi ngày 2026-10-22.
Phạm vi giống các dòng trên: chỉ quan sát hành vi, không lưu hay commit bundle/asset/mẫu của trang, không đặt đơn thật.

**Thứ tự đề xuất:** Keychain → Dual Text → Organizer (dễ đối chiếu với engine sẵn có) → Car → Lamp →
Hinge Box → Jigsaw → Hub.

Lưu ý riêng:
- **Hinge Box Studio** có "Mẫu đã khoá": chỉ quan sát preset đang mở, không tìm cách mở khoá.
- **Jigsaw Studio** cần một mô hình upload: dùng file mẫu do BaSa3D tự tạo, không dùng file của bên thứ ba.
- **Flex Lamp** có chế độ "chọn 1 lần, không đổi được": mỗi chế độ là một kịch bản riêng, chạy từ trạng thái mới.

## Checklist mỗi tool
- [ ] Tạo `docs/rea/<tool>/scenario.json` và `scripts/rea/run-<tool>.sh` (copy từ flex-keychain, đổi URL/actions)
- [ ] Liệt kê control, default, min/max; thử input biên (rỗng, quá dài, ký tự lạ, tiếng Việt)
- [ ] Chạy thao tác chính + mọi nút export; ghi network
- [ ] Đọc cấu trúc file export: tên file, số object/mesh, màu, kích thước bbox
- [ ] Đối chiếu route BaSa3D tương ứng (`/tools/...`)
- [ ] Ghi `docs/exec-plans/active/phase-NN-<tool>-rea.md` (Observations / Inferences / Unknowns + Evidence ID), cập nhật bảng trên

## Prompt mẫu (Claude Code, trong thư mục BaSa3D)
```text
Dùng REA (capture_browser_scenario) quan sát hành vi của <URL>
- Liệt kê toàn bộ control, giá trị mặc định, ràng buộc min/max.
- Thao tác: <thao tác chính>, bấm tất cả nút export.
- Ghi network request, cấu trúc file export (tên file, số mesh, metadata màu).
Không tải về hay sao chép mã nguồn/asset của trang.
Đối chiếu với /tools/<route> của BaSa3D và ghi kết quả vào
docs/exec-plans/active/phase-NN-<tool>-rea.md theo dạng
Observations / Inferences / Unknowns + Evidence ID. Cập nhật docs/rea/targets.md.
```
