# Feature Plan: Trend Radar & Multi-Engine Model Search

> **Status:** Active  
> **Branch:** `feat/trend-radar-model-search`  
> **Author:** Gemini + Pair Engineer  
> **Date:** 2026-11-24  

## 1. Phase Brief
- **Mục tiêu:**
  1. Cung cấp công cụ săn mẫu trend (Trend Radar) trong admin (`/basaadmin/trend-hunter`) cho Chủ shop (Owner): theo dõi các nguồn trend (MakerWorld China, Douyin, MakerWorld Contests, Printables, Thangs), cào nhanh thông số mẫu từ URL và lưu vào Watchlist để in thử nghiệm/tạo sản phẩm nháp.
  2. Nâng cấp chức năng tìm kiếm mẫu 3D: Tìm kiếm bằng Text (đa nền tảng, Meta search qua Yeggi, Thangs, MakerWorld, Printables, Thingiverse) và Tìm kiếm bằng Ảnh (Visual Search dùng AI trích xuất đặc tính/từ khóa + Google Lens deep query).
  3. Cổng kết nối Big Ecosystem trên Storefront & Admin: Giúp khách hàng và chủ shop truy cập kho mẫu lớn, copy link mẫu đưa về BaSa3D tính giá in tự động.
- **Non-goals:** Tự động thanh toán bản quyền tác giả; crawl toàn bộ cơ sở dữ liệu của MakerWorld (chỉ cào theo URL on-demand).
- **Inputs:** URL mẫu 3D (MakerWorld, MW CN, Printables, Thingiverse), ảnh mẫu vật (upload hoặc clipboard paste), từ khóa tìm kiếm.
- **Outputs:**
  - Bảng điều khiển Săn Trend (`/basaadmin/trend-hunter`) kèm Watchlist lưu trữ.
  - Công cụ tìm kiếm Meta Search + Visual Image Search đa nền tảng (`/tools/model-search` hoặc Modal).
  - Khối khám phá Big Ecosystem cho Storefront.
- **Risks:** Rate limit từ bên thứ ba (xử lý bằng on-demand resolution và caching), bản quyền thiết kế (gắn cờ cảnh báo giấy phép thương mại CC-BY/NC).
- **Definition of Done:**
  - `npm run check:agent` (lint, typecheck, check:arch) xanh 100%.
  - `next build` thành công.
  - Test đầy đủ các API và parser.

---

## 2. Vertical Slices & Checklists

### Slice 1: Admin Trend Radar (`/basaadmin/trend-hunter`) — [Ưu tiên số 1]
- [x] Thiết kế API và cấu trúc dữ liệu cho Trend Watchlist (Supabase table `trend_watch_items` tại `supabase/migrations/20261124000000_trend_watch_items.sql` + fallback).
- [x] Tạo API `POST /api/admin/trend-hunter/capture`: Nhận link (MakerWorld Global/CN, Printables, Thingiverse, Douyin) -> Tự động trích xuất metadata (Tên, Ảnh cover, Tác giả, Thời gian in, Gram nhựa, Profile 3MF).
- [x] Xây dựng trang `/basaadmin/trend-hunter/page.tsx` và client component:
  - [x] **Tab 1 — Curated Trend Feeds:** Danh mục link trực tiếp vào các bảng xếp hạng hot nhất (MW CN Top Downloads, Weekly Hot, Bambu Contests, Douyin Tags, Printables 7-day).
  - [x] **Tab 2 — Quick Capture & Auto Parse:** Ô dán URL phân tích tức thì trong 1 giây.
  - [x] **Tab 3 — Trend Watchlist:** Bảng danh sách mẫu đang theo dõi, trạng thái (*Theo dõi / Đang in thử / Đã tạo SP*), nút tạo sản phẩm nháp sang Catalog.
- [x] Thêm mục "Săn Mẫu Trend" vào thanh điều hướng Admin (`admin-nav.tsx`).

### Slice 2: Smart Search (Multi-Engine Meta Search & Visual Image Search)
- [x] Xây dựng bộ helper `src/lib/search/meta-engines.ts`:
  - Format URL tìm kiếm cho Yeggi, Thangs, MakerWorld, MW CN, Printables, Thingiverse, Cults3D.
  - Hỗ trợ dịch tự động từ khóa Tiếng Việt -> Tiếng Anh/Tiếng Trung.
- [x] Xây dựng API `/api/public/search/visual-analyze`:
  - Nhận ảnh upload hoặc base64.
  - Phân tích hình thái 3D bằng Vision AI (hoặc heuristic tags) -> Trả về 3-5 query keywords chuẩn tiếng Anh & tiếng Trung.
  - Trả về deep-link Google Lens với filter file 3D (`site:makerworld.com OR site:thingiverse.com`).
- [x] Tạo component giao diện `ModelSearchDialog` (`src/components/storefront/model-search-dialog.tsx`):
  - Khung tìm kiếm Text: Gõ từ khóa -> Gợi ý nhanh + Nút 1-click mở đồng loạt hoặc mở từng search engine.
  - Khung tìm kiếm Ảnh: Kéo thả/Dán ảnh clipboard -> Phân tích -> Trả về tags gợi ý và nút mở Meta search.

### Slice 3: Big Ecosystem Hub cho Khách hàng & Tích hợp luồng Báo giá
- [x] Nâng cấp component `MakerWorldDiscoveryBanner`:
  - Hiển thị đầy đủ các kho lớn: MakerWorld Global, MakerWorld China, Printables, Thingiverse.
  - Tích hợp nút kích hoạt `ModelSearchDialog` trực tiếp trên Banner.
  - Hướng dẫn trực quan: Khách chọn mẫu -> Copy link -> Dán vào BaSa3D tính giá in ngay.

---

## 3. Review & Verification
- [x] `npm run lint` — passed 0 errors
- [x] `npm run typecheck` — passed 0 errors
- [x] `npm run check:arch` — passed 6 rules
- [x] `npx tsx --test tests/meta-engines.test.ts tests/trend-hunter.test.ts` — passed 6/6 tests
- [x] `npm run build` — Next.js 15.5 production build passed cleanly (exit code 0)
