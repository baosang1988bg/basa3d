-- Migration: 20261118000000_staff_tts_jobs.sql
-- Feature: Staff TTS Voice Studio & Local Host Worker (BaSaTTS)
-- Allows staff to generate Vietnamese TTS audio on an on-premise PC worker.

-- 1. Table: staff_tts_workers (tracks PC Host heartbeats and status)
create table if not exists public.staff_tts_workers (
  id varchar(64) primary key,
  worker_name varchar(128) not null,
  is_active boolean not null default true,
  last_heartbeat_at timestamptz not null default now(),
  system_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_tts_workers enable row level security;

-- 2. Table: staff_tts_jobs (TTS generation queue)
create table if not exists public.staff_tts_jobs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff_profiles(id) on delete set null,
  staff_name varchar(128) not null default 'Staff',
  text_prompt text not null check (btrim(text_prompt) <> ''),
  voice_profile varchar(64) not null default 'default',
  speed numeric(3, 2) not null default 1.00 check (speed between 0.50 and 2.00),
  status varchar(16) not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  audio_url text,
  audio_duration_seconds numeric(6, 2),
  error_message text check (char_length(error_message) <= 2000),
  worker_id varchar(64) references public.staff_tts_workers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists staff_tts_jobs_status_created_idx on public.staff_tts_jobs (status, created_at desc);
create index if not exists staff_tts_jobs_created_at_idx on public.staff_tts_jobs (created_at desc);

-- Triggers for updated_at
drop trigger if exists staff_tts_workers_set_updated_at on public.staff_tts_workers;
create trigger staff_tts_workers_set_updated_at before update on public.staff_tts_workers
  for each row execute function public.set_updated_at();

drop trigger if exists staff_tts_jobs_set_updated_at on public.staff_tts_jobs;
create trigger staff_tts_jobs_set_updated_at before update on public.staff_tts_jobs
  for each row execute function public.set_updated_at();

-- RLS Policies: Only active staff can access
drop policy if exists "Staff can view tts workers" on public.staff_tts_workers;
create policy "Staff can view tts workers" on public.staff_tts_workers
  for select to authenticated
  using (exists (select 1 from public.staff_profiles sp where sp.id = auth.uid() and sp.is_active = true));

drop policy if exists "Staff can manage tts jobs" on public.staff_tts_jobs;
create policy "Staff can manage tts jobs" on public.staff_tts_jobs
  for all to authenticated
  using (exists (select 1 from public.staff_profiles sp where sp.id = auth.uid() and sp.is_active = true))
  with check (exists (select 1 from public.staff_profiles sp where sp.id = auth.uid() and sp.is_active = true));

-- 3. Storage bucket setup (for staff voice audio files)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-voice-generations',
  'staff-voice-generations',
  true,
  52428800, -- 50MB limit per file
  array['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg'];
