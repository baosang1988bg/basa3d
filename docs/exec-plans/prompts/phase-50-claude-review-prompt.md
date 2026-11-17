# Prompt Claude — Review Kế hoạch Phase 50 (Cẩm nang in 3D BaSa3D)

Copy toàn bộ nội dung bên dưới gửi cho Claude:

---

Bạn là Lead Architect & Quality Gate Reviewer của dự án BaSa3D (`AGENTS.md`).

Dự án vừa lập kế hoạch triển khai **Phase 50: Cẩm nang in 3D BaSa3D (FDM Handbook & Engineering Reference)** tại trang `/cam-nang` (tham khảo mô hình chuyên trang của `zorva3d.com/vi/handbook`, xem kế hoạch chi tiết tại `docs/exec-plans/active/phase-50-handbook.md`).

Mục tiêu là xây dựng một trang cẩm nang kỹ thuật 9 chương chuẩn mực cho thợ in và người chơi in 3D tại Việt Nam, đồng thời kết nối trực tiếp với hệ sinh thái công cụ 3D (`/tools/*`) và báo giá tức thì (`/bao-gia`).

### Các quyết định kiến trúc đã đề xuất:
1. **Kiến trúc Code-first Static Reference (Không dùng DB)**:
   - Toàn bộ nội dung 9 chương và bảng tra cứu lưu trong `src/data/handbook/`.
   - Render tĩnh hoàn toàn (Static Site Generation / SSG), 0 ms DB query, 0 VNĐ chi phí Supabase egress.
2. **Ranh giới Server vs Client Component (Islands Architecture)**:
   - `page.tsx` và toàn bộ nội dung chữ, bảng tra cứu cơ bản là **Server Component**.
   - Chỉ các thành phần tương tác mới là **Client Component (`'use client'`)**:
     * `HandbookToc`: Thanh mục lục Sticky Scroll-spy dùng `IntersectionObserver`.
     * `InteractiveChecklist`: Checklist 7 bước kiểm tra trước khi in có tickbox lưu vào `localStorage`.
3. **Routing & Điều hướng**:
   - Đường dẫn chính: `/[locale]/cam-nang` (storefront).
   - Redirect 308 từ `/handbook` và `/[locale]/handbook` về `/[locale]/cam-nang`.
   - Bổ sung menu item trên Header và Footer của storefront.
4. **Không thêm dependency bên ngoài (Rule #8 AGENTS.md)**:
   - Tận dụng Tailwind CSS + shadcn/ui có sẵn; không cài thêm các thư viện tài liệu nặng (Fumadocs, Nextra, Docusaurus) hay charting library.

---

### Yêu cầu review từ Claude:
1. **Ranh giới Server/Client Component & Bundle Size**:
   - Với lượng text và bảng thông số lớn của 9 chương, việc phân tách Server Component cho bài viết và Client Component cho TOC/Checklist đã tối ưu nhất để tránh làm phình client bundle chưa?
2. **Xử lý Hydration Mismatch ở Checklist (`localStorage`)**:
   - `InteractiveChecklist` đọc và ghi vào `localStorage` trên trình duyệt. Cần lưu ý gì để tránh triệt để lỗi Hydration Mismatch của React/Next.js khi SSR?
3. **Hiệu năng Scroll-spy & UX trên Mobile**:
   - Thiết kế Sticky TOC với `IntersectionObserver` khi cuộn trang dài: cách cấu hình `rootMargin` và `threshold` nào mượt nhất, không gây giật lag hoặc giật nhảy trên màn hình mobile 375px?
4. **SEO Kỹ thuật & Routing**:
   - Cấu trúc dữ liệu JSON-LD nào phù hợp nhất (`TechArticle`, `HowTo` cho checklist, hay `FAQPage`)?
   - Cấu hình redirect `/handbook` $\rightarrow$ `/cam-nang` trong `next.config.mjs` có gặp vướng mắc gì với middleware i18n hiện tại của BaSa3D (ADR-0048) không?
5. **Kết luận Review**:
   - Đưa ra nhận xét cụ thể: **"GO / NO-GO"** kèm các điểm cần tinh chỉnh hoặc bẫy tiềm ẩn trước khi bắt đầu viết code Lát cắt A.
