# Feature Plan: Staff TTS Voice Studio (BaSaTTS Stateless Host Integration)

> **Status:** Ready for Dev Merge  
> **Branch:** `feat/staff-tts-voice-studio`  
> **Author:** Gemini + Pair Engineer  
> **Date:** 2026-11-18  

## 1. Mục tiêu
Tích hợp bộ công cụ sinh giọng nói tiếng Việt **BaSaTTS** (VieNeu-TTS) vào hệ thống quản trị BaSa3D dưới dạng một công cụ nội bộ bảo mật cho Staff (`/basaadmin/voice`).
Kiến trúc: **Stateless & Zero-Storage** — PC cá nhân làm host chạy FastAPI stream audio trực tiếp vào RAM trình duyệt. Hoàn toàn không lưu rác ra ổ đĩa xưởng và không lưu dữ liệu vào Supabase Database.

## 2. Kiến trúc giải pháp (Stateless Direct In-Memory Stream)
```
[Staff tại Web /basaadmin/voice] (Chỉ STAFF/OWNER truy cập)
          |
     (1) Gửi POST text kịch bản + giọng đọc (fetch HTTP)
          v
[PC Xưởng: server_host.py (FastAPI trên port 7860)]
          |
     (2) Nạp VieNeu-TTS v3 Turbo tổng hợp audio trong RAM
          |
     (3) Stream trực tiếp WAV bytes về trình duyệt
          v
[Trình duyệt Web BaSa3D]
     (4) Tạo URL.createObjectURL(blob), tự động phát audio
     (5) Nút "Tải về .WAV" lưu vào máy cá nhân khi cần
```

## 3. Danh mục công việc hoàn thành
- [x] Tạo trang quản trị nội bộ `/basaadmin/voice/page.tsx` bảo vệ bằng `requireAdmin()`.
- [x] Thêm link menu Voice Studio AI vào `src/components/admin/admin-nav.tsx`.
- [x] Component giao diện `VoiceClientView.tsx`:
  - Trạng thái PC Host realtime (Online / Offline).
  - Cấu hình URL linh hoạt (hỗ trợ `localhost:7860` hoặc link Cloudflare Tunnel từ xa).
  - Chọn giọng Preset (`adamsang`, `Hà Nội`, `Sài Gòn`, v.v.) hoặc file clone cục bộ.
  - Tinh chỉnh tốc độ đọc `0.6x - 1.5x`.
  - In-memory audio session player & nút download file `.wav`.
- [x] PC Host Server `e:\AOO\BaSaTTS\server_host.py` & `Chay_Host_PC.bat`:
  - FastAPI server hỗ trợ CORS.
  - Endpoint `/health` kiểm tra trạng thái máy PC.
  - Endpoint `/tts` stream audio bytes trực tiếp, zero-disk write.

## 4. Bằng chứng kiểm thử (Definition of Done)
- [x] `npm run lint` pass (eslint .).
- [x] `npm run typecheck` pass (tsc --noEmit).
- [x] `npm run check:arch` pass (6 rules passed).
- [x] `npm run build` pass (production build optimized).
