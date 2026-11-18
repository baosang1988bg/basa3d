import { query } from '../lib/db';
import type { CreateTtsJobInput, TtsJobRecord, TtsWorkerInfo } from '../domain/tts';

export async function createTtsJob(params: {
  staffId: string;
  staffName: string;
  input: CreateTtsJobInput;
}): Promise<TtsJobRecord> {
  const { staffId, staffName, input } = params;
  const res = await query<TtsJobRecord>(
    `insert into public.staff_tts_jobs (
      staff_id,
      staff_name,
      text_prompt,
      voice_profile,
      speed,
      status
    ) values ($1, $2, $3, $4, $5, 'PENDING')
    returning
      id, staff_id, staff_name, text_prompt, voice_profile, speed,
      status, audio_url, audio_duration_seconds, error_message,
      worker_id, created_at, updated_at, completed_at`,
    [staffId, staffName, input.textPrompt, input.voiceProfile, input.speed],
  );

  return res.rows[0];
}

export async function listTtsJobs(limit = 20): Promise<TtsJobRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const res = await query<TtsJobRecord>(
    `select
      id, staff_id, staff_name, text_prompt, voice_profile, speed,
      status, audio_url, audio_duration_seconds, error_message,
      worker_id, created_at, updated_at, completed_at
    from public.staff_tts_jobs
    order by created_at desc
    limit $1`,
    [safeLimit],
  );

  return res.rows;
}

export async function getTtsJobById(id: string): Promise<TtsJobRecord | null> {
  const res = await query<TtsJobRecord>(
    `select
      id, staff_id, staff_name, text_prompt, voice_profile, speed,
      status, audio_url, audio_duration_seconds, error_message,
      worker_id, created_at, updated_at, completed_at
    from public.staff_tts_jobs
    where id = $1`,
    [id],
  );

  return res.rows[0] ?? null;
}

export async function getWorkerStatus(): Promise<TtsWorkerInfo | null> {
  const res = await query<{
    id: string;
    worker_name: string;
    is_active: boolean;
    last_heartbeat_at: string;
    system_info: Record<string, unknown>;
    seconds_ago: number;
  }>(
    `select
      id,
      worker_name,
      is_active,
      last_heartbeat_at,
      system_info,
      extract(epoch from (now() - last_heartbeat_at)) as seconds_ago
    from public.staff_tts_workers
    order by last_heartbeat_at desc
    limit 1`,
  );

  if (!res.rows[0]) return null;

  const row = res.rows[0];
  const isOnline = row.is_active && row.seconds_ago <= 35; // online if heartbeat received within 35 seconds

  return {
    id: row.id,
    worker_name: row.worker_name,
    is_active: row.is_active,
    last_heartbeat_at: row.last_heartbeat_at,
    system_info: row.system_info,
    is_online: isOnline,
  };
}

export async function deleteTtsJob(id: string): Promise<boolean> {
  const res = await query(`delete from public.staff_tts_jobs where id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
