# Phase 49 — MakerWorld China Support & 3MF Quick-Download Helper

Kế thừa Phase 13 (`makerworld-resolver.ts`), `makerworld-profile-verification` (Phase A) và tiếp thu kiến trúc từ công cụ `mwc.3dhubvn.net`.

Giải quyết bài toán: Nhiều mô hình 3D độc đáo, chất lượng cao nằm trên nền tảng **MakerWorld China** (`makerworld.com.cn` / `makerworld.cn`), nhưng MakerWorld chặn tải file với người dùng quốc tế (yêu cầu số điện thoại / tài khoản nội địa Trung Quốc) và hệ thống BaSa3D hiện tại đang chặn hostname này (chỉ cho phép `makerworld.com`).

Phase 49 triển khai theo **Phương án C**:
1. **Web BaSa3D:** Mở rộng bộ phân giải (Resolver) & bộ lọc ảnh để nhận diện link MakerWorld China, bóc tách thông số in (thời gian, số plate, khối lượng gram, máy in, AMS/No-AMS) và tạo báo giá minh bạch (Snapshot v2).
2. **Tiện ích tải 3MF xưởng in:** Cung cấp nút cầu nối (Download Bridge) dẫn trực tiếp sang công cụ hỗ trợ `mwc.3dhubvn.net/makerworld-cn` để Owner/Staff tải file `.3mf` trực tiếp về máy in mà **không tải qua Vercel Serverless** (tránh nghẽn băng thông và lỗi 504 Gateway Timeout).

---

## 1. Hợp đồng Phase (Phase Contract)

### Mục tiêu (Goals)
1. **Multi-domain Hostname Support:** `parseMakerWorldUrl` và `resolveMakerWorldUrl` chấp nhận các domain MakerWorld hợp lệ:
   - `makerworld.com`
   - `makerworld.com.cn`
   - `makerworld.cn`
   và các subdomain hợp lệ của chúng (ví dụ: `image.makerworld.com`, `api.makerworld.com.cn`...).
2. **CDN Image Allowlist:** Mở rộng `makerworld-image.ts` thêm các host CDN hình ảnh chính thức của MakerWorld China:
   - `makerworld.bblmw.cn`
   - `public-cdn.bblmw.cn`
   - `public-cdn.bblmw.com`
   - `makerworld.com.cn`
   - `makerworld.cn`
3. **Admin 3MF Quick-Download Bridge:** Trong `MakerWorldQuotePanel` (`src/components/admin/makerworld-quote-panel.tsx`):
   - Nhận diện khi link là MakerWorld China (hoặc MakerWorld chung).
   - Thêm nút tiện ích *"Mở công cụ tải file 3MF (3DHubVN)"* mở tab mới đến `https://mwc.3dhubvn.net/makerworld-cn` (kèm copy link hoặc hướng dẫn) để Staff/Owner lấy file in ngay lập tức.
4. **Zod Boundary Schema Parity:** Cập nhật thông điệp và validation trong `src/domain/schemas.ts` (`makerWorldSourceUrlSchema`) để chấp nhận cả URL MakerWorld China.
5. **Unit Test Coverage:** Viết đầy đủ unit test cho URL parsing, image sanitization và SSRF protection với các domain mới.

### Giới hạn (Non-goals)
- Không kéo luồng tải file `.3mf` binary nặng (10MB–100MB) truyền qua serverless BaSa3D/Vercel (chặn rủi ro 504 Timeout, hết dung lượng memory 4.5MB và cạn Fast Data Transfer).
- Không tự động đăng nhập hoặc bypass captcha/số điện thoại Trung Quốc bằng proxy bot trên server BaSa3D.
- Không tự động niêm yết bán thương mại công khai các model có giấy phép cấm thương mại (tuân thủ Phase 29 Copyright Compliance).

### Đầu vào (Inputs)
- Link mẫu từ MakerWorld China: `https://makerworld.com.cn/zh/models/12345#profileId-67890` hoặc `https://makerworld.cn/zh/models/12345`.
- Công cụ tải model cộng đồng: `https://mwc.3dhubvn.net/makerworld-cn`.

### Đầu ra (Outputs)
- Bộ bóc tách thông số `makerworld-resolver.ts` hỗ trợ MakerWorld China.
- Báo giá tự động trong Admin cho link Trung Quốc như link Global.
- Nút mở nhanh công cụ tải 3MF tại panel báo giá.
- Quyết định kiến trúc **ADR-0052** trong `docs/architecture/decisions.md`.

### Rủi ro & Cách kiểm soát (Risks & Mitigations)
1. **Rủi ro Cloudflare Block từ MakerWorld CN:** Trang MakerWorld China có thể chặn datacenter IP của Vercel (403/503).
   * *Kiểm soát:* Tái sử dụng 100% cơ chế Fallback nhập tay (`parseMakerWorldSpecText`) đã có sẵn từ Phase A.
2. **Rủi ro SSRF qua Domain mở rộng:**
   * *Kiểm soát:* Khung allowlist kiểm tra hostname đuôi chính xác (`.makerworld.com`, `.makerworld.com.cn`, `.makerworld.cn`), không dùng wildcard lỏng lẻo. Giữ nguyên manual redirect inspection hop-by-hop.
3. **Rủi ro Image Injection (B2):**
   * *Kiểm soát:* Chỉ thêm các host CDN chính xác của Bambu Lab (`bblmw.cn`, `bblmw.com`), không cho phép wildcard shared storage (`aliyuncs.com`).

### Định nghĩa hoàn thành (Definition of Done)
- [x] Tất cả checklist Lát 1 → Lát 4 đều được đánh dấu `[x]`.
- [x] `npx tsx --test tests/phase-13-makerworld-resolver.test.ts` và test mới đều PASS.
- [x] `npm run typecheck` và `npm run lint` không có lỗi.
- [x] Đã thêm ADR-0052 vào `docs/architecture/decisions.md` và cập nhật `docs/roadmap.md`.

---

## 2. Các lát triển khai (Vertical Slices)

### Lát 1: Mở rộng Core Resolver, Image Sanitizer & Domain Schemas
- [x] `src/lib/parsers/makerworld-resolver.ts`:
  - Mở rộng `ALLOWED_HOST_SUFFIXES = ['makerworld.com', 'makerworld.com.cn', 'makerworld.cn'] as const`.
  - Cập nhật hàm `isAllowedHostname(hostname: string): boolean` kiểm tra khớp với bất kỳ suffix nào trong danh sách.
  - Cập nhật thông báo lỗi trong `MakerWorldNotFoundError`: "Chỉ chấp nhận link từ makerworld.com, makerworld.com.cn hoặc makerworld.cn (https)."
- [x] `src/lib/parsers/makerworld-image.ts`:
  - Bổ sung vào `EXACT_HOSTS`: `'makerworld.bblmw.cn'`, `'public-cdn.bblmw.cn'`, `'public-cdn.bblmw.com'`, `'makerworld.com.cn'`, `'makerworld.cn'`.
- [x] `src/domain/schemas.ts`:
  - Cập nhật thông điệp lỗi trong `makerWorldSourceUrlSchema` cho phù hợp: "sourceUrl must be an https MakerWorld model URL (makerworld.com / .com.cn / .cn)."
- [x] Tests (`tests/phase-13-makerworld-resolver.test.ts` hoặc test bổ sung):
  - Test chấp nhận link `makerworld.com.cn` và `makerworld.cn`.
  - Test trích xuất đúng `modelId` và `profileId` từ link China.
  - Test từ chối domain giả mạo như `evil-makerworld.cn` hoặc `makerworld.cn.attacker.com`.
  - Test `sanitizeMakerWorldImageUrl` chấp nhận ảnh từ `makerworld.bblmw.cn` và `public-cdn.bblmw.cn`.

### Lát 2: Admin Quote Panel UI & 3MF Quick-Download Helper
- [x] `src/components/admin/makerworld-quote-panel.tsx`:
  - Cập nhật placeholder URL input: `placeholder="https://makerworld.com/... hoặc makerworld.com.cn/..."`
  - Thêm helper nhận diện domain Trung Quốc: `const isChinaUrl = /makerworld\.(com\.)?cn/i.test(url)`.
  - Thêm nút tiện ích / banner trực quan cạnh ô nhập link:
    - Khi có URL MakerWorld: Hiện nút liên kết phụ trợ *"Mở công cụ tải 3MF (3DHubVN)"* (icon `ExternalLink`), bấm vào mở `https://mwc.3dhubvn.net/makerworld-cn` ở tab mới để nhân viên/xưởng tải nhanh file in.
    - Kèm tooltip hoặc ghi chú nhỏ: *"MakerWorld CN yêu cầu tài khoản nội địa để tải file. Dùng công cụ 3DHubVN để tải nhanh file 3MF về xưởng in."*

### Lát 3: Tương thích Storefront Intake & Public Estimate
- [x] `src/app/api/public/makerworld-estimate/route.ts`:
  - Cập nhật message lỗi 400: "Link không hợp lệ — vui lòng dán link dạng https://makerworld.com/... hoặc https://makerworld.com.cn/..."
- [x] `src/components/storefront/makerworld-intake-card.tsx`:
  - Kiểm tra placeholder và regex trên giao diện khách hàng để đảm bảo chấp nhận link MakerWorld China đồng bộ với Admin.
- [x] **Trang công cụ công khai cho User (`/tools/makerworld-cn`):**
  - Route: `src/app/[locale]/(storefront)/tools/makerworld-cn/page.tsx` & component `src/components/storefront/makerworld-cn-tool.tsx`.
  - API Resolve công khai: `POST /api/public/makerworld-cn/resolve`:
    - **Region Routing (Khắc phục xung đột ID):** Dựa vào hostname để phân luồng chính xác:
      - Link Quốc tế (`makerworld.com`): Gọi API Bambu Lab Global `api.bambulab.com/v1/design-service/design/{id}`.
      - Link Trung Quốc (`makerworld.com.cn` / `makerworld.cn`): Gọi API Bambu Lab China `api.bambulab.cn/v1/design-service/design/{id}`, kết hợp dự phòng `3DHubVN`.
      - Ngăn chặn hoàn toàn việc nhầm lẫn giữa 2 hệ thống ID độc lập (ví dụ ID 2851863 bên quốc tế là Ace Snail Stand, bên Trung Quốc là Thìa thực phẩm).
    - Làm sạch link từ văn bản chia sẻ của app (`cleanMakerWorldUrlInput`).
  - API Download 3MF công khai: `POST /api/public/makerworld-cn/download` (tải file .3mf trực tiếp).
  - Nút dán từ Clipboard tiện lợi (`handlePasteClipboard`).
  - **Trình xem 3D trực tiếp (Issue 3):** Modal xem trước 3D tương tác (`src/components/storefront/makerworld-3d-modal.tsx`) sử dụng `threeMfToPositions` trích xuất toạ độ đỉnh từ file 3MF, hiển thị xoay 360°, phóng to thu nhỏ và đo đạc kích thước mm 3 trục.
  - Cập nhật danh mục công cụ `/tools` trong `messages/vi.json`, `messages/en.json` và `tools/page.tsx`.

### Lát 4: Quyết định kiến trúc & Đóng Phase
- [x] Viết **ADR-0052** vào `docs/architecture/decisions.md`: "MakerWorld China support & external 3MF download bridge".
- [x] Cập nhật `docs/roadmap.md` ghi nhận Phase 49.
- [x] Chạy kiểm tra chất lượng:
  - `npm run typecheck`
  - `npm run lint`
  - Chạy unit test bộ parser.

### Lát 5: Báo giá in tức thì (Instant Quote) trên MakerWorld China Tool
- [x] `src/services/makerworld-cn-pricing.service.ts` & `src/app/api/public/makerworld-cn/resolve/route.ts`:
  - Mở rộng DTO `MakerWorldCnProfile` với trường `estimatedPriceVnd: number | null` và `priceTiers: { assembledVnd: number | null; kitVnd: number | null } | null`.
  - Tích hợp `loadPricingContext` và `estimateFromSpec` từ `@/services/instant-estimate.service` để tính giá server-side cho từng profile dựa trên gram nhựa, thời gian in, số plate và loại nhựa.
  - Tuân thủ ADR-0033: Chỉ trả về giá đã làm tròn (5.000đ), không trả về breakdown chi phí hay margin ra ngoài client.
- [x] `src/components/storefront/makerworld-cn-tool.tsx` & `makerworld-3d-modal.tsx`:
  - Hiển thị badge giá nổi bật trên từng thẻ Profile: `💰 Giá in ước tính: ~XX.000đ` (kèm chú thích theo tier nếu là multi-plate).
  - Cập nhật nút CTA đặt in: `Đặt xưởng BaSa3D in bàn này (~XX.000đ)` với icon `Printer` nổi bật.
  - Hiển thị tổng quan giá in trên Model Summary Card (`Giá in từ: ~XX.000đ`).
  - Truyền giá ước tính vào Modal xem 3D trên nút "Đặt in BaSa3D".
- [x] Tests & Verification:
  - Viết test trong `tests/phase-49-makerworld-cn-pricing.test.ts` kiểm tra logic tính giá cho profile MakerWorld China (2/2 PASS).
  - Chạy `npm run typecheck` (0 errors), `npm run lint` (0 errors) và unit test suite (24/24 PASS).

