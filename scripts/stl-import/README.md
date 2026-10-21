# Nhập kho STL → sản phẩm nháp (feature 003)

Chạy trên **máy OWNER**. Đọc thư mục Google Drive for desktop, đo + render 4 ảnh + ước giá, rồi (chỉ khi `--apply`)
tạo sản phẩm **DRAFT** để duyệt ở `/admin/stl-import`. Đặc tả: `specs/003-stl-bulk-import/`,
hợp đồng cờ: `specs/003-stl-bulk-import/contracts/cli-import-stl.md`.

## Chạy

```bash
# 1) Chạy thử (mặc định, không ghi gì). DB chỉ được đọc để biết mẫu nào đã nhập.
npx tsx --env-file=.env.local scripts/stl-import/import-stl.ts --in "/Users/<bạn>/Google Drive/My Drive/STL" --limit 50
open .stl-import/report.html

# 2) Ghi thật khi báo cáo ổn
npx tsx --env-file=.env.local scripts/stl-import/import-stl.ts --in "…/STL" --limit 50 --apply
```

Windows (PowerShell): giống hệt, đường dẫn dạng `"G:\My Drive\STL"`; render dùng Chrome đã cài (`channel: chrome`).

Script **không tự nạp** `.env*` — luôn truyền `--env-file`. Cần `DATABASE_URL`; `--apply` cần thêm
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (chỉ dùng để upload/xoá ảnh `.webp` trong bucket
`product-images`; file STL gốc **không bao giờ** được tải lên).

## Cờ hay dùng

| Cờ | Ý nghĩa |
|---|---|
| `--limit <n>` | Số mẫu tối đa mỗi lần (Drive chế độ *Stream* tải file khi đọc) |
| `--only "Figures/**"` | Chỉ xử lý đường dẫn khớp glob |
| `--group-by folder\|file` | Gom theo thư mục lá (mặc định, đổi bằng `groupBy` trong `category-map.json`) hoặc mỗi file một mẫu |
| `--views 2` | 2 ảnh/sản phẩm thay vì 4 (khi bucket gần đầy) |
| `--retry-errors` | Xử lý lại các mẫu lỗi |
| `--map <file>` | File ánh xạ thư mục → danh mục khác `category-map.json` |
| `--no-render` | Chạy thử không mở Chromium (chỉ đo + đặt tên + giá) |

## Ánh xạ danh mục

`category-map.json`: mỗi rule so `folderPattern` với từng tên thư mục cha (không phân biệt hoa thường/dấu), thư mục sâu
nhất thắng. `categorySlug` phải là danh mục có sẵn; `skuCode` là tiền tố SKU. Không khớp → "Chưa phân loại"
(ẩn khỏi storefront, và sản phẩm không được duyệt lên web cho tới khi đổi danh mục).

## Chạy lại

An toàn: mẫu không đổi bị bỏ qua; file đổi → chỉ ảnh + số đo của bản nháp được làm lại (tên/giá/danh mục/bản quyền admin
đã sửa giữ nguyên); mẫu đã lên web chỉ được gắn cờ "nguồn đã đổi"; mẫu bị từ chối không bao giờ được tạo lại.
Đổi tên/di chuyển file trên Drive = mẫu mới.

Mã thoát: `0` xong (kể cả có mẫu lỗi) · `1` lỗi cấu hình/kết nối/đang có lần `--apply` khác · `2` cờ sai ·
`3` chặn vì ước tính bucket > 950 MB (`--allow-storage-over` để bỏ qua).
