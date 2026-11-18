'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Volume2, Download, Trash2, Cpu, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { TtsJobRecord, TtsWorkerInfo } from '@/domain/tts';
import { createTtsJobAction, deleteTtsJobAction } from './actions';

interface VoiceClientViewProps {
  initialJobs: TtsJobRecord[];
  initialWorker: TtsWorkerInfo | null;
}

const PRESET_VOICES = [
  { id: 'default', name: 'Mặc định (VieNeu Chuẩn)' },
  { id: 'adamsang', name: 'Giọng Sang (Chủ Shop BaSa3D)' },
  { id: 'review_nam', name: 'Nam đọc review sản phẩm' },
  { id: 'mc_nu', name: 'Nữ MC nhẹ nhàng' },
];

export function VoiceClientView({ initialJobs, initialWorker }: VoiceClientViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [textPrompt, setTextPrompt] = useState('');
  const [voiceProfile, setVoiceProfile] = useState('default');
  const [customVoice, setCustomVoice] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-refresh when jobs are pending/processing
  const hasActiveJobs = initialJobs.some((j) => j.status === 'PENDING' || j.status === 'PROCESSING');

  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [hasActiveJobs, router]);

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    if (!textPrompt.trim()) {
      setErrorMessage('Vui lòng nhập văn bản cần đọc.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const selectedVoice = customVoice.trim() ? customVoice.trim() : voiceProfile;
      const formData = new FormData();
      formData.set('textPrompt', textPrompt.trim());
      formData.set('voiceProfile', selectedVoice);
      formData.set('speed', speed.toString());

      await createTtsJobAction(formData);
      setTextPrompt('');
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra khi gửi yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteJob(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) return;
    const formData = new FormData();
    formData.set('id', id);
    startTransition(async () => {
      await deleteTtsJobAction(formData);
      router.refresh();
    });
  }

  const isWorkerOnline = Boolean(initialWorker?.is_online);

  return (
    <div className="space-y-6">
      {/* 1. Worker Status Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Trạng thái Máy chủ AI (PC Xưởng BaSaTTS)</CardTitle>
            </div>
            <div>
              {isWorkerOnline ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1.5 py-1 px-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  PC Host Online &amp; Sẵn sàng ({initialWorker?.worker_name || 'PC Workshop'})
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 gap-1.5 py-1 px-3">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  PC Host Offline (Vui lòng mở máy PC xưởng để xử lý âm thanh)
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-xs">
            {isWorkerOnline
              ? `Tín hiệu kết nối nhận lần cuối lúc ${new Date(initialWorker!.last_heartbeat_at).toLocaleTimeString('vi-VN')}. Yêu cầu sẽ được xử lý ngay lập tức.`
              : 'Bạn vẫn có thể gửi văn bản vào hàng đợi. Khi máy PC xưởng được bật và khởi chạy worker, các câu thoại sẽ tự động được sinh ra.'}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 2. Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 5 cols */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-5 w-5 text-primary" />
                Tạo giọng đọc mới
              </CardTitle>
              <CardDescription className="text-xs">
                Chuyển đổi kịch bản video, mô tả sản phẩm 3D thành giọng nói tiếng Việt tự nhiên (48kHz).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateJob} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="voiceSelect" className="text-sm font-medium">
                    Chọn giọng đọc mẫu
                  </Label>
                  <select
                    id="voiceSelect"
                    value={voiceProfile}
                    onChange={(e) => {
                      setVoiceProfile(e.target.value);
                      if (e.target.value !== 'custom') setCustomVoice('');
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {PRESET_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                    <option value="custom">+ Nhập tên giọng cá nhân khác...</option>
                  </select>

                  {voiceProfile === 'custom' && (
                    <Input
                      placeholder="Nhập mã profile giọng trong BaSaTTS..."
                      value={customVoice}
                      onChange={(e) => setCustomVoice(e.target.value)}
                      className="mt-2 text-sm"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="speedInput" className="text-sm font-medium">
                      Tốc độ đọc: {speed.toFixed(2)}x
                    </Label>
                    <div className="flex gap-1">
                      {[0.9, 1.0, 1.1, 1.25].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSpeed(s)}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                            speed === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 hover:bg-muted'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="speedInput"
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="textPrompt" className="text-sm font-medium">
                      Nội dung văn bản
                    </Label>
                    <span className="text-xs text-muted-foreground">{textPrompt.length}/5000 ký tự</span>
                  </div>
                  <Textarea
                    id="textPrompt"
                    rows={6}
                    placeholder="Nhập nội dung cần đọc vào đây... Ví dụ: Xin chào các bạn, đây là mẫu mô hình rồng uốn lượn được in 3D bằng nhựa Silk PLA tại xưởng BaSa3D."
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    className="resize-y text-sm leading-relaxed"
                  />
                </div>

                <Button type="submit" disabled={isSubmitting || !textPrompt.trim()} className="w-full gap-2">
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang gửi yêu cầu...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      Gửi sang PC tạo Voice
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right List: 7 cols */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Lịch sử sinh giọng nói ({initialJobs.length})</CardTitle>
                <CardDescription className="text-xs">
                  Danh sách file âm thanh đã xuất bản hoặc đang chờ PC xử lý
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  startTransition(() => router.refresh());
                }}
                disabled={isPending}
                className="gap-1 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </CardHeader>
            <CardContent>
              {initialJobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg">
                  <Volume2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Chưa có đoạn âm thanh nào được tạo. Hãy nhập văn bản ở bên trái để bắt đầu!
                </div>
              ) : (
                <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                  {initialJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-3.5 rounded-lg border bg-card/60 hover:bg-muted/30 transition-colors space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {job.status === 'COMPLETED' && (
                            <Badge className="bg-emerald-600 text-white gap-1 text-[11px] py-0">
                              <CheckCircle2 className="h-3 w-3" /> Hoàn thành
                            </Badge>
                          )}
                          {job.status === 'PROCESSING' && (
                            <Badge className="bg-blue-600 text-white gap-1 text-[11px] py-0 animate-pulse">
                              <RefreshCw className="h-3 w-3 animate-spin" /> Đang đọc trên PC...
                            </Badge>
                          )}
                          {job.status === 'PENDING' && (
                            <Badge variant="secondary" className="gap-1 text-[11px] py-0 text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60">
                              <Clock className="h-3 w-3" /> Đang chờ PC nhận
                            </Badge>
                          )}
                          {job.status === 'FAILED' && (
                            <Badge variant="destructive" className="gap-1 text-[11px] py-0">
                              <AlertCircle className="h-3 w-3" /> Lỗi xử lý
                            </Badge>
                          )}

                          <span className="text-xs font-medium text-foreground/80">
                            Giọng: <code className="text-primary">{job.voice_profile}</code>
                          </span>
                          <span className="text-xs text-muted-foreground">({job.speed}x)</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(job.created_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteJob(job.id)}
                            title="Xóa bản ghi"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Text snippet */}
                      <p className="text-xs text-foreground/90 line-clamp-2 bg-muted/30 p-2 rounded border border-border/40">
                        {job.text_prompt}
                      </p>

                      {/* Audio Player if completed */}
                      {job.status === 'COMPLETED' && job.audio_url && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                          <audio
                            controls
                            src={job.audio_url}
                            className="w-full h-8 max-w-full rounded"
                            preload="metadata"
                          />
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 shrink-0 text-xs w-full sm:w-auto"
                          >
                            <a href={job.audio_url} download={`basa3d-voice-${job.id.slice(0, 8)}.wav`}>
                              <Download className="h-3.5 w-3.5" /> Tải .WAV
                            </a>
                          </Button>
                        </div>
                      )}

                      {/* Error message */}
                      {job.status === 'FAILED' && job.error_message && (
                        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                          Lỗi: {job.error_message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
