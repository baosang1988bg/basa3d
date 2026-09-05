# Phase 22 — Handoff việc tồn đọng từ Phase 15 / 17 / 20 (không phải feature mới)

> **Mục đích**: Phase 15, 17, 20 đều đã **code xong, test/typecheck/lint/build pass**, nhưng mỗi
> phase còn 1-2 việc **ngoài code** (hành động của Owner, hoặc 1 mục doc/ADR bị bỏ sót) nên không
> đạt đủ Definition of Done để tự đóng theo đúng `close-phase` skill (yêu cầu 100% checklist `[x]`).
> Thay vì để 3 file `phase-X.md` nằm mãi trong `active/` chỉ vì 1 dòng chưa tick, phase này gom toàn
> bộ các mục còn treo lại **một chỗ duy nhất**, rồi archive `phase-15.md`/`phase-17.md`/các file phụ
> của `phase-20` vào `completed/` — nội dung kỹ thuật của chúng đã đóng băng và đúng, chỉ có phần
> "còn treo" là còn sống, tiếp tục theo dõi ở đây.
>
> **Đây không phải phase-đã-đạt-DoD theo nghĩa thông thường** — không có feature mới nào được xây ở
> đây. Đây thuần túy là một sổ theo dõi (tracking doc) cho việc ngoài-code còn tồn đọng.
>
> **Phase 16 và Phase 21 KHÔNG nằm trong phạm vi này** — cả hai còn dở dang thật sự về code (Phase
> 16 chưa viết dòng nào, đang chờ Owner chọn nhà cung cấp webhook; Phase 21 mới có 2/~15 file, chưa
> commit, chưa có UI/export/test) nên vẫn ở nguyên `docs/exec-plans/active/phase-16.md` và
> `phase-21.md`, tiếp tục là phase đang code dở, không gộp vào đây.

---

## 1. Phase 15 — Staff Operational Notifications (Resend)

Code, test đơn vị (mock Resend), typecheck/lint/build: **DONE**. Xem
`docs/exec-plans/completed/phase-15.md` cho toàn bộ chi tiết implementation.

Còn treo (đều là việc ngoài code):

- [ ] Chạy `docs/exec-plans/completed/phase-15-gemini-prompt.md` qua Gemini (Phase 15 được code
  trực tiếp bỏ qua bước AI challenge, lệch quy trình `AI_WORKFLOW.md` — đã note lúc implement).
  Fold kết quả (đồng ý hoặc đổi quyết định) vào phần dưới của mục này.
- [ ] Owner verify domain gửi trên Resend dashboard, điền `RESEND_FROM_EMAIL` thật vào env
  production (`.env.example` hiện chỉ có placeholder rỗng).
- [ ] Owner ước lượng số `custom_request` + `order`/ngày — xác nhận free tier Resend đủ dùng.
- [ ] Sau khi domain verify: tạo 1 `custom_request`/`order` thật (staging/production), xác nhận
  toàn bộ staff active nhận email trong vài giây, không rơi vào spam.

---

## 2. Phase 17 — Public 3D Text/Keychain Generator

Code, unit test (`mesh-estimator.test.ts`, `keychain-engine.test.ts`,
`phase-17-keychain-price-estimate.test.ts`, `phase-17-keychain-request-integration.test.ts`), E2E
(`e2e/keychain.spec.ts`), GA4 tracking (`tool_keychain_preview`/`_export_download`/
`_export_to_request` trong `src/lib/analytics.ts`): **DONE và đã verify chạy được trong repo hiện
tại** (checklist trong `phase-17.md` bị lag so với code thật — code đã xong dù ô Slice còn để
`[ ]`). Xem `docs/exec-plans/completed/phase-17.md` cho toàn bộ chi tiết implementation.

Còn treo:

- [ ] **Slice 6 (Docs & ADR) chưa làm**: chưa có ADR nào trong `docs/architecture/decisions.md` ghi
  nhận công thức tính thể tích mesh (`calculateMeshVolumeCm3`/`estimateMeshWeightGrams`/
  `estimatePrintMinutes`) và quyết định dùng 2D Path Hole thay vì CSG boolean cho lỗ móc khoá. Cần
  viết bổ sung — đây là việc doc thuần túy, không phụ thuộc Owner, có thể làm bất cứ lúc nào.
- [ ] (Việc tay của Owner, ngoài phạm vi code) In thử 5 mẫu STL thật trên Bambu Studio, so sánh cân
  nặng thực tế với `estimateMeshWeightGrams` — sai số phải ≤ 15%. Ghi kết quả vào ADR ở mục trên sau
  khi đo xong.

---

## 3. Phase 20 — Flex Organizer (leftover support docs)

`phase-20.md` (nội dung chính) **đã đóng từ trước** (`docs/exec-plans/completed/phase-20.md`,
commit `e40805a`). Các file phụ `phase-20-followup.md`, `phase-20-verification.md`,
`phase-20-gemini-prompt.md`, `phase-20-codex-handoff-prompt.md` bị sót lại trong `active/` — nay
archive theo cùng đợt dọn dẹp này.

Trạng thái còn treo — **Owner đã chủ động chấp nhận rủi ro** (ghi nhận 2026-09-05 trong
`phase-20-followup.md`, nay ở `docs/exec-plans/completed/phase-20-followup.md`): bỏ qua in thử vật
lý xác nhận vách/đáy Epsilon-Overlap không tách rời, để đóng phase ngay. Không có việc nào cần làm
ngay — chỉ có một điều kiện dự phòng:

- [ ] Nếu sau này in thử Organizer thật và phát hiện vách/đáy tách rời: quay lại `phase-20.md`
  (bản completed) mục 3.2 — tăng `WALL_OVERLAP_EPSILON_MM` hoặc đổi sang CSG boolean thật
  (`three-bvh-csg`) — không tự quyết định lại hướng kỹ thuật mà không brainstorm/gemini-challenge
  lại.

---

## 4. Khi nào đóng được Phase 22

Phase 22 tự đóng (di chuyển sang `completed/`, không cần feature) khi cả 3 nhóm mục ở trên đều
`[x]` hoặc được Owner xác nhận chấp nhận rủi ro/bỏ qua có ghi chú rõ ràng (như đã làm với mục 3).
Không cộng dồn thêm việc tồn đọng của phase mới vào đây — mỗi phase mới có vấn đề tương tự thì mở
file follow-up riêng của phase đó trước, chỉ gộp vào một sổ chung nếu về sau có nhiều phase cùng lúc
bị kẹt như đợt này.
