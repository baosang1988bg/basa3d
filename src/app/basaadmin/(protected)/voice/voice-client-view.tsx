'use client';

import { useEffect, useState } from 'react';
import {
  Mic, Volume2, Download, RefreshCw, AlertCircle, CheckCircle2,
  Sliders, Play, Settings, Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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

interface GeneratedAudioItem {
  id: string;
  url: string;
  text: string;
  voice: string;
  speed: number;
  createdAt: Date;
  sizeKb: number;
}

const STORAGE_HOST_KEY = 'basa3d_tts_host_url';

export function VoiceClientView() {
  const [hostUrl, setHostUrl] = useState('http://localhost:7860');
  const [showConfig, setShowConfig] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isCheckingHost, setIsCheckingHost] = useState(false);

  // Form input
  const [textPrompt, setTextPrompt] = useState(SAMPLE_SCRIPTS[0]);
  const [voiceTab, setVoiceTab] = useState<'preset' | 'custom'>('preset');
  const [voiceProfile, setVoiceProfile] = useState('adamsang');
  const [customVoiceName, setCustomVoiceName] = useState('');
  const [speed, setSpeed] = useState(1.0);

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // In-memory generated audio list for this session (ZERO database write)
  const [audioList, setAudioList] = useState<GeneratedAudioItem[]>([]);

  // Load saved host URL from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_HOST_KEY);
    if (saved) setHostUrl(saved);
  }, []);

  // Check PC Host status
  const checkHostStatus = async (urlToCheck?: string) => {
    const target = (urlToCheck || hostUrl).trim().replace(/\/+$/, '');
    if (!target) return;
    setIsCheckingHost(true);
    try {
      const res = await fetch(`${target}/health`, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsCheckingHost(false);
    }
  };

  useEffect(() => {
    checkHostStatus();
    const interval = setInterval(() => checkHostStatus(), 10000);
    return () => clearInterval(interval);
  }, [hostUrl]);

  const handleSaveHostUrl = (newUrl: string) => {
    const clean = newUrl.trim().replace(/\/+$/, '');
    setHostUrl(clean);
    localStorage.setItem(STORAGE_HOST_KEY, clean);
    checkHostStatus(clean);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = textPrompt.trim();
    if (!content) {
      setErrorMessage('Vui lòng nhập văn bản cần đọc.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    const cleanHost = hostUrl.trim().replace(/\/+$/, '');
    const selectedVoice = voiceTab === 'custom' && customVoiceName.trim() ? customVoiceName.trim() : voiceProfile;

    try {
      const res = await fetch(`${cleanHost}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          voice: selectedVoice,
          speed,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Máy chủ PC phản hồi lỗi (Mã: ${res.status})`);
      }

      // Stream trực tiếp audio bytes vào RAM trình duyệt (Không ghi đĩa, không DB)
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);

      const newItem: GeneratedAudioItem = {
        id: Math.random().toString(36).substring(2, 9),
        url: audioUrl,
        text: content,
        voice: selectedVoice,
        speed,
        createdAt: new Date(),
        sizeKb: Math.round(blob.size / 1024),
      };

      setAudioList((prev) => [newItem, ...prev]);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối tới PC xưởng. Vui lòng đảm bảo máy PC đang mở và file Chay_Host_PC.bat đang chạy.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
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
                  Zero Storage · In-Memory
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sinh giọng nói trực tiếp từ máy PC xưởng và phát ngay trên trình duyệt — Hoàn toàn không lưu rác hay đụng vào Database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1.5 py-1.5 px-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                PC Host Online &amp; Sẵn sàng
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 gap-1.5 py-1.5 px-3">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                PC Host Offline
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="h-8 gap-1 text-xs"
              title="Cấu hình địa chỉ PC Host"
            >
              <Settings className="h-3.5 w-3.5" />
              Cấu hình PC
            </Button>
          </div>
        </div>

        {/* Cấu hình địa chỉ Host PC */}
        {showConfig && (
          <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
            <Label className="text-xs font-semibold">Địa chỉ kết nối máy PC Host:</Label>
            <div className="flex gap-2">
              <Input
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
                placeholder="http://localhost:7860 hoặc link Cloudflare Tunnel https://..."
                className="h-9 text-xs"
              />
              <Button
                size="sm"
                onClick={() => handleSaveHostUrl(hostUrl)}
                disabled={isCheckingHost}
                className="h-9 text-xs shrink-0 gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${isCheckingHost ? 'animate-spin' : ''}`} />
                Lưu &amp; Thử kết nối
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 Mẹo: Nếu web BaSa3D mở ngay trên máy xưởng, dùng <code>http://localhost:7860</code>. Nếu mở từ xa qua mạng khác, chạy <code>cloudflared tunnel --url http://localhost:7860</code> và dán link vào đây.
            </p>
          </div>
        )}
      </div>

      {/* 2. Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-orange-500" />
                  Kịch bản cần chuyển thành giọng nói
                </CardTitle>
                <CardDescription className="text-xs">
                  Nhập văn bản tiếng Việt để PC xưởng tổng hợp âm thanh 48kHz
                </CardDescription>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7"
                onClick={() => {
                  const next = SAMPLE_SCRIPTS[(SAMPLE_SCRIPTS.indexOf(textPrompt) + 1) % SAMPLE_SCRIPTS.length];
                  setTextPrompt(next);
                }}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Mẫu ví dụ
              </Button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="textPrompt" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Nội dung văn bản
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

                {/* Chọn giọng đọc */}
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
                        🧬 Voice Cloning (File mẫu)
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
                        💡 Giọng <code className="text-orange-600 dark:text-orange-400 font-semibold">adamsang</code> là giọng chuẩn của chủ shop BaSa3D, tối ưu cho review sản phẩm.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        placeholder="Nhập tên file giọng mẫu trên PC (ví dụ: my_voice hoặc test_sang)..."
                        value={customVoiceName}
                        onChange={(e) => setCustomVoiceName(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Server PC sẽ tự tìm file <code>{customVoiceName ? `${customVoiceName}.wav` : 'my_voice.wav'}</code> trong thư mục BaSaTTS để clone giọng đọc.
                      </p>
                    </div>
                  )}
                </div>

                {/* Tinh chỉnh tốc độ */}
                <div className="rounded-lg border p-3 bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-muted-foreground">
                      <Sliders className="h-3.5 w-3.5" />
                      Tốc độ đọc (Speed)
                    </span>
                    <span className="font-semibold text-primary">{speed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-orange-500 h-1.5"
                  />
                </div>

                {/* Nút hành động */}
                <Button
                  type="submit"
                  disabled={isGenerating || !isOnline}
                  className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-medium text-sm gap-2 shadow-sm disabled:opacity-60"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang xử lý trên máy PC xưởng (VieNeu-TTS)...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white" />
                      🚀 Tạo âm thanh ngay (Không lưu máy chủ)
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Audio Output & Recent Session (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-orange-500" />
                  Âm thanh tạo ra ({audioList.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Nghe trực tiếp từ RAM hoặc tải file .WAV về máy
                </CardDescription>
              </div>

              {audioList.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAudioList([])}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  Xóa phiên làm việc
                </Button>
              )}
            </CardHeader>

            <CardContent className="pt-4">
              {audioList.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground text-xs border border-dashed rounded-lg space-y-2">
                  <Volume2 className="h-8 w-8 mx-auto opacity-30 text-orange-500" />
                  <p>Chưa có file âm thanh nào trong phiên làm việc này.</p>
                  <p className="text-[11px] opacity-75">Hãy nhập văn bản bên trái và bấm "Tạo âm thanh ngay".</p>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
                  {audioList.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-lg border transition-all space-y-2.5 ${
                        idx === 0
                          ? 'bg-orange-500/5 border-orange-500/30 dark:bg-orange-950/20 shadow-sm'
                          : 'bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="bg-emerald-600 text-white gap-1 text-[10px] py-0">
                            <CheckCircle2 className="h-3 w-3" /> Thành công
                          </Badge>
                          <span className="text-[11px] font-semibold text-foreground">
                            🎙️ {item.voice}
                          </span>
                          <span className="text-[10px] text-muted-foreground">({item.speed}x)</span>
                          <span className="text-[10px] text-muted-foreground">· {item.sizeKb} KB</span>
                        </div>

                        <span className="text-[10px] text-muted-foreground">
                          {item.createdAt.toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Text trích dẫn */}
                      <p className="text-xs text-foreground/80 line-clamp-2 bg-muted/40 p-2 rounded text-[11px] leading-relaxed">
                        {item.text}
                      </p>

                      {/* Audio Player & Nút tải về */}
                      <div className="space-y-1.5 pt-1">
                        <audio
                          controls
                          autoPlay={idx === 0}
                          src={item.url}
                          className="w-full h-8 max-w-full rounded"
                        />
                        <div className="flex justify-end pt-0.5">
                          <a
                            href={item.url}
                            download={`basa3d-voice-${item.id}.wav`}
                            className="inline-flex items-center h-7 px-3 rounded-md text-xs font-medium border border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 gap-1.5 transition-colors"
                          >
                            <Download className="h-3 w-3" /> Tải về .WAV
                          </a>
                        </div>
                      </div>
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
