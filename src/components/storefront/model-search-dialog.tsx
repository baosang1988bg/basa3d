'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Search,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  Upload,
  Loader2,
  Globe,
  Tag,
  Layers,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  MODEL_ENGINES,
  optimizeSearchKeywords,
  buildGoogle3dSearchUrl,
  type ModelEngine,
} from '@/lib/search/meta-engines';
import { Button } from '@/components/ui/button';

const MAX_IMAGE_EDGE = 1024;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/** Downscales to ≤1024 px and re-encodes as JPEG so uploads stay far below the server's 4 MB cap. */
async function downscaleImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.fillStyle = '#ffffff'; // transparent PNG → white background instead of black JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    bitmap.close();
  }
}

export function ModelSearchDialog({
  isOpen,
  onClose,
  initialQuery = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const t = useTranslations('modelSearch');
  const [tab, setTab] = useState<'text' | 'image'>('text');
  const [query, setQuery] = useState(initialQuery);

  // Image search states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [aiKeywordsEn, setAiKeywordsEn] = useState<string[]>([]);
  const [aiKeywordsZh, setAiKeywordsZh] = useState<string[]>([]);
  const [detectedCategory, setDetectedCategory] = useState<string | null>(null);
  const [googleLensUrl, setGoogleLensUrl] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const optimization = optimizeSearchKeywords(query);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll and move focus into the dialog while it is open; restore on close.
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  // Support paste image anywhere when modal is open on image tab
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (!isOpen || tab !== 'image') return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            break;
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, tab]);

  if (!isOpen) return null;

  async function handleImageFile(file: File) {
    setAnalyzeError(null);
    if (!file.type.startsWith('image/')) {
      setAnalyzeError(t('errorType'));
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setAnalyzeError(t('errorSize'));
      return;
    }
    try {
      const base64 = await downscaleImage(file);
      setImagePreview(base64);
      await analyzeImage(base64, 'image/jpeg');
    } catch {
      setAnalyzeError(t('errorRead'));
    }
  }

  async function analyzeImage(base64: string, mimeType: string) {
    try {
      setAnalyzingImage(true);
      setAnalyzeError(null);
      setAiKeywordsEn([]);
      setAiKeywordsZh([]);

      const res = await fetch('/api/public/search/visual-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        setAnalyzeError(res.status === 429 ? t('errorRateLimited') : res.status === 413 ? t('errorTooLarge') : t('errorAnalyze'));
        setGoogleLensUrl(buildGoogle3dSearchUrl('3d printed item'));
        return;
      }
      if (json.data.aiUsed === false) {
        setAnalyzeError(t('aiFallback'));
      }
      if (json.data) {
        setAiKeywordsEn(json.data.keywordsEn || []);
        setAiKeywordsZh(json.data.keywordsZh || []);
        setDetectedCategory(json.data.category || null);
        setGoogleLensUrl(json.data.googleLensUrl || null);
      }
    } catch {
      setAnalyzeError(t('errorNetwork'));
    } finally {
      setAnalyzingImage(false);
    }
  }

  function handleOpenEngine(engine: ModelEngine, searchKeyword?: string) {
    const kw = searchKeyword || query.trim();
    if (!kw) return;
    const url = engine.buildSearchUrl(kw);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-search-title"
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl outline-none transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          aria-label={t('close')}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        {/* Header & Tabs */}
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary flex items-center gap-1">
              <Sparkles className="size-3.5" />
              {t('badge')}
            </span>
            <span className="text-xs text-muted-foreground">{t('subtitle')}</span>
          </div>

          <h2 id="model-search-title" className="mt-2 text-xl font-extrabold text-foreground sm:text-2xl">
            {t('title')}
          </h2>

          <div role="tablist" className="mt-4 flex border-b border-border">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'text'}
              onClick={() => setTab('text')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === 'text'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Search className="size-4" />
              {t('tabText')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'image'}
              onClick={() => setTab('image')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === 'image'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <ImageIcon className="size-4" />
              {t('tabImage')}
            </button>
          </div>
        </div>

        {/* TAB 1: TEXT SEARCH */}
        {tab === 'text' && (
          <div className="mt-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('placeholder')}
                aria-label={t('tabText')}
                className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                autoFocus
              />
            </div>

            {/* Smart Keyword Suggestions */}
            {(optimization.suggestedEn || optimization.suggestedZh) && (
              <div className="rounded-xl bg-secondary/50 p-3 text-xs flex flex-col gap-2">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Tag className="size-3.5 text-primary" />
                  {t('suggestTitle')}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {optimization.suggestedEn && (
                    <button
                      onClick={() => setQuery(optimization.suggestedEn!)}
                      className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {t('suggestEn', { keyword: optimization.suggestedEn })}
                    </button>
                  )}
                  {optimization.suggestedZh && (
                    <button
                      onClick={() => setQuery(optimization.suggestedZh!)}
                      className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-amber-600 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-colors"
                    >
                      {t('suggestZh', { keyword: optimization.suggestedZh })}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Engine Grid Selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {t('pickEngine')}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MODEL_ENGINES.map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => handleOpenEngine(eng)}
                    disabled={!query.trim()}
                    className="flex flex-col items-start rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/50 hover:bg-secondary/40 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-foreground">{eng.shortName}</span>
                      <ExternalLink className="size-3 text-muted-foreground" />
                    </div>
                    <span className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{eng.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex items-center justify-between">
              {/* Plain links instead of window.open ×3: Safari/Firefox block every popup after the first one. */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Layers className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t('quickTop')}</span>
                {MODEL_ENGINES.filter((e) => ['yeggi', 'thangs', 'makerworld-cn'].includes(e.id)).map((eng) => (
                  query.trim() ? (
                    <a key={eng.id} href={eng.buildSearchUrl(query.trim())} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                      {eng.shortName}
                    </a>
                  ) : (
                    <span key={eng.id} className="text-muted-foreground">{eng.shortName}</span>
                  )
                ))}
              </div>

              <Button
                size="sm"
                onClick={() => {
                  const googleUrl = buildGoogle3dSearchUrl(query.trim());
                  window.open(googleUrl, '_blank', 'noopener,noreferrer');
                }}
                disabled={!query.trim()}
                className="text-xs gap-1.5"
              >
                <Globe className="size-3.5" />
                {t('googleStl')}
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: IMAGE SEARCH */}
        {tab === 'image' && (
          <div className="mt-5 space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
              }}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {analyzeError ? (
              <p role="alert" className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-300">{analyzeError}</p>
            ) : null}

            {!imagePreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleImageFile(file);
                }}
                className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-secondary/50"
              >
                <Upload className="size-8 text-muted-foreground mb-2" />
                <span className="block text-sm font-bold text-foreground">
                  {t('dropTitle')}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t('dropHint')}
                </span>
              </button>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <img
                    src={imagePreview}
                    alt={t('previewAlt')}
                    className="size-24 rounded-lg object-cover border border-border"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground">{t('analyzingLabel')}</p>
                    {detectedCategory && (
                      <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                        {t('topic', { category: detectedCategory })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAnalyzeError(null);
                        setImagePreview(null);
                        setAiKeywordsEn([]);
                        setAiKeywordsZh([]);
                      }}
                      className="mt-2 block text-xs text-destructive hover:underline"
                    >
                      {t('changeImage')}
                    </button>
                  </div>
                </div>

                {analyzingImage ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-secondary/50 p-4 text-xs font-medium text-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>{t('analyzing')}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* EN Keywords */}
                    {aiKeywordsEn.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                          {t('keywordsEn')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {aiKeywordsEn.map((kw) => (
                            <button
                              key={kw}
                              onClick={() => {
                                setQuery(kw);
                                setTab('text');
                              }}
                              className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              🔍 {kw}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ZH Keywords */}
                    {aiKeywordsZh.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                          {t('keywordsZh')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {aiKeywordsZh.map((kw) => (
                            <button
                              key={kw}
                              onClick={() => {
                                const mwCn = MODEL_ENGINES.find((e) => e.id === 'makerworld-cn');
                                if (mwCn) handleOpenEngine(mwCn, kw);
                              }}
                              className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-500 hover:text-white transition-colors"
                            >
                              🇨🇳 {kw}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Google Lens Direct Link */}
                    {googleLensUrl && (
                      <div className="pt-2 border-t border-border">
                        <Button
                          size="sm"
                          onClick={() => window.open(googleLensUrl, '_blank', 'noopener,noreferrer')}
                          className="w-full gap-2 text-xs"
                        >
                          <Globe className="size-4" />
                          <span>{t('googleLens')}</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
