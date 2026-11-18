# Feature Plan: Staff TTS Voice Studio (BaSaTTS Local Worker Integration)

> **Status:** Draft / In Progress  
> **Branch:** `feat/staff-tts-voice-studio`  
> **Author:** Gemini + Pair Engineer  
> **Date:** 2026-11-18  

## 1. Mục tiêu
Tích hợp bộ công cụ sinh giọng nói tiếng Việt **BaSaTTS** (VieNeu-TTS) vào hệ thống quản trị BaSa3D dưới dạng một công cụ nội bộ cho Staff (`/basaadmin/tools/voice`).
Máy PC xưởng đóng vai trò **Local Worker** xử lý AI model khi đang mở máy; web BaSa3D trên Cloud/Vercel đóng vai trò giao diện điều khiển và quản lý hàng đợi (Task Queue).

## 2. Kiến trúc giải pháp (Zero-cost Local Worker Pattern)
```
[Staff trên Web /basaadmin/tools/voice]
          |
     (1) Tạo job TTS (văn bản, giọng mẫu)
          v
[Supabase Database: bảng `staff_tts_jobs`]
    ^                  ^
    | (2) Heartbeat     | (3) Realtime / Poll job mới
    | (báo PC Online)  |
[PC Xưởng: Python Worker (BaSaTTS)]
    |
    | (4) Chạy VieNeu-TTS sinh file .wav / .mp3
    v
[Supabase Storage: bucket `staff-voice-generations`]
    |
    v (5) Update status `COMPLETED` + audio_url
[Staff nghe thử & tải audio trên Web]
```

## 3. Danh mục công việc

### Database & Storage (Supabase)
- [x] Tạo file migration `supabase/migrations/20261118000000_staff_tts_jobs.sql`:
  - Bảng `staff_tts_jobs` (`id`, `created_by`, `text_prompt`, `voice_profile`, `status`, `audio_url`, `error_message`, `created_at`, `updated_at`).
  - Bảng `staff_tts_workers` (`worker_name`, `last_heartbeat_at`, `is_active`).
  - RLS: Chỉ `STAFF` và `OWNER` mới có quyền đọc/ghi.
  - Bucket storage: `staff-voice-generations` (50MB limit, audio MIME types).

### Backend / Server Actions (Next.js)
- [x] Schema validation Zod cho tạo TTS job (`src/domain/tts.ts`).
- [x] Service & Server actions (`src/services/tts.service.ts`, `src/app/basaadmin/(protected)/voice/actions.ts`):
  - `createTtsJobAction`: Check `requireAdmin()`, validate input, ghi vào DB.
  - `listTtsJobs`: Lấy danh sách lịch sử tạo giọng của staff.
  - `getWorkerStatus`: Kiểm tra xem worker PC có online trong vòng 35s qua hay không.
  - `deleteTtsJobAction`: Xóa job khỏi hệ thống.

### Frontend Web UI (BaSa3D)
- [x] Thêm route `/basaadmin/voice/page.tsx` (bảo vệ bởi `requireAdmin()`).
- [x] Thêm tab menu "Voice Studio AI" vào `src/components/admin/admin-nav.tsx`.
- [x] Component tương tác `VoiceClientView.tsx`:
  - Trạng thái PC Host realtime (Online / Offline indicator).
  - Form tạo giọng đọc: chọn voice, chỉnh tốc độ 0.6x - 1.6x, nhập text kịch bản.
  - Danh sách jobs: Realtime auto-refresh polling 4s khi có job PENDING/PROCESSING.
  - Trình nghe Audio Player `<audio>` và nút tải về file `.wav`.

### Local Worker (BaSaTTS trên PC)
- [x] Tạo script `e:\AOO\BaSaTTS\worker_basa3d.py`:
  - Tải model VieNeu-TTS vào RAM một lần duy nhất.
  - Gửi heartbeat định kỳ 15s lên `staff_tts_workers`.
  - Lấy job `PENDING`, cập nhật `PROCESSING`, gọi `tts.infer()`.
  - Tải file `.wav` lên bucket `staff-voice-generations` qua Supabase Storage API.
  - Cập nhật job `COMPLETED` cùng `audio_url`.
- [x] Tạo file batch `e:\AOO\BaSaTTS\Chay_Worker_BaSa3D.bat` để chạy 1-click trên PC.
- [x] Tạo `worker_config.example.json` và bổ sung `.gitignore` bảo vệ API key.

## 4. Bằng chứng kiểm thử (Definition of Done)
- [x] `npm run lint` pass (eslint .).
- [x] `npm run typecheck` pass (tsc --noEmit).
- [x] `npm run check:arch` pass (6 rules passed).
- [x] `npx tsx --test tests/staff-tts.test.ts` pass (5/5 tests pass).
- [x] RBAC enforcement: Route `/basaadmin/voice` và mọi action đều chặn unauthorized user qua `requireAdmin()`.

## 4. Bằng chứng kiểm thử (Definition of Done)
- [ ] `npm run check:agent` xanh (lint + typecheck).
- [ ] Kiểm tra role bảo mật: Khách hoặc user thường không thể truy cập URL hoặc gọi action.
- [ ] Test thực tế: Gửi 1 đoạn văn từ Web -> PC nhận job -> sinh file -> audio phát được trên Web.
