# Deploy lên Netlify Free (ADR-0054)

Trạng thái: **thử nghiệm** trên branch `chore/netlify-free`. Vercel vẫn chạy được như cũ (`vercel.json`
giữ nguyên), nên có thể chạy song song hai bản để so sánh trước khi chuyển domain.

## 1. Tạo site

1. Netlify → Add new project → Import from Git → chọn repo BaSa3D (nên là GitHub org riêng của BaSa3D).
2. Branch to deploy: tạm chọn `chore/netlify-free`. Build settings được đọc từ `netlify.toml`
   (`npm run build`, publish `.next`, Node 22), không cần nhập tay.
3. Netlify tự nhận Next.js và dùng runtime Next.js có sẵn của nó. **Không** cần cài thêm adapter.

## 2. Biến môi trường

Netlify → Site configuration → Environment variables. Scope: **Builds + Functions + Runtime**.
Danh sách giống bảng "Biến môi trường bắt buộc" trong `deployment.md`:

| Biến | Ghi chú |
|---|---|
| `DATABASE_URL` | Supabase **Session Pooler** (xem README) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | |
| `ORDER_CONFIRMATION_SECRET`, `UPLOAD_CLAIM_SECRET` | sinh mới, 64 hex, hai giá trị KHÁC nhau |
| `CRON_SECRET` | sinh mới, ≥ 16 ký tự. Scheduled Function đọc biến này lúc runtime |
| `NEXT_PUBLIC_SITE_URL` | origin chuẩn, không có `/` cuối. Cron gọi tới origin này (fallback: `URL` của Netlify) |
| Các `NEXT_PUBLIC_*` feature flag khác | copy từ Vercel |

Đổi bất kỳ `NEXT_PUBLIC_*` nào thì phải **redeploy**, vì các biến này được nhúng vào bundle lúc build.

## 3. Kiểm tra sau deploy (smoke test)

- [ ] `GET /api/version`: `channel` là `preview` (branch/PR deploy) hoặc `production`, `commit` khớp HEAD.
- [ ] Trang chủ, catalog, `/checkout`, trang xác nhận đơn (VietQR hiện ảnh) chạy bình thường.
- [ ] Rate limit: gọi liên tục một route công khai (ví dụ tra cứu đơn) phải nhận 429. Đây là bằng chứng
      `x-nf-client-connection-ip` đang được đọc. Nếu mọi request đều chung bucket `unknown` thì
      sẽ 429 cho tất cả mọi người. Khi đó dừng lại và kiểm tra header.
- [ ] Functions → `cleanup-orphan-uploads` → **Run now**, log phải có `[NETLIFY_CRON_OK]`.
- [ ] Upload file ở `/custom-print` và `/bao-gia` (cần `UPLOAD_CLAIM_SECRET`).

## 4. Domain (Cloudflare B, DNS-only)

Giống checklist Cloudflare trong `deployment.md`, chỉ thay Vercel bằng Netlify: thêm domain trong
Netlify → Domain management, lấy bản ghi Netlify đưa ra rồi tạo trong Cloudflare ở chế độ
**DNS only** (đám mây xám). Không bật proxy Cloudflare: `getClientIp()` trên Netlify chỉ tin
`x-nf-client-connection-ip`. Nếu bật proxy thì IP thật sẽ là IP của Cloudflare.

## 5. Chưa xử lý (xem ADR-0054)

- Rule rate-limit của Vercel Firewall cho `/api/public/makerworld-estimate` chưa có bản tương đương
  trên Netlify. Giữ card này ở đường VERIFIED.
- `makerworld-screenshot-estimate` cần tới 45 giây. Kiểm tra timeout function của gói free trước khi bật.
- Theo dõi credit của gói free. Khi hết credit, site sẽ tạm dừng tới chu kỳ sau.
