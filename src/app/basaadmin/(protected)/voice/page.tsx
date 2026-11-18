import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getWorkerStatus, listTtsJobs } from '@/services/tts.service';
import { VoiceClientView } from './voice-client-view';

export const metadata: Metadata = {
  title: 'Voice Studio AI (BaSaTTS) | BaSa3D Admin',
  description: 'Tạo giọng đọc AI tiếng Việt từ kịch bản bằng máy chủ PC xưởng BaSaTTS.',
};

export const dynamic = 'force-dynamic';

export default async function VoiceStudioPage() {
  await requireAdmin();

  const [worker, jobs] = await Promise.all([
    getWorkerStatus().catch(() => null),
    listTtsJobs(40).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Voice Studio AI</h1>
        <p className="text-sm text-muted-foreground">
          Công cụ tạo giọng đọc AI tiếng Việt chuyên nghiệp phục vụ kịch bản video TikTok, Reels và review sản phẩm 3D.
        </p>
      </div>

      <VoiceClientView initialJobs={jobs} initialWorker={worker} />
    </div>
  );
}
