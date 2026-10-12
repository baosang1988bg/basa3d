# Nghiên cứu: Báo giá in 3D tức thì cho BaSa3D

**Ngày:** 2026-10-12 · **Người viết:** Claude · **Trạng thái:** đề xuất, chờ Owner quyết định (§7)
**Liên quan:** ADR-0033 (giá MakerWorld đã duyệt), ADR-0034 (báo giá tức thì: dán thông số / file), `docs/exec-plans/active/makerworld-phase-b-storefront-estimate.md`

---

## 1. Tóm tắt (đọc phần này là đủ để quyết định)

1. **Có một lỗi chặn khi lên Production:** Vercel Functions giới hạn **4,5MB mỗi request — giới hạn cứng, không nâng được kể cả gói Pro/Enterprise**. Luồng upload hiện tại gửi file *qua* API của app ⇒ trên Vercel, mọi file > 4,5MB (đa số file .3mf/.stl thật) sẽ lỗi 413. Ở máy local không thấy lỗi này. **Phải sửa trước khi mở báo giá từ file cho khách.**
2. **Supabase gói Free giới hạn 50MB/file** (Pro: tới 500GB). File 60MB không lưu được trên Free trừ khi nén (chỉ STL nén tốt).
3. **Không cần upload để báo giá.** Thông tin để tính giá chỉ vài KB: `slice_info` trong .3mf đã slice, hoặc thể tích hình khối. Đọc ngay trên trình duyệt khách ⇒ giá trong 1–3 giây với file 60MB, không tốn băng thông, không chạm giới hạn nào.
4. **Muốn giá chính xác cho file chưa slice (file dự án MakerWorld, STL)** thì chỉ có một cách đáng tin: **chạy slicer thật (OrcaSlicer/Bambu Studio CLI) trên một máy chủ riêng** với đúng profile máy của xưởng (P1S/P2S/A1…). Vercel không chạy được; Cloud Run/Fly.io chạy được, chi phí ~0,003 USD/lần slice.
5. **Đề xuất:** làm theo 3 lớp — (1) giá tức thì trên trình duyệt, (2) giá chính xác bằng slicer chạy nền 10 giây–2 phút, (3) xưởng xác nhận giá chính thức (đã có). Chia 2 đợt: đợt 1 sửa lỗi upload + tính trên trình duyệt (~1,5 ngày), đợt 2 slicer server (~3–5 ngày).
6. Trên thị trường Việt Nam đã có xưởng báo giá tự động từ STL (in3dtudonghoa.com — xem §9: tính theo khối lượng ước tính × đơn giá/gram, phân tích ngay trên trình duyệt). Phần lớn xưởng khác vẫn báo giá thủ công. Muốn cạnh tranh cần ít nhất ngang mức đó, và hơn ở chỗ hỗ trợ .3mf/MakerWorld và tính cả thời gian in.

---

## 2. Bài toán & yêu cầu

- Khách: tải file (tới **60MB**, thường .3mf từ MakerWorld/Bambu Studio, hoặc .stl/.obj) hoặc dán link MakerWorld → **thấy giá ngay** → ưng thì mới để lại liên hệ.
- Xưởng: giá phải **chuẩn theo cách admin tính** (cùng `pricing_configs`, giá nhựa, hao phí, công — `makerworld-pricing.ts`), không lộ cấu trúc chi phí/margin, không để khách "ép giá" bằng dữ liệu giả, chi phí vận hành thấp.

---

## 3. Giới hạn nền tảng (đã kiểm chứng tài liệu chính thức)

| Nền tảng | Giới hạn | Hệ quả cho BaSa3D |
|---|---|---|
| Vercel Functions (Route Handler, Server Action) | **4,5MB body/request, cứng ở tầng hạ tầng**; vượt ⇒ 413 `FUNCTION_PAYLOAD_TOO_LARGE`. Vercel khuyên upload thẳng từ trình duyệt lên kho lưu trữ. | `/api/public/custom-requests/attachments` hiện **hỏng với file > 4,5MB trên Production** — kể cả mức 20MB đang khai báo. |
| Supabase Storage — Free | **50MB/file** (Global file size limit), 1GB tổng | File 60MB cần Pro, hoặc nén (STL giảm ~60–70%; .3mf đã là ZIP nên gần như không giảm). |
| Supabase Storage — Pro+ | tới 500GB/file; giới hạn từng bucket ≤ giới hạn global | Đặt giới hạn bucket `custom-request-attachments` ~100–200MB. |
| Supabase signed upload URL | Server tạo token (`createSignedUploadUrl`), trình duyệt `uploadToSignedUrl` — file **không đi qua server**. Token sống 2 giờ; dùng được cho TUS (upload nối tiếp được, header `x-signature`, tới 24 giờ). | Cách chuẩn để vượt giới hạn 4,5MB mà vẫn giữ bucket riêng tư và path do server quyết định. |
| Vercel Blob (client upload) | Cũng bỏ qua 4,5MB bằng token phía server | Không cần — đã có Supabase Storage. |

---

## 4. Các cách báo giá đang có trên thị trường

| Cách | Ai dùng | Độ chính xác | Nhận xét |
|---|---|---|---|
| Theo thể tích / khối lượng / bounding box × đơn giá, có bậc giá | Plugin WordPress (3DPrint Lite), app Shopify (PrintPrice, PrintQuote), dịch vụ như FacFox (không công bố công thức) | Thấp–trung bình: không biết infill, support, thời gian thật | Rẻ, tức thì. Là cách BaSa3D đang dùng cho STL (khoảng giá). |
| Chạy slicer thật trên server (Orca/Prusa CLI) rồi đọc thời gian + gram | Prodaxis (gateway trả giá, thời gian, chiều dài nhựa), backend OrcaSlicer cho WooCommerce, Printago (chạy nguyên bản Orca CLI, khẳng định thời gian khớp bản desktop) | **Cao nhất** — bằng đúng con số xưởng thấy khi slice | Cần máy chủ riêng + hàng đợi; CLI ít tài liệu chính thức, cần thử nghiệm. |
| Gọi API của bên thứ ba | Slant3D API (gửi link STL, trả **giá của họ**, không trả thời gian/gram); SimplyPrint (API chỉ ở gói Pro trở lên, upload tới 100MB/request); 3DPrinterOS (cloud slicing, ước tính ở giao diện, chưa thấy API báo giá) | Giá theo xưởng *của họ*, không phải giá BaSa3D | Không phù hợp: không dùng được công thức/giá nhựa của xưởng, phụ thuộc bên ngoài, gửi file khách ra ngoài. |
| Slicer chạy trong trình duyệt | Kiri:Moto (engine riêng, JS) | Không khớp profile Orca/Bambu; engine không trả sẵn thời gian (phải tự phân tích G-code) | Không khuyến nghị cho báo giá. |
| Báo giá thủ công | Phần lớn xưởng tại Việt Nam (ví dụ 3DMan liệt kê trên Trang Vàng: gọi điện để báo giá) | Tuỳ người | Đây là khoảng trống thị trường BaSa3D có thể chiếm. |

**Độ chính xác tham khảo:**
- Bản thân thời gian slicer ước tính đã lệch so với thực tế: người dùng Cura ghi nhận trung bình thấp hơn ~8% trên 34 lần in (lệch lớn nhất ở bản in ngắn); người dùng Bambu thấy lệch 10–20% cả hai chiều. ⇒ Ngay cả cách "chính xác nhất" cũng nên coi là **ước tính**, xưởng xác nhận giá cuối.
- Nghiên cứu SliceHub: nội suy thời gian in từ ít mẫu slice có sai số 36% (4/256 profile) → 2% (81/256 profile). ⇒ Ước tính không qua slicer (như theo thể tích) có sai số lớn; muốn chuẩn phải slice.
- Chưa tìm thấy nghiên cứu so sánh trực tiếp "theo thể tích" với "theo slicer". Hệ số khoảng giá STL hiện tại (in đặc 35–75% thể tích) là **giả định**, cần hiệu chỉnh bằng dữ liệu đơn thật (§6.4).

---

## 5. Phân tích file của khách

| Loại file | Có gì bên trong | Giá tính được |
|---|---|---|
| `.gcode.3mf` / .3mf đã slice (Bambu/Orca, "Export plate sliced file") | `Metadata/slice_info.config`: thời gian + gram từng màu, từng plate (vài KB) | **Chính xác theo slicer**, đọc được ngay trên trình duyệt |
| .3mf dự án (tải từ MakerWorld, chưa slice) | Hình khối (`3D/3dmodel.model`, `3D/Objects/*.model`), cài đặt in, ảnh thumbnail (phần lớn dung lượng) | Khoảng giá theo thể tích; **chính xác chỉ khi slice ở server** |
| .stl / .obj | Chỉ hình khối | Khoảng giá theo thể tích; chính xác khi slice ở server |
| .step / ảnh | Không slice trực tiếp được (STEP cần chuyển đổi) | Xưởng báo giá |

Đọc .3mf 60MB trên trình duyệt **không cần nạp cả file**: ZIP có mục lục ở cuối file, thư viện truy cập ngẫu nhiên (ví dụ `unzipit`) chỉ đọc mục lục rồi đọc đúng `slice_info.config`. `unzipSync` của fflate (đang dùng ở server) cần cả file trong bộ nhớ — vẫn chạy được nhưng tốn RAM với file lớn.

---

## 6. Kiến trúc đề xuất — 3 lớp

```
Khách chọn file (≤ 60MB)
  │
  ├─► Lớp 1 — TỨC THÌ (trình duyệt, 1–3 giây, không upload)
  │     Web Worker đọc: slice_info (nếu có) hoặc thể tích hình khối
  │     → POST /api/public/instant-estimate { kind, minutes, gramsByMaterial, plates | volumeCm3 }
  │     → server tính giá bằng makerworld-pricing.ts (cấu hình giá giữ bí mật) → hiển thị "~giá" / "khoảng giá"
  │
  ├─► Upload gốc: trình duyệt → Supabase Storage trực tiếp (signed upload URL, TUS cho file lớn, có thanh %)
  │     Bắt đầu chạy ngầm ngay khi chọn file; khách vừa xem giá vừa điền liên hệ.
  │
  ├─► Lớp 2 — CHÍNH XÁC (server slicer, 10 giây–2 phút, đợt 2)
  │     Upload xong → tạo job → Slicer worker (OrcaSlicer CLI trong Docker, profile máy của xưởng)
  │     → đọc thời gian + gram thật → cập nhật giá "Giá chính xác theo máy P2S: X" (trang tự cập nhật)
  │
  └─► Lớp 3 — XÁC NHẬN (đã có): staff xem file + giá tự động trong admin, chốt báo giá chính thức
```

### 6.1 Lớp 1 — tính trên trình duyệt (đợt 1)
- Chuyển phần đọc file (`threemf-slice-info`, `mesh-volume`) sang chạy được ở trình duyệt, trong Web Worker để không đơ trang. Với .3mf dùng thư viện đọc ZIP truy cập ngẫu nhiên.
- Endpoint mới chỉ nhận **con số**, giới hạn chặt (Zod: phút ≤ 20.000, gram ≤ 20.000, ≤ 16 màu, thể tích hợp lý), rate-limit, làm tròn 5.000đ, gắn nhãn "ước tính".
- Rủi ro: khách sửa con số để ra giá thấp — cùng mức đánh đổi Owner đã chấp nhận ở ADR-0034 (dán thông số). Chặn bằng: giá chỉ là ước tính; server **tính lại từ file gốc** khi khách gửi yêu cầu (đọc `slice_info` chỉ vài KB; file ≤ 50MB tải về trong function được) và ghi chênh lệch cho staff.

### 6.2 Upload thẳng lên kho lưu trữ (đợt 1 — bắt buộc trước Production)
- `POST /api/public/custom-requests/upload-url` → server tạo path ngẫu nhiên `requests/<uuid>.<ext>` + signed upload token (kiểm tra đuôi file, kích thước khai báo, rate-limit theo IP như hiện tại).
- Trình duyệt `uploadToSignedUrl` (hoặc TUS khi > ~6MB để upload nối tiếp được khi mạng chập chờn).
- Đặt `file_size_limit` cho bucket bằng migration; giới hạn đọc từ một hằng cấu hình (mặc định 50MB, lên Pro thì đổi 1 số).
- STL: nén gzip trên trình duyệt trước khi upload (giảm ~60–70%), server/staff giải nén khi tải.
- Gỡ đường upload cũ qua `/api/public/custom-requests/attachments` (hoặc chỉ giữ cho ảnh nhỏ).

### 6.3 Lớp 2 — slicer trên server (đợt 2)
- **Công cụ:** OrcaSlicer CLI (cùng họ với Bambu Studio, dùng chung cờ): `--slice 0 --load-settings "machine.json;process.json" --load-filaments "filament.json" --export-3mf out.gcode.3mf input.3mf` rồi đọc `slice_info.config` của file xuất — **dùng lại đúng parser đang có**.
- **Profile:** xuất từ Bambu Studio của xưởng các file JSON: máy (P1S, P2S, A1…), process (0.2mm, 2 tường, 15% infill — mặc định của xưởng), filament PLA/PETG. Khách chọn máy/vật liệu → chọn bộ profile tương ứng.
- **Hạ tầng:** Vercel không chạy được (binary nặng, slice lâu). Lựa chọn:
  - **Google Cloud Run Jobs** — trả theo giây; ước tính ~0,0026 USD cho 1 lần slice 2 phút (1 vCPU, 2GB), và gói miễn phí hằng tháng (180.000 vCPU-giây) đủ cho hàng nghìn lần slice. Khuyến nghị.
  - Fly.io Machines / VPS nhỏ — đơn giản hơn nhưng trả tiền cả khi rảnh.
- **Hàng đợi:** bảng `slice_jobs` trong Postgres (queued/running/done/failed) + webhook/cron gọi worker; trang khách poll mỗi 2–3 giây hoặc dùng Supabase Realtime.
- **Rủi ro đã biết (cần spike thử trước):** CLI gần như không có tài liệu chính thức; Bambu Studio trên server headless đòi màn hình ảo (Xvfb); bản Flatpak bỏ qua preset ngoài; có báo cáo crash/không ra file; cần đặt timeout (≤ 10 phút), giới hạn RAM, chỉ nhận file đã qua kiểm tra; khoá phiên bản slicer để kết quả ổn định.
- **Chống lạm dụng:** chỉ slice file đã upload qua token của mình, giới hạn số job/IP/giờ và ngân sách toàn cục/ngày; cache theo hash file + profile (cùng file không slice lại).

### 6.4 Hiệu chỉnh độ chính xác (liên tục)
- Lưu cho mỗi đơn: giá tự động (lớp 1/2) và giá chốt + thời gian in thực tế từ máy (print job).
- Mỗi tháng so sánh, chỉnh: hệ số in đặc của STL (đang giả định 35–75%), hệ số bù sai số thời gian slicer (có thể +10%), hao phí.

---

## 7. Quyết định cần Owner chốt

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Sửa upload thẳng lên Storage (bắt buộc cho Production) ngay đợt 1? | **Có** — không làm thì báo giá từ file không chạy trên Vercel. |
| Q2 | Supabase Pro (~25 USD/tháng, đã có trong go-live plan để backup) để nhận file > 50MB? | **Có, khi lên Production.** Trước đó: giới hạn 50MB + nén STL; .3mf > 50MB khuyên khách gửi link Drive. |
| Q3 | Làm Lớp 2 (slicer server) không? | **Có, sau đợt 1**, bắt đầu bằng spike 1 ngày: chạy Orca CLI trong Docker với 3 file thật (1 .3mf MakerWorld 60MB, 1 STL, 1 project nhiều plate), đo thời gian/RAM/độ khớp với bản desktop. Spike thất bại thì giữ Lớp 1 + xưởng xác nhận. |
| Q4 | Máy mặc định để báo giá file chưa slice? | **P2S** (theo nhu cầu bạn nêu), process 0.2mm/15% infill; khách đổi được nếu muốn. |
| Q5 | Hạ tầng slicer | **Cloud Run Jobs** (rẻ nhất khi lưu lượng thấp, không trả tiền lúc rảnh). |

---

## 8. Kế hoạch triển khai

| Đợt | Việc | Ước lượng | Kết quả |
|---|---|---|---|
| 1a | Upload thẳng Supabase (signed URL/TUS), thanh tiến trình, giới hạn cấu hình được, gzip STL, migration giới hạn bucket | 0,5–1 ngày | File lớn lên Production được |
| 1b | Đọc file trên trình duyệt (Worker) + endpoint giá theo số liệu + kiểm tra lại từ file gốc khi gửi | 1 ngày | Giá trong 1–3 giây cho file 60MB |
| 2a | Spike slicer: Docker + Orca CLI + profile xưởng, đo đạc | 1 ngày | Quyết định đi tiếp/dừng |
| 2b | Worker Cloud Run + bảng `slice_jobs` + cập nhật giá trên trang + chống lạm dụng | 2–3 ngày | Giá chính xác theo máy P2S cho mọi file |
| 3 | Lưu số liệu & báo cáo so sánh giá tự động vs giá chốt | 0,5 ngày | Hiệu chỉnh hằng tháng |

---

## 9. Đối thủ trong nước: in3dtudonghoa.com (3D Việt Production, Đồng Nai) — khảo sát 2026-10-12

Thử bằng 1 file STL khối lập phương 40 mm (64 cm³), **không tạo đơn**. Mục này sửa lại kết luận ở §1 điểm 6: đã có ít nhất 1 xưởng VN báo giá tự động từ STL.

**Luồng (4 bước: Tải mẫu → Cấu hình → Báo giá → Xác nhận):**
- Kéo thả **một hoặc nhiều** file STL/OBJ; ghi rõ *"File chỉ tải lên khi bạn tạo đơn"* — phân tích ngay trên trình duyệt (đúng hướng Lớp 1 ở §6).
- Xem trước 3D xoay/phóng to, hiện kích thước X/Y/Z, **thể tích**, cho **chỉnh kích thước (scale)**.
- Có giá ngay sau khi tải (mặc định PETG, infill 15%), cột tóm tắt bên phải cập nhật trực tiếp.
- Cấu hình: FDM (PLA/PETG, hiện **đơn giá/gram** trước & sau VAT) hoặc Resin; **độ đặc 10/15/20/30%**; màu (ngẫu nhiên/đen/trắng).
- Số lượng có **mốc giảm giá** ("thêm 9 sản phẩm để giảm 5%"), phí vận chuyển, VAT 8%, mã ưu đãi, **tải PDF báo giá**; bước cuối: địa chỉ + voucher → "Tạo yêu cầu thanh toán".

**Công thức giá suy ngược (khớp đến từng đồng với 4 lần thử):**

| Cấu hình | Khối lượng mẫu | Giá 1 sp (gồm VAT) |
|---|---|---|
| PETG, infill 10% | 18,00 g | 14.583đ |
| PETG, infill 15% | 21,52 g | 17.430đ |
| PETG, infill 30% | 32,06 g | 25.973đ |
| PLA, infill 10% | 17,72 g | 19.138đ |

- Khối lượng = khối lượng riêng × (**vỏ** + phần ruột × infill). Với khối 40 mm: vỏ ≈ 8,6 cm³ ≈ diện tích bề mặt 96 cm² × **~0,9 mm**, ruột phần còn lại. Khối lượng riêng PETG ≈ 1,27, PLA ≈ 1,25.
- Cộng **support cố định 25%** khối lượng (bất kể hình dạng).
- Giá = tổng gram × **đơn giá/gram** (PLA 800đ, PETG 600đ, Resin 4.000đ, trước VAT) × 1,08. **Không có thành phần thời gian máy/công.**

**Đánh giá:**
- Điểm mạnh nên học: phân tích trên trình duyệt (không upload), xem trước 3D + kích thước, chỉnh scale, chọn infill → **ra 1 con số thay vì khoảng giá**, nhiều file, mốc giảm giá theo số lượng, PDF báo giá, thanh tóm tắt luôn hiển thị.
- Điểm yếu: không tính thời gian in → mẫu cao/mảnh/nhiều chi tiết (in lâu, ít nhựa) bị báo giá thấp; support 25% cố định không theo hình dạng; không xử lý .3mf (file MakerWorld/Bambu).
- **Áp dụng cho BaSa3D:** dùng mô hình khối lượng "vỏ + ruột × infill" thay cho hệ số 35–75% hiện tại (cho 1 giá thay vì khoảng giá), cho khách chọn infill/scale; **giữ engine cost-plus của BaSa3D** (có thời gian máy + công) nhưng cần ước lượng thời gian in từ hình khối — tạm dùng công thức theo gram rồi hiệu chỉnh bằng dữ liệu đơn thật (§6.4), về lâu dài dùng slicer (Lớp 2). Chỉ học ý tưởng/luồng, không sao chép mã, nội dung hay nhận diện của họ.

---

## Nguồn

- Vercel — giới hạn 4,5MB và cách vượt: [How to bypass Vercel body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [How to upload and store files with Vercel](https://vercel.com/kb/guide/vercel-file-uploads), [File upload returning 413 (community)](https://community.vercel.com/t/file-upload-with-blob-returning-413/952)
- Supabase — giới hạn file: [Storage file limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [Pricing](https://supabase.com/pricing); upload trực tiếp: [createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [Resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [Storage v3 resumable uploads](https://supabase.com/blog/storage-v3-resumable-uploads), [Storage 500GB uploads](https://supabase.com/blog/storage-500gb-uploads-cheaper-egress-pricing)
- Slicer CLI: [Bambu Studio — Command Line Usage (wiki chính thức)](https://github.com/bambulab/BambuStudio/wiki/Command-Line-Usage), [OrcaSlicer wiki — CLI mode](https://www.orcaslicer.com/wiki/cli/cli_mode), [Printago — Orca Slicer CLI reference](https://printago.io/blog/orca-slicer-cli-reference), [Printago — Bambu Studio CLI reference](https://printago.io/blog/bambu-studio-cli-reference), [Printago — Orca in the cloud](https://printago.io/features/orca-slicer), [Printago — 3MF file format](https://printago.io/blog/3mf-file-format), [DeepWiki — OrcaSlicer CLI/headless](https://deepwiki.com/SoftFever/OrcaSlicer/10.2-cli-mode-and-headless-operation), [Bambu forum — CLI cannot apply external presets](https://forum.bambulab.com/t/cli-cannot-apply-external-presets/197842), [OrcaSlicer discussion #1603](https://github.com/SoftFever/OrcaSlicer/discussions/1603), [Prusa forum — duration & filament on CLI](https://forum.prusa3d.com/forum/prusaslicer/how-to-get-duration-and-filament-usage-on-cli/)
- Hạ tầng: [Cloud Run pricing](https://cloud.google.com/run/pricing?hl=cs), [Cloud Run pricing guide (Cloudchipr)](https://cloudchipr.com/blog/cloud-run-pricing)
- Dịch vụ/API báo giá: [Slicer API + WordPress instant quotes (Printables)](https://www.printables.com/article/slicer-api-with-wordpress-plugin-that-creates-inst-n5jba25), [Prodaxis Print Quote](https://wordpress.org/plugins/?p=334513), [SimplyPrint API](https://simplyprint.io/features/api), [Slant 3D API](https://www.fabbaloo.com/news/slant-3d-launches-api-for-direct-access-to-print-farms), [Price an STL on Slant3D](https://waylonwalker.com/price-an-stl-print-on-slant3d), [3DPrinterOS system description](https://3dprinteros.helpdocs.io/3dpos-basics/system-description), [3DPrint Lite](https://wordpress.org/plugins/3dprint-lite/), [FacFox — cost of 3D printing](https://facfox.com/docs/cost-of-3d-printing), [PrintPrice (Shopify)](https://apps.shopify.com/print-price?locale=tr), [IamRapid instant quotation](https://iamrapid.com/instant-quotation/), [Trang Vàng — dịch vụ in 3D](https://www.trangvangvietnam.com/products/395764391/dịch-vụ-in-3d.html)
- Đối thủ: [in3dtudonghoa.com — 3D Việt Production](https://in3dtudonghoa.com/) (khảo sát trực tiếp 2026-10-12)
- Slicer trong trình duyệt: [Kiri:Moto engine APIs](https://docs.grid.space/kiri-moto/engine-apis), [Kiri:Moto forum — metadata](https://forum.grid.space/t/get-model-metadata-from-engine-js/2953), [SimplyPrint — browser-based slicers](https://simplyprint.io/articles/browser-based-3d-slicer)
- Độ chính xác: [SliceHub (arXiv)](https://arxiv.org/pdf/2109.14722), [Bambu forum — inaccurate print times](https://forum.bambulab.com/t/inaccurate-print-times-can-we-tweak-settings-to-be-more-accurate/2546), [Ultimaker community](https://community.ultimaker.com/profile/383473-emustwin/), [Duet forum](https://forum.duet3d.com/post/102344)
- Đọc ZIP truy cập ngẫu nhiên: [unzipit](https://github.com/greggman/unzipit)
