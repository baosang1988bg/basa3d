'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic, Volume2, Download, Trash2, RefreshCw, AlertCircle, CheckCircle2,
  Clock, Users, Sparkles, Sliders, Play,
} from 'lucide-react';
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
  { id: 'adamsang', name: 'Giọng Sang (Chủ Shop BaSa3D)', region: 'Bình Dương' },
  { id: 'default', name: 'VieNeu Chuẩn (Mặc định v3 Turbo)', region: 'Toàn quốc' },
  { id: 'binhduong', name: 'Bình Dương (Miền Nam)', region: 'Miền Nam' },
  { id: 'hanoi', name: 'Hà Nội (Miền Bắc truyền cảm)', region: 'Miền Bắc' },
  { id: 'saigon', name: 'Sài Gòn (Năng động)', region: 'Miền Nam' },
  { id: 'hue', name: 'Huế (Miền Trung ngọt ngào)', region: 'Miền Trung' },
  { id: 'mientay', name: 'Miền Tây (Mộc mạc, gần gũi)', region: 'Miền Tây' },
];

const SAMPLE_SCRIPTS = [
  'Xin chào các bạn! Hôm nay xưởng BaSa3D vừa hoàn thiện mô hình rồng uốn lượn Articulated Dragon được in bằng nhựa Silk PLA cao cấp.',
  'Dịch vụ in 3D theo yêu cầu tại BaSa3D. Tải file 3MF hoặc STL lên hệ thống để nhận báo giá tự động ngay trong 3 giây!',
  'Mẹo in 3D: Để bản in đạt độ bóng đẹp và bám bàn tốt nhất, hãy vệ sinh bàn in bằng cồn isopropyl trước mỗi lần bắt đầu.',
];

const SAMPLE_CONVERSATION = `Nhân viên: Dạ xưởng in 3D BaSa3D xin chào ạ, em có thể hỗ trợ gì cho anh chị?
Khách hàng: Anh có file STL mô hình móc khóa rồng, bên em in bao lâu thì lấy được em?
Nhân viên: Dạ thời gian in khoảng 2 đến 3 tiếng là xong ạ, anh gửi file qua em báo giá liền nha!`;

export function VoiceClientView({ initialJobs, initialWorker }: VoiceClientViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Mode: single (Đọc đơn) or conversation (Hội thoại đa nhân vật)
  const [mode, setMode] = useState<'single' | 'conversation'>('single');

  // Single mode state
  const [textPrompt, setTextPrompt] = useState(SAMPLE_SCRIPTS[0]);
  const [voiceTab, setVoiceTab] = useState<'preset' | 'custom'>('preset');
  const [voiceProfile, setVoiceProfile] = useState('adamsang');
  const [customVoiceName, setCustomVoiceName] = useState('');

  // Tuning parameters
  const [speed, setSpeed] = useState(1.0);
  const [silenceGap, setSilenceGap] = useState(0.3);

  // Conversation mode state
  const [convScript, setConvScript] = useState(SAMPLE_CONVERSATION);
  const [detectedSpeakers, setDetectedSpeakers] = useState<string[]>(['Nhân viên', 'Khách hàng']);
  const [speakerVoiceMap, setSpeakerVoiceMap] = useState<Record<string, string>>({
    'Nhân viên': 'adamsang',
    'Khách hàng': 'hanoi',
  });

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

  // Quét nhân vật từ kịch bản hội thoại
  function handleScanSpeakers() {
    const lines = convScript.split('\n');
    const speakers = new Set<string>();

    for (const line of lines) {
      const match = line.match(/^([^:\n]+):/);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name) speakers.add(name);
      }
    }

    const speakerList = Array.from(speakers);
    if (speakerList.length > 0) {
      setDetectedSpeakers(speakerList);
      setSpeakerVoiceMap((prev) => {
        const updated = { ...prev };
        speakerList.forEach((sp, idx) => {
          if (!updated[sp]) {
            updated[sp] = PRESET_VOICES[idx % PRESET_VOICES.length].id;
          }
        });
        return updated;
      });
    } else {
      alert('Không tìm thấy nhân vật nào! Hãy định dạng kịch bản dạng: "Tên nhân vật: Lời thoại"');
    }
  }

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const contentToRead = mode === 'single' ? textPrompt.trim() : convScript.trim();
    if (!contentToRead) {
      setErrorMessage('Vui lòng nhập nội dung văn bản kịch bản cần đọc.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedVoice = voiceTab === 'custom' && customVoiceName.trim() ? customVoiceName.trim() : voiceProfile;
      const formData = new FormData();
      formData.set('textPrompt', contentToRead);
      formData.set('voiceProfile', selectedVoice);
      formData.set('speed', speed.toString());
      formData.set('silenceGap', silenceGap.toString());
      formData.set('mode', mode);

      if (mode === 'conversation') {
        formData.set('speakerMap', JSON.stringify(speakerVoiceMap));
      }

      await createTtsJobAction(formData);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra khi gửi yêu cầu sang PC.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteJob(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi âm thanh này?')) return;
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
      {/* 1. Header Banner phong cách BaSaTTS */}
      <div className="rounded-xl border bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500 text-white shadow-sm">
              <Mic className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">BaSaTTS — VieNeu-TTS v3 Turbo (48kHz)</h2>
                <Badge variant="secondary" className="text-[11px] bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                  Chuẩn âm thanh Studio
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chuyển văn bản thành giọng đọc tiếng Việt mượt mà, hỗ trợ đọc kịch bản video TikTok/Reels và hội thoại đa nhân vật.
              </p>
            </div>
          </div>

          <div>
            {isWorkerOnline ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1.5 py-1.5 px-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                PC Xưởng Online ({initialWorker?.worker_name || 'PC Host'})
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 gap-1.5 py-1.5 px-3">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                PC Xưởng Đang Tắt (Vui lòng bật PC &amp; chạy worker)
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              {/* Tab chuyển đổi chế độ: Đọc đơn vs Hội thoại */}
              <div className="flex items-center justify-between">
                <div className="flex p-1 bg-muted/60 rounded-lg gap-1">
                  <button
                    type="button"
                    onClick={() => setMode('single')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mode === 'single'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    📖 Đọc truyện (Đơn thoại)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('conversation')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mode === 'conversation'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    🎭 Hội thoại (Đa nhân vật)
                  </button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7"
                  onClick={() => {
                    if (mode === 'single') {
                      const next = SAMPLE_SCRIPTS[(SAMPLE_SCRIPTS.indexOf(textPrompt) + 1) % SAMPLE_SCRIPTS.length];
                      setTextPrompt(next);
                    } else {
                      setConvScript(SAMPLE_CONVERSATION);
                    }
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Mẫu ví dụ
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleCreateJob} className="space-y-4">
                {/* TAB 1: SINGLE SPEAKER */}
                {mode === 'single' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="textPrompt" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Văn bản cần đọc
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">{textPrompt.length} ký tự</span>
                          <button
                            type="button"
                            onClick={() => setTextPrompt('')}
                            className="text-[11px] text-muted-foreground hover:text-destructive underline"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                      <Textarea
                        id="textPrompt"
                        rows={6}
                        placeholder="Nhập nội dung văn bản tiếng Việt cần đọc..."
                        value={textPrompt}
                        onChange={(e) => setTextPrompt(e.target.value)}
                        className="resize-y text-sm leading-relaxed focus-visible:ring-orange-500"
                      />
                    </div>

                    {/* Lựa chọn giọng đọc: Preset vs Voice Clone */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setVoiceTab('preset')}
                            className={`text-xs font-medium pb-1 border-b-2 transition-all ${
                              voiceTab === 'preset'
                                ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-semibold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            🎙️ Preset (Giọng mẫu có sẵn)
                          </button>
                          <button
                            type="button"
                            onClick={() => setVoiceTab('custom')}
                            className={`text-xs font-medium pb-1 border-b-2 transition-all ${
                              voiceTab === 'custom'
                                ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-semibold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            🧬 Voice Cloning (Giọng riêng)
                          </button>
                        </div>
                      </div>

                      {voiceTab === 'preset' ? (
                        <div className="space-y-2">
                          <select
                            value={voiceProfile}
                            onChange={(e) => setVoiceProfile(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
                          >
                            {PRESET_VOICES.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} — [{v.region}]
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-muted-foreground">
                            💡 Gợi ý: Giọng <code className="text-orange-600 dark:text-orange-400 font-semibold">adamsang</code> là giọng thật của chủ shop BaSa3D, rất thích hợp đọc review sản phẩm và hướng dẫn in 3D.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            placeholder="Nhập tên file giọng mẫu (ví dụ: my_voice hoặc test_sang)..."
                            value={customVoiceName}
                            onChange={(e) => setCustomVoiceName(e.target.value)}
                            className="h-9 text-sm"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Worker trên PC sẽ tìm file audio mẫu <code>{customVoiceName ? `${customVoiceName}.wav` : 'my_voice.wav'}</code> trong thư mục BaSaTTS để clone giọng đọc.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* TAB 2: CONVERSATION MODE */
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="convScript" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Kịch bản hội thoại đa nhân vật
                        </Label>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleScanSpeakers}
                          className="h-7 text-xs gap-1"
                        >
                          🔍 Quét nhân vật
                        </Button>
                      </div>
                      <Textarea
                        id="convScript"
                        rows={7}
                        placeholder="Nhập kịch bản dạng:&#10;Tên nhân vật: Lời thoại...&#10;Tên nhân vật 2: Lời thoại..."
                        value={convScript}
                        onChange={(e) => setConvScript(e.target.value)}
                        className="resize-y text-sm font-mono leading-relaxed"
                      />
                    </div>

                    {/* Danh sách gán giọng cho từng nhân vật */}
                    {detectedSpeakers.length > 0 && (
                      <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                        <Label className="text-xs font-medium">Gán giọng đọc cho từng nhân vật:</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {detectedSpeakers.map((speaker) => (
                            <div key={speaker} className="flex items-center gap-2 p-2 rounded-md bg-background border">
                              <span className="text-xs font-semibold text-primary truncate w-24 shrink-0">
                                {speaker}:
                              </span>
                              <select
                                value={speakerVoiceMap[speaker] || 'adamsang'}
                                onChange={(e) =>
                                  setSpeakerVoiceMap((prev) => ({
                                    ...prev,
                                    [speaker]: e.target.value,
                                  }))
                                }
                                className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                              >
                                {PRESET_VOICES.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tinh chỉnh nâng cao (Speed & Silence Gap) */}
                <div className="rounded-lg border p-3 bg-muted/10 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Sliders className="h-3.5 w-3.5" />
                    Cài đặt tốc độ &amp; nhịp đọc
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tốc độ đọc */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span>Tốc độ đọc (Speed)</span>
                        <span className="font-semibold text-primary">{speed.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.6"
                        max="1.6"
                        step="0.05"
                        value={speed}
                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-orange-500 h-1.5"
                      />
                    </div>

                    {/* Khoảng lặng giữa các câu */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span>Khoảng lặng ngắt câu (Silence)</span>
                        <span className="font-semibold text-primary">{silenceGap.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={silenceGap}
                        onChange={(e) => setSilenceGap(parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-orange-500 h-1.5"
                      />
                    </div>
                  </div>
                </div>

                {/* Nút hành động chính */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-medium text-sm gap-2 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang gửi yêu cầu sang máy PC xưởng...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white" />
                      🚀 Tạo âm thanh ngay (VieNeu-TTS v3)
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Output & History (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-orange-500" />
                  Kết quả âm thanh
                </CardTitle>
                <CardDescription className="text-xs">
                  File âm thanh mới nhất &amp; lịch sử ({initialJobs.length})
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => startTransition(() => router.refresh())}
                disabled={isPending}
                className="h-7 text-xs gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </CardHeader>

            <CardContent className="pt-4">
              {initialJobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs border border-dashed rounded-lg space-y-2">
                  <Volume2 className="h-8 w-8 mx-auto opacity-30 text-orange-500" />
                  <p>Chưa có file âm thanh nào được sinh ra.</p>
                  <p className="text-[11px] opacity-75">Hãy nhập văn bản bên trái và bấm "Tạo âm thanh".</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                  {initialJobs.map((job, idx) => (
                    <div
                      key={job.id}
                      className={`p-3.5 rounded-lg border transition-all space-y-2.5 ${
                        idx === 0
                          ? 'bg-orange-500/5 border-orange-500/30 dark:bg-orange-950/20'
                          : 'bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {job.status === 'COMPLETED' && (
                            <Badge className="bg-emerald-600 text-white gap-1 text-[10px] py-0">
                              <CheckCircle2 className="h-3 w-3" /> Hoàn thành
                            </Badge>
                          )}
                          {job.status === 'PROCESSING' && (
                            <Badge className="bg-blue-600 text-white gap-1 text-[10px] py-0 animate-pulse">
                              <RefreshCw className="h-3 w-3 animate-spin" /> PC đang đọc...
                            </Badge>
                          )}
                          {job.status === 'PENDING' && (
                            <Badge variant="secondary" className="gap-1 text-[10px] py-0 text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60">
                              <Clock className="h-3 w-3" /> Chờ PC nhận
                            </Badge>
                          )}
                          {job.status === 'FAILED' && (
                            <Badge variant="destructive" className="gap-1 text-[10px] py-0">
                              <AlertCircle className="h-3 w-3" /> Lỗi
                            </Badge>
                          )}

                          <span className="text-[11px] font-semibold text-foreground">
                            {job.mode === 'conversation' ? '🎭 Hội thoại' : `🎙️ ${job.voice_profile}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground">({job.speed}x)</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
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
                            title="Xóa"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Đoạn text trích dẫn */}
                      <p className="text-xs text-foreground/80 line-clamp-2 bg-muted/40 p-2 rounded text-[11px] leading-relaxed">
                        {job.text_prompt}
                      </p>

                      {/* Trình phát Audio khi xong */}
                      {job.status === 'COMPLETED' && job.audio_url && (
                        <div className="space-y-1.5 pt-1">
                          <audio
                            controls
                            src={job.audio_url}
                            className="w-full h-8 max-w-full rounded"
                            preload="metadata"
                          />
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {job.audio_duration_seconds ? `Thời lượng: ~${job.audio_duration_seconds}s` : ''}
                            </span>
                            <a
                              href={job.audio_url}
                              download={`basa3d-voice-${job.id.slice(0, 8)}.wav`}
                              className="inline-flex items-center h-7 px-2.5 rounded-md text-xs font-medium border border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 gap-1"
                            >
                              <Download className="h-3 w-3" /> Tải file .WAV
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Thông báo lỗi nếu có */}
                      {job.status === 'FAILED' && job.error_message && (
                        <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded">
                          Lỗi: {job.error_message}
                        </div>
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
