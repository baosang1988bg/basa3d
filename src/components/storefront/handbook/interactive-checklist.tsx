'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { HandbookChecklistItem } from '@/data/handbook/types';
import { CHECKLIST_STORAGE_KEY, parseChecklistState, serializeChecklistState } from '@/lib/handbook/checklist-storage';
import { cn } from '@/lib/utils';

// Phase 50 — pre-flight checklist persisted in localStorage.
//
// Hydration: useSyncExternalStore renders getServerSnapshot (null → nothing ticked) on the server
// AND during hydration, then re-renders with the stored value — so server HTML and the first client
// render always match. The snapshot is the raw string (compared by value), so getSnapshot never
// returns a fresh object and cannot cause a render loop.
//
// Storage can throw (Safari private mode, blocked site data) or fail on write (quota). An in-memory
// copy keeps the checklist usable for the session in that case; it just won't survive a reload.
const CHANGE_EVENT = 'basa3d:preflight-checklist-change';
let memoryValue: string | null = null;
let storageUsable = true;

function readSnapshot(): string | null {
  if (!storageUsable) return memoryValue;
  try {
    return window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
  } catch {
    storageUsable = false;
    return memoryValue;
  }
}

function writeValue(value: string | null): void {
  memoryValue = value;
  if (storageUsable) {
    try {
      if (value === null) window.localStorage.removeItem(CHECKLIST_STORAGE_KEY);
      else window.localStorage.setItem(CHECKLIST_STORAGE_KEY, value);
    } catch {
      storageUsable = false;
    }
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  // `storage` fires for writes from other tabs; CHANGE_EVENT for writes from this tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CHECKLIST_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const getServerSnapshot = () => null;

export function InteractiveChecklist({ items }: { items: HandbookChecklistItem[] }) {
  const raw = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);
  const validIds = useMemo(() => items.map((item) => item.id), [items]);
  const checked = useMemo(() => new Set(parseChecklistState(raw, validIds)), [raw, validIds]);
  const doneCount = checked.size;
  const allDone = doneCount === items.length && items.length > 0;

  const toggle = useCallback((id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeValue(serializeChecklistState(next, validIds));
  }, [checked, validIds]);

  const reset = useCallback(() => writeValue(null), []);

  return (
    <div className="not-prose rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold" aria-live="polite">
          {allDone ? 'Sẵn sàng — chúc bài in thành công!' : `Đã kiểm tra ${doneCount}/${items.length} bước`}
        </p>
        <button
          type="button"
          onClick={reset}
          disabled={doneCount === 0}
          className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Bắt đầu bài in mới
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
      </div>
      <ol className="mt-4 space-y-2">
        {items.map((item, index) => {
          const isChecked = checked.has(item.id);
          const inputId = `preflight-${item.id}`;
          return (
            <li key={item.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  'flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150',
                  isChecked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-secondary/60',
                )}
              >
                <input id={inputId} type="checkbox" className="peer sr-only" checked={isChecked} onChange={() => toggle(item.id)} />
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                    isChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50',
                  )}
                >
                  {isChecked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-sm font-semibold', isChecked && 'text-muted-foreground line-through decoration-1')}>
                    <span className="tabular-nums text-primary">{index + 1}.</span> {item.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{item.detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
