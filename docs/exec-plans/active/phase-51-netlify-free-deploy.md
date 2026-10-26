# Phase 51 — Deploy BaSa3D lên Netlify Free (ADR-0054)

Branch: `chore/netlify-free` (tách từ `dev` @ `e90ea65`). Owner: Sangcarmd. Bắt đầu: 2026-10-26.

## Brief

- **Mục tiêu:** chạy Production thương mại với chi phí hosting $0. Vercel Hobby cấm dùng thương mại,
  Vercel Pro tốn $20/tháng.
- **Không làm:** đổi database (Supabase giữ nguyên), bật proxy Cloudflare, chia tính năng production
  ra hai host, migrate sang Cloudflare Workers.
- **Đầu vào:** code đang chạy trên Vercel, Supabase Free, Cloudflare account B (domain, DNS-only).
- **Đầu ra:** site Netlify chạy cùng codebase. Production trỏ domain về Netlify. UAT dùng Netlify
  Deploy Previews. Project Vercel được tắt.
- **Rủi ro:** header IP cho rate limit, timeout function, sai biến môi trường, hết credit gói free.
- **Definition of Done:** mọi checkbox S0–S6 là `[x]`, smoke script pass trên Production, chạy
  1 tuần không có lỗi 5xx bất thường. Sau đó đóng phase bằng `close-phase`.

## Quyết định cần chốt trước khi làm

- [ ] **D1 — Backup DB (Supabase Free không có backup tự động).** Đề xuất: GitHub Action chạy
      `supabase db dump` mỗi ngày, lưu thành artifact private (giữ 30 ngày). Cần thêm secret
      `SUPABASE_DB_URL` vào GitHub. Cách khác: tự dump bằng tay mỗi tuần. → Owner chọn.
- [ ] **D2 — Account Netlify:** dùng team riêng cho BaSa3D (khuyến nghị) hay account cá nhân.
- [ ] **D3 — Tên miền UAT:** `uat.<domain>` (Branch deploy) hay chỉ dùng link Deploy Preview của từng PR.

## Slices

### S0 — Code chạy được trên cả hai host ✅ (Claude, commit `fed2d6b`)
- [x] `netlify.toml` (Node 22, Next.js runtime)
- [x] Scheduled Function thay cron trong `vercel.json`, có test chống lệch lịch
- [x] `BASA3D_DEPLOY_PLATFORM` cố định lúc build; Netlify chỉ tin `x-nf-client-connection-ip`
- [x] Netlify `CONTEXT`/`COMMIT_REF` → channel và commit trong `/api/version`
- [x] Speed Insights chỉ bật trên Vercel
- [x] ADR-0054 và runbook `docs/operations/deploy-netlify.md`

### S1 — Công cụ kiểm tra sau deploy ✅ (Claude)
- [x] `scripts/deploy/smoke-netlify.mjs`: version/commit, security headers, cron fail-closed,
      `--cron` (chạy thật bằng `CRON_SECRET`), `--rate-limit` (gửi IP giả, phải nhận 429)
- [x] Test cho phần logic thuần (`tests/netlify-deploy.test.ts`)

### S2 — Kiểm tra trên máy (Owner, ~15 phút)
- [ ] `git checkout chore/netlify-free && npm run build && npm test` (cần DB test)
- [ ] Kiểm tra lại các worktree sau sự cố `git worktree prune` (xem mục Ghi chú)

### S3 — Dựng site Netlify (Owner, ~1 giờ)
- [ ] Tạo account/team Netlify (theo D2). Kết nối GitHub, **chỉ cấp quyền repo BaSa3D**
- [ ] Import repo, branch `chore/netlify-free`, xác nhận build settings đọc từ `netlify.toml`
- [ ] Nhập biến môi trường theo runbook §2. Scope gồm **Builds + Functions + Runtime**. Secret
      (`ORDER_CONFIRMATION_SECRET`, `UPLOAD_CLAIM_SECRET`, `CRON_SECRET`) phải **sinh mới**
- [ ] Trỏ `DATABASE_URL` vào **Supabase dev** trong lúc thử, chưa dùng DB production
- [ ] Deploy lần đầu thành công, build log không có lỗi

### S4 — Smoke test (Owner + script, ~45 phút)
- [ ] `node scripts/deploy/smoke-netlify.mjs https://<site>.netlify.app`: mọi check PASS
- [ ] `CRON_SECRET=... node scripts/deploy/smoke-netlify.mjs <url> --cron`: PASS
- [ ] `node scripts/deploy/smoke-netlify.mjs <url> --rate-limit`: PASS (429 sau khoảng 31 request)
- [ ] **Kiểm tra chéo rate limit:** dùng một mạng khác (4G) mở trang tra cứu đơn ngay sau bước trên.
      Phải **không** bị 429. Nếu bị, nghĩa là mọi người đang dùng chung bucket `unknown` → BLOCKER,
      dừng lại, gửi request headers cho Claude
- [ ] Netlify → Functions → `cleanup-orphan-uploads` → **Run now**, log có `[NETLIFY_CRON_OK]`
- [ ] Thao tác tay: trang chủ, catalog, `/checkout` → trang xác nhận đơn (VietQR hiện ảnh), upload ở
      `/custom-print` và `/bao-gia`, `/tools/*` tạo file 3D, đăng nhập admin
- [ ] So sánh tốc độ tải trang admin giữa Netlify và Vercel (cùng DB). Chậm hơn rõ rệt thì kiểm tra
      region của function (R3)

### S5 — Merge (Owner)
- [ ] Mở PR `chore/netlify-free` → `dev`, review theo BLOCKERS / IMPORTANT / NICE TO HAVE
- [ ] Merge. Netlify Production branch chuyển sang branch release (`main`)

### S6 — Go-live (Owner, làm cùng go-live plan)
- [ ] Chạy D1 (backup) **trước** khi có đơn hàng thật
- [ ] Biến môi trường Production của Netlify trỏ vào **Supabase production**
- [ ] Gắn domain: Netlify → Domain management, bản ghi tạo trong Cloudflare B ở chế độ **DNS only**
- [ ] `NEXT_PUBLIC_SITE_URL` = domain thật, redeploy, chạy lại toàn bộ S4 trên domain thật
- [ ] Chuyển UAT sang Deploy Previews / Branch deploy (D3)
- [ ] Chạy ổn 1 tuần → tắt project Vercel (giữ `vercel.json` trong repo để quay lại được)
- [ ] Cập nhật `docs/roadmap.md`, `docs/exec-plans/active/go-live-deployment-plan.md` (Non-goal
      "changing hosting provider" không còn đúng)

## Rủi ro mở

| ID | Rủi ro | Cách xử lý |
|---|---|---|
| R1 | Header IP trên Netlify khác giả định (chưa đọc được docs chính thức) | S4: kiểm tra `--rate-limit` và kiểm tra chéo bằng 4G |
| R2 | `makerworld-screenshot-estimate` cần 45 giây, có thể vượt timeout của gói free | Thử trên site. Bị cắt thì để `MAKERWORLD_SCREENSHOT_ESTIMATE_ENABLED` tắt trên Netlify |
| R3 | Function chạy ở Mỹ, Supabase ở châu Á → chậm | So sánh với Vercel (hiện cũng ở Mỹ). Nếu cần thì đổi region |
| R4 | Không có rule rate limit kiểu Vercel Firewall cho `/api/public/makerworld-estimate` | Giữ card ở đường VERIFIED, không bật resolver công khai |
| R5 | Hết credit gói free → site tạm dừng | Bật cảnh báo usage trong Netlify. Theo dõi tháng đầu |
| R6 | Điều khoản Netlify thay đổi | Owner đọc lại Terms trước khi go-live |

## Ghi chú

- 2026-10-26: trong lúc tạo branch, `git worktree prune` chạy trong sandbox đã xoá metadata của 4
  worktree (`ai-pipeline`, `public-pricing-tab`, `pool-basa3d-P7296-0`, `BaSa3D-swarm/004…`).
  Metadata đã được dựng lại, file không mất. Riêng thay đổi đã **staged** trong các worktree đó
  (nếu có) giờ thành unstaged.
