# BaSa3D Development Kanban

> Bảng theo dõi và điều phối tác vụ cho **Parallel Code** (`johannesjo/parallel-code`) & AI Agents.
> Quy tắc nhánh bắt buộc: Mọi task xuất phát từ `dev` (`feat/...`, `fix/...`), kiểm tra `npm run check:agent` trước khi merge.

## Backlog

- [ ] Triển khai và tối ưu Netlify Free deploy (Phase 51)
  Đồng bộ hạ tầng chạy dual-platform (Vercel & Netlify), kiểm tra scheduled function thay cron, header IP và script smoke test.
  branch: chore/netlify-free-deploy
  - [ ] Hoàn thiện Scheduled Function chạy tác vụ định kỳ
  - [ ] Kiểm thử script `scripts/deploy/smoke-netlify.mjs`
  - [ ] Chạy `npm run check:agent` xác minh build

- [ ] Hoàn thiện luồng Báo giá tức thì /bao-gia & Multi-file Upload (Phase 33)
  Hiệu chỉnh bảng tính giá S0 với file slice thực tế, kiểm tra giao diện 3D preview, resize toolbar và giới hạn tải lên tối đa 50 file.
  branch: feat/bao-gia-calibration
  - [ ] Kiểm tra hiển thị bounding box kích thước 3D trên model
  - [ ] Đo lường độ sai lệch trọng lượng và thời gian in thực tế
  - [ ] Xác minh quota upload direct-to-storage

- [ ] Xây dựng công cụ Book Maker Studio
  Công cụ trực quan cho phép tạo gáy sách thông minh, kẹp sách và phụ kiện in 3D cho người đọc sách.
  branch: feat/book-maker-studio
  - [ ] Dựng canvas 3D tham số hóa kích thước sách
  - [ ] Tạo module xuất file STL/3MF tương thích Bambu Studio
  - [ ] Viết test tự động cho thuật toán tính toán mesh

- [ ] Tối ưu hóa hiệu năng & tìm kiếm trong Admin (Phase 28)
  Cải thiện tốc độ tải trang danh sách đơn hàng, quản lý kho và bảng dữ liệu khách hàng.
  branch: perf/admin-findability
  - [ ] Thêm debounce và virtualized list cho danh mục lớn
  - [ ] Tối ưu câu truy vấn Supabase với chỉ mục phù hợp
  - [ ] Kiểm thử E2E trang quản trị

## In progress

- [ ] Hoàn thiện NeoBox LED Lightbox Maker & 3D Logo Generator
  Công cụ tạo hộp đèn LED & logo 3D (/tools/lightbox), tối ưu hốc rỗng, đường luồn dây điện và mô phỏng dải đèn LED thực tế.
  branch: feat/neobox-lightbox-generator
  - [x] Tạo giao diện 3D canvas mô phỏng hộp đèn và logo
  - [x] Thêm hốc rỗng và đường luồn LED neon flex
  - [ ] Chạy kiểm thử chất lượng `npm run check:agent`
  - [ ] Soát lại UX controls và xuất 3MF/STL cho in thực tế

## Review

- [ ] Daily AI 3D News Cron & Auto-Draft (Phase 54)
  Tự động cào tin tức in 3D RSS từ All3DP, Hackaday, dùng Gemini Flash dịch và tóm tắt theo tone kỹ thuật BaSa3D vào draft blog.
  branch: feat/phase-54-daily-ai-news
  - [x] Tích hợp RSS parser và Gemini prompt
  - [x] Tạo API endpoint & Cron trigger
  - [ ] Owner duyệt chất lượng dịch và kiểm tra giao diện `/admin/blog`

- [ ] Cẩm nang in 3D 2.0 - Interactive Tools (Phase 53)
  Máy tính khe hở dung sai, máy tính chi phí tự in VND số nguyên, ảnh minh họa 8 lỗi in thực tế.
  branch: feat/phase-53-handbook-interactive
  - [x] Máy tính khe hở lắp ghép (chương 07)
  - [x] Bộ tra cứu lỗi in FDM tương tác
  - [ ] Owner kiểm tra ảnh minh họa và checklist nghiệm thu

## Done

- [x] Cẩm nang in 3D BaSa3D - FDM Handbook & Engineering Reference (Phase 50)
  Trang `/cam-nang` 9 chương kỹ thuật, Sticky TOC, bảng tra dung sai và vật liệu in.

- [x] Admin UX - Nhập kho nhanh & Đăng sản phẩm mới (Phase 52)
  Dialog nhập kho theo mẻ, `/admin/inventory` sổ cái có lọc, `/admin/products/new` kéo thả ảnh.

- [x] Flex Organizer tray generator (Phase 45)
  Công cụ tạo khay sắp xếp đồ đa năng với Manifold-3D WASM, 6 mẫu nhanh, nhãn snap 2 màu.
