# Prompt Claude — Review thiết kế MakerWorld Profile Verification & Instant Quote trước khi code

Copy toàn bộ nội dung bên dưới vào Claude để thực hiện architectural & security review:

---

Bạn là Lead Architect & Security Reviewer của dự án BaSa3D (`AGENTS.md`). 
Owner và team đang chuẩn bị triển khai tính năng: **MakerWorld Print Profile Verification & Instant Quote Flow** (kế thừa và mở rộng Phase 13).

Hãy thực hiện review độc lập, chỉ ra các rủi ro (blockers, security risks, data-integrity issues, edge cases) và đề xuất điều chỉnh cụ thể. **Chưa viết code ứng dụng, chưa tạo migration.**

## 1. Đọc trước các tài liệu và mã nguồn liên quan

1. `AGENTS.md`, `PHASE_START_PROTOCOL.md`.
2. `docs/exec-plans/completed/phase-13.md` (Design gốc của MakerWorld Fast Quoting, SSRF guardrails và Public Quote).
3. `docs/exec-plans/active/makerworld-profile-verification-and-instant-quote.md` (Kế hoạch thực thi chi tiết).
4. `src/lib/parsers/makerworld-resolver.ts` (Resolver hiện tại, SSRF manual redirect check, timeout).
5. `src/components/admin/makerworld-quote-panel.tsx` (Panel tính giá MakerWorld hiện tại).
6. `src/services/quote.service.ts` (`QuoteModelSnapshot`, `createQuote`).
7. `src/domain/schemas.ts` (`quoteModelSnapshotSchema` có `.strict()`).
8. `src/services/pricing.service.ts` (`computePricingBreakdown`, ADR-0010 rounding rule).

## 2. Bối cảnh & Vấn đề thực tế

- **Hiện trạng MakerWorld**: Một model 3D (vd: *Frankenstein's Monster* `3246150`) có nhiều Print Profiles / Print Files khác nhau do designer hoặc cộng đồng đóng góp. Cụ thể profile `3678340` dành cho máy Bambu Lab P1S/P2S chỉ tiêu thụ **170g net nhựa** và in trong **7.5 giờ (6 plates)** với tên file in riêng là `"0.2mm layer, 2 walls, 15% infill"` và ảnh chụp sản phẩm riêng có logo `"NO AMS"`. Trong khi đó, profile khác có thể nặng 285g hoặc chia số plate khác.
- **Hạn chế của code hiện tại**:
  1. `makerworld-resolver.ts` chỉ lấy profile đầu tiên hoặc profile theo URL hash, bỏ qua danh sách các profile khác.
  2. Chưa lấy `title` và `coverImageUrl` riêng của instance, mà chỉ lấy tiêu đề và ảnh bìa chung của cả bài đăng model.
  3. UI chưa có dropdown chọn profile và chưa có Card trực quan để Staff/User đối chiếu đúng ảnh và title trước khi tính giá.
  4. Chưa có cờ/bước xác nhận `profileVerified` trước khi chốt quote.

## 3. Các câu hỏi Claude cần trả lời & đánh giá

### Q1. Rủi ro An ninh & SSRF (Security Review)
- Resolver hiện dùng hostname allowlist `*.makerworld.com` và `redirect: 'manual'`. Khi mở rộng bóc tách nhiều `instances` và cho phép fallback nhập link ảnh thumbnail, có nguy cơ SSRF hay Image Injection không? URL ảnh thumbnail cần sanitize/allowlist như thế nào khi hiển thị qua `next/image`?
- Khi mở tính năng check giá từ link MakerWorld ra ngoài Storefront (`/custom-print`) cho khách dùng tự do: Làm sao ngăn chặn lạm dụng cào dữ liệu (Rate limit, IP throttling, DTO isolation để không lộ cấu trúc chi phí/margin của xưởng theo tiền lệ Phase 13)?

### Q2. Data Integrity & Schema Immutability (ADR-0022)
- `QuoteModelSnapshot` được lưu vào cột `quotes.model_snapshot` (JSONB) và validate qua `quoteModelSnapshotSchema` với cờ `.strict()`. Khi thêm các trường mới (`profileId`, `profileTitle`, `profileCoverImageUrl`, `printerTarget`, `netWeightGrams`, `profileVerified`), có nguy cơ làm gãy các Quote cũ đã có trong DB không?
- Khi đổi giữa các profile trên UI (vd từ profile 285g sang profile 170g), state của `materialLines`, `wastePreset` và `laborMinutes` cần được reset/tái đồng bộ ra sao để tránh tính nhầm giá?

### Q3. Trải nghiệm xác nhận (Verification UX) & Xử lý lỗi Cloudflare 403
- Khi MakerWorld trả về 403 (Cloudflare challenge), luồng Fallback nhập tay cần thiết kế như thế nào để vừa nhanh (<15 giây) vừa đảm bảo đủ dữ liệu để sinh Card đối chiếu và tính giá chuẩn xác?
- Bước xác nhận `"✓ Đã xác nhận đúng profile yêu cầu"` nên là soft gate (cảnh báo) hay hard gate (chặn submit) ở phía Admin và phía Storefront?

### Q4. Báo giá 2 mức (Bản Hoàn thiện vs Bản Kit rời)
- Với mô hình in No-AMS nhiều part cần dán ráp keo như Frankenstein 24cm, đề xuất cấu trúc Quote lưu cả 2 phương án giá (Ráp sẵn: công 45-60p vs Kit tự ráp: công 20p) vào hệ thống báo giá như thế nào là tinh gọn nhất mà không làm vỡ schema của Quote?

## 4. Định dạng phản hồi yêu cầu

1. Đánh giá kiến trúc tổng thể (Phù hợp / Cần sửa).
2. Danh sách Blockers hoặc Rủi ro bảo mật nghiêm trọng (nếu có).
3. Đề xuất kỹ thuật cụ thể cho từng câu hỏi Q1 - Q4.
4. Phạm vi file và check-list chỉnh sửa khuyến nghị cho implementer.
