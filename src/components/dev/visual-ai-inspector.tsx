'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Target, X, Copy, Check, MousePointerClick, RefreshCw } from 'lucide-react';

type ElementInfo = {
  componentName: string;
  tagName: string;
  attributes: Record<string, string>;
  textSnippet: string;
  rect: DOMRect;
};

function getReactComponentName(element: HTMLElement): string {
  try {
    const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$'));
    if (!fiberKey) return element.tagName.toLowerCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fiber = (element as any)[fiberKey];
    while (fiber) {
      if (typeof fiber.type === 'function') {
        const name = fiber.type.displayName || fiber.type.name;
        if (
          name &&
          !['Anonymous', 'Fragment', 'Consumer', 'Provider', 'Context', 'ForwardRef'].includes(name)
        ) {
          return name;
        }
      }
      fiber = fiber.return;
    }
  } catch {
    // Ignore errors reading fiber
  }
  return element.tagName.toLowerCase();
}

function extractElementInfo(element: HTMLElement): ElementInfo {
  const componentName = getReactComponentName(element);
  const tagName = element.tagName.toLowerCase();
  const attributes: Record<string, string> = {};

  ['id', 'name', 'type', 'placeholder', 'aria-label'].forEach((attr) => {
    const val = element.getAttribute(attr);
    if (val) attributes[attr] = val;
  });

  const textSnippet = (element.innerText || element.textContent || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 100);

  return {
    componentName,
    tagName,
    attributes,
    textSnippet,
    rect: element.getBoundingClientRect(),
  };
}

export function VisualAiInspector() {
  const [isActive, setIsActive] = useState(false);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string>('');
  const [selectedInfo, setSelectedInfo] = useState<ElementInfo | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close inspector on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedInfo) {
          setSelectedInfo(null);
        } else {
          setIsActive(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInfo]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (selectedInfo) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [selectedInfo]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (selectedInfo) return; // Frozen while modal is open

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Ignore clicks/hovers inside the inspector widget itself
    if (target.closest('[data-visual-ai-inspector]')) {
      setHoveredRect(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const compName = getReactComponentName(target);
    setHoveredRect(rect);
    setHoveredLabel(compName !== target.tagName.toLowerCase() ? `<${compName}>` : `<${target.tagName.toLowerCase()}>`);
  }, [selectedInfo]);

  const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Don't intercept clicks inside our inspector popup or toggle button
    if (target.closest('[data-visual-ai-inspector]')) return;

    e.preventDefault();
    e.stopPropagation();

    const info = extractElementInfo(target);
    setSelectedInfo(info);
    setUserPrompt('');
    setCopied(false);
    setHoveredRect(null);
  }, []);

  useEffect(() => {
    if (!isActive) {
      setHoveredRect(null);
      setSelectedInfo(null);
      return;
    }

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isActive, handleMouseMove, handleClick]);

  const handleCopyPrompt = () => {
    if (!selectedInfo) return;

    const attrParts = Object.entries(selectedInfo.attributes)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');

    const formattedPrompt = [
      `[Yêu cầu sửa giao diện UI]:`,
      `- Component React: \`<${selectedInfo.componentName}>\``,
      `- Thẻ HTML: \`<${selectedInfo.tagName}${attrParts ? ` ${attrParts}` : ''}>\``,
      selectedInfo.textSnippet ? `- Nội dung đang hiển thị: "${selectedInfo.textSnippet}"` : null,
      `- Yêu cầu cần sửa: ${userPrompt.trim() || 'Cần chỉnh sửa phần tử này'}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(formattedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setSelectedInfo(null);
        setIsActive(false);
      }, 1500);
    });
  };

  return (
    <div data-visual-ai-inspector className="font-sans">
      {/* Floating Toggle Button */}
      <div className="fixed bottom-4 right-4 z-[999999] flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setIsActive((prev) => !prev);
            setSelectedInfo(null);
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold shadow-2xl transition-all ${
            isActive
              ? 'bg-amber-500 text-black ring-4 ring-amber-300 animate-pulse'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
          }`}
          title="Bật/Tắt chế độ click vào giao diện để yêu cầu AI sửa"
        >
          <Target className="size-4" />
          <span>{isActive ? 'Đang bật: Click chỗ cần sửa' : '🎯 Chỉ AI sửa UI'}</span>
        </button>
      </div>

      {/* Hover Highlight Box */}
      {isActive && !selectedInfo && hoveredRect ? (
        <div
          style={{
            position: 'fixed',
            top: `${hoveredRect.top}px`,
            left: `${hoveredRect.left}px`,
            width: `${hoveredRect.width}px`,
            height: `${hoveredRect.height}px`,
            pointerEvents: 'none',
            zIndex: 999990,
          }}
          className="rounded border-2 border-dashed border-indigo-500 bg-indigo-500/15 transition-all duration-75"
        >
          <span className="absolute -top-6 left-0 rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-mono font-semibold text-white shadow">
            {hoveredLabel}
          </span>
        </div>
      ) : null}

      {/* Input Prompt Modal */}
      {selectedInfo ? (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <MousePointerClick className="size-4 text-primary" />
                <span>Yêu cầu AI sửa phần tử này</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInfo(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Target element info badge */}
            <div className="flex flex-col gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-muted-foreground">Component:</span>
                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary">
                  &lt;{selectedInfo.componentName}&gt;
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                  &lt;{selectedInfo.tagName}&gt;
                </span>
              </div>
              {selectedInfo.textSnippet ? (
                <div className="truncate text-muted-foreground">
                  <span className="font-semibold">Nội dung:</span> &quot;{selectedInfo.textSnippet}&quot;
                </div>
              ) : null}
            </div>

            {/* Textarea for user instruction */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ai-prompt-input" className="text-xs font-semibold text-foreground">
                Nhập yêu cầu sửa của bạn:
              </label>
              <textarea
                id="ai-prompt-input"
                ref={textareaRef}
                rows={3}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Ví dụ: Thêm dropdown chọn profile P1S/P2S ở đây; đổi màu nút này thành xanh lá; sửa tiêu đề thành..."
                className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground shadow-xs focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleCopyPrompt();
                  }
                }}
              />
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {[
                'Thêm tính năng ở đây',
                'Đổi giao diện / màu sắc',
                'Sửa nội dung chữ',
                'Ẩn / Xoá phần tử này',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setUserPrompt((prev) => (prev ? `${prev}; ${chip}` : chip))}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  + {chip}
                </button>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedInfo(null);
                  setIsActive(true);
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                <RefreshCw className="size-3.5" />
                <span>Chọn phần tử khác</span>
              </button>

              <button
                type="button"
                onClick={handleCopyPrompt}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold shadow-md transition-all ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-primary text-primary-foreground hover:opacity-90'
                }`}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span>{copied ? '✓ Đã copy! Dán (Cmd+V) vào chat AI' : '📋 Copy Prompt cho AI (⌘+Enter)'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
