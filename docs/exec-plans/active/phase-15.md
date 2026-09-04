# Phase 15 — Staff Operational Notifications (Email qua Resend)

> **Mục đích**: Đóng khoảng trống "staff không biết có việc mới cho tới khi tự vào `/admin` kiểm
> tra" — điểm nghẽn thật làm giảm giá trị của Phase 13 ("5 phút báo giá" vô nghĩa nếu staff không
> biết có custom request mới ngay khi nó tới).

---

## 1. Rà soát hiện trạng

- `.env.example` có sẵn dòng `# RESEND_API_KEY=` nhưng bị comment — biến env đã được dự trù từ
  trước nhưng chưa dùng.
- `package.json` chưa có package `resend` (hay bất kỳ SDK email nào).
- Grep toàn repo: không có đoạn code gửi email nào tồn tại.
- Kênh báo hiện tại duy nhất là badge đếm trong `admin-nav.tsx` (Phase 11, `getOperationalMetrics()`)
  — chỉ hiện khi staff **đã** mở `/admin`, hoàn toàn passive, không chủ động kéo ai vào.
- 2 nguồn phát sinh việc mới cần notify: `custom_requests` (kể cả từ form public
  `POST /api/public/custom-requests`, Phase 4) và `orders` (`POST /api/orders`, `POST
  /api/public/orders`).

---

## 2. Goal & Non-goals

### Goal
1. Khi có `custom_request` hoặc `order` mới, toàn bộ `staff_profiles` đang `is_active = true` nhận
   được email trong vài giây.
2. Lỗi gửi email (mạng, rate limit Resend, sai cấu hình) **không bao giờ** làm fail hoặc rollback
   request tạo đơn/tạo custom request.

### Non-goals
- **Không notify khách hàng** — Phase 13 đã giải quyết kênh khách qua nút "Copy Zalo" thủ công,
  không lặp lại logic đó ở đây.
- **Không làm SMS/Zalo OA ZNS trả phí** — giữ nguyên quyết định Non-goal đã có ở Phase 13.
- **Không làm real-time/WebSocket/push trình duyệt** — email là đủ cho quy mô hiện tại (1 owner, ít
  staff).
- **Không làm queue/background job** (Rule #8 AGENTS.md) — volume hiện còn thấp, gọi Resend trực
  tiếp là đủ; nếu sau này volume tăng cao, đó là quyết định của 1 phase khác dựa trên số liệu thật
  đo được.
- **Không gộp digest theo giờ/ngày** ở v1 — mỗi sự kiện 1 email tức thời; digest chỉ cân nhắc nếu đo
  được volume vượt ngưỡng khó chịu.

---

## 3. Quyết định kỹ thuật đề xuất (tentative — chưa qua AI challenge)

1. **Vị trí gọi gửi email — sau khi transaction commit, không phải bên trong.**
   `createCustomRequest`/`createOrder` hiện dùng `withTransaction(...)`; lời gọi Resend phải nằm
   **sau** khi hàm `withTransaction` trả về thành công, không phải trong callback của nó. Lý do: một
   transaction Postgres có thể rollback (constraint fail, deadlock...) — nếu gọi email bên trong,
   một request thật có thể đã "báo staff" trong khi dữ liệu chưa từng được ghi.
2. **Fire-and-forget có kiểm soát.** Gói lệnh gọi Resend trong `try/catch`, log lỗi (dùng cơ chế log
   hiện có, không thêm dependency logging mới), **không `await`+`throw`** lỗi đó lên caller của
   `createOrder`/`createCustomRequest`. Route/Server Action trả response thành công cho khách hàng
   ngay cả khi email thất bại.
3. **Danh sách người nhận.** Query `staff_profiles WHERE is_active = true`, lấy email qua Supabase
   Admin API (`auth.admin.getUserById` hoặc tương đương) — cần xác nhận cụ thể lúc viết code liệu
   Supabase client hiện có (`@supabase/supabase-js` đã là dependency) đủ quyền đọc email từ
   `service_role` key mà không cần thêm cột email vào `staff_profiles`.
4. **Nội dung email tối giản** — không nhúng toàn bộ chi tiết đơn hàng (tránh rò rỉ PII qua email
   nếu hộp thư staff dùng chung/không bảo mật tốt bằng chính hệ thống); chỉ nêu loại việc + mã +
   link thẳng vào trang admin tương ứng, yêu cầu đăng nhập để xem chi tiết.
5. **Cấu hình.** Bật lại `RESEND_API_KEY` trong `.env.example`, thêm `RESEND_FROM_EMAIL` (địa chỉ
   gửi, cần domain đã xác thực trên Resend — có thể cần mua/verify domain trước, ghi rõ đây là việc
   ngoài code cần Owner làm ở Resend dashboard).

---

## 4. Kế hoạch triển khai theo Slices

### Slice 1: Hạ tầng gửi email
- [ ] Thêm package `resend`, `RESEND_API_KEY`/`RESEND_FROM_EMAIL` vào `.env.example`.
- [ ] `src/lib/notify/send-staff-notification.ts` — helper `try/catch` bọc quanh Resend, nuốt lỗi +
  log, không bao giờ throw.

### Slice 2: Tích hợp vào 2 luồng tạo việc mới
- [ ] `custom-request.service.ts`/`custom-request` public route: gọi notify sau khi transaction
  commit.
- [ ] `order.service.ts`/`order` public route: gọi notify sau khi transaction commit.
- [ ] Query danh sách staff active + email, cache trong request scope (không query lặp nếu cả 2
  luồng gọi cùng lúc).

### Slice 3: Tests
- [ ] Test đơn vị: lỗi gửi email (mock Resend throw) không làm `createOrder`/`createCustomRequest`
  throw hay trả lỗi cho caller.
- [ ] Test nội dung email không chứa trường PII nhạy cảm ngoài mã đơn/link (nếu template test được
  mà không cần gọi Resend thật — dùng snapshot nội dung, không gọi network thật trong test).

### Slice 4: Docs
- [ ] Cập nhật `README.md` mục cấu hình env.
- [ ] Cập nhật `docs/roadmap.md`.

---

## 5. Risks & Mitigations
- **Volume vượt free tier Resend** — cần hỏi Owner ước lượng số custom_request + order/ngày trước
  khi chốt thiết kế cuối; nếu vượt, cân nhắc gộp digest hoặc nâng cấp gói trả phí (không quyết định
  trước khi có số liệu).
- **Domain gửi email chưa verify trên Resend** → email vào spam/không gửi được — đây là việc ngoài
  code, cần Owner xử lý ở Resend dashboard trước khi Slice 2 có thể test thật.
- **Lộ PII qua email nếu hộp thư staff không bảo mật tốt** — mitigation đã áp dụng ở quyết định #4
  (nội dung tối giản, yêu cầu đăng nhập lại để xem chi tiết).

---

## 6. Checklist

### Trước khi giao Codex
- [ ] Rà soát kiến trúc và chốt phạm vi (đã viết ở trên).
- [ ] Ask AI for challenge trước khi implement (Step 3 `PHASE_START_PROTOCOL.md`).
- [ ] Owner xác nhận: verify domain gửi trên Resend, ước lượng volume/ngày.

### Tests
- [ ] Lỗi gửi email không làm fail luồng tạo đơn/custom request (test đơn vị mock Resend lỗi).
- [ ] Chạy lại toàn bộ `npm test` — không regression Phase 0-14.

### Definition of Done
1. Tạo `custom_request`/`order` mới (kể cả từ public route) → toàn bộ staff active nhận email trong
   vài giây.
2. Lỗi gửi email không bao giờ làm fail request tạo đơn.
3. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass 100%.
