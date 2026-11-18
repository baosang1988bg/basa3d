import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { VoiceClientView } from './voice-client-view';

export const metadata: Metadata = {
  title: 'Voice Studio AI (BaSaTTS) | BaSa3D Admin',
  description: 'Công cụ chuyển đổi văn bản thành giọng nói tiếng Việt bằng máy chủ PC xưởng BaSaTTS.',
};

export default async function VoiceStudioPage() {
  // Chỉ STAFF và OWNER mới có quyền truy cập
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Voice Studio AI (BaSaTTS)</h1>
        <p className="text-sm text-muted-foreground">
          Tạo giọng đọc AI tiếng Việt 48kHz trực tiếp từ máy PC xưởng — Không lưu dữ liệu, bảo mật và tốc độ cao.
        </p>
      </div>

      <VoiceClientView />
    </div>
  );
}
