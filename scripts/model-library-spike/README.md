# Model library spike (Phase 32 — giai đoạn 1, bước 0)

Script **offline** để kiểm chứng tính khả thi: từ một thư mục STL/3MF (ví dụ thư mục Google Drive
for desktop), tạo ảnh preview WebP + `manifest.json` + `gallery.html` để xem trên máy.

Không đụng DB, Supabase hay code app. Không có gì được publish ra ngoài.

## Cách hoạt động

| Loại file | Cách tạo ảnh |
|---|---|
| `.3mf` có ảnh nhúng | Lấy `Metadata/plate_1.png` (ảnh slicer render) → WebP. Nếu chỉ có `Auxiliaries/.thumbnails/*` (thường là ảnh cover của tác giả trên MakerWorld) thì vẫn lấy nhưng gắn cờ `designerCover: true`. |
| `.stl`, hoặc `.3mf` không có ảnh | Render headless bằng three.js trong Chromium (Playwright), camera tự canh theo bounding box, Z-up → Y-up. |

- Chạy lại sẽ **bỏ qua file đã xử lý** (so `bytes` + `mtime`), nên dừng giữa chừng rồi chạy tiếp được.
- Không thêm dependency mới: dùng `playwright`, `three`, `fflate` đã có trong repo.

## Chạy trên Mac

```bash
npx playwright install chromium   # nếu chưa cài browser cho E2E
node scripts/model-library-spike/generate-previews.mjs \
  --in "$HOME/Library/CloudStorage/GoogleDrive-<email>/My Drive/<thư mục mẫu>" \
  --out ./.model-previews --limit 50
open .model-previews/gallery.html
```

## Chạy trên Windows (PC)

```powershell
npx playwright install chromium
node scripts/model-library-spike/generate-previews.mjs --in "G:\My Drive\<thư mục mẫu>" --out .\.model-previews --limit 50
start .model-previews\gallery.html
```

## Tuỳ chọn

| Cờ | Mặc định | Ý nghĩa |
|---|---|---|
| `--limit N` | không giới hạn | Số file xử lý mới trong lần chạy này (demo nên để 50–200) |
| `--size` | 800 | Cạnh ảnh vuông (px) |
| `--quality` | 0.85 | Chất lượng WebP |
| `--max-mb` | 300 | Bỏ qua file lớn hơn (ghi `TOO_LARGE_*` vào manifest) |
| `--timeout` | 120 | Giây tối đa cho mỗi file |
| `--retry-errors` | tắt | Chạy lại các file từng lỗi |
| `--force-render` | tắt | Bỏ qua ảnh nhúng trong 3MF, luôn render (để so sánh chất lượng) |

## Lưu ý

- **Drive for desktop chế độ "Stream"** sẽ tải file về khi script đọc. Đọc 200 GB đồng nghĩa với tải
  200 GB, vì vậy demo nên trỏ vào 1 thư mục nhỏ hoặc dùng `--limit`.
- `.model-previews/` đã được thêm vào `.gitignore`. Không commit ảnh preview, vì kho có lẫn mô hình
  chưa rõ license (Phase 29).
- 3MF dạng Bambu nhiều object/plate: nếu không có ảnh nhúng, `ThreeMFLoader` của three có thể không
  đọc được hết. Các file này sẽ ghi lỗi trong manifest để thống kê, không làm dừng cả batch.

## Số liệu kiểm chứng (sandbox Linux, CPU render SwiftShader, 2026-10-08)

| File | Kết quả | Thời gian | Ảnh |
|---|---|---|---|
| STL nhị phân 0.6 MB, 12.8k tam giác | rendered | 0.9 s | ~10 KB |
| STL nhị phân 47.6 MB, 998k tam giác | rendered | 6.5 s | ~5 KB |
| STL ASCII | rendered | 0.2 s | ~6 KB |
| 3MF có `plate_1.png` | embedded | 0.3 s | ~5 KB |
| 3MF không có ảnh | rendered | 0.3 s | ~4 KB |
| File hỏng | ghi lỗi, batch chạy tiếp | 0.1 s | — |

Máy thật có GPU sẽ nhanh hơn. Thời gian thực tế phụ thuộc chủ yếu vào tốc độ Drive tải file về.
