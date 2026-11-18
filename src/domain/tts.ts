import { z } from 'zod';

export const ttsJobStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
export type TtsJobStatus = z.infer<typeof ttsJobStatusSchema>;

export const createTtsJobSchema = z.object({
  textPrompt: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập văn bản cần chuyển thành giọng nói.')
    .max(5000, 'Văn bản không được vượt quá 5.000 ký tự cho mỗi lượt.'),
  voiceProfile: z
    .string()
    .trim()
    .min(1, 'Vui lòng chọn hoặc nhập tên giọng đọc.')
    .max(64)
    .default('default'),
  speed: z
    .number()
    .min(0.5, 'Tốc độ tối thiểu 0.5x')
    .max(2.0, 'Tốc độ tối đa 2.0x')
    .default(1.0),
});

export type CreateTtsJobInput = z.infer<typeof createTtsJobSchema>;

export interface TtsJobRecord {
  id: string;
  staff_id: string | null;
  staff_name: string;
  text_prompt: string;
  voice_profile: string;
  speed: number;
  status: TtsJobStatus;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  error_message: string | null;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TtsWorkerInfo {
  id: string;
  worker_name: string;
  is_active: boolean;
  last_heartbeat_at: string;
  system_info: Record<string, unknown>;
  is_online: boolean; // computed: last_heartbeat within 35s
}
