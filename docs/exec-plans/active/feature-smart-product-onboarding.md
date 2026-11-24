# Kế hoạch phát triển: Quy trình Đăng Sản Phẩm Siêu Nhanh cho Staff (Smart Product Onboarding)

## 1. Mục tiêu & Vấn đề giải quyết
- **Thực trạng**: Staff có ảnh sản phẩm và giá bán, nhưng không nhớ/bí tên đặt cho sản phẩm in 3D. Mỗi lần đăng tốn 3–5 phút để nghĩ tên, điền danh mục, mô tả.
- **Giải pháp**:
  1. **AI Vision Suggestion (Dual Engine: Local GPU RTX 4060 + Cloud Gemini)**: Staff thả ảnh vào → AI tự nhận diện vật thể trong ảnh và đề xuất 3 tên tiếng Việt chuẩn SEO + danh mục phù hợp nhất + mô tả ngắn 1-2 câu.
  2. **1-Click Name & Auto-focus**: Click vào 1 chip gợi ý tên → tự động điền tên và tự nhảy con trỏ sang ô **Giá bán**.
  3. **Auto-Catalog & Category Pills**: Tự động nhận diện danh mục từ từ khoá tên sản phẩm hoặc AI đề xuất. Danh mục dạng chips kèm icon emoji trực quan, có nút thêm nhanh danh mục mới inline.
  4. **Fast Staff Workflow**: Thêm phím tắt `Ctrl + Enter` (hoặc `Cmd + Enter`) để "Lưu & Thêm tiếp" món khác mà không cần rời tay khỏi bàn phím, reset form mượt mà.

---

## 2. Các lát cắt triển khai (Slices)

### Slice 1: AI Vision Suggestion API
- [x] Tạo service `src/services/catalog-ai.service.ts` phân tích ảnh:
  - [x] Gọi AI Vision API nhận diện ảnh mẫu in 3D.
  - [x] Trả về 3 gợi ý tên tiếng Việt ngắn gọn, danh mục gợi ý, mô tả ngắn, keywords.
  - [x] Cơ chế graceful fallback khi AI không khả dụng hoặc chưa có key.
- [x] Tạo API endpoint `src/app/api/admin/catalog/ai-suggest-product/route.ts` với Zod validation & rate limit.
- [x] Viết unit test cho service (`tests/catalog-ai.test.ts`).

### Slice 2: Cải tiến UX/UI Form Đăng Sản Phẩm (`ProductOnboardingForm`)
- [x] Tích hợp AI Suggestion vào `ProductOnboardingForm`:
  - [x] Tự động kích hoạt khi staff chọn ảnh bìa đầu tiên (hoặc nút "Nhận diện lại từ ảnh").
  - [x] Hiển thị 3 chip tên gợi ý ngay dưới ô Tên sản phẩm.
  - [x] Click chip tên → tự động điền Tên sản phẩm + tự động nhảy focus vào ô Giá bán.
- [x] Tối ưu các trường mặc định:
  - [x] Mặc định `licenseMode = 'OWN_DESIGN'` (Thiết kế xưởng tự vẽ / tự do) để giảm thao tác click bắt buộc.
  - [x] Thêm các tiền tố nhanh: `[Móc khoá]`, `[Mô hình]`, `[Trang trí]`, `[Phụ kiện]`, `[Đồ chơi]` để staff bấm nhanh nếu không dùng AI.

### Slice 3: Chế độ "Lưu & Thêm tiếp" (Fast Batch Onboarding)
- [x] Thêm nút hành động thứ 3: **"Lưu & Thêm tiếp"** bên cạnh "Lưu nháp" và "Đăng bán".
- [x] Bấm nút hoặc nhấn tổ hợp phím **`Ctrl + Enter`** / **`Cmd + Enter`**:
  - [x] Lưu sản phẩm và tải ảnh lên storage.
  - [x] Reset form về trạng thái trống (giữ nguyên kho mặc định), hiển thị banner thành công nhẹ nhàng: "Đã lưu X — sẵn sàng cho món tiếp theo".
  - [x] Tự động focus lại vào khung tải ảnh để staff thả ảnh món kế tiếp.

### Slice 4: Tự động hoá Danh mục (Auto-Catalog) & Khung Select Đơn Giản
- [x] Tạo bộ quy tắc từ khoá `detectCategoryFromName(name)` trong `src/lib/categories.ts`:
  - [x] Tự động phát hiện danh mục khi staff gõ hoặc chọn tên (ví dụ: "Móc khoá mèo" → "Móc khoá & Keyring").
- [x] Chuyển đổi khung chọn danh mục từ `<select>` sang **Interactive Category Chips (Pills)**:
  - [x] Hiển thị trực quan danh mục kèm icon đại diện.
  - [x] Highlight rõ ràng danh mục đang chọn.
  - [x] Hiển thị badge nhỏ `✨ Tự động nhận diện` khi hệ thống tự gán.
- [x] Thêm nút **"+ Thêm danh mục"** inline:
  - [x] Nhập tên danh mục mới ngay tại form → gọi `createCategoryInlineAction` → tự động thêm vào danh sách và chọn luôn.
- [x] Kiểm thử tự động (Unit test keyword matching `tests/categories-auto.test.ts` + lint/typecheck/arch).

### Slice 5: Local Ollama Vision Engine (RTX 4060 GPU)
- [x] Tích hợp `tryOllamaVision` trong `catalog-ai.service.ts`:
  - [x] Kết nối `http://localhost:11434/api/generate` với model `llava` hoặc `moondream`.
  - [x] Ưu tiên gọi Local AI trước (0 token, bảo mật nội bộ, chạy GPU RTX 4060 siêu tốc ~300ms).
  - [x] Tự động fallback sang Cloud Gemini API nếu Ollama không bật.
  - [x] Hiển thị badge nguồn trên UI: `⚡ AI Local (RTX 4060)` hoặc `✨ Cloud Gemini`.
- [x] Viết unit test và kiểm tra `check:agent`.
