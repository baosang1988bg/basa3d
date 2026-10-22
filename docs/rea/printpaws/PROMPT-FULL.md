# Prompt full luồng: /tools/pet-bowl-stand (lát 0 → MVP)

Điền khối OWNER INPUT trước khi dán. Ô nào bỏ trống thì Claude sẽ dùng giá trị tạm, gắn nhãn `CHƯA ĐO`,
và tính năng vẫn tắt bằng feature flag cho tới khi owner điền đủ.

```text
Đọc AGENTS.md, CLAUDE.md, docs/exec-plans/active/phase-47-printpaws-rea.md (BLOCKERS/IMPORTANT/Unknowns),
docs/architecture/decisions.md (ADR mới nhất: ADR-0049), PHASE_START_PROTOCOL.md.
Phase 47 được duyệt là tài liệu khảo sát. Giờ làm full luồng: lát 0 (quyết định) → /speckit-auto (MVP).

=== OWNER INPUT (số đo thật của BaSa3D, KHÔNG lấy số của Print Paws) ===
Bát inox định bán (mỗi cỡ 1 dòng): tên | Ø miệng ngoài | Ø vành/gờ | Ø thân dưới gờ | độ sâu | dung tích
- <cỡ S>: ...
- <cỡ M>: ...
Dung sai lỗ ôm bát mong muốn (mm): <...>
Công thức chiều cao giá: <vd. chiều cao vai × hệ số k, k = ...; min/max ...>
Nội dung cảnh báo GDV (VI/EN): <...>
Máy in mặc định (tên profile trong src/lib/pricing/printer-profiles.ts): <...>
=== HẾT OWNER INPUT ===

QUY TẮC CHUNG
- Không bịa số đo hay business rule. Ô nào trong OWNER INPUT còn trống thì dùng giá trị tạm trong 1 file constants,
  gắn comment `// CHƯA ĐO — xem ADR-00xx`, liệt kê trong exec-plan, và để NEXT_PUBLIC_PET_BOWL_ENABLED=false.
- Không dùng tên, mẫu, asset, công thức 0,30/0,35 hay cỡ lỗ 116/174 của Print Paws.
- Không push, không deploy, không đặt đơn thật trên trang tham khảo. Không mở lại REA trong luồng này.

LÁT 0 — quyết định + hạ tầng (làm trước, commit local riêng)
1. ADR-0050 "Pet bowl stand: kích thước bát, dung sai, công thức chiều cao, độ ổn định, cảnh báo GDV"
   từ OWNER INPUT. Độ ổn định: tỉ lệ đáy/chiều cao tối thiểu + kiểm tra trọng tâm khi bát đầy (ghi giả định).
2. ADR-0051 "3mf-writer: tuỳ chọn ghi Metadata/model_settings.config + gán extruder".
   Mở rộng src/lib/3d-tools/common/3mf-writer.ts bằng option mặc định TẮT; output của 7 tool cũ phải giữ nguyên
   byte-for-byte. Thêm test snapshot cho từng tool cũ trước khi sửa, rồi test cho chế độ mới.
3. .gitignore: thêm docs/rea/*/evidence/.
4. Helper text dùng chung src/lib/3d-tools/common/: chuẩn hoá NFC, đếm grapheme (Intl.Segmenter),
   phát hiện glyph thiếu trong font, đo độ dài chữ theo cung còn trống. Unit test với tiếng Việt, emoji, khoảng trắng.
5. Chạy typecheck/lint/test. Dừng, báo kết quả lát 0 cho owner (GATE A).

SAU KHI OWNER DUYỆT GATE A → chạy:
/speckit-auto Công cụ thiết kế giá bát ăn thú cưng /tools/pet-bowl-stand, MVP thu gọn theo phase 47:
- Engine thuần TS trong src/lib/3d-tools/pet-bowl-stand/ (constants đọc từ ADR-0050), manifold-3d trong Web Worker
  như organizer, preview three.js, text opentype.js + helper ở bước 4.
- Hình: thân trụ hoặc nón; đường nối 2 màu: thẳng + 1 kiểu sóng do BaSa3D tự thiết kế; 1 hoặc 2 bát;
  tên bé theo cung. Chỉ bản AMS 2 màu (export 3MF dùng option mới của writer + STL zip, tên file slug theo tên bé).
- Kiểm tra in: kích thước bàn in lấy từ profile mặc định trong printer-profiles.ts (không hard-code),
  overhang ≤ 45°, thành tối thiểu, độ ổn định theo ADR-0050. Chặn khi vành < lỗ.
- UI: cảnh báo GDV luôn hiện; trạng thái empty/loading/error theo .agents/skills/ui-ux; mobile-first; VI/EN qua messages/;
  GA4 tool_pet_bowl_*; báo giá qua /api/public/tool-price-estimate (giữ tính giá ở server) + nút Custom Request.
- Giá: ghi rõ trong exec-plan là chỉ PLA 1 màu, chưa tính hao nhựa đổi màu; để TODO hiệu chỉnh bằng 1 lần slice thật.
- Feature flag NEXT_PUBLIC_PET_BOWL_ENABLED (mặc định false, thêm vào .env.example).
- Test: unit engine (biên chiều cao, cỡ bát, tên), 3MF hợp lệ (số object, extruder, bbox), e2e/pet-bowl-stand.spec.ts.
- Ngoài phạm vi (ghi vào backlog): bản không AMS lồng 2 nửa (cần in thử), nghiêng mặt bát, tai/chân/mặt mèo,
  rãnh chống kiến, phối ngẫu nhiên + hoàn tác, lưu thiết kế trên máy, U-3 (payload thanh toán).

Kết thúc: cập nhật docs/exec-plans/active/feature-NNN-*.md, docs/roadmap.md, CHANGELOG.md; liệt kê mọi giá trị
còn `CHƯA ĐO`; review theo BLOCKERS / IMPORTANT / NICE TO HAVE / RECOMMENDATION.
```
