# Feature Plan: Smart Product Onboarding (AI Vision Naming & Streamlined Staff UX)

> **Status:** Completed (Ready for Owner Review & Merge)  
> **Branch:** `feat/auto-catalog-quick-selector`  
> **Author:** Gemini + Pair Engineer  
> **Date:** 2026-11-24  

## 1. Phase Brief
- **Mục tiêu:**
  1. Giải quyết nút thắt cổ chai lớn nhất khi nhân viên đăng sản phẩm: **Có sẵn ảnh và giá, nhưng không nhớ/bí tên đặt cho sản phẩm**.
  2. Tích hợp AI Vision tự động phân tích ảnh chụp mẫu in trong 1 giây, đề xuất ngay **3 tên tiếng Việt chuẩn SEO / thương mại**, gợi ý **Danh mục** phù hợp nhất và tự tạo **Mô tả ngắn**.
  3. Tối ưu UX/UI khung thêm sản phẩm (`ProductOnboardingForm`):
     - Click chọn 1 tên gợi ý → Tự động điền vào ô Tên và tự động chuyển con trỏ (focus) sang ô Giá bán.
     - Bổ sung nút **"Lưu & Thêm tiếp" (Save & Add Next)** + phím tắt `Ctrl + Enter` / `Cmd + Enter` giúp staff đăng liên tục hàng chục sản phẩm mà không cần tải lại trang.
     - Nút **"Nhận diện lại từ ảnh"** để chạy lại phân tích theo yêu cầu.
     - Graceful Fallback: Nếu không có API Key hoặc mạng yếu, cung cấp bộ chip tiền tố tên mẫu in phổ biến (*Móc khoá, Khớp nối Fidget, Decor để bàn, Giá đỡ...*) để staff click chọn trong 1 giây.
     - Mặc định License là "Xưởng tự thiết kế" (OWN_DESIGN) thay vì rỗng, giúp loại bỏ lỗi chặn vô lý khi nhập hàng mẫu thông thường.
  4. **Nâng cấp Catalog (Danh mục) tự động & Khung Select đơn giản nhất cho staff**:
     - **Auto-Categorize**: Khi staff gõ hoặc đổi tên sản phẩm, hệ thống tự động phát hiện từ khóa để gán danh mục tương ứng tức thì (0 click).
     - **Quick Category Chips**: Thay thế dropdown `<select>` đơn điệu bằng các nút bấm Pill bo tròn kèm icon phân loại (1 chạm).
     - **Inline Quick Add Category**: Cho phép staff tạo nhanh danh mục mới ngay tại chỗ mà không cần rời trang.
- **Non-goals:** Tự động publish ra trang chủ mà staff chưa xác nhận giá; can thiệp vào các logic ghi database/inventory hiện có.
- **Inputs:** Ảnh mẫu in (file upload hoặc kéo thả), Giá bán niêm yết do staff nhập, Tên sản phẩm.
- **Outputs:**
  - Endpoint `/api/admin/catalog/ai-suggest-product`: nhận ảnh base64/URL, danh sách categories của cửa hàng -> trả về 3 gợi ý tên tiếng Việt, categoryId phù hợp nhất, mô tả ngắn, keywords.
  - Component `ProductOnboardingForm` được nâng cấp với UI gợi ý tên thông minh, badge trạng thái, phím tắt nhanh, nút Lưu & Thêm tiếp.
  - Khung chọn danh mục trực quan dạng Chips kèm auto-detect theo tên và nút thêm nhanh danh mục inline.
- **Risks & Mitigation:**
  - *Risk:* Gemini API vắng mặt hoặc timeout.
  - *Mitigation:* Timeout 10 giây + Fallback sang heuristic tags & category keywords có sẵn, không bao giờ chặn hay gây lỗi form.
- **Definition of Done:**
  - `npm run check:agent` (lint, typecheck, check:arch, tests) xanh 100%.
  - Unit test cho auto-categorize logic.
  - Test tương tác UX mượt mà trên `ProductOnboardingForm`.

---

## 2. Vertical Slices & Checklists

### Slice 1: Backend AI Suggestion Service & API
- [x] Xây dựng service / endpoint `POST /api/admin/catalog/ai-suggest-product`:
  - [x] Nhận `imageBase64`, `mimeType`, danh sách categories của cửa hàng.
  - [x] Gọi Gemini 2.5 Flash Vision với prompt tối ưu cho sản phẩm in 3D tiếng Việt (tên hấp dẫn, ngắn gọn, chuẩn tìm kiếm).
  - [x] Trả về schema rõ ràng: `{ suggestedNames: string[], suggestedCategoryId: string | null, suggestedShortDesc: string, keywords: string[] }`.
  - [x] Viết fallback logic thông minh khi không có API key hoặc lỗi mạng.
  - [x] Viết unit test cho service / endpoint (`tests/catalog-ai.test.ts` - 4/4 passing).

### Slice 2: Nâng cấp UI/UX `ProductOnboardingForm`
- [x] Tích hợp trigger phân tích ảnh ngay khi staff chọn/thả ảnh bìa vào `ProductImagePicker`.
- [x] Thiết kế thanh gợi ý tên trực quan ngay dưới ô "Tên sản phẩm":
  - [x] 3 Chip tên gợi ý với icon `Sparkles`. Click chọn → điền ngay vào ô input + focus sang ô Giá.
  - [x] Nút "Nhận diện lại từ ảnh" khi muốn phân tích lại.
  - [x] Tự động chọn Danh mục phù hợp từ DB nếu staff chưa chọn.
  - [x] Tự động điền Mô tả ngắn gợi ý (nếu đang trống).
  - [x] Tiền tố phổ biến khi chưa có ảnh hoặc chưa có tên.
- [x] Thêm nút **"Lưu & Thêm tiếp" (Save & Add Next)**:
  - [x] Tạo sản phẩm xong → Reset form về trạng thái trống (giữ nguyên kho / hình thức bán đã chọn) → Tự động scroll mượt lên trên.
  - [x] Banner thông báo thành công xanh lá ở đầu trang kèm link xem chi tiết.
  - [x] Hỗ trợ phím tắt `Ctrl + Enter` (Windows) / `Cmd + Enter` (Mac) để lưu ngay lập tức.
- [x] Thiết lập `licenseMode` mặc định là `'OWN_DESIGN'` thay vì trống, giảm bớt click bắt buộc cho staff.

### Slice 3: Verification & Polish (Đợt 1)
- [x] Chạy `npm run lint`, `npm run typecheck`, `npm run check:arch`, `npx tsx tests/catalog-ai.test.ts` đều xanh 100%.
- [x] Soát lại UX/UI theo skill `ui-ux` và `emil-design-eng`: snappiness, feedback tức thì, active states, auto-focus.

### Slice 4: Auto-Catalog & Khung Select Danh mục đơn giản cho Staff
- [x] Xây dựng bộ quy tắc Auto-Categorize theo từ khóa tên sản phẩm (`detectCategoryFromName`):
  - [x] Hỗ trợ các nhóm phổ biến: Móc khoá, Keycap, Decor/Trang trí, Mô hình/Figure, Phụ kiện/Tiện ích, v.v.
  - [x] Tự động nhảy danh mục khi gõ tên (nếu staff chưa chọn thủ công).
- [x] Chuyển đổi khung chọn danh mục từ `<select>` sang **Interactive Category Chips (Pills)**:
  - [x] Hiển thị trực quan danh mục kèm icon đại diện.
  - [x] Highlight rõ ràng danh mục đang chọn.
  - [x] Hiển thị badge nhỏ `✨ Tự động nhận diện` khi hệ thống tự gán.
- [x] Thêm nút **"+ Thêm danh mục"** inline:
  - [x] Nhập tên danh mục mới ngay tại form → gọi `createCategoryInlineAction` → tự động thêm vào danh sách và chọn luôn.
- [x] Kiểm thử tự động (Unit test keyword matching `tests/categories-auto.test.ts` + lint/typecheck/arch).
