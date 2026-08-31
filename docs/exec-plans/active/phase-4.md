# Phase 4 — Public Storefront (UI/UX foundation + pages)

Theo `docs/roadmap.md`: Phase 4 là "public storefront". Chi tiết scope tham
khảo `3d-printing-website-development-plan.md` PHASE 4 (dòng 1236+, Sprint
4.1–4.5). Cart/checkout thuộc Phase 5, custom print production thuộc Phase 6.

## Goal
Website công khai (storefront) đủ tốt để giới thiệu thương hiệu và bán sản
phẩm có sẵn, dùng một design system nhất quán về mặt thương hiệu với admin
(Phase 3) nhưng thể hiện khác nhau theo ngữ cảnh sử dụng.

## Non-goals
- Cart/checkout/order thật — Phase 5.
- Payment gateway — Phase 5+.
- Production/print job workflow — Phase 6.
- SEO/content/blog — Phase 7.
- Upload file thật (binary) cho custom request — MVP chỉ nhận **link**
  (Google Drive/Dropbox/ảnh online), không dựng hạ tầng Supabase Storage cho
  người dùng công khai (ẩn danh) ở Phase 4. Xem quyết định #3.
- CAPTCHA (Cloudflare Turnstile hay tương đương) cho form custom-request —
  để dành cho phase sau nếu honeypot + rate-limit ở quyết định #3 không đủ
  chặn spam thực tế. Không xây trước khi có bằng chứng cần thiết.

## Quyết định đã chốt

1. **Design system — hybrid, 2 sắc thái dùng chung 1 bộ token gốc** (chốt qua
   brainstorming + skill `ui-ux-pro-max`, và review challenge 2026-08-31):
   - Nguồn gốc: skill `ui-ux-pro-max` kết hợp kết quả review challenge:
     - Tránh dùng full Claymorphism (tránh rủi ro accessibility, tải chậm trên
       mobile, cảm giác đồ chơi mềm/play-dough làm giảm độ tin cậy của chi tiết
       in 3D kỹ thuật/chính xác).
     - Áp dụng phong cách **Tactile Neo-Craft (Modern Maker Aesthetic)** cho
       Storefront.
   - **Bảng màu gốc (Dual-mode contrast calibrated):**
     - **Light Mode:**
       - Primary: Teal/Xanh ngọc rêu `#0F766E` (gợi nhớ bảng cắt kỹ thuật, tone
         màu vững chãi cho maker studio).
       - Accent/CTA: Cam đất/Terracotta `#D97706` (gợi nhớ màu filament/craft,
         text trắng đảm bảo tương phản ≥ 4.5:1).
       - Nền & Card: Off-white `#FAFAFA` / `#FFFFFF` với border slate nhẹ
         `#E2E8F0`.
     - **Dark Mode:**
       - Nền canvas: Deep Slate `#090D10` / `#111827` (sắc slate lạnh tinh tế,
         tránh đen kịt).
       - Card: `#1E293B` / `#18222F` với viền `rgba(255, 255, 255, 0.08)` để
         ảnh sản phẩm nhựa đen/tối không bị chìm.
       - Primary: Mint Teal `#2DD4BF` (sáng rõ, contrast > 9:1 trên nền tối).
       - Accent/CTA: Luminous Amber-Orange `#F59E0B` / `#FB923C` (dùng foreground
         dark `#0F172A` cho nút bấm).
   - **Storefront (Khách hàng) — phong cách Tactile Neo-Craft:**
     - Bo góc tiêu chuẩn: `rounded-xl` (12–16px), viền sắc nét 1px–1.5px.
     - Hiệu ứng vật lý (tactile cues): Đổ bóng khối nhẹ 2px (`shadow-[3px_3px_0px_0px_rgba(...)]`)
       chỉ dành riêng cho CTA chính và badge vật liệu (PLA, PETG, Resin),
       tránh đổ bóng phồng toàn bộ trang.
     - Nền thẻ hiển thị trung tính, sạch sẽ để tôn ảnh chụp thực tế mô hình in
       3D (đường layer lines, độ hoàn thiện bề mặt).
     - Rủi ro a11y thấp, tương thích 100% với các component nguyên bản của
       shadcn/ui.
   - **Admin (Nội bộ, OWNER + STAFF) — Token-only alignment trong Phase 4:**
     - Trong Phase 4: Chỉ áp dụng token màu và font chữ mới qua CSS variables
       (`globals.css`). Không đập đi làm lại layout/DOM để tránh rủi ro
       regression trên 7 bộ test của Phase 3.
     - Đợt làm lại giao diện chuyên sâu (densification, tối ưu hóa thao tác mật
       độ cao) sẽ được thực hiện tại **Phase 8 (Operations & Polish)** sau khi
       hệ thống đã vận hành đơn hàng thực tế.

2. **Scope trang chi tiết cho Storefront (Sprint 4.1–4.5)** (chốt qua brainstorming 2026-08-31):
   - **Sprint 4.1 — Foundation & Global Layout:**
     - `Header` / `Navbar`: Logo BaSa3D, nav links (Trang chủ `/`, Sản phẩm `/products`, Đặt in `/custom-print`, Bảng giá & Vật liệu `#materials`), nút Zalo / Hotline tư vấn nhanh, Theme toggle (Light/Dark), icon giỏ hàng (placeholder chuẩn bị cho Phase 5), mobile drawer navigation.
     - `Footer`: Thông tin xưởng BaSa3D, địa chỉ, hotline/Zalo, cam kết chất lượng & bảo mật file in 3D, chính sách đổi trả, liên kết trang admin.
     - `Common Primitives`: `Button` (Primary Terracotta `shadow-tactile`, Primary Brand Teal, Secondary), `ProductCard` (tỷ lệ 1:1, badge trạng thái tồn kho, format tiền VND), `MaterialBadge` (PLA/PETG/ABS/Resin/TPU), `SpecTable` (thông số layer height, infill %, kích thước, khối lượng), `SectionHeader`.
   - **Sprint 4.2 — Homepage (`/`):**
     - `Hero Section`: Headline "Hiện Thực Hóa Mọi Ý Tưởng Với Công Nghệ In 3D Chuẩn Xác", Subhead giới thiệu xưởng, Dual CTA ("Gửi file in theo yêu cầu" `/custom-print` + "Khám phá sản phẩm" `/products`), 3 badge cam kết ("In nhanh 24h", "Nhựa nguyên sinh cao cấp", "Báo giá nhanh trong 30p").
     - `Featured Categories`: 4 danh mục chính (Mô hình/Art Toys, Decor bàn làm việc, Phụ kiện tiện ích, Linh kiện kỹ thuật).
     - `Featured Products Grid`: 6–8 sản phẩm tiêu biểu có sẵn từ database (`products` service).
     - `Custom Print Workflow Teaser`: Quy trình 4 bước đơn giản kèm CTA dẫn sang `/custom-print`.
     - `Material Showcase`: So sánh nhanh PLA vs PETG vs Resin.
     - `Testimonials / Cam kết chất lượng`: Đảm bảo độ bền và độ chính xác cơ khí.
   - **Sprint 4.3 — Product Listing (`/products`):**
     - Thanh tìm kiếm sản phẩm theo từ khóa/tên.
     - Bộ lọc bên trái (desktop) hoặc Filter Drawer (mobile): Lọc theo Danh mục, Tình trạng hàng (`READY_STOCK` vs `MADE_TO_ORDER`), Loại vật liệu, Khoảng giá.
     - Sắp xếp: Giá tăng/giảm dần, Mới nhất, Bán chạy.
     - Product Grid responsive (2 cột mobile, 3–4 cột desktop) + Empty state thân thiện (gợi ý gửi in custom nếu không thấy mẫu phù hợp).
   - **Sprint 4.4 — Product Detail (`/products/[slug]`):**
     - Breadcrumbs điều hướng.
     - Gallery ảnh sản phẩm: Ảnh chính tỷ lệ 1:1 + Thumbnail strip.
     - Panel thông tin chính: Tên, SKU, Badge tồn kho, Giá VND làm tròn theo ADR-0010.
     - Variant Selector: Chọn màu sắc (color swatches), chọn kích thước/tỷ lệ scale.
     - Bộ đếm số lượng + Nút "Thêm vào giỏ / Đặt in ngay" (ở Phase 4 mở modal xác nhận thông tin trước khi Phase 5 hoàn thiện).
     - Bảng thông số kỹ thuật in 3D: Vật liệu, Kích thước mm, Độ dày lớp (Layer height), Độ đặc (Infill %), Khối lượng gram.
     - Hướng dẫn bảo quản sản phẩm in 3D & Sản phẩm liên quan (Related Products).
   - **Sprint 4.5 — Custom Printing Landing Page (`/custom-print`):**
     - Hero banner dịch vụ in 3D theo yêu cầu.
     - Quy trình 4 bước chi tiết: Gửi file (`.stl`, `.step`, `.obj`, `.3mf`, ảnh vẽ) -> Tư vấn & Tối ưu -> Báo giá 30p -> In & Giao hàng.
     - Bảng tra cứu vật liệu chi tiết (PLA, PETG, ABS/ASA, TPU dẻo, Resin) theo độ bền, chịu nhiệt, độ mịn, chi phí.
     - **Form gửi yêu cầu in trực tuyến (Custom Request Form)** gọi endpoint
       public mới (xem quyết định #3): Tên, SĐT/Zalo, Email, Vật liệu, Màu
       sắc, Số lượng, Link file/ảnh mẫu (Drive/Dropbox), Ghi chú chi tiết.
       `sourceChannel` **không** phải trường do khách nhập — server luôn ép
       `WEBSITE` (xem quyết định #3), không hiển thị lựa chọn "Kênh liên hệ
       ưu tiên" trên form nữa.

3. **Đường đi dữ liệu cho form custom-request công khai** (chốt qua code
   review 2026-08-31 — giải quyết 3 blocker: endpoint public, thiếu cột lưu
   link đính kèm, chưa có chống spam):
   - **Endpoint riêng, không qua `requireAdmin()`:** `POST
     /api/public/custom-requests` (namespace `api/public/*` mới — mọi route
     không yêu cầu đăng nhập từ giờ nằm trong namespace này để dễ audit sau
     này, `grep -r "api/public"` là ra danh sách đầy đủ). Route
     `POST /api/custom-requests` hiện tại (admin-only, STAFF tự nhập) giữ
     nguyên, không đổi.
   - **Schema Zod riêng cho public** (`publicCustomRequestInputSchema`,
     `src/domain/schemas.ts`): giống `customRequestInputSchema` nhưng **bỏ
     trường `sourceChannel`** khỏi input (client không được set) và **thêm**
     `attachmentUrl: z.string().trim().url().max(2000).nullable().optional()`.
     Route luôn gọi service với `sourceChannel: 'WEBSITE'` cứng — không tin
     giá trị client gửi, cùng nguyên tắc đã áp dụng khi fix `GET
     /api/products` ở Phase 3 addendum (ép `status: 'ACTIVE'` phía server).
   - **Migration mới** (additive, không phá dữ liệu cũ):
     - `alter table custom_requests add column attachment_url text check
       (attachment_url is null or char_length(attachment_url) <= 2000);`
     - `alter type custom_request_source_channel add value 'WEBSITE';`
   - **`actorId` cho submission công khai:** nới kiểu `createCustomRequest(input,
     actorId: string | null)` trong `custom-request.service.ts` — public
     route truyền `null` (`audit_logs.actor_id` đã là cột nullable sẵn,
     không cần đổi schema). Dùng `action: 'CUSTOM_REQUEST_CREATED_PUBLIC'`
     (khác với `'CUSTOM_REQUEST_CREATED'` của luồng admin) để OWNER phân
     biệt được trong audit log request nào khách tự gửi vs. staff tự nhập.
   - **Không fetch/preview `attachmentUrl` phía server** — chỉ lưu làm text
     thô, STAFF tự mở link bằng tay trong admin UI. Tránh rủi ro SSRF từ việc
     server tự động gọi ra một URL do người dùng ẩn danh cung cấp.
   - **Chống spam tối thiểu (MVP, không thêm hạ tầng mới):**
     - Honeypot field ẩn trong form (bot điền vào, người thật thì không) —
       nếu có giá trị thì âm thầm trả `201` giả (không insert DB, không lộ
       cho bot biết bị chặn).
     - Rate-limit bằng cách đếm số `custom_requests` có cùng `customer_phone`
       trong 10 phút gần nhất trước khi insert (query qua `pg.Pool` đã có sẵn,
       không cần Redis/KV mới) — vượt ngưỡng thì trả lỗi thân thiện "vui lòng
       thử lại sau ít phút".
     - CAPTCHA (Turnstile) **không** làm ở Phase 4 (xem Non-goals) — chỉ làm
       nếu 2 biện pháp trên không đủ sau khi launch thật.

## Inputs
- `docs/roadmap.md`, `3d-printing-website-development-plan.md` PHASE 4 (dòng 1236+, Sprint 4.1–4.5), mục 9 (sitemap), mục 10 (blueprint homepage).
- `docs/exec-plans/completed/phase-3.md` — admin UI hiện có.
- `design-system/MASTER.md` — nguồn token chính thức đã sinh.
- Kết quả review và challenge design system (mục "Quyết định đã chốt" #1 ở trên).

## Outputs
- `design-system/MASTER.md` — nguồn token chính thức (đã tạo).
- Cập nhật `tailwind.config.ts` + `src/app/globals.css`: thêm token màu mới (Teal/Terracotta dual-mode) và cấu hình font qua `next/font/google` (`Plus Jakarta Sans` + `Inter`).
- Admin tự động đồng bộ token màu và font qua CSS variables (không sửa DOM layout).
- Components chung cho Storefront (`src/components/storefront/...` hoặc `src/components/...`): Header, Footer, ProductCard, MaterialBadge, SpecTable.
- Migration mới: `custom_requests.attachment_url` (text, nullable) +
  `custom_request_source_channel` thêm giá trị `WEBSITE` (xem quyết định #3).
- `POST /api/public/custom-requests` (route mới, public, kèm honeypot +
  rate-limit theo `customer_phone`) và `publicCustomRequestInputSchema`
  trong `src/domain/schemas.ts`. `createCustomRequest` trong
  `custom-request.service.ts` nhận `actorId: string | null`.
- Public read path cho catalog: hàm service mới (hoặc mở rộng
  `product.service.ts`) chỉ trả sản phẩm `status = 'ACTIVE'`, không bao giờ
  trả `cost_price`, "badge tồn kho" chỉ ở dạng còn hàng/hết hàng — không trả
  số lượng tồn chính xác qua path public (nhắc lại bài học rò rỉ đã fix ở
  Phase 3 addendum).
- Trang Storefront:
  - `src/app/(storefront)/page.tsx` (Homepage)
  - `src/app/(storefront)/products/page.tsx` (Product Listing)
  - `src/app/(storefront)/products/[slug]/page.tsx` (Product Detail)
  - `src/app/(storefront)/custom-print/page.tsx` (Custom Print Landing & Intake Form)

## Risks
- Đảm bảo contrast ratio của các nút CTA và badge trên cả 2 theme Light/Dark đạt chuẩn WCAG 2.1 AA (≥ 4.5:1).
- Tối ưu hóa SEO tags và metadata cho các trang public storefront.
- Kiểm tra ảnh chụp sản phẩm mẫu (đặc biệt là nhựa đen/xám/trắng) hiển thị rõ ràng trên nền card của cả 2 chế độ.
- `POST /api/public/custom-requests` là endpoint ghi dữ liệu không xác thực
  **đầu tiên** của toàn bộ dự án — honeypot + rate-limit theo số điện thoại
  là biện pháp MVP, có thể không đủ nếu bị spam bot có địa chỉ/SĐT ngẫu
  nhiên; theo dõi log sau khi launch, nâng cấp lên CAPTCHA nếu cần (xem
  Non-goals).
- Đường đọc dữ liệu sản phẩm public là lần đầu tiên có trong dự án (Phase 3
  admin gọi service trực tiếp, không qua `/api/**`) — rà lại kỹ để không lặp
  lại lỗi lộ `cost_price`/tồn kho chính xác đã từng xảy ra ở Phase 3.

## Checklist

### Trước khi giao Codex
- [x] Chốt định vị thương hiệu (maker/hobbyist & custom craft studio)
- [x] Chốt dark mode requirement (cần cả light + dark với bảng màu calibrate)
- [x] Chốt phạm vi admin (token-only alignment ở Phase 4, full densification ở Phase 8)
- [x] Chốt hướng style storefront (Tactile Neo-Craft: rounded-xl, 1px border, tactile CTA accents)
- [x] Ask AI for challenge (Gemini/Claude) trước khi implement (đã hoàn tất)
- [x] Sinh `design-system/MASTER.md` chính thức (đã hoàn tất)
- [x] Chốt scope trang cụ thể Phase 4 (Sprint 4.1–4.5) (đã hoàn tất)
- [x] Chốt đường đi dữ liệu cho form custom-request công khai: endpoint
      public riêng, migration cột `attachment_url` + enum `WEBSITE`, chống
      spam tối thiểu (honeypot + rate-limit theo SĐT) — quyết định #3

### Tests
- [ ] Chạy lại toàn bộ test/E2E hiện có của Phase 3
      (`tests/phase-3-*.test.ts`, `e2e/admin.spec.ts`) sau khi retrofit
      token màu/font admin — xác nhận không regression.
- [ ] Test mới cho `POST /api/public/custom-requests`: submit hợp lệ → 201 +
      đúng `attachment_url`/`sourceChannel = 'WEBSITE'` trong DB; honeypot có
      giá trị → trả 201 giả nhưng không insert; vượt rate-limit theo SĐT →
      lỗi thân thiện, không insert; migration enum/column áp dụng đúng.
- [ ] Test đường đọc catalog public: xác nhận không route/hàm nào trả
      `cost_price` hoặc tồn kho chính xác, chỉ sản phẩm `status = 'ACTIVE'`.
- [ ] E2E smoke test: khách vào `/custom-print`, điền form, submit thành
      công (nối tiếp tinh thần `e2e-testing` skill — đây là 1 trong 5 luồng
      critical gốc: "custom request submission").

### Pre-delivery (từ skill `ui-ux-pro-max`, bắt buộc cho storefront)
- [ ] Không dùng emoji làm icon (dùng SVG: Lucide)
- [ ] `cursor-pointer` cho mọi phần tử có thể click
- [ ] Hover state có transition mượt (150–300ms)
- [ ] Light & Dark mode: text contrast tối thiểu 4.5:1
- [ ] Focus state hiển thị rõ khi điều hướng bằng bàn phím
- [ ] Tôn trọng `prefers-reduced-motion`
- [ ] Responsive: 375px, 768px, 1024px, 1440px

## Definition of Done
Tất cả các mục "Trước khi giao Codex" đã đạt `[x]`. `design-system/MASTER.md` tồn tại làm kim chỉ nam. Admin nhận token màu/font mới mà không phá vỡ bất kỳ test/chức năng nào của Phase 3 (`npm test` pass toàn bộ). Các trang storefront theo Sprint 4.1–4.5 hoàn thiện, responsive mượt mà từ mobile (375px) đến desktop (1440px) và đạt chuẩn Pre-delivery checklist.
