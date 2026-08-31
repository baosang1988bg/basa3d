# Phase 8 (slice 1) — UX Feedback Round 1 (User thật trải nghiệm site)

Nguồn: tài liệu Google Docs "TÙM LUM TÀ LA" (tab Feedback) — 1 user thật được
nhờ trải nghiệm storefront BaSa3D và ghi lại 5 vấn đề + 2 đề xuất bổ sung.
`docs/roadmap.md` ghi Phase 8 là "operations/optimization/scale" — batch này
không phải hạ tầng vận hành, mà là UX polish trên storefront đã ship (Phase
4). Xếp vào Phase 8 làm **slice 1 (optimization)** vì chưa có phase riêng cho
"UX feedback từ user thật" trong roadmap; ghi rõ ở đây để không tự ý mở rộng
phạm vi Phase 8 sau này mà không qua Phase Start Protocol lại.

## Rà soát trước khi lập kế hoạch

Đã đọc code thật trước khi viết plan (không suy đoán):

- **VẤN ĐỀ 1** — `src/components/storefront/header.tsx`: `NAV_LINKS` render
  bằng `.map`, không có `usePathname()`/active state nào. Có 2 nơi render
  (desktop nav dòng 30 và mobile drawer dòng 82). Xác nhận đúng như feedback:
  không có dấu hiệu cho biết đang ở mục nav nào.
- **VẤN ĐỀ 2** — không có component breadcrumb nào trong `src/components/`.
  Xác nhận thiếu hoàn toàn, không phải bug.
- **VẤN ĐỀ 3** — `src/app/(storefront)/products/page.tsx` chỉ filter theo
  `type` (READY_STOCK/MADE_TO_ORDER) + search + sort, không có filter theo
  category. Nhưng `src/services/storefront-catalog.service.ts` (dòng
  57–61) **đã sẵn** `listStorefrontProducts({ categoryId })` — backend filter
  category đã có từ trước, chỉ thiếu UI. `ProductsPage` là Server Component nên
  có thể gọi trực tiếp `listCategories()` từ `src/services/product.service.ts` mà
  không cần fetch HTTP nội bộ qua `/api/categories`.
- **VẤN ĐỀ 4** — nav "Bảng giá & Vật liệu" trỏ tới `/#materials`
  (`src/app/(storefront)/page.tsx`), nhưng section đó chỉ có mô tả định tính
  PLA/PETG/Resin (`So sánh nhanh vật liệu in 3D`), không có con số VNĐ nào.
  `src/app/(storefront)/custom-print/page.tsx` cũng chỉ có "Bảng tra cứu vật
  liệu" định tính (độ bền/chịu nhiệt/độ mịn/chi phí ở dạng chữ: Thấp/Trung
  bình/Cao), không phải bảng giá theo số. Quan trọng hơn:
  `src/services/quote.service.ts` cho thấy báo giá là **thủ công 100% do
  staff nhập `subtotal`** — không có công thức `price_per_gram`/
  `price_per_hour` nào lưu trong hệ thống (đã `grep` toàn repo, không thấy).
  Nghĩa là không có nguồn dữ liệu thật nào để tự động tính ra 1 bảng giá cụ
  thể — mọi bảng giá tham khảo đều phải là số do OWNER cung cấp, không phải
  Claude/Codex tự suy ra.
- **VẤN ĐỀ 5** — `src/app/(storefront)/page.tsx` phần hero, 3 badge
  `In nhanh 24h / Nhựa nguyên sinh cao cấp / Báo giá nhanh trong 30p` là
  `<span>` thuần, không `href`, không `cursor-pointer`. Xác nhận đúng: nhìn
  giống pill/button nhưng không click được.

## Goal
Xử lý 5 vấn đề UX do user thật phát hiện khi trải nghiệm storefront, cộng 2
đề xuất bổ sung (mục Dự án, FAQ) — mức độ "polish trên nền đã có", không đổi
kiến trúc, không đổi schema, không thêm dependency thừa.

## Non-goals
- **Số liệu bảng giá thật** (VẤN ĐỀ 4) — Claude/Codex không tự bịa mức giá
  VNĐ theo gram/giờ. Slice này chỉ sửa **thông tin sai lệch** (nav label hứa
  "bảng giá" nhưng không giao bảng giá) và minh bạch công thức tính giá in 3D
  tại section `#materials`.
- **Trang "Dự án"/showcase ảnh sản phẩm đã làm** — chưa tạo trang `/projects`
  rỗng với chữ "Sắp cập nhật" khi chưa có ảnh chụp thật của xưởng. Slice này tập
  trung làm nổi bật ứng dụng thực tế thông qua các section hiện có.
- **Redesign toàn bộ trang chủ** — chỉ sửa đúng 5 điểm + 2 bổ sung được nêu,
  không tự thêm cải tiến UX khác chưa có trong feedback (AGENTS.md: không
  thêm tính năng ngoài phạm vi phase).

## Quyết định đã chốt (Sau Review & Challenge từ Gemini)

1. **VẤN ĐỀ 1 — Active nav state**: dùng `usePathname()` (`next/navigation`)
   trong `header.tsx`.
   - Logic so khớp chính xác:
     `const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);`
     (tránh lỗi `'/'` luôn match tất cả các trang con).
   - Áp dụng active state cho **cả Desktop nav và Mobile Drawer menu**.
   - Thêm thuộc tính ngữ nghĩa `aria-current={isActive ? 'page' : undefined}`.
   - Riêng `/#materials` (anchor trên trang chủ) không có `pathname` riêng để
     so khớp — chấp nhận không áp active state cho mục này ở slice 1.
   - Style active: `text-foreground font-semibold` thay vì `text-muted-foreground`.

2. **VẤN ĐỀ 2 — Breadcrumb**:
   - Tạo `src/components/storefront/breadcrumb.tsx` dùng chung với cấu trúc ngữ
     nghĩa `<nav aria-label="Breadcrumb"><ol>...</ol></nav>`.
   - Nhận `items: { label: string; href?: string }[]`.
   - Áp dụng ở `/products`, `/products/[slug]`, `/blog`, `/blog/[slug]`, `/custom-print`.
   - Ở `/products/[slug]`: Hỗ trợ Breadcrumb phân cấp thông minh:
     `Trang chủ > Sản phẩm > [Danh mục nếu có] > [Tên sản phẩm]`, với Danh mục
     trỏ về `/products?categoryId=...`.
   - Mục cuối (trang hiện tại) áp dụng `truncate max-w-[200px] md:max-w-none` để
     không bị tràn/vỡ giao diện trên màn hình điện thoại khi tên sản phẩm dài.

3. **VẤN ĐỀ 3 — Category filter**:
   - Thêm `categoryId` vào `SearchParams` của `products/page.tsx`, truyền xuống
     `listStorefrontProducts({ categoryId })`.
   - Trong `products/page.tsx` (Server Component), gọi trực tiếp `listCategories()`
     từ `src/services/product.service.ts` để lấy danh sách danh mục (không gọi qua fetch HTTP nội bộ).
   - UI: Dãy chip/tab category nằm trên lưới sản phẩm, có "Tất cả" mặc định.
   - Khi chuyển category chip, giữ lại các tham số `q`, `sort`, `type` hiện tại
     thông qua `buildQueryString`, đồng thời reset `page=1`.

4. **VẤN ĐỀ 4 — Nhãn "Bảng giá & Vật liệu"**:
   - Đổi nhãn nav thành **"Vật liệu"** (bỏ chữ "Bảng giá"), giữ nguyên trỏ tới
     `/#materials`.
   - Tại section `#materials` trên trang chủ: Bổ sung 1 khối thông tin giải
     thích minh bạch cơ chế định giá của BaSa3D:
     `Chi phí = Vật liệu tiêu hao (gram) + Thời gian in (giờ) + Xử lý bề mặt`
     kèm lời kêu gọi gửi file nhận báo giá chính xác 30 phút, dẫn trực tiếp vào `/custom-print`.

5. **VẤN ĐỀ 5 — Badge hero không click được**:
   - Đồng bộ cả 3 badge thành cụm **Value Proposition Bar** có icon và điều hướng rõ ràng:
     - `⚡ In nhanh 24h` → Link trỏ tới `/#workflow` (Quy trình 4 bước)
     - `🛡️ Nhựa nguyên sinh cao cấp` → Link trỏ tới `/#materials`
     - `⏱️ Báo giá nhanh trong 30p` → Link trỏ tới `/custom-print`
   - Áp dụng `cursor-pointer`, hover state và focus ring chuẩn theo design system.

6. **Đề xuất bổ sung — FAQ**:
   - Thêm section `Câu hỏi thường gặp` ở cuối trang chủ.
   - Xây dựng bằng Native HTML `<details>` & `<summary>` kết hợp Tailwind CSS
     (hoặc `@base-ui/react` đã có sẵn trong dự án) — **không cài thêm `@radix-ui/react-accordion`**
     (tuân thủ AGENTS.md rule #8: hạn chế thêm dependency thừa).
   - Nội dung câu hỏi dựa trên chính sách file, bảo mật, thời gian in và quy trình thực tế.
   - Bổ sung schema `FAQPage` JSON-LD trên trang chủ để tối ưu SEO Rich Snippets.

7. **Đề xuất bổ sung — Mục "Dự án"**:
   - Không tạo trang `/projects` rỗng gắn chữ "Sắp cập nhật" lên Header (tránh giảm uy tín e-commerce).
   - Tận dụng section "Sản phẩm tiêu biểu" và các category hiện có trên trang chủ.
   - Trang Gallery/Dự án riêng sẽ được mở trong một slice riêng khi OWNER đã chuẩn bị đủ 5–10 ảnh chụp thật từ xưởng.

## Inputs
- `src/components/storefront/header.tsx` (nav + active state desktop/mobile).
- `src/app/(storefront)/products/page.tsx` (category chips, Server Component `listCategories`).
- `src/services/product.service.ts` (`listCategories`).
- `src/services/storefront-catalog.service.ts` (`listStorefrontProducts({ categoryId })`).
- `src/app/(storefront)/page.tsx` (hero value props bar, minh bạch cách tính giá `#materials`, FAQ section + JSON-LD).
- `src/app/(storefront)/products/[slug]/page.tsx` (category-aware breadcrumb).

## Outputs
- `src/components/storefront/breadcrumb.tsx` (mới, chuẩn accessibility & mobile truncate) + tích hợp vào các trang subpages.
- `header.tsx`: active nav state qua `usePathname()` cho cả desktop & mobile drawer, `aria-current`.
- `products/page.tsx`: category filter chips, giữ query params khi lọc, direct service call.
- `page.tsx` (trang chủ): đổi nhãn nav "Vật liệu", 3 hero value prop links, giải thích cách tính giá ở `#materials`, section FAQ `<details>/<summary>` + FAQPage JSON-LD.

## Risks & Mitigations
- **Active state anchor `#materials`**: Mục này không sáng khi cuộn trang; đã chấp nhận ở Quyết định #1 để giữ giải pháp đơn giản và nhẹ nhàng.
- **Không cài thêm thư viện**: Triển khai FAQ bằng HTML5 `<details>/<summary>` đảm bảo bundle nhẹ nhất, chạy mượt trên cả mobile không cần JS phụ thuộc.
- **Category Filter**: Đảm bảo trường hợp sản phẩm không gán category vẫn hiển thị đầy đủ khi chọn "Tất cả".

## Checklist

### Trước khi giao Codex
- [x] Rà soát code hiện có trước khi lập kế hoạch (đã làm)
- [x] OWNER xác nhận Quyết định #4 (đổi nhãn nav thành "Vật liệu", giải thích cơ chế giá)
- [x] OWNER xác nhận Quyết định #7 (hoãn tạo `/projects` rỗng cho đến khi có ảnh thật)
- [x] Ask AI for challenge trước khi implement (Step 3 `PHASE_START_PROTOCOL.md`) — **Đã hoàn thành qua Gemini Review (2026-08-31)**

### Tests
- [x] Test `listStorefrontProducts({ categoryId })` filter đúng danh mục (`tests/phase-4-storefront-catalog.test.ts`)
- [x] Test route `/api/categories` GET không yêu cầu auth (`tests/phase-3-route-auth.test.ts`)
- [x] Chạy lại toàn bộ `npm test` sau khi đổi — không regression Phase 1–7 (54/54 pass; 3 test
      trong `phase-5-public-orders.test.ts` flaky khi chạy full-suite do nhiều `next start` instance
      tranh CPU/DB connection cùng lúc — pre-existing, tái hiện y hệt trước khi có thay đổi Phase 8
      này, pass 100% khi chạy riêng file)

### Pre-delivery (UI mới)
- [x] `cursor-pointer` và hover state cho cả 3 hero badge links
- [x] Active nav state kiểm tra đủ các route trên cả Desktop và Mobile drawer menu
- [x] Breadcrumb hiển thị đúng thứ tự, có link danh mục ở trang chi tiết sản phẩm, không vỡ layout trên mobile
- [x] FAQ đóng/mở mượt mà, đầy đủ thông tin hữu ích và không mâu thuẫn chính sách bán hàng

## Definition of Done
- Cả 5 vấn đề trong feedback gốc được giải quyết triệt để.
- Category filter hoạt động mượt mà trên `/products`, giữ nguyên trạng thái tìm kiếm và sắp xếp.
- Nhãn nav chính xác, trang chủ có giải thích cách tính giá và FAQ hữu ích.
- `npm test`, `npm run typecheck`, `npm run lint` và `npm run build` pass 100%.
- Mời user thật trải nghiệm lại để xác nhận từng điểm đã khắc phục hoàn toàn.
