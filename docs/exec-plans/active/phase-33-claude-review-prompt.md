# Prompt Claude — Final Review cho Phase 33 (/bao-gia) sau Gemini Challenge

Copy toàn bộ nội dung bên dưới vào Claude để thực hiện final review trước khi giao Codex:

---

Bạn là Lead Architect & Security Reviewer của dự án BaSa3D (`AGENTS.md`).
Kế hoạch triển khai **Phase 33 (`/bao-gia`: Báo giá tức thì đa file, 1 món = 1 Quote, VAT có phiên bản)** tại `docs/exec-plans/active/phase-33-bao-gia-instant-quote.md` vừa trải qua đợt phản biện độc lập từ Gemini Challenge và đã được cập nhật 4 quyết định quan trọng:

1. **Ranh giới tin cậy (Q1):** Chấp nhận phân tích phía client và kiểm tra lại đồng bộ trong ngân sách 20MB (`VERIFY_BUDGET_BYTES`), **KHÔNG dùng `after()`**. Tuy nhiên, trên Admin: Món bị gắn cờ `CLIENT_REPORTED` sẽ **khoá nút điền tự động giá/thông số** để triệt tiêu hiện tượng neo tâm lý (staff anchoring), bắt buộc Staff kiểm tra file hoặc bấm nút re-verify trên server. Thời hạn token signed URL rút ngắn còn 15 phút.
2. **Bảng món & Composite FK (Q2):** Giữ nguyên bảng `custom_request_items` (insert-only) và composite FK `(custom_request_item_id, custom_request_id)`. **Loại bỏ việc denormalize món #1 vào `custom_requests.attachment_path`** (để `NULL` cho đơn `/bao-gia`) để tránh Staff nhầm tưởng đơn 1 món mà bỏ sót các file 2..N. Cột `quantity` lưu tổng số lượng toàn đơn; Admin hiển thị badge `📦 Đa món (N files)`.
3. **VAT có phiên bản (Q3):** Nới lỏng Check constraint của `quotes`: chỉ kiểm tra `total >= 0 AND vat_amount >= 0 AND total = subtotal + shipping_fee - discount + vat_amount`. Không hardcode công thức tính thuế vào DB check để tránh gãy khi quy tắc tính thuế trên phí ship/chiết khấu thay đổi. Bổ sung luôn 2 cột VAT vào bảng `orders` để đồng bộ schema.
4. **Mô hình thời gian in & Giá sàn (Q4):** Giữ mô hình bán vật lý `fdm-v1` và hoãn Slicer server. Bổ sung **Giá sàn tối thiểu `MIN_ITEM_PRICE_VND = 25_000`đ** để tránh lỗ công vận hành với các chi tiết siêu nhỏ (< 5g). UI hiển thị kèm dấu `~` và tooltip tư vấn.

### Yêu cầu review:
1. Đọc lại file `docs/exec-plans/active/phase-33-bao-gia-instant-quote.md` vừa được cập nhật.
2. Đánh giá xem 4 thay đổi trên có giải quyết triệt để các rủi ro kiến trúc mà bạn và Gemini đã nêu không.
3. Kiểm tra xem còn blocker nào về mặt migration SQL (§4) hay API contract (§6) trước khi giao cho Codex triển khai slice đầu tiên (S0/S1/S2) không.
4. Xác nhận "GO / NO-GO" cho việc chuyển sang bước `codex-handoff`.
